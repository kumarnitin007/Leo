/**
 * Robinhood statement parser.
 *
 * Reads a Robinhood transaction export (.csv or .xlsx — both handled by
 * SheetJS) and normalizes rows into `RawTradeTxn`. Designed to tolerate the
 * quirks of Robinhood exports: parenthesised negatives, $ / thousands commas,
 * multi-line quoted descriptions, fractional quantities and "S" suffixes,
 * and option descriptions like "MSFT 7/31/2026 Put $370.00".
 *
 * More broker formats can be added later behind the same `ParsedTrades` shape.
 */

import * as XLSX from 'xlsx';
import { RawTradeTxn, TradeKind, TradeSource, OptionType } from '../../types/trades';

export interface ParsedTrades {
  source: TradeSource;
  rows: RawTradeTxn[];
  dateRange?: { start: string; end: string };
  warnings: string[];
}

const OPTION_OPEN_CLOSE = new Set(['STO', 'BTO', 'STC', 'BTC']);
const OPTION_EVENTS = new Set(['OEXP', 'OASGN', 'OEXCS']);
const EQUITY = new Set(['Buy', 'Sell']);

function classifyKind(transCode: string): TradeKind {
  const code = transCode.trim();
  if (OPTION_OPEN_CLOSE.has(code)) return 'option_premium';
  if (OPTION_EVENTS.has(code)) return 'option_event';
  if (EQUITY.has(code)) return 'equity';
  switch (code) {
    case 'CDIV': return 'dividend';
    case 'DTAX': return 'tax';
    case 'INT':
    case 'GOLD': return 'interest';
    case 'SLIP': return 'lending';
    case 'ACH':
    case 'RTP': return 'deposit';
    default: return 'other';
  }
}

function parseMoney(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'number') return isNaN(v) ? undefined : v;
  const s = String(v).trim();
  if (!s) return undefined;
  const negative = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[(),$\s]/g, '');
  if (!cleaned || cleaned === '-') return undefined;
  const n = parseFloat(cleaned);
  if (isNaN(n)) return undefined;
  return negative ? -n : n;
}

