/**
 * Trades storage.
 *
 * Persists the Trades JSON document encrypted-at-rest in localStorage, keyed
 * per user. The whole document is encrypted with the vault master key (same
 * AES-256-GCM key used by the rest of the Vault), so trade data is never stored
 * in plaintext.
 *
 * The schema is intentionally not frozen: `data` is an opaque JSON blob, so it
 * can evolve without migrations. When we move to Supabase, only `load()` /
 * `save()` need to change (swap localStorage for a `myday_trades_records`
 * upsert of the same encrypted payload).
 */

import { CryptoKey, encryptData, decryptData } from '../../utils/encryption';
import {
  TradesData,
  RawTradeTxn,
  TradeImportBatch,
  emptyTradesData,
  TRADES_DATA_VERSION,
} from '../../types/trades';

const KEY_PREFIX = 'myday_trades_records_v1';

function storageKey(userId?: string): string {
  return `${KEY_PREFIX}:${userId || 'local'}`;
}

export async function loadTrades(userId: string | undefined, key: CryptoKey): Promise<TradesData> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return emptyTradesData();
    const { encrypted, iv } = JSON.parse(raw) as { encrypted: string; iv: string };
    const json = await decryptData(encrypted, iv, key);
    const data = JSON.parse(json) as TradesData;
    if (!data || !Array.isArray(data.transactions)) return emptyTradesData();
    return {
      version: data.version ?? TRADES_DATA_VERSION,
      transactions: data.transactions,
      imports: Array.isArray(data.imports) ? data.imports : [],
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
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
  const payload: TradesData = { ...data, updatedAt: new Date().toISOString() };
  const { encrypted, iv } = await encryptData(JSON.stringify(payload), key);
  localStorage.setItem(storageKey(userId), JSON.stringify({ encrypted, iv }));
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
  meta: { fileName: string; source: TradeImportBatch['source']; tags: string[]; dateRange?: { start: string; end: string } }
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

  return {
    data: {
      version: TRADES_DATA_VERSION,
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
