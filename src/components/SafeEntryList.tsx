/**
 * Safe Entry List Component
 * 
 * Displays list of safe entries with search and filters
 */

import React, { useState, useMemo } from 'react';
import { SafeEntry, SafeTag } from '../types';
import { CryptoKey } from '../utils/encryption';
import { deleteSafeEntriesByTag } from '../storage';

interface SafeEntryListProps {
  entries: SafeEntry[];
  tags: SafeTag[];
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let filtered = [...entries];

    // Search filter (title and URL only - plaintext)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.title.toLowerCase().includes(query) ||
        (entry.url && entry.url.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(entry => entry.categoryTagId === selectedCategory);
    }

    // Tag filter
    if (selectedTag) {
      filtered = filtered.filter(entry => 
        entry.tags && entry.tags.includes(selectedTag)
      );
    }

    // Favorites filter
    if (showFavoritesOnly) {
      filtered = filtered.filter(entry => entry.isFavorite);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'expires':
          if (!a.expiresAt && !b.expiresAt) return 0;
          if (!a.expiresAt) return 1;
          if (!b.expiresAt) return -1;
          return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [entries, searchQuery, selectedCategory, selectedTag, showFavoritesOnly, sortBy]);

  // Get category name
  const getCategoryName = (categoryId: string | undefined) => {
    if (!categoryId) return 'Uncategorized';
    const tag = tags.find(t => t.id === categoryId);
    return tag?.name || 'Unknown';
  };

