/**
 * Astrology Widget — Home page collapsible section
 *
 * Uses FreeAstroAPI (server-proxied) for:
 *   - Natal chart (cached forever in localStorage — immutable)
 *   - Daily personal horoscope (cached per day in sessionStorage)
 *
 * Birth data comes from UserSettings.birthData.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getUserSettings } from '../storage';
import { useTheme } from '../contexts/ThemeContext';
import { perfStart } from '../utils/perfLogger';

/* ── Sign emoji + symbols ──────────────────────────────────────── */
const SIGN_EMOJI: Record<string, string> = {
  aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋',
  leo: '♌', virgo: '♍', libra: '♎', scorpio: '♏',
  sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓',
};
const SIGN_FULL: Record<string, string> = {
  Ari: 'Aries', Tau: 'Taurus', Gem: 'Gemini', Can: 'Cancer',
  Leo: 'Leo', Vir: 'Virgo', Lib: 'Libra', Sco: 'Scorpio',
  Sag: 'Sagittarius', Cap: 'Capricorn', Aqu: 'Aquarius', Pis: 'Pisces',
};
const signEmoji = (short: string) => {
  const full = SIGN_FULL[short] || short;
  return SIGN_EMOJI[full.toLowerCase()] || '⭐';
};
const signName = (short: string) => SIGN_FULL[short] || short;

/* ── Cache keys ────────────────────────────────────────────────── */
const NATAL_CACHE_KEY = 'astro_natal_cache';
const DAILY_CACHE_KEY = 'astro_daily_cache';
const MOON_CACHE_KEY = 'astro_moon_cache';

function getCachedNatal(): any | null {
  try { const r = localStorage.getItem(NATAL_CACHE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function setCachedNatal(d: any) {
  try { localStorage.setItem(NATAL_CACHE_KEY, JSON.stringify(d)); } catch { /* ignore */ }
}
function getDayCached(key: string): any | null {
  try {
    const r = localStorage.getItem(key);
    if (!r) return null;
    const parsed = JSON.parse(r);
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) { localStorage.removeItem(key); return null; }
    return parsed.data;
  } catch { return null; }
}
function setDayCached(key: string, d: any) {
  try {
    localStorage.setItem(key, JSON.stringify({ data: d, date: new Date().toISOString().slice(0, 10) }));
  } catch { /* ignore */ }
}

/* Moon phase emoji */
function moonPhaseEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('new')) return '🌑';
  if (n.includes('waxing crescent')) return '🌒';
  if (n.includes('first quarter')) return '🌓';
  if (n.includes('waxing gibbous')) return '🌔';
  if (n.includes('full')) return '🌕';
  if (n.includes('waning gibbous')) return '🌖';
  if (n.includes('last quarter') || n.includes('third quarter')) return '🌗';
  if (n.includes('waning crescent')) return '🌘';
  return '🌙';
}

