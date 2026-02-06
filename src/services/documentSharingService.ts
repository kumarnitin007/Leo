/**
 * Document Sharing Service
 * 
 * Handles sharing Safe documents with groups using group encryption
 * Mirrors the Safe entry sharing architecture
 */

import getSupabaseClient from '../lib/supabase';
import { encryptData, decryptData } from '../utils/encryption';
import { getOrCreateGroupKey } from './groupEncryptionService';
import type { DocumentVault } from '../types';

export interface SharedDocument {
  id: string;
  documentId: string;
  groupId: string;
  sharedBy: string;
  shareMode: 'readonly' | 'readwrite';
  groupEncryptedData: string;
  groupEncryptedDataIv: string;
  documentTitle: string;
  documentType: string;
  provider: string;
  documentVersion: number;
  lastUpdatedBy: string | null;
  lastUpdatedAt: string | null;
  sharedAt: string;
  createdAt: string;
  updatedAt: string;
  // Decrypted data (populated after decryption)
  decryptedData?: any;
  // Display names
  sharedByName?: string;
  lastUpdatedByName?: string;
}

export interface DocumentShare {
  shareId: string;
  groupId: string;
  groupName: string;
  shareMode: string;
  sharedAt: string;
  memberCount: number;
}

/**
 * Share a document with a group using group encryption
 */
