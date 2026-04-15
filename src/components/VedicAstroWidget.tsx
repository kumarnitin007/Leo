/**
 * Vedic Astrology Widget — Kundali (D1/D9/D10), Shadbala, Ashtakavarga
 * Cached in localStorage (immutable natal data).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getUserSettings } from '../storage';
import { useTheme } from '../contexts/ThemeContext';
import { perfStart } from '../utils/perfLogger';
import { saveAstroCache, getAstroCache, getLastSuccessfulAstroCache } from '../services/astroCacheService';

const CACHE_KEY = 'astro_vedic_cache';
const NATAL_CACHE_KEY = 'astro_natal_cache';
const SIGN_NAMES = ['', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const SIGN_SHORT = ['', 'Ari', 'Tau', 'Gem', 'Can', 'Leo', 'Vir', 'Lib', 'Sco', 'Sag', 'Cap', 'Aqu', 'Pis'];
const SIGN_EMOJI: Record<string, string> = { Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍', Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓' };

function getCached(): any {
  try { const r = localStorage.getItem(CACHE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function setCache(d: any) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch { /* */ }
}

/* ── South Indian Kundali Grid ────────────────────────────────── */
// Classic 4×4 grid with houses numbered 1-12 in South Indian style
// House positions map to grid cells (row, col) — sign-based layout
const SOUTH_INDIAN_CELLS: Array<{ row: number; col: number; signNum: number }> = [
  { row: 0, col: 1, signNum: 12 }, { row: 0, col: 2, signNum: 1 },  { row: 0, col: 3, signNum: 2 },
  { row: 1, col: 3, signNum: 3 },  { row: 2, col: 3, signNum: 4 },  { row: 3, col: 3, signNum: 5 },
  { row: 3, col: 2, signNum: 6 },  { row: 3, col: 1, signNum: 7 },  { row: 3, col: 0, signNum: 8 },
  { row: 2, col: 0, signNum: 9 },  { row: 1, col: 0, signNum: 10 }, { row: 0, col: 0, signNum: 11 },
];

