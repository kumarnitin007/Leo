/**
 * Cosmic Day Planner — blends astro data with tasks/events/weather
 * into an engaging, actionable overview.
 *
 * Reads from the same localStorage caches as AstroWidget (no extra API calls).
 * Receives tasks + events as props from TodayView.
 */

import React, { useState, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { Task, Event } from '../types';

/* ── Cache keys (shared with AstroWidget) ──────────────────────── */
const DAILY_CACHE_KEY = 'astro_daily_cache';
const MOON_CACHE_KEY = 'astro_moon_cache';
const NATAL_CACHE_KEY = 'astro_natal_cache';

function getDayCached(key: string): any | null {
  try {
    const r = localStorage.getItem(key);
    if (!r) return null;
    const parsed = JSON.parse(r);
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return null;
    return parsed.data;
  } catch { return null; }
}

/* ── Helpers ────────────────────────────────────────────────────── */
const SIGN_EMOJI: Record<string, string> = {
  aries: '♈', taurus: '♉', gemini: '♊', cancer: '♋',
  leo: '♌', virgo: '♍', libra: '♎', scorpio: '♏',
  sagittarius: '♐', capricorn: '♑', aquarius: '♒', pisces: '♓',
};
function signEmoji(s: string): string { return SIGN_EMOJI[s?.toLowerCase()] || '⭐'; }

function moonPhaseEmoji(name: string): string {
  const n = (name || '').toLowerCase();
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

const PHASE_ENERGY: Record<string, { vibe: string; action: string; icon: string }> = {
  'new moon':        { vibe: 'Fresh Start', action: 'Set intentions, begin new projects', icon: '🌱' },
  'waxing crescent': { vibe: 'Building',    action: 'Take first steps, gather resources', icon: '🚀' },
  'first quarter':   { vibe: 'Challenge',   action: 'Push through obstacles, make decisions', icon: '⚡' },
  'waxing gibbous':  { vibe: 'Refining',    action: 'Fine-tune, adjust plans, persist', icon: '🔧' },
  'full moon':       { vibe: 'Peak Energy',  action: 'Celebrate wins, release what doesn\'t serve you', icon: '✨' },
  'waning gibbous':  { vibe: 'Gratitude',   action: 'Share knowledge, mentor, give back', icon: '🙏' },
  'last quarter':    { vibe: 'Letting Go',   action: 'Declutter, forgive, wrap up projects', icon: '🍂' },
  'waning crescent': { vibe: 'Rest',        action: 'Recharge, reflect, journal', icon: '🧘' },
};

function getPhaseEnergy(phaseName: string) {
  const key = Object.keys(PHASE_ENERGY).find(k => phaseName.toLowerCase().includes(k));
  return key ? PHASE_ENERGY[key] : { vibe: 'Flow', action: 'Trust the process', icon: '🌊' };
}

interface CosmicDayPlannerProps {
  tasks: Task[];
  events: Array<{ event: Event; isToday: boolean }>;
  completedTaskIds: Set<string>;
  weatherSummary?: string;
}

const CosmicDayPlanner: React.FC<CosmicDayPlannerProps> = ({ tasks, events, completedTaskIds, weatherSummary }) => {
  const { theme } = useTheme();
  const isWP = theme.id === 'warm-paper';
  const [isExpanded, setIsExpanded] = useState(false);

  const daily = useMemo(() => getDayCached(DAILY_CACHE_KEY), []);
  const moon = useMemo(() => getDayCached(MOON_CACHE_KEY), []);
  const natal = useMemo(() => {
    try { const r = localStorage.getItem(NATAL_CACHE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  }, []);

  const scores = daily?.data?.scores;
  const content = daily?.data?.content;
  const astro = daily?.data?.astro;

  if (!daily && !moon) return null;

  const pendingTasks = tasks.filter(t => !completedTaskIds.has(t.id));
  const todayEvents = events.filter(e => e.isToday);
  const phaseEnergy = moon?.phase ? getPhaseEnergy(moon.phase.name) : null;
  const sunSign = natal?.planets?.find((p: any) => p.id === 'sun');
  const moonSign = moon?.zodiac;
  const illumination = moon?.phase?.illumination != null ? Math.round(moon.phase.illumination * 100) : null;

  /* Map scores to task categories */
  const taskTimingHints = useMemo(() => {
    if (!scores) return [];
    const hints: Array<{ icon: string; text: string; score: number }> = [];

    if (scores.career >= 80 && pendingTasks.length > 0) {
      hints.push({ icon: '💼', text: `High career energy (${scores.career}/100) — great day to tackle challenging work tasks`, score: scores.career });
    }
    if (scores.love >= 80 && todayEvents.length > 0) {
      hints.push({ icon: '💖', text: `Love score is ${scores.love}/100 — social events today will go especially well`, score: scores.love });
    }
    if (scores.health >= 85) {
      hints.push({ icon: '🏃', text: `Health energy peaks at ${scores.health}/100 — ideal for fitness or outdoor activities`, score: scores.health });
    }
    if (scores.money >= 80) {
      hints.push({ icon: '💰', text: `Financial clarity at ${scores.money}/100 — good time for money decisions`, score: scores.money });
    }
    if (scores.overall < 60) {
      hints.push({ icon: '🧘', text: `Cosmic energy is moderate (${scores.overall}/100) — pace yourself, focus on essentials`, score: scores.overall });
    }

    return hints;
  }, [scores, pendingTasks.length, todayEvents.length]);

  /* Cosmic summary line for collapsed header */
  const collapsedSummary = phaseEnergy
    ? `${phaseEnergy.icon} ${phaseEnergy.vibe}${scores ? ` · ${scores.overall}/100` : ''}`
    : scores ? `${scores.overall}/100 energy` : '';

  return (
    <div style={{
      marginTop: isWP ? '0.75rem' : '1rem',
      background: isWP ? '#ffffff' : 'rgba(255,255,255,0.95)',
      borderRadius: 12,
      border: isWP ? '1px solid #E5E3DC' : '1px solid rgba(0,0,0,0.1)',
      overflow: 'hidden',
    }}>
      {/* ── Header ───────────────────────────────────────────────── */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: isWP ? '10px 16px' : '12px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <span style={{ fontSize: 14 }}>🌌</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: theme.colors.text }}>Cosmic Day Planner</span>
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
          {/* ── Energy Dashboard ──────────────────────────────────── */}
          <div style={{
            background: isWP ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            padding: '16px 20px',
            color: 'white',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              {/* Left: Phase + vibe */}
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: 4 }}>
                  Today's Cosmic Weather
                </div>
                {phaseEnergy && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 28 }}>{moonPhaseEmoji(moon?.phase?.name || '')}</span>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{phaseEnergy.vibe}</div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>{moon?.phase?.name}{illumination != null ? ` · ${illumination}% lit` : ''}</div>
                    </div>
                  </div>
                )}
                {moonSign && (
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                    Moon in {moonSign.sign} {signEmoji(moonSign.sign)} · {moon?.phase?.is_waxing ? '↑ Waxing' : '↓ Waning'}
                  </div>
                )}
              </div>

              {/* Right: Score dial */}
              {scores && (
                <div style={{ textAlign: 'center', minWidth: 70 }}>
                  <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{scores.overall}</div>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>/100 energy</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'center' }}>
                    {[
                      { label: '❤️', val: scores.love },
                      { label: '💼', val: scores.career },
                      { label: '💰', val: scores.money },
                      { label: '💚', val: scores.health },
                    ].map((s, i) => (
                      <span key={i} style={{ fontSize: 9, opacity: 0.7 }}>{s.label}{s.val}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Phase action */}
            {phaseEnergy && (
              <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px' }}>
                <span style={{ fontSize: 13 }}>{phaseEnergy.icon}</span>
                <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.9 }}>{phaseEnergy.action}</span>
              </div>
            )}

            {weatherSummary && (
              <div style={{ marginTop: 6, fontSize: 10, opacity: 0.5 }}>
                🌤 {weatherSummary}
              </div>
            )}
          </div>

          {/* ── Cosmic Timing Hints ─────────────────────────────── */}
          {taskTimingHints.length > 0 && (
            <div style={{ padding: '12px 20px', borderBottom: `0.5px solid ${theme.colors.cardBorder}` }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Cosmic Timing for Your Day
              </div>
              {taskTimingHints.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, fontSize: 11, color: theme.colors.text, lineHeight: 1.5 }}>
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: -1 }}>{h.icon}</span>
                  <span>{h.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Active Transits → Task mapping ──────────────────── */}
          {astro?.transits?.length > 0 && pendingTasks.length > 0 && (
            <div style={{ padding: '12px 20px', borderBottom: `0.5px solid ${theme.colors.cardBorder}` }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Planetary Influence on Your Tasks
              </div>
              {astro.transits.slice(0, 3).map((t: any, i: number) => {
                const taskMatch = pendingTasks[i % pendingTasks.length];
                return (
                  <div key={i} style={{ background: isWP ? '#faf8f4' : '#f9fafb', borderRadius: 8, padding: '8px 12px', marginBottom: 6, border: `0.5px solid ${theme.colors.cardBorder}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.text }}>
                      {t.transit || t.name || `Transit ${i + 1}`}
                    </div>
                    <div style={{ fontSize: 10, color: theme.colors.textLight, marginTop: 2, lineHeight: 1.4 }}>
                      {(t.description || t.short || '').slice(0, 120)}{(t.description || t.short || '').length > 120 ? '…' : ''}
                    </div>
                    {taskMatch && (
                      <div style={{ fontSize: 10, marginTop: 4, color: isWP ? '#92400e' : '#6366f1', fontWeight: 500 }}>
                        → Align with: "{taskMatch.name}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Today's Cosmic Agenda ────────────────────────────── */}
          <div style={{ padding: '12px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Your Cosmic Agenda
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {/* Tasks card */}
              <div style={{ background: isWP ? '#faf8f4' : '#f0fdf4', borderRadius: 8, padding: '10px 12px', border: `0.5px solid ${theme.colors.cardBorder}` }}>
                <div style={{ fontSize: 22, marginBottom: 2 }}>📋</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.text }}>{pendingTasks.length} task{pendingTasks.length !== 1 ? 's' : ''} pending</div>
                <div style={{ fontSize: 10, color: theme.colors.textLight }}>{completedTaskIds.size} completed today</div>
              </div>

              {/* Events card */}
              <div style={{ background: isWP ? '#faf8f4' : '#eff6ff', borderRadius: 8, padding: '10px 12px', border: `0.5px solid ${theme.colors.cardBorder}` }}>
                <div style={{ fontSize: 22, marginBottom: 2 }}>📅</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.text }}>{todayEvents.length} event{todayEvents.length !== 1 ? 's' : ''} today</div>
                {todayEvents.length > 0 && (
                  <div style={{ fontSize: 10, color: theme.colors.textLight, marginTop: 2 }}>
                    {todayEvents.slice(0, 2).map(e => e.event.name).join(', ')}
                  </div>
                )}
              </div>

              {/* Moon energy card */}
              {phaseEnergy && (
                <div style={{ background: isWP ? '#faf8f4' : '#faf5ff', borderRadius: 8, padding: '10px 12px', border: `0.5px solid ${theme.colors.cardBorder}` }}>
                  <div style={{ fontSize: 22, marginBottom: 2 }}>{moonPhaseEmoji(moon?.phase?.name || '')}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.text }}>{phaseEnergy.vibe}</div>
                  <div style={{ fontSize: 10, color: theme.colors.textLight }}>{phaseEnergy.action.split(',')[0]}</div>
                </div>
              )}

              {/* Traditional moon */}
              {moon?.traditional_moon?.name && (
                <div style={{ background: isWP ? '#faf8f4' : '#fffbeb', borderRadius: 8, padding: '10px 12px', border: `0.5px solid ${theme.colors.cardBorder}` }}>
                  <div style={{ fontSize: 22, marginBottom: 2 }}>🌕</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: theme.colors.text }}>{moon.traditional_moon.name}</div>
                  <div style={{ fontSize: 10, color: theme.colors.textLight }}>{moon.traditional_moon.month}</div>
                </div>
              )}
            </div>
          </div>

          {/* ── Focus keywords from daily ──────────────────────── */}
          {content?.keywords?.length > 0 && (
            <div style={{ padding: '0 20px 14px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {content.keywords.map((kw: string, i: number) => (
                <span key={i} style={{
                  fontSize: 9,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: isWP ? '#fef3c7' : '#ede9fe',
                  color: isWP ? '#92400e' : '#5b21b6',
                  fontWeight: 500,
                }}>
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CosmicDayPlanner;