function parseQuantity(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'number') return isNaN(v) ? undefined : v;
  const cleaned = String(v).replace(/[^0-9.]/g, '');
  if (!cleaned) return undefined;
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Parse M/D/YYYY (or a Date / ISO string) into ISO YYYY-MM-DD. */
function parseDate(v: unknown): string {
  if (!v && v !== 0) return '';
  if (v instanceof Date) {
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  }
  const s = String(v).trim();
  if (!s) return '';
  // Already ISO
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${pad(parseInt(iso[2], 10))}-${pad(parseInt(iso[3], 10))}`;
  // M/D/YYYY
  const md = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (md) {
    let year = parseInt(md[3], 10);
    if (year < 100) year += 2000;
    return `${year}-${pad(parseInt(md[1], 10))}-${pad(parseInt(md[2], 10))}`;
  }
  return '';
}

const OPTION_RE = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(Call|Put)\s+\$([\d,]+(?:\.\d+)?)/i;

function parseOptionMeta(description: string): { optionType?: OptionType; strike?: number; expiration?: string } {
  const m = description.match(OPTION_RE);
  if (!m) return {};
  return {
    expiration: parseDate(m[1]) || undefined,
    optionType: m[2].toUpperCase() === 'CALL' ? 'CALL' : 'PUT',
    strike: parseMoney(m[3]),
  };
}

/** djb2 string hash → short base36 id. */
function hash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function findRobinhoodHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const joined = rows[i].map(c => String(c ?? '').toLowerCase().trim()).join('|');
    if (joined.includes('activity date') && joined.includes('trans code')) return i;
  }
  return -1;
}

function findFidelityHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const joined = rows[i].map(c => String(c ?? '').toLowerCase().trim()).join('|');
    if (joined.includes('run date') && joined.includes('action') && joined.includes('amount')) return i;
  }
  return -1;
}

// ---- Fidelity classification (Fidelity has no short codes — infer from Action text) ----
function fidOptionCode(side: 'bought' | 'sold', action: string): { transCode: string; kind: TradeKind } {
  const closing = action.includes('CLOS');
  if (side === 'sold') return { transCode: closing ? 'STC' : 'STO', kind: 'option_premium' };
  return { transCode: closing ? 'BTC' : 'BTO', kind: 'option_premium' };
}

function classifyFidelity(action: string): { transCode: string; kind: TradeKind } {
  const a = action.toUpperCase();
  const isOption = /\b(CALL|PUT)\b/.test(a);
  // Core cash sweep (money market fund) — this is the account's cash, not a
  // tradable holding. Its "dividend" is really interest on cash; the
  // reinvestment/buy/sell rows just move cash and must not create a ticker.
  if (a.includes('MONEY MARKET')) {
    if (a.includes('DIVIDEND')) return { transCode: 'INT', kind: 'interest' };
    return { transCode: 'CASH', kind: 'other' };
  }
  if (a.includes('DIVIDEND')) return { transCode: 'CDIV', kind: 'dividend' };
  // Mutual-fund capital-gain distributions are income (shown with dividends).
  if (a.includes('CAP GAIN') || a.includes('CAPITAL GAIN')) return { transCode: 'CDIV', kind: 'dividend' };
  // A dividend/interest reinvestment buys more shares (DRIP) → treat as a Buy.
  if (a.includes('REINVESTMENT')) return { transCode: 'Buy', kind: 'equity' };
  if (a.includes('YOU BOUGHT')) return isOption ? fidOptionCode('bought', a) : { transCode: 'Buy', kind: 'equity' };
  if (a.includes('YOU SOLD')) return isOption ? fidOptionCode('sold', a) : { transCode: 'Sell', kind: 'equity' };
  // Stock splits / spin-offs add shares (the Amount shown is the value of the
  // distributed shares, not cash — handled in parseFidelity).
  if (a.includes('DISTRIBUTION')) return { transCode: 'DIST', kind: 'other' };
  if (a.includes('EXPIRED')) return { transCode: 'OEXP', kind: 'option_event' };
  if (a.includes('ASSIGNED')) return { transCode: 'OASGN', kind: 'option_event' };
  if (a.includes('EXERCISE')) return { transCode: 'OEXCS', kind: 'option_event' };
  if (a.includes('INTEREST')) return { transCode: 'INT', kind: 'interest' };
  if (a.includes('FEE')) return { transCode: 'FEE', kind: 'other' };
  if (a.includes('TAX') || a.includes('WITHHOLD')) return { transCode: 'DTAX', kind: 'tax' };
  if (/(TRANSFER|CONTRIBUTION|CONVERSION|DEPOSIT|FUNDS RECEIVED|DIRECT DEBIT|JOURNAL)/.test(a)) return { transCode: 'ACH', kind: 'deposit' };
  return { transCode: 'OTHER', kind: 'other' };
}

/**
 * Fidelity leaves the Symbol column blank for some securities (529 plans,
 * delisted / reverse-split tickers). The identifier is embedded in the Action
 * text as a parenthetical, e.g. "... (NHX203002) (Cash)" or "... (33813J106)
 * (Cash)". Pick the last ticker/CUSIP-like token, ignoring "(Cash)"/"(Margin)".
 */
function fidSymbolFromAction(action: string): string {
  const parens = [...action.matchAll(/\(([^)]+)\)/g)].map(m => m[1].trim().toUpperCase());
  for (let i = parens.length - 1; i >= 0; i--) {
    const p = parens[i];
    if (p === 'CASH' || p === 'MARGIN') continue;
    if (/^[A-Z0-9.]{1,12}$/.test(p)) return p;
  }
  return '';
}

export async function parseTradesFile(
  file: File,
  opts: { tags: string[]; importBatchId: string; account?: string }
): Promise<ParsedTrades> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    return { source: 'unknown', rows: [], warnings: ['No worksheet found in file.'] };
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: '',
  });

  const rhIdx = findRobinhoodHeaderRow(matrix);
  if (rhIdx >= 0) return parseRobinhood(matrix, rhIdx, opts);

  const fidIdx = findFidelityHeaderRow(matrix);
  if (fidIdx >= 0) return parseFidelity(matrix, fidIdx, opts);

  return {
    source: 'unknown',
    rows: [],
    warnings: ['Could not recognize this file. Expected a Robinhood export ("Activity Date" / "Trans Code") or a Fidelity export ("Run Date" / "Action").'],
  };
}

/** Build the verbatim raw-row map for a parsed row. */
function buildRaw(header: string[], cell: (i: number) => unknown): Record<string, string> {
  const raw: Record<string, string> = {};
  header.forEach((h, i) => {
    if (!h) return;
    const val = cell(i);
    raw[h] = val instanceof Date ? parseDate(val) : String(val ?? '');
  });
  return raw;
}

function parseRobinhood(
  matrix: unknown[][],
  headerRowIdx: number,
  opts: { tags: string[]; importBatchId: string; account?: string }
): ParsedTrades {
  const warnings: string[] = [];
  const header = matrix[headerRowIdx].map(c => String(c ?? '').trim());
  const colIndex = (name: string) =>
    header.findIndex(h => h.toLowerCase().trim() === name.toLowerCase());

  const idx = {
    activityDate: colIndex('Activity Date'),
    processDate: colIndex('Process Date'),
    settleDate: colIndex('Settle Date'),
    instrument: colIndex('Instrument'),
    description: colIndex('Description'),
    transCode: colIndex('Trans Code'),
    quantity: colIndex('Quantity'),
    price: colIndex('Price'),
    amount: colIndex('Amount'),
  };

  const importedAt = new Date().toISOString();
  const occurrence = new Map<string, number>();
  const rows: RawTradeTxn[] = [];
  let minDate = '';
  let maxDate = '';

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.length === 0) continue;

    const cell = (i: number) => (i >= 0 && i < row.length ? row[i] : '');

    const activityRaw = cell(idx.activityDate);
    const transCodeRaw = String(cell(idx.transCode) ?? '').trim();
    const descriptionRaw = String(cell(idx.description) ?? '').trim();

    // Skip fully empty / footer rows
    if (!transCodeRaw && !descriptionRaw && !activityRaw) continue;

    const activityDate = parseDate(activityRaw);
    if (!activityDate && !transCodeRaw) continue;

    const instrument = String(cell(idx.instrument) ?? '').trim().toUpperCase();
    const quantityRaw = String(cell(idx.quantity) ?? '').trim();
    const amount = parseMoney(cell(idx.amount));
    const price = parseMoney(cell(idx.price));
    const kind = classifyKind(transCodeRaw);
    const optionMeta = kind === 'option_premium' || kind === 'option_event'
      ? parseOptionMeta(descriptionRaw)
      : {};

    const baseKey = [
      activityDate,
      instrument,
      transCodeRaw,
      descriptionRaw.replace(/\s+/g, ' '),
      quantityRaw,
      amount ?? '',
      price ?? '',
    ].join('|');
    const occ = occurrence.get(baseKey) ?? 0;
    occurrence.set(baseKey, occ + 1);
    const id = hash(`${baseKey}#${occ}`);

    rows.push({
      id,
      source: 'robinhood',
      account: opts.account,
      activityDate,
      processDate: parseDate(cell(idx.processDate)) || undefined,
      settleDate: parseDate(cell(idx.settleDate)) || undefined,
      instrument,
      description: descriptionRaw,
      transCode: transCodeRaw,
      kind,
      quantity: parseQuantity(quantityRaw),
      quantityRaw: quantityRaw || undefined,
      price,
      amount,
      optionType: optionMeta.optionType,
      strike: optionMeta.strike,
      expiration: optionMeta.expiration,
      tags: opts.tags,
      importBatchId: opts.importBatchId,
      importedAt,
      raw: buildRaw(header, cell),
    });

    if (activityDate) {
      if (!minDate || activityDate < minDate) minDate = activityDate;
      if (!maxDate || activityDate > maxDate) maxDate = activityDate;
    }
  }

  if (rows.length === 0) warnings.push('No transaction rows were found in the file.');

  return {
    source: 'robinhood',
    rows,
    warnings,
    dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : undefined,
  };
}

