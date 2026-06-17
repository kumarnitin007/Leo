/**
 * SafeEntryRow - dense single-row presentation of a vault password entry
 * for the Passwords "List" view.
 *
 * Security:
 * - Passwords are NEVER decrypted at rest. The cell shows a fixed mask until the
 *   user explicitly reveals or copies. Reveal auto-remasks after a few seconds and
 *   the cleartext is dropped from state. Copy never paints the value on screen.
 * - No decrypted value (username or password) is ever logged.
 * - Usernames are decrypted lazily (only for the rows the virtualizer mounts) and
 *   cached by the parent so scrolling back doesn't re-decrypt.
 */

import React, { useEffect, useRef, useState, memo } from 'react';
import { SafeEntry, Tag, SafeEntryEncryptedData } from '../../types';
import { CryptoKey } from '../../utils/encryption';
import { decryptSafeEntry } from '../../storage';

// Shared column template so the header and every row stay aligned.
export const LIST_GRID =
  '1.7fr 1.2fr 1.15fr 1fr 130px 100px';

const REVEAL_MS = 8000;

async function getEntryData(entry: SafeEntry, key: CryptoKey): Promise<SafeEntryEncryptedData> {
  if (entry.decryptedData) return entry.decryptedData;
  const json = await decryptSafeEntry(entry, key);
  return JSON.parse(json) as SafeEntryEncryptedData;
}

interface SafeEntryRowProps {
  entry: SafeEntry;
  tags: Tag[];
  encryptionKey: CryptoKey;
  username: string | undefined; // from parent cache; undefined = not yet decrypted
  onNeedUsername: (entry: SafeEntry) => void;
  commentCount: number;
  isSelected: boolean;
  onEntrySelect: (entry: SafeEntry) => void;
  onShare?: (entry: SafeEntry) => void;
  onToggleFavorite: (entry: SafeEntry) => void;
  onSelectToggle: (id: string, selected: boolean) => void;
  getCategoryName: (id: string | undefined) => string;
  style?: React.CSSProperties;
}

const cellBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '0.15rem',
  fontSize: '0.8rem',
  lineHeight: 1,
  opacity: 0.6,
  transition: 'opacity 0.15s',
};

