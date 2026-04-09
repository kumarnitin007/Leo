import { handleApiError, createErrorResponse } from './_utils/errorHandler';

/**
 * POST /api/astro-vedic
 * Fetches multiple Vedic astrology endpoints in one call:
 *   - Planetary Strength (Shadbala + Ashtakavarga)
 *   - Divisional Charts (Vargas: D1, D9, D10)
 * Returns combined data.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.FREEASTROAPI_API_KEY;
  if (!API_KEY) return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'Astrology service not configured'));

  try {
    const { year, month, day, hour, minute, city, lat, lng } = req.body || {};
    if (!year || !month || !day) {
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day are required'));
    }

    const base: Record<string, unknown> = {
      year, month, day,
      hour: hour ?? 12, minute: minute ?? 0,
      tz_str: 'auto',
      ayanamsha: 'lahiri',
      house_system: 'whole_sign',
      node_type: 'mean',
    };
    if (city) base.city = city;
    if (lat != null) base.lat = lat;
    if (lng != null) base.lng = lng;

    const headers = { 'Content-Type': 'application/json', 'x-api-key': API_KEY };
    const result: Record<string, any> = {};

    // Sequential calls to avoid FreeAstroAPI's per-key rate limit
    const strengthResp = await fetch('https://api.freeastroapi.com/api/v1/vedic/strength', {
      method: 'POST', headers, body: JSON.stringify(base),
    });
    if (strengthResp.ok) {
      result.strength = await strengthResp.json();
    } else {
      console.warn(`[astro-vedic] strength ${strengthResp.status}`);
      result.strengthError = strengthResp.status;
    }

    const vargasResp = await fetch('https://api.freeastroapi.com/api/v1/vedic/vargas', {
      method: 'POST', headers,
      body: JSON.stringify({ ...base, vargas: ['D1', 'D9', 'D10', 'D2', 'D7'] }),
    });
    if (vargasResp.ok) {
      result.vargas = await vargasResp.json();
    } else {
      console.warn(`[astro-vedic] vargas ${vargasResp.status}`);
      result.vargasError = vargasResp.status;
    }

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).json(result);
  } catch (err) {
    handleApiError(res, err, 'astro-vedic');
  }
}
