/**
 * SharingService - CRUD operations for sharing groups, invitations, and shared entries
 * 
 * Handles:
 * - Group management (create, update, delete, list)
 * - Member management (add, remove, update role)
 * - Invitations (send, accept, reject, list)
 * - Sharing safe entries and documents
 * - Copying shared entries to local DB
 */

import getSupabaseClient from '../lib/supabase';
import {
  SharingGroup,
  GroupMember,
  GroupInvitation,
  SharedSafeEntry,
  SharedDocument,
  EntryCopy,
  ShareMode,
  GroupMemberRole,
} from '../types';
import { encryptData } from '../utils/encryption';

// Get supabase client helper
const getClient = () => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');
  return client;
};

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// ===== GROUPS =====

export async function getMyGroups(): Promise<SharingGroup[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get groups where user is a member
  const { data: memberData, error: memberError } = await supabase
    .from('myday_group_members')
    .select('group_id')
    .eq('user_id', user.id);

  if (memberError) throw memberError;

  const groupIds = (memberData || []).map(m => m.group_id);
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase
    .from('myday_groups')
    .select('*')
    .in('id', groupIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    createdBy: row.created_by,
    maxMembers: row.max_members,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createGroup(group: Partial<SharingGroup>): Promise<SharingGroup> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const id = generateId();

  const { data, error } = await supabase
    .from('myday_groups')
    .insert({
      id,
      name: group.name || 'New Group',
      description: group.description || null,
      icon: group.icon || '👥',
      color: group.color || '#6366f1',
      created_by: user.id,
      max_members: 5,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw error;

  // Add creator as owner
  await supabase.from('myday_group_members').insert({
    id: generateId(),
    group_id: id,
    user_id: user.id,
    role: 'owner',
    display_name: user.email?.split('@')[0] || 'Owner',
    joined_at: now,
  });

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    icon: data.icon,
    color: data.color,
    createdBy: data.created_by,
    maxMembers: data.max_members,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateGroup(id: string, updates: Partial<SharingGroup>): Promise<SharingGroup> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) updatePayload.name = updates.name;
  if (updates.description !== undefined) updatePayload.description = updates.description;
  if (updates.icon !== undefined) updatePayload.icon = updates.icon;
  if (updates.color !== undefined) updatePayload.color = updates.color;

  const { data, error } = await supabase
    .from('myday_groups')
    .update(updatePayload)
    .eq('id', id)
    .eq('created_by', user.id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    icon: data.icon,
    color: data.color,
    createdBy: data.created_by,
    maxMembers: data.max_members,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function deleteGroup(id: string): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('myday_groups')
    .delete()
    .eq('id', id)
    .eq('created_by', user.id);

  if (error) throw error;
}

// ===== MEMBERS =====

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('myday_group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    groupId: row.group_id,
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name,
    joinedAt: row.joined_at,
  }));
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check if current user is owner
  const { data: memberCheck } = await supabase
    .from('myday_group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();

  if (memberCheck?.role !== 'owner' && user.id !== userId) {
    throw new Error('Only group owner can remove other members');
  }

  const { error } = await supabase
    .from('myday_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function updateMemberRole(groupId: string, userId: string, role: GroupMemberRole): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('myday_group_members')
    .update({ role })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function leaveGroup(groupId: string): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check if user is owner - owner can't leave, must delete group
  const { data: memberCheck } = await supabase
    .from('myday_group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();

  if (memberCheck?.role === 'owner') {
    throw new Error('Group owner cannot leave. Transfer ownership or delete the group.');
  }

  await removeMember(groupId, user.id);
}

export async function updateMyDisplayName(displayName: string): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Update display name in all groups the user is a member of
  const { error } = await supabase
    .from('myday_group_members')
    .update({ display_name: displayName })
    .eq('user_id', user.id);

  if (error) throw error;
}

// ===== INVITATIONS =====

export async function getMyInvitations(): Promise<GroupInvitation[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get invitations sent to this user (by user_id or email)
  const { data, error } = await supabase
    .from('myday_invitations')
    .select(`
      *,
      myday_groups (name)
    `)
    .or(`invited_user_id.eq.${user.id},invited_email.eq.${user.email}`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Get inviter names from group members
  const inviterIds = [...new Set((data || []).map(row => row.invited_by))];
  const inviterNames: Record<string, string> = {};
  
  if (inviterIds.length > 0) {
    const { data: membersData } = await supabase
      .from('myday_group_members')
      .select('user_id, display_name')
      .in('user_id', inviterIds);
    
    (membersData || []).forEach(m => {
      if (m.display_name) {
        inviterNames[m.user_id] = m.display_name;
      }
    });
  }

  return (data || []).map(row => ({
    id: row.id,
    groupId: row.group_id,
    invitedBy: row.invited_by,
    invitedUserId: row.invited_user_id,
    invitedEmail: row.invited_email,
    status: row.status,
    message: row.message,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    groupName: row.myday_groups?.name,
    inviterName: inviterNames[row.invited_by] || undefined,
  }));
}

export async function getSentInvitations(groupId: string): Promise<GroupInvitation[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('myday_invitations')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    groupId: row.group_id,
    invitedBy: row.invited_by,
    invitedUserId: row.invited_user_id,
    invitedEmail: row.invited_email,
    status: row.status,
    message: row.message,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
  }));
}

