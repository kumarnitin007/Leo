import { handleApiError, createErrorResponse } from './_utils/errorHandler';

/**
 * POST /api/astro-daily
 * Proxy for FreeAstroAPI personalised daily horoscope (v2).
 * Keeps the API key server-side.
 * Rate limiting handled by FreeAstroAPI + client-side caching (localStorage per day).
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.FREEASTROAPI_API_KEY;
  if (!API_KEY) {
    console.error('[astro-daily] FREEASTROAPI_API_KEY not configured');
    return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'Astrology service not configured'));
  }

  try {
    const { year, month, day, hour, minute, city, date } = req.body || {};
    if (!year || !month || !day || !city) {
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day, and city are required'));
    }

    const payload: Record<string, unknown> = {
      birth: { year, month, day, hour: hour ?? 12, minute: minute ?? 0, city },
    };
    if (date) payload.date = date;

    const resp = await fetch('https://api.freeastroapi.com/api/v2/horoscope/daily/personal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'Accept-Encoding': 'br, gzip' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`[astro-daily] API ${resp.status}:`, errBody);
      return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Astro API error: ${resp.status}`));
    }

    const data = await resp.json();
    return res.status(200).json(data);
  } catch (err) {
    handleApiError(res, err, 'astro-daily');
  }
}
