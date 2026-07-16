import React, { useState, useMemo, useEffect, useRef, useReducer, useCallback, memo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { SafeEntry, Tag, SafeEntryEncryptedData } from '../types';
import { CryptoKey } from '../utils/encryption';
import { deleteSafeEntriesByTag, deleteSafeEntry, updateSafeEntry, decryptSafeEntry } from '../storage';
import { getUnresolvedCommentCountsForEntries } from '../services/commentService';
import { useVirtualList } from '../hooks/useVirtualList';
import ViewToggle, { VaultView } from './vault/ViewToggle';
import SafeEntryRow, { LIST_GRID } from './vault/SafeEntryRow';
import { PageSizeSelect, PaginationNav, getStoredPageSize, storePageSize } from './vault/VaultPagination';

const VAULT_VIEW_KEY = 'myday_safe_passwords_view';
const LIST_ROW_HEIGHT = 48;

interface SafeEntryCardProps {
  entry: SafeEntry;
  tags: Tag[];
  selectedIds: string[];
  commentCount: number;
  onEntrySelect: (entry: SafeEntry) => void;
  onShare?: (entry: SafeEntry) => void;
  onToggleFavorite: (entry: SafeEntry) => void;
  onSelectToggle: (id: string, selected: boolean) => void;
  getCategoryName: (id: string | undefined) => string;
  getExpiringDays: (entry: SafeEntry) => number | null;
  isExpiringSoon: (entry: SafeEntry) => boolean;
  formatTimeAgo: (timestamp: string) => string;
  compact?: boolean;
}

const SafeEntryCard = memo(function SafeEntryCard({
  entry,
  tags,
  selectedIds,
  commentCount,
  onEntrySelect,
  onShare,
  onToggleFavorite,
  onSelectToggle,
  getCategoryName,
  getExpiringDays,
  isExpiringSoon,
  formatTimeAgo,
  compact = false,
}: SafeEntryCardProps) {
  const categoryName = getCategoryName(entry.categoryTagId);
  const categoryTag = tags.find(t => t.id === entry.categoryTagId);
  const expiringDays = getExpiringDays(entry);
  const isExpiring = isExpiringSoon(entry);
  const isSelected = selectedIds.includes(entry.id);

  return (
    <div 
      style={{ 
        position: 'relative', 
        backgroundColor: entry.isShared && entry.sharedBy 
          ? 'rgba(236, 253, 245, 0.95)'
          : entry.isShared 
          ? 'rgba(238, 242, 255, 0.95)'
          : 'rgba(255,255,255,0.95)', 
        borderRadius: '8px', 
        padding: compact ? '0.5rem 0.7rem' : '1.25rem', 
        cursor: 'pointer', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        border: entry.isShared && entry.sharedBy 
          ? '2px solid #10b981'
          : entry.isShared 
          ? '2px solid #6366f1'
          : 'none'
      }} 
      onClick={() => onEntrySelect(entry)}
    >
      {entry.isShared && (
        <div style={{
          position: 'absolute',
          top: '-8px',
          right: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          alignItems: 'flex-end',
        }}>
          <div style={{
            background: entry.sharedBy ? '#10b981' : '#6366f1',
            color: 'white',
            fontSize: '0.65rem',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '4px',
          }}>
            {entry.sharedBy ? `🔗 Shared by ${entry.sharedBy}` : '📤 Shared with others'}
          </div>
          {entry.lastUpdatedAt && entry.lastUpdatedBy && (
            <div style={{
              background: '#3b82f6',
              color: 'white',
              fontSize: '0.6rem',
              fontWeight: 500,
              padding: '2px 6px',
              borderRadius: '3px',
            }}>
              ✏️ Updated {formatTimeAgo(entry.lastUpdatedAt)} by {entry.lastUpdatedBy}
            </div>
          )}
        </div>
      )}
      {/* Desktop: checkbox floats bottom-right. On mobile it moves inline into the
          header (below) so it never overlaps the category/tag badges. */}
      {!compact && (
        <label style={{ position: 'absolute', bottom: '8px', right: '8px' }} onClick={e => e.stopPropagation()}>
          <input 
            type="checkbox" 
            checked={isSelected} 
            onChange={e => { e.stopPropagation(); onSelectToggle(entry.id, e.target.checked); }} 
          />
        </label>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: compact ? '0.25rem' : '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: compact ? '0.95rem' : '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.title}</h3>
          {commentCount > 0 && (
            <span style={{
              background: '#3b82f6',
              color: 'white',
              fontSize: '0.65rem',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
            }}>
              💬 {commentCount}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {onShare && !entry.isShared && (
            <button
              onClick={(e) => { e.stopPropagation(); onShare(entry); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                fontSize: '1rem',
                opacity: 0.7,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
              title="Share this entry"
            >
              🔗
            </button>
          )}
          {entry.isShared ? (
            entry.isFavorite && <span title="Favorite">⭐</span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(entry); }}
              title={entry.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={!!entry.isFavorite}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                fontSize: '1rem',
                lineHeight: 1,
                opacity: entry.isFavorite ? 1 : 0.55,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = entry.isFavorite ? '1' : '0.55')}
            >
              {entry.isFavorite ? '⭐' : '☆'}
            </button>
          )}
        </div>
      </div>

      {/* URL row — hidden on mobile (compact) to keep rows short; reserves space on desktop for alignment */}
      {!compact && (
        <p
          title={entry.url || undefined}
          style={{ margin: '0 0 0.5rem 0', color: '#3b82f6', minHeight: '1.25em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {entry.url ? `🔗 ${entry.url}` : '\u00A0'}
        </p>
      )}

      {/* Category (left) + tags (right) on a single row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: compact ? '0' : '0.5rem' }}>
        <div style={{ flexShrink: 0, padding: '0.25rem 0.75rem', backgroundColor: categoryTag?.color || '#667eea', color: 'white', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>{categoryName}</div>

        {entry.tags && entry.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'flex-end' }}>
            {entry.tags.map(tagId => {
              const tag = tags.find(t => t.id === tagId && !t.isSystemCategory);
              if (!tag) return null;
              return (
                <div key={tagId} style={{ padding: '0.25rem 0.75rem', backgroundColor: tag.color || '#667eea', color: 'white', borderRadius: '6px', fontSize: '0.75rem' }}>{tag.name}</div>
              );
            })}
          </div>
        )}
      </div>

      {isExpiring && expiringDays !== null && (
        <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', backgroundColor: expiringDays <= 7 ? '#ef4444' : '#f59e0b', color: 'white', borderRadius: '6px', fontSize: '0.75rem' }}>⏰ Expires in {expiringDays} {expiringDays === 1 ? 'day' : 'days'}</div>
      )}

      {!compact && (
        <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>Updated {new Date(entry.updatedAt).toLocaleDateString()}</p>
      )}
    </div>
  );
});

// Helper to format "X mins ago" timestamp
function formatTimeAgo(isoTimestamp: string): string {
  const now = new Date();
  const then = new Date(isoTimestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

interface PasswordsListViewProps {
  entries: SafeEntry[];
  tags: Tag[];
  encryptionKey: CryptoKey;
  usernames: Record<string, string>;
  ensureUsername: (entry: SafeEntry) => void;
  commentCounts: Record<string, number>;
  selectedIds: string[];
  onEntrySelect: (entry: SafeEntry) => void;
  onShare?: (entry: SafeEntry) => void;
  onToggleFavorite: (entry: SafeEntry) => void;
  onSelectToggle: (id: string, selected: boolean) => void;
  getCategoryName: (id: string | undefined) => string;
}

const HEADER_LABELS = ['TITLE', 'USERNAME', 'PASSWORD', 'URL', 'CATEGORY', 'UPDATED'];

const PasswordsListView: React.FC<PasswordsListViewProps> = ({
  entries,
  tags,
  encryptionKey,
  usernames,
  ensureUsername,
  commentCounts,
  selectedIds,
  onEntrySelect,
  onShare,
  onToggleFavorite,
  onSelectToggle,
  getCategoryName,
}) => {
  const { virtualItems, totalHeight, containerRef } = useVirtualList<SafeEntry>({
    items: entries,
    itemHeight: LIST_ROW_HEIGHT,
    overscan: 6,
  });

  return (
    <div style={{ border: '0.5px solid var(--ck-border2)', borderRadius: '10px', overflow: 'hidden', background: 'var(--ck-white)' }}>
      {/* Column header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: LIST_GRID,
          gap: '0.75rem',
          padding: '0.6rem 0.75rem',
          background: 'var(--ck-purple-light)',
          borderBottom: '0.5px solid var(--ck-border2)',
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.5px',
          color: 'var(--ck-ink3)',
        }}
      >
        {HEADER_LABELS.map(l => <span key={l}>{l}</span>)}
      </div>

      {/* Virtualized rows */}
      <div ref={containerRef} style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '420px', overflowY: 'auto' }}>
        <div style={{ height: totalHeight, position: 'relative' }}>
          {virtualItems.map(({ item, style }) => (
            <div key={item.id} style={style.position ? style : { height: LIST_ROW_HEIGHT }}>
              <SafeEntryRow
                entry={item}
                tags={tags}
                encryptionKey={encryptionKey}
                username={usernames[item.id]}
                onNeedUsername={ensureUsername}
                commentCount={commentCounts[item.id] || 0}
                isSelected={selectedIds.includes(item.id)}
                onEntrySelect={onEntrySelect}
                onShare={onShare}
                onToggleFavorite={onToggleFavorite}
                onSelectToggle={onSelectToggle}
                getCategoryName={getCategoryName}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface SafeEntryListProps {
  entries: SafeEntry[];
  tags: Tag[];
  encryptionKey: CryptoKey;
  onEntrySelect: (entry: SafeEntry) => void;
  onEntrySaved: () => void;
  onShare?: (entry: SafeEntry) => void;
  isMobile?: boolean;
}

const SafeEntryList: React.FC<SafeEntryListProps> = ({
  entries,
  tags,
  encryptionKey,
  onEntrySelect,
  onEntrySaved,
  onShare,
  isMobile = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'title' | 'updated' | 'expires'>('updated');

  // List/Card view preference (desktop only) — persisted per-device.
  // localStorage matches the existing Vault prefs (filter collapse, import/export
  // tab) and avoids a server migration for a trivial UI toggle.
  const [view, setViewState] = useState<VaultView>(
    () => (localStorage.getItem(VAULT_VIEW_KEY) === 'list' ? 'list' : 'card')
  );
  const setView = (v: VaultView) => {
    setViewState(v);
    localStorage.setItem(VAULT_VIEW_KEY, v);
  };
  const effectiveView: VaultView = isMobile ? 'card' : view;

  // Client-side pagination (display window only — search/filters/counts stay
  // global because all metadata is already in memory). Page size persisted.
  const [pageSize, setPageSizeState] = useState<number>(() => getStoredPageSize(isMobile));
  const setPageSize = (n: number) => { setPageSizeState(n); storePageSize(n); };
  const [page, setPage] = useState(1);

  // Lazily-decrypted usernames for the list view, cached by entry id so scrolling
  // back through a virtualized list doesn't re-decrypt. Passwords are never cached.
  const usernameCacheRef = useRef<Record<string, string>>({});
  const [, bumpUsernames] = useReducer((x: number) => x + 1, 0);
  const ensureUsername = useCallback(async (entry: SafeEntry) => {
    if (usernameCacheRef.current[entry.id] !== undefined) return;
    try {
      const data: SafeEntryEncryptedData = entry.decryptedData
        ?? JSON.parse(await decryptSafeEntry(entry, encryptionKey));
      usernameCacheRef.current[entry.id] = data.username || '';
    } catch {
      usernameCacheRef.current[entry.id] = '';
    }
    bumpUsernames();
  }, [encryptionKey]);

  // selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // delete confirmations
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSelectedDeleteConfirm, setShowSelectedDeleteConfirm] = useState(false);
  
  // comment counts (fetched only for the currently displayed page — see below)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const filteredEntries = useMemo(() => {
    let filtered = [...entries];

    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(e => e.title.toLowerCase().includes(q) || (e.url && e.url.toLowerCase().includes(q)));
    }

    if (selectedCategory) {
      if (selectedCategory === 'UNCATEGORIZED') {
        filtered = filtered.filter(e => !e.categoryTagId);
      } else {
        filtered = filtered.filter(e => e.categoryTagId === selectedCategory);
      }
    }

    if (selectedTag) {
      filtered = filtered.filter(e => e.tags && e.tags.includes(selectedTag));
    }

    if (showFavoritesOnly) {
      filtered = filtered.filter(e => e.isFavorite);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title': return a.title.localeCompare(b.title);
        case 'updated': return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'expires': {
          if (!a.expiresAt && !b.expiresAt) return 0;
          if (!a.expiresAt) return 1;
          if (!b.expiresAt) return -1;
          return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
        }
        default: return 0;
      }
    });

    return filtered;
  }, [entries, debouncedSearchQuery, selectedCategory, selectedTag, showFavoritesOnly, sortBy]);

  // Reset to page 1 when the filter/search/sort/page-size inputs change.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery, selectedCategory, selectedTag, showFavoritesOnly, sortBy, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  // Clamp the page if the result set shrank (e.g. after a delete).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedEntries = useMemo(
    () => filteredEntries.slice((page - 1) * pageSize, page * pageSize),
    [filteredEntries, page, pageSize],
  );

  // Comment counts: fetch ONLY for the visible page in a single batched query
  // (was N+1 per entry across the whole vault). Results are merged so paging
  // back doesn't refetch.
  const pagedIdsKey = pagedEntries.map(e => e.id).join(',');
  useEffect(() => {
    if (pagedEntries.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const counts = await getUnresolvedCommentCountsForEntries(
          pagedEntries.map(e => e.id),
          'safe_entry',
        );
        if (!cancelled) setCommentCounts(prev => ({ ...prev, ...counts }));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagedIdsKey]);

  const entriesWithSelectedTag = useMemo(() => {
    if (!selectedTag) return [] as SafeEntry[];
    return entries.filter(e => e.tags && e.tags.includes(selectedTag));
  }, [entries, selectedTag]);

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return 'Uncategorized';
    const tag = tags.find(t => t.id === categoryId);
    return tag?.name || 'Unknown';
  };

  const isExpiringSoon = (entry: SafeEntry) => {
    if (!entry.expiresAt) return false;
    const expires = new Date(entry.expiresAt);
    const today = new Date();
    const days = Math.ceil((expires.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days >= 0 && days <= 30;
  };

  const getExpiringDays = (entry: SafeEntry) => {
    if (!entry.expiresAt) return null;
    const expires = new Date(entry.expiresAt);
    const today = new Date();
    return Math.ceil((expires.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleBulkDelete = async () => {
    if (!selectedTag) return;
    try {
      const deleted = await deleteSafeEntriesByTag(selectedTag);
      alert(`Successfully deleted ${deleted} entries.`);
      setSelectedTag(null);
      setShowDeleteConfirm(false);
      onEntrySaved();
    } catch (e: any) {
      alert(`Failed to delete entries: ${e.message}`);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      let deleted = 0;
      for (const id of selectedIds) {
        const ok = await deleteSafeEntry(id);
        if (ok) deleted++;
      }
      alert(`Deleted ${deleted} entries.`);
      setSelectedIds([]);
      setShowSelectedDeleteConfirm(false);
      onEntrySaved();
    } catch (e: any) {
      alert(`Failed to delete selected entries: ${e.message}`);
    }
  };

  return (
    <div>
      {/* Toolbar - compact, no background box */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input type="text" placeholder="🔍 Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ flex: '1', minWidth: '150px', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }} />

        <select value={selectedCategory || ''} onChange={e => setSelectedCategory(e.target.value || null)} style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', backgroundColor: 'white' }}>
          <option value="">Category</option>
          <option value="UNCATEGORIZED">Uncategorized</option>
          {tags.filter(t => t.isSystemCategory).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select value={selectedTag || ''} onChange={e => setSelectedTag(e.target.value || null)} style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', backgroundColor: 'white' }}>
          <option value="">Tags</option>
          {tags.filter(t => !t.isSystemCategory).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', backgroundColor: 'white' }}>
          <option value="updated">Latest</option>
          <option value="title">A-Z</option>
          <option value="expires">Expiry</option>
        </select>

        <PageSizeSelect value={pageSize} onChange={setPageSize} />

        {!isMobile && <ViewToggle value={view} onChange={setView} />}

        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: showFavoritesOnly ? '#fee2e2' : '#f3f4f6',
            color: showFavoritesOnly ? '#dc2626' : '#6b7280',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500
          }}
        >
          ♥ Favorite
        </button>

        {selectedTag && entriesWithSelectedTag.length > 0 && (
          <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem' }}>🗑️ ({entriesWithSelectedTag.length})</button>
        )}

        {/* Bulk selection is desktop-only — on mobile, delete happens from the entry detail popup. */}
        {!isMobile && (() => {
          const hasEntries = filteredEntries.length > 0;
          const allVisibleSelected = hasEntries && filteredEntries.every(e => selectedIds.includes(e.id));
          return (
            <button
              disabled={!hasEntries}
              onClick={() => {
                if (!hasEntries) return;
                if (allVisibleSelected) setSelectedIds(prev => prev.filter(id => !filteredEntries.some(e => e.id === id)));
                else setSelectedIds(prev => Array.from(new Set([...prev, ...filteredEntries.map(e => e.id)])));
              }}
              style={{ padding: '0.5rem 0.75rem', backgroundColor: !hasEntries ? '#e5e7eb' : allVisibleSelected ? '#6b7280' : '#3b82f6', color: !hasEntries ? '#9ca3af' : 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem', cursor: hasEntries ? 'pointer' : 'not-allowed' }}
            >
              {allVisibleSelected ? 'Deselect' : `Select (${filteredEntries.length})`}
            </button>
          );
        })()}

        {!isMobile && selectedIds.length > 0 && (
          <button onClick={() => setShowSelectedDeleteConfirm(true)} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.875rem' }}>🗑️ ({selectedIds.length})</button>
        )}
      </div>

      {selectedTag && entriesWithSelectedTag.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #fbbf24' }}>
          Filtering by tag: <strong>"{tags.find(t => t.id === selectedTag)?.name || 'Unknown'}"</strong> • {entriesWithSelectedTag.length} {entriesWithSelectedTag.length === 1 ? 'entry' : 'entries'}
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', opacity: 0.6 }}>
          <p style={{ fontSize: '1.25rem', margin: 0 }}>No entries found</p>
          <p style={{ margin: '0.5rem 0 0 0' }}>{searchQuery || selectedCategory || showFavoritesOnly ? 'Try adjusting your filters' : 'Click "Add Entry" to create your first entry'}</p>
        </div>
      ) : effectiveView === 'list' ? (
        <>
        <PasswordsListView
          entries={pagedEntries}
          tags={tags}
          encryptionKey={encryptionKey}
          usernames={usernameCacheRef.current}
          ensureUsername={ensureUsername}
          commentCounts={commentCounts}
          selectedIds={selectedIds}
          onEntrySelect={onEntrySelect}
          onShare={onShare}
          onToggleFavorite={async (e) => {
            try {
              const ok = await updateSafeEntry(e.id, { isFavorite: !e.isFavorite });
              if (ok) onEntrySaved();
            } catch (err) {
              console.error('Error toggling favorite:', err);
            }
          }}
          onSelectToggle={(id, selected) => {
            if (selected) setSelectedIds(prev => [...prev, id]);
            else setSelectedIds(prev => prev.filter(i => i !== id));
          }}
          getCategoryName={getCategoryName}
        />
        <PaginationNav page={page} pageSize={pageSize} totalItems={filteredEntries.length} onPageChange={setPage} />
        </>
      ) : (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? '0.6rem' : '1rem' }}>
          {pagedEntries.map(entry => (
            <SafeEntryCard
              key={entry.id}
              entry={entry}
              compact={isMobile}
              tags={tags}
              selectedIds={selectedIds}
              commentCount={commentCounts[entry.id] || 0}
              onEntrySelect={onEntrySelect}
              onShare={onShare}
              onToggleFavorite={async (e) => {
                try {
                  const ok = await updateSafeEntry(e.id, { isFavorite: !e.isFavorite });
                  if (ok) onEntrySaved();
                } catch (err) {
                  console.error('Error toggling favorite:', err);
                }
              }}
              onSelectToggle={(id, selected) => {
                if (selected) setSelectedIds(prev => [...prev, id]);
                else setSelectedIds(prev => prev.filter(i => i !== id));
              }}
              getCategoryName={getCategoryName}
              getExpiringDays={getExpiringDays}
              isExpiringSoon={isExpiringSoon}
              formatTimeAgo={formatTimeAgo}
            />
          ))}
        </div>
        <PaginationNav page={page} pageSize={pageSize} totalItems={filteredEntries.length} onPageChange={setPage} />
        </>
      )}

      {/* Bulk Delete Confirmation Modal for tag */}
      {showDeleteConfirm && selectedTag && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem', color: '#ef4444' }}>⚠️ Confirm Bulk Delete</h2>
            <p style={{ marginBottom: '1rem', fontSize: '1rem' }}>You are about to delete <strong>{entriesWithSelectedTag.length} entries</strong> with tag <strong>"{tags.find(t => t.id === selectedTag)?.name || 'Unknown'}"</strong>.</p>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#ef4444', fontWeight: 500 }}>This action cannot be undone!</p>

            <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', maxHeight: '300px', overflow: 'auto' }}>
              <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Preview of entries to be deleted (showing first 10):</strong>
              <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                {entriesWithSelectedTag.slice(0, 10).map(entry => (
                  <li key={entry.id} style={{ marginBottom: '0.25rem' }}>{entry.title}{entry.url && <span style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: '0.5rem' }}>({entry.url})</span>}</li>
                ))}
                {entriesWithSelectedTag.length > 10 && <li style={{ color: '#6b7280', fontStyle: 'italic' }}>... and {entriesWithSelectedTag.length - 10} more entries</li>}
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={handleBulkDelete} style={{ flex: 1, padding: '0.875rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '0.5rem' }}>Delete {entriesWithSelectedTag.length} Entries</button>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '0.875rem', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '0.5rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal for selected entries */}
      {showSelectedDeleteConfirm && selectedIds.length > 0 && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '2rem', maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem', color: '#ef4444' }}>⚠️ Confirm Delete Selected</h2>
            <p style={{ marginBottom: '1rem', fontSize: '1rem' }}>You are about to delete <strong>{selectedIds.length} entries</strong>.</p>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#ef4444', fontWeight: 500 }}>This action cannot be undone!</p>

            <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', maxHeight: '300px', overflow: 'auto' }}>
              <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Preview of entries to be deleted (showing first 10):</strong>
              <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                {entries.filter(e => selectedIds.includes(e.id)).slice(0, 10).map(e => (
                  <li key={e.id} style={{ marginBottom: '0.25rem' }}>{e.title}{e.url && <span style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: '0.5rem' }}>({e.url})</span>}</li>
                ))}
                {selectedIds.length > 10 && <li style={{ color: '#6b7280', fontStyle: 'italic' }}>... and {selectedIds.length - 10} more entries</li>}
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={handleDeleteSelected} style={{ flex: 1, padding: '0.875rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '0.5rem' }}>Delete {selectedIds.length} Entries</button>
              <button onClick={() => setShowSelectedDeleteConfirm(false)} style={{ flex: 1, padding: '0.875rem', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '0.5rem' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SafeEntryList;

