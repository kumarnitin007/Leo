/**
 * Portfolio digest for AI insights.
 *
 * Builds a COMPACT, structured summary of the user's trading data — never the
 * raw transactions — so the AI gets rich signal at a small token cost. The
 * serializer turns it into a terse text block for the prompt.
 *
 * Token strategy: cap holdings / options / closed lists, round money to whole
 * units, and drop empty sections. A full portfolio typically serializes to
 * ~1–2k input tokens.
 */

import type { TradesSummary, TickerStats, OpenOption } from './tradesAnalytics';
import { optionLegKey, OptionMark } from './quotes';
import type { CachedQuote } from './tickerData';

export interface DigestHolding {
  t: string;
  name?: string;
  shares: number;
  avgCost: number | null;
  price: number | null;
  value: number | null;
  unrealizedPL: number | null;
  pctOfHoldings: number | null;
  manual: boolean;
}

export interface DigestOption {
  t: string;
  side: 'long' | 'short';
  type: 'CALL' | 'PUT';
  strike: number | null;
  expiration: string | null;
  dte: number | null;
  itm: boolean | null;
  mark: number | null;
  contracts: number;
  premium: number;
}

export interface PortfolioDigest {
  asOf: string;
  currency: string;
  range?: { start: string; end: string };
  totals: {
    totalTransactions: number;
    tickersTraded: number;
    optionsPremium: number;
    dividends: number;
    interest: number;
    lending: number;
    tax: number;
    totalIncome: number;
    deposits: number;
    holdingsCount: number;
    holdingsMarketValue: number;
    holdingsCostBasis: number;
    unrealizedPL: number | null;
    ifSoldNowPL: number | null;
    realizedClosedTotal: number;
    closedCount: number;
    pricedHoldings: number;
    unpricedHoldings: number;
  };
  concentration: { t: string; pct: number }[];
  holdings: DigestHolding[];
  openOptions: DigestOption[];
  closedWinners: { t: string; realized: number }[];
  closedLosers: { t: string; realized: number }[];
  monthly: { m: string; net: number }[];
  optionActivity: { opened: number; closed: number; expired: number; assigned: number; exercised: number };
}

const r0 = (n: number) => Math.round(n);
const r2 = (n: number) => Math.round(n * 100) / 100;

function daysUntil(expiration?: string): number | null {
  if (!expiration) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const exp = new Date(`${expiration}T00:00:00`);
  return Math.round((exp.getTime() - start.getTime()) / 86400000);
}

export interface BuildDigestParams {
  summaryFull: TradesSummary;
  heldTickers: TickerStats[];
  closedTickers: TickerStats[];
  openOptions: OpenOption[];
  quotes: Record<string, CachedQuote>;
  optionMarks: Record<string, OptionMark>;
  currency?: string;
  maxHoldings?: number;
  maxOptions?: number;
}

