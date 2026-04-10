import { handleApiError, createErrorResponse } from './_utils/errorHandler';

/**
 * Unified astro proxy — all FreeAstroAPI calls go through this single
 * serverless function to stay within Vercel Hobby's 12-function limit.
 *
 * Routes by query param: /api/astro?action=natal|daily|moon|chart|vedic|transits
 * POST for all except moon (GET-style, but still POST body for consistency).
 */
export default async function handler(req: any, res: any) {
  const API_KEY = process.env.FREEASTROAPI_API_KEY;
  if (!API_KEY) return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'Astrology service not configured'));

  const action = req.query.action || req.body?.action;
  if (!action) return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'action parameter is required'));

  try {
    switch (action) {
      case 'natal': return await handleNatal(req, res, API_KEY);
      case 'daily': return await handleDaily(req, res, API_KEY);
      case 'moon': return await handleMoon(req, res, API_KEY);
      case 'chart': return await handleChart(req, res, API_KEY);
      case 'vedic': return await handleVedic(req, res, API_KEY);
      case 'transits': return await handleTransits(req, res, API_KEY);
      default: return res.status(400).json(createErrorResponse('VALIDATION_ERROR', `Unknown action: ${action}`));
    }
  } catch (err) {
    handleApiError(res, err, `astro-${action}`);
  }
}

