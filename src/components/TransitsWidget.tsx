/**
 * Planetary Transits Widget — shows current sky positions vs natal chart.
 * Cached per day in localStorage.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getUserSettings } from '../storage';
import { useTheme } from '../contexts/ThemeContext';

const CACHE_KEY = 'astro_transits_cache';
const SIGN_EMOJI: Record<string, string> = {
  Ari: '♈', Tau: '♉', Gem: '♊', Can: '♋', Leo: '♌', Vir: '♍',
  Lib: '♎', Sco: '♏', Sag: '♐', Cap: '♑', Aqu: '♒', Pis: '♓',
};

function getDayCached(): any | null {
  try {
    const r = localStorage.getItem(CACHE_KEY);
    if (!r) return null;
    const p = JSON.parse(r);
    if (p.date !== new Date().toISOString().slice(0, 10)) { localStorage.removeItem(CACHE_KEY); return null; }
    return p.data;
  } catch { return null; }
}
function setDayCache(d: any) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: d, date: new Date().toISOString().slice(0, 10) })); } catch { /* */ }
}

const ASPECT_COLORS: Record<string, string> = {
  Conjunction: '#6366f1', Trine: '#10B981', Sextile: '#3B82F6',
  Square: '#EF4444', Opposition: '#DC2626', Quincunx: '#F59E0B',
};
const ASPECT_SYMBOLS: Record<string, string> = {
  Conjunction: '☌', Trine: '△', Sextile: '⚹', Square: '□', Opposition: '☍', Quincunx: '⚻',
};