export async function sendInvitation(
  groupId: string,
  target: { userId?: string; email?: string },
  message?: string
): Promise<GroupInvitation> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (!target.userId && !target.email) {
    throw new Error('Must provide either userId or email');
  }

  // Check group member count
  const { data: members } = await supabase
    .from('myday_group_members')
    .select('id')
    .eq('group_id', groupId);

  const { data: group } = await supabase
    .from('myday_groups')
    .select('max_members')
    .eq('id', groupId)
    .single();

  if ((members?.length || 0) >= (group?.max_members || 5)) {
    throw new Error('Group has reached maximum members');
  }

  // Check for existing pending invitation
  let query = supabase
    .from('myday_invitations')
    .select('id')
    .eq('group_id', groupId)
    .eq('status', 'pending');

  if (target.userId) {
    query = query.eq('invited_user_id', target.userId);
  } else {
    query = query.eq('invited_email', target.email);
  }

  const { data: existing } = await query;
  if (existing && existing.length > 0) {
    throw new Error('Invitation already pending for this user');
  }

  const now = new Date().toISOString();
  const id = generateId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('myday_invitations')
    .insert({
      id,
      group_id: groupId,
      invited_by: user.id,
      invited_user_id: target.userId || null,
      invited_email: target.email || null,
      status: 'pending',
      message: message || null,
      expires_at: expiresAt,
      created_at: now,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    groupId: data.group_id,
    invitedBy: data.invited_by,
    invitedUserId: data.invited_user_id,
    invitedEmail: data.invited_email,
    status: data.status,
    message: data.message,
    expiresAt: data.expires_at,
    createdAt: data.created_at,
    respondedAt: data.responded_at,
  };
}

export async function respondToInvitation(invitationId: string, accept: boolean): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();

  // Get invitation
  const { data: invitation, error: fetchError } = await supabase
    .from('myday_invitations')
    .select('*')
    .eq('id', invitationId)
    .single();

  if (fetchError || !invitation) throw new Error('Invitation not found');

  // Verify this invitation is for the current user
  if (invitation.invited_user_id !== user.id && invitation.invited_email !== user.email) {
    throw new Error('This invitation is not for you');
  }

  // Update invitation status
  const { error: updateError } = await supabase
    .from('myday_invitations')
    .update({
      status: accept ? 'accepted' : 'rejected',
      responded_at: now,
    })
    .eq('id', invitationId);

  if (updateError) throw updateError;

  // If accepted, add to group members
  if (accept) {
    const { error: memberError } = await supabase
      .from('myday_group_members')
      .insert({
        id: generateId(),
        group_id: invitation.group_id,
        user_id: user.id,
        role: 'member',
        display_name: user.email?.split('@')[0] || 'Member',
        joined_at: now,
      });

    if (memberError) throw memberError;
  }
}

export async function cancelInvitation(invitationId: string): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('myday_invitations')
    .delete()
    .eq('id', invitationId)
    .eq('invited_by', user.id);

  if (error) throw error;
}

// ===== SHARING SAFE ENTRIES =====

/**
 * Share entry with group encryption (NEW approach)
 * Entry data is encrypted with group key, not user's personal key
 * 
 * @param entryId - Safe entry ID
 * @param entryData - Decrypted entry data (username, password, notes, etc.)
 * @param groupId - Target group ID
 * @param groupKey - Group encryption key (already decrypted)
 * @param mode - Share mode (readonly or copy)
 */