/* ── Natal Chart (JSON) ───────────────────────────────────────── */
async function handleNatal(req: any, res: any, API_KEY: string) {
  const { year, month, day, hour, minute, city, timeKnown } = req.body || {};
  if (!year || !month || !day || !city) return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day, city required'));

  const payload: Record<string, unknown> = {
    year, month, day, city,
    time_known: timeKnown !== false && hour != null,
    house_system: 'placidus', zodiac_type: 'tropical',
    include_speed: true, include_dignity: true, include_minor_aspects: false,
    include_stelliums: true, include_features: ['chiron', 'lilith', 'true_node'],
    interpretation: { enable: true, style: 'improved' },
  };
  if (hour != null) payload.hour = hour;
  if (minute != null) payload.minute = minute;

  const resp = await fetch('https://api.freeastroapi.com/api/v1/natal/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) { const e = await resp.text(); console.error(`[astro:natal] ${resp.status}:`, e); return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Natal: ${resp.status}`)); }
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.status(200).json(await resp.json());
}

/* ── Daily Horoscope ──────────────────────────────────────────── */
async function handleDaily(req: any, res: any, API_KEY: string) {
  const { year, month, day, hour, minute, city, date } = req.body || {};
  if (!year || !month || !day || !city) return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day, city required'));

  const payload: Record<string, unknown> = { birth: { year, month, day, hour: hour ?? 12, minute: minute ?? 0, city } };
  if (date) payload.date = date;

  const resp = await fetch('https://api.freeastroapi.com/api/v2/horoscope/daily/personal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) { const e = await resp.text(); console.error(`[astro:daily] ${resp.status}:`, e); return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Daily: ${resp.status}`)); }
  return res.status(200).json(await resp.json());
}

/* ── Moon Phase ───────────────────────────────────────────────── */
async function handleMoon(req: any, res: any, API_KEY: string) {
  const city = ((req.query.city || req.body?.city) || '').trim();

  const strategies = [
    () => { const p = new URLSearchParams({ include_zodiac: 'true', include_special: 'true', include_eclipse: 'true', include_forecast: 'true', include_traditional_moon: 'true' }); if (city) p.set('city', city); return p; },
    () => { const p = new URLSearchParams({ include_zodiac: 'true' }); if (city) p.set('city', city); return p; },
    () => new URLSearchParams({ include_zodiac: 'true' }),
  ];

  for (let i = 0; i < strategies.length; i++) {
    const params = strategies[i]();
    const resp = await fetch(`https://api.freeastroapi.com/api/v1/moon/phase?${params}`, { headers: { 'x-api-key': API_KEY } });
    if (resp.ok) { res.setHeader('Cache-Control', 'public, max-age=3600'); return res.status(200).json(await resp.json()); }
    console.warn(`[astro:moon] Attempt ${i + 1} failed (${resp.status})`);
  }
  return res.status(502).json(createErrorResponse('EXTERNAL_API_ERROR', 'Moon API unavailable'));
}

/* ── SVG Chart ────────────────────────────────────────────────── */
async function handleChart(req: any, res: any, API_KEY: string) {
  const { year, month, day, hour, minute, city, timeKnown, zodiacType, themeType } = req.body || {};
  if (!year || !month || !day || !city) return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day, city required'));

  const payload: Record<string, unknown> = {
    name: 'My Chart', year, month, day, city,
    time_known: timeKnown !== false && hour != null,
    house_system: zodiacType === 'sidereal' ? 'whole_sign' : 'placidus',
    zodiac_type: zodiacType || 'tropical',
    format: 'svg', size: 700, theme_type: themeType || 'light', show_metadata: false,
    display_settings: { chiron: true, lilith: true, north_node: true, south_node: true, ic: true, dsc: true, part_of_fortune: true },
    chart_config: { chart_background: '#F6F1E8', custom_planet_color: '#1E1B18', custom_sign_color: '#6A5B48', custom_house_color: '#3E362C', custom_sign_bg_color: '#EFE4D3', custom_house_bg_color: '#FAF6EE', sign_line_color: '#3A3128', house_line_color: '#8C7C68', show_retrograde_markers: true, retrograde_marker_style: 'rx', show_aspect_symbols: true },
  };
  if (zodiacType === 'sidereal') payload.sidereal_ayanamsa = 'lahiri';
  if (hour != null) payload.hour = hour;
  if (minute != null) payload.minute = minute;

  const resp = await fetch('https://api.freeastroapi.com/api/v1/natal/chart/', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY }, body: JSON.stringify(payload),
  });
  if (!resp.ok) { const e = await resp.text(); console.error(`[astro:chart] ${resp.status}:`, e.slice(0, 200)); return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Chart: ${resp.status}`)); }
  const svg = await resp.text();
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.status(200).json({ svg });
}

/* ── Vedic (Strength + Vargas) ────────────────────────────────── */
async function handleVedic(req: any, res: any, API_KEY: string) {
  const { year, month, day, hour, minute, city, lat, lng } = req.body || {};
  if (!year || !month || !day) return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day required'));

  const base: Record<string, unknown> = { year, month, day, hour: hour ?? 12, minute: minute ?? 0, tz_str: 'auto', ayanamsha: 'lahiri', house_system: 'whole_sign', node_type: 'mean' };
  if (city) base.city = city;
  if (lat != null) base.lat = lat;
  if (lng != null) base.lng = lng;
  const headers = { 'Content-Type': 'application/json', 'x-api-key': API_KEY };
  const result: Record<string, any> = {};

  const sResp = await fetch('https://api.freeastroapi.com/api/v1/vedic/strength', { method: 'POST', headers, body: JSON.stringify(base) });
  if (sResp.ok) result.strength = await sResp.json(); else { console.warn(`[astro:vedic] strength ${sResp.status}`); result.strengthError = sResp.status; }

  const vResp = await fetch('https://api.freeastroapi.com/api/v1/vedic/vargas', { method: 'POST', headers, body: JSON.stringify({ ...base, vargas: ['D1', 'D9', 'D10', 'D2', 'D7'] }) });
  if (vResp.ok) result.vargas = await vResp.json(); else { console.warn(`[astro:vedic] vargas ${vResp.status}`); result.vargasError = vResp.status; }

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.status(200).json(result);
}

/* ── Transits ─────────────────────────────────────────────────── */
async function handleTransits(req: any, res: any, API_KEY: string) {
  const { year, month, day, hour, minute, city, lat, lng } = req.body || {};
  if (!year || !month || !day || !city) return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day, city required'));

  const now = new Date();
  const transitDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const payload: Record<string, unknown> = {
    natal: { name: 'User', year, month, day, hour: hour ?? 12, minute: minute ?? 0, city, tz_str: 'AUTO' },
    transit_date: transitDate, current_city: city, tz_str: 'AUTO',
  };
  if (lat != null) { payload.natal = { ...payload.natal as object, lat, lng }; payload.current_lat = lat; payload.current_lng = lng; }

  const resp = await fetch('https://api.freeastroapi.com/api/v1/transits/calculate', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY }, body: JSON.stringify(payload),
  });
  if (!resp.ok) { const e = await resp.text(); console.error(`[astro:transits] ${resp.status}:`, e.slice(0, 200)); return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Transits: ${resp.status}`)); }
  return res.status(200).json(await resp.json());
}
