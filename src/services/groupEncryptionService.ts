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
 * Get or create encryption key for a group (RSA-based)
 * If user already has key, decrypt with their private key and return it
 * If creating new group, generate key and encrypt with user's public key
 */
export async function getOrCreateGroupKey(
  groupId: string,
  userId: string,
  masterKey: CryptoKey
): Promise<CryptoKey> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  
  console.log(`[GroupEncryption] 🔑 Getting or creating group key for group: ${groupId}, user: ${userId}`);
  
  // Check if user already has group key
  const { data: existingKey, error } = await supabase
    .from('myday_group_encryption_keys')
    .select('encrypted_group_key')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (existingKey && !error) {
    console.log(`[GroupEncryption] ✅ Found existing group key, decrypting with private key...`);
    // Get user's private key
    const { getPrivateKey } = await import('../storage');
    const privateKey = await getPrivateKey(masterKey);
    
    // Decrypt group key with private key (RSA)
    const { decryptGroupKeyFromRecipient } = await import('../utils/asymmetricEncryption');
    return await decryptGroupKeyFromRecipient(existingKey.encrypted_group_key, privateKey);
  }

  console.log(`[GroupEncryption] 🆕 No existing key found, creating new group key...`);
  
  // Create new group key (happens when creating group)
  const groupKey = await generateGroupKey();

  // Get user's public key
  const { getPublicKey } = await import('../storage');
  const userPublicKeyPEM = await getPublicKey(userId);
  
  // Import public key and encrypt group key with it (RSA)
  const { importPublicKeyFromPEM, encryptGroupKeyForRecipient } = await import('../utils/asymmetricEncryption');
  const userPublicKey = await importPublicKeyFromPEM(userPublicKeyPEM);
  const encryptedGroupKey = await encryptGroupKeyForRecipient(groupKey, userPublicKey);

  // Store in database
  console.log(`[GroupEncryption] 💾 Storing group key for user...`);
  const { error: insertError } = await supabase
    .from('myday_group_encryption_keys')
    .insert({
      group_id: groupId,
      user_id: userId,
      encrypted_group_key: encryptedGroupKey,
      encrypted_group_key_iv: '', // RSA doesn't use IV
      granted_at: new Date().toISOString(),
      is_active: true
    });

  if (insertError) {
    console.error(`[GroupEncryption] ❌ Failed to store group key:`, insertError);
    throw new Error(`Failed to store group key: ${insertError.message}`);
  }

  console.log(`[GroupEncryption] ✅ Group key created and stored successfully`);
  return groupKey;
}

/**
 * Add a new member to a group (RSA-based)
 * Encrypts the group key with new member's PUBLIC key
 * New member will see ALL shares (past and future)
 */
export async function addMemberToGroup(
  groupId: string,
  currentUserId: string,
  newMemberUserId: string,
  currentUserMasterKey: CryptoKey
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  
  console.log(`[GroupEncryption] 🔑 Adding member ${newMemberUserId} to group ${groupId}...`);
  
  // Get group key (decrypt with current user's master key)
  const groupKey = await getOrCreateGroupKey(groupId, currentUserId, currentUserMasterKey);

  // Get new member's public key
  const { getPublicKey } = await import('../storage');
  const newMemberPublicKeyPEM = await getPublicKey(newMemberUserId);
  
  // Import public key and encrypt group key with it
  const { importPublicKeyFromPEM, encryptGroupKeyForRecipient } = await import('../utils/asymmetricEncryption');
  const newMemberPublicKey = await importPublicKeyFromPEM(newMemberPublicKeyPEM);
  const encryptedGroupKey = await encryptGroupKeyForRecipient(groupKey, newMemberPublicKey);

  // Store - new member can now decrypt ALL shares with their private key
  const { error } = await supabase
    .from('myday_group_encryption_keys')
    .insert({
      group_id: groupId,
      user_id: newMemberUserId,
      encrypted_group_key: encryptedGroupKey,
      encrypted_group_key_iv: '', // RSA doesn't use IV
      granted_at: new Date().toISOString(),
      is_active: true
    });

  if (error) {
    throw new Error(`Failed to add member to group: ${error.message}`);
  }

  console.log(`[GroupEncryption] ✅ User ${newMemberUserId} added to group ${groupId} (sees all shares)`);
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
 * Load all group keys for a user (RSA-based)
 * Decrypts group keys using user's private key
 * Returns a Map of groupId -> CryptoKey
 */
export async function loadUserGroupKeys(
  userId: string,
  masterKey: CryptoKey
): Promise<Map<string, CryptoKey>> {
  console.log('[GroupEncryption] 🔑 Loading group keys for user:', userId);
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  
  // Get user's private key (decrypted with master key)
  const { getPrivateKey } = await import('../storage');
  let privateKey: CryptoKey;
  try {
    privateKey = await getPrivateKey(masterKey);
    console.log('[GroupEncryption] 🔓 User private key loaded');
  } catch (err) {
    console.error('[GroupEncryption] ❌ Failed to load private key:', err);
    throw new Error('Failed to load private key. User may need to generate RSA keys.');
  }
  
  console.log('[GroupEncryption] 📡 Querying myday_group_encryption_keys...');
  const { data: keys, error } = await supabase
    .from('myday_group_encryption_keys')
    .select('group_id, encrypted_group_key')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    console.error('[GroupEncryption] ❌ Query failed:', error);
    throw new Error(`Failed to load group keys: ${error.message}`);
  }

  console.log(`[GroupEncryption] 📥 Found ${keys?.length || 0} group keys in database`);
  if (keys && keys.length > 0) {
    console.log('[GroupEncryption] 🔍 Group IDs:', keys.map(k => k.group_id));
  }

  const groupKeys = new Map<string, CryptoKey>();
  const { decryptGroupKeyFromRecipient } = await import('../utils/asymmetricEncryption');

  for (const key of keys || []) {
    console.log(`[GroupEncryption] 🔓 Decrypting key for group: ${key.group_id}`);
    try {
      // Decrypt group key with user's private key (RSA)
      const groupKey = await decryptGroupKeyFromRecipient(
        key.encrypted_group_key,
        privateKey
      );
      groupKeys.set(key.group_id, groupKey);
      console.log(`[GroupEncryption] ✅ Successfully decrypted key for group: ${key.group_id}`);
    } catch (err) {
      console.error(`[GroupEncryption] ❌ Failed to decrypt key for group ${key.group_id}:`, err);
      // Skip this group key but continue with others
    }
  }

  console.log(`[GroupEncryption] 🎉 Loaded ${groupKeys.size} group keys successfully`);
  return groupKeys;
}
