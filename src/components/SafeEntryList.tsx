import React, { useState, useMemo } from 'react';
import { SafeEntry, Tag } from '../types';
import { CryptoKey } from '../utils/encryption';
import { deleteSafeEntriesByTag, deleteSafeEntry } from '../storage';

interface SafeEntryListProps {
  entries: SafeEntry[];
  tags: Tag[];
  encryptionKey: CryptoKey;
  viewMode: 'grid' | 'list';
  onEntrySelect: (entry: SafeEntry) => void;
  onEntrySaved: () => void;
}

const SafeEntryList: React.FC<SafeEntryListProps> = ({
  entries,
  tags,
  encryptionKey,
  viewMode,
  onEntrySelect,
  onEntrySaved
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'title' | 'updated' | 'expires'>('updated');

  // selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // delete confirmations
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSelectedDeleteConfirm, setShowSelectedDeleteConfirm] = useState(false);

  const filteredEntries = useMemo(() => {
    let filtered = [...entries];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
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
  }, [entries, searchQuery, selectedCategory, selectedTag, showFavoritesOnly, sortBy]);

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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '8px' }}>
        <input type="text" placeholder="🔍 Search by title or URL..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ flex: '1', minWidth: '200px', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px' }} />

        <select value={selectedCategory || ''} onChange={e => setSelectedCategory(e.target.value || null)} style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
          <option value="">All Categories</option>
          <option value="UNCATEGORIZED">Uncategorized</option>
          {tags.filter(t => t.isSystemCategory).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        <select value={selectedTag || ''} onChange={e => setSelectedTag(e.target.value || null)} style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
          <option value="">All Tags</option>
          {tags.filter(t => !t.isSystemCategory).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {selectedTag && entriesWithSelectedTag.length > 0 && (
          <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: '0.75rem 1rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px' }}>🗑️ Delete All ({entriesWithSelectedTag.length})</button>
        )}

        {/* Select / Deselect all visible entries */}
        {filteredEntries.length > 0 && (
          (() => {
            const allVisibleSelected = filteredEntries.every(e => selectedIds.includes(e.id));
            return (
              <button
                onClick={() => {
                  if (allVisibleSelected) setSelectedIds(prev => prev.filter(id => !filteredEntries.some(e => e.id === id)));
                  else setSelectedIds(prev => Array.from(new Set([...prev, ...filteredEntries.map(e => e.id)])));
                }}
                style={{ padding: '0.75rem 1rem', backgroundColor: allVisibleSelected ? '#6b7280' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px' }}
              >
                {allVisibleSelected ? 'Deselect All' : `Select All (${filteredEntries.length})`}
              </button>
            );
          })()
        )}

        {selectedIds.length > 0 && (
          <button onClick={() => setShowSelectedDeleteConfirm(true)} style={{ padding: '0.75rem 1rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px' }}>🗑️ Delete Selected ({selectedIds.length})</button>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={showFavoritesOnly} onChange={e => setShowFavoritesOnly(e.target.checked)} /> <span>⭐ Favorites only</span>
        </label>

        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px' }}>
          <option value="updated">Recently Updated</option>
          <option value="title">Title (A-Z)</option>
          <option value="expires">Expires Soon</option>
        </select>
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
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {filteredEntries.map(entry => {
            const categoryName = getCategoryName(entry.categoryTagId);
            const categoryTag = tags.find(t => t.id === entry.categoryTagId);
            const expiringDays = getExpiringDays(entry);
            const isExpiring = isExpiringSoon(entry);

            return (
              <div key={entry.id} style={{ position: 'relative', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '8px', padding: '1.25rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }} onClick={() => onEntrySelect(entry)}>
                <label style={{ position: 'absolute', top: '8px', left: '8px' }} onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.includes(entry.id)} onChange={e => { e.stopPropagation(); if (e.target.checked) setSelectedIds(prev => [...prev, entry.id]); else setSelectedIds(prev => prev.filter(id => id !== entry.id)); }} />
                </label>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{entry.title}</h3>
                  {entry.isFavorite && <span>⭐</span>}
                </div>

                {entry.url && <p style={{ margin: '0 0 0.5rem 0', color: '#3b82f6', wordBreak: 'break-all' }}>🔗 {entry.url}</p>}

                <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', backgroundColor: categoryTag?.color || '#667eea', color: 'white', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>{categoryName}</div>

                {entry.tags && entry.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {entry.tags.map(tagId => {
                      const tag = tags.find(t => t.id === tagId && !t.isSystemCategory);
                      if (!tag) return null;
                      return (
                        <div key={tagId} style={{ padding: '0.25rem 0.75rem', backgroundColor: tag.color || '#667eea', color: 'white', borderRadius: '6px', fontSize: '0.75rem' }}>{tag.name}</div>
                      );
                    })}
                  </div>
                )}

                {isExpiring && expiringDays !== null && (
                  <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', backgroundColor: expiringDays <= 7 ? '#ef4444' : '#f59e0b', color: 'white', borderRadius: '6px', fontSize: '0.75rem' }}>⏰ Expires in {expiringDays} {expiringDays === 1 ? 'day' : 'days'}</div>
                )}

                <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>Updated {new Date(entry.updatedAt).toLocaleDateString()}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', width: '48px' }}></th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280' }}>Title</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280' }}>Category</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280' }}>URL</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, color: '#6b7280' }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry, index) => {
                const categoryName = getCategoryName(entry.categoryTagId);
                const categoryTag = tags.find(t => t.id === entry.categoryTagId);
                const expiringDays = getExpiringDays(entry);
                const isExpiring = isExpiringSoon(entry);

                return (
                  <tr key={entry.id} style={{ borderBottom: index < filteredEntries.length - 1 ? '1px solid #e5e7eb' : 'none' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#f9fafb'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '1rem' }}>
                      <input type="checkbox" checked={selectedIds.includes(entry.id)} onChange={e => { if (e.target.checked) setSelectedIds(prev => [...prev, entry.id]); else setSelectedIds(prev => prev.filter(id => id !== entry.id)); }} />
                    </td>
                    <td style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => onEntrySelect(entry)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 500 }}>{entry.title}</span>
                        {entry.isFavorite && <span style={{ fontSize: '1rem' }}>⭐</span>}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ padding: '0.25rem 0.75rem', backgroundColor: categoryTag?.color || '#667eea', color: 'white', borderRadius: '6px', fontSize: '0.75rem' }}>{categoryName}</div>
                        {entry.tags && entry.tags.length > 0 && entry.tags.map(tagId => {
                          const tag = tags.find(t => t.id === tagId && !t.isSystemCategory);
                          if (!tag) return null;
                          return (
                            <div key={tagId} style={{ padding: '0.25rem 0.75rem', backgroundColor: tag.color || '#667eea', color: 'white', borderRadius: '6px', fontSize: '0.75rem' }}>{tag.name}</div>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {entry.url ? (
                        <a href={entry.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.875rem', wordBreak: 'break-all' }}>{entry.url}</a>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {isExpiring && expiringDays !== null ? (
                        <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', backgroundColor: expiringDays <= 7 ? '#ef4444' : '#f59e0b', color: 'white', borderRadius: '6px', fontSize: '0.75rem' }}>⏰ {expiringDays} {expiringDays === 1 ? 'day' : 'days'}</div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>{new Date(entry.updatedAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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

