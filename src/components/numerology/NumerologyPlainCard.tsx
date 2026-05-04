/**
 * NumerologyPlainCard — the new top card for the Numerology dashboard.
 *
 * Replaces the previous "wall of numbers" first-impression with:
 *   1. ✨ Today's vibe — 3-4 sentence AI paragraph (cached daily)
 *   2. 🎯 Your day at a glance — the 10 deterministic statements
 *   3. ❓ Your questions — up to NUMEROLOGY_CUSTOM_Q_MAX user questions
 *      with daily-cached AI answers (`CustomQuestionsCard`)
 *
 * The original 4 technical cards (Signature, Cycles, Today's numbers, Karmic
 * map) live underneath behind a "Show the math ↓" toggle so power users can
 * still see them. Default = collapsed.
 *
 * Performance:
 *   - perfStart('NumerologyPlainCard', 'render') — should stay under ~5 ms
 *     (zero-async on first paint; the AI vibe is fetched lazily after).
 *   - perfStart('NumerologyPlainCard', 'view') — view dwell time.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { perfStart } from '../../utils/perfLogger';
import {
  buildPlainStatements,
  type PlainStatement,
} from '../../numerology/numerologyInsights';
import { getDailyVibe } from '../../numerology/numerologyAIInsights';
import type { NumerologyProfile } from '../../numerology/numerologyEngine';
import CustomQuestionsCard from './CustomQuestionsCard';

interface Props {
  profile: NumerologyProfile;
  theme: any;
}

const NumerologyPlainCard: React.FC<Props> = ({ profile, theme }) => {
  const renderEnd = useRef(perfStart('NumerologyPlainCard', 'render'));
  const viewEnd = useRef(perfStart('NumerologyPlainCard', 'view'));
  useEffect(() => {
    renderEnd.current();
    return () => { viewEnd.current(); };
  }, []);

  const { user } = useAuth();
  const userId = user?.id ?? null;

  const today = useMemo(() => new Date(), []);
  const statements: PlainStatement[] = useMemo(
    () => buildPlainStatements(profile, today),
    [profile, today],
  );

  const [vibe, setVibe] = useState<string | null>(null);
  const [vibeLoading, setVibeLoading] = useState(true);
  const [vibeFromCache, setVibeFromCache] = useState(false);

  // Lazy-load the AI paragraph after the deterministic UI has painted.
  useEffect(() => {
    let alive = true;
    setVibeLoading(true);
    getDailyVibe(profile, userId, today).then((res) => {
      if (!alive) return;
      if (res) {
        setVibe(res.paragraph);
        setVibeFromCache(res.fromCache);
      }
      setVibeLoading(false);
    });
    return () => { alive = false; };
  }, [profile.lifePath, profile.personalDay, profile.personalMonth, profile.personalYear, userId]);

  const text = theme.colors.text;
  const muted = theme.colors.textLight;
  const cardBg = theme.colors.cardBg;
  const border = theme.colors.cardBorder;
  const bgSoft = theme.colors.background;

  // Bucket the 10 statements into 4 visual groups so the card has rhythm.
  const dayChips      = statements.slice(0, 5); // Lucky, BestDay, Color, Stone, Hours
  const compatChip    = statements[5];
  const yearChip      = statements[6];
  const todayChip     = statements[7];
  const watchOutChip  = statements[8];
  const affirmationChip = statements[9];

  return (
    <div
      style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 1 }}>
            Your numerology in plain English
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: text, marginTop: 2 }}>
            What your numbers mean for today
          </div>
        </div>
        <div style={{ fontSize: 9, color: muted }}>
          {today.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* ── 1. AI vibe paragraph ── */}
      <div
        style={{
          background: bgSoft,
          borderRadius: 12,
          padding: 14,
          border: `1px solid ${border}`,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
          ✨ Today's vibe
        </div>
        {vibeLoading && (
          <div style={{ fontSize: 12, color: muted, fontStyle: 'italic' }}>
            Reading your numbers…
          </div>
        )}
        {!vibeLoading && vibe && (
          <div style={{ fontSize: 13, color: text, lineHeight: 1.65 }}>{vibe}</div>
        )}
        {!vibeLoading && !vibe && (
          <div style={{ fontSize: 11, color: muted, fontStyle: 'italic' }}>
            Couldn't synthesise a daily vibe right now — your day-at-a-glance below is still up to date.
          </div>
        )}
        {vibeFromCache && vibe && (
          <div style={{ fontSize: 9, color: muted, marginTop: 6, textAlign: 'right' }}>
            Cached for today — refreshes tomorrow
          </div>
        )}
      </div>

      {/* ── 2. Day at a glance (chips) ── */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
          🎯 Your day at a glance
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {dayChips.map((s) => (
            <Chip key={s.label} statement={s} theme={theme} />
          ))}
        </div>
      </div>

      {/* ── 3. Compatibility ── */}
      {compatChip && (
        <BlockRow icon="💞" title="Compatibility" body={compatChip.text} theme={theme} accent={compatChip.color} />
      )}

      {/* ── 4. This year & today's energy ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {yearChip  && <BlockRow icon="🧭" title="This year"      body={yearChip.text}  theme={theme} accent={yearChip.color} />}
        {todayChip && <BlockRow icon="✨" title="Today's energy" body={todayChip.text} theme={theme} accent={todayChip.color} />}
      </div>

      {/* ── 5. Watch out for / Affirmation ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
        {watchOutChip    && <BlockRow icon="✋" title="Watch out for" body={watchOutChip.text}    theme={theme} accent={watchOutChip.color} />}
        {affirmationChip && <BlockRow icon="🌅" title="Affirmation"    body={affirmationChip.text} theme={theme} accent={affirmationChip.color} />}
      </div>

      {/* ── 6. Custom questions ── */}
      <CustomQuestionsCard profile={profile} userId={userId} theme={theme} />
    </div>
  );
};

// ── Sub-components ───────────────────────────────────────────────────────────

const Chip: React.FC<{ statement: PlainStatement; theme: any }> = ({ statement, theme }) => {
  const accent = statement.color || theme.colors.primary;
  return (
    <div
      style={{
        background: theme.colors.background,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 8,
        padding: '8px 10px',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
        {statement.icon} {statement.label}
      </div>
      <div style={{ fontSize: 12, color: theme.colors.text, lineHeight: 1.5 }}>
        {statement.text}
      </div>
    </div>
  );
};

const BlockRow: React.FC<{
  icon: string;
  title: string;
  body: string;
  theme: any;
  accent?: string;
}> = ({ icon, title, body, theme, accent }) => {
  const c = accent || theme.colors.primary;
  return (
    <div
      style={{
        background: theme.colors.background,
        borderLeft: `3px solid ${c}`,
        borderRadius: 10,
        padding: '10px 12px',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: 12, color: theme.colors.text, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
};

export default NumerologyPlainCard;
