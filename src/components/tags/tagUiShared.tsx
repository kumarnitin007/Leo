/**
 * Shared presentational pieces for Settings tags + Vault tags (visual parity).
 * No data fetching — markup and style tokens only.
 */
import React from 'react';
import type { TagSection } from '../../types';

/** Design tokens from TAGS_REDESIGN_CURSOR_PROMPT.md */
export const TAG_UI = {
  activeChipBg: '#E1F5EE',
  activeChipBorder: '#5DCAA5',
  activeChipText: '#0F6E56',
  tabUnderline: '#1D9E75',
  deleteText: '#A32D2D',
  deleteHoverBg: '#FCEBEB',
  trackableBadgeBg: '#FAEEDA',
  trackableBadgeText: '#854F0B',
  btnDark: '#1D1D1D',
  border: '#E5E5E5',
  muted: '#6B7280',
  paper: '#FFFFFF',
  paperAlt: '#FAFAF9',
} as const;

const SECTION_META: Record<Exclude<TagSection, 'safe'>, { icon: string; label: string }> = {
  tasks: { icon: '✅', label: 'Tasks' },
  events: { icon: '📅', label: 'Events' },
  journals: { icon: '📓', label: 'Journals' },
  items: { icon: '📦', label: 'Items' },
};

export function TagSectionPills({
  allowedSections,
}: {
  allowedSections?: TagSection[] | null;
}): React.ReactNode {
  const all: Exclude<TagSection, 'safe'>[] = ['tasks', 'events', 'journals', 'items'];
  const active = !allowedSections?.length
    ? all
    : allowedSections.filter((s): s is Exclude<TagSection, 'safe'> => s !== 'safe' && s in SECTION_META);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {active.map((s) => (
        <span
          key={s}
          style={{
            fontSize: 10,
            padding: '3px 8px',
            borderRadius: 999,
            border: `1px solid ${TAG_UI.border}`,
            background: TAG_UI.paperAlt,
            color: '#374151',
            fontWeight: 500,
            lineHeight: 1.2,
          }}
        >
          {SECTION_META[s].icon} {SECTION_META[s].label}
        </span>
      ))}
    </div>
  );
}

export function VaultScopePill(): React.ReactNode {
  return (
    <span
      style={{
        fontSize: 10,
        padding: '3px 8px',
        borderRadius: 999,
        border: `1px solid ${TAG_UI.border}`,
        background: TAG_UI.paperAlt,
        color: '#374151',
        fontWeight: 500,
      }}
    >
      🔐 Vault
    </span>
  );
}

export function TrackableBadge(): React.ReactNode {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: TAG_UI.trackableBadgeBg,
        color: TAG_UI.trackableBadgeText,
      }}
    >
      Trackable
    </span>
  );
}
