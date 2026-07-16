/**
 * Trades types (Vault → Trades)
 *
 * NOTE: The schema is intentionally NOT frozen while this feature is in its
 * initial design stage. Records are stored as a single versioned JSON blob
 * (see `services/trades/tradesStorage.ts`), so this shape can evolve freely
 * without any database migration. `raw` preserves the original row so we never
 * lose source data as the parsed model changes.
 */

export type TradeSource = 'robinhood' | 'fidelity' | 'unknown';

/**
 * Seed suggestions for brokerage accounts / sources. The authoritative list is
 * user-managed at runtime and stored in `TradesData.accounts`; these are only
 * offered when the user hasn't created any of their own yet.
 */
export const TRADE_ACCOUNTS = [
  'Robinhood - Nitin - Individual',
  'Robinhood - Nitin - Roth',
  'Fidelity - Nitin',
  'Fidelity - Nitin - Roth',
] as const;

export type TradeAccount = typeof TRADE_ACCOUNTS[number];

/** Bucket label for transactions with no explicit account/source. */
export const DEFAULT_ACCOUNT_BUCKET = 'Unassigned';

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

  account?: string;            // brokerage account this trade belongs to
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
  account?: string;            // brokerage account assigned to this import
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
  /** User-managed list of accounts / data sources (runtime editable). */
  accounts: string[];
  transactions: RawTradeTxn[];
  imports: TradeImportBatch[];
  updatedAt: string;
}

export const TRADES_DATA_VERSION = 1;

export const emptyTradesData = (): TradesData => ({
  version: TRADES_DATA_VERSION,
  accounts: [],
  transactions: [],
  imports: [],
  updatedAt: new Date().toISOString(),
});
