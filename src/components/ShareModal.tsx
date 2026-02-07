/**
 * ShareModal - Generic modal for sharing non-Safe entities (TODOs, Events, Journals, etc.)
 * 
 * This is simpler than ShareEntryModal because non-Safe entities don't require encryption.
 * They are shared directly via database references.
 * 
 * Features:
 * - Select group(s) to share with
 * - Choose share mode (readonly or editable)
 * - View/revoke existing shares
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { SharingGroup } from '../types';
import * as sharingService from '../services/sharingService';

export type ShareableEntityType = 
  | 'todo_group' 
  | 'todo_item' 
  | 'event' 
  | 'journal' 
  | 'resolution' 
  | 'routine';

interface ShareModalProps {
  entityId: string;
  entityTitle: string;
  entityType: ShareableEntityType;
  onClose: () => void;
  onShared?: () => void;
}

interface ExistingShare {
  id: string;
  groupId: string;
  groupName?: string;
  shareMode: 'readonly' | 'editable';
  sharedAt: string;
}

const ShareModal: React.FC<ShareModalProps> = ({
  entityId,
  entityTitle,
  entityType,
  onClose,
  onShared,
}) => {
  const { theme } = useTheme();
  
  const [groups, setGroups] = useState<SharingGroup[]>([]);
  const [existingShares, setExistingShares] = useState<ExistingShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [shareMode, setShareMode] = useState<'readonly' | 'editable'>('readonly');
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

      // Get existing shares for this entity
      const allShares: ExistingShare[] = [];
      
      if (entityType === 'todo_group') {
        const shares = await sharingService.getSharedTodoGroupsForOwner(entityId);
        allShares.push(...shares.map(s => ({
          id: s.id,
          groupId: s.groupId,
          groupName: groupsData.find(g => g.id === s.groupId)?.name,
          shareMode: s.shareMode,
          sharedAt: s.sharedAt,
        })));
      }
      // TODO: Add other entity types as needed
      
      setExistingShares(allShares);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedGroupId) {
      setError('Please select a group');
      return;
    }

    // Check if already shared with this group
    if (existingShares.some(s => s.groupId === selectedGroupId)) {
      setError('Already shared with this group');
      return;
    }

    setSharing(true);
    setError(null);
    
    try {
      if (entityType === 'todo_group') {
        await sharingService.shareTodoGroup(entityId, selectedGroupId, shareMode);
      }
      // TODO: Add other entity types as needed
      
      await loadData();
      setSelectedGroupId('');
      if (onShared) onShared();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    if (!confirm('Revoke this share? The group will lose access.')) return;
    
    try {
      if (entityType === 'todo_group') {
        await sharingService.revokeTodoGroupShare(shareId);
      }
      // TODO: Add other entity types as needed
      
      await loadData();
      if (onShared) onShared();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke share');
    }
  };

  const availableGroups = groups.filter(g => 
    !existingShares.some(s => s.groupId === g.id)
  );

  const getEntityTypeLabel = () => {
    switch (entityType) {
      case 'todo_group': return 'List';
      case 'todo_item': return 'Item';
      case 'event': return 'Event';
      case 'journal': return 'Journal Entry';
      case 'resolution': return 'Resolution';
      case 'routine': return 'Routine';
      default: return 'Item';
    }
  };

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
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1f2937' }}>
              Share {getEntityTypeLabel()}
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
              {entityTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#9ca3af',
              padding: '0.25rem'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              Loading...
            </div>
          ) : (
            <>
              {error && (
                <div style={{
                  padding: '0.75rem',
                  background: '#fee2e2',
                  color: '#dc2626',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem',
                  fontSize: '0.85rem'
                }}>
                  {error}
                </div>
              )}

              {/* Share Form */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 600, color: '#374151' }}>
                  Share with Group
                </h4>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
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
                      fontSize: '0.9rem',
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
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
                    Access Level
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setShareMode('readonly')}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        background: shareMode === 'readonly' ? theme.colors.primary : '#f3f4f6',
                        color: shareMode === 'readonly' ? 'white' : '#374151',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 500
                      }}
                    >
                      👁️ View Only
                    </button>
                    <button
                      onClick={() => setShareMode('editable')}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        background: shareMode === 'editable' ? theme.colors.primary : '#f3f4f6',
                        color: shareMode === 'editable' ? 'white' : '#374151',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 500
                      }}
                    >
                      ✏️ Can Edit
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleShare}
                  disabled={!selectedGroupId || sharing}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: selectedGroupId && !sharing ? theme.colors.primary : '#e5e7eb',
                    color: selectedGroupId && !sharing ? 'white' : '#9ca3af',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: selectedGroupId && !sharing ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}
                >
                  {sharing ? 'Sharing...' : '🔗 Share'}
                </button>
              </div>

              {/* Existing Shares */}
              {existingShares.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 600, color: '#374151' }}>
                    Currently Shared With
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {existingShares.map(share => (
                      <div
                        key={share.id}
                        style={{
                          padding: '0.75rem',
                          background: '#f9fafb',
                          borderRadius: '0.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500, fontSize: '0.85rem', color: '#1f2937' }}>
                            {share.groupName || 'Group'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            {share.shareMode === 'readonly' ? '👁️ View Only' : '✏️ Can Edit'} • 
                            Shared {new Date(share.sharedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRevoke(share.id)}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 500
                          }}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {availableGroups.length === 0 && existingShares.length > 0 && (
                <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.85rem', marginTop: '1rem' }}>
                  Already shared with all your groups
                </p>
              )}

              {groups.length === 0 && (
                <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>
                  No groups available. Create a group first to share.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