const TransitsWidget: React.FC = () => {
  const { theme } = useTheme();
  const isWP = theme.id === 'warm-paper';
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [birthData, setBirthData] = useState<any>(null);
  const [transits, setTransits] = useState<any>(() => getDayCached());
  const [showMinor, setShowMinor] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const fetchingRef = React.useRef(false);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await getUserSettings();
        if (s.birthData?.year && s.birthData?.city) setBirthData(s.birthData);
      } catch { /* */ }
    })();
  }, []);

  const fetchTransits = useCallback(async () => {
    if (!birthData || fetchingRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/astro?action=transits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(birthData),
      });
      if (!r.ok) throw new Error(`Transits API: ${r.status}`);
      const d = await r.json();
      setTransits(d);
      setDayCache(d);
    } catch (e: any) {
      console.error('[TransitsWidget]', e);
      setError(e.message);
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [birthData]);

  useEffect(() => {
    if (isExpanded && birthData && !transits && !isLoading && !fetchingRef.current) fetchTransits();
  }, [isExpanded, birthData, transits, isLoading, fetchTransits]);

  if (!birthData) return null;

  const aspects = transits?.aspects || [];
  const majorAspects = aspects.filter((a: any) => a.is_major);
  const minorAspects = aspects.filter((a: any) => !a.is_major);
  const transitPlanets = transits?.transit_planets || [];
  const summary = transits?.aspects_summary;
  const interp = transits?.interpretation;

  const collapsedSummary = summary ? `${summary.major} major · ${summary.minor} minor aspects` : '';

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
          <span style={{ fontSize: 14 }}>🪐</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: theme.colors.text }}>Planetary Transits</span>
          {!isExpanded && collapsedSummary && (
            <span style={{ fontSize: 11, color: theme.colors.textLight, fontWeight: 400, marginLeft: 'auto' }}>
              {collapsedSummary}
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: '#ccc', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
      </button>

      {isExpanded && (
        <div style={{ borderTop: `0.5px solid ${theme.colors.cardBorder}` }}>
          {error && <div style={{ padding: 12, color: '#dc2626', fontSize: 11 }}>⚠️ {error}</div>}

          {isLoading && !transits && (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🪐</div>
              <div style={{ fontSize: 11, color: theme.colors.textLight }}>Calculating transits…</div>
            </div>
          )}

          {transits && (
            <>
              {/* Current Sky Positions */}
              <div style={{ padding: isMobile ? '12px 16px' : '16px 20px', borderBottom: `0.5px solid ${theme.colors.cardBorder}` }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                  Current Sky — {transits.transit_date}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {transitPlanets.slice(0, 10).map((p: any, i: number) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 8px', borderRadius: 6,
                      background: isWP ? '#faf8f4' : '#f9fafb',
                      border: `0.5px solid ${theme.colors.cardBorder}`,
                      fontSize: 10,
                    }}>
                      <span style={{ fontWeight: 600, color: theme.colors.text }}>{p.name?.slice(0, 3)}</span>
                      <span>{SIGN_EMOJI[p.sign] || ''}</span>
                      <span style={{ color: theme.colors.textLight }}>{p.sign} {p.pos?.toFixed(1)}°</span>
                      {p.retrograde && <span style={{ fontSize: 8, color: '#EF4444', fontWeight: 700 }}>℞</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Major Aspects */}
              <div style={{ padding: isMobile ? '12px 16px' : '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Major Aspects ({majorAspects.length})
                  </div>
                  {summary && (
                    <div style={{ fontSize: 9, color: theme.colors.textLight }}>
                      {summary.applying} applying · {summary.separating} separating
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {majorAspects.slice(0, 12).map((a: any, i: number) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
                      borderRadius: 6, fontSize: 10,
                      background: a.is_applying ? (isWP ? '#fefce8' : '#fef3c7') : 'transparent',
                      border: `0.5px solid ${theme.colors.cardBorder}`,
                    }}>
                      <span style={{ color: ASPECT_COLORS[a.type] || theme.colors.text, fontWeight: 700, fontSize: 13, width: 16 }}>
                        {ASPECT_SYMBOLS[a.type] || '·'}
                      </span>
                      <span style={{ fontWeight: 500, color: theme.colors.text, flex: 1 }}>
                        {a.p1} {a.type} {a.p2}
                      </span>
                      <span style={{ color: theme.colors.textLight, fontSize: 9 }}>
                        {a.orb?.toFixed(1)}° {a.is_applying ? '→' : '←'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Minor toggle */}
                {minorAspects.length > 0 && (
                  <button
                    onClick={() => setShowMinor(!showMinor)}
                    style={{ marginTop: 8, fontSize: 10, color: theme.colors.textLight, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {showMinor ? 'Hide' : 'Show'} {minorAspects.length} minor aspects
                  </button>
                )}
                {showMinor && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {minorAspects.map((a: any, i: number) => (
                      <span key={i} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: isWP ? '#f0ede8' : '#f3f4f6', color: theme.colors.textLight }}>
                        {a.p1} {a.type} {a.p2} ({a.orb?.toFixed(1)}°)
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Interpretation */}
              {interp?.sections && (
                <div style={{ padding: isMobile ? '0 16px 12px' : '0 20px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                    Transit Themes
                  </div>
                  {Object.entries(interp.sections).slice(0, 4).map(([section, items]: [string, any]) => {
                    if (!items?.length) return null;
                    return items.slice(0, 2).map((item: any, i: number) => (
                      <div key={`${section}-${i}`} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.text, marginBottom: 2 }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: theme.colors.textLight, lineHeight: 1.5 }}>
                          {item.body?.length > 200 ? item.body.slice(0, 200) + '…' : item.body}
                        </div>
                      </div>
                    ));
                  })}
                </div>
              )}

              {/* Action bar */}
              <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end', borderTop: `0.5px solid ${theme.colors.cardBorder}` }}>
                <button
                  onClick={() => { localStorage.removeItem(CACHE_KEY); setTransits(null); }}
                  style={{ fontSize: 10, color: isWP ? '#92400e' : '#a78bfa', background: isWP ? '#fef3c7' : 'rgba(139,92,246,0.15)', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}
                >
                  ↻ Refresh
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TransitsWidget;
