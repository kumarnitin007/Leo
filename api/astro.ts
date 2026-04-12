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
  } catch (err: any) {
    console.error(`[astro:${action}] Unhandled error:`, err?.message || err, err?.stack?.slice(0, 500));
    handleApiError(res, err, `astro-${action}`);
  }
}

/* ── Natal Chart (JSON) ───────────────────────────────────────── */
async function handleNatal(req: any, res: any, API_KEY: string) {
  const { year, month, day, hour, minute, city, timeKnown } = req.body || {};
  if (!year || !month || !day || !city) {
    console.error('[astro:natal] Missing fields:', { year, month, day, city, body: req.body });
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day, city required'));
  }

  const payload: Record<string, unknown> = {
    year: Number(year), month: Number(month), day: Number(day), city: String(city),
    time_known: timeKnown !== false && hour != null,
    house_system: 'placidus', zodiac_type: 'tropical',
    include_speed: true, include_dignity: true, include_minor_aspects: false,
    include_stelliums: true, include_features: ['chiron', 'lilith', 'true_node'],
    interpretation: { enable: true, style: 'improved' },
  };
  if (hour != null) payload.hour = Number(hour);
  if (minute != null) payload.minute = Number(minute);

  console.log('[astro:natal] Sending payload:', JSON.stringify(payload));

  const resp = await fetch('https://api.freeastroapi.com/api/v1/natal/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(payload),
  });
  const bodyText = await resp.text();
  if (!resp.ok) {
    console.error(`[astro:natal] ${resp.status}:`, bodyText.slice(0, 500));
    return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Natal: ${resp.status}`));
  }
  try {
    const data = JSON.parse(bodyText);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).json(data);
  } catch (parseErr) {
    console.error('[astro:natal] JSON parse error:', bodyText.slice(0, 200));
    return res.status(502).json(createErrorResponse('PARSE_ERROR', 'Invalid response from astrology API'));
  }
}

/* ── Daily Horoscope ──────────────────────────────────────────── */
async function handleDaily(req: any, res: any, API_KEY: string) {
  const { year, month, day, hour, minute, city, date } = req.body || {};
  if (!year || !month || !day || !city) {
    console.error('[astro:daily] Missing fields:', { year, month, day, city, body: req.body });
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day, city required'));
  }

  const payload: Record<string, unknown> = {
    birth: { year: Number(year), month: Number(month), day: Number(day), hour: Number(hour ?? 12), minute: Number(minute ?? 0), city: String(city) },
  };
  if (date) payload.date = date;

  console.log('[astro:daily] Sending payload:', JSON.stringify(payload));

  const resp = await fetch('https://api.freeastroapi.com/api/v2/horoscope/daily/personal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(payload),
  });
  const bodyText = await resp.text();
  if (!resp.ok) {
    console.error(`[astro:daily] ${resp.status}:`, bodyText.slice(0, 500));
    return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Daily: ${resp.status}`));
  }
  try {
    return res.status(200).json(JSON.parse(bodyText));
  } catch {
    console.error('[astro:daily] JSON parse error:', bodyText.slice(0, 200));
    return res.status(502).json(createErrorResponse('PARSE_ERROR', 'Invalid response from daily API'));
  }
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
  if (!year || !month || !day || !city) {
    console.error('[astro:chart] Missing fields:', { year, month, day, city, body: req.body });
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day, city required'));
  }

  const payload: Record<string, unknown> = {
    name: 'My Chart', year: Number(year), month: Number(month), day: Number(day), city: String(city),
    time_known: timeKnown !== false && hour != null,
    house_system: zodiacType === 'sidereal' ? 'whole_sign' : 'placidus',
    zodiac_type: zodiacType || 'tropical',
    format: 'svg', size: 700, theme_type: themeType || 'light', show_metadata: false,
    display_settings: { chiron: true, lilith: true, north_node: true, south_node: true, ic: true, dsc: true, part_of_fortune: true },
    chart_config: { chart_background: '#F6F1E8', custom_planet_color: '#1E1B18', custom_sign_color: '#6A5B48', custom_house_color: '#3E362C', custom_sign_bg_color: '#EFE4D3', custom_house_bg_color: '#FAF6EE', sign_line_color: '#3A3128', house_line_color: '#8C7C68', show_retrograde_markers: true, retrograde_marker_style: 'rx', show_aspect_symbols: true },
  };
  if (zodiacType === 'sidereal') payload.sidereal_ayanamsa = 'lahiri';
  if (hour != null) payload.hour = Number(hour);
  if (minute != null) payload.minute = Number(minute);

  console.log('[astro:chart] Sending payload:', JSON.stringify(payload));

  const resp = await fetch('https://api.freeastroapi.com/api/v1/natal/chart/', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY }, body: JSON.stringify(payload),
  });
  const bodyText = await resp.text();
  if (!resp.ok) {
    console.error(`[astro:chart] ${resp.status}:`, bodyText.slice(0, 500));
    return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Chart: ${resp.status}`));
  }
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.status(200).json({ svg: bodyText });
}

/* ── Vedic (Strength + Vargas) ────────────────────────────────── */
async function handleVedic(req: any, res: any, API_KEY: string) {
  const { year, month, day, hour, minute, city, lat, lng } = req.body || {};
  if (!year || !month || !day) {
    console.error('[astro:vedic] Missing fields:', { year, month, day, body: req.body });
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day required'));
  }

  const base: Record<string, unknown> = {
    year: Number(year), month: Number(month), day: Number(day),
    hour: Number(hour ?? 12), minute: Number(minute ?? 0),
    tz_str: 'auto', ayanamsha: 'lahiri', house_system: 'whole_sign', node_type: 'mean',
  };
  if (city) base.city = String(city);
  if (lat != null) base.lat = Number(lat);
  if (lng != null) base.lng = Number(lng);
  const headers = { 'Content-Type': 'application/json', 'x-api-key': API_KEY };
  const result: Record<string, any> = {};

  console.log('[astro:vedic] Sending strength payload:', JSON.stringify(base));
  const sResp = await fetch('https://api.freeastroapi.com/api/v1/vedic/strength', { method: 'POST', headers, body: JSON.stringify(base) });
  if (sResp.ok) { result.strength = await sResp.json(); }
  else { const e = await sResp.text(); console.warn(`[astro:vedic] strength ${sResp.status}:`, e.slice(0, 300)); result.strengthError = sResp.status; }

  const vResp = await fetch('https://api.freeastroapi.com/api/v1/vedic/vargas', { method: 'POST', headers, body: JSON.stringify({ ...base, vargas: ['D1', 'D9', 'D10', 'D2', 'D7'] }) });
  if (vResp.ok) { result.vargas = await vResp.json(); }
  else { const e = await vResp.text(); console.warn(`[astro:vedic] vargas ${vResp.status}:`, e.slice(0, 300)); result.vargasError = vResp.status; }

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.status(200).json(result);
}

/* ── Transits ─────────────────────────────────────────────────── */
async function handleTransits(req: any, res: any, API_KEY: string) {
  const { year, month, day, hour, minute, city, lat, lng } = req.body || {};
  if (!year || !month || !day || !city) {
    console.error('[astro:transits] Missing fields:', { year, month, day, city, body: req.body });
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day, city required'));
  }

  const now = new Date();
  const transitDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const payload: Record<string, unknown> = {
    natal: {
      name: 'User', year: Number(year), month: Number(month), day: Number(day),
      hour: Number(hour ?? 12), minute: Number(minute ?? 0), city: String(city), tz_str: 'AUTO',
    },
    transit_date: transitDate, current_city: String(city), tz_str: 'AUTO',
  };
  if (lat != null) {
    payload.natal = { ...payload.natal as object, lat: Number(lat), lng: Number(lng) };
    payload.current_lat = Number(lat);
    payload.current_lng = Number(lng);
  }

  console.log('[astro:transits] Sending payload:', JSON.stringify(payload));

  const resp = await fetch('https://api.freeastroapi.com/api/v1/transits/calculate', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY }, body: JSON.stringify(payload),
  });
  const bodyText = await resp.text();
  if (!resp.ok) {
    console.error(`[astro:transits] ${resp.status}:`, bodyText.slice(0, 500));
    return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Transits: ${resp.status}`));
  }
  try {
    return res.status(200).json(JSON.parse(bodyText));
  } catch {
    console.error('[astro:transits] JSON parse error:', bodyText.slice(0, 200));
    return res.status(502).json(createErrorResponse('PARSE_ERROR', 'Invalid response from transits API'));
  }
}
