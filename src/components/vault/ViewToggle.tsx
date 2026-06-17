/**
 * ViewToggle - segmented List/Card switch for the Vault Passwords toolbar.
 *
 * Purely presentational; the parent owns the active value and persistence.
 */

import React from 'react';

export type VaultView = 'list' | 'card';

interface ViewToggleProps {
  value: VaultView;
  onChange: (view: VaultView) => void;
}

const OPTIONS: { id: VaultView; icon: string; label: string }[] = [
  { id: 'list', icon: '≣', label: 'List' },
  { id: 'card', icon: '▦', label: 'Card' },
];

const ViewToggle: React.FC<ViewToggleProps> = ({ value, onChange }) => (
  <div
    role="group"
    aria-label="Switch entry layout"
    style={{
      display: 'inline-flex',
      border: '0.5px solid var(--ck-border2)',
      borderRadius: '0.5rem',
      overflow: 'hidden',
      background: 'var(--ck-white)',
    }}
  >
    {OPTIONS.map(opt => {
      const active = value === opt.id;
      return (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          aria-pressed={active}
          title={`${opt.label} view`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.45rem 0.7rem',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--ck-font)',
            fontSize: '0.85rem',
            fontWeight: active ? 600 : 400,
            background: active ? 'var(--ck-ink)' : 'transparent',
            color: active ? 'var(--ck-white)' : 'var(--ck-ink2)',
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>{opt.icon}</span>
          {opt.label}
        </button>
      );
    })}
  </div>
);

export default ViewToggle;
