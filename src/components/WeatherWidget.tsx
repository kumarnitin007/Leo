/**
 * Weather Widget Component
 * 
 * Displays weather forecast using OpenWeatherMap API
 * Shows hourly forecast for today and 7-day forecast
 * Collapsible - only loads data when expanded
 *
 * Desktop (>=768px): dark hero + SVG curve graph + 7-day grid
 * Mobile  (<768px):  dark hero + 5-cell hourly strip + 7-day rows
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getUserSettings } from '../storage';
import { useTheme } from '../contexts/ThemeContext';
import type { TemperatureUnit } from '../types';
import { perfStart } from '../utils/perfLogger';

const FAHRENHEIT_COUNTRIES = ['US', 'BS', 'KY', 'LR', 'PW', 'FM', 'MH'];

const getDefaultTempUnit = (country?: string): TemperatureUnit => {
  if (!country) return 'fahrenheit';
  return FAHRENHEIT_COUNTRIES.includes(country.toUpperCase()) ? 'fahrenheit' : 'celsius';
};

/* ── Weather-icon emoji mapping (OpenWeatherMap icon codes) ─────── */
const ICON_EMOJI: Record<string, string> = {
  '01d': '☀️', '01n': '🌙',
  '02d': '⛅', '02n': '☁️',
  '03d': '☁️', '03n': '☁️',
  '04d': '☁️', '04n': '☁️',
  '09d': '🌧️', '09n': '🌧️',
  '10d': '🌦️', '10n': '🌧️',
  '11d': '⛈️', '11n': '⛈️',
  '13d': '❄️', '13n': '❄️',
  '50d': '🌫️', '50n': '🌫️',
};
function weatherEmoji(iconUrl: string): string {
  const m = iconUrl.match(/(\d{2}[dn])/);
  return m ? (ICON_EMOJI[m[1]] || '🌤️') : '🌤️';
}

interface WeatherData {
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    description: string;
    icon: string;
    windSpeed?: number;
    uvIndex?: number;
  };
  hourly: Array<{
    time: string;
    temp: number;
    icon: string;
    description: string;
    iconCode?: string;
  }>;
  daily: Array<{
    date: string;
    day: string;
    high: number;
    low: number;
    icon: string;
    description: string;
    iconCode?: string;
  }>;
}

const WEATHER_CACHE_KEY = 'weather_widget_cache';
const WEATHER_CACHE_TTL = 30 * 60 * 1000; // 30 min

function getCachedWeather(): WeatherData | null {
  try {
    const raw = sessionStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > WEATHER_CACHE_TTL) { sessionStorage.removeItem(WEATHER_CACHE_KEY); return null; }
    return data;
  } catch { return null; }
}
function setCachedWeather(data: WeatherData) {
  try { sessionStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch { /* ignore */ }
}

/* ── Catmull-Rom curve helper ──────────────────────────────────── */
function drawWeatherCurve(
  svgEl: SVGSVGElement,
  temps: number[],
  viewboxWidth: number,
  viewboxHeight: number,
  nowIndex: number,
) {
  const color = '#378ADD';
  const pad = { l: 16, r: 16, t: 16, b: 10 };
  const min = Math.min(...temps) - 2;
  const max = Math.max(...temps) + 2;
  const n = temps.length;

  const xs = temps.map((_, i) =>
    pad.l + (i / (n - 1)) * (viewboxWidth - pad.l - pad.r),
  );
  const ys = temps.map(t =>
    pad.t + (1 - (t - min) / (max - min)) * (viewboxHeight - pad.t - pad.b),
  );

  function catmull(pts: number[][]) {
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, pts.length - 1)];
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
    }
    return d;
  }

  const pts = xs.map((x, i) => [x, ys[i]]);
  const linePath = catmull(pts);
  const fillPath = linePath + ` L ${xs[n - 1]} ${viewboxHeight} L ${xs[0]} ${viewboxHeight} Z`;

  const dots = pts.map((p, i) =>
    i === nowIndex
      ? `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${color}"/>
         <circle cx="${p[0]}" cy="${p[1]}" r="10" fill="${color}" opacity="0.15"/>`
      : `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${color}" opacity="0.5"/>`,
  ).join('');

  svgEl.innerHTML = `
    <defs>
      <linearGradient id="wfg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.01"/>
      </linearGradient>
    </defs>
    <path d="${fillPath}" fill="url(#wfg)" stroke="none"/>
    <path d="${linePath}" fill="none" stroke="${color}"
      stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
  `;
}

