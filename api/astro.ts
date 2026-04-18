import { handleApiError, createErrorResponse } from './_utils/errorHandler.js';

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
      case 'bazi': return await handleBazi(req, res, API_KEY);
      case 'panchang': return await handlePanchang(req, res, API_KEY);
      case 'yogas': return await handleYogas(req, res, API_KEY);
      case 'dasha': return await handleDasha(req, res, API_KEY);
      case 'numerology': return await handleNumerology(req, res);
      case 'ask-ai': return await handleAskAI(req, res);
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

/* ── BaZi Four Pillars (Chinese) ──────────────────────────────── */
async function handleBazi(req: any, res: any, API_KEY: string) {
  const { year, month, day, hour, minute, city, sex, lat, lng } = req.body || {};
  if (!year || !month || !day || !city) {
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day, city required'));
  }
  const payload: Record<string, unknown> = {
    year: Number(year), month: Number(month), day: Number(day),
    hour: Number(hour ?? 12), minute: Number(minute ?? 0),
    city: String(city), sex: sex || 'M',
    include_pinyin: true,
    include_shen_sha: true,
    include_interactions: true,
    include_luck_cycle: true,
    include_element_balance: true,
    time_standard: 'civil',
  };
  if (lat != null) { payload.lat = Number(lat); payload.lng = Number(lng); }

  console.log('[astro:bazi] Sending payload:', JSON.stringify(payload));
  const resp = await fetch('https://api.freeastroapi.com/api/v1/chinese/bazi', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY }, body: JSON.stringify(payload),
  });
  const bodyText = await resp.text();
  if (!resp.ok) {
    console.error(`[astro:bazi] ${resp.status}:`, bodyText.slice(0, 500));
    return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `BaZi: ${resp.status}`));
  }
  try {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).json(JSON.parse(bodyText));
  } catch {
    console.error('[astro:bazi] JSON parse error:', bodyText.slice(0, 200));
    return res.status(502).json(createErrorResponse('PARSE_ERROR', 'Invalid response from BaZi API'));
  }
}

/* ── City → Coordinates lookup (for endpoints that require lat/lng) ── */
const CITY_COORDS: Record<string, [number, number]> = {
  'new delhi': [28.6139, 77.2090], delhi: [28.6139, 77.2090], mumbai: [19.0760, 72.8777],
  bangalore: [12.9716, 77.5946], bengaluru: [12.9716, 77.5946], chennai: [13.0827, 80.2707],
  kolkata: [22.5726, 88.3639], hyderabad: [17.3850, 78.4867], pune: [18.5204, 73.8567],
  ahmedabad: [23.0225, 72.5714], jaipur: [26.9124, 75.7873], lucknow: [26.8467, 80.9462],
  chandigarh: [30.7333, 76.7794], indore: [22.7196, 75.8577], bhopal: [23.2599, 77.4126],
  patna: [25.6093, 85.1376], noida: [28.5355, 77.3910], gurgaon: [28.4595, 77.0266],
  gurugram: [28.4595, 77.0266], surat: [21.1702, 72.8311], nagpur: [21.1458, 79.0882],
  varanasi: [25.3176, 82.9739], kochi: [9.9312, 76.2673], thiruvananthapuram: [8.5241, 76.9366],
  coimbatore: [11.0168, 76.9558], visakhapatnam: [17.6868, 83.2185], goa: [15.2993, 74.1240],
  amritsar: [31.6340, 74.8723], dehradun: [30.3165, 78.0322], shimla: [31.1048, 77.1734],
  london: [51.5074, -0.1278], 'new york': [40.7128, -74.0060], toronto: [43.6532, -79.3832],
  sydney: [-33.8688, 151.2093], singapore: [1.3521, 103.8198], dubai: [25.2048, 55.2708],
  kathmandu: [27.7172, 85.3240], colombo: [6.9271, 79.8612], dhaka: [23.8103, 90.4125],
};

async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  const key = city.toLowerCase().trim();
  const known = CITY_COORDS[key];
  if (known) return { lat: known[0], lng: known[1] };

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
    const r = await fetch(url, { headers: { 'User-Agent': 'MyDay-App/1.0' } });
    if (r.ok) {
      const data = await r.json();
      if (data?.[0]?.lat && data?.[0]?.lon) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    }
  } catch (e) {
    console.warn('[geocode] Nominatim lookup failed for', city, e);
  }
  return null;
}

