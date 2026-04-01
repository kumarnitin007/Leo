/**
 * Journal Shared Components
 *
 * Reusable UI pieces used by both desktop and mobile journal layouts:
 * MoodPicker, EnergyPicker, ActivityChips, WriteArea, StreakWidget, TagPicker
 */

import React, { useState } from 'react';
import type { MoodType, Tag } from '../../types';
import { JOURNAL_ACTIVITIES } from '../../types';

// ── Constants ─────────────────────────────────────────────────────────

export const MOOD_OPTIONS = [
  { key: 'great' as MoodType, emoji: '😄', label: 'Great' },
  { key: 'good' as MoodType, emoji: '😊', label: 'Good' },
  { key: 'okay' as MoodType, emoji: '😐', label: 'Okay' },
  { key: 'bad' as MoodType, emoji: '😔', label: 'Bad' },
  { key: 'terrible' as MoodType, emoji: '😟', label: 'Terrible' },
] as const;

export const ENERGY_OPTIONS = [
  { value: 1 as const, emoji: '🪫', label: 'Low' },
  { value: 2 as const, emoji: '⚡', label: 'Medium' },
  { value: 3 as const, emoji: '🚀', label: 'High' },
  { value: 4 as const, emoji: '🔥', label: 'On fire' },
] as const;

export const ACTIVITY_EMOJIS: Record<string, string> = {
  exercise: '🏃', work: '💼', reading: '📖', social: '👥', family: '👨‍👩‍👧',
  cooking: '🍳', travel: '✈️', meditation: '🧘', music: '🎵', creative: '🎨',
  shopping: '🛒', learning: '📚', gaming: '🎮', nature: '🌿', cleaning: '🧹',
  'self-care': '💆',
};

export function getMoodEmoji(moodValue?: string): string {
  const m = MOOD_OPTIONS.find(o => o.key === moodValue);
  return m ? m.emoji : '📝';
}

// ── MoodPicker ────────────────────────────────────────────────────────