export async function shareEntryWithGroupEncryption(
  entryId: string,
  entryData: any, // Decrypted safe entry data
  groupId: string,
  groupKey: CryptoKey,
  mode: ShareMode = 'readonly'
): Promise<SharedSafeEntry> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Encrypt entry data with group key
  const { encrypted, iv } = await encryptData(
    JSON.stringify(entryData),
    groupKey
  );

  const now = new Date().toISOString();
  const id = generateId();

  const { data, error } = await supabase
    .from('myday_shared_safe_entries')
    .insert({
      id,
      safe_entry_id: entryId,
      group_id: groupId,
      shared_by: user.id,
      share_mode: mode,
      shared_at: now,
      is_active: true,
      group_encrypted_data: encrypted,
      group_encrypted_data_iv: iv,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    safeEntryId: data.safe_entry_id,
    groupId: data.group_id,
    sharedBy: data.shared_by,
    shareMode: data.share_mode,
    sharedAt: data.shared_at,
    expiresAt: data.expires_at,
    revokedAt: data.revoked_at,
    isActive: data.is_active,
    groupEncryptedData: data.group_encrypted_data,
    groupEncryptedDataIv: data.group_encrypted_data_iv,
  };
}

/**
 * Share entry (LEGACY - no encryption)
 * Kept for backward compatibility but should migrate to shareEntryWithGroupEncryption
 */
export async function shareEntry(
  entryId: string,
  groupId: string,
  mode: ShareMode = 'readonly'
): Promise<SharedSafeEntry> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const id = generateId();

  const { data, error } = await supabase
    .from('myday_shared_safe_entries')
    .insert({
      id,
      safe_entry_id: entryId,
      group_id: groupId,
      shared_by: user.id,
      share_mode: mode,
      shared_at: now,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    safeEntryId: data.safe_entry_id,
    groupId: data.group_id,
    sharedBy: data.shared_by,
    shareMode: data.share_mode,
    sharedAt: data.shared_at,
    expiresAt: data.expires_at,
    revokedAt: data.revoked_at,
    isActive: data.is_active,
  };
}

export async function getSharedEntriesForGroup(groupId: string): Promise<SharedSafeEntry[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('myday_shared_safe_entries')
    .select('*')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('shared_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    safeEntryId: row.safe_entry_id,
    groupId: row.group_id,
    sharedBy: row.shared_by,
    shareMode: row.share_mode,
    sharedAt: row.shared_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    isActive: row.is_active,
  }));
}

export async function getEntriesSharedWithMe(): Promise<SharedSafeEntry[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get all groups user is member of
  const { data: memberData } = await supabase
    .from('myday_group_members')
    .select('group_id')
    .eq('user_id', user.id);

  const groupIds = (memberData || []).map(m => m.group_id);
  if (groupIds.length === 0) return [];

  // Get all shared entries for those groups (excluding user's own shares)
  const { data, error } = await supabase
    .from('myday_shared_safe_entries')
    .select('*')
    .in('group_id', groupIds)
    .neq('shared_by', user.id)
    .eq('is_active', true)
    .order('shared_at', { ascending: false });

  if (error) throw error;

  // Get entry details separately
  const entryIds = (data || []).map(row => row.safe_entry_id).filter(Boolean);
  let entryDetailsMap: Record<string, any> = {};
  
  if (entryIds.length > 0) {
    const { data: entriesData } = await supabase
      .from('myday_safe_entries')
      .select('id, title, category_tag_id, tags')
      .in('id', entryIds);
    
    if (entriesData) {
      entriesData.forEach(entry => {
        entryDetailsMap[entry.id] = entry;
      });
    }
  }

  return (data || []).map(row => {
    const entryDetails = entryDetailsMap[row.safe_entry_id];
    return {
      id: row.id,
      safeEntryId: row.safe_entry_id,
      groupId: row.group_id,
      sharedBy: row.shared_by,
      shareMode: row.share_mode,
      sharedAt: row.shared_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      isActive: row.is_active,
      entryTitle: entryDetails?.title || 'Shared Entry',
      entryCategory: entryDetails?.category_tag_id,
      entryTags: entryDetails?.tags || [],
    };
  });
}

export async function revokeShare(shareId: string): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('myday_shared_safe_entries')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', shareId)
    .eq('shared_by', user.id);

  if (error) throw error;
}

export async function updateShareMode(shareId: string, mode: ShareMode): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('myday_shared_safe_entries')
    .update({ share_mode: mode })
    .eq('id', shareId)
    .eq('shared_by', user.id);

  if (error) throw error;
}

// ===== SHARING DOCUMENTS =====

