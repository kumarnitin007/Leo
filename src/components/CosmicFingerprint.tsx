/**
 * Cosmic Fingerprint — Three traditions, one reading.
 *
 * Synthesises Western (natal/transits), Vedic (yogas, dasha), and
 * Chinese BaZi (four pillars) into a single, visually rich section.
 *
 * All API data cached: birth-derived (natal, bazi, yogas, dasha) = forever;
 * daily (panchang, moon) = per calendar day.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getUserSettings } from '../storage';
import { useTheme } from '../contexts/ThemeContext';
import { saveAstroCache, getLastSuccessfulAstroCache } from '../services/astroCacheService';

// ── Types (loose — we rely on API shapes) ──────────────────────
interface BirthData { year: number; month: number; day: number; hour?: number; minute?: number; city: string; timeKnown?: boolean }

// ── Cache helpers ──────────────────────────────────────────────
const LS = {
  BAZI: 'astro_bazi_cache',
  YOGAS: 'astro_yogas_cache',
  DASHA: 'astro_dasha_cache',
  PANCHANG: 'astro_panchang_cache',
  NATAL: 'astro_natal_cache',
  MOON: 'astro_moon_cache',
};
const today = () => new Date().toISOString().slice(0, 10);
function getCached(key: string, daily = false): any | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (daily) { if (obj?.date !== today()) { localStorage.removeItem(key); return null; } return obj.data; }
    return obj;
  } catch { return null; }
}
function setCache(key: string, data: any, daily = false) {
  try { localStorage.setItem(key, JSON.stringify(daily ? { data, date: today() } : data)); } catch { /* full */ }
}

// ── Colour palette for traditions ──────────────────────────────
const PILLAR_COLORS: Record<string, string> = {
  Wood: '#4ade80', Fire: '#f87171', Earth: '#fbbf24', Metal: '#94a3b8', Water: '#60a5fa',
};
const DASHA_COLORS: Record<string, string> = {
  Sun: '#f59e0b', Moon: '#a78bfa', Mars: '#ef4444', Mercury: '#34d399',
  Jupiter: '#f59e0b', Venus: '#ec4899', Saturn: '#6b7280', Rahu: '#8b5cf6', Ketu: '#78716c',
};
const YOGA_CATEGORY_COLORS: Record<string, string> = {
  wealth: '#f59e0b', raj: '#8b5cf6', intelligence: '#3b82f6', affliction: '#ef4444',
};