const SafeEntryRow = memo(function SafeEntryRow({
  entry,
  tags,
  encryptionKey,
  username,
  onNeedUsername,
  commentCount,
  isSelected,
  onEntrySelect,
  onShare,
  onToggleFavorite,
  onSelectToggle,
  getCategoryName,
  style,
}: SafeEntryRowProps) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<'user' | 'pass' | null>(null);
  const remaskTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryTag = tags.find(t => t.id === entry.categoryTagId);
  const categoryName = getCategoryName(entry.categoryTagId);
  const accent = categoryTag?.color || 'var(--ck-purple)';
  const initial = (entry.title || '?').trim().charAt(0).toUpperCase();

  // Lazily decrypt the username when this row mounts (virtualizer only mounts
  // visible rows, so this stays bounded even for very large vaults).
  useEffect(() => {
    if (username === undefined) onNeedUsername(entry);
  }, [entry, username, onNeedUsername]);

  // Clear any pending timers / cleartext on unmount.
  useEffect(() => () => {
    if (remaskTimer.current) clearTimeout(remaskTimer.current);
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const flashCopied = (which: 'user' | 'pass') => {
    setCopied(which);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1500);
  };

  const handleReveal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (revealed !== null) {
      if (remaskTimer.current) clearTimeout(remaskTimer.current);
      setRevealed(null);
      return;
    }
    setBusy(true);
    try {
      const data = await getEntryData(entry, encryptionKey);
      setRevealed(data.password || '');
      remaskTimer.current = setTimeout(() => setRevealed(null), REVEAL_MS);
    } catch {
      // Never surface or log the underlying value.
    } finally {
      setBusy(false);
    }
  };

  const handleCopyPassword = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const data = await getEntryData(entry, encryptionKey);
      await navigator.clipboard.writeText(data.password || '');
      flashCopied('pass');
    } catch {
      /* swallow — do not expose value */
    }
  };

  const handleCopyUsername = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const value = username ?? (await getEntryData(entry, encryptionKey)).username ?? '';
      await navigator.clipboard.writeText(value);
      flashCopied('user');
    } catch {
      /* swallow */
    }
  };

  return (
    <div
      onClick={() => onEntrySelect(entry)}
      style={{
        display: 'grid',
        gridTemplateColumns: LIST_GRID,
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0 0.75rem',
        height: '100%',
        cursor: 'pointer',
        borderBottom: '0.5px solid var(--ck-border2)',
        background: isSelected ? 'var(--ck-purple-light)' : 'transparent',
        fontSize: '0.85rem',
        color: 'var(--ck-ink)',
        boxSizing: 'border-box',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--ck-cream)'; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Title + favorite + avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
        <label onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={e => { e.stopPropagation(); onSelectToggle(entry.id, e.target.checked); }}
          />
        </label>
        {entry.isShared && entry.isFavorite ? (
          <span title="Favorite" style={{ fontSize: '0.85rem' }}>⭐</span>
        ) : !entry.isShared ? (
          <button
            onClick={e => { e.stopPropagation(); onToggleFavorite(entry); }}
            title={entry.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={!!entry.isFavorite}
            style={{ ...cellBtn, fontSize: '0.95rem', opacity: entry.isFavorite ? 1 : 0.5 }}
          >
            {entry.isFavorite ? '⭐' : '☆'}
          </button>
        ) : <span style={{ width: '1rem' }} />}
        <span
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '6px',
            background: accent,
            color: 'white',
            fontSize: '0.7rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {initial}
        </span>
        <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.title}
        </span>
        {commentCount > 0 && (
          <span style={{ fontSize: '0.65rem', color: 'var(--ck-purple)' }}>💬{commentCount}</span>
        )}
      </div>

      {/* Username */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0, color: 'var(--ck-ink2)' }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--ck-mono, monospace)' }}>
          {username === undefined ? '…' : (username || '—')}
        </span>
        {username ? (
          <button onClick={handleCopyUsername} title="Copy username" style={cellBtn}>
            {copied === 'user' ? '✓' : '⧉'}
          </button>
        ) : null}
      </div>

      {/* Password (masked unless revealed) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0, color: 'var(--ck-ink2)' }}>
        <span style={{ fontFamily: 'var(--ck-mono, monospace)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: revealed === null ? '1px' : 0 }}>
          {busy ? '…' : revealed === null ? '••••••••' : (revealed || '—')}
        </span>
        <button onClick={handleReveal} title={revealed === null ? 'Reveal' : 'Hide'} style={cellBtn}>
          {revealed === null ? '👁' : '🙈'}
        </button>
        <button onClick={handleCopyPassword} title="Copy password" style={cellBtn}>
          {copied === 'pass' ? '✓' : '⧉'}
        </button>
      </div>

      {/* URL */}
      <div style={{ minWidth: 0, color: 'var(--ck-purple)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {entry.url ? (
          <a
            href={/^https?:\/\//.test(entry.url) ? entry.url : `https://${entry.url}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            {entry.url.replace(/^https?:\/\//, '')}
          </a>
        ) : <span style={{ color: 'var(--ck-ink3)' }}>—</span>}
      </div>

      {/* Category chip */}
      <div style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'inline-block',
            maxWidth: '100%',
            padding: '0.15rem 0.55rem',
            border: `0.5px solid ${accent}`,
            color: accent,
            borderRadius: '999px',
            fontSize: '0.7rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            boxSizing: 'border-box',
          }}
        >
          {categoryName}
        </span>
      </div>

      {/* Updated + share */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem', color: 'var(--ck-ink3)', fontSize: '0.75rem' }}>
        <span style={{ whiteSpace: 'nowrap' }}>{new Date(entry.updatedAt).toLocaleDateString()}</span>
        {onShare && !entry.isShared && (
          <button onClick={e => { e.stopPropagation(); onShare(entry); }} title="Share" style={cellBtn}>🔗</button>
        )}
      </div>
    </div>
  );
});

export default SafeEntryRow;
