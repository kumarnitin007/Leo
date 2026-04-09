import { handleApiError, createErrorResponse } from './_utils/errorHandler';

/**
 * POST /api/astro-transits
 * Fetches current planetary transits against the user's natal chart.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.FREEASTROAPI_API_KEY;
  if (!API_KEY) return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'Astrology service not configured'));

  try {
    const { year, month, day, hour, minute, city, lat, lng } = req.body || {};
    if (!year || !month || !day || !city) {
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day, city are required'));
    }

    const now = new Date();
    const transitDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const payload: Record<string, unknown> = {
      natal: {
        name: 'User',
        year, month, day,
        hour: hour ?? 12, minute: minute ?? 0,
        city,
        tz_str: 'AUTO',
      },
      transit_date: transitDate,
      current_city: city,
      tz_str: 'AUTO',
    };
    if (lat != null) { payload.natal = { ...payload.natal as object, lat, lng }; payload.current_lat = lat; payload.current_lng = lng; }

    const resp = await fetch('https://api.freeastroapi.com/api/v1/transits/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`[astro-transits] API ${resp.status}:`, errBody.slice(0, 300));
      return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Transits API error: ${resp.status}`));
    }

    const data = await resp.json();
    return res.status(200).json(data);
  } catch (err) {
    handleApiError(res, err, 'astro-transits');
  }
}