export async function shareDocumentWithGroup(
  document: DocumentVault,
  groupId: string,
  shareMode: 'readonly' | 'readwrite',
  currentUserId: string,
  masterKey: CryptoKey
): Promise<void> {
  console.log('[DocumentSharingService] 📤 Sharing document:', {
    documentId: document.id,
    groupId,
    shareMode,
  });

  const supabase = getSupabaseClient();

  // Get the group encryption key
  const groupKey = await getOrCreateGroupKey(groupId, currentUserId, masterKey);
  if (!groupKey) {
    throw new Error('Group encryption key not found');
  }

  // Encrypt document data with group key
  const documentData = {
    id: document.id,
    title: document.title,
    provider: document.provider,
    documentType: document.documentType,
    expiryDate: document.expiryDate,
    tags: document.tags,
    isFavorite: document.isFavorite,
    encryptedData: document.encryptedData, // Original encrypted data
    encryptedDataIv: document.encryptedDataIv,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };

  const { encrypted, iv } = await encryptData(
    JSON.stringify(documentData),
    groupKey
  );

  // Insert shared document record
  const { error } = await supabase.from('myday_shared_safe_documents').insert({
    document_id: document.id,
    group_id: groupId,
    shared_by: currentUserId,
    share_mode: shareMode,
    group_encrypted_data: encrypted,
    group_encrypted_data_iv: iv,
    document_title: document.title,
    document_type: document.documentType,
    provider: document.provider,
    last_updated_by: currentUserId,
    last_updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[DocumentSharingService] ❌ Failed to share document:', error);
    throw new Error(`Failed to share document: ${error.message}`);
  }

  console.log('[DocumentSharingService] ✅ Document shared successfully');
}

/**
 * Get documents shared with the current user
 */
export async function getDocumentsSharedWithMe(
  userId: string,
  groupKeys: Map<string, CryptoKey>
): Promise<SharedDocument[]> {
  console.log('[DocumentSharingService] 📥 Loading shared documents for user:', userId);

  const supabase = getSupabaseClient();

  // Get user's groups
  const { data: memberData, error: memberError } = await supabase
    .from('myday_group_members')
    .select('group_id')
    .eq('user_id', userId);

  if (memberError || !memberData || memberData.length === 0) {
    console.log('[DocumentSharingService] No groups found for user');
    return [];
  }

  const groupIds = memberData.map((m) => m.group_id);

  // Get shared documents
  const { data, error } = await supabase
    .from('myday_shared_safe_documents')
    .select('*')
    .in('group_id', groupIds)
    .order('shared_at', { ascending: false });

  if (error) {
    console.error('[DocumentSharingService] ❌ Failed to load shared documents:', error);
    throw new Error(`Failed to load shared documents: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log('[DocumentSharingService] No shared documents found');
    return [];
  }

  console.log(`[DocumentSharingService] Found ${data.length} shared documents`);

  // Get display names for sharers and updaters
  const userIds = [
    ...new Set([
      ...data.map((d) => d.shared_by),
      ...data.map((d) => d.last_updated_by).filter(Boolean),
    ]),
  ];

  const { data: membersData } = await supabase
    .from('myday_group_members')
    .select('user_id, display_name')
    .in('user_id', userIds);

  const displayNames = new Map(
    (membersData || []).map((m) => [m.user_id, m.display_name])
  );

  // Decrypt documents
  const sharedDocuments: SharedDocument[] = [];

  for (const row of data) {
    const groupKey = groupKeys.get(row.group_id);

    let decryptedData = null;
    if (groupKey) {
      try {
        const decrypted = await decryptData(
          row.group_encrypted_data,
          row.group_encrypted_data_iv,
          groupKey
        );
        decryptedData = JSON.parse(decrypted);
      } catch (err) {
        console.error(
          `[DocumentSharingService] Failed to decrypt document ${row.document_id}:`,
          err
        );
      }
    }

    sharedDocuments.push({
      id: row.id,
      documentId: row.document_id,
      groupId: row.group_id,
      sharedBy: row.shared_by,
      shareMode: row.share_mode,
      groupEncryptedData: row.group_encrypted_data,
      groupEncryptedDataIv: row.group_encrypted_data_iv,
      documentTitle: row.document_title,
      documentType: row.document_type,
      provider: row.provider,
      documentVersion: row.document_version || 1,
      lastUpdatedBy: row.last_updated_by,
      lastUpdatedAt: row.last_updated_at,
      sharedAt: row.shared_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      decryptedData,
      sharedByName: displayNames.get(row.shared_by) || 'Someone',
      lastUpdatedByName: row.last_updated_by
        ? displayNames.get(row.last_updated_by) || 'Someone'
        : null,
    });
  }

  console.log(
    `[DocumentSharingService] ✅ Decrypted ${sharedDocuments.length} documents`
  );
  return sharedDocuments;
}

/**
 * Get shares for a specific document
 */
export async function getDocumentShares(documentId: string): Promise<DocumentShare[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_document_shares', {
    p_document_id: documentId,
  });

  if (error) {
    console.error('[DocumentSharingService] Error fetching document shares:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    shareId: row.share_id,
    groupId: row.group_id,
    groupName: row.group_name,
    shareMode: row.share_mode,
    sharedAt: row.shared_at,
    memberCount: row.member_count,
  }));
}

/**
 * Check if document has active shares
 */
export async function hasActiveShares(documentId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('document_has_active_shares', {
    p_document_id: documentId,
  });

  if (error) {
    console.error('[DocumentSharingService] Error checking shares:', error);
    return false;
  }

  return data || false;
}

/**
 * Get share count for a document
 */
export async function getShareCount(documentId: string): Promise<number> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_document_share_count', {
    p_document_id: documentId,
  });

  if (error) {
    console.error('[DocumentSharingService] Error getting share count:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Unshare a document from a group
 */
export async function unshareDocument(
  documentId: string,
  groupId: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('myday_shared_safe_documents')
    .delete()
    .eq('document_id', documentId)
    .eq('group_id', groupId);

  if (error) {
    console.error('[DocumentSharingService] Error unsharing document:', error);
    throw new Error(`Failed to unshare document: ${error.message}`);
  }

  console.log('[DocumentSharingService] ✅ Document unshared successfully');
}

/**
 * Update shared document (propagate changes to all shares)
 */
export async function updateSharedDocuments(
  document: DocumentVault,
  currentUserId: string,
  masterKey: CryptoKey
): Promise<number> {
  console.log('[DocumentSharingService] 🔄 Updating shared documents:', document.id);

  const supabase = getSupabaseClient();

  // Get all shares for this document
  const { data: shares, error: sharesError } = await supabase
    .from('myday_shared_safe_documents')
    .select('id, group_id')
    .eq('document_id', document.id);

  if (sharesError) {
    console.error('[DocumentSharingService] Error fetching shares:', sharesError);
    return 0;
  }

  if (!shares || shares.length === 0) {
    console.log('[DocumentSharingService] No shares to update');
    return 0;
  }

  let updateCount = 0;

  for (const share of shares) {
    try {
      // Get group key
      const groupKey = await getOrCreateGroupKey(share.group_id, currentUserId, masterKey);
      if (!groupKey) {
        console.warn(`[DocumentSharingService] No group key for ${share.group_id}`);
        continue;
      }

      // Re-encrypt with group key
      const documentData = {
        id: document.id,
        title: document.title,
        provider: document.provider,
        documentType: document.documentType,
        expiryDate: document.expiryDate,
        tags: document.tags,
        isFavorite: document.isFavorite,
        encryptedData: document.encryptedData,
        encryptedDataIv: document.encryptedDataIv,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      };

      const { encrypted, iv } = await encryptData(
        JSON.stringify(documentData),
        groupKey
      );

      // Update shared document
      const { error: updateError } = await supabase
        .from('myday_shared_safe_documents')
        .update({
          group_encrypted_data: encrypted,
          group_encrypted_data_iv: iv,
          document_title: document.title,
          document_type: document.documentType,
          provider: document.provider,
          last_updated_by: currentUserId,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', share.id);

      if (updateError) {
        console.error(
          `[DocumentSharingService] Failed to update share ${share.id}:`,
          updateError
        );
      } else {
        updateCount++;
      }
    } catch (err) {
      console.error(
        `[DocumentSharingService] Error updating share ${share.id}:`,
        err
      );
    }
  }

  console.log(
    `[DocumentSharingService] ✅ Updated ${updateCount}/${shares.length} shares`
  );
  return updateCount;
}
