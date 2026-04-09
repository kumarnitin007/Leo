import { handleApiError, createErrorResponse } from './_utils/errorHandler';

/**
 * GET /api/astro-moon?city=Noida
 * Proxy for FreeAstroAPI moon phase data.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.FREEASTROAPI_API_KEY;
  if (!API_KEY) return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'Astrology service not configured'));

  try {
    const city = (req.query.city || '').trim();

    // Attempt strategies in order of richness → minimal
    const strategies = [
      // Strategy 1: Full features with city
      () => {
        const p = new URLSearchParams({ include_zodiac: 'true', include_special: 'true', include_eclipse: 'true', include_forecast: 'true', include_traditional_moon: 'true' });
        if (city) p.set('city', city);
        return p;
      },
      // Strategy 2: Basic with city
      () => {
        const p = new URLSearchParams({ include_zodiac: 'true' });
        if (city) p.set('city', city);
        return p;
      },
      // Strategy 3: No city at all (pure geocentric)
      () => new URLSearchParams({ include_zodiac: 'true' }),
    ];

    for (let i = 0; i < strategies.length; i++) {
      const params = strategies[i]();
      const url = `https://api.freeastroapi.com/api/v1/moon/phase?${params}`;
      console.log(`[astro-moon] Attempt ${i + 1}: ${url}`);

      const resp = await fetch(url, { headers: { 'x-api-key': API_KEY } });

      if (resp.ok) {
        const data = await resp.json();
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.status(200).json(data);
      }

      const errBody = await resp.text().catch(() => '');
      console.warn(`[astro-moon] Attempt ${i + 1} failed (${resp.status}): ${errBody.slice(0, 200)}`);
    }

    return res.status(502).json(createErrorResponse('EXTERNAL_API_ERROR', 'Moon phase API unavailable after all retries'));
  } catch (err) {
    handleApiError(res, err, 'astro-moon');
  }
}
