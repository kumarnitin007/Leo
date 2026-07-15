/**
 * Stock + option quote proxy (keyless).
 *
 * Proxies Yahoo Finance's public endpoints so the browser can fetch prices
 * without CORS issues or an API key. Best-effort: unresolved symbols/legs are
 * simply omitted from the response.
 *
 * GET  /api/quote?symbols=NVDA,SMCI,HOOD        → stock prices
 * POST /api/quote { options: [{symbol, expiration, optionType, strike}] } → option marks
 */

const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart';
const YAHOO_OPTIONS = 'https://query1.finance.yahoo.com/v7/finance/options';
const MAX_SYMBOLS = 60;
const MAX_OPTION_GROUPS = 40;
const UA = 'Mozilla/5.0 (compatible; MyDayTrades/1.0)';

async function fetchQuote(symbol: string): Promise<any | null> {
  try {
    const url = `${YAHOO}/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const json: any = await resp.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return null;
    const price = meta.regularMarketPrice;
    const prev = typeof meta.chartPreviousClose === 'number' ? meta.chartPreviousClose
      : (typeof meta.previousClose === 'number' ? meta.previousClose : undefined);
    const change = prev != null ? price - prev : undefined;
    const changePct = prev ? (change! / prev) * 100 : undefined;
    return { symbol, price, previousClose: prev, change, changePct, currency: meta.currency || 'USD' };
  } catch {
    return null;
  }
}

interface OptionLegReq { symbol: string; expiration: string; optionType: string; strike: number }

function legKey(symbol: string, optionType: string, strike: number, expiration: string): string {
  return `${symbol.toUpperCase()}|${optionType.toUpperCase()}|${strike}|${expiration}`;
}

/** Fetch marks for a set of option legs by grouping requests per (symbol, expiration). */
async function fetchOptionMarks(legs: OptionLegReq[]): Promise<Record<string, any>> {
  const groups = new Map<string, OptionLegReq[]>();
  for (const l of legs) {
    if (!l?.symbol || !l?.expiration || !l?.optionType || l?.strike == null) continue;
    const gk = `${l.symbol.toUpperCase()}|${l.expiration}`;
    if (!groups.has(gk)) groups.set(gk, []);
    groups.get(gk)!.push(l);
  }
  const entries = Array.from(groups.entries()).slice(0, MAX_OPTION_GROUPS);
  const out: Record<string, any> = {};

  await Promise.all(entries.map(async ([gk, groupLegs]) => {
    const [symbol, expiration] = gk.split('|');
    try {
      const epoch = Math.floor(Date.parse(`${expiration}T00:00:00Z`) / 1000);
      const url = `${YAHOO_OPTIONS}/${encodeURIComponent(symbol)}?date=${epoch}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const resp = await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) return;
      const json: any = await resp.json();
      const chain = json?.optionChain?.result?.[0]?.options?.[0];
      if (!chain) return;
      for (const leg of groupLegs) {
        const list = leg.optionType.toUpperCase() === 'PUT' ? chain.puts : chain.calls;
        if (!Array.isArray(list)) continue;
        const match = list.find((o: any) => Math.abs((o?.strike ?? NaN) - leg.strike) < 0.01);
        if (!match) continue;
        const last = typeof match.lastPrice === 'number' ? match.lastPrice : undefined;
        const bid = typeof match.bid === 'number' ? match.bid : undefined;
        const ask = typeof match.ask === 'number' ? match.ask : undefined;
        const mid = bid != null && ask != null && (bid > 0 || ask > 0) ? (bid + ask) / 2 : undefined;
        const mark = mid ?? last;
        if (mark == null) continue;
        out[legKey(symbol, leg.optionType, leg.strike, expiration)] = { mark, last, bid, ask };
      }
    } catch {
      /* skip group */
    }
  }));

  return out;
}

export default async function handler(req: any, res: any) {
  // Option marks (POST with { options: [...] }).
  const optionLegs = req.body?.options;
  if (Array.isArray(optionLegs) && optionLegs.length > 0) {
    try {
      const optionQuotes = await fetchOptionMarks(optionLegs as OptionLegReq[]);
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=240');
      return res.status(200).json({ optionQuotes, asOf: new Date().toISOString() });
    } catch (err: any) {
      console.error('[quote:options] error:', err?.message || err);
      return res.status(502).json({ error: 'Failed to fetch option quotes' });
    }
  }

  const raw = (req.query?.symbols || req.body?.symbols || '') as string;
  const symbols = String(raw)
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) {
    return res.status(400).json({ error: 'symbols query param is required' });
  }

  try {
    const results = await Promise.all(symbols.map(fetchQuote));
    const quotes: Record<string, any> = {};
    for (const r of results) if (r) quotes[r.symbol] = r;
    // Short cache — prices are near-real-time but we don't hammer upstream.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ quotes, asOf: new Date().toISOString() });
  } catch (err: any) {
    console.error('[quote] error:', err?.message || err);
    return res.status(502).json({ error: 'Failed to fetch quotes' });
  }
}
