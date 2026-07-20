/**
 * Ticker news (non-sensitive): recent company headlines from /api/ticker-news
 * (Finnhub). Shown as context in the ticker detail panel — never as advice.
 *
 * Cached in sessionStorage (~2h) so re-opening a ticker in the same session
 * doesn't re-hit the API. News is volatile, so no DB cache is used.
 */

export interface NewsItem {
  headline: string;
  source?: string;
  url: string;
  datetime?: number;   // epoch seconds
  summary?: string;
}

export interface TickerNewsResult {
  news: NewsItem[];
  configured: boolean;  // false when FINNHUB_API_KEY isn't set on the server
}

const TTL_MS = 2 * 60 * 60 * 1000;
const keyFor = (symbol: string) => `myday_news_${symbol.toUpperCase()}`;

/**
 * Read a fresh cached result WITHOUT hitting the network. Returns null if there
 * is no (fresh) cache. Lets the UI show already-fetched news on panel open
 * without making an external API call on its own.
 */
export function peekCachedNews(symbol: string): TickerNewsResult | null {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return null;
  try {
    const raw = sessionStorage.getItem(keyFor(sym));
    if (!raw) return null;
    const c = JSON.parse(raw) as TickerNewsResult & { _at: number };
    if (Date.now() - c._at < TTL_MS) return { news: c.news, configured: c.configured };
  } catch { /* ignore */ }
  return null;
}

export async function fetchTickerNews(symbol: string, limit = 6): Promise<TickerNewsResult> {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return { news: [], configured: true };

  try {
    const raw = sessionStorage.getItem(keyFor(sym));
    if (raw) {
      const c = JSON.parse(raw) as TickerNewsResult & { _at: number };
      if (Date.now() - c._at < TTL_MS) return { news: c.news, configured: c.configured };
    }
  } catch { /* ignore */ }

  const res = await fetch(`/api/ticker-news?symbol=${encodeURIComponent(sym)}&limit=${limit}`);
  if (!res.ok) throw new Error(`News fetch failed (${res.status})`);
  const json = await res.json();
  const result: TickerNewsResult = {
    news: Array.isArray(json?.news) ? json.news : [],
    configured: json?.configured !== false,
  };
  try { sessionStorage.setItem(keyFor(sym), JSON.stringify({ ...result, _at: Date.now() })); } catch { /* quota */ }
  return result;
}

/** Compact relative time for a news timestamp (epoch seconds). */
export function newsRelativeTime(datetime?: number): string {
  if (!datetime) return '';
  const diffMs = Date.now() - datetime * 1000;
  const h = Math.floor(diffMs / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}
