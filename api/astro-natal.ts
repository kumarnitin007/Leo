import { handleApiError, createErrorResponse } from './_utils/errorHandler';

/**
 * POST /api/astro-natal
 * Proxy for FreeAstroAPI natal chart calculation.
 * Keeps the API key server-side.
 * Rate limiting handled by FreeAstroAPI + client-side caching (localStorage forever).
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.FREEASTROAPI_API_KEY;
  if (!API_KEY) {
    console.error('[astro-natal] FREEASTROAPI_API_KEY not configured');
    return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'Astrology service not configured'));
  }

  try {
    const { year, month, day, hour, minute, city, timeKnown } = req.body || {};
    if (!year || !month || !day || !city) {
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day, and city are required'));
    }

    const payload: Record<string, unknown> = {
      year, month, day, city,
      time_known: timeKnown !== false && hour != null,
      house_system: 'placidus',
      zodiac_type: 'tropical',
      include_speed: true,
      include_dignity: true,
      include_minor_aspects: false,
      include_stelliums: true,
      include_features: ['chiron', 'lilith', 'true_node'],
      interpretation: { enable: true, style: 'improved' },
    };
    if (hour != null) payload.hour = hour;
    if (minute != null) payload.minute = minute;

    const resp = await fetch('https://api.freeastroapi.com/api/v1/natal/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'Accept-Encoding': 'br, gzip' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`[astro-natal] API ${resp.status}:`, errBody);
      return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Astro API error: ${resp.status}`));
    }

    const data = await resp.json();
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).json(data);
  } catch (err) {
    handleApiError(res, err, 'astro-natal');
  }
}