export function buildPortfolioDigest(p: BuildDigestParams): PortfolioDigest {
  const currency = p.currency || 'USD';
  const maxHoldings = p.maxHoldings ?? 15;
  const maxOptions = p.maxOptions ?? 20;

  // ── Holdings ──────────────────────────────────────────────────────────
  const holdingsRaw = p.heldTickers.map(t => {
    const q = p.quotes[t.ticker];
    const price = q?.price ?? null;
    const avgCost = t.sharesBought > 0 ? t.costBought / t.sharesBought : null;
    const value = price != null ? price * t.sharesHeld : null;
    const cost = avgCost != null ? avgCost * t.sharesHeld : null;
    const unrealizedPL = value != null && cost != null ? value - cost : null;
    return {
      t: t.ticker,
      name: t.name,
      shares: r2(t.sharesHeld),
      avgCost: avgCost != null ? r2(avgCost) : null,
      price: price != null ? r2(price) : null,
      value: value != null ? r0(value) : null,
      unrealizedPL: unrealizedPL != null ? r0(unrealizedPL) : null,
      manual: q?.source === 'manual',
      _rawValue: value ?? 0,
    };
  });

  const holdingsMarketValue = holdingsRaw.reduce((s, h) => s + (h.value ?? 0), 0);
  const holdingsCostBasis = holdingsRaw.reduce((s, h) => {
    const held = p.heldTickers.find(x => x.ticker === h.t);
    const avg = h.avgCost;
    return s + (avg != null && held ? avg * held.sharesHeld : 0);
  }, 0);
  const pricedHoldings = holdingsRaw.filter(h => h.price != null).length;
  const unpricedHoldings = holdingsRaw.length - pricedHoldings;

  const holdings: DigestHolding[] = holdingsRaw
    .sort((a, b) => b._rawValue - a._rawValue || b.shares - a.shares)
    .slice(0, maxHoldings)
    .map(h => ({
      t: h.t,
      name: h.name,
      shares: h.shares,
      avgCost: h.avgCost,
      price: h.price,
      value: h.value,
      unrealizedPL: h.unrealizedPL,
      pctOfHoldings: h.value != null && holdingsMarketValue > 0 ? r2((h.value / holdingsMarketValue) * 100) : null,
      manual: h.manual,
    }));

  const concentration = holdings
    .filter(h => h.pctOfHoldings != null)
    .slice(0, 5)
    .map(h => ({ t: h.t, pct: h.pctOfHoldings as number }));

  // ── Open options ──────────────────────────────────────────────────────
  const openOptions: DigestOption[] = p.openOptions
    .map(o => {
      const mark = p.optionMarks[optionLegKey(o.ticker, o.optionType, o.strike ?? 0, o.expiration ?? '')]?.mark ?? null;
      const px = p.quotes[o.ticker]?.price ?? null;
      const itm = px != null && o.strike != null ? (o.optionType === 'CALL' ? px >= o.strike : px <= o.strike) : null;
      return {
        t: o.ticker,
        side: o.side,
        type: o.optionType,
        strike: o.strike ?? null,
        expiration: o.expiration ?? null,
        dte: daysUntil(o.expiration),
        itm,
        mark: mark != null ? r2(mark) : null,
        contracts: Math.abs(o.netContracts),
        premium: r0(o.premium),
      };
    })
    .sort((a, b) => (a.dte ?? 9999) - (b.dte ?? 9999))
    .slice(0, maxOptions);

  // ── Closed positions (realized net cash) ──────────────────────────────
  const closed = p.closedTickers
    .map(t => ({ t: t.ticker, realized: r0(t.netCash) }))
    .filter(c => Math.abs(c.realized) > 0);
  const closedWinners = [...closed].filter(c => c.realized > 0).sort((a, b) => b.realized - a.realized).slice(0, 5);
  const closedLosers = [...closed].filter(c => c.realized < 0).sort((a, b) => a.realized - b.realized).slice(0, 5);
  const realizedClosedTotal = closed.reduce((s, c) => s + c.realized, 0);

  // ── Unrealized / if-sold-now ──────────────────────────────────────────
  const optionLiquidation = p.openOptions.reduce((s, o) => {
    const m = p.optionMarks[optionLegKey(o.ticker, o.optionType, o.strike ?? 0, o.expiration ?? '')]?.mark;
    return m != null ? s + o.netContracts * m * 100 : s;
  }, 0);
  const unrealizedPL = pricedHoldings > 0 ? holdingsMarketValue - holdingsCostBasis : null;
  const ifSoldNowPL = pricedHoldings > 0
    ? p.heldTickers.reduce((s, t) => {
        const q = p.quotes[t.ticker];
        return q ? s + t.netCash + q.price * t.sharesHeld : s;
      }, 0) + optionLiquidation
    : null;

  const inc = p.summaryFull.income;

  return {
    asOf: new Date().toISOString(),
    currency,
    range: p.summaryFull.dateRange,
    totals: {
      totalTransactions: p.summaryFull.totalTransactions,
      tickersTraded: p.summaryFull.tickersTraded,
      optionsPremium: r0(inc.optionsPremium),
      dividends: r0(inc.dividends),
      interest: r0(inc.interest),
      lending: r0(inc.lending),
      tax: r0(inc.tax),
      totalIncome: r0(inc.total),
      deposits: r0(p.summaryFull.deposits),
      holdingsCount: p.heldTickers.length,
      holdingsMarketValue: r0(holdingsMarketValue),
      holdingsCostBasis: r0(holdingsCostBasis),
      unrealizedPL: unrealizedPL != null ? r0(unrealizedPL) : null,
      ifSoldNowPL: ifSoldNowPL != null ? r0(ifSoldNowPL) : null,
      realizedClosedTotal,
      closedCount: closed.length,
      pricedHoldings,
      unpricedHoldings,
    },
    concentration,
    holdings,
    openOptions,
    closedWinners,
    closedLosers,
    monthly: p.summaryFull.monthly.slice(-6).map(m => ({ m: m.month, net: r0(m.net) })),
    optionActivity: p.summaryFull.optionActivity,
  };
}

