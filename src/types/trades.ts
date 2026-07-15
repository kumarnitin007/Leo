/**
 * Trades types (Vault → Trades)
 *
 * NOTE: The schema is intentionally NOT frozen while this feature is in its
 * initial design stage. Records are stored as a single versioned JSON blob
 * (see `services/trades/tradesStorage.ts`), so this shape can evolve freely
 * without any database migration. `raw` preserves the original row so we never
 * lose source data as the parsed model changes.
 */

export type TradeSource = 'robinhood' | 'unknown';

export type TradeKind =
  | 'option_premium' // STO / BTO / STC / BTC
  | 'option_event'   // OEXP / OASGN / OEXCS
  | 'equity'         // Buy / Sell
  | 'dividend'       // CDIV
  | 'tax'            // DTAX
  | 'interest'       // INT / GOLD
  | 'lending'        // SLIP
  | 'deposit'        // ACH / RTP
  | 'other';

export type OptionType = 'CALL' | 'PUT';

export interface RawTradeTxn {
  /** Deterministic id derived from row content (used for dedupe). */
  id: string;
  source: TradeSource;

  activityDate: string;        // ISO YYYY-MM-DD
  processDate?: string;        // ISO
  settleDate?: string;         // ISO

  instrument: string;          // ticker symbol, may be '' for cash rows
  description: string;
  transCode: string;           // raw broker code (STO, BTO, Buy, CDIV, ...)
  kind: TradeKind;             // normalized classification

  quantity?: number;           // numeric quantity (contracts or shares)
  quantityRaw?: string;        // preserve suffixes like "1S"
  price?: number;              // per-unit price
  amount?: number;             // signed cash flow (+ credit / - debit)

  // Best-effort option metadata (only when parseable)
  optionType?: OptionType;
  strike?: number;
  expiration?: string;         // ISO

  tags: string[];              // tag ids applied at import time
  importBatchId: string;
  importedAt: string;          // ISO timestamp

  /** Original spreadsheet row, kept verbatim for safety. */
  raw: Record<string, string>;
}

export interface TradeImportBatch {
  id: string;
  fileName: string;
  source: TradeSource;
  importedAt: string;          // ISO
  rowsParsed: number;
  added: number;
  duplicates: number;
  skipped: number;
  tags: string[];
  dateRange?: { start: string; end: string };
}

export interface TradesData {
  version: number;
  transactions: RawTradeTxn[];
  imports: TradeImportBatch[];
  updatedAt: string;
}

export const TRADES_DATA_VERSION = 1;

export const emptyTradesData = (): TradesData => ({
  version: TRADES_DATA_VERSION,
  transactions: [],
  imports: [],
  updatedAt: new Date().toISOString(),
});
