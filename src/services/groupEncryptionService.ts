/**
 * Group Encryption Service
 * 
 * Manages group encryption keys in Supabase for family password sharing.
 */

import getSupabaseClient from '../lib/supabase';
import { generateGroupKey, encryptGroupKeyForUser, decryptGroupKey } from '../utils/groupEncryption';

export interface GroupEncryptionKey {
  id: string;
  groupId: string;
  userId: string;
  encryptedGroupKey: string;
  groupKeyIv: string;
  grantedAt: string;
  revokedAt?: string;
  isActive: boolean;
}

/**
 * Get or create encryption key for a group
 * If user already has key, decrypt and return it
 * If creating new group, generate key and encrypt for user
 */
export async function getOrCreateGroupKey(
  groupId: string,
  userId: string,
  masterKey: CryptoKey
): Promise<CryptoKey> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  
  // Check if user already has group key
  const { data: existingKey, error } = await supabase
    .from('myday_group_encryption_keys')
    .select('encrypted_group_key, group_key_iv')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (existingKey && !error) {
    // Decrypt and return existing group key
    return await decryptGroupKey(
      existingKey.encrypted_group_key,
      existingKey.group_key_iv,
      masterKey
    );
  }

  // Create new group key (happens when creating group)
  const groupKey = await generateGroupKey();

  // Encrypt with user's master key
  const { encryptedKey, iv } = await encryptGroupKeyForUser(groupKey, masterKey);

  // Store in database
  const { error: insertError } = await supabase
    .from('myday_group_encryption_keys')
    .insert({
      group_id: groupId,
      user_id: userId,
      encrypted_group_key: encryptedKey,
      group_key_iv: iv,
      granted_at: new Date().toISOString(),
      is_active: true
    });

  if (insertError) {
    throw new Error(`Failed to store group key: ${insertError.message}`);
  }

  return groupKey;
}

/**
 * Add a new member to a group
 * Encrypts the group key with new member's master key
 * New member will see ALL shares (past and future)
 */
export async function addMemberToGroup(
  groupId: string,
  currentUserId: string,
  newMemberUserId: string,
  currentUserMasterKey: CryptoKey,
  newMemberMasterKey: CryptoKey
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  
  // Get group key (decrypt with current user's master key)
  const groupKey = await getOrCreateGroupKey(groupId, currentUserId, currentUserMasterKey);

  // Encrypt group key for new member
  const { encryptedKey, iv } = await encryptGroupKeyForUser(groupKey, newMemberMasterKey);

  // Store - new member can now decrypt ALL shares
  const { error } = await supabase
    .from('myday_group_encryption_keys')
    .insert({
      group_id: groupId,
      user_id: newMemberUserId,
      encrypted_group_key: encryptedKey,
      group_key_iv: iv,
      granted_at: new Date().toISOString(),
      is_active: true
    });

  if (error) {
    throw new Error(`Failed to add member to group: ${error.message}`);
  }

  console.log(`✅ User ${newMemberUserId} added to group ${groupId} (sees all shares)`);
}

/**
 * Remove a member from a group
 * Marks their group key as revoked (soft delete)
 */
export async function removeMemberFromGroup(
  groupId: string,
  userId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  
  const { error } = await supabase
    .from('myday_group_encryption_keys')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString()
    })
    .eq('group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to remove member from group: ${error.message}`);
  }

  console.log(`✅ User ${userId} removed from group ${groupId}`);
}

/**
 * Load all group keys for a user
 * Returns a Map of groupId -> CryptoKey
 */
export async function loadUserGroupKeys(
  userId: string,
  masterKey: CryptoKey
): Promise<Map<string, CryptoKey>> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  
  const { data: keys, error } = await supabase
    .from('myday_group_encryption_keys')
    .select('group_id, encrypted_group_key, group_key_iv')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to load group keys: ${error.message}`);
  }

  const groupKeys = new Map<string, CryptoKey>();

  for (const key of keys || []) {
    try {
      const groupKey = await decryptGroupKey(
        key.encrypted_group_key,
        key.group_key_iv,
        masterKey
      );
      groupKeys.set(key.group_id, groupKey);
    } catch (err) {
      console.error(`Failed to decrypt group key for ${key.group_id}:`, err);
      // Skip this group key but continue with others
    }
  }

  return groupKeys;
}
