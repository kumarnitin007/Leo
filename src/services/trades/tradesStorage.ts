/**
 * Trades storage.
 *
 * Persists the Trades JSON document encrypted-at-rest with the vault master key
 * (AES-256-GCM) — trade data is never stored in plaintext. The document is
 * stored as a single opaque JSON blob so the schema stays unfrozen (no
 * migrations needed as the shape evolves).
 *
 * Store: Supabase `myday_trades_records` (one encrypted blob per user →
 * cross-device sync + durability). This is intentionally DB-only (no
 * localStorage fallback) so what you see always reflects the database.
 */

import { CryptoKey, encryptData, decryptData } from '../../utils/encryption';
import getSupabaseClient from '../../lib/supabase';
import {
  TradesData,
  RawTradeTxn,
  TradeImportBatch,
  emptyTradesData,
  TRADES_DATA_VERSION,
} from '../../types/trades';

const TABLE = 'myday_trades_records';

type EncryptedPayload = { encrypted: string; iv: string };

async function decryptPayload(raw: string, key: CryptoKey): Promise<TradesData | null> {
  const { encrypted, iv } = JSON.parse(raw) as EncryptedPayload;
  const json = await decryptData(encrypted, iv, key);
  const data = JSON.parse(json) as TradesData;
  if (!data || !Array.isArray(data.transactions)) return null;
  return {
    version: data.version ?? TRADES_DATA_VERSION,
    accounts: Array.isArray(data.accounts) ? data.accounts : [],
    transactions: data.transactions,
    imports: Array.isArray(data.imports) ? data.imports : [],
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

export async function loadTrades(userId: string | undefined, key: CryptoKey): Promise<TradesData> {
  const client = getSupabaseClient();
  if (!client || !userId) {
    console.warn('[tradesStorage] Supabase not available — no trades loaded.');
    return emptyTradesData();
  }
  try {
    const { data, error } = await client
      .from(TABLE)
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('[tradesStorage] Supabase load error:', error.message);
      return emptyTradesData();
    }
    if (!data?.data) return emptyTradesData();
    const parsed = await decryptPayload(data.data as string, key);
    return parsed || emptyTradesData();
  } catch (err) {
    console.error('[tradesStorage] Failed to load trades:', err);
    return emptyTradesData();
  }
}

export async function saveTrades(
  userId: string | undefined,
  key: CryptoKey,
  data: TradesData
): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !userId) {
    throw new Error('Cannot save trades: Supabase is not available.');
  }
  const payload: TradesData = { ...data, updatedAt: new Date().toISOString() };
  const { encrypted, iv } = await encryptData(JSON.stringify(payload), key);
  const encryptedPayload = JSON.stringify({ encrypted, iv });
  const { error } = await client
    .from(TABLE)
    .upsert(
      { user_id: userId, data: encryptedPayload, updated_at: payload.updatedAt },
      { onConflict: 'user_id' }
    );
  if (error) {
    console.error('[tradesStorage] Supabase save failed:', error.message);
    throw new Error(`Save failed: ${error.message}`);
  }
}

export interface MergeResult {
  data: TradesData;
  batch: TradeImportBatch;
}

/**
 * Merge newly parsed rows into existing data, skipping duplicates by id.
 * Returns the updated document plus a summary batch record.
 */
export function mergeTrades(
  existing: TradesData,
  incoming: RawTradeTxn[],
  meta: { fileName: string; source: TradeImportBatch['source']; tags: string[]; account?: string; dateRange?: { start: string; end: string } }
): MergeResult {
  const existingIds = new Set(existing.transactions.map(t => t.id));
  const seenInBatch = new Set<string>();
  const added: RawTradeTxn[] = [];
  let duplicates = 0;

  for (const row of incoming) {
    if (existingIds.has(row.id) || seenInBatch.has(row.id)) {
      duplicates++;
      continue;
    }
    seenInBatch.add(row.id);
    added.push(row);
  }

  const batch: TradeImportBatch = {
    id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    fileName: meta.fileName,
    source: meta.source,
    account: meta.account,
    importedAt: new Date().toISOString(),
    rowsParsed: incoming.length,
    added: added.length,
    duplicates,
    skipped: 0,
    tags: meta.tags,
    dateRange: meta.dateRange,
  };

  // Stamp the resolved batch id onto the added rows.
  added.forEach(r => { r.importBatchId = batch.id; });

  const transactions = [...existing.transactions, ...added].sort(
    (a, b) => (a.activityDate < b.activityDate ? 1 : a.activityDate > b.activityDate ? -1 : 0)
  );

  // Preserve the managed account list and auto-add a newly used account/source.
  const existingAccounts = Array.isArray(existing.accounts) ? existing.accounts : [];
  const accounts = meta.account && !existingAccounts.includes(meta.account)
    ? [...existingAccounts, meta.account]
    : existingAccounts;

  return {
    data: {
      version: TRADES_DATA_VERSION,
      accounts,
      transactions,
      imports: [batch, ...existing.imports],
      updatedAt: new Date().toISOString(),
    },
    batch,
  };
}

/** Preview how many of the incoming rows are new vs duplicate, without saving. */
export function previewMerge(
  existing: TradesData,
  incoming: RawTradeTxn[]
): { newCount: number; duplicateCount: number } {
  const existingIds = new Set(existing.transactions.map(t => t.id));
  const seen = new Set<string>();
  let newCount = 0;
  let duplicateCount = 0;
  for (const row of incoming) {
    if (existingIds.has(row.id) || seen.has(row.id)) {
      duplicateCount++;
    } else {
      seen.add(row.id);
      newCount++;
    }
  }
  return { newCount, duplicateCount };
}
