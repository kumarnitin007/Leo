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
const YAHOO_SUMMARY = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary';
const MAX_SYMBOLS = 60;
const MAX_OPTION_SYMBOLS = 40;
const MAX_EVENT_SYMBOLS = 60;
// A real browser UA — Yahoo rejects unknown agents on the v7/crumb endpoints.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Yahoo's v7 options endpoint requires a session cookie + "crumb" (the v8 chart
 * endpoint used for stock prices does not — which is why stock quotes work but
 * option marks come back empty). We fetch a cookie, exchange it for a crumb,
 * and cache the pair for ~30 min.
 */
let yahooAuth: { cookie: string; crumb: string; at: number } | null = null;

function extractSetCookies(headers: any): string[] {
  if (typeof headers?.getSetCookie === 'function') return headers.getSetCookie();
  const raw = headers?.get?.('set-cookie');
  return raw ? [raw] : [];
}

async function getYahooAuth(): Promise<{ cookie: string; crumb: string } | null> {
  if (yahooAuth && Date.now() - yahooAuth.at < 30 * 60 * 1000) {
    return { cookie: yahooAuth.cookie, crumb: yahooAuth.crumb };
  }
  // Try a couple of hosts known to hand out the consent/session cookie.
  const cookieHosts = ['https://fc.yahoo.com/', 'https://finance.yahoo.com/'];
  let cookie = '';
  for (const host of cookieHosts) {
    try {
      const resp = await fetch(host, { headers: { 'User-Agent': UA } });
      const parts = extractSetCookies(resp.headers).map(c => c.split(';')[0]).filter(Boolean);
      if (parts.length) { cookie = parts.join('; '); break; }
    } catch { /* try next host */ }
  }
  if (!cookie) { console.warn('[quote:auth] could not obtain a Yahoo cookie'); return null; }
  try {
    const resp = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, Cookie: cookie, Accept: 'text/plain' },
    });
    const crumb = (await resp.text()).trim();
    if (!crumb || crumb.includes('<') || crumb.length > 64) {
      console.warn('[quote:auth] unexpected crumb response:', crumb.slice(0, 80));
      return null;
    }
    yahooAuth = { cookie, crumb, at: Date.now() };
    console.log('[quote:auth] obtained Yahoo crumb OK');
    return { cookie, crumb };
  } catch (e: any) {
    console.warn('[quote:auth] crumb fetch failed:', e?.message || e);
    return null;
  }
}

/** UTC calendar date (YYYY-MM-DD) of a Yahoo epoch (seconds). */
function epochToDate(epoch: number): string {
  return new Date(epoch * 1000).toISOString().slice(0, 10);
}

/**
 * Yahoo only returns an option chain when `date` matches one of its listed
 * expiration epochs exactly. Our stored expiration is a calendar date, and the
 * naive midnight-UTC epoch often differs from Yahoo's, so the chain silently
 * falls back to the front month and strike lookups miss. Match against Yahoo's
 * own expirationDates instead (exact calendar day, else nearest within 2 days).
 */
function matchExpirationEpoch(expiration: string, epochs: number[]): number | null {
  const target = Date.parse(`${expiration}T00:00:00Z`) / 1000;
  let best: number | null = null;
  let bestDiff = Infinity;
  for (const e of epochs) {
    if (epochToDate(e) === expiration) return e;
    const diff = Math.abs(e - target);
    if (diff < bestDiff) { bestDiff = diff; best = e; }
  }
  return best != null && bestDiff <= 2 * 86400 ? best : null;
}

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

async function fetchOptionsUrl(url: string, timeoutMs: number, cookie?: string): Promise<any | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers: Record<string, string> = { 'User-Agent': UA, Accept: 'application/json' };
    if (cookie) headers.Cookie = cookie;
    const resp = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) {
      console.warn(`[quote:options] Yahoo ${resp.status} for ${url}`);
      return null;
    }
    return await resp.json();
  } catch (e: any) {
    console.warn(`[quote:options] fetch error for ${url}:`, e?.message || e);
    return null;
  }
}

