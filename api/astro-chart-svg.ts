import { handleApiError, createErrorResponse } from './_utils/errorHandler';

/**
 * POST /api/astro-chart-svg
 * Proxy for FreeAstroAPI natal SVG chart generation.
 * Returns the raw SVG string.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const API_KEY = process.env.FREEASTROAPI_API_KEY;
  if (!API_KEY) return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'Astrology service not configured'));

  try {
    const { year, month, day, hour, minute, city, timeKnown, zodiacType, themeType } = req.body || {};
    if (!year || !month || !day || !city) {
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day, and city are required'));
    }

    const payload: Record<string, unknown> = {
      name: 'My Chart',
      year, month, day, city,
      time_known: timeKnown !== false && hour != null,
      house_system: zodiacType === 'sidereal' ? 'whole_sign' : 'placidus',
      zodiac_type: zodiacType || 'tropical',
      format: 'svg',
      size: 700,
      theme_type: themeType || 'light',
      show_metadata: false,
      display_settings: {
        chiron: true, lilith: true, north_node: true, south_node: true,
        ic: true, dsc: true, part_of_fortune: true,
      },
      chart_config: {
        chart_background: '#F6F1E8',
        custom_planet_color: '#1E1B18',
        custom_sign_color: '#6A5B48',
        custom_house_color: '#3E362C',
        custom_sign_bg_color: '#EFE4D3',
        custom_house_bg_color: '#FAF6EE',
        sign_line_color: '#3A3128',
        house_line_color: '#8C7C68',
        show_retrograde_markers: true,
        retrograde_marker_style: 'rx',
        show_aspect_symbols: true,
      },
    };
    if (zodiacType === 'sidereal') payload.sidereal_ayanamsa = 'lahiri';
    if (hour != null) payload.hour = hour;
    if (minute != null) payload.minute = minute;

    const resp = await fetch('https://api.freeastroapi.com/api/v1/natal/chart/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`[astro-chart-svg] API ${resp.status}:`, errBody.slice(0, 300));
      return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Chart API error: ${resp.status}`));
    }

    const svg = await resp.text();
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ svg });
  } catch (err) {
    handleApiError(res, err, 'astro-chart-svg');
  }
}
