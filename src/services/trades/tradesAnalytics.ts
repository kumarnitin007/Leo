/**
 * Trades analytics — derive dashboard metrics from raw transactions.
 * Pure functions, no side effects, so they are easy to evolve/test as the
 * data model grows.
 */

import { RawTradeTxn, OptionType } from '../../types/trades';

export interface OpenOption {
  ticker: string;
  optionType: OptionType;   // CALL / PUT
  strike?: number;
  expiration?: string;      // ISO
  netContracts: number;     // + long, - short
  side: 'long' | 'short';
  premium: number;          // net premium collected(+)/paid(-) on this leg
}

/**
 * Current OPEN option positions.
 *
 * Computed only from open/close legs (STO/BTO/STC/BTC) and filtered to
 * expirations that are still in the future. This deliberately ignores
 * OEXP/OASGN/OEXCS because a still-open option hasn't had those events yet,
 * and their "S" suffix conventions are inconsistent for assignment/exercise.
 */
export function computeOpenOptions(txns: RawTradeTxn[], asOf?: string): OpenOption[] {
  const today = asOf || new Date().toISOString().slice(0, 10);
  const map = new Map<string, OpenOption>();
  for (const t of txns) {
    if (t.kind !== 'option_premium') continue;               // STO/BTO/STC/BTC only
    if (!t.optionType || t.strike == null || !t.expiration) continue;
    const key = `${t.instrument}|${t.optionType}|${t.strike}|${t.expiration}`;
    let o = map.get(key);
    if (!o) {
      o = { ticker: t.instrument, optionType: t.optionType, strike: t.strike, expiration: t.expiration, netContracts: 0, side: 'long', premium: 0 };
      map.set(key, o);
    }
    const q = t.quantity ?? 0;
    const isBuy = t.transCode === 'BTO' || t.transCode === 'BTC';
    o.netContracts += isBuy ? q : -q;
    o.premium += t.amount ?? 0;
  }
  return Array.from(map.values())
    .filter(o => Math.abs(o.netContracts) > 0.0001)
    .filter(o => !o.expiration || o.expiration >= today)
    .map(o => ({ ...o, side: o.netContracts > 0 ? 'long' as const : 'short' as const }))
    .sort((a, b) => (a.expiration || '').localeCompare(b.expiration || '') || (a.strike ?? 0) - (b.strike ?? 0));
}

export interface TickerStats {
  ticker: string;
  name?: string;            // company name (from equity trade descriptions)
  optionsPremium: number;   // net STO/BTO/STC/BTC cash flow
  dividends: number;        // CDIV + DTAX (tax is negative)
  equityNet: number;        // Buy/Sell cash flow (cost basis in/out)
  lending: number;          // SLIP
  income: number;           // optionsPremium + dividends + lending (excludes cost basis)
  netCash: number;          // sum of all amounts for this ticker
  optionTrades: number;     // count of option premium legs
  contracts: number;        // total option contracts traded
  sharesHeld: number;       // net shares from Buy/Sell (approx current holding)
  sharesBought: number;     // total shares bought (Buy rows) — for avg cost basis
  costBought: number;       // total $ spent buying (Buy rows, positive)
  txnCount: number;
  firstDate?: string;       // earliest activity date
  lastDate?: string;        // latest activity date
}

export interface IncomeBreakdown {
  optionsPremium: number;
  dividends: number;
  interest: number;
  lending: number;
  tax: number;              // negative
  total: number;            // premium + dividends + interest + lending + tax
}

export interface MonthlyPoint {
  month: string;            // YYYY-MM
  label: string;            // e.g. "Jul '26"
  premium: number;
  dividends: number;
  interest: number;
  net: number;              // premium + dividends + interest + lending + tax
}

export interface TradesSummary {
  totalTransactions: number;
  tickersTraded: number;
  income: IncomeBreakdown;
  deposits: number;
  dateRange?: { start: string; end: string };
  byTicker: TickerStats[];
  monthly: MonthlyPoint[];
  optionActivity: { opened: number; closed: number; expired: number; assigned: number; exercised: number };
}

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

// Codes with an explicit direction.
const SHARE_ADD_CODES = new Set(['Buy', 'REC']);      // bought / received-in
const SHARE_REMOVE_CODES = new Set(['Sell']);         // sold
// Corporate actions that move shares in OR out (symbol change, split, merger,
// spinoff, conversion). Direction is taken from the quantity's "S" suffix,
// which Robinhood uses for the outgoing/short side.
const SHARE_CORP_ACTION_CODES = new Set(['SXCH', 'SPL', 'SPR', 'CONV', 'MRGR', 'MRGS', 'SOFF', 'SPD']);

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[(m - 1) % 12]} '${String(y).slice(2)}`;
}

