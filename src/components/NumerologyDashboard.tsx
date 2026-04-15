/**
 * NumerologyDashboard — "Your Numbers" section.
 *
 * Four visual cards:
 *   1. Number Signature (static, cached forever)
 *   2. Personal Cycles — Year / Month / Day wheel
 *   3. Today's Numbers — quick daily glance + lucky numbers
 *   4. Karmic Map — debt + lessons
 *
 * 100 % client-side calculations (no API required).
 * Standalone file — safe to delete if feature is removed.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { getUserSettings } from '../storage';
import {
  calculateFullProfile,
  type NumerologyProfile,
} from '../numerology/numerologyEngine';
import {
  NUMBER_MEANINGS,
  SIGNATURE_LABELS,
  SIGNATURE_DESCRIPTIONS,
  YEAR_CYCLE_LABELS,
  KARMIC_DEBT_MEANINGS,
  KARMIC_LESSON_MEANINGS,
  getMeaning,
} from '../numerology/numerologyMeanings';

// ── Types ────────────────────────────────────────────────────────────────────

interface BirthInfo {
  year: number;
  month: number;
  day: number;
}

// ── Name input modal (inline) ────────────────────────────────────────────────

function NamePrompt({ onSubmit, initialName, theme }: { onSubmit: (name: string) => void; initialName: string; theme: any }) {
  const [name, setName] = useState(initialName);
  const bg = theme.colors.cardBg;
  const border = theme.colors.cardBorder;
  const text = theme.colors.text;
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: 20, maxWidth: 400, margin: '0 auto' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 8 }}>Enter your full name</div>
      <div style={{ fontSize: 11, color: theme.colors.textLight, marginBottom: 12 }}>
        Used for Expression, Soul Urge, and Personality numbers. Only letters matter — spaces and punctuation are ignored.
      </div>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Nitin Kumar"
        style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: `1px solid ${border}`, background: theme.colors.background, color: text, boxSizing: 'border-box' }}
      />
      <button
        onClick={() => { if (name.trim().length >= 2) onSubmit(name.trim()); }}
        disabled={name.trim().length < 2}
        style={{ marginTop: 10, width: '100%', padding: '8px 0', borderRadius: 8, border: 'none', background: theme.colors.primary, color: '#fff', fontWeight: 700, fontSize: 12, cursor: name.trim().length >= 2 ? 'pointer' : 'not-allowed', opacity: name.trim().length >= 2 ? 1 : 0.5 }}
      >Calculate My Numbers</button>
    </div>
  );
}

// ── Shared helpers ───────────────────────────────────────────────────────────

const MASTER_SET = new Set([11, 22, 33]);
function isMaster(n: number) { return MASTER_SET.has(n); }

function NumberBadge({ n, size = 36, color, glow, label, theme }: { n: number; size?: number; color: string; glow?: boolean; label?: string; theme: any }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: color, color: '#fff', fontWeight: 800, fontSize: size * 0.42, fontFamily: 'monospace',
        boxShadow: glow ? `0 0 12px ${color}88, 0 0 24px ${color}44` : `0 1px 4px ${color}44`,
        border: isMaster(n) ? '2px solid #F59E0B' : 'none',
      }}>
        {n}
      </div>
      {label && <div style={{ fontSize: 8, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', maxWidth: size + 20 }}>{label}</div>}
    </div>
  );
}

// ── Card 1: Number Signature ─────────────────────────────────────────────────

function SignatureCard({ profile, theme }: { profile: NumerologyProfile; theme: any }) {
  const nums = profile.signatureNumbers;
  const bg = theme.colors.cardBg;
  const border = theme.colors.cardBorder;
  const text = theme.colors.text;
  const muted = theme.colors.textLight;

  const maxVal = Math.max(...nums, 12);
  const w = 280;
  const h = 80;
  const points = nums.map((n, i) => {
    const x = (i / (nums.length - 1)) * w;
    const y = h - (n / maxVal) * (h - 10) - 5;
    return { x, y, n };
  });
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>
          Card 1 — Your Number Signature
        </div>
        <div style={{ fontSize: 9, color: muted }}>Static · Cached forever after first load</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: text }}>Your number signature</div>
        <div style={{ fontSize: 10, color: muted }}>Numerology Profile — {dateStr}</div>
      </div>

      {/* Signature line graph */}
      <div style={{ background: theme.colors.background, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
        <svg viewBox={`-10 -10 ${w + 20} ${h + 20}`} width="100%" style={{ maxHeight: 100 }}>
          <path d={pathD} fill="none" stroke={theme.colors.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => {
            const meaning = getMeaning(nums[i]);
            return (
              <g key={i}>
                {isMaster(nums[i]) && (
                  <circle cx={p.x} cy={p.y} r={18} fill="none" stroke="#F59E0B" strokeWidth={1.5} opacity={0.5} />
                )}
                <circle cx={p.x} cy={p.y} r={12} fill={meaning?.color || theme.colors.primary} />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={800} fontFamily="monospace">{nums[i]}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Number cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
        {SIGNATURE_LABELS.map((label, i) => {
          const n = nums[i];
          const meaning = getMeaning(n);
          return (
            <div key={label} style={{ background: theme.colors.background, borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${meaning?.color || '#6B7280'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: meaning?.color || '#6B7280', color: '#fff', fontWeight: 800, fontSize: 13, fontFamily: 'monospace',
                  boxShadow: isMaster(n) ? `0 0 10px ${meaning?.color}88` : undefined,
                  border: isMaster(n) ? '2px solid #F59E0B' : 'none',
                }}>
                  {n}
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: text, textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 9, color: muted }}>{meaning?.keyword}</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: muted, lineHeight: 1.4 }}>{SIGNATURE_DESCRIPTIONS[label]}</div>
            </div>
          );
        })}
      </div>

      {/* Combined reading */}
      <div style={{ marginTop: 12, background: theme.colors.background, borderRadius: 10, padding: 12, fontSize: 11, color: muted, lineHeight: 1.6 }}>
        <strong style={{ color: text }}>Combined reading:</strong>{' '}
        A {getMeaning(profile.lifePath)?.keyword} Life Path with {getMeaning(profile.expression)?.keyword} Expression — {getMeaning(profile.soulUrge)?.keyword} drives wrapped in {getMeaning(profile.personality)?.keyword} perception.
        {isMaster(profile.lifePath) && ` Your Life Path ${profile.lifePath} is a Master Number — you carry amplified spiritual potential.`}
        {isMaster(profile.maturity) && ` Master Maturity ${profile.maturity} suggests your later years hold extraordinary purpose.`}
        {' '}The {getMeaning(profile.birthday)?.keyword} Birthday Number suggests a special gift for {getMeaning(profile.birthday)?.shortDesc.toLowerCase().slice(0, 60)}.
      </div>
    </div>
  );
}