/* ── Score bar component ───────────────────────────────────────── */
function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', width: 52, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, width: 28, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════════ */
const AstroWidget: React.FC = () => {
  const { theme } = useTheme();
  const isWP = theme.id === 'warm-paper';
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [birthData, setBirthData] = useState<any>(null);
  const [natalData, setNatalData] = useState<any>(() => getCachedNatal());
  const [dailyData, setDailyData] = useState<any>(() => getDayCached(DAILY_CACHE_KEY));
  const [moonData, setMoonData] = useState<any>(() => getDayCached(MOON_CACHE_KEY));
  const moonAttempted = React.useRef(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showNatal, setShowNatal] = useState(false);
  const [showMoon, setShowMoon] = useState(false);
  const fetchingRef = React.useRef(false);
  const failedRef = React.useRef(false);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await getUserSettings();
        if (s.birthData?.year && s.birthData?.month && s.birthData?.day && s.birthData?.city) {
          setBirthData(s.birthData);
        }
      } catch { /* not signed in */ }
    })();
  }, []);

  const fetchAstro = useCallback(async () => {
    if (!birthData || fetchingRef.current || failedRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    const endTotal = perfStart('AstroWidget', 'fetchAll (total)');
    try {
      const bd = birthData;

      const rateDelay = () => new Promise(r => setTimeout(r, 600));

      if (!natalData) {
        const endNatal = perfStart('AstroWidget', 'natal API');
        const r = await fetch('/api/astro?action=natal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bd) });
        endNatal();
        if (!r.ok) throw new Error(`Natal chart: ${r.status}`);
        const d = await r.json();
        setNatalData(d);
        setCachedNatal(d);
      }

      if (!dailyData) {
        await rateDelay();
        const endDaily = perfStart('AstroWidget', 'daily API');
        const today = new Date().toISOString().slice(0, 10);
        const r = await fetch('/api/astro?action=daily', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...bd, date: today }) });
        endDaily();
        if (!r.ok) throw new Error(`Daily horoscope: ${r.status}`);
        const d = await r.json();
        setDailyData(d);
        setDayCached(DAILY_CACHE_KEY, d);
      }

      if (!moonData && !moonAttempted.current) {
        await rateDelay();
        moonAttempted.current = true;
        try {
          const endMoon = perfStart('AstroWidget', 'moon API');
          const city = bd.city || '';
          const r = await fetch(`/api/astro?action=moon&city=${encodeURIComponent(city)}`);
          endMoon();
          if (r.ok) {
            const d = await r.json();
            setMoonData(d);
            setDayCached(MOON_CACHE_KEY, d);
          } else {
            console.warn(`[AstroWidget] Moon API returned ${r.status} — skipping`);
          }
        } catch (moonErr) {
          console.warn('[AstroWidget] Moon fetch failed, continuing without it', moonErr);
        }
      }
    } catch (e: any) {
      console.error('[AstroWidget]', e);
      setError(e.message || 'Failed to fetch astrology data');
      failedRef.current = true;
    } finally {
      endTotal();
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [birthData, natalData, dailyData, moonData]);

  useEffect(() => {
    if (isExpanded && birthData && (!natalData || !dailyData) && !isLoading && !fetchingRef.current && !failedRef.current) fetchAstro();
  }, [isExpanded, birthData, natalData, dailyData, isLoading, fetchAstro]);

  if (!birthData) {
    return (
      <div style={{ marginTop: isWP ? '0.75rem' : '2rem', padding: '1rem', background: isWP ? '#fff' : 'rgba(255,255,255,0.1)', borderRadius: 12, border: isWP ? '1px solid #E5E3DC' : '1px solid rgba(255,255,255,0.2)', textAlign: 'center', color: isWP ? '#1a1a1a' : 'white' }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>🔮 Set your birth data in Settings to see your horoscope</p>
      </div>
    );
  }

  /* ── derived data ──────────────────────────────────────────────── */
  const daily = dailyData?.data;
  const scores = daily?.scores;
  const content = daily?.content;
  const astro = daily?.astro;
  const personal = daily?.personal;

  const sunSign = natalData?.planets?.find((p: any) => p.id === 'sun');
  const moonSign = natalData?.planets?.find((p: any) => p.id === 'moon');
  const ascSign = natalData?.angles_details?.asc;
  const sunSignName = sunSign ? signName(sunSign.sign) : '';

  const moonPhaseLabel = moonData?.phase?.name ? `${moonPhaseEmoji(moonData.phase.name)} ${moonData.phase.name}` : '';
  const headerSummary = sunSignName
    ? `${signEmoji(sunSign?.sign)} ${sunSignName}${moonPhaseLabel ? ` · ${moonPhaseLabel}` : ''}`
    : '';
  const scoreColor = (v: number) => v >= 75 ? '#34D399' : v >= 50 ? '#FBBF24' : '#F87171';

  return (
    <div style={{
      marginTop: isWP ? '0.75rem' : '2rem',
      background: isWP ? '#ffffff' : 'rgba(255,255,255,0.95)',
      borderRadius: 12,
      border: isWP ? '1px solid #E5E3DC' : '1px solid rgba(0,0,0,0.1)',
      overflow: 'hidden',
    }}>
      {/* ── Accordion Header ──────────────────────────────────────── */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: isWP ? '10px 14px' : '1rem 1.5rem',
          background: isWP ? '#ffffff' : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
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
              <span style={{ fontSize: 14 }}>🔮</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>Horoscope</span>
              {!isExpanded && headerSummary ? (
                <span style={{ fontSize: 11, color: '#555', fontWeight: 400, marginLeft: 'auto' }}>
                  {headerSummary}{scores ? ` · ${scores.overall}/100` : ''}
                </span>
              ) : null}
            </div>
            <span style={{ fontSize: 10, color: '#ccc', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🔮</span>
              <span>Horoscope</span>
            </div>
            <span style={{ fontSize: '1.25rem' }}>{isExpanded ? '▲' : '▼'}</span>
          </>
        )}
      </button>

      {/* ── Expanded Content ─────────────────────────────────────── */}
      {isExpanded && (
        <div>
          {error && (
            <div style={{ padding: 16, background: '#fee2e2', borderRadius: 8, color: '#dc2626', margin: 16 }}>
              <strong>⚠️</strong> {error}
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && !dailyData && (
            <div style={{ background: '#1e1b4b', padding: isMobile ? 16 : '20px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 120, height: 48, background: 'rgba(255,255,255,0.08)', borderRadius: 8 }} />
              <div style={{ width: 180, height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
              <div style={{ width: 140, height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
            </div>
          )}

          {(dailyData || natalData) && !isLoading && (
            <>
              {/* ── HERO ───────────────────────────────────────────── */}
              <div style={{
                padding: isMobile ? '16px 16px 14px' : '20px 28px 18px',
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
                position: 'relative', overflow: 'hidden',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}>
                {/* Decorative circles */}
                <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(139,92,246,0.08)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -20, left: 40, width: 80, height: 80, borderRadius: '50%', background: 'rgba(139,92,246,0.06)', pointerEvents: 'none' }} />

                {/* Left column */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Date & theme */}
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    {content?.theme ? ` · ${content.theme}` : ''}
                  </div>

                  {/* Sign + overall score */}
                  {sunSign && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: isMobile ? 36 : 48, lineHeight: 1 }}>{signEmoji(sunSign.sign)}</span>
                      <div>
                        <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 300, color: '#fff', lineHeight: 1 }}>
                          {signName(sunSign.sign)}
                        </div>
                        {moonSign && (
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                            Moon in {signName(moonSign.sign)} {signEmoji(moonSign.sign)}
                            {ascSign ? ` · Asc ${signName(ascSign.sign)} ${signEmoji(ascSign.sign)}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Content text */}
                  {content?.text && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, maxWidth: 520 }}>
                      {content.text.length > 250 ? content.text.slice(0, 250) + '…' : content.text}
                    </div>
                  )}

                  {/* Keywords */}
                  {content?.keywords?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {content.keywords.slice(0, 5).map((kw: string, i: number) => (
                        <span key={i} style={{ fontSize: 9, background: 'rgba(139,92,246,0.25)', color: 'rgba(255,255,255,0.8)', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>{kw}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right column — scores */}
                {scores && !isMobile && (
                  <div style={{ width: 180, flexShrink: 0, marginLeft: 20 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>Today's Scores</div>
                    <div style={{ textAlign: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 36, fontWeight: 300, color: scoreColor(scores.overall) }}>{scores.overall}</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>/100</span>
                    </div>
                    <ScoreBar label="Love" value={scores.love} color="#F472B6" />
                    <ScoreBar label="Career" value={scores.career} color="#60A5FA" />
                    <ScoreBar label="Money" value={scores.money} color="#34D399" />
                    <ScoreBar label="Health" value={scores.health} color="#FBBF24" />
                  </div>
                )}
              </div>

              {/* Mobile scores — below hero */}
              {scores && isMobile && (
                <div style={{ padding: '12px 16px', background: isWP ? '#f5f3ef' : '#f9fafb', borderBottom: `0.5px solid ${theme.colors.cardBorder}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>Today's Scores</span>
                    <span style={{ fontSize: 20, fontWeight: 600, color: scoreColor(scores.overall) }}>{scores.overall}<span style={{ fontSize: 11, color: theme.colors.textLight }}>/100</span></span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                    {[
                      { label: '❤️ Love', value: scores.love, color: '#EC4899' },
                      { label: '💼 Career', value: scores.career, color: '#3B82F6' },
                      { label: '💰 Money', value: scores.money, color: '#10B981' },
                      { label: '🏃 Health', value: scores.health, color: '#F59E0B' },
                    ].map(s => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: theme.colors.text, width: 70 }}>{s.label}</span>
                        <div style={{ flex: 1, height: 5, background: theme.colors.cardBorder, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${s.value}%`, height: '100%', background: s.color, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: s.color, width: 22, textAlign: 'right' }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Insights & Transits ────────────────────────────── */}
              {(content?.supporting_insights?.length > 0 || personal?.transits_top?.length > 0 || personal?.focus_areas?.length > 0) && (
                <div style={{ padding: isMobile ? '12px 16px' : '16px 28px', borderBottom: `0.5px solid ${theme.colors.cardBorder}` }}>
                  {/* Focus areas */}
                  {personal?.focus_areas?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500, marginRight: 4 }}>Focus:</span>
                      {personal.focus_areas.map((f: string, i: number) => (
                        <span key={i} style={{ fontSize: 10, background: isWP ? '#f0ede8' : '#ede9fe', color: isWP ? '#1a1a1a' : '#5b21b6', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>{f}</span>
                      ))}
                    </div>
                  )}

                  {/* Moon + phase */}
                  {astro && (
                    <div style={{ fontSize: 11, color: theme.colors.textLight, marginBottom: 10 }}>
                      {astro.highlights?.map((h: any, i: number) => (
                        <span key={i}>{i > 0 ? ' · ' : ''}{h.label}</span>
                      ))}
                    </div>
                  )}

                  {/* Supporting insights */}
                  {content?.supporting_insights?.map((ins: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: theme.colors.text, lineHeight: 1.5, marginBottom: 6, paddingLeft: 12, borderLeft: `2px solid ${isWP ? '#e8c547' : '#8B5CF6'}` }}>
                      {ins}
                    </div>
                  ))}

                  {/* Top transits */}
                  {personal?.transits_top?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 10, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500, marginBottom: 6 }}>Active Transits</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {personal.transits_top.slice(0, 3).map((t: any, i: number) => (
                          <div key={i} style={{ background: isWP ? '#f5f3ef' : '#faf5ff', borderRadius: 8, padding: '8px 12px', border: `0.5px solid ${theme.colors.cardBorder}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: theme.colors.text }}>
                                {t.transit_planet?.label} {t.aspect?.label} {t.natal_planet?.label}
                              </span>
                              <span style={{ fontSize: 9, color: theme.colors.textLight, background: isWP ? '#e8e5e0' : '#ede9fe', padding: '1px 6px', borderRadius: 6 }}>
                                {t.intensity || (t.orb_deg < 1 ? 'exact' : 'wide')}
                              </span>
                            </div>
                            {t.explanation?.main && (
                              <div style={{ fontSize: 11, color: theme.colors.textLight, lineHeight: 1.4 }}>
                                {t.explanation.main.length > 120 ? t.explanation.main.slice(0, 120) + '…' : t.explanation.main}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Moon Phase Section (collapsible) ──────────────── */}
              {moonData?.phase && (
                <div style={{ borderTop: `0.5px solid ${theme.colors.cardBorder}` }}>
                  <button
                    onClick={() => setShowMoon(!showMoon)}
                    style={{ width: '100%', padding: isMobile ? '8px 16px' : '10px 28px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 500, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Moon Phase</span>
                      <span style={{ fontSize: 12 }}>{moonPhaseEmoji(moonData.phase.name)}</span>
                      <span style={{ fontSize: 11, color: theme.colors.text }}>{moonData.phase.name}</span>
                      {moonData.zodiac && <span style={{ fontSize: 10, color: theme.colors.textLight }}>in {moonData.zodiac.sign} {signEmoji(moonData.zodiac.sign?.slice(0, 3))}</span>}
                    </div>
                    <span style={{ fontSize: 9, color: theme.colors.textLight, transition: 'transform 0.2s', transform: showMoon ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  </button>
                  {showMoon && (
                    <div style={{ padding: isMobile ? '0 16px 12px' : '0 28px 16px' }}>
                      {/* Phase details row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                        <div style={{ background: isWP ? '#f5f3ef' : '#f0f0ff', borderRadius: 8, padding: '8px 12px', border: `0.5px solid ${theme.colors.cardBorder}`, textAlign: 'center', minWidth: 80 }}>
                          <div style={{ fontSize: 28 }}>{moonPhaseEmoji(moonData.phase.name)}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.text, marginTop: 2 }}>{moonData.phase.name}</div>
                          <div style={{ fontSize: 10, color: theme.colors.textLight }}>
                            {Math.round(moonData.phase.illumination * 100)}% illuminated
                          </div>
                        </div>

                        {moonData.zodiac && (
                          <div style={{ background: isWP ? '#f5f3ef' : '#f0f0ff', borderRadius: 8, padding: '8px 12px', border: `0.5px solid ${theme.colors.cardBorder}`, textAlign: 'center', minWidth: 80 }}>
                            <div style={{ fontSize: 20 }}>{signEmoji(moonData.zodiac.sign?.slice(0, 3))}</div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.text, marginTop: 2 }}>Moon in {moonData.zodiac.sign}</div>
                            <div style={{ fontSize: 10, color: theme.colors.textLight }}>{moonData.zodiac.degree?.toFixed(1)}° {moonData.zodiac.zodiac_type}</div>
                          </div>
                        )}

                        <div style={{ background: isWP ? '#f5f3ef' : '#f0f0ff', borderRadius: 8, padding: '8px 12px', border: `0.5px solid ${theme.colors.cardBorder}`, minWidth: 100 }}>
                          <div style={{ fontSize: 10, color: theme.colors.textLight, marginBottom: 4 }}>Details</div>
                          <div style={{ fontSize: 10, color: theme.colors.text, lineHeight: 1.6 }}>
                            Age: {moonData.phase.age_days?.toFixed(1)} days<br />
                            Distance: {moonData.phase.distance_km ? `${(moonData.phase.distance_km / 1000).toFixed(0)}k km` : '—'}<br />
                            {moonData.phase.is_waxing ? '↑ Waxing' : '↓ Waning'}
                          </div>
                        </div>
                      </div>

                      {/* Traditional moon name */}
                      {moonData.traditional_moon?.name && (
                        <div style={{ fontSize: 11, color: theme.colors.text, marginBottom: 8 }}>
                          <strong>{moonData.traditional_moon.name}</strong>
                          <span style={{ color: theme.colors.textLight }}> ({moonData.traditional_moon.naming_system?.replace(/_/g, ' ')})</span>
                        </div>
                      )}

                      {/* Special moon labels */}
                      {moonData.special_moon?.labels?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                          {moonData.special_moon.labels.map((l: string, i: number) => (
                            <span key={i} style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{l}</span>
                          ))}
                        </div>
                      )}

                      {/* Eclipse info */}
                      {moonData.eclipse?.is_eclipse && (
                        <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginBottom: 8 }}>
                          🌑 {moonData.eclipse.type} lunar eclipse{moonData.eclipse.is_blood_moon ? ' (Blood Moon)' : ''} — {moonData.eclipse.date ? new Date(moonData.eclipse.date).toLocaleDateString() : ''}
                          {moonData.eclipse.visibility && <span style={{ fontWeight: 400, color: theme.colors.textLight }}> · Visible: {moonData.eclipse.visibility}</span>}
                        </div>
                      )}

                      {/* Upcoming phases */}
                      {moonData.next_phases && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500, marginBottom: 4 }}>Upcoming Phases</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                            {[
                              { emoji: '🌗', label: 'Last Qtr', date: moonData.next_phases.last_quarter },
                              { emoji: '🌑', label: 'New Moon', date: moonData.next_phases.new_moon },
                              { emoji: '🌓', label: 'First Qtr', date: moonData.next_phases.first_quarter },
                              { emoji: '🌕', label: 'Full Moon', date: moonData.next_phases.full_moon },
                            ].filter(p => p.date).map((p, i) => (
                              <div key={i} style={{ textAlign: 'center', fontSize: 10, color: theme.colors.text }}>
                                <div style={{ fontSize: 14 }}>{p.emoji}</div>
                                <div style={{ fontWeight: 500, marginTop: 1 }}>{p.label}</div>
                                <div style={{ color: theme.colors.textLight, fontSize: 9 }}>{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Forecast */}
                      {moonData.forecast && (
                        <div style={{ fontSize: 10, color: theme.colors.textLight, lineHeight: 1.6 }}>
                          {moonData.forecast.days_until_full_moon != null && <span>Full moon in {Math.round(moonData.forecast.days_until_full_moon)} days · </span>}
                          {moonData.forecast.days_until_new_moon != null && <span>New moon in {Math.round(moonData.forecast.days_until_new_moon)} days</span>}
                          {moonData.forecast.next_special_moon?.type && <span> · Next {moonData.forecast.next_special_moon.type} in {Math.round(moonData.forecast.next_special_moon.days_until)} days</span>}
                          {moonData.forecast.next_eclipse?.type && <span> · Next eclipse in {Math.round(moonData.forecast.next_eclipse.days_until)} days</span>}
                        </div>
                      )}

                      {/* Interpretation */}
                      {moonData.interpretation?.body && (
                        <div style={{ marginTop: 8, fontSize: 11, color: theme.colors.text, lineHeight: 1.5, paddingLeft: 12, borderLeft: `2px solid ${isWP ? '#e8c547' : '#8B5CF6'}` }}>
                          {moonData.interpretation.body.length > 300 ? moonData.interpretation.body.slice(0, 300) + '…' : moonData.interpretation.body}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Natal Chart Snapshot (collapsible) ─────────────── */}
              {natalData?.planets?.length > 0 && (
                <div style={{ borderTop: `0.5px solid ${theme.colors.cardBorder}` }}>
                  <button
                    onClick={() => setShowNatal(!showNatal)}
                    style={{ width: '100%', padding: isMobile ? '8px 16px' : '10px 28px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 500, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Natal Chart</span>
                    <span style={{ fontSize: 9, color: theme.colors.textLight, transition: 'transform 0.2s', transform: showNatal ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                  </button>
                  {showNatal && (
                    <div style={{ padding: isMobile ? '0 16px 12px' : '0 28px 16px' }}>
                      {/* Key placements row */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        {(() => {
                          const find = (id: string) => natalData.planets.find((p: any) => p.id === id);
                          return [
                            sunSign && { label: 'Sun', sign: sunSign.sign, house: sunSign.house, retro: sunSign.retrograde },
                            moonSign && { label: 'Moon', sign: moonSign.sign, house: moonSign.house, retro: moonSign.retrograde },
                            ascSign && { label: 'Asc', sign: ascSign.sign, house: null },
                            find('mercury') && { label: 'Mercury', sign: find('mercury').sign, house: find('mercury').house, retro: find('mercury').retrograde },
                            find('venus') && { label: 'Venus', sign: find('venus').sign, house: find('venus').house, retro: find('venus').retrograde },
                            find('mars') && { label: 'Mars', sign: find('mars').sign, house: find('mars').house, retro: find('mars').retrograde },
                            find('jupiter') && { label: 'Jupiter', sign: find('jupiter').sign, house: find('jupiter').house, retro: find('jupiter').retrograde },
                            find('saturn') && { label: 'Saturn', sign: find('saturn').sign, house: find('saturn').house, retro: find('saturn').retrograde },
                            find('chiron') && { label: 'Chiron', sign: find('chiron').sign, house: find('chiron').house, retro: find('chiron').retrograde },
                            find('north_node') && { label: 'N.Node', sign: find('north_node').sign, house: find('north_node').house, retro: find('north_node').retrograde },
                          ];
                        })().filter(Boolean).map((p: any, i: number) => (
                          <div key={i} style={{ background: isWP ? '#f5f3ef' : '#faf5ff', border: `0.5px solid ${theme.colors.cardBorder}`, borderRadius: 8, padding: '6px 10px', textAlign: 'center', minWidth: 60 }}>
                            <div style={{ fontSize: 9, color: theme.colors.textLight, marginBottom: 2 }}>{p.label}</div>
                            <div style={{ fontSize: 16, lineHeight: 1 }}>{signEmoji(p.sign)}</div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: theme.colors.text, marginTop: 2 }}>{signName(p.sign)}</div>
                            {p.house != null && <div style={{ fontSize: 9, color: theme.colors.textLight }}>House {p.house}</div>}
                            {p.retro && <div style={{ fontSize: 8, color: '#EF4444', fontWeight: 600 }}>℞ Retro</div>}
                          </div>
                        ))}
                      </div>

                      {/* Major aspects */}
                      {natalData.aspects?.filter((a: any) => a.is_major).length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500, marginBottom: 4 }}>Major Aspects</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {natalData.aspects.filter((a: any) => a.is_major).slice(0, 8).map((a: any, i: number) => (
                              <span key={i} style={{ fontSize: 9, background: isWP ? '#f0ede8' : '#ede9fe', color: isWP ? '#1a1a1a' : '#5b21b6', padding: '2px 6px', borderRadius: 6 }}>
                                {a.p1} {a.type} {a.p2} ({a.orb?.toFixed(1)}°)
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Interpretation snippets — core_self + mind + karmic */}
                      {[
                        ...(natalData.interpretation?.sections?.core_self?.slice(0, 2) || []),
                        ...(natalData.interpretation?.sections?.mind?.slice(0, 1) || []),
                        ...(natalData.interpretation?.sections?.karmic_healing?.slice(0, 1) || []),
                      ].map((s: any, i: number) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.text, marginBottom: 2 }}>{s.title}</div>
                          <div style={{ fontSize: 11, color: theme.colors.textLight, lineHeight: 1.5 }}>
                            {s.body?.length > 200 ? s.body.slice(0, 200) + '…' : s.body}
                          </div>
                        </div>
                      ))}

                      {/* Stelliums */}
                      {natalData.stelliums?.signs?.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 11, color: theme.colors.textLight }}>
                          <strong style={{ color: theme.colors.text }}>Stelliums:</strong>{' '}
                          {natalData.stelliums.signs.map((s: any) => `${s.count} planets in ${s.sign_id ? (s.sign_id.charAt(0).toUpperCase() + s.sign_id.slice(1)) : 'unknown'} (${s.bodies?.join(', ')})`).join('; ')}
                        </div>
                      )}

                      {/* Confidence */}
                      {natalData.confidence && (
                        <div style={{ marginTop: 6, fontSize: 10, color: theme.colors.textLight }}>
                          Confidence: {natalData.confidence.overall || 'n/a'}
                          {natalData.confidence.overall !== 'high' && ' — add birth time in Settings for higher accuracy'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action bar */}
              <div style={{ padding: isMobile ? '10px 16px 14px' : '10px 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: `0.5px solid ${theme.colors.cardBorder}` }}>
                <span style={{ fontSize: 9, color: theme.colors.textLight }}>
                  Cached today · natal in localStorage · daily/moon refresh daily
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      localStorage.removeItem(DAILY_CACHE_KEY);
                      localStorage.removeItem(MOON_CACHE_KEY);
                      moonAttempted.current = false;
                      failedRef.current = false;
                      setError(null);
                      setDailyData(null);
                      setMoonData(null);
                    }}
                    style={{ fontSize: 10, color: isWP ? '#92400e' : '#a78bfa', background: isWP ? '#fef3c7' : 'rgba(139,92,246,0.15)', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}
                  >
                    ↻ Refresh
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      localStorage.removeItem(NATAL_CACHE_KEY);
                      localStorage.removeItem(DAILY_CACHE_KEY);
                      localStorage.removeItem(MOON_CACHE_KEY);
                      moonAttempted.current = false;
                      failedRef.current = false;
                      setError(null);
                      setNatalData(null);
                      setDailyData(null);
                      setMoonData(null);
                    }}
                    style={{ fontSize: 10, color: '#dc2626', background: '#fee2e2', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}
                  >
                    Clear all
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AstroWidget;