export function computeSummary(txns: RawTradeTxn[]): TradesSummary {
  const amt = (t: RawTradeTxn) => t.amount ?? 0;

  const income: IncomeBreakdown = {
    optionsPremium: sum(txns.filter(t => t.kind === 'option_premium').map(amt)),
    dividends: sum(txns.filter(t => t.kind === 'dividend').map(amt)),
    interest: sum(txns.filter(t => t.kind === 'interest').map(amt)),
    lending: sum(txns.filter(t => t.kind === 'lending').map(amt)),
    tax: sum(txns.filter(t => t.kind === 'tax').map(amt)),
    total: 0,
  };
  income.total = income.optionsPremium + income.dividends + income.interest + income.lending + income.tax;

  const deposits = sum(txns.filter(t => t.kind === 'deposit').map(amt));

  // Per-ticker
  const tickerMap = new Map<string, TickerStats>();
  for (const t of txns) {
    if (!t.instrument) continue;
    let s = tickerMap.get(t.instrument);
    if (!s) {
      s = {
        ticker: t.instrument, optionsPremium: 0, dividends: 0, equityNet: 0, lending: 0,
        income: 0, netCash: 0, optionTrades: 0, contracts: 0, sharesHeld: 0,
        sharesBought: 0, costBought: 0, txnCount: 0,
      };
      tickerMap.set(t.instrument, s);
    }
    s.txnCount++;
    s.netCash += amt(t);
    if (t.activityDate) {
      if (!s.firstDate || t.activityDate < s.firstDate) s.firstDate = t.activityDate;
      if (!s.lastDate || t.activityDate > s.lastDate) s.lastDate = t.activityDate;
    }
    if (t.kind === 'option_premium') {
      s.optionsPremium += amt(t);
      s.optionTrades++;
      s.contracts += t.quantity ?? 0;
    } else if (t.kind === 'dividend' || t.kind === 'tax') {
      s.dividends += amt(t);
    } else if (t.kind === 'equity') {
      s.equityNet += amt(t);
      // The company name lives on the first line of equity descriptions
      // (e.g. "Microsoft\nCUSIP: 594918104").
      if (!s.name) {
        const firstLine = (t.description || '').split('\n')[0].trim();
        if (firstLine && !/CUSIP/i.test(firstLine)) s.name = firstLine;
      }
    } else if (t.kind === 'lending') {
      s.lending += amt(t);
    }

    // Share holdings. Buy/Sell/REC are explicit; corporate actions (symbol
    // change, split, merger, spinoff) use the "S" suffix to mark the outgoing
    // side (shares leaving this symbol).
    const q = t.quantity ?? 0;
    const outgoing = /s$/i.test(t.quantityRaw || '');
    if (SHARE_ADD_CODES.has(t.transCode)) s.sharesHeld += q;
    else if (SHARE_REMOVE_CODES.has(t.transCode)) s.sharesHeld -= q;
    else if (SHARE_CORP_ACTION_CODES.has(t.transCode)) s.sharesHeld += outgoing ? -q : q;

    // Average cost basis inputs (actual purchases only).
    if (t.transCode === 'Buy') {
      s.sharesBought += q;
      s.costBought += Math.abs(amt(t));
    }
  }
  for (const s of tickerMap.values()) {
    s.income = s.optionsPremium + s.dividends + s.lending;
  }
  const byTicker = Array.from(tickerMap.values()).sort((a, b) => b.income - a.income);

  // Monthly
  const monthMap = new Map<string, MonthlyPoint>();
  for (const t of txns) {
    if (!t.activityDate) continue;
    const month = t.activityDate.slice(0, 7);
    let p = monthMap.get(month);
    if (!p) {
      p = { month, label: monthLabel(month), premium: 0, dividends: 0, interest: 0, net: 0 };
      monthMap.set(month, p);
    }
    if (t.kind === 'option_premium') p.premium += amt(t);
    else if (t.kind === 'dividend') p.dividends += amt(t);
    else if (t.kind === 'interest') p.interest += amt(t);
    if (['option_premium', 'dividend', 'interest', 'lending', 'tax'].includes(t.kind)) p.net += amt(t);
  }
  const monthly = Array.from(monthMap.values()).sort((a, b) => (a.month < b.month ? -1 : 1));

  // Option activity counts
  const optionActivity = {
    opened: txns.filter(t => t.transCode === 'STO' || t.transCode === 'BTO').length,
    closed: txns.filter(t => t.transCode === 'STC' || t.transCode === 'BTC').length,
    expired: txns.filter(t => t.transCode === 'OEXP').length,
    assigned: txns.filter(t => t.transCode === 'OASGN').length,
    exercised: txns.filter(t => t.transCode === 'OEXCS').length,
  };

  const dates = txns.map(t => t.activityDate).filter(Boolean).sort();
  const dateRange = dates.length ? { start: dates[0], end: dates[dates.length - 1] } : undefined;

  return {
    totalTransactions: txns.length,
    tickersTraded: tickerMap.size,
    income,
    deposits,
    dateRange,
    byTicker,
    monthly,
    optionActivity,
  };
}

export function formatCurrency(n: number, opts: { compact?: boolean } = {}): string {
  const abs = Math.abs(n);
  if (opts.compact && abs >= 1000) {
    return `${n < 0 ? '-' : ''}$${(abs / 1000).toFixed(1)}k`;
  }
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}