  // Check if entry is expiring soon (within 30 days)
  const isExpiringSoon = (entry: SafeEntry) => {
    if (!entry.expiresAt) return false;
    const expires = new Date(entry.expiresAt);
    const today = new Date();
    const daysUntil = Math.ceil((expires.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 30;
  };

  // Get expiring days
  const getExpiringDays = (entry: SafeEntry) => {
    if (!entry.expiresAt) return null;
    const expires = new Date(entry.expiresAt);
    const today = new Date();
    const daysUntil = Math.ceil((expires.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil;
  };

  // Get entries with selected tag (for bulk delete)
  const entriesWithSelectedTag = useMemo(() => {
    if (!selectedTag) return [];
    return entries.filter(entry => entry.tags && entry.tags.includes(selectedTag));
  }, [entries, selectedTag]);

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (!selectedTag) return;
    
    try {
      const deletedCount = await deleteSafeEntriesByTag(selectedTag);
      alert(`Successfully deleted ${deletedCount} entries.`);
      setSelectedTag(null);
      setShowDeleteConfirm(false);
      onEntrySaved(); // Refresh the list
    } catch (error: any) {
      alert(`Failed to delete entries: ${error.message}`);
    }
  };

  // Get selected tag name
  const selectedTagName = selectedTag 
    ? tags.find(t => t.id === selectedTag)?.name || 'Unknown'
    : null;

  return (
    <div>
      {/* Filters */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '2rem',
        padding: '1rem',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        borderRadius: '0.5rem'
      }}>
        <input
          type="text"
          placeholder="🔍 Search by title or URL..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1',
            minWidth: '200px',
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '1rem'
          }}
        />
        
        <select
          value={selectedCategory || ''}
          onChange={(e) => setSelectedCategory(e.target.value || null)}
          style={{
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            backgroundColor: 'white'
          }}
        >
          <option value="">All Categories</option>
          {tags.filter(t => t.isSystemCategory).map(tag => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </select>

        <select
          value={selectedTag || ''}
          onChange={(e) => setSelectedTag(e.target.value || null)}
          style={{
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            backgroundColor: 'white'
          }}
        >
          <option value="">All Tags</option>
          {tags.filter(t => !t.isSystemCategory).map(tag => (
            <option key={tag.id} value={tag.id}>{tag.name}</option>
          ))}
        </select>

        {selectedTag && entriesWithSelectedTag.length > 0 && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            🗑️ Delete All ({entriesWithSelectedTag.length})
          </button>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showFavoritesOnly}
            onChange={(e) => setShowFavoritesOnly(e.target.checked)}
          />
          <span>⭐ Favorites only</span>
        </label>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          style={{
            padding: '0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            backgroundColor: 'white'
          }}
        >
          <option value="updated">Recently Updated</option>
          <option value="title">Title (A-Z)</option>
          <option value="expires">Expires Soon</option>
        </select>
      </div>

      {/* Tag Filter Info */}
      {selectedTag && entriesWithSelectedTag.length > 0 && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem 1rem',
          backgroundColor: '#fef3c7',
          borderRadius: '0.5rem',
          border: '1px solid #fbbf24',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.875rem' }}>
            Filtering by tag: <strong>"{selectedTagName}"</strong> • {entriesWithSelectedTag.length} {entriesWithSelectedTag.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      )}

      {/* Entry Display */}
      {filteredEntries.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          opacity: 0.6
        }}>
          <p style={{ fontSize: '1.25rem', margin: 0 }}>No entries found</p>
          <p style={{ margin: '0.5rem 0 0 0' }}>
            {searchQuery || selectedCategory || showFavoritesOnly
              ? 'Try adjusting your filters'
              : 'Click "Add Entry" to create your first entry'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem'
        }}>
          {filteredEntries.map(entry => {
            const categoryName = getCategoryName(entry.categoryTagId);
            const categoryTag = tags.find(t => t.id === entry.categoryTagId);
            const expiringDays = getExpiringDays(entry);
            const isExpiring = isExpiringSoon(entry);

            return (
              <div
                key={entry.id}
                onClick={() => onEntrySelect(entry)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '0.5rem',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  border: '2px solid transparent',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', flex: 1 }}>{entry.title}</h3>
                  {entry.isFavorite && (
                    <span style={{ fontSize: '1.25rem' }}>⭐</span>
                  )}
                </div>

                {entry.url && (
                  <p style={{ 
                    margin: '0 0 0.5rem 0', 
                    fontSize: '0.875rem', 
                    color: '#3b82f6',
                    wordBreak: 'break-all'
                  }}>
                    🔗 {entry.url}
                  </p>
                )}

                <div style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  backgroundColor: categoryTag?.color || '#667eea',
                  color: 'white',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  marginBottom: '0.5rem'
                }}>
                  {categoryName}
                </div>

                {/* Display user-created tags */}
                {entry.tags && entry.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {entry.tags.map(tagId => {
                      const tag = tags.find(t => t.id === tagId && !t.isSystemCategory);
                      if (!tag) return null;
                      return (
                        <div
                          key={tagId}
                          style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.75rem',
                            backgroundColor: tag.color || '#667eea',
                            color: 'white',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 500
                          }}
                        >
                          {tag.name}
                        </div>
                      );
                    })}
                  </div>
                )}

                {isExpiring && expiringDays !== null && (
                  <div style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    backgroundColor: expiringDays <= 7 ? '#ef4444' : '#f59e0b',
                    color: 'white',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    marginLeft: '0.5rem'
                  }}>
                    ⏰ Expires in {expiringDays} {expiringDays === 1 ? 'day' : 'days'}
                  </div>
                )}

                <p style={{ 
                  margin: '0.75rem 0 0 0', 
                  fontSize: '0.75rem', 
                  opacity: 0.6 
                }}>
                  Updated {new Date(entry.updatedAt).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '0.5rem',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
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
                  <tr
                    key={entry.id}
                    onClick={() => onEntrySelect(entry)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: index < filteredEntries.length - 1 ? '1px solid #e5e7eb' : 'none',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 500 }}>{entry.title}</span>
                        {entry.isFavorite && <span style={{ fontSize: '1rem' }}>⭐</span>}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.75rem',
                          backgroundColor: categoryTag?.color || '#667eea',
                          color: 'white',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}>
                          {categoryName}
                        </div>
                        {/* Display user-created tags */}
                        {entry.tags && entry.tags.length > 0 && entry.tags.map(tagId => {
                          const tag = tags.find(t => t.id === tagId && !t.isSystemCategory);
                          if (!tag) return null;
                          return (
                            <div
                              key={tagId}
                              style={{
                                display: 'inline-block',
                                padding: '0.25rem 0.75rem',
                                backgroundColor: tag.color || '#667eea',
                                color: 'white',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                fontWeight: 500
                              }}
                            >
                              {tag.name}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {entry.url ? (
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            color: '#3b82f6',
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            wordBreak: 'break-all',
                            maxWidth: '300px',
                            display: 'block'
                          }}
                        >
                          {entry.url}
                        </a>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {isExpiring && expiringDays !== null ? (
                        <div style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.75rem',
                          backgroundColor: expiringDays <= 7 ? '#ef4444' : '#f59e0b',
                          color: 'white',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: 500
                        }}>
                          ⏰ {expiringDays} {expiringDays === 1 ? 'day' : 'days'}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                      {new Date(entry.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showDeleteConfirm && selectedTag && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem', color: '#ef4444' }}>
              ⚠️ Confirm Bulk Delete
            </h2>
            
            <p style={{ marginBottom: '1rem', fontSize: '1rem' }}>
              You are about to delete <strong>{entriesWithSelectedTag.length} entries</strong> with tag <strong>"{selectedTagName}"</strong>.
            </p>
            
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#ef4444', fontWeight: 500 }}>
              This action cannot be undone!
            </p>

            <div style={{
              marginBottom: '1.5rem',
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '0.5rem',
              maxHeight: '300px',
              overflow: 'auto'
            }}>
              <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
                Preview of entries to be deleted (showing first 10):
              </strong>
              <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                {entriesWithSelectedTag.slice(0, 10).map(entry => (
                  <li key={entry.id} style={{ marginBottom: '0.25rem' }}>
                    {entry.title}
                    {entry.url && (
                      <span style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                        ({entry.url})
                      </span>
                    )}
                  </li>
                ))}
                {entriesWithSelectedTag.length > 10 && (
                  <li style={{ color: '#6b7280', fontStyle: 'italic' }}>
                    ... and {entriesWithSelectedTag.length - 10} more entries
                  </li>
                )}
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleBulkDelete}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Delete {entriesWithSelectedTag.length} Entries
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SafeEntryList;