export async function shareDocument(
  documentId: string,
  groupId: string,
  mode: ShareMode = 'readonly'
): Promise<SharedDocument> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const id = generateId();

  const { data, error } = await supabase
    .from('myday_shared_documents')
    .insert({
      id,
      document_id: documentId,
      group_id: groupId,
      shared_by: user.id,
      share_mode: mode,
      shared_at: now,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    documentId: data.document_id,
    groupId: data.group_id,
    sharedBy: data.shared_by,
    shareMode: data.share_mode,
    sharedAt: data.shared_at,
    expiresAt: data.expires_at,
    revokedAt: data.revoked_at,
    isActive: data.is_active,
  };
}

export async function getDocumentsSharedWithMe(): Promise<SharedDocument[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: memberData } = await supabase
    .from('myday_group_members')
    .select('group_id')
    .eq('user_id', user.id);

  const groupIds = (memberData || []).map(m => m.group_id);
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase
    .from('myday_shared_documents')
    .select('*')
    .in('group_id', groupIds)
    .neq('shared_by', user.id)
    .eq('is_active', true)
    .order('shared_at', { ascending: false });

  if (error) throw error;

  // Get document details separately
  const docIds = (data || []).map(row => row.document_id).filter(Boolean);
  let docDetailsMap: Record<string, any> = {};
  
  if (docIds.length > 0) {
    const { data: docsData } = await supabase
      .from('myday_safe_document_vaults')
      .select('id, title, file_name, tags')
      .in('id', docIds);
    
    if (docsData) {
      docsData.forEach(doc => {
        docDetailsMap[doc.id] = doc;
      });
    }
  }

  return (data || []).map(row => {
    const docDetails = docDetailsMap[row.document_id];
    return {
      id: row.id,
      documentId: row.document_id,
      groupId: row.group_id,
      sharedBy: row.shared_by,
      shareMode: row.share_mode,
      sharedAt: row.shared_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      isActive: row.is_active,
      documentTitle: docDetails?.title || docDetails?.file_name || 'Shared Document',
      documentTags: docDetails?.tags || [],
    };
  });
}

export async function revokeDocumentShare(shareId: string): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('myday_shared_documents')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', shareId)
    .eq('shared_by', user.id);

  if (error) throw error;
}

// ===== COPYING ENTRIES =====

export async function copyEntryToLocal(
  originalEntryId: string,
  originalOwnerId: string,
  newEntryId: string,
  entryType: 'safe_entry' | 'document'
): Promise<EntryCopy> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const id = generateId();

  const { data, error } = await supabase
    .from('myday_entry_copies')
    .insert({
      id,
      original_entry_id: originalEntryId,
      original_owner_id: originalOwnerId,
      copied_entry_id: newEntryId,
      copied_by: user.id,
      entry_type: entryType,
      copied_at: now,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    originalEntryId: data.original_entry_id,
    originalOwnerId: data.original_owner_id,
    copiedEntryId: data.copied_entry_id,
    copiedBy: data.copied_by,
    entryType: data.entry_type,
    copiedAt: data.copied_at,
  };
}

export async function hasAlreadyCopied(originalEntryId: string): Promise<boolean> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data } = await supabase
    .from('myday_entry_copies')
    .select('id')
    .eq('original_entry_id', originalEntryId)
    .eq('copied_by', user.id)
    .limit(1);

  return (data?.length || 0) > 0;
}

// ===== SHARING EVENTS =====

export interface SharedEvent {
  id: string;
  eventId: string;
  groupId: string;
  sharedBy: string;
  shareMode: ShareMode;
  sharedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  isActive: boolean;
}

export async function shareEvent(
  eventId: string,
  groupId: string,
  mode: ShareMode = 'readonly'
): Promise<SharedEvent> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const id = generateId();

  const { data, error } = await supabase
    .from('myday_shared_events')
    .insert({
      id,
      event_id: eventId,
      group_id: groupId,
      shared_by: user.id,
      share_mode: mode,
      shared_at: now,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    eventId: data.event_id,
    groupId: data.group_id,
    sharedBy: data.shared_by,
    shareMode: data.share_mode,
    sharedAt: data.shared_at,
    expiresAt: data.expires_at,
    revokedAt: data.revoked_at,
    isActive: data.is_active,
  };
}