// ── Card 2: Personal Cycles ──────────────────────────────────────────────────

function CyclesCard({ profile, theme }: { profile: NumerologyProfile; theme: any }) {
  const bg = theme.colors.cardBg;
  const border = theme.colors.cardBorder;
  const text = theme.colors.text;
  const muted = theme.colors.textLight;
  const now = new Date();
  const yearStr = `${now.getFullYear()}`;
  const monthStr = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const dayStr = now.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  const py = profile.personalYear;
  const pm = profile.personalMonth;
  const pd = profile.personalDay;
  const pyMeaning = getMeaning(py);
  const pmMeaning = getMeaning(pm);
  const pdMeaning = getMeaning(pd);

  // 9-year wheel SVG
  const cx = 120, cy = 120, r = 95;
  const segments = Array.from({ length: 9 }, (_, i) => i + 1);

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>
          Card 2 — Where you are in your cycles right now
        </div>
        <div style={{ fontSize: 9, color: muted }}>Updates daily</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: text, marginBottom: 12 }}>Your personal cycles</div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* 9-segment wheel */}
        <div style={{ flexShrink: 0 }}>
          <svg width={240} height={240} viewBox="0 0 240 240" style={{ maxWidth: '100%' }}>
            {segments.map(n => {
              const startAngle = ((n - 1) / 9) * 360 - 90;
              const endAngle = (n / 9) * 360 - 90;
              const midAngle = (startAngle + endAngle) / 2;
              const rad1 = (startAngle * Math.PI) / 180;
              const rad2 = (endAngle * Math.PI) / 180;
              const radM = (midAngle * Math.PI) / 180;
              const isActive = n === py;
              const meaning = getMeaning(n);
              const innerR = 50;
              const outerR = isActive ? r + 4 : r;

              const x1o = cx + outerR * Math.cos(rad1);
              const y1o = cy + outerR * Math.sin(rad1);
              const x2o = cx + outerR * Math.cos(rad2);
              const y2o = cy + outerR * Math.sin(rad2);
              const x1i = cx + innerR * Math.cos(rad2);
              const y1i = cy + innerR * Math.sin(rad2);
              const x2i = cx + innerR * Math.cos(rad1);
              const y2i = cy + innerR * Math.sin(rad1);
              const largeArc = endAngle - startAngle > 180 ? 1 : 0;

              const labelR = (innerR + outerR) / 2;
              const lx = cx + labelR * Math.cos(radM);
              const ly = cy + labelR * Math.sin(radM);

              return (
                <g key={n}>
                  <path
                    d={`M${x1o},${y1o} A${outerR},${outerR} 0 ${largeArc},1 ${x2o},${y2o} L${x1i},${y1i} A${innerR},${innerR} 0 ${largeArc},0 ${x2i},${y2i} Z`}
                    fill={isActive ? meaning.color : `${meaning.color}22`}
                    stroke={isActive ? meaning.color : border}
                    strokeWidth={isActive ? 2 : 0.5}
                    opacity={isActive ? 1 : 0.6}
                  />
                  <text x={lx} y={ly - 4} textAnchor="middle" dominantBaseline="central" fill={isActive ? '#fff' : muted} fontSize={isActive ? 14 : 11} fontWeight={isActive ? 800 : 600} fontFamily="monospace">
                    {n}
                  </text>
                  <text x={lx} y={ly + 9} textAnchor="middle" dominantBaseline="central" fill={isActive ? '#ffffffcc' : `${muted}88`} fontSize={7} fontWeight={500}>
                    {YEAR_CYCLE_LABELS[n]}
                  </text>
                </g>
              );
            })}
            {/* Center label */}
            <text x={cx} y={cy - 6} textAnchor="middle" fill={text} fontSize={10} fontWeight={700}>Year {py}</text>
            <text x={cx} y={cy + 8} textAnchor="middle" fill={muted} fontSize={8}>{yearStr}</text>
          </svg>
        </div>

        {/* Cycle details */}
        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Personal Year */}
          <div style={{ background: theme.colors.background, borderRadius: 10, padding: 12, borderLeft: `3px solid ${pyMeaning.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <NumberBadge n={py} size={32} color={pyMeaning.color} glow theme={theme} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: text }}>Personal Year {py} — {pyMeaning.keyword}</div>
                <div style={{ fontSize: 9, color: muted }}>Year cycle position: {py} of 9</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: muted, lineHeight: 1.5 }}>{pyMeaning.yearAdvice}</div>
            <div style={{ marginTop: 6, fontSize: 9, fontWeight: 700, color: text, textTransform: 'uppercase' }}>This year is best for:</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {pyMeaning.bestFor.map(tag => (
                <span key={tag} style={{ background: `${pyMeaning.color}22`, color: pyMeaning.color, padding: '2px 8px', borderRadius: 10, fontSize: 9, fontWeight: 600 }}>{tag}</span>
              ))}
            </div>
          </div>

          {/* Personal Month */}
          <div style={{ background: theme.colors.background, borderRadius: 10, padding: 12, borderLeft: `3px solid ${pmMeaning.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <NumberBadge n={pm} size={28} color={pmMeaning.color} theme={theme} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: text }}>Personal Month — {monthStr}</div>
                <div style={{ fontSize: 9, color: muted }}>Month {pm}: {pmMeaning.keyword}</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: muted, lineHeight: 1.5 }}>{pmMeaning.monthAdvice}</div>
          </div>

          {/* Personal Day */}
          <div style={{ background: theme.colors.background, borderRadius: 10, padding: 12, borderLeft: `3px solid ${pdMeaning.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <NumberBadge n={pd} size={28} color={pdMeaning.color} theme={theme} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: text }}>Personal Day — {dayStr}</div>
                <div style={{ fontSize: 9, color: muted }}>{pdMeaning.keyword}</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: muted, lineHeight: 1.5 }}>{pdMeaning.dayAdvice}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card 3: Today's Numbers ──────────────────────────────────────────────────

function TodayCard({ profile, theme }: { profile: NumerologyProfile; theme: any }) {
  const bg = theme.colors.cardBg;
  const border = theme.colors.cardBorder;
  const text = theme.colors.text;
  const muted = theme.colors.textLight;
  const now = new Date();
  const dayStr = now.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });

  const pd = profile.personalDay;
  const pm = profile.personalMonth;
  const py = profile.personalYear;
  const pdM = getMeaning(pd);
  const pmM = getMeaning(pm);
  const pyM = getMeaning(py);

  const items = [
    { label: 'Personal Day', n: pd, color: pdM.color, sub: pdM.keyword },
    { label: 'Day Match', n: pm, color: pmM.color, sub: 'Monthly energy' },
    { label: 'Personal Year', n: py, color: pyM.color, sub: pyM.keyword },
  ];

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>
          Card 3 — Today's Numbers Dashboard
        </div>
        <div style={{ fontSize: 9, color: muted }}>Live · 1 API call daily</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: text, marginBottom: 12 }}>Today's numbers — {dayStr}</div>

      {/* Number row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
        {items.map(item => (
          <div key={item.label} style={{ background: theme.colors.background, borderRadius: 10, padding: 12, textAlign: 'center' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: item.color, color: '#fff', fontWeight: 800, fontSize: 20, fontFamily: 'monospace',
              margin: '0 auto 8px', boxShadow: `0 2px 10px ${item.color}44`,
            }}>
              {item.n}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: text }}>{item.label}</div>
            <div style={{ fontSize: 9, color: muted }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Daily energy */}
      <div style={{ background: theme.colors.background, borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: text, marginBottom: 4 }}>
          Day energy: {pdM.keyword}
        </div>
        <div style={{ fontSize: 10, color: muted, lineHeight: 1.5 }}>{pdM.dayAdvice}</div>
      </div>

      {/* Lucky numbers */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Lucky numbers today</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {profile.luckyNumbers.map((n, i) => {
            const hue = (i * 60 + 200) % 360;
            return (
              <div key={i} style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `hsl(${hue}, 60%, 50%)`, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'monospace',
                boxShadow: `0 1px 6px hsl(${hue}, 60%, 50%, 0.3)`,
              }}>
                {n}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Card 4: Karmic Map ───────────────────────────────────────────────────────

function KarmicCard({ profile, theme }: { profile: NumerologyProfile; theme: any }) {
  const bg = theme.colors.cardBg;
  const border = theme.colors.cardBorder;
  const text = theme.colors.text;
  const muted = theme.colors.textLight;

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>
          Card 4 — Karmic Map
        </div>
        <div style={{ fontSize: 9, color: muted }}>Static · Never changes · Loaded once</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: text, marginBottom: 12 }}>Your karmic map</div>

      {/* Karmic Debts */}
      {profile.karmicDebts.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: theme.colors.danger, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>Karmic Debt</div>
          {profile.karmicDebts.map(d => {
            const info = KARMIC_DEBT_MEANINGS[d];
            if (!info) return null;
            return (
              <div key={d} style={{ background: `${theme.colors.danger}11`, border: `1px solid ${theme.colors.danger}33`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: theme.colors.danger, color: '#fff', fontWeight: 800, fontSize: 16, fontFamily: 'monospace',
                  }}>
                    {d}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: text }}>Karmic Debt {d}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: theme.colors.danger }}>{info.title}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: muted, lineHeight: 1.6 }}>{info.description}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: `${theme.colors.success}11`, border: `1px solid ${theme.colors.success}33`, borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 11, color: theme.colors.success }}>
          No karmic debts detected — clean slate!
        </div>
      )}

      {/* Karmic Lessons */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: theme.colors.warning, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
          Karmic Lessons — Numbers missing from your birth name
        </div>
        {profile.karmicLessons.length === 0 ? (
          <div style={{ fontSize: 11, color: theme.colors.success }}>All 9 numbers present in your name — no karmic lessons!</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {profile.karmicLessons.map(n => {
              const info = KARMIC_LESSON_MEANINGS[n];
              const meaning = getMeaning(n);
              return (
                <div key={n} style={{ background: theme.colors.background, borderRadius: 10, padding: 10, borderLeft: `3px solid ${meaning.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: meaning.color, color: '#fff', fontWeight: 800, fontSize: 12, fontFamily: 'monospace',
                    }}>{n}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: text }}>{info?.keyword}</div>
                  </div>
                  <div style={{ fontSize: 9, color: muted, lineHeight: 1.4 }}>{info?.description}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export default function NumerologyDashboard() {
  const { theme } = useTheme();
  const { username } = useUser();
  const [birth, setBirth] = useState<BirthInfo | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load birth data
  useEffect(() => {
    getUserSettings().then(s => {
      if (s.birthData?.year && s.birthData?.month && s.birthData?.day) {
        setBirth({ year: s.birthData.year, month: s.birthData.month, day: s.birthData.day });
      }
      // Try to recover stored name from localStorage
      const storedName = localStorage.getItem('myday_numerology_name');
      if (storedName) setFullName(storedName);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleNameSubmit = (name: string) => {
    setFullName(name);
    localStorage.setItem('myday_numerology_name', name);
  };

  const profile = useMemo<NumerologyProfile | null>(() => {
    if (!birth || !fullName) return null;
    return calculateFullProfile(birth.year, birth.month, birth.day, fullName);
  }, [birth, fullName]);

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: theme.colors.textLight, fontSize: 12 }}>Loading...</div>;
  }

  if (!birth) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: theme.colors.text, fontWeight: 600, marginBottom: 6 }}>Birth date required</div>
        <div style={{ fontSize: 11, color: theme.colors.textLight }}>
          Go to Settings and enter your date of birth to unlock Numerology.
        </div>
      </div>
    );
  }

  if (!fullName) {
    return (
      <div style={{ padding: 16 }}>
        <NamePrompt onSubmit={handleNameSubmit} initialName={username || ''} theme={theme} />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SignatureCard profile={profile} theme={theme} />
      <CyclesCard profile={profile} theme={theme} />
      <TodayCard profile={profile} theme={theme} />
      <KarmicCard profile={profile} theme={theme} />

      {/* Change name link */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={() => { setFullName(null); localStorage.removeItem('myday_numerology_name'); }}
          style={{ background: 'none', border: 'none', color: theme.colors.textLight, fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }}
        >
          Change name used for calculations
        </button>
      </div>
    </div>
  );
}
