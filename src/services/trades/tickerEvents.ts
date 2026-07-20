/**
 * Ticker events (non-sensitive): upcoming corporate-event dates cached in
 * Supabase and fetched from the /api/quote proxy (Yahoo calendarEvents).
 *
 * These are FACTUAL scheduled dates (next earnings, ex-dividend, dividend pay) —
 * shown as context on the Trades dashboard + detail panel, never as forecasts.
 */

import getSupabaseClient from '../../lib/supabase';

const EVENTS_TABLE = 'myday_ticker_events';

export interface TickerEvents {
  ticker: string;
  nextEarnings?: string;        // YYYY-MM-DD
  earningsEstimated?: boolean;  // Yahoo flags estimated (unconfirmed) dates
  exDividend?: string;          // YYYY-MM-DD
  dividendDate?: string;        // YYYY-MM-DD (pay date)
  asOf?: string;                // when fetched (ISO)
}

/** Fetch upcoming event dates from the market data proxy. */
export async function fetchTickerEvents(symbols: string[]): Promise<{ events: Record<string, TickerEvents>; asOf?: string }> {
  const uniq = Array.from(new Set(symbols.map(s => s.trim().toUpperCase()).filter(Boolean)));
  if (uniq.length === 0) return { events: {} };
  console.log(`[Events] → GET /api/quote?events for ${uniq.length} symbol(s)`);
  const res = await fetch(`/api/quote?events=${encodeURIComponent(uniq.join(','))}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[Events] ✗ fetch failed (${res.status})`, body.slice(0, 200));
    throw new Error(`Event fetch failed (${res.status})`);
  }
  const json = await res.json();
  const raw = (json?.events || {}) as Record<string, Omit<TickerEvents, 'ticker'>>;
  const events: Record<string, TickerEvents> = {};
  for (const [ticker, e] of Object.entries(raw)) events[ticker] = { ticker, ...e, asOf: json?.asOf };
  console.log(`[Events] ✓ ${Object.keys(events).length}/${uniq.length} with dates`);
  return { events, asOf: json?.asOf };
}

export async function loadCachedTickerEvents(userId?: string): Promise<Record<string, TickerEvents>> {
  const client = getSupabaseClient();
  if (!client || !userId) return {};
  const { data, error } = await client
    .from(EVENTS_TABLE)
    .select('*')
    .eq('user_id', userId);
  if (error) { console.warn('[tickerEvents] load:', error.message); return {}; }
  const out: Record<string, TickerEvents> = {};
  for (const r of data || []) {
    out[r.ticker] = {
      ticker: r.ticker,
      nextEarnings: r.next_earnings_date || undefined,
      earningsEstimated: r.earnings_estimated ?? undefined,
      exDividend: r.ex_dividend_date || undefined,
      dividendDate: r.dividend_date || undefined,
      asOf: r.as_of || undefined,
    };
  }
  return out;
}

export async function saveCachedTickerEvents(
  userId: string | undefined,
  events: Record<string, TickerEvents>,
  asOf: string
): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !userId) return;
  const rows = Object.values(events).map(e => ({
    user_id: userId,
    ticker: e.ticker.toUpperCase(),
    next_earnings_date: e.nextEarnings ?? null,
    earnings_estimated: e.earningsEstimated ?? null,
    ex_dividend_date: e.exDividend ?? null,
    dividend_date: e.dividendDate ?? null,
    as_of: asOf,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return;
  const { error } = await client.from(EVENTS_TABLE).upsert(rows, { onConflict: 'user_id,ticker' });
  if (error) console.warn('[tickerEvents] save:', error.message);
}
