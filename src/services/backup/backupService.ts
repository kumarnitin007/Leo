/**
 * Unified Backup — orchestration.
 *
 * create  -> gather every domain, encrypt the bundle with the master password.
 * inspect -> read a file's manifest WITHOUT unlocking it (for identification).
 * open    -> verify + decrypt into a bundle.
 * diff    -> compare a bundle against local data (new / duplicate / newer).
 * restore -> write selected domains, skipping duplicates.
 */

import { requireAuth } from '../../storage/core';
import { verifyMasterPassword, getEncryptionKey, hasMasterPassword } from '../../storage';
import type { CryptoKey } from '../../utils/encryption';

import {
  BACKUP_FORMAT,
  SCHEMA_VERSION,
  BackupContext,
  BackupEnvelope,
  BackupManifest,
  BundleV1,
  CreateBackupResult,
  DomainDiff,
  DomainRestoreResult,
  DuplicatePolicy,
} from './backupTypes';
import { encryptBundle, decryptBundle, sha256Hex, PBKDF2_ITERATIONS } from './backupCrypto';
import { ALL_DOMAINS, getDomain } from './backupRegistry';

const APP_VERSION = (import.meta.env.APP_VERSION as string) || 'unknown';

/** Build the runtime context (userId + optional Safe key) from a password. */
async function buildContext(masterPassword: string): Promise<BackupContext> {
  const { userId } = await requireAuth();
  let safeKey: CryptoKey | null = null;
  try {
    if (await hasMasterPassword()) safeKey = await getEncryptionKey(masterPassword);
  } catch (e) {
    console.warn('[backup] Could not derive Safe key (bank/trades will be skipped):', e);
  }
  return { userId, safeKey };
}

/**
 * Create an encrypted backup of every domain.
 * Requires the Safe master password (used to encrypt the file and to read the
 * encrypted bank/trades blobs).
 */
export async function createBackup(masterPassword: string, deviceLabel?: string): Promise<CreateBackupResult> {
  if (!masterPassword) throw new Error('Master password is required to create a backup.');

  const hasMk = await hasMasterPassword();
  if (hasMk) {
    const ok = await verifyMasterPassword(masterPassword);
    if (!ok) throw new Error('That master password is incorrect.');
  }

  const ctx = await buildContext(masterPassword);
  const warnings: string[] = [];
  const domains: Record<string, unknown[]> = {};
  const domainCounts: Record<string, number> = {};

  for (const d of ALL_DOMAINS) {
    try {
      const records = await d.gather(ctx);
      if (records.length > 0) {
        domains[d.key] = records;
        domainCounts[d.key] = d.count(records);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error(`[backup] Failed to read ${d.label}:`, msg);
      warnings.push(`${d.label} could not be included (${msg})`);
    }
  }

  if (Object.keys(domains).length === 0) {
    throw new Error('Nothing to back up (no data found, or the master password could not unlock the Safe).');
  }

  const bundle: BundleV1 = { schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString(), domains };
  const { salt, iv, payload } = await encryptBundle(JSON.stringify(bundle), masterPassword);
  const checksum = await sha256Hex(payload);
  const userTag = (await sha256Hex(ctx.userId)).slice(0, 16);

  const manifest: BackupManifest = {
    backupId: crypto.randomUUID(),
    appVersion: APP_VERSION,
    createdAt: bundle.createdAt,
    deviceLabel: deviceLabel?.trim() || undefined,
    userTag,
    domainCounts,
    checksum,
  };

  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    crypto: { algo: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations: PBKDF2_ITERATIONS, salt, iv },
    manifest,
    payload,
  };

  return { envelope, warnings };
}

/** Parse + validate an envelope from raw file text. Does NOT decrypt. */
export function parseEnvelope(fileText: string): BackupEnvelope {
  let obj: any;
  try {
    obj = JSON.parse(fileText);
  } catch {
    throw new Error('This file is not valid JSON — it may be corrupted or not a MyDay backup.');
  }
  if (obj?.format !== BACKUP_FORMAT || !obj?.manifest || !obj?.payload || !obj?.crypto) {
    throw new Error('This does not look like a MyDay backup file.');
  }
  if (typeof obj.schemaVersion === 'number' && obj.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`This backup was made by a newer app version (schema v${obj.schemaVersion}). Please update MyDay first.`);
  }
  return obj as BackupEnvelope;
}

/** Read a backup's manifest for identification, without unlocking it. */
export function inspectBackup(fileText: string): BackupManifest {
  return parseEnvelope(fileText).manifest;
}

/** Verify checksum and decrypt an envelope into its bundle. */
export async function openBackup(envelope: BackupEnvelope, masterPassword: string): Promise<BundleV1> {
  const checksum = await sha256Hex(envelope.payload);
  if (checksum !== envelope.manifest.checksum) {
    console.warn('[backup] Checksum mismatch — file may be truncated or altered.');
  }
  let json: string;
  try {
    json = await decryptBundle(envelope.payload, envelope.crypto.iv, envelope.crypto.salt, masterPassword);
  } catch {
    throw new Error('Could not decrypt this backup. The master password may be wrong, or the file is corrupted.');
  }
  try {
    return JSON.parse(json) as BundleV1;
  } catch {
    throw new Error('Backup contents are corrupted (decryption succeeded but data is unreadable).');
  }
}

/**
 * Unlock a backup and preview what a restore would change.
 * Returns everything the UI needs to drive the restore step.
 */
export async function prepareRestore(
  fileText: string,
  masterPassword: string,
  policy: DuplicatePolicy = 'skip'
): Promise<{ manifest: BackupManifest; bundle: BundleV1; ctx: BackupContext; diffs: DomainDiff[] }> {
  const envelope = parseEnvelope(fileText);
  const bundle = await openBackup(envelope, masterPassword);
  const ctx = await buildContext(masterPassword);

  const diffs: DomainDiff[] = [];
  for (const key of Object.keys(bundle.domains)) {
    const mod = getDomain(key);
    const records = bundle.domains[key] || [];
    if (!mod) {
      diffs.push({ key, label: key, incoming: records.length, newCount: 0, duplicate: 0, newer: 0 });
      continue;
    }
    try {
      diffs.push(await mod.diff(records, ctx, policy));
    } catch (e: any) {
      console.error(`[backup] diff failed for ${key}:`, e?.message || e);
      diffs.push({ key, label: mod.label, incoming: records.length, newCount: records.length, duplicate: 0, newer: 0 });
    }
  }
  return { manifest: envelope.manifest, bundle, ctx, diffs };
}

/** Restore the selected domains from an already-opened bundle. */
export async function runRestore(
  bundle: BundleV1,
  ctx: BackupContext,
  selectedKeys: string[],
  policy: DuplicatePolicy
): Promise<DomainRestoreResult[]> {
  const results: DomainRestoreResult[] = [];
  for (const key of selectedKeys) {
    const mod = getDomain(key);
    const records = bundle.domains[key] || [];
    if (!mod) {
      results.push({ key, label: key, added: 0, skipped: 0, updated: 0, failed: records.length, error: 'Unknown domain' });
      continue;
    }
    try {
      results.push(await mod.restore(records, ctx, policy));
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error(`[backup] restore failed for ${key}:`, msg);
      results.push({ key, label: mod.label, added: 0, skipped: 0, updated: 0, failed: records.length, error: msg });
    }
  }
  return results;
}
