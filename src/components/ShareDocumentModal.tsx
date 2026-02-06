/**
 * Share Document Modal
 * 
 * Modal for sharing Safe documents with groups
 * Mirrors ShareEntryModal for Safe entries
 */

import React, { useState, useEffect } from 'react';
import getSupabaseClient from '../lib/supabase';
import type { DocumentVault } from '../types';
import * as documentSharingService from '../services/documentSharingService';
import * as groupEncryptionService from '../services/groupEncryptionService';
import type { CryptoKey } from '../utils/encryption';

interface ShareDocumentModalProps {
  document: DocumentVault;
  masterKey: CryptoKey;
  onClose: () => void;
  onShared: () => void;
  onGroupKeyCreated?: () => void;
}

interface GroupMember {
  userId: string;
  displayName: string;
  email: string;
}

interface Group {
  id: string;
  name: string;
  members: GroupMember[];
}

const ShareDocumentModal: React.FC<ShareDocumentModalProps> = ({
  document,
  masterKey,
  onClose,
  onShared,
  onGroupKeyCreated,
}) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [shareMode, setShareMode] = useState<'readonly' | 'readwrite'>('readonly');
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return;
      }

      // Get user's groups
      const { data: memberData, error: memberError } = await supabase
        .from('myday_group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      if (!memberData || memberData.length === 0) {
        setGroups([]);
        return;
      }

      const groupIds = memberData.map(m => m.group_id);

      // Get group details
      const { data: groupsData, error: groupsError } = await supabase
        .from('myday_groups')
        .select('id, name')
        .in('id', groupIds);

      if (groupsError) throw groupsError;

      // Get members for each group
      const groupsWithMembers: Group[] = [];
      
      for (const group of groupsData || []) {
        const { data: membersData, error: membersError } = await supabase
          .from('myday_group_members')
          .select('user_id, display_name, email')
          .eq('group_id', group.id);

        if (membersError) {
          console.error('Error loading members:', membersError);
          continue;
        }

        // Filter out current user
        const members = (membersData || [])
          .filter(m => m.user_id !== user.id)
          .map(m => ({
            userId: m.user_id,
            displayName: m.display_name || 'Unknown',
            email: m.email || '',
          }));

        groupsWithMembers.push({
          id: group.id,
          name: group.name,
          members,
        });
      }

      setGroups(groupsWithMembers);
    } catch (err) {
      console.error('[ShareDocumentModal] Error loading groups:', err);
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!selectedGroupId) {
      setError('Please select a group');
      return;
    }

    try {
      setSharing(true);
      setError(null);

      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      console.log('[ShareDocumentModal] 📤 Sharing document:', {
        documentId: document.id,
        groupId: selectedGroupId,
        shareMode,
      });

      // Ensure group key exists (will be created in shareDocumentWithGroup if needed)
      console.log('[ShareDocumentModal] Ensuring group key exists...');
      await groupEncryptionService.getOrCreateGroupKey(selectedGroupId, user.id, masterKey);
      
      // Notify parent to reload group keys
      if (onGroupKeyCreated) {
        onGroupKeyCreated();
      }

      // Share document
      await documentSharingService.shareDocumentWithGroup(
        document,
        selectedGroupId,
        shareMode,
        user.id,
        masterKey
      );

      console.log('[ShareDocumentModal] ✅ Document shared successfully');
      onShared();
      onClose();
    } catch (err: any) {
      console.error('[ShareDocumentModal] ❌ Share failed:', err);
      setError(err.message || 'Failed to share document');
    } finally {
      setSharing(false);
    }
  };

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>
          Share Document
        </h2>

        <div style={{ marginBottom: '1rem' }}>
          <div
            style={{
              background: '#f3f4f6',
              padding: '0.75rem',
              borderRadius: '4px',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
              {document.title}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              {document.documentType} • {document.provider}
            </div>
          </div>

          {error && (
            <div
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                padding: '0.75rem',
                borderRadius: '4px',
                marginBottom: '1rem',
                fontSize: '0.875rem',
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
              Loading groups...
            </div>
          ) : groups.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2rem',
                color: '#6b7280',
                background: '#f9fafb',
                borderRadius: '4px',
              }}
            >
              <p style={{ margin: '0 0 0.5rem 0' }}>No groups available</p>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>
                Create a group first to share documents
              </p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                  }}
                >
                  Select Group
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="">Choose a group...</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.members.length} member
                      {group.members.length !== 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
              </div>

              {selectedGroup && selectedGroup.members.length > 0 && (
                <div
                  style={{
                    background: '#f9fafb',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    marginBottom: '1rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: '0.5rem',
                    }}
                  >
                    SHARING WITH:
                  </div>
                  {selectedGroup.members.map((member) => (
                    <div
                      key={member.userId}
                      style={{
                        fontSize: '0.875rem',
                        color: '#374151',
                        marginBottom: '0.25rem',
                      }}
                    >
                      • {member.displayName}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                  }}
                >
                  Permission Level
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <label
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: `2px solid ${
                        shareMode === 'readonly' ? '#3b82f6' : '#d1d5db'
                      }`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background:
                        shareMode === 'readonly' ? '#eff6ff' : 'white',
                    }}
                  >
                    <input
                      type="radio"
                      value="readonly"
                      checked={shareMode === 'readonly'}
                      onChange={(e) =>
                        setShareMode(e.target.value as 'readonly')
                      }
                      style={{ marginRight: '0.5rem' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      Read-only
                    </span>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        marginTop: '0.25rem',
                      }}
                    >
                      Can view only
                    </div>
                  </label>

                  <label
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: `2px solid ${
                        shareMode === 'readwrite' ? '#3b82f6' : '#d1d5db'
                      }`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background:
                        shareMode === 'readwrite' ? '#eff6ff' : 'white',
                    }}
                  >
                    <input
                      type="radio"
                      value="readwrite"
                      checked={shareMode === 'readwrite'}
                      onChange={(e) =>
                        setShareMode(e.target.value as 'readwrite')
                      }
                      style={{ marginRight: '0.5rem' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                      Read & Edit
                    </span>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        marginTop: '0.25rem',
                      }}
                    >
                      Can view and edit
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={sharing}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              background: 'white',
              cursor: sharing ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={!selectedGroupId || sharing || groups.length === 0}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '4px',
              background:
                !selectedGroupId || sharing || groups.length === 0
                  ? '#d1d5db'
                  : '#3b82f6',
              color: 'white',
              cursor:
                !selectedGroupId || sharing || groups.length === 0
                  ? 'not-allowed'
                  : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            {sharing ? 'Sharing...' : 'Share Document'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareDocumentModal;