function parseFidelity(
  matrix: unknown[][],
  headerRowIdx: number,
  opts: { tags: string[]; importBatchId: string; account?: string }
): ParsedTrades {
  const warnings: string[] = [];
  const header = matrix[headerRowIdx].map(c => String(c ?? '').trim());
  // Fidelity ships two header variants: plain ("Price", "Amount") and a
  // currency-suffixed one ("Price ($)", "Amount ($)"). Normalize away the "($)"
  // and collapse whitespace so both map to the same columns.
  const norm = (s: string) => s.toLowerCase().replace(/\(\$\)/g, '').replace(/\s+/g, ' ').trim();
  const colIndex = (name: string) => header.findIndex(h => norm(h) === norm(name));

  const idx = {
    runDate: colIndex('Run Date'),
    action: colIndex('Action'),
    symbol: colIndex('Symbol'),
    description: colIndex('Description'),
    price: colIndex('Price'),
    quantity: colIndex('Quantity'),
    amount: colIndex('Amount'),
    settleDate: colIndex('Settlement Date'),
  };

  const importedAt = new Date().toISOString();
  const occurrence = new Map<string, number>();
  const rows: RawTradeTxn[] = [];
  let minDate = '';
  let maxDate = '';
  let sawOptions = false;

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.length === 0) continue;

    const cell = (i: number) => (i >= 0 && i < row.length ? row[i] : '');

    const activityDate = parseDate(cell(idx.runDate));
    const actionRaw = String(cell(idx.action) ?? '').trim();

    // A valid Fidelity data row always starts with a Run Date; footer/disclaimer
    // lines (and the blank spacer rows) fail this and are skipped.
    if (!activityDate || !actionRaw) continue;

    let symbol = String(cell(idx.symbol) ?? '').trim().toUpperCase();
    const descCol = String(cell(idx.description) ?? '').trim();
    const { transCode, kind } = classifyFidelity(actionRaw);
    if (kind === 'option_premium' || kind === 'option_event') sawOptions = true;

    // Recover the identifier for securities Fidelity leaves blank (529 plans,
    // delisted / reverse-split tickers).
    if (!symbol && (kind === 'equity' || transCode === 'DIST')) {
      symbol = fidSymbolFromAction(actionRaw);
    }
    // Money-market core position is the account's cash, not a holding.
    if (/MONEY MARKET/i.test(actionRaw)) symbol = '';

    // Prefer the clean company-name Description column (used by analytics to
    // label tickers); fall back to the Action text for cash/transfer rows.
    const description =
      descCol && descCol.toLowerCase() !== 'no description' ? descCol : actionRaw;

    const quantityRaw = String(cell(idx.quantity) ?? '').trim();
    // For splits/spin-offs the Amount is the market value of the distributed
    // shares (not cash received), so exclude it from cash/P&L math.
    const amount = transCode === 'DIST' ? undefined : parseMoney(cell(idx.amount));
    const price = parseMoney(cell(idx.price));

    const baseKey = [
      activityDate,
      symbol,
      transCode,
      actionRaw.replace(/\s+/g, ' '),
      quantityRaw,
      amount ?? '',
      price ?? '',
    ].join('|');
    const occ = occurrence.get(baseKey) ?? 0;
    occurrence.set(baseKey, occ + 1);
    const id = hash(`${baseKey}#${occ}`);

    rows.push({
      id,
      source: 'fidelity',
      account: opts.account,
      activityDate,
      settleDate: parseDate(cell(idx.settleDate)) || undefined,
      instrument: symbol,
      description,
      transCode,
      kind,
      quantity: parseQuantity(quantityRaw),
      quantityRaw: quantityRaw || undefined,
      price,
      amount,
      tags: opts.tags,
      importBatchId: opts.importBatchId,
      importedAt,
      raw: buildRaw(header, cell),
    });

    if (activityDate) {
      if (!minDate || activityDate < minDate) minDate = activityDate;
      if (!maxDate || activityDate > maxDate) maxDate = activityDate;
    }
  }

  if (rows.length === 0) warnings.push('No transaction rows were found in the file.');
  if (sawOptions) warnings.push('Fidelity option contracts were detected — premiums are counted, but strike/expiration details are not parsed yet.');

  return {
    source: 'fidelity',
    rows,
    warnings,
    dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : undefined,
  };
}
