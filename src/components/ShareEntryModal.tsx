/**
 * ShareEntryModal - Modal for sharing a safe entry or document to a group
 * 
 * Features:
 * - Select group(s) to share with
 * - Choose share mode (readonly or copy)
 * - View/revoke existing shares
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { SharingGroup, SharedSafeEntry, SharedDocument, ShareMode } from '../types';
import * as sharingService from '../services/sharingService';

interface ShareEntryModalProps {
  entryId: string;
  entryTitle: string;
  entryType: 'safe_entry' | 'document';
  onClose: () => void;
  onShared?: () => void;
}

const ShareEntryModal: React.FC<ShareEntryModalProps> = ({
  entryId,
  entryTitle,
  entryType,
  onClose,
  onShared,
}) => {
  const { theme } = useTheme();
  
  const [groups, setGroups] = useState<SharingGroup[]>([]);
  const [existingShares, setExistingShares] = useState<(SharedSafeEntry | SharedDocument)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [shareMode, setShareMode] = useState<ShareMode>('readonly');
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const groupsData = await sharingService.getMyGroups();
      setGroups(groupsData);

      // Get existing shares for this entry
      // For now, we'll check each group
      const allShares: (SharedSafeEntry | SharedDocument)[] = [];
      for (const group of groupsData) {
        try {
          if (entryType === 'safe_entry') {
            const shares = await sharingService.getSharedEntriesForGroup(group.id);
            const match = shares.find(s => s.safeEntryId === entryId);
            if (match) allShares.push({ ...match, groupName: group.name } as SharedSafeEntry);
          }
        } catch (err) {
          // Continue
        }
      }
      setExistingShares(allShares);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedGroupId) return;
    setSharing(true);
    setError(null);
    try {
      if (entryType === 'safe_entry') {
        await sharingService.shareEntry(entryId, selectedGroupId, shareMode);
      } else {
        await sharingService.shareDocument(entryId, selectedGroupId, shareMode);
      }
      setSelectedGroupId('');
      loadData();
      onShared?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    if (!confirm('Revoke this share? The group will no longer have access.')) return;
    setError(null);
    try {
      if (entryType === 'safe_entry') {
        await sharingService.revokeShare(shareId);
      } else {
        await sharingService.revokeDocumentShare(shareId);
      }
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share');
    }
  };

  // Filter out groups that already have this entry shared
  const sharedGroupIds = existingShares.map(s => s.groupId);
  const availableGroups = groups.filter(g => !sharedGroupIds.includes(g.id));

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '1rem'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <p style={{ color: '#6b7280' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        width: '100%',
        maxWidth: '480px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
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
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1f2937' }}>
              🔗 Share Entry
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
              {entryTitle}
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

        {/* Error */}
        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            background: '#fee2e2',
            color: '#dc2626',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
          {/* No groups message */}
          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
              <p>You need to create a group first before sharing.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Go to Safe → Groups to create one.
              </p>
            </div>
          ) : (
            <>
              {/* Share to new group */}
              {availableGroups.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: '#374151' }}>
                    Share with a Group
                  </h3>
                  
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>
                      Select Group
                    </label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        fontSize: '1rem',
                        background: 'white'
                      }}
                    >
                      <option value="">Choose a group...</option>
                      {availableGroups.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.icon} {g.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>
                      Share Mode
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => setShareMode('readonly')}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          border: `2px solid ${shareMode === 'readonly' ? theme.colors.primary : '#e5e7eb'}`,
                          borderRadius: '0.5rem',
                          background: shareMode === 'readonly' ? `${theme.colors.primary}10` : 'white',
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>👁️</div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1f2937' }}>View Only</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Can view but not copy</div>
                      </button>
                      <button
                        onClick={() => setShareMode('copy')}
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          border: `2px solid ${shareMode === 'copy' ? theme.colors.primary : '#e5e7eb'}`,
                          borderRadius: '0.5rem',
                          background: shareMode === 'copy' ? `${theme.colors.primary}10` : 'white',
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>📋</div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1f2937' }}>Allow Copy</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Can copy to their Safe</div>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleShare}
                    disabled={!selectedGroupId || sharing}
                    style={{
                      width: '100%',
                      padding: '0.875rem',
                      background: selectedGroupId ? theme.colors.primary : '#e5e7eb',
                      color: selectedGroupId ? 'white' : '#9ca3af',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: selectedGroupId ? 'pointer' : 'not-allowed',
                      fontWeight: 600,
                      fontSize: '1rem'
                    }}
                  >
                    {sharing ? 'Sharing...' : '🔗 Share Entry'}
                  </button>
                </div>
              )}

              {/* Existing shares */}
              {existingShares.length > 0 && (
                <div>
                  <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: '#374151' }}>
                    Currently Shared With
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {existingShares.map(share => {
                      const group = groups.find(g => g.id === share.groupId);
                      return (
                        <div
                          key={share.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem 1rem',
                            background: '#f9fafb',
                            borderRadius: '0.5rem',
                            border: '1px solid #e5e7eb'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '1.25rem' }}>{group?.icon || '👥'}</span>
                            <div>
                              <div style={{ fontWeight: 500, color: '#1f2937' }}>
                                {group?.name || 'Unknown Group'}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                {share.shareMode === 'readonly' ? '👁️ View only' : '📋 Can copy'}
                                {' · '}
                                {new Date(share.sharedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRevoke(share.id)}
                            style={{
                              padding: '0.375rem 0.75rem',
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: 'none',
                              borderRadius: '0.375rem',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 500
                            }}
                          >
                            Revoke
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {availableGroups.length === 0 && existingShares.length > 0 && (
                <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.9rem', marginTop: '1rem' }}>
                  This entry is shared with all your groups.
                </p>
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
    </div>
  );
};

export default ShareEntryModal;