interface MoodPickerProps {
  value?: MoodType;
  onChange: (mood: MoodType) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const MoodPicker: React.FC<MoodPickerProps> = ({ value, onChange, disabled, compact }) => (
  <div>
    {!compact && <div className="j-section-label">How are you feeling?</div>}
    <div className={compact ? 'j-mobile-mood-row' : 'j-mood-row'}>
      {MOOD_OPTIONS.map(m => (
        <button
          key={m.key}
          className={`${compact ? 'j-mobile-mood-btn' : 'j-mood-btn'} ${value === m.key ? 'selected' : ''}`}
          onClick={() => onChange(m.key)}
          disabled={disabled}
          title={m.label}
          type="button"
        >
          {m.emoji}
        </button>
      ))}
    </div>
  </div>
);

// ── EnergyPicker ──────────────────────────────────────────────────────

interface EnergyPickerProps {
  value?: 1 | 2 | 3 | 4 | 5;
  onChange: (level: 1 | 2 | 3 | 4 | 5) => void;
  disabled?: boolean;
}

export const EnergyPicker: React.FC<EnergyPickerProps> = ({ value, onChange, disabled }) => (
  <div>
    <div className="j-section-label">Energy level</div>
    <div className="j-energy-row">
      {ENERGY_OPTIONS.map(e => (
        <button
          key={e.value}
          className={`j-energy-btn ${value === e.value ? 'selected' : ''}`}
          onClick={() => onChange(e.value as 1 | 2 | 3 | 4 | 5)}
          disabled={disabled}
          type="button"
        >
          {e.emoji} {e.label}
        </button>
      ))}
    </div>
  </div>
);

// ── ActivityChips ─────────────────────────────────────────────────────

interface ActivityChipsProps {
  selected: string[];
  onChange: (activities: string[]) => void;
  disabled?: boolean;
}

const COLLAPSED_ACTIVITY_COUNT = 5;

export const ActivityChips: React.FC<ActivityChipsProps> = ({ selected, onChange, disabled }) => {
  const [expanded, setExpanded] = useState(false);

  const toggle = (act: string) => {
    if (disabled) return;
    onChange(selected.includes(act) ? selected.filter(a => a !== act) : [...selected, act]);
  };

  // Show selected items first, then fill remaining slots from the full list
  const selectedSet = new Set(selected);
  const allActivities = JOURNAL_ACTIVITIES as readonly string[];
  const orderedActivities: string[] = [
    ...selected.filter(a => allActivities.includes(a)),
    ...JOURNAL_ACTIVITIES.filter(a => !selectedSet.has(a)),
  ];
  const visible = expanded ? orderedActivities : orderedActivities.slice(0, COLLAPSED_ACTIVITY_COUNT);
  const hiddenCount = orderedActivities.length - COLLAPSED_ACTIVITY_COUNT;

  return (
    <div>
      <div className="j-section-label">Activities</div>
      <div className="j-chips-wrap">
        {visible.map(act => (
          <button
            key={act}
            className={`j-chip ${selected.includes(act) ? 'selected' : ''}`}
            onClick={() => toggle(act)}
            disabled={disabled}
            type="button"
          >
            {ACTIVITY_EMOJIS[act] || '•'}{' '}
            <span style={{ textTransform: 'capitalize' }}>{act}</span>
          </button>
        ))}
        {!expanded && hiddenCount > 0 && (
          <button
            className="j-chip"
            onClick={() => setExpanded(true)}
            type="button"
            style={{ color: 'var(--j-purple)', borderColor: 'var(--j-purple)' }}
          >
            +{hiddenCount} more
          </button>
        )}
        {expanded && hiddenCount > 0 && (
          <button
            className="j-chip"
            onClick={() => setExpanded(false)}
            type="button"
            style={{ color: 'var(--j-ink3)', fontSize: 11 }}
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
};

// ── WriteArea ─────────────────────────────────────────────────────────

interface WriteAreaProps {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
}

export const WriteArea: React.FC<WriteAreaProps> = ({
  value, onChange, placeholder, disabled, compact,
}) => {
  const [focused, setFocused] = useState(false);
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;

  if (compact) {
    return (
      <div className={`j-mobile-write-box ${focused ? 'focused' : ''}`}>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || "A line or two is enough… What's on your mind?"}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
    );
  }

  return (
    <div className={`j-write-area ${focused ? 'focused' : ''}`}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Write your thoughts here… a line or two is perfectly fine.'}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <div className="j-write-toolbar">
        <span className="j-word-count">{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};

// ── TagPicker ─────────────────────────────────────────────────────────

interface TagPickerProps {
  availableTags: Tag[];
  selected: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export const TagPicker: React.FC<TagPickerProps> = ({ availableTags, selected, onChange, disabled }) => {
  if (availableTags.length === 0) return null;

  const toggle = (tagId: string) => {
    if (disabled) return;
    onChange(selected.includes(tagId) ? selected.filter(t => t !== tagId) : [...selected, tagId]);
  };

  return (
    <div>
      <div className="j-section-label">Tags</div>
      <div className="j-tags-row">
        {availableTags.map(tag => (
          <span
            key={tag.id}
            className="j-existing-tag"
            style={{
              background: selected.includes(tag.id) ? tag.color : undefined,
              color: selected.includes(tag.id) ? '#fff' : undefined,
              borderColor: selected.includes(tag.id) ? tag.color : undefined,
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.7 : 1,
            }}
            onClick={() => toggle(tag.id)}
          >
            {tag.name}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── StreakWidget ───────────────────────────────────────────────────────

import type { StreakDotData } from './streakUtils';

interface StreakWidgetProps {
  currentStreak: number;
  bestStreak: number;
  dots: StreakDotData[];
  compact?: boolean;
}

export const StreakWidget: React.FC<StreakWidgetProps> = ({ currentStreak, bestStreak, dots, compact }) => {
  const circumference = 2 * Math.PI * (compact ? 21 : 19);
  const progress = Math.min(currentStreak / 30, 1);
  const offset = circumference - progress * circumference;
  const missCount = dots.filter(d => d.status === 'miss').length;
  const size = compact ? 52 : 46;
  const radius = compact ? 21 : 19;
  const center = size / 2;

  return (
    <div className={compact ? 'j-mobile-streak' : 'j-streak-card'}>
      <div className="j-streak-top">
        <div className="j-streak-ring" style={{ width: size, height: size }}>
          <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
            <circle cx={center} cy={center} r={radius} fill="none"
              stroke="rgba(90,83,77,0.1)" strokeWidth={compact ? 4.5 : 4} />
            <circle cx={center} cy={center} r={radius} fill="none"
              stroke="#1d9e75" strokeWidth={compact ? 4.5 : 4}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="j-streak-ring-inner">
            <span className="j-ring-num">{currentStreak}</span>
            <span className="j-ring-unit">days</span>
          </div>
        </div>
        <div>
          <div className="j-streak-title">{currentStreak}-day streak {currentStreak >= 3 ? '🔥' : ''}</div>
          <div className="j-streak-sub">
            {missCount > 0 ? `${missCount} missed` : 'No misses'} · best: {bestStreak} days
          </div>
        </div>
      </div>
      <div className="j-streak-dots">
        {dots.map((d, i) => (
          <div key={i} className={`j-dot ${d.status}`} title={d.date} />
        ))}
      </div>
      {!compact && (
        <div className="j-streak-legend">
          <span className="j-leg-item"><span className="j-leg-dot" style={{ background: '#1d9e75' }} />Logged</span>
          <span className="j-leg-item"><span className="j-leg-dot" style={{ background: '#f09595' }} />Missed</span>
          <span className="j-leg-item"><span className="j-leg-dot" style={{ background: '#6b5de8' }} />Today</span>
        </div>
      )}
    </div>
  );
};
