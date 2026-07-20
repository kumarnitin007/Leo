/**
 * Unified Backup — shared types.
 *
 * A backup is a single portable `.myday` JSON file (the "envelope"). Its
 * `manifest` stays in plaintext so a file can be identified before it is
 * unlocked; all real user data lives inside the encrypted `payload`.
 *
 * The whole payload is encrypted once with a key derived (PBKDF2) from the
 * user's Safe master password plus a salt embedded in the file, so the backup
 * is self-contained and does not depend on any server-side salt to open.
 */

import type { CryptoKey } from '../../utils/encryption';

export const BACKUP_FORMAT = 'myday-backup';
export const SCHEMA_VERSION = 1;

/** Crypto parameters needed to re-derive the key and decrypt the payload. */
export interface BackupCryptoMeta {
  algo: 'AES-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // base64
  iv: string;   // base64
}

/** Plaintext, identifies a backup without unlocking it. */
export interface BackupManifest {
  backupId: string;
  appVersion: string;
  createdAt: string;      // ISO
  deviceLabel?: string;
  userTag: string;        // sha256(userId) prefix — non-reversible owner hint
  domainCounts: Record<string, number>;
  checksum: string;       // sha256 hex of the payload ciphertext
}

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  crypto: BackupCryptoMeta;
  manifest: BackupManifest;
  payload: string;        // base64 AES-GCM ciphertext of BundleV1 JSON
}

/** The decrypted contents. Each domain key maps to an array of records. */
export interface BundleV1 {
  schemaVersion: number;
  createdAt: string;
  domains: Record<string, unknown[]>;
}

export type DuplicatePolicy = 'skip' | 'update-if-newer';

/** Runtime context passed to every domain during gather / diff / restore. */
export interface BackupContext {
  userId: string;
  /** Safe master key — required only by sensitive blob domains (bank, trades). */
  safeKey: CryptoKey | null;
}

export interface DomainDiff {
  key: string;
  label: string;
  incoming: number;   // records in the file for this domain
  newCount: number;   // not present locally
  duplicate: number;  // already present locally
  newer: number;      // present locally but the file's copy is newer
}

export interface DomainRestoreResult {
  key: string;
  label: string;
  added: number;
  skipped: number;
  updated: number;
  failed: number;
  error?: string;
}

export interface CreateBackupResult {
  envelope: BackupEnvelope;
  /** Non-fatal problems (e.g. a single domain failed to gather). Surfaced in UI. */
  warnings: string[];
}

/** Lightweight local record of backups the user has created. */
export interface BackupHistoryEntry {
  backupId: string;
  createdAt: string;
  deviceLabel?: string;
  destination: string;
  fileName: string;
  totalRecords: number;
  domainCounts: Record<string, number>;
}