/**
 * Serialize the digest into a terse text block for the AI prompt. Keeps labels
 * short and omits empty sections to minimise tokens.
 */
export function serializePortfolioContext(d: PortfolioDigest): string {
  const c = d.currency;
  const money = (n: number | null | undefined) => (n == null ? 'n/a' : `${c} ${n.toLocaleString('en-US')}`);
  const lines: string[] = [];

  lines.push(`PORTFOLIO SNAPSHOT (as of ${d.asOf.slice(0, 10)}, currency ${c})`);
  if (d.range) lines.push(`History: ${d.range.start} → ${d.range.end}, ${d.totals.totalTransactions} txns across ${d.totals.tickersTraded} tickers`);

  const t = d.totals;
  lines.push('');
  lines.push('INCOME (lifetime, from history window):');
  lines.push(`- Options premium: ${money(t.optionsPremium)}; Dividends: ${money(t.dividends)}; Interest: ${money(t.interest)}; Stock lending: ${money(t.lending)}; Tax: ${money(t.tax)}`);
  lines.push(`- Total income: ${money(t.totalIncome)}; Deposits: ${money(t.deposits)}`);

  lines.push('');
  lines.push('CURRENT POSITION:');
  lines.push(`- ${t.holdingsCount} holdings, market value ${money(t.holdingsMarketValue)} (cost basis ${money(t.holdingsCostBasis)})`);
  lines.push(`- Unrealized P/L: ${money(t.unrealizedPL)}; If sold now (incl. realized cash + options): ${money(t.ifSoldNowPL)}`);
  if (t.unpricedHoldings > 0) lines.push(`- NOTE: ${t.unpricedHoldings} of ${t.holdingsCount} holdings have no live price yet (values understated).`);
  lines.push(`- Closed positions: ${t.closedCount}, total realized net cash ${money(t.realizedClosedTotal)}`);

  if (d.holdings.length) {
    lines.push('');
    lines.push(`TOP HOLDINGS (by value, up to ${d.holdings.length}):`);
    for (const h of d.holdings) {
      const parts = [`${h.t}${h.name ? ` (${h.name})` : ''}: ${h.shares} sh`];
      if (h.avgCost != null) parts.push(`avg ${money(h.avgCost)}`);
      if (h.price != null) parts.push(`px ${money(h.price)}${h.manual ? '(manual)' : ''}`);
      if (h.value != null) parts.push(`val ${money(h.value)}`);
      if (h.pctOfHoldings != null) parts.push(`${h.pctOfHoldings}% of holdings`);
      if (h.unrealizedPL != null) parts.push(`uP/L ${money(h.unrealizedPL)}`);
      lines.push(`- ${parts.join(', ')}`);
    }
  }

  if (d.openOptions.length) {
    lines.push('');
    lines.push(`OPEN OPTIONS (nearest expiry first, up to ${d.openOptions.length}):`);
    for (const o of d.openOptions) {
      const bits = [`${o.t} ${o.side} ${o.type} $${o.strike ?? '?'} exp ${o.expiration ?? '?'}`];
      if (o.dte != null) bits.push(`${o.dte}DTE`);
      if (o.itm != null) bits.push(o.itm ? 'ITM(assignment risk)' : 'OTM');
      if (o.mark != null) bits.push(`mark ${o.mark}`);
      bits.push(`${o.contracts} contracts`);
      bits.push(`net premium ${money(o.premium)}`);
      lines.push(`- ${bits.join(', ')}`);
    }
  }

  if (d.closedWinners.length || d.closedLosers.length) {
    lines.push('');
    lines.push('CLOSED TRADE HIGHLIGHTS (realized net cash):');
    if (d.closedWinners.length) lines.push(`- Best: ${d.closedWinners.map(w => `${w.t} ${money(w.realized)}`).join(', ')}`);
    if (d.closedLosers.length) lines.push(`- Worst: ${d.closedLosers.map(w => `${w.t} ${money(w.realized)}`).join(', ')}`);
  }

  if (d.monthly.length) {
    lines.push('');
    lines.push(`NET INCOME LAST ${d.monthly.length} MONTHS: ${d.monthly.map(m => `${m.m} ${money(m.net)}`).join(', ')}`);
  }

  const oa = d.optionActivity;
  lines.push('');
  lines.push(`OPTION ACTIVITY (lifetime): opened ${oa.opened}, closed ${oa.closed}, expired ${oa.expired}, assigned ${oa.assigned}, exercised ${oa.exercised}`);

  return lines.join('\n');
}