/** Pull the mark (mid, else last) for a strike out of a chain's puts/calls list. */
function markFromChain(chain: any, optionType: string, strike: number): any | null {
  const list = optionType.toUpperCase() === 'PUT' ? chain?.puts : chain?.calls;
  if (!Array.isArray(list)) return null;
  const match = list.find((o: any) => Math.abs((o?.strike ?? NaN) - strike) < 0.01);
  if (!match) return null;
  const last = typeof match.lastPrice === 'number' ? match.lastPrice : undefined;
  const bid = typeof match.bid === 'number' ? match.bid : undefined;
  const ask = typeof match.ask === 'number' ? match.ask : undefined;
  const mid = bid != null && ask != null && (bid > 0 || ask > 0) ? (bid + ask) / 2 : undefined;
  const mark = mid ?? last;
  if (mark == null) return null;
  return { mark, last, bid, ask };
}

/**
 * Fetch marks for a set of option legs. Grouped per symbol: one discovery call
 * resolves Yahoo's real expiration epochs, then each needed expiration chain is
 * fetched by its exact epoch so strike lookups actually match.
 */
async function fetchOptionMarks(legs: OptionLegReq[]): Promise<Record<string, any>> {
  const bySymbol = new Map<string, OptionLegReq[]>();
  for (const l of legs) {
    if (!l?.symbol || !l?.expiration || !l?.optionType || l?.strike == null) continue;
    const sym = l.symbol.toUpperCase();
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym)!.push(l);
  }
  const entries = Array.from(bySymbol.entries()).slice(0, MAX_OPTION_SYMBOLS);
  const out: Record<string, any> = {};

  const auth = await getYahooAuth();
  const crumbQ = auth?.crumb ? `crumb=${encodeURIComponent(auth.crumb)}` : '';
  const cookie = auth?.cookie;
  const withCrumb = (url: string) => crumbQ ? `${url}${url.includes('?') ? '&' : '?'}${crumbQ}` : url;

  await Promise.all(entries.map(async ([symbol, symbolLegs]) => {
    // 1) Discovery: list this symbol's real expiration epochs (+ front chain).
    const base = await fetchOptionsUrl(withCrumb(`${YAHOO_OPTIONS}/${encodeURIComponent(symbol)}`), 9000, cookie);
    const result = base?.optionChain?.result?.[0];
    if (!result) { console.warn(`[quote:options] no chain discovery for ${symbol}`); return; }
    const expirationDates: number[] = Array.isArray(result.expirationDates) ? result.expirationDates : [];
    const frontChain = result.options?.[0];
    const frontDate = frontChain?.expirationDate != null ? epochToDate(frontChain.expirationDate) : null;

    // 2) For each requested expiration, resolve the matching chain.
    const wantedExps = Array.from(new Set(symbolLegs.map(l => l.expiration)));
    const chainByExp = new Map<string, any>();
    await Promise.all(wantedExps.map(async (exp) => {
      if (frontDate === exp && frontChain) { chainByExp.set(exp, frontChain); return; }
      const epoch = matchExpirationEpoch(exp, expirationDates);
      if (epoch == null) { console.warn(`[quote:options] ${symbol}: no Yahoo expiration near ${exp}`); return; }
      const json = await fetchOptionsUrl(withCrumb(`${YAHOO_OPTIONS}/${encodeURIComponent(symbol)}?date=${epoch}`), 9000, cookie);
      const chain = json?.optionChain?.result?.[0]?.options?.[0];
      if (!chain) return;
      // Guard against Yahoo silently returning a different expiration.
      if (chain.expirationDate != null && epochToDate(chain.expirationDate) !== exp) return;
      chainByExp.set(exp, chain);
    }));

    // 3) Resolve each leg against its expiration's chain.
    for (const leg of symbolLegs) {
      const chain = chainByExp.get(leg.expiration);
      if (!chain) continue;
      const mark = markFromChain(chain, leg.optionType, leg.strike);
      if (mark) out[legKey(symbol, leg.optionType, leg.strike, leg.expiration)] = mark;
    }
  }));

  return out;
}

