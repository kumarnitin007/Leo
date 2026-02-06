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
import { SharingGroup, SharedSafeEntry, SharedDocument, ShareMode, SafeEntry, DocumentVault } from '../types';
import * as sharingService from '../services/sharingService';
import * as documentSharingService from '../services/documentSharingService';
import { getOrCreateGroupKey } from '../services/groupEncryptionService';
import { getSafeEntries } from '../storage';
import getSupabaseClient from '../lib/supabase';
import { decryptData } from '../utils/encryption';

interface ShareEntryModalProps {
  entryId: string;
  entryTitle: string;
  entryType: 'safe_entry' | 'document';
  encryptionKey: CryptoKey | null; // NEW: User's master key (to get group key)
  groupKeys: Map<string, CryptoKey>; // NEW: Already loaded group keys
  onGroupKeyCreated?: (groupId: string, groupKey: CryptoKey) => void; // NEW: Callback when new key created
  onClose: () => void;
  onShared?: () => void;
}

const ShareEntryModal: React.FC<ShareEntryModalProps> = ({
  entryId,
  entryTitle,
  entryType,
  encryptionKey,
  groupKeys,
  onGroupKeyCreated,
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
      const allShares: (SharedSafeEntry | SharedDocument)[] = [];
      
      if (entryType === 'safe_entry') {
        // Load password entry shares
        for (const group of groupsData) {
          try {
            const shares = await sharingService.getSharedEntriesForGroup(group.id);
            const match = shares.find(s => s.safeEntryId === entryId);
            if (match) allShares.push({ ...match, groupName: group.name } as SharedSafeEntry);
          } catch (err) {
            // Continue
          }
        }
      } else if (entryType === 'document') {
        // Load document shares
        try {
          const { getDocumentShares } = await import('../services/documentSharingService');
          const docShares = await getDocumentShares(entryId);
          allShares.push(...docShares.map(s => ({
            id: s.shareId, // Map shareId to id for consistency
            groupId: s.groupId,
            groupName: s.groupName,
            shareMode: s.shareMode,
            sharedAt: s.sharedAt,
          } as any)));
        } catch (err) {
          console.warn('Failed to load document shares:', err);
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
    if (!encryptionKey) {
      setError('Safe must be unlocked to share entries');
      return;
    }
    
    console.log('[ShareEntryModal] 🚀 Starting share process:', {
      entryId,
      entryTitle,
      selectedGroupId,
      shareMode,
      entryType
    });
    
    setSharing(true);
    setError(null);
    try {
      if (entryType === 'safe_entry') {
        console.log('[ShareEntryModal] 🔐 Using group encryption for safe entry');
        
        // 1. Get the actual entry and decrypt it
        console.log('[ShareEntryModal] 📂 Fetching entry from storage...');
        const allEntries = await getSafeEntries();
        const entry = allEntries.find(e => e.id === entryId);
        if (!entry) {
          console.error('[ShareEntryModal] ❌ Entry not found in storage');
          throw new Error('Entry not found');
        }
        console.log('[ShareEntryModal] ✅ Entry found:', entry.title);
        
        // Decrypt the entry data with user's master key
        console.log('[ShareEntryModal] 🔓 Decrypting entry with user master key...');
        let entryData;
        try {
          const decryptedJson = await decryptData(
            entry.encryptedData,
            entry.encryptedDataIv,
            encryptionKey
          );
          entryData = JSON.parse(decryptedJson);
          console.log('[ShareEntryModal] ✅ Entry decrypted successfully');
        } catch (err) {
          console.error('[ShareEntryModal] ❌ Failed to decrypt entry:', err);
          throw new Error('Failed to decrypt entry. Make sure Safe is unlocked.');
        }
        
        // 2. Get or create group key for this group
        console.log('[ShareEntryModal] 🔑 Getting group key for:', selectedGroupId);
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        
        let groupKey = groupKeys.get(selectedGroupId);
        if (!groupKey) {
          console.log('[ShareEntryModal] 🆕 Group key not found, creating new one...');
          groupKey = await getOrCreateGroupKey(selectedGroupId, user.id, encryptionKey);
          console.log('[ShareEntryModal] ✅ New group key created');
          
          // Grant access to all group members
          console.log('[ShareEntryModal] 🔑 Granting access to all group members...');
          const { data: members, error: membersError } = await supabase
            .from('myday_group_members')
            .select('user_id')
            .eq('group_id', selectedGroupId);
          
          if (membersError) {
            console.error('[ShareEntryModal] ❌ Failed to fetch group members:', membersError);
          }
          
          console.log(`[ShareEntryModal] 📋 Found ${members?.length || 0} total members`);
          
          // Filter out current user (already has key)
          const otherMembers = (members || []).filter(m => m.user_id !== user.id);
          console.log(`[ShareEntryModal] 👥 ${otherMembers.length} other members to grant access`);
          
          if (otherMembers && otherMembers.length > 0) {
            const { addMemberToGroup } = await import('../services/groupEncryptionService');
            for (const member of otherMembers) {
              try {
                console.log(`[ShareEntryModal] 🔐 Adding member ${member.user_id} to group encryption...`);
                await addMemberToGroup(selectedGroupId, user.id, member.user_id, encryptionKey);
                console.log(`[ShareEntryModal] ✅ Member ${member.user_id} granted access`);
              } catch (err) {
                console.error(`[ShareEntryModal] ❌ Failed to grant access to ${member.user_id}:`, err);
              }
            }
          }
          
          // Notify parent to update groupKeys state
          if (onGroupKeyCreated) {
            onGroupKeyCreated(selectedGroupId, groupKey);
            console.log('[ShareEntryModal] 📢 Notified parent of new group key');
          }
        } else {
          console.log('[ShareEntryModal] ✅ Using existing group key');
        }
        
        // 3. Get category name from tag ID
        let categoryName = '';
        if (entry.categoryTagId) {
          const { data: tagData } = await supabase
            .from('myday_tags')
            .select('name')
            .eq('id', entry.categoryTagId)
            .single();
          categoryName = tagData?.name || '';
        }
        
        // 4. Share with group encryption
        console.log('[ShareEntryModal] 📤 Sharing entry with group encryption...');
        await sharingService.shareEntryWithGroupEncryption(
          entryId,
          entry.title, // Pass title for display
          categoryName, // Pass category NAME (not ID) so recipients can see it
          entryData,
          selectedGroupId,
          groupKey,
          shareMode
        );
        console.log('[ShareEntryModal] 🎉 Entry shared successfully!');
      } else if (entryType === 'document') {
        console.log('[ShareEntryModal] 📄 Sharing document with group encryption');
        
        // 1. Fetch the document
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        
        const { data: docData, error: docError } = await supabase
          .from('myday_document_vaults')
          .select('*')
          .eq('id', entryId)
          .eq('user_id', user.id)
          .single();
        
        if (docError || !docData) {
          throw new Error('Document not found');
        }
        
        const document: DocumentVault = {
          id: docData.id,
          title: docData.title,
          provider: docData.provider,
          documentType: docData.document_type,
          expiryDate: docData.expiry_date,
          tags: docData.tags || [],
          isFavorite: docData.is_favorite || false,
          encryptedData: docData.encrypted_data,
          encryptedDataIv: docData.encrypted_data_iv,
          createdAt: docData.created_at,
          updatedAt: docData.updated_at,
        };
        
        // 2. Share using document sharing service (only readonly/readwrite modes)
        const docShareMode = shareMode === 'copy' ? 'readonly' : shareMode;
        await documentSharingService.shareDocumentWithGroup(
          document,
          selectedGroupId,
          docShareMode as 'readonly' | 'readwrite',
          user.id,
          encryptionKey
        );
        console.log('[ShareEntryModal] ✅ Document shared successfully');
      }
      setSelectedGroupId('');
      console.log('[ShareEntryModal] 🔄 Reloading data...');
      loadData();
      onShared?.();
    } catch (err) {
      console.error('[ShareEntryModal] ❌ Share failed:', err);
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