/* ── Panchang (Hindu daily almanac) ───────────────────────────── */
async function handlePanchang(req: any, res: any, API_KEY: string) {
  const { lat, lng, city, year, month, day } = req.body || {};
  if (lat == null && lng == null && !city) {
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'city (or lat+lng) required'));
  }

  let resolvedLat = lat != null ? Number(lat) : undefined;
  let resolvedLng = lng != null ? Number(lng) : undefined;

  if (resolvedLat == null || resolvedLng == null) {
    if (city) {
      const coords = await geocodeCity(String(city));
      if (coords) {
        resolvedLat = coords.lat;
        resolvedLng = coords.lng;
        console.log(`[astro:panchang] Geocoded "${city}" → ${resolvedLat}, ${resolvedLng}`);
      } else {
        console.error(`[astro:panchang] Could not geocode city: ${city}`);
        return res.status(400).json(createErrorResponse('VALIDATION_ERROR', `Could not resolve coordinates for city: ${city}. Provide lat and lng directly.`));
      }
    }
  }

  const now = new Date();
  const payload: Record<string, unknown> = {
    year: Number(year ?? now.getFullYear()), month: Number(month ?? now.getMonth() + 1), day: Number(day ?? now.getDate()),
    hour: now.getHours(), minute: now.getMinutes(),
    lat: resolvedLat, lng: resolvedLng, tz_str: 'AUTO',
  };
  if (city) payload.city = String(city);

  console.log('[astro:panchang] Sending payload:', JSON.stringify(payload));
  const resp = await fetch('https://api.freeastroapi.com/api/v1/vedic/panchang', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY }, body: JSON.stringify(payload),
  });
  const bodyText = await resp.text();
  if (!resp.ok) {
    console.error(`[astro:panchang] ${resp.status}:`, bodyText.slice(0, 500));
    return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Panchang: ${resp.status}`));
  }
  try {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(JSON.parse(bodyText));
  } catch {
    console.error('[astro:panchang] JSON parse error:', bodyText.slice(0, 200));
    return res.status(502).json(createErrorResponse('PARSE_ERROR', 'Invalid response from Panchang API'));
  }
}

/* ── Yoga Detection ───────────────────────────────────────────── */
async function handleYogas(req: any, res: any, API_KEY: string) {
  const { year, month, day, hour, minute, city, lat, lng } = req.body || {};
  if (!year || !month || !day) {
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day required'));
  }
  const payload: Record<string, unknown> = {
    year: Number(year), month: Number(month), day: Number(day),
    hour: Number(hour ?? 12), minute: Number(minute ?? 0),
    tz_str: 'AUTO', ayanamsha: 'lahiri', house_system: 'whole_sign', node_type: 'mean',
  };
  if (city) payload.city = String(city);
  if (lat != null) { payload.lat = Number(lat); payload.lng = Number(lng); }

  console.log('[astro:yogas] Sending payload:', JSON.stringify(payload));
  const resp = await fetch('https://api.freeastroapi.com/api/v1/vedic/yogas', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY }, body: JSON.stringify(payload),
  });
  const bodyText = await resp.text();
  if (!resp.ok) {
    console.error(`[astro:yogas] ${resp.status}:`, bodyText.slice(0, 500));
    return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Yogas: ${resp.status}`));
  }
  try {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).json(JSON.parse(bodyText));
  } catch {
    console.error('[astro:yogas] JSON parse error:', bodyText.slice(0, 200));
    return res.status(502).json(createErrorResponse('PARSE_ERROR', 'Invalid response from Yogas API'));
  }
}