/**
 * Fetch upcoming corporate-event dates (next earnings, ex-dividend, dividend
 * pay) per symbol from Yahoo's `calendarEvents` quoteSummary module. Needs the
 * same cookie + crumb auth as the options endpoint. These are FACTUAL scheduled
 * dates — not forecasts.
 */
async function fetchTickerEvents(symbols: string[]): Promise<Record<string, any>> {
  const auth = await getYahooAuth();
  const crumbQ = auth?.crumb ? `crumb=${encodeURIComponent(auth.crumb)}` : '';
  const cookie = auth?.cookie;
  const withCrumb = (url: string) => crumbQ ? `${url}${url.includes('?') ? '&' : '?'}${crumbQ}` : url;

  const uniq = Array.from(new Set(symbols.map(s => s.toUpperCase()))).slice(0, MAX_EVENT_SYMBOLS);
  const out: Record<string, any> = {};

  await Promise.all(uniq.map(async (symbol) => {
    const url = withCrumb(`${YAHOO_SUMMARY}/${encodeURIComponent(symbol)}?modules=calendarEvents`);
    const json = await fetchOptionsUrl(url, 8000, cookie);
    const ce = json?.quoteSummary?.result?.[0]?.calendarEvents;
    if (!ce) return;
    const earningsRaw: number[] = Array.isArray(ce.earnings?.earningsDate)
      ? ce.earnings.earningsDate.map((d: any) => d?.raw).filter((n: any) => typeof n === 'number')
      : [];
    const nextEarnings = earningsRaw.length ? epochToDate(Math.min(...earningsRaw)) : undefined;
    const exDividend = typeof ce.exDividendDate?.raw === 'number' ? epochToDate(ce.exDividendDate.raw) : undefined;
    const dividendDate = typeof ce.dividendDate?.raw === 'number' ? epochToDate(ce.dividendDate.raw) : undefined;
    if (nextEarnings || exDividend || dividendDate) {
      out[symbol] = {
        nextEarnings,
        earningsEstimated: !!ce.earnings?.isEarningsDateEstimate,
        exDividend,
        dividendDate,
      };
    }
  }));

  return out;
}

export default async function handler(req: any, res: any) {
  // Upcoming corporate-event dates (GET ?events=SYM1,SYM2).
  const rawEvents = (req.query?.events || '') as string;
  if (rawEvents) {
    const evSymbols = String(rawEvents)
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, MAX_EVENT_SYMBOLS);
    if (evSymbols.length === 0) return res.status(400).json({ error: 'events query param is empty' });
    try {
      console.log(`[quote:events] request for ${evSymbols.length} symbol(s)`);
      const events = await fetchTickerEvents(evSymbols);
      console.log(`[quote:events] resolved ${Object.keys(events).length}/${evSymbols.length}`);
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json({ events, asOf: new Date().toISOString() });
    } catch (err: any) {
      console.error('[quote:events] error:', err?.message || err);
      return res.status(502).json({ error: 'Failed to fetch ticker events' });
    }
  }

  // Option marks (POST with { options: [...] }).
  const optionLegs = req.body?.options;
  if (Array.isArray(optionLegs) && optionLegs.length > 0) {
    try {
      console.log(`[quote:options] request for ${optionLegs.length} leg(s)`);
      const optionQuotes = await fetchOptionMarks(optionLegs as OptionLegReq[]);
      console.log(`[quote:options] resolved ${Object.keys(optionQuotes).length}/${optionLegs.length} mark(s)`);
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
