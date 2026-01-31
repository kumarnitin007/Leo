/**
 * SharedWithMeView - View entries shared with the current user
 * 
 * Features:
 * - List all shared safe entries and documents
 * - View entry details (decrypted with sharer's key - simplified for now)
 * - Copy entry to local DB (if share mode allows)
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { SharedSafeEntry, SharedDocument, SharingGroup } from '../types';
import * as sharingService from '../services/sharingService';

interface SharedWithMeViewProps {
  onClose: () => void;
  onCopyEntry?: (entryId: string, entryType: 'safe_entry' | 'document') => void;
}

const SharedWithMeView: React.FC<SharedWithMeViewProps> = ({
  onClose,
  onCopyEntry,
}) => {
  const { theme } = useTheme();
  
  const [sharedEntries, setSharedEntries] = useState<SharedSafeEntry[]>([]);
  const [sharedDocuments, setSharedDocuments] = useState<SharedDocument[]>([]);
  const [groups, setGroups] = useState<SharingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'entries' | 'documents'>('entries');
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [entriesData, documentsData, groupsData] = await Promise.all([
        sharingService.getEntriesSharedWithMe(),
        sharingService.getDocumentsSharedWithMe(),
        sharingService.getMyGroups(),
      ]);
      setSharedEntries(entriesData);
      setSharedDocuments(documentsData);
      setGroups(groupsData);

      // Check which entries have already been copied
      const copied = new Set<string>();
      for (const entry of entriesData) {
        const hasCopied = await sharingService.hasAlreadyCopied(entry.safeEntryId);
        if (hasCopied) copied.add(entry.safeEntryId);
      }
      for (const doc of documentsData) {
        const hasCopied = await sharingService.hasAlreadyCopied(doc.documentId);
        if (hasCopied) copied.add(doc.documentId);
      }
      setCopiedIds(copied);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shared entries');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (entry: SharedSafeEntry | SharedDocument, type: 'safe_entry' | 'document') => {
    const entryId = type === 'safe_entry' 
      ? (entry as SharedSafeEntry).safeEntryId 
      : (entry as SharedDocument).documentId;
    
    if (entry.shareMode === 'readonly') {
      alert('This entry is shared as view-only. You cannot copy it.');
      return;
    }

    if (copiedIds.has(entryId)) {
      alert('You have already copied this entry.');
      return;
    }

    onCopyEntry?.(entryId, type);
    setCopiedIds(prev => new Set([...prev, entryId]));
  };

  const getGroupName = (groupId: string) => {
    return groups.find(g => g.id === groupId)?.name || 'Unknown Group';
  };

  const getGroupIcon = (groupId: string) => {
    return groups.find(g => g.id === groupId)?.icon || '👥';
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔗</div>
          <p style={{ color: '#6b7280' }}>Loading shared entries...</p>
        </div>
      </div>
    );
  }

  const totalItems = sharedEntries.length + sharedDocuments.length;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '1.25rem',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e5e7eb',
          background: 'linear-gradient(135deg, #14b8a615 0%, #06b6d410 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1f2937' }}>
              🔗 Shared With Me
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
              {totalItems} item{totalItems !== 1 ? 's' : ''} shared by your groups
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#9ca3af'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb'
        }}>
          <button
            onClick={() => setActiveTab('entries')}
            style={{
              flex: 1,
              padding: '0.875rem',
              border: 'none',
              background: activeTab === 'entries' ? 'white' : 'transparent',
              borderBottom: activeTab === 'entries' ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'entries' ? 600 : 400,
              color: activeTab === 'entries' ? theme.colors.primary : '#6b7280'
            }}
          >
            🔐 Safe Entries ({sharedEntries.length})
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            style={{
              flex: 1,
              padding: '0.875rem',
              border: 'none',
              background: activeTab === 'documents' ? 'white' : 'transparent',
              borderBottom: activeTab === 'documents' ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'documents' ? 600 : 400,
              color: activeTab === 'documents' ? theme.colors.primary : '#6b7280'
            }}
          >
            📄 Documents ({sharedDocuments.length})
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            background: '#fee2e2',
            color: '#dc2626'
          }}>
            {error}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.5rem' }}>
          {/* ENTRIES TAB */}
          {activeTab === 'entries' && (
            <>
              {sharedEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
                  <p>No safe entries shared with you yet.</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    When someone shares an entry with your group, it will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {sharedEntries.map(entry => (
                    <div
                      key={entry.id}
                      style={{
                        padding: '1rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.75rem',
                        background: 'white'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1.25rem' }}>🔐</span>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
                              {entry.entryTitle || 'Shared Entry'}
                            </h3>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              background: '#f0fdfa',
                              color: '#0d9488',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: 500
                            }}>
                              {getGroupIcon(entry.groupId)} {getGroupName(entry.groupId)}
                            </span>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              background: entry.shareMode === 'readonly' ? '#fef3c7' : '#dcfce7',
                              color: entry.shareMode === 'readonly' ? '#92400e' : '#166534',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: 500
                            }}>
                              {entry.shareMode === 'readonly' ? '👁️ View only' : '📋 Can copy'}
                            </span>
                            {copiedIds.has(entry.safeEntryId) && (
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                background: '#e0e7ff',
                                color: '#4338ca',
                                borderRadius: '0.375rem',
                                fontSize: '0.75rem',
                                fontWeight: 500
                              }}>
                                ✓ Copied
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
                            Shared {new Date(entry.sharedAt).toLocaleDateString()}
                          </p>
                        </div>
                        {entry.shareMode === 'copy' && !copiedIds.has(entry.safeEntryId) && (
                          <button
                            onClick={() => handleCopy(entry, 'safe_entry')}
                            style={{
                              padding: '0.5rem 1rem',
                              background: theme.colors.primary,
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.5rem',
                              cursor: 'pointer',
                              fontWeight: 500,
                              fontSize: '0.85rem'
                            }}
                          >
                            📋 Copy to My Safe
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* DOCUMENTS TAB */}
          {activeTab === 'documents' && (
            <>
              {sharedDocuments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
                  <p>No documents shared with you yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {sharedDocuments.map(doc => (
                    <div
                      key={doc.id}
                      style={{
                        padding: '1rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.75rem',
                        background: 'white'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1.25rem' }}>📄</span>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
                              {doc.documentTitle || 'Shared Document'}
                            </h3>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              background: '#f0fdfa',
                              color: '#0d9488',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: 500
                            }}>
                              {getGroupIcon(doc.groupId)} {getGroupName(doc.groupId)}
                            </span>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              background: doc.shareMode === 'readonly' ? '#fef3c7' : '#dcfce7',
                              color: doc.shareMode === 'readonly' ? '#92400e' : '#166534',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: 500
                            }}>
                              {doc.shareMode === 'readonly' ? '👁️ View only' : '📋 Can copy'}
                            </span>
                            {copiedIds.has(doc.documentId) && (
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                background: '#e0e7ff',
                                color: '#4338ca',
                                borderRadius: '0.375rem',
                                fontSize: '0.75rem',
                                fontWeight: 500
                              }}>
                                ✓ Copied
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
                            Shared {new Date(doc.sharedAt).toLocaleDateString()}
                          </p>
                        </div>
                        {doc.shareMode === 'copy' && !copiedIds.has(doc.documentId) && (
                          <button
                            onClick={() => handleCopy(doc, 'document')}
                            style={{
                              padding: '0.5rem 1rem',
                              background: theme.colors.primary,
                              color: 'white',
                              border: 'none',
                              borderRadius: '0.5rem',
                              cursor: 'pointer',
                              fontWeight: 500,
                              fontSize: '0.85rem'
                            }}
                          >
                            📋 Copy to My Safe
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb'
        }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default SharedWithMeView;