// ── Element radar (SVG pentagon/hexagon) ───────────────────────
function ElementRadar({ elements }: { elements: Record<string, number> }) {
  const keys = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
  const max = Math.max(...Object.values(elements), 1);
  const cx = 100, cy = 100, R = 75;
  const angleStep = (2 * Math.PI) / keys.length;
  const startAngle = -Math.PI / 2;

  const gridPoints = (r: number) => keys.map((_, i) => {
    const a = startAngle + i * angleStep;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');

  const dataPoints = keys.map((k, i) => {
    const val = (elements[k] || 0) / max;
    const a = startAngle + i * angleStep;
    return `${cx + R * val * Math.cos(a)},${cy + R * val * Math.sin(a)}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 200 200" style={{ width: '100%', maxWidth: 220 }}>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <polygon key={f} points={gridPoints(R * f)} fill="none" stroke="#e5e7eb" strokeWidth={0.5} />
      ))}
      {keys.map((_, i) => {
        const a = startAngle + i * angleStep;
        return <line key={i} x1={cx} y1={cy} x2={cx + R * Math.cos(a)} y2={cy + R * Math.sin(a)} stroke="#e5e7eb" strokeWidth={0.5} />;
      })}
      <polygon points={dataPoints} fill="rgba(139,92,246,0.25)" stroke="#8b5cf6" strokeWidth={2} />
      {keys.map((k, i) => {
        const a = startAngle + i * angleStep;
        const lx = cx + (R + 18) * Math.cos(a);
        const ly = cy + (R + 18) * Math.sin(a);
        return (
          <text key={k} x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 11, fontWeight: 600, fill: PILLAR_COLORS[k] || '#666' }}>
            {k}
          </text>
        );
      })}
      {keys.map((k, i) => {
        const val = (elements[k] || 0) / max;
        const a = startAngle + i * angleStep;
        const px = cx + R * val * Math.cos(a);
        const py = cy + R * val * Math.sin(a);
        return <circle key={k + 'dot'} cx={px} cy={py} r={3.5} fill={PILLAR_COLORS[k] || '#8b5cf6'} />;
      })}
    </svg>
  );
}

// ── BaZi Pillar Card ───────────────────────────────────────────
function PillarCard({ label, stem, branch, element, color, isDayMaster, pinyin }: {
  label: string; stem: string; branch: string; element?: string;
  color?: string; isDayMaster?: boolean; pinyin?: { stem?: string; branch?: string };
}) {
  const bg = isDayMaster ? '#fffbeb' : '#fafaf9';
  const border = isDayMaster ? '#f59e0b' : '#e5e7eb';
  return (
    <div style={{
      flex: 1, minWidth: 80, background: bg, border: `2px solid ${border}`,
      borderRadius: 12, padding: '10px 6px', textAlign: 'center',
      boxShadow: isDayMaster ? '0 0 0 2px rgba(245,158,11,0.3)' : 'none',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
        color: isDayMaster ? '#b45309' : '#9ca3af', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 700, color: color || '#1e1b18' }}>
        {stem}
      </div>
      <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 700, color: color || '#1e1b18', marginTop: 2 }}>
        {branch}
      </div>
      {pinyin && (
        <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 4 }}>
          {pinyin.stem}{pinyin.branch ? ` · ${pinyin.branch}` : ''}
        </div>
      )}
      {element && (
        <div style={{
          display: 'inline-block', marginTop: 6, fontSize: 9, fontWeight: 600,
          background: PILLAR_COLORS[element] ? `${PILLAR_COLORS[element]}22` : '#f3f4f6',
          color: PILLAR_COLORS[element] || '#6b7280',
          padding: '2px 8px', borderRadius: 20,
        }}>{element}</div>
      )}
    </div>
  );
}

// ── Dasha River Timeline ───────────────────────────────────────
function DashaRiver({ dashaData, currentDasha }: { dashaData: any[]; currentDasha: any }) {
  const now = new Date();
  if (!dashaData?.length) return null;

  const sorted = [...dashaData].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  const totalStart = new Date(sorted[0].start_date).getTime();
  const totalEnd = new Date(sorted[sorted.length - 1].end_date).getTime();
  const totalSpan = totalEnd - totalStart || 1;
  const nowPct = Math.min(100, Math.max(0, ((now.getTime() - totalStart) / totalSpan) * 100));

  return (
    <div>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 28, position: 'relative' }}>
        {sorted.map((d: any, i: number) => {
          const start = new Date(d.start_date).getTime();
          const end = new Date(d.end_date).getTime();
          const w = ((end - start) / totalSpan) * 100;
          const isCurrent = currentDasha?.mahadasha?.planet === d.planet;
          const col = DASHA_COLORS[d.planet] || '#9ca3af';
          return (
            <div key={i} title={`${d.planet}: ${d.start_date?.slice(0, 10)} → ${d.end_date?.slice(0, 10)}`} style={{
              width: `${w}%`, background: col, opacity: isCurrent ? 1 : 0.45,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: w > 5 ? 9 : 0, fontWeight: 700, color: '#fff', letterSpacing: 0.5,
              borderRight: i < sorted.length - 1 ? '1px solid rgba(255,255,255,0.4)' : 'none',
            }}>
              {w > 6 ? d.planet?.slice(0, 3) : ''}
            </div>
          );
        })}
        <div style={{
          position: 'absolute', left: `${nowPct}%`, top: -2, bottom: -2,
          width: 3, background: '#1e1b18', borderRadius: 2, zIndex: 2,
          boxShadow: '0 0 6px rgba(0,0,0,0.4)',
        }} />
      </div>
      <div style={{ position: 'relative', height: 14, marginTop: 2 }}>
        <div style={{ position: 'absolute', left: `${nowPct}%`, transform: 'translateX(-50%)',
          fontSize: 8, fontWeight: 700, color: '#1e1b18', whiteSpace: 'nowrap' }}>▲ Now</div>
      </div>
      {currentDasha?.mahadasha && (
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
          <strong>Currently in {currentDasha.mahadasha.planet} Dasha</strong>
          {currentDasha.mahadasha.start_date && currentDasha.mahadasha.end_date && (
            <span style={{ color: '#6b7280' }}> · {currentDasha.mahadasha.start_date?.slice(0, 4)} – {currentDasha.mahadasha.end_date?.slice(0, 4)}</span>
          )}
          {currentDasha.antardasha && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Sub-period: <strong style={{ color: '#374151' }}>{currentDasha.antardasha.planet}</strong>
              {currentDasha.antardasha.start_date && ` (${currentDasha.antardasha.start_date?.slice(0, 7)} → ${currentDasha.antardasha.end_date?.slice(0, 7)})`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Yoga Card ──────────────────────────────────────────────────
function YogaCard({ yoga }: { yoga: any }) {
  const catColor = YOGA_CATEGORY_COLORS[yoga.category?.toLowerCase()] || '#6b7280';
  return (
    <div style={{
      border: `1.5px solid ${catColor}33`, borderLeft: `4px solid ${catColor}`,
      borderRadius: 10, padding: '10px 14px', marginBottom: 8, background: '#fff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <strong style={{ fontSize: 14 }}>{yoga.name || yoga.yoga_name}</strong>
        {yoga.active !== false && <span style={{ fontSize: 9, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '1px 6px', borderRadius: 20 }}>Active</span>}
      </div>
      {yoga.involved_planets?.length > 0 && (
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
          {yoga.involved_planets.join(' + ')}
        </div>
      )}
      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
        {yoga.description || yoga.meaning || ''}
      </div>
    </div>
  );
}

// ── Tag pills for API source tracking ──────────────────────────
function SourceTags({ tags }: { tags: { label: string; cached: boolean }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
      {tags.map(t => (
        <span key={t.label} style={{
          fontSize: 10, padding: '3px 10px', borderRadius: 20, fontWeight: 600,
          background: t.cached ? '#f3f4f6' : '#fef3c7',
          color: t.cached ? '#6b7280' : '#92400e',
          border: `1px solid ${t.cached ? '#e5e7eb' : '#fde68a'}`,
        }}>
          {t.label} — {t.cached ? 'cached' : 'fetching'}
        </span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════
export default function CosmicFingerprint() {
  const { theme } = useTheme();
  const [birthData, setBirthData] = useState<BirthData | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Data states
  const [natalData, setNatalData] = useState<any>(null);
  const [baziData, setBaziData] = useState<any>(null);
  const [yogasData, setYogasData] = useState<any>(null);
  const [dashaData, setDashaData] = useState<any>(null);
  const [panchangData, setPanchangData] = useState<any>(null);
  const [moonData, setMoonData] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiQuestion, setAiQuestion] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  const fetchingRef = useRef(false);
  const failedRef = useRef(false);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Load birth data
  useEffect(() => {
    getUserSettings().then(s => {
      if (s.birthData?.year && s.birthData?.city) setBirthData(s.birthData as BirthData);
    }).catch(() => {});
  }, []);

  // Load from caches on mount
  useEffect(() => {
    setNatalData(getCached(LS.NATAL));
    setBaziData(getCached(LS.BAZI));
    setYogasData(getCached(LS.YOGAS));
    setDashaData(getCached(LS.DASHA));
    setPanchangData(getCached(LS.PANCHANG, true));
    setMoonData(getCached(LS.MOON, true));
  }, []);

  const fetchAll = useCallback(async () => {
    if (!birthData || fetchingRef.current || failedRef.current) return;
    fetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    const bd = birthData;
    const body = JSON.stringify({ year: bd.year, month: bd.month, day: bd.day, hour: bd.hour, minute: bd.minute, city: bd.city });
    const headers = { 'Content-Type': 'application/json' };

    const safeFetch = async (action: string, opts?: RequestInit) => {
      const resp = await fetch(`/api/astro?action=${action}`, { method: 'POST', headers, body, ...opts });
      if (!resp.ok) throw new Error(`${action}: ${resp.status}`);
      return resp.json();
    };

    try {
      const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
      // Sequential fetches with delays to avoid 429 rate limits
      const tasks: { action: string; run: () => Promise<void> }[] = [];

      const fetchOrFallback = async (
        action: string,
        setter: (d: any) => void,
        lsKey: string,
        daily = false,
        customFetch?: () => Promise<any>,
      ) => {
        try {
          const d = customFetch ? await customFetch() : await safeFetch(action);
          setter(d); setCache(lsKey, d, daily);
          saveAstroCache(action, { year: bd.year, month: bd.month, day: bd.day, city: bd.city }, d);
        } catch (e: any) {
          console.warn(`[CosmicFingerprint] ${action} skipped:`, e.message);
          const fb = await getLastSuccessfulAstroCache(action);
          if (fb?.data) { setter(fb.data); setCache(lsKey, fb.data, daily); }
        }
      };

      if (!natalData) tasks.push({ action: 'natal', run: () => fetchOrFallback('natal', setNatalData, LS.NATAL) });
      if (!baziData) tasks.push({ action: 'bazi', run: () => fetchOrFallback('bazi', setBaziData, LS.BAZI) });
      if (!yogasData) tasks.push({ action: 'yogas', run: () => fetchOrFallback('yogas', setYogasData, LS.YOGAS) });
      if (!dashaData) tasks.push({ action: 'dasha', run: () => fetchOrFallback('dasha', setDashaData, LS.DASHA) });
      if (!panchangData) tasks.push({ action: 'panchang', run: () => fetchOrFallback('panchang', setPanchangData, LS.PANCHANG, true) });
      if (!moonData) tasks.push({ action: 'moon', run: () => fetchOrFallback('moon', setMoonData, LS.MOON, true, async () => {
        const r = await fetch(`/api/astro?action=moon&city=${encodeURIComponent(bd.city)}`);
        if (!r.ok) throw new Error(`moon: ${r.status}`);
        return r.json();
      })});

      for (let i = 0; i < tasks.length; i++) {
        if (i > 0) await delay(800);
        await tasks[i].run();
      }
    } catch (e: any) {
      console.error('[CosmicFingerprint] Fetch error:', e.message);
      setError(e.message || 'Failed to load cosmic data');
      failedRef.current = true;
    } finally {
      setIsLoading(false);
      fetchingRef.current = false;
    }
  }, [birthData, natalData, baziData, yogasData, dashaData, panchangData, moonData]);

  // Auto-fetch on expand
  useEffect(() => {
    if (isExpanded && birthData && !isLoading && !failedRef.current) {
      const needsFetch = !baziData || !yogasData || !dashaData || !panchangData || !moonData;
      if (needsFetch) fetchAll();
    }
  }, [isExpanded, birthData, baziData, yogasData, dashaData, panchangData, moonData]);

  // ── Derived data ──────────────────────────────────────────────
  const combinedElements = useMemo(() => {
    const elems: Record<string, number> = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
    // BaZi elements
    const baziBalance = baziData?.element_balance || baziData?.elements?.balance;
    if (baziBalance) {
      Object.entries(baziBalance).forEach(([k, v]) => {
        const key = k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
        if (elems[key] !== undefined) elems[key] += Number(v) || 0;
      });
    }
    // Western elements from natal planets
    if (natalData?.planets) {
      const signElement: Record<string, string> = {
        Aries: 'Fire', Taurus: 'Earth', Gemini: 'Metal', Cancer: 'Water',
        Leo: 'Fire', Virgo: 'Earth', Libra: 'Metal', Scorpio: 'Water',
        Sagittarius: 'Fire', Capricorn: 'Earth', Aquarius: 'Metal', Pisces: 'Water',
      };
      (natalData.planets as any[]).forEach(p => {
        const el = signElement[p.sign];
        if (el) elems[el] += 1;
      });
    }
    return elems;
  }, [baziData, natalData]);

  const activeYogas = useMemo(() => {
    const list = yogasData?.yogas || yogasData?.detected_yogas || [];
    return (list as any[]).filter((y: any) => y.active !== false);
  }, [yogasData]);

  const shenShaStars = useMemo(() => {
    if (!baziData?.shen_sha) return [];
    const all: { name: string; pinyin?: string; pillar?: string; description?: string }[] = [];
    const ss = baziData.shen_sha;
    for (const pillar of ['year', 'month', 'day', 'hour']) {
      const stars = ss[pillar] || ss[`${pillar}_pillar`];
      if (Array.isArray(stars)) {
        stars.forEach((s: any) => all.push({ name: s.name || s, pinyin: s.pinyin, pillar, description: s.description }));
      }
    }
    return all;
  }, [baziData]);

  // ── Source tags ────────────────────────────────────────────────
  const sourceTags = useMemo(() => {
    const tags: { label: string; cached: boolean }[] = [];
    tags.push({ label: 'BaZi · 4 Pillars', cached: !!baziData });
    tags.push({ label: 'Yoga Detection', cached: !!yogasData });
    tags.push({ label: 'Dasha Timeline', cached: !!dashaData });
    tags.push({ label: 'Panchang · daily almanac', cached: !!panchangData });
    tags.push({ label: 'Moon Phase', cached: !!moonData });
    if (natalData) tags.push({ label: 'Natal (Western)', cached: true });
    return tags;
  }, [baziData, yogasData, dashaData, panchangData, moonData, natalData]);

  // ── Pillars for display ───────────────────────────────────────
  const pillars = useMemo(() => {
    if (!baziData?.pillars && !baziData?.four_pillars) return null;
    const p = baziData.pillars || baziData.four_pillars;
    return {
      year: p.year || p.year_pillar,
      month: p.month || p.month_pillar,
      day: p.day || p.day_pillar,
      hour: p.hour || p.hour_pillar,
    };
  }, [baziData]);

  const dayMaster = useMemo(() => {
    if (!baziData) return null;
    return baziData.day_master || baziData.dm || pillars?.day?.stem;
  }, [baziData, pillars]);

  // ── Sun sign from natal ───────────────────────────────────────
  const sunSign = useMemo(() => {
    if (!natalData?.planets) return null;
    const sun = (natalData.planets as any[]).find(p => p.id === 'sun' || p.name === 'Sun');
    return sun?.sign || null;
  }, [natalData]);

  // ── Build AI prompt ───────────────────────────────────────────
  const buildPrompt = useCallback(() => {
    const lines: string[] = [];
    lines.push('=== COSMIC FINGERPRINT — Astrological Context ===');
    lines.push('');

    if (birthData) {
      lines.push(`Birth: ${birthData.day}/${birthData.month}/${birthData.year}${birthData.hour != null ? ` at ${birthData.hour}:${String(birthData.minute ?? 0).padStart(2, '0')}` : ''}, ${birthData.city}`);
    }

    if (sunSign) lines.push(`Western Sun Sign: ${sunSign}`);

    if (dayMaster) {
      const dm = typeof dayMaster === 'object' ? `${dayMaster.chinese || ''} ${dayMaster.element || ''} ${dayMaster.polarity || ''}`.trim() : String(dayMaster);
      lines.push(`BaZi Day Master: ${dm}`);
    }

    if (baziData?.element_balance || baziData?.elements?.balance) {
      const bal = baziData.element_balance || baziData.elements.balance;
      lines.push(`Element Balance: ${Object.entries(bal).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }

    if (pillars) {
      lines.push('');
      lines.push('Four Pillars (Year / Month / Day / Hour):');
      for (const [name, p] of Object.entries(pillars) as [string, any][]) {
        if (p) lines.push(`  ${name}: ${p.stem?.chinese || p.stem || '?'} ${p.branch?.chinese || p.branch || '?'} (${p.stem?.element || ''} / ${p.branch?.element || ''})`);
      }
    }

    if (activeYogas.length) {
      lines.push('');
      lines.push(`Vedic Yogas Detected (${activeYogas.length}):`);
      activeYogas.slice(0, 8).forEach(y => {
        lines.push(`  • ${y.name || y.yoga_name}: ${y.description || y.meaning || ''}`);
      });
    }

    if (dashaData?.current_dasha?.mahadasha) {
      const md = dashaData.current_dasha.mahadasha;
      lines.push('');
      lines.push(`Current Dasha: ${md.planet} Mahadasha (${md.start_date?.slice(0, 4)} – ${md.end_date?.slice(0, 4)})`);
      if (dashaData.current_dasha.antardasha) {
        const ad = dashaData.current_dasha.antardasha;
        lines.push(`  Sub-period: ${ad.planet} Antardasha (${ad.start_date?.slice(0, 7)} → ${ad.end_date?.slice(0, 7)})`);
      }
    }

    if (shenShaStars.length) {
      lines.push('');
      lines.push(`Chinese Symbolic Stars: ${shenShaStars.map(s => s.name).join(', ')}`);
    }

    if (moonData?.phase) {
      lines.push('');
      lines.push(`Today's Moon: ${moonData.phase.name} (${Math.round(moonData.phase.illumination * 100)}% illuminated)${moonData.zodiac ? ` in ${moonData.zodiac.sign}` : ''}`);
    }

    if (panchangData) {
      const tithi = panchangData.tithi?.name || panchangData.tithi;
      const nakshatra = panchangData.nakshatra?.name || panchangData.nakshatra;
      if (tithi || nakshatra) {
        lines.push(`Panchang: Tithi = ${tithi || 'N/A'}, Nakshatra = ${nakshatra || 'N/A'}`);
      }
    }

    lines.push('');
    lines.push('=== USER QUESTION ===');
    lines.push(aiQuestion || '[User will type a question here]');
    lines.push('');
    lines.push('=== INSTRUCTIONS ===');
    lines.push('You are a wise, warm astrologer who synthesises Western, Vedic, and Chinese BaZi traditions.');
    lines.push('Use the astrological context above to give a thoughtful, personalised answer to the user\'s question.');
    lines.push('Be specific — reference their actual planets, yogas, pillars, and current dasha period.');
    lines.push('Keep it practical and actionable. 3-4 paragraphs max. Use a conversational but insightful tone.');

    return lines.join('\n');
  }, [birthData, sunSign, dayMaster, baziData, pillars, activeYogas, dashaData, shenShaStars, moonData, panchangData, aiQuestion]);

  // ── No birth data ─────────────────────────────────────────────
  if (!birthData) {
    return (
      <div style={{ background: '#fafaf9', border: '1px solid #e5e7eb', borderRadius: 16, padding: 20, textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>🌌</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Cosmic Fingerprint</div>
        <div style={{ fontSize: 12 }}>Add your birth data in Settings to unlock your three-tradition reading.</div>
      </div>
    );
  }

  // ── Collapsed header ──────────────────────────────────────────
  const headerLine = [
    sunSign ? `☉ ${sunSign}` : null,
    dayMaster ? `日 ${typeof dayMaster === 'object' ? dayMaster.element || '' : ''}` : null,
    activeYogas.length ? `${activeYogas.length} Yogas` : null,
    moonData?.phase ? `☽ ${moonData.phase.name}` : null,
  ].filter(Boolean).join('  ·  ');

  return (
    <div style={{
      background: '#fafaf9', border: '1px solid #e5e7eb', borderRadius: 16,
      overflow: 'hidden', transition: 'all 0.3s ease',
    }}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: 'linear-gradient(135deg, #1e1b18 0%, #292524 100%)',
          border: 'none', cursor: 'pointer', color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🌌</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {birthData.city ? `${birthData.city.split(',')[0]}` : 'You'} · {sunSign || 'Cosmic Fingerprint'}
            </div>
            {headerLine && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{headerLine}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isLoading && <span style={{ fontSize: 11, color: '#fbbf24' }}>Loading…</span>}
          <span style={{ fontSize: 16, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{ padding: isMobile ? '12px 10px' : '20px 24px' }}>
          <SourceTags tags={sourceTags} />
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>
            All loaded on single user tap. Cached for the day. Three traditions shown together for the first time.
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12, color: '#dc2626' }}>
              {error}
              <button onClick={() => { failedRef.current = false; setError(null); fetchAll(); }} style={{
                marginLeft: 8, background: '#fee2e2', border: 'none', borderRadius: 6, padding: '3px 10px', color: '#dc2626', fontWeight: 600, cursor: 'pointer', fontSize: 11,
              }}>Retry</button>
            </div>
          )}

          {/* ── Section 1: Identity + Element Radar ──────────── */}
          <div style={{ background: 'linear-gradient(135deg, #292524, #1c1917)', borderRadius: 14, padding: isMobile ? 14 : 20, marginBottom: 20, color: '#fff' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 20, alignItems: 'center' }}>
              {/* Left: Identity */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 32 }}>☉</span>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{birthData.city?.split(',')[0]} · {sunSign || '—'}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                      Born {birthData.day}/{birthData.month}/{birthData.year}
                      {dayMaster ? ` · Day Master: ${typeof dayMaster === 'object' ? dayMaster.chinese || dayMaster.element : dayMaster}` : ''}
                    </div>
                  </div>
                </div>

                {natalData?.interpretation?.sections?.core_self?.[0]?.body && (
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>
                    {(natalData.interpretation.sections.core_self[0].body as string).slice(0, 280)}…
                  </div>
                )}

                {/* Moon phase + Panchang daily */}
                <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                  {moonData?.phase && (
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 12px', fontSize: 11 }}>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>☽ {moonData.phase.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {Math.round(moonData.phase.illumination * 100)}% · {moonData.zodiac?.sign || ''}
                      </div>
                    </div>
                  )}
                  {panchangData?.tithi && (
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '8px 12px', fontSize: 11 }}>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>Tithi: {panchangData.tithi?.name || panchangData.tithi}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)' }}>
                        Nakshatra: {panchangData.nakshatra?.name || panchangData.nakshatra || 'N/A'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Element Radar */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', marginBottom: 4, color: 'rgba(255,255,255,0.5)' }}>Your element balance</div>
                <ElementRadar elements={combinedElements} />
                {(() => {
                  const sorted = Object.entries(combinedElements).sort((a, b) => b[1] - a[1]);
                  const strong = sorted[0];
                  const weak = sorted[sorted.length - 1];
                  if (!strong || strong[1] === 0) return null;
                  return (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 4 }}>
                      Strong in <strong style={{ color: PILLAR_COLORS[strong[0]] }}>{strong[0]}</strong>
                      {weak && weak[1] < strong[1] && <> · Weak in <strong style={{ color: PILLAR_COLORS[weak[0]] }}>{weak[0]}</strong></>}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ── Section 2: Yoga Detection ────────────────────── */}
          {activeYogas.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280', marginBottom: 10 }}>
                Yogas In Your Chart — Rare Planetary Combinations
              </div>
              {activeYogas.slice(0, 6).map((y: any, i: number) => <YogaCard key={i} yoga={y} />)}
              {activeYogas.length > 6 && (
                <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>+ {activeYogas.length - 6} more yogas detected</div>
              )}
            </div>
          )}

          {/* ── Section 3: BaZi Four Pillars ─────────────────── */}
          {pillars && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280', marginBottom: 10 }}>
                BaZi — Your Four Pillars of Destiny
              </div>
              <div style={{ display: 'flex', gap: isMobile ? 6 : 10, flexWrap: 'wrap' }}>
                {(['year', 'month', 'day', 'hour'] as const).map(key => {
                  const p = (pillars as any)[key];
                  if (!p) return null;
                  const stemCh = p.stem?.chinese || p.heavenly_stem?.chinese || p.stem || '?';
                  const branchCh = p.branch?.chinese || p.earthly_branch?.chinese || p.branch || '?';
                  const element = p.stem?.element || p.heavenly_stem?.element || p.element;
                  const stemPinyin = p.stem?.pinyin || p.heavenly_stem?.pinyin;
                  const branchPinyin = p.branch?.pinyin || p.earthly_branch?.pinyin;
                  return (
                    <PillarCard
                      key={key}
                      label={key === 'day' ? 'Day Master' : key}
                      stem={stemCh} branch={branchCh} element={element}
                      color={PILLAR_COLORS[element]}
                      isDayMaster={key === 'day'}
                      pinyin={{ stem: stemPinyin, branch: branchPinyin }}
                    />
                  );
                })}
              </div>

              {/* Shen Sha stars */}
              {shenShaStars.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {shenShaStars.slice(0, 10).map((s, i) => (
                    <span key={i} title={s.description || ''} style={{
                      fontSize: 10, padding: '3px 10px', borderRadius: 20, fontWeight: 600,
                      background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ede9fe',
                    }}>
                      {s.name}{s.pinyin ? ` (${s.pinyin})` : ''}
                    </span>
                  ))}
                </div>
              )}

              {baziData?.day_master_analysis || baziData?.analysis ? (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 10, lineHeight: 1.5 }}>
                  {(baziData.day_master_analysis || baziData.analysis || '').toString().slice(0, 250)}
                </div>
              ) : null}
            </div>
          )}

          {/* ── Section 4: Dasha River ───────────────────────── */}
          {dashaData?.vimshottari_dasha && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#6b7280', marginBottom: 10 }}>
                Vimshottari Dasha — Your Planetary Life Chapters
              </div>
              <DashaRiver dashaData={dashaData.vimshottari_dasha} currentDasha={dashaData.current_dasha} />
            </div>
          )}

          {/* ── Section 5: Ask AI ────────────────────────────── */}
          <div style={{ background: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#5b21b6' }}>
              Ask the Stars — AI-Powered Reading
            </div>
            <div style={{ fontSize: 11, color: '#7c3aed', marginBottom: 10 }}>
              Type a question below. We'll combine your BaZi, Yogas, Dasha period, moon phase, and natal chart into a single prompt for OpenAI.
            </div>
            <textarea
              value={aiQuestion}
              onChange={e => setAiQuestion(e.target.value)}
              placeholder="e.g. What should I focus on this month? / Is this a good time to start a business? / Tell me about my career potential..."
              style={{
                width: '100%', minHeight: 60, borderRadius: 10, border: '1px solid #ddd6fe',
                padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
                background: '#fff', color: '#1e1b18', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => setShowPrompt(!showPrompt)}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10,
                  background: showPrompt ? '#5b21b6' : '#ede9fe', color: showPrompt ? '#fff' : '#5b21b6',
                  border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                }}>
                {showPrompt ? 'Hide Prompt' : 'Show Full Prompt'}
              </button>
            </div>

            {showPrompt && (
              <pre style={{
                marginTop: 12, background: '#1e1b18', color: '#d6d3d1', borderRadius: 10,
                padding: 14, fontSize: 11, lineHeight: 1.5, overflow: 'auto', maxHeight: 400,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {buildPrompt()}
              </pre>
            )}
          </div>

          {/* Refresh / Clear controls */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => {
              failedRef.current = false;
              setError(null);
              setBaziData(null); setYogasData(null); setDashaData(null);
              setPanchangData(null); setMoonData(null);
              [LS.BAZI, LS.YOGAS, LS.DASHA, LS.PANCHANG, LS.MOON].forEach(k => localStorage.removeItem(k));
              fetchAll();
            }} style={{
              background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8,
              padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#374151',
            }}>
              Refresh All
            </button>
            <button onClick={() => {
              [LS.BAZI, LS.YOGAS, LS.DASHA, LS.PANCHANG, LS.MOON, LS.NATAL].forEach(k => localStorage.removeItem(k));
              setBaziData(null); setYogasData(null); setDashaData(null);
              setPanchangData(null); setMoonData(null); setNatalData(null);
              failedRef.current = false;
              setError(null);
            }} style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '6px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#dc2626',
            }}>
              Clear All Caches
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