/* ── Bar-colour helper for 7-day range bars ────────────────────── */
function barColor(hiTemp: number) {
  if (hiTemp <= 15) return '#85B7EB';
  if (hiTemp <= 25) return '#378ADD';
  if (hiTemp <= 32) return '#EF9F27';
  return '#E24B4A';
}

/* ══════════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════════ */
const WeatherWidget: React.FC = () => {
  const { theme } = useTheme();
  const isWP = theme.id === 'warm-paper';
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(() => getCachedWeather());
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ zipCode?: string; city?: string; country?: string } | null>(null);
  const [tempUnit, setTempUnit] = useState<TemperatureUnit>('fahrenheit');
  const [displayUnit, setDisplayUnit] = useState<TemperatureUnit>('fahrenheit');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const curveRef = useRef<SVGSVGElement>(null);

  const tempSymbol = displayUnit === 'celsius' ? '°C' : '°F';

  const convertTemp = useCallback((temp: number): number => {
    if (tempUnit === displayUnit) return Math.round(temp);
    if (tempUnit === 'fahrenheit' && displayUnit === 'celsius') return Math.round((temp - 32) * 5 / 9);
    return Math.round(temp * 9 / 5 + 32);
  }, [tempUnit, displayUnit]);

  const toggleDisplayUnit = () => setDisplayUnit(prev => prev === 'celsius' ? 'fahrenheit' : 'celsius');

  /* responsive listener */
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  /* load location & unit from settings */
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getUserSettings();
        if (settings.location && (settings.location.zipCode || settings.location.city)) {
          setLocation(settings.location);
          const unit = settings.temperatureUnit || getDefaultTempUnit(settings.location.country);
          setTempUnit(unit);
          setDisplayUnit(unit);
        }
      } catch (error: any) {
        if (!error?.message?.includes('User must be signed in')) console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  /* fetch weather on expand */
  useEffect(() => {
    if (isExpanded && location && !weatherData && !isLoading) fetchWeatherData();
  }, [isExpanded, location]);

  /* draw curve when data/display-unit changes on desktop */
  useEffect(() => {
    if (!curveRef.current || !weatherData?.hourly?.length || isMobile) return;
    const temps = weatherData.hourly.slice(0, 8).map(h => convertTemp(h.temp));
    const nowHour = new Date().getHours();
    let nowIndex = 0;
    weatherData.hourly.slice(0, 8).forEach((h, i) => {
      const hh = parseInt(h.time, 10) || 0;
      const hr = h.time.toLowerCase().includes('pm') && hh !== 12 ? hh + 12 : h.time.toLowerCase().includes('am') && hh === 12 ? 0 : hh;
      if (Math.abs(hr - nowHour) <= Math.abs(parseInt(weatherData.hourly[nowIndex]?.time, 10) - nowHour)) nowIndex = i;
    });
    drawWeatherCurve(curveRef.current, temps, 900, 80, nowIndex);
  }, [weatherData, isMobile, displayUnit, convertTemp]);

  const fetchWeatherData = async () => {
    if (!location || (!location.zipCode && !location.city)) { setError('Please set your location in Settings'); return; }
    const endPerf = perfStart('TodayView', 'fetchWeatherData');
    setIsLoading(true);
    setError(null);
    try {
      const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
      if (!API_KEY) { setError('Weather API key not configured. Please add VITE_OPENWEATHER_API_KEY to your .env file.'); setIsLoading(false); return; }

      let query = '';
      if (location.zipCode) query = `zip=${location.zipCode}${location.country ? ',' + location.country : ''}`;
      else query = `q=${location.city}${location.country ? ',' + location.country : ''}`;

      const units = tempUnit === 'celsius' ? 'metric' : 'imperial';
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?${query}&appid=${API_KEY}&units=${units}`;
      const forecastResponse = await fetch(forecastUrl);

      if (!forecastResponse.ok) {
        if (forecastResponse.status === 401) throw new Error('Invalid API key or API key not activated yet.');
        const errorData = await forecastResponse.json().catch(() => ({}));
        throw new Error(`Weather API error (${forecastResponse.status}): ${errorData.message || forecastResponse.statusText}`);
      }

      const forecastData = await forecastResponse.json();

      const hourly: WeatherData['hourly'] = forecastData.list.slice(0, 8).map((item: any) => {
        const date = new Date(item.dt * 1000);
        return {
          time: date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
          temp: Math.round(item.main.temp),
          icon: `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`,
          description: item.weather[0].description,
          iconCode: item.weather[0].icon,
        };
      });

      const dailyMap = new Map<string, { temps: number[]; icon: string; iconCode: string; description: string }>();
      forecastData.list.forEach((item: any) => {
        const date = new Date(item.dt * 1000);
        const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!dailyMap.has(dateKey)) dailyMap.set(dateKey, { temps: [], icon: item.weather[0].icon, iconCode: item.weather[0].icon, description: item.weather[0].description });
        const dayData = dailyMap.get(dateKey)!;
        dayData.temps.push(item.main.temp);
        dayData.icon = `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`;
        dayData.iconCode = item.weather[0].icon;
      });

      const daily: WeatherData['daily'] = Array.from(dailyMap.entries()).slice(0, 7).map(([dateKey, data]) => {
        const date = new Date(dateKey + ', ' + new Date().getFullYear());
        return {
          date: dateKey,
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          high: Math.round(Math.max(...data.temps)),
          low: Math.round(Math.min(...data.temps)),
          icon: data.icon,
          description: data.description,
          iconCode: data.iconCode,
        };
      });

      const first = forecastData.list[0];
      const current: WeatherData['current'] = {
        temp: Math.round(first.main.temp),
        feelsLike: Math.round(first.main.feels_like),
        humidity: first.main.humidity,
        description: first.weather[0].description,
        icon: `https://openweathermap.org/img/wn/${first.weather[0].icon}@2x.png`,
        windSpeed: first.wind?.speed ? Math.round(first.wind.speed) : undefined,
        uvIndex: undefined, // free tier doesn't include UV
      };

      const wd = { current, hourly, daily };
      setWeatherData(wd);
      setCachedWeather(wd);
    } catch (err: any) {
      console.error('Error fetching weather:', err);
      setError(err.message || 'Failed to load weather data.');
    } finally {
      setIsLoading(false);
      endPerf();
    }
  };

  /* ── No-location fallback ──────────────────────────────────────── */
  if (!location || (!location.zipCode && !location.city)) {
    return (
      <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', textAlign: 'center', color: 'white' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>📍 Set your location in Settings to see weather forecasts</p>
      </div>
    );
  }

  const locationLabel = location?.city || location?.zipCode || '';

  /* ── Derived data for 7-day range bars ─────────────────────────── */
  const sevenDay = weatherData?.daily || [];
  const weekMin = sevenDay.length ? Math.min(...sevenDay.map(d => convertTemp(d.low))) : 0;
  const weekMax = sevenDay.length ? Math.max(...sevenDay.map(d => convertTemp(d.high))) : 1;
  const totalRange = weekMax - weekMin || 1;

  /* CSS vars for theme-aware sections outside the hero */
  const textPrimary = theme.colors.text;
  const textSecondary = theme.colors.textLight;
  const borderTertiary = theme.colors.cardBorder;
  const bgSecondary = isWP ? '#f5f3ef' : theme.colors.background;

  /* Determine "now" index for hourly data */
  const getNowIndex = (count: number) => {
    if (!weatherData?.hourly?.length) return 0;
    const nowHour = new Date().getHours();
    let best = 0;
    let bestDiff = 999;
    weatherData.hourly.slice(0, count).forEach((h, i) => {
      const hh = parseInt(h.time, 10) || 0;
      const isPm = h.time.toLowerCase().includes('pm');
      const isAm = h.time.toLowerCase().includes('am');
      let hr24 = hh;
      if (isPm && hh !== 12) hr24 = hh + 12;
      else if (isAm && hh === 12) hr24 = 0;
      const diff = Math.abs(hr24 - nowHour);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    });
    return best;
  };

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div style={{
      marginTop: isWP ? '0.75rem' : '2rem',
      background: isWP ? '#ffffff' : 'rgba(255,255,255,0.95)',
      borderRadius: 12,
      border: isWP ? '1px solid #E5E3DC' : '1px solid rgba(0,0,0,0.1)',
      overflow: 'hidden',
    }}>
      {/* ── Accordion Header (unchanged) ─────────────────────────── */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: isWP ? '10px 14px' : '1rem 1.5rem',
          background: isWP ? '#ffffff' : 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
          color: isWP ? '#1a1a1a' : 'white',
          border: 'none',
          borderRadius: isWP && !isExpanded ? 12 : isWP ? '12px 12px 0 0' : undefined,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: isWP ? 8 : undefined,
          fontSize: isWP ? 14 : '1rem',
          fontWeight: isWP ? 700 : 600,
        }}
      >
        {isWP ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              <span style={{ fontSize: 14 }}>🌤️</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>Weather</span>
              {!isExpanded && weatherData ? (
                <span style={{ fontSize: 11, color: '#555', fontWeight: 400, marginLeft: 'auto' }}>
                  {convertTemp(weatherData.current.temp)}{tempSymbol} · {weatherData.current.description}
                </span>
              ) : locationLabel ? (
                <span style={{ fontSize: 11, color: '#999', fontWeight: 400, marginLeft: 'auto' }}>{locationLabel}</span>
              ) : null}
            </div>
            <span style={{ fontSize: 10, color: '#ccc', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🌤️</span>
              <span>Weather Forecast</span>
            </div>
            <span style={{ fontSize: '1.25rem' }}>{isExpanded ? '▲' : '▼'}</span>
          </>
        )}
      </button>

      {/* ── Expanded Content ─────────────────────────────────────── */}
      {isExpanded && (
        <div>
          {/* Error */}
          {error && (
            <div style={{ padding: 16, background: '#fee2e2', border: '1px solid #ef4444', borderRadius: 8, color: '#dc2626', margin: 16 }}>
              <strong>⚠️ Error:</strong> {error}
            </div>
          )}

          {/* Loading skeleton — inside the dark hero block */}
          {isLoading && !weatherData && (
            <div style={{ background: '#0d3d6b', padding: isMobile ? '16px' : '20px 28px 18px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ width: 100, height: 52, background: 'rgba(255,255,255,0.08)', borderRadius: 8, marginBottom: 8 }} />
              <div style={{ width: 140, height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
              <div style={{ width: 100, height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginTop: 8 }} />
            </div>
          )}

          {weatherData && !isLoading && (
            <>
              {/* ── 1. HERO BLOCK ──────────────────────────────────── */}
              <div style={{
                padding: isMobile ? '16px 16px 14px' : '20px 28px 18px',
                background: '#0d3d6b',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                {/* Decorative circles */}
                <div style={{ position: 'absolute', bottom: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: 20, right: 80, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

                {/* °F/°C toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleDisplayUnit(); }}
                  style={{
                    position: 'absolute', top: 14, right: 16,
                    fontSize: 11, fontWeight: 500,
                    color: 'rgba(255,255,255,0.7)',
                    border: '0.5px solid rgba(255,255,255,0.3)',
                    borderRadius: 4, padding: '3px 9px',
                    background: 'transparent', cursor: 'pointer',
                  }}
                >
                  {displayUnit === 'celsius' ? '°F' : '°C'}
                </button>

                {/* Left side */}
                <div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.09em', textTransform: 'uppercase' as const, marginBottom: 4 }}>
                    {locationLabel} {location?.country ? `· ${location.country.toUpperCase()}` : ''}
                  </div>
                  <div style={{ fontSize: isMobile ? 48 : 64, fontWeight: 300, color: '#fff', letterSpacing: -3, lineHeight: 1 }}>
                    {convertTemp(weatherData.current.temp)}°{displayUnit === 'celsius' ? 'C' : 'F'}
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 6, textTransform: 'capitalize' as const }}>
                    {weatherData.current.description}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                    Feels like {convertTemp(weatherData.current.feelsLike)}° · {weatherData.current.humidity}% humidity
                  </div>
                </div>

                {/* Right side */}
                <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 8 }}>
                  <span style={{ fontSize: isMobile ? 52 : 72, opacity: 0.9, lineHeight: 1 }}>{weatherEmoji(weatherData.current.icon)}</span>
                  {/* Stat chips — desktop only */}
                  {!isMobile && (
                    <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
                      <div style={{ textAlign: 'center' as const }}>
                        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>{weatherData.current.humidity}%</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Humidity</div>
                      </div>
                      {weatherData.current.windSpeed != null && (
                        <div style={{ textAlign: 'center' as const }}>
                          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>{weatherData.current.windSpeed} {tempUnit === 'celsius' ? 'm/s' : 'mph'}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Wind</div>
                        </div>
                      )}
                      {weatherData.current.uvIndex != null && (
                        <div style={{ textAlign: 'center' as const }}>
                          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)' }}>{weatherData.current.uvIndex} · {weatherData.current.uvIndex >= 6 ? 'High' : weatherData.current.uvIndex >= 3 ? 'Mod' : 'Low'}</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>UV Index</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── 2. HOURLY SECTION ──────────────────────────────── */}
              {isMobile ? (
                /* MOBILE: 5-cell hourly strip */
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `0.5px solid ${borderTertiary}` }}>
                  {weatherData.hourly.slice(0, 5).map((h, i) => {
                    const isNow = i === getNowIndex(5);
                    return (
                      <div key={i} style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: 9, color: isNow ? '#185FA5' : textSecondary, fontWeight: isNow ? 500 : 400 }}>
                          {isNow ? 'Now' : h.time}
                        </div>
                        <div style={{ fontSize: 18, margin: '3px 0' }}>{weatherEmoji(h.icon)}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: isNow ? '#185FA5' : textPrimary }}>
                          {convertTemp(h.temp)}°
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* DESKTOP: SVG curve graph */
                <div>
                  <div style={{ padding: '16px 28px 8px', fontSize: 10, fontWeight: 500, color: textSecondary, letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>
                    Hourly temperature
                  </div>
                  <svg
                    ref={curveRef}
                    width="100%"
                    height="80"
                    viewBox="0 0 900 80"
                    preserveAspectRatio="none"
                    style={{ display: 'block', padding: '0 28px' }}
                  />
                  {/* Icon row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 28px 0' }}>
                    {weatherData.hourly.slice(0, 8).map((h, i) => (
                      <div key={i} style={{ fontSize: 16, textAlign: 'center', flex: 1 }}>{weatherEmoji(h.icon)}</div>
                    ))}
                  </div>
                  {/* Temp row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 28px 0' }}>
                    {weatherData.hourly.slice(0, 8).map((h, i) => {
                      const isNow = i === getNowIndex(8);
                      return (
                        <div key={i} style={{ fontSize: 11, fontWeight: 500, color: isNow ? '#185FA5' : textPrimary, textAlign: 'center', flex: 1 }}>
                          {convertTemp(h.temp)}°
                        </div>
                      );
                    })}
                  </div>
                  {/* Time row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 28px 14px' }}>
                    {weatherData.hourly.slice(0, 8).map((h, i) => {
                      const isNow = i === getNowIndex(8);
                      return (
                        <div key={i} style={{ fontSize: 10, color: isNow ? '#185FA5' : textSecondary, fontWeight: isNow ? 500 : 400, textAlign: 'center', flex: 1 }}>
                          {isNow ? 'Now' : h.time}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Hairline divider ───────────────────────────────── */}
              <div style={{ height: 0.5, background: borderTertiary, margin: isMobile ? '0 16px' : '0 28px' }} />

              {/* ── 3. SEVEN-DAY FORECAST ──────────────────────────── */}
              <div style={{ padding: isMobile ? '8px 16px 4px' : '12px 28px 10px', fontSize: 10, fontWeight: 500, color: textSecondary, letterSpacing: '0.07em', textTransform: 'uppercase' as const }}>
                7-day forecast
              </div>

              {isMobile ? (
                /* MOBILE: 7-day rows */
                <div style={{ padding: '6px 16px 8px' }}>
                  {sevenDay.map((day, idx) => {
                    const hi = convertTemp(day.high);
                    const lo = convertTemp(day.low);
                    const isToday = idx === 0;
                    const leftPct = ((lo - weekMin) / totalRange) * 80;
                    const widthPct = Math.max(((hi - lo) / totalRange) * 80, 6);
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '7px 0', borderBottom: idx < sevenDay.length - 1 ? `0.5px solid ${borderTertiary}` : 'none' }}>
                        <span style={{ fontSize: 12, color: isToday ? textPrimary : textSecondary, fontWeight: isToday ? 700 : 400, width: 40 }}>
                          {isToday ? 'Today' : day.day}
                        </span>
                        <span style={{ fontSize: 16, width: 28, textAlign: 'center' }}>{weatherEmoji(day.icon)}</span>
                        <div style={{ flex: 1, height: 4, background: borderTertiary, borderRadius: 2, margin: '0 12px', position: 'relative' }}>
                          <div style={{ position: 'absolute', height: '100%', borderRadius: 2, top: 0, left: `${leftPct}%`, width: `${widthPct}%`, background: barColor(hi) }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: textPrimary, width: 64, textAlign: 'right' }}>
                          {hi}° <span style={{ fontWeight: 400, color: textSecondary }}>{lo}°</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* DESKTOP: 7-day grid */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, padding: '0 28px 16px' }}>
                  {sevenDay.map((day, idx) => {
                    const hi = convertTemp(day.high);
                    const lo = convertTemp(day.low);
                    const isToday = idx === 0;
                    const leftPct = ((lo - weekMin) / totalRange) * 80;
                    const widthPct = Math.max(((hi - lo) / totalRange) * 80, 6);
                    return (
                      <div key={idx} style={{
                        textAlign: 'center',
                        padding: '10px 6px',
                        border: `0.5px solid ${isToday ? '#185FA5' : borderTertiary}`,
                        borderRadius: 8,
                        background: isToday ? '#E6F1FB' : bgSecondary,
                      }}>
                        <div style={{ fontSize: 11, color: isToday ? '#185FA5' : textSecondary, fontWeight: isToday ? 500 : 400 }}>
                          {isToday ? 'Today' : day.day}
                        </div>
                        <div style={{ fontSize: 10, color: isToday ? '#185FA5' : textSecondary, marginTop: 1 }}>
                          {day.date}
                        </div>
                        <div style={{ fontSize: 20, margin: '6px 0' }}>{weatherEmoji(day.icon)}</div>
                        {/* Range bar */}
                        <div style={{ height: 4, background: borderTertiary, borderRadius: 2, margin: '4px 8px', position: 'relative' }}>
                          <div style={{ position: 'absolute', height: '100%', borderRadius: 2, top: 0, left: `${leftPct}%`, width: `${widthPct}%`, background: barColor(hi) }} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: isToday ? '#185FA5' : textPrimary, marginTop: 5 }}>
                          {hi}°
                        </div>
                        <div style={{ fontSize: 11, color: textSecondary }}>{lo}°</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default WeatherWidget;