/* ── Vimshottari Dasha (life periods) ─────────────────────────── */
async function handleDasha(req: any, res: any, API_KEY: string) {
  const { year, month, day, hour, minute, city, lat, lng } = req.body || {};
  if (!year || !month || !day) {
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'year, month, day required'));
  }
  const payload: Record<string, unknown> = {
    year: Number(year), month: Number(month), day: Number(day),
    hour: Number(hour ?? 12), minute: Number(minute ?? 0),
    tz_str: 'AUTO', ayanamsha: 'lahiri', house_system: 'whole_sign', node_type: 'mean',
    levels: 2,
  };
  if (city) payload.city = String(city);
  if (lat != null) { payload.lat = Number(lat); payload.lng = Number(lng); }

  console.log('[astro:dasha] Sending payload:', JSON.stringify(payload));
  const resp = await fetch('https://api.freeastroapi.com/api/v1/vedic/dasha', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY }, body: JSON.stringify(payload),
  });
  const bodyText = await resp.text();
  if (!resp.ok) {
    console.error(`[astro:dasha] ${resp.status}:`, bodyText.slice(0, 500));
    return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Dasha: ${resp.status}`));
  }
  try {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).json(JSON.parse(bodyText));
  } catch {
    console.error('[astro:dasha] JSON parse error:', bodyText.slice(0, 200));
    return res.status(502).json(createErrorResponse('PARSE_ERROR', 'Invalid response from Dasha API'));
  }
}

// ── RapidAPI Numerology (optional — works without it, client-side fallback) ──
// Uses env var RAPIDAPI_KEY. If missing, returns 501 and client uses local engine.
// Standalone handler — delete this block to remove RapidAPI numerology.
async function handleNumerology(req: any, res: any) {
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPIDAPI_KEY) {
    return res.status(501).json(createErrorResponse('NOT_CONFIGURED', 'RapidAPI key not set — using client-side calculations'));
  }
  const { birthdate, full_name, gender } = req.body || {};
  if (!birthdate || !full_name) {
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'birthdate (YYYY-MM-DD) and full_name required'));
  }
  const url = `https://numerology-api6.p.rapidapi.com/calculate_numerology_numbers?birthdate=${encodeURIComponent(birthdate)}&full_name=${encodeURIComponent(full_name)}&gender=${encodeURIComponent(gender || 'Male')}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': 'numerology-api6.p.rapidapi.com',
    },
  });
  const bodyText = await resp.text();
  if (!resp.ok) {
    console.error(`[astro:numerology] ${resp.status}:`, bodyText.slice(0, 500));
    return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `Numerology API: ${resp.status}`));
  }
  try {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).json(JSON.parse(bodyText));
  } catch {
    return res.status(502).json(createErrorResponse('PARSE_ERROR', 'Invalid response from Numerology API'));
  }
}

/* ── Ask AI — OpenAI-powered astro reading ────────────────────── */
async function handleAskAI(req: any, res: any) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'OpenAI API key not configured'));
  }

  const { prompt, question } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || prompt.length < 20) {
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'A prompt with astrological context is required'));
  }

  const MODEL = 'gpt-4o-mini';
  const COST_PER_1K_IN = 0.00015;
  const COST_PER_1K_OUT = 0.0006;
  const startTime = Date.now();

  try {
    const systemContent = [
      'You are a wise, warm astrologer who synthesises Western, Vedic, and Chinese BaZi traditions.',
      'Use ALL of the astrological context provided to give a personalised answer.',
      'Reference the user\'s actual Dasha period, Day Master, yogas, and current transits when available.',
      'If any field is marked [UNAVAILABLE], acknowledge briefly but still give the best answer possible.',
      '',
      'Respond ONLY in this exact JSON format (no markdown fences):',
      '{',
      '  "simple": "3-4 lines. Warm, direct, actionable. No jargon.",',
      '  "detailed": "3-4 paragraphs. Reference specific planets, yogas, pillars, dasha. Conversational but insightful.",',
      '  "timing": "1-2 sentences on WHEN to act — specific moon phase, upcoming transit, or dasha window.",',
      '  "confidence": "high | medium | low — based on completeness of astrological data provided."',
      '}',
    ].join('\n');

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 1500,
      }),
    });
    const data = await resp.json();
    const durationMs = Date.now() - startTime;

    if (!resp.ok) {
      console.error('[astro:ask-ai] OpenAI error:', JSON.stringify(data).slice(0, 500));
      return res.status(resp.status).json(createErrorResponse('EXTERNAL_API_ERROR', `OpenAI: ${resp.status}`));
    }

    const raw = data.choices?.[0]?.message?.content || '';
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    const costUsd = (promptTokens / 1000) * COST_PER_1K_IN + (completionTokens / 1000) * COST_PER_1K_OUT;

    let parsed: { simple?: string; detailed?: string; timing?: string; confidence?: string } = {};
    try {
      parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    } catch {
      parsed = { simple: raw.slice(0, 300), detailed: raw };
    }

    return res.status(200).json({
      simple: parsed.simple || '',
      detailed: parsed.detailed || '',
      timing: parsed.timing || '',
      confidence: parsed.confidence || 'medium',
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens, model: MODEL, cost_usd: costUsd },
      durationMs,
      question: question || '',
    });
  } catch (err: any) {
    console.error('[astro:ask-ai] Error:', err?.message);
    return res.status(500).json(createErrorResponse('INTERNAL_ERROR', 'Failed to get AI reading'));
  }
}