function KundaliGrid({ planets, ascSign, title, isWP, theme, isMobile }: {
  planets: any[]; ascSign: number; title: string; isWP: boolean; theme: any; isMobile: boolean;
}) {
  // Build sign → planets map
  const signPlanets = useMemo(() => {
    const m: Record<number, string[]> = {};
    for (let i = 1; i <= 12; i++) m[i] = [];
    (planets || []).forEach((p: any) => {
      const sn = p.sign_num || SIGN_NAMES.indexOf(p.sign);
      if (sn >= 1 && sn <= 12) {
        const label = (p.name || p.id || '').slice(0, 2);
        m[sn].push(label);
      }
    });
    return m;
  }, [planets]);

  const cellSize = isMobile ? 68 : 85;
  const gridSize = cellSize * 4;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{title}</div>
      <div style={{ position: 'relative', width: gridSize, height: gridSize, border: `1.5px solid ${isWP ? '#c8c0b0' : '#d1d5db'}` }}>
        {SOUTH_INDIAN_CELLS.map((cell) => {
          const isAsc = cell.signNum === ascSign;
          const pList = signPlanets[cell.signNum] || [];
          return (
            <div
              key={cell.signNum}
              style={{
                position: 'absolute',
                left: cell.col * cellSize,
                top: cell.row * cellSize,
                width: cellSize,
                height: cellSize,
                border: `0.5px solid ${isWP ? '#d5cfc5' : '#e5e7eb'}`,
                background: isAsc ? (isWP ? '#fef3c7' : '#ede9fe') : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 2,
              }}
            >
              <div style={{ fontSize: 8, color: theme.colors.textLight, fontWeight: isAsc ? 700 : 400 }}>
                {SIGN_SHORT[cell.signNum]}{isAsc ? ' ↑' : ''}
              </div>
              <div style={{ fontSize: isMobile ? 9 : 10, color: theme.colors.text, fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>
                {pList.join(' ')}
              </div>
            </div>
          );
        })}
        {/* Center area label */}
        <div style={{
          position: 'absolute',
          left: cellSize, top: cellSize,
          width: cellSize * 2, height: cellSize * 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `0.5px solid ${isWP ? '#d5cfc5' : '#e5e7eb'}`,
          background: isWP ? '#faf8f4' : '#f9fafb',
        }}>
          <span style={{ fontSize: 10, color: theme.colors.textLight, fontWeight: 500 }}>
            {title.replace('Chart', '').trim()}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Strength Bar ─────────────────────────────────────────────── */
function StrengthBar({ label, ratio, rating, isWP }: { label: string; ratio: number; rating: string; isWP: boolean }) {
  const pct = Math.min(ratio * 50, 100); // ratio 2.0 = 100%
  const color = rating === 'Strong' ? '#10B981' : rating === 'Medium' ? '#F59E0B' : '#EF4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 10, width: 52, flexShrink: 0, fontWeight: 500 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: isWP ? '#f0ede8' : '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontSize: 9, color, fontWeight: 600, width: 50, textAlign: 'right' }}>{ratio?.toFixed(2)}x</span>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */
const VedicAstroWidget: React.FC = () => {
  const { theme } = useTheme();
  const isWP = theme.id === 'warm-paper';
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [birthData, setBirthData] = useState<any>(null);
  const [vedic, setVedic] = useState<any>(() => getCached());
  const [natalData, setNatalData] = useState<any>(() => {
    try { const r = localStorage.getItem(NATAL_CACHE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  });
  const [activeTab, setActiveTab] = useState<'kundali' | 'shadbala' | 'ashtakavarga'>('kundali');
  const [cachedFromDate, setCachedFromDate] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
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
      } catch { /* */ }
    })();
  }, []);

  const fetchNatalFallback = useCallback(async () => {
    if (natalData) return;
    try {
      const cached = await getAstroCache('natal', birthData);
      if (cached) { setNatalData(cached.data); return; }

      const nr = await fetch('/api/astro?action=natal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(birthData),
      });
      if (nr.ok) {
        const nd = await nr.json();
        setNatalData(nd);
        try { localStorage.setItem(NATAL_CACHE_KEY, JSON.stringify(nd)); } catch { /* */ }
        saveAstroCache('natal', birthData, nd);
      }
    } catch { /* best-effort */ }
  }, [birthData, natalData]);

  const fetchVedic = useCallback(async () => {
    if (!birthData || fetchingRef.current || failedRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    setCachedFromDate(null);
    const endTotal = perfStart('VedicAstroWidget', 'vedic API');
    try {
      const r = await fetch('/api/astro?action=vedic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(birthData),
      });
      if (!r.ok) throw new Error(`Vedic API: ${r.status}`);
      const d = await r.json();
      setVedic(d);
      setCache(d);
      saveAstroCache('vedic', birthData, d);

      if (!d?.vargas?.vargas?.D1) await fetchNatalFallback();
    } catch (e: any) {
      console.error('[VedicAstro]', e);

      const fallback = await getLastSuccessfulAstroCache('vedic');
      if (fallback?.data) {
        setVedic(fallback.data);
        setCache(fallback.data);
        const dt = new Date(fallback.fetchedAt);
        setCachedFromDate(dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
      } else {
        setError(e.message);
        failedRef.current = true;
      }
      await fetchNatalFallback();
    } finally {
      endTotal();
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [birthData, natalData, fetchNatalFallback]);

  useEffect(() => {
    if (isExpanded && birthData && !vedic && !isLoading && !fetchingRef.current && !failedRef.current) fetchVedic();
  }, [isExpanded, birthData, vedic, isLoading, fetchVedic]);

  if (!birthData) return null;

  const vargas = vedic?.vargas?.vargas;
  const shadbala = vedic?.strength?.shadbala;
  const ashtak = vedic?.strength?.ashtakavarga;
  const vargasError = vedic?.vargasError;
  const strengthError = vedic?.strengthError;

  const d1 = vargas?.D1;
  const d9 = vargas?.D9;
  const d10 = vargas?.D10;

  const d1Asc = d1?.ascendant?.sign_num || 1;
  const d9Asc = d9?.ascendant?.sign_num || 1;
  const d10Asc = d10?.ascendant?.sign_num || 1;

  const natalPlanets = natalData?.planets;
  const natalInterpretation = natalData?.interpretation?.sections;

  const tabs = [
    { id: 'kundali' as const, label: 'Kundali', icon: '🕉️' },
    { id: 'shadbala' as const, label: 'Shadbala', icon: '💪' },
    { id: 'ashtakavarga' as const, label: 'Ashtakavarga', icon: '🔢' },
  ];

  return (
    <div style={{
      marginTop: isWP ? '0.75rem' : '1rem',
      background: isWP ? '#ffffff' : 'rgba(255,255,255,0.95)',
      borderRadius: 12,
      border: isWP ? '1px solid #E5E3DC' : '1px solid rgba(0,0,0,0.1)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%', padding: isWP ? '10px 16px' : '12px 16px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <span style={{ fontSize: 14 }}>🕉️</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: theme.colors.text }}>Vedic Astrology</span>
          {!isExpanded && vedic && (
            <span style={{ fontSize: 11, color: theme.colors.textLight, fontWeight: 400, marginLeft: 'auto' }}>
              Kundali · Shadbala · Ashtakavarga
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: '#ccc', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
      </button>

      {isExpanded && (
        <div style={{ borderTop: `0.5px solid ${theme.colors.cardBorder}` }}>
          {error && <div style={{ padding: 12, color: '#dc2626', fontSize: 11 }}>⚠️ {error}</div>}
          {cachedFromDate && (
            <div style={{ padding: '8px 16px', fontSize: 11, color: '#92400e', background: isWP ? '#fffbeb' : '#fefce8', borderBottom: `0.5px solid ${theme.colors.cardBorder}` }}>
              Current API call failed — showing data from {cachedFromDate}
            </div>
          )}

          {isLoading && !vedic && !natalData && (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🕉️</div>
              <div style={{ fontSize: 11, color: theme.colors.textLight }}>Calculating Vedic chart…</div>
            </div>
          )}

          {(vedic || natalData) && (
            <>
              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: `0.5px solid ${theme.colors.cardBorder}`, padding: '0 16px' }}>
                {tabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    style={{
                      padding: '8px 12px', fontSize: 11, fontWeight: activeTab === t.id ? 700 : 400,
                      color: activeTab === t.id ? (isWP ? '#92400e' : '#6366f1') : theme.colors.textLight,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      borderBottom: activeTab === t.id ? `2px solid ${isWP ? '#d97706' : '#6366f1'}` : '2px solid transparent',
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* ── Kundali Tab ────────────────────────────────── */}
              {activeTab === 'kundali' && (
                <div style={{ padding: isMobile ? '12px 16px' : '16px 20px' }}>
                  {(d1 || d9 || d10) ? (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMobile ? 12 : 20 }}>
                        {d1 && <KundaliGrid planets={d1.planets} ascSign={d1Asc} title="D1 Rashi Chart" isWP={isWP} theme={theme} isMobile={isMobile} />}
                        {d9 && <KundaliGrid planets={d9.planets} ascSign={d9Asc} title="D9 Navamsha" isWP={isWP} theme={theme} isMobile={isMobile} />}
                        {d10 && <KundaliGrid planets={d10.planets} ascSign={d10Asc} title="D10 Dashamsha" isWP={isWP} theme={theme} isMobile={isMobile} />}
                      </div>

                      {d1?.planets?.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 10, fontWeight: 500, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                            Rashi Placements (Sidereal)
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 4 }}>
                            {d1.planets.map((p: any, i: number) => (
                              <div key={i} style={{
                                fontSize: 10, padding: '4px 8px', borderRadius: 6,
                                background: isWP ? '#faf8f4' : '#f9fafb',
                                border: `0.5px solid ${theme.colors.cardBorder}`,
                                display: 'flex', justifyContent: 'space-between',
                              }}>
                                <span style={{ fontWeight: 600, color: theme.colors.text }}>{p.name}</span>
                                <span style={{ color: theme.colors.textLight }}>
                                  {SIGN_EMOJI[p.sign] || ''} {p.sign} {p.degree?.toFixed(1)}°
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      {/* Vedic vargas unavailable — show natal fallback */}
                      {vargasError && (
                        <div style={{
                          padding: 12, marginBottom: 12, borderRadius: 8,
                          background: isWP ? '#fef3c7' : '#fffbeb',
                          border: `1px solid ${isWP ? '#d97706' : '#fbbf24'}`,
                          fontSize: 11, color: '#92400e', lineHeight: 1.5,
                        }}>
                          Vedic chart API temporarily unavailable (error {vargasError}).
                          {vargasError === 403 && ' This is usually a rate limit or quota issue — try again later.'}
                          {natalPlanets ? ' Showing birth chart data from Western calculations below.' : ''}
                        </div>
                      )}

                      {natalPlanets && natalPlanets.length > 0 ? (
                        <>
                          <div style={{ fontSize: 10, fontWeight: 500, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                            Birth Chart — Planet Positions (Tropical)
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 4, marginBottom: 16 }}>
                            {natalPlanets.map((p: any, i: number) => (
                              <div key={i} style={{
                                fontSize: 10, padding: '6px 10px', borderRadius: 6,
                                background: isWP ? '#faf8f4' : '#f9fafb',
                                border: `0.5px solid ${theme.colors.cardBorder}`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              }}>
                                <span style={{ fontWeight: 600, color: theme.colors.text }}>{p.name || p.id}</span>
                                <span style={{ color: theme.colors.textLight }}>
                                  {SIGN_EMOJI[p.sign] || ''} {p.sign} {p.degree?.toFixed(1)}°
                                  {p.retrograde ? ' ℞' : ''}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Natal interpretation sections as life readings */}
                          {natalInterpretation && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 500, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                                Kundali Life Readings
                              </div>
                              {Object.entries(natalInterpretation).map(([sectionKey, items]: [string, any]) => {
                                if (!Array.isArray(items) || items.length === 0) return null;
                                const sectionTitle = sectionKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                return (
                                  <div key={sectionKey} style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.text, marginBottom: 4 }}>
                                      {sectionTitle}
                                    </div>
                                    {items.slice(0, 3).map((item: any, idx: number) => (
                                      <div key={idx} style={{
                                        fontSize: 11, lineHeight: 1.6, color: theme.colors.textLight,
                                        padding: '6px 10px', marginBottom: 4, borderRadius: 6,
                                        background: isWP ? '#faf8f4' : '#f9fafb',
                                        border: `0.5px solid ${theme.colors.cardBorder}`,
                                      }}>
                                        {item.title && <strong style={{ color: theme.colors.text }}>{item.title}: </strong>}
                                        {typeof item.body === 'string' ? item.body.slice(0, 300) : String(item.body || '').slice(0, 300)}
                                        {(item.body?.length || 0) > 300 ? '…' : ''}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      ) : !vargasError ? (
                        <div style={{ textAlign: 'center', padding: 20, color: theme.colors.textLight, fontSize: 11 }}>
                          No Kundali data available. Tap "Recalculate" below to retry.
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {/* ── Shadbala Tab ───────────────────────────────── */}
              {activeTab === 'shadbala' && !shadbala && (
                <div style={{ padding: '16px 20px' }}>
                  <div style={{
                    padding: 12, borderRadius: 8,
                    background: isWP ? '#fef3c7' : '#fffbeb',
                    border: `1px solid ${isWP ? '#d97706' : '#fbbf24'}`,
                    fontSize: 11, color: '#92400e', lineHeight: 1.5,
                  }}>
                    {strengthError
                      ? <>Shadbala API temporarily unavailable (error {strengthError}).{strengthError === 403 && ' Rate limit or quota exceeded — try again later.'}</>
                      : 'Shadbala data not yet available. Tap "Recalculate" below to fetch it.'}
                  </div>
                </div>
              )}
              {activeTab === 'shadbala' && shadbala && (
                <div style={{ padding: isMobile ? '12px 16px' : '16px 20px' }}>
                  <div style={{ fontSize: 11, color: theme.colors.textLight, marginBottom: 10, lineHeight: 1.5 }}>
                    Shadbala measures sixfold planetary strength. Ratio &gt; 1.0 means the planet exceeds the required minimum.
                  </div>
                  {Object.entries(shadbala).map(([planet, data]: [string, any]) => (
                    <StrengthBar
                      key={planet}
                      label={planet}
                      ratio={data.ratio || 0}
                      rating={data.strength_rating || 'Low'}
                      isWP={isWP}
                    />
                  ))}

                  {/* Component breakdown for strongest planet */}
                  {(() => {
                    const strongest = Object.entries(shadbala).sort((a: any, b: any) => (b[1].ratio || 0) - (a[1].ratio || 0))[0];
                    if (!strongest) return null;
                    const [name, data] = strongest as [string, any];
                    const comps = data.components;
                    if (!comps) return null;
                    return (
                      <div style={{ marginTop: 12, padding: '10px 12px', background: isWP ? '#faf8f4' : '#f0fdf4', borderRadius: 8, border: `0.5px solid ${theme.colors.cardBorder}` }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: theme.colors.text, marginBottom: 6 }}>
                          Strongest: {name} ({data.ratio?.toFixed(2)}x — {data.strength_rating})
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                          {Object.entries(comps).map(([k, v]: [string, any]) => (
                            <div key={k} style={{ fontSize: 9, color: theme.colors.textLight }}>
                              {k.replace(/_/g, ' ')}: <strong style={{ color: theme.colors.text }}>{v?.toFixed?.(1) ?? v}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── Ashtakavarga Tab ───────────────────────────── */}
              {activeTab === 'ashtakavarga' && !ashtak && (
                <div style={{ padding: '16px 20px' }}>
                  <div style={{
                    padding: 12, borderRadius: 8,
                    background: isWP ? '#fef3c7' : '#fffbeb',
                    border: `1px solid ${isWP ? '#d97706' : '#fbbf24'}`,
                    fontSize: 11, color: '#92400e', lineHeight: 1.5,
                  }}>
                    {strengthError
                      ? <>Ashtakavarga API temporarily unavailable (error {strengthError}).{strengthError === 403 && ' Rate limit or quota exceeded — try again later.'}</>
                      : 'Ashtakavarga data not yet available. Tap "Recalculate" below to fetch it.'}
                  </div>
                </div>
              )}
              {activeTab === 'ashtakavarga' && ashtak && (
                <div style={{ padding: isMobile ? '12px 16px' : '16px 20px' }}>
                  <div style={{ fontSize: 11, color: theme.colors.textLight, marginBottom: 10, lineHeight: 1.5 }}>
                    Sarva Ashtakavarga (SAV) points per house. 28+ is strong, below 25 is weak.
                  </div>
                  {ashtak.sarva_ashtakavarga && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, marginBottom: 12 }}>
                      {ashtak.sarva_ashtakavarga.map((h: any) => {
                        const pts = h.points;
                        const bg = pts >= 28 ? (isWP ? '#d1fae5' : '#d1fae5') : pts < 25 ? (isWP ? '#fee2e2' : '#fee2e2') : (isWP ? '#fef3c7' : '#fef3c7');
                        const color = pts >= 28 ? '#065f46' : pts < 25 ? '#991b1b' : '#92400e';
                        return (
                          <div key={h.house} style={{
                            textAlign: 'center', padding: '6px 4px', borderRadius: 6,
                            background: bg, border: `0.5px solid ${theme.colors.cardBorder}`,
                          }}>
                            <div style={{ fontSize: 8, color: theme.colors.textLight }}>H{h.house}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color }}>{pts}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {ashtak.total_points && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.text }}>
                      Total SAV: {ashtak.total_points} points
                    </div>
                  )}
                </div>
              )}

              {/* Action bar */}
              <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end', borderTop: `0.5px solid ${theme.colors.cardBorder}` }}>
                <button
                  onClick={() => { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(NATAL_CACHE_KEY); setVedic(null); setNatalData(null); failedRef.current = false; setError(null); }}
                  style={{ fontSize: 10, color: isWP ? '#92400e' : '#a78bfa', background: isWP ? '#fef3c7' : 'rgba(139,92,246,0.15)', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}
                >
                  ↻ Recalculate
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VedicAstroWidget;
