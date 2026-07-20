import { applyRateLimit } from './_utils/rateLimit.js';
import { handleApiError } from './_utils/errorHandler.js';

/**
 * GET /api/ticker-news?symbol=AAPL&limit=6
 *
 * Recent company news headlines for a ticker, via Finnhub's /company-news.
 * Requires FINNHUB_API_KEY (server-side, free tier). Degrades gracefully:
 * when the key is missing it returns { news: [], configured: false } so the UI
 * can show a hint instead of erroring. News is shown as context, never advice.
 */

const FINNHUB = 'https://finnhub.io/api/v1/company-news';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: any, res: any) {
  if (!applyRateLimit(req, res, { windowMs: 60_000, maxRequests: 30 })) return;

  const symbol = String(req.query?.symbol || '').trim().toUpperCase();
  const limit = Math.min(Math.max(parseInt(String(req.query?.limit || '6'), 10) || 6, 1), 15);
  if (!symbol) return res.status(400).json({ error: 'symbol query param is required' });

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    // Not an error — the feature is simply not configured on this deployment.
    return res.status(200).json({ news: [], configured: false });
  }

  try {
    const from = daysAgo(14);
    const to = daysAgo(0);
    const url = `${FINNHUB}?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${apiKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.error(`[ticker-news] Finnhub ${resp.status} for ${symbol}:`, body.slice(0, 200));
      return res.status(502).json({ error: 'Failed to fetch news', configured: true });
    }

    const raw = await resp.json() as any[];
    const news = (Array.isArray(raw) ? raw : [])
      .filter(a => a?.headline && a?.url)
      .sort((a, b) => (b?.datetime ?? 0) - (a?.datetime ?? 0))
      .slice(0, limit)
      .map(a => ({
        headline: String(a.headline),
        source: a.source ? String(a.source) : undefined,
        url: String(a.url),
        datetime: typeof a.datetime === 'number' ? a.datetime : undefined,
        summary: a.summary ? String(a.summary).slice(0, 240) : undefined,
      }));

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json({ news, configured: true, asOf: new Date().toISOString() });
  } catch (err: unknown) {
    handleApiError(res, err, 'ticker-news', 502, 'EXTERNAL_API_ERROR');
  }
}
