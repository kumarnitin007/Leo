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

const ROBINHOOD_HEADERS = ['activity date', 'trans code', 'instrument', 'amount'];

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

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const joined = rows[i].map(c => String(c ?? '').toLowerCase().trim()).join('|');
    if (joined.includes('activity date') && joined.includes('trans code')) return i;
  }
  return -1;
}

function detectSource(headerCells: string[]): TradeSource {
  const joined = headerCells.map(c => c.toLowerCase().trim()).join('|');
  const hits = ROBINHOOD_HEADERS.filter(h => joined.includes(h)).length;
  return hits >= 3 ? 'robinhood' : 'unknown';
}

export async function parseTradesFile(
  file: File,
  opts: { tags: string[]; importBatchId: string; account?: string }
): Promise<ParsedTrades> {
  const warnings: string[] = [];
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

  const headerRowIdx = findHeaderRow(matrix);
  if (headerRowIdx < 0) {
    return {
      source: 'unknown',
      rows: [],
      warnings: ['Could not find a Robinhood header row (expected "Activity Date" and "Trans Code").'],
    };
  }

  const header = matrix[headerRowIdx].map(c => String(c ?? '').trim());
  const source = detectSource(header);
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

    const raw: Record<string, string> = {};
    header.forEach((h, i) => {
      if (!h) return;
      const val = cell(i);
      raw[h] = val instanceof Date ? parseDate(val) : String(val ?? '');
    });

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
      source,
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
      raw,
    });

    if (activityDate) {
      if (!minDate || activityDate < minDate) minDate = activityDate;
      if (!maxDate || activityDate > maxDate) maxDate = activityDate;
    }
  }

  if (rows.length === 0) warnings.push('No transaction rows were found in the file.');

  return {
    source,
    rows,
    warnings,
    dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : undefined,
  };
}
