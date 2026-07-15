/**
 * Ticker data (non-sensitive): watchlist + cached quotes in Supabase.
 *
 * - Quote cache lets the dashboard paint from the DB instead of calling the
 *   market API on every render, and provides a fallback price (with its date)
 *   when the live API is unreachable.
 * - Watchlist stores favorite tickers (symbol + name only — no secure info).
 */

import getSupabaseClient from '../../lib/supabase';
import { Quote } from './quotes';

const QUOTES_TABLE = 'myday_ticker_quotes';
const WATCH_TABLE = 'myday_trade_watchlist';

export interface WatchItem {
  ticker: string;
  name?: string;
  createdAt?: string;
}

export interface CachedQuote extends Quote {
  asOf?: string;   // when this price was fetched (ISO)
}

/* ── Watchlist ─────────────────────────────────────────────── */

export async function loadWatchlist(userId?: string): Promise<WatchItem[]> {
  const client = getSupabaseClient();
  if (!client || !userId) return [];
  const { data, error } = await client
    .from(WATCH_TABLE)
    .select('ticker, name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) { console.warn('[tickerData] loadWatchlist:', error.message); return []; }
  return (data || []).map(r => ({ ticker: r.ticker, name: r.name || undefined, createdAt: r.created_at }));
}

export async function addWatch(userId: string | undefined, ticker: string, name?: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !userId) return;
  const { error } = await client
    .from(WATCH_TABLE)
    .upsert({ user_id: userId, ticker: ticker.toUpperCase(), name: name || null }, { onConflict: 'user_id,ticker' });
  if (error) console.warn('[tickerData] addWatch:', error.message);
}

export async function removeWatch(userId: string | undefined, ticker: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !userId) return;
  const { error } = await client
    .from(WATCH_TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('ticker', ticker.toUpperCase());
  if (error) console.warn('[tickerData] removeWatch:', error.message);
}

/* ── Quote cache ───────────────────────────────────────────── */

export async function loadCachedQuotes(userId?: string): Promise<Record<string, CachedQuote>> {
  const client = getSupabaseClient();
  if (!client || !userId) return {};
  const { data, error } = await client
    .from(QUOTES_TABLE)
    .select('ticker, price, currency, previous_close, change, change_pct, as_of')
    .eq('user_id', userId);
  if (error) { console.warn('[tickerData] loadCachedQuotes:', error.message); return {}; }
  const out: Record<string, CachedQuote> = {};
  for (const r of data || []) {
    if (r.price == null) continue;
    out[r.ticker] = {
      symbol: r.ticker,
      price: Number(r.price),
      previousClose: r.previous_close != null ? Number(r.previous_close) : undefined,
      change: r.change != null ? Number(r.change) : undefined,
      changePct: r.change_pct != null ? Number(r.change_pct) : undefined,
      currency: r.currency || undefined,
      asOf: r.as_of || undefined,
    };
  }
  return out;
}

export async function saveCachedQuotes(
  userId: string | undefined,
  quotes: Record<string, Quote>,
  asOf: string
): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !userId) return;
  const rows = Object.values(quotes).map(q => ({
    user_id: userId,
    ticker: q.symbol.toUpperCase(),
    price: q.price,
    currency: q.currency ?? null,
    previous_close: q.previousClose ?? null,
    change: q.change ?? null,
    change_pct: q.changePct ?? null,
    as_of: asOf,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return;
  const { error } = await client.from(QUOTES_TABLE).upsert(rows, { onConflict: 'user_id,ticker' });
  if (error) console.warn('[tickerData] saveCachedQuotes:', error.message);
}
