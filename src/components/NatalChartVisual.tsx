/**
 * Natal Chart Visual — renders the SVG wheel chart from FreeAstroAPI.
 * Supports Western (tropical) and Vedic (sidereal) toggle.
 * Cached forever in localStorage (natal chart is immutable).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getUserSettings } from '../storage';
import { useTheme } from '../contexts/ThemeContext';
import { perfStart } from '../utils/perfLogger';

const CACHE_PREFIX = 'astro_chart_svg_';

function getCachedSvg(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function setCachedSvg(key: string, svg: string) {
  try { localStorage.setItem(key, svg); } catch { /* quota */ }
}

const NatalChartVisual: React.FC = () => {
  const { theme } = useTheme();
  const isWP = theme.id === 'warm-paper';
  const [isExpanded, setIsExpanded] = useState(false);
  const [birthData, setBirthData] = useState<any>(null);
  const [svgWestern, setSvgWestern] = useState<string | null>(() => getCachedSvg(CACHE_PREFIX + 'tropical'));
  const [svgVedic, setSvgVedic] = useState<string | null>(() => getCachedSvg(CACHE_PREFIX + 'sidereal'));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'western' | 'vedic'>('western');
  const fetchingRef = React.useRef(false);
  const failedRef = React.useRef<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const s = await getUserSettings();
        if (s.birthData?.year && s.birthData?.city) setBirthData(s.birthData);
      } catch { /* */ }
    })();
  }, []);

  const fetchChart = useCallback(async (zodiacType: 'tropical' | 'sidereal') => {
    if (!birthData || fetchingRef.current || failedRef.current[zodiacType]) return;
    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);
    const endPerf = perfStart('NatalChartVisual', `chart API (${zodiacType})`);
    try {
      const r = await fetch('/api/astro?action=chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...birthData,
          zodiacType,
          themeType: isWP ? 'light' : 'light',
        }),
      });
      if (!r.ok) throw new Error(`Chart API: ${r.status}`);
      const data = await r.json();
      if (data.svg) {
        setCachedSvg(CACHE_PREFIX + zodiacType, data.svg);
        if (zodiacType === 'tropical') setSvgWestern(data.svg);
        else setSvgVedic(data.svg);
      }
    } catch (e: any) {
      console.error('[NatalChartVisual]', e);
      setError(e.message);
      failedRef.current[zodiacType] = true;
    } finally {
      endPerf();
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [birthData, isWP]);

  useEffect(() => {
    if (!isExpanded || !birthData) return;
    if (mode === 'western' && !svgWestern && !isLoading && !failedRef.current['tropical']) fetchChart('tropical');
    if (mode === 'vedic' && !svgVedic && !isLoading && !failedRef.current['sidereal']) fetchChart('sidereal');
  }, [isExpanded, birthData, mode, svgWestern, svgVedic, isLoading, fetchChart]);

  if (!birthData) return null;

  const currentSvg = mode === 'western' ? svgWestern : svgVedic;

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
          <span style={{ fontSize: 14 }}>🎡</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: theme.colors.text }}>Birth Chart Wheel</span>
          {!isExpanded && (
            <span style={{ fontSize: 11, color: theme.colors.textLight, fontWeight: 400, marginLeft: 'auto' }}>
              Western · Vedic (Sidereal)
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: '#ccc', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
      </button>

      {isExpanded && (
        <div style={{ borderTop: `0.5px solid ${theme.colors.cardBorder}` }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 0, padding: '8px 16px' }}>
            {(['western', 'vedic'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  flex: 1, padding: '6px 12px', fontSize: 11, fontWeight: mode === m ? 700 : 400,
                  background: mode === m ? (isWP ? '#fef3c7' : '#ede9fe') : 'transparent',
                  color: mode === m ? (isWP ? '#92400e' : '#5b21b6') : theme.colors.textLight,
                  border: `1px solid ${theme.colors.cardBorder}`,
                  borderRadius: m === 'western' ? '6px 0 0 6px' : '0 6px 6px 0',
                  cursor: 'pointer',
                }}
              >
                {m === 'western' ? '🌐 Western (Tropical)' : '🕉️ Vedic (Sidereal)'}
              </button>
            ))}
          </div>

          {error && <div style={{ padding: 12, color: '#dc2626', fontSize: 11 }}>⚠️ {error}</div>}

          {isLoading && !currentSvg && (
            <div style={{ padding: 30, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎡</div>
              <div style={{ fontSize: 11, color: theme.colors.textLight }}>Generating {mode} birth chart…</div>
            </div>
          )}

          {currentSvg && (
            <div style={{ padding: '8px 16px 16px', display: 'flex', justifyContent: 'center' }}>
              <div
                dangerouslySetInnerHTML={{ __html: currentSvg }}
                style={{ maxWidth: '100%', overflow: 'hidden' }}
              />
            </div>
          )}

          {/* Action bar */}
          <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: `0.5px solid ${theme.colors.cardBorder}` }}>
            <button
              onClick={() => {
                localStorage.removeItem(CACHE_PREFIX + (mode === 'western' ? 'tropical' : 'sidereal'));
                if (mode === 'western') setSvgWestern(null);
                else setSvgVedic(null);
              }}
              style={{ fontSize: 10, color: isWP ? '#92400e' : '#a78bfa', background: isWP ? '#fef3c7' : 'rgba(139,92,246,0.15)', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}
            >
              ↻ Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NatalChartVisual;