export async function getEventsSharedWithMe(): Promise<SharedEvent[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: memberData } = await supabase
    .from('myday_group_members')
    .select('group_id')
    .eq('user_id', user.id);

  const groupIds = (memberData || []).map(m => m.group_id);
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase
    .from('myday_shared_events')
    .select('*')
    .in('group_id', groupIds)
    .neq('shared_by', user.id)
    .eq('is_active', true)
    .order('shared_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    eventId: row.event_id,
    groupId: row.group_id,
    sharedBy: row.shared_by,
    shareMode: row.share_mode,
    sharedAt: row.shared_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    isActive: row.is_active,
  }));
}

export async function revokeEventShare(shareId: string): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('myday_shared_events')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', shareId)
    .eq('shared_by', user.id);

  if (error) throw error;
}

// ===== SHARING TO-DO ITEMS =====

export interface SharedTodo {
  id: string;
  todoItemId: string;
  groupId: string;
  sharedBy: string;
  shareMode: 'readonly' | 'editable';
  sharedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  isActive: boolean;
}

export async function shareTodoItem(
  todoItemId: string,
  groupId: string,
  mode: 'readonly' | 'editable' = 'readonly'
): Promise<SharedTodo> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const id = generateId();

  const { data, error } = await supabase
    .from('myday_shared_todos')
    .insert({
      id,
      todo_item_id: todoItemId,
      group_id: groupId,
      shared_by: user.id,
      share_mode: mode,
      shared_at: now,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    todoItemId: data.todo_item_id,
    groupId: data.group_id,
    sharedBy: data.shared_by,
    shareMode: data.share_mode,
    sharedAt: data.shared_at,
    expiresAt: data.expires_at,
    revokedAt: data.revoked_at,
    isActive: data.is_active,
  };
}

export async function getTodosSharedWithMe(): Promise<SharedTodo[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: memberData } = await supabase
    .from('myday_group_members')
    .select('group_id')
    .eq('user_id', user.id);

  const groupIds = (memberData || []).map(m => m.group_id);
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase
    .from('myday_shared_todos')
    .select('*')
    .in('group_id', groupIds)
    .neq('shared_by', user.id)
    .eq('is_active', true)
    .order('shared_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    todoItemId: row.todo_item_id,
    groupId: row.group_id,
    sharedBy: row.shared_by,
    shareMode: row.share_mode,
    sharedAt: row.shared_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    isActive: row.is_active,
  }));
}

export async function revokeTodoShare(shareId: string): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('myday_shared_todos')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', shareId)
    .eq('shared_by', user.id);

  if (error) throw error;
}

// ===== SHARING TO-DO GROUPS =====

export interface SharedTodoGroup {
  id: string;
  todoGroupId: string;
  groupId: string;
  sharedBy: string;
  shareMode: 'readonly' | 'editable';
  sharedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  isActive: boolean;
}

export async function shareTodoGroup(
  todoGroupId: string,
  groupId: string,
  mode: 'readonly' | 'editable' = 'readonly'
): Promise<SharedTodoGroup> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const id = generateId();

  const { data, error } = await supabase
    .from('myday_shared_todo_groups')
    .insert({
      id,
      todo_group_id: todoGroupId,
      group_id: groupId,
      shared_by: user.id,
      share_mode: mode,
      shared_at: now,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    todoGroupId: data.todo_group_id,
    groupId: data.group_id,
    sharedBy: data.shared_by,
    shareMode: data.share_mode,
    sharedAt: data.shared_at,
    expiresAt: data.expires_at,
    revokedAt: data.revoked_at,
    isActive: data.is_active,
  };
}

export async function getTodoGroupsSharedWithMe(): Promise<SharedTodoGroup[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: memberData } = await supabase
    .from('myday_group_members')
    .select('group_id')
    .eq('user_id', user.id);

  const groupIds = (memberData || []).map(m => m.group_id);
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase
    .from('myday_shared_todo_groups')
    .select('*')
    .in('group_id', groupIds)
    .neq('shared_by', user.id)
    .eq('is_active', true)
    .order('shared_at', { ascending: false });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    todoGroupId: row.todo_group_id,
    groupId: row.group_id,
    sharedBy: row.shared_by,
    shareMode: row.share_mode,
    sharedAt: row.shared_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    isActive: row.is_active,
  }));
}

export async function revokeTodoGroupShare(shareId: string): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('myday_shared_todo_groups')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('id', shareId)
    .eq('shared_by', user.id);

  if (error) throw error;
}

// ===== USER SEARCH (for invitations) =====

export async function searchUsers(query: string): Promise<{ id: string; email: string }[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (!query || query.length < 3) return [];

  // Note: This requires a custom RPC function or public user table
  // For now, we'll just allow inviting by email
  // In production, you'd want a proper user search endpoint
  return [];
}
