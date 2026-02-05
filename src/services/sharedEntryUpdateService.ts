/**
 * Shared Entry Update Service
 * 
 * Handles propagation of updates to shared entries (Option B: Update Propagation Model)
 * 
 * When User1 edits an entry that's been shared:
 * 1. Find all shares of this entry
 * 2. Re-encrypt the updated data with each group's key
 * 3. Update all shared copies
 * 4. Track version and timestamp
 */

import getSupabaseClient from '../lib/supabase';
import { encryptData } from '../utils/encryption';

interface ShareInfo {
  shareId: string;
  groupId: string;
  sharedBy: string;
  shareMode: string;
}

interface UpdateResult {
  success: boolean;
  updatedCount: number;
  failedShares: string[];
  errors: string[];
}

/**
 * Update all shared copies of an entry when the original is edited
 * 
 * @param entryId - The safe entry ID that was edited
 * @param entryTitle - Updated title
 * @param entryCategory - Updated category
 * @param entryData - Updated decrypted data
 * @param groupKeys - Map of group IDs to their decrypted CryptoKeys
 * @returns Result with success status and details
 */
export async function updateSharedEntries(
  entryId: string,
  entryTitle: string,
  entryCategory: string,
  entryData: any,
  groupKeys: Map<string, CryptoKey>
): Promise<UpdateResult> {
  console.log('[SharedEntryUpdate] 🔄 Starting update propagation for entry:', entryId);
  
  const supabase = getSupabaseClient();
  const result: UpdateResult = {
    success: true,
    updatedCount: 0,
    failedShares: [],
    errors: [],
  };

  try {
    // 1. Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // 2. Find all active shares of this entry
    console.log('[SharedEntryUpdate] 📡 Fetching all shares for entry...');
    const { data: shares, error: sharesError } = await supabase
      .from('myday_shared_safe_entries')
      .select('id, group_id, shared_by, share_mode, entry_version')
      .eq('safe_entry_id', entryId)
      .eq('is_active', true);

    if (sharesError) {
      throw new Error(`Failed to fetch shares: ${sharesError.message}`);
    }

    if (!shares || shares.length === 0) {
      console.log('[SharedEntryUpdate] ℹ️ No active shares found for this entry');
      return result;
    }

    console.log(`[SharedEntryUpdate] 📥 Found ${shares.length} active shares`);

    // 3. Update each share
    for (const share of shares) {
      try {
        const groupKey = groupKeys.get(share.group_id);
        
        if (!groupKey) {
          console.warn(`[SharedEntryUpdate] ⚠️ No group key found for group: ${share.group_id}`);
          result.failedShares.push(share.id);
          result.errors.push(`Missing group key for group ${share.group_id}`);
          continue;
        }

        // Re-encrypt data with group key
        console.log(`[SharedEntryUpdate] 🔐 Re-encrypting for share: ${share.id}`);
        const { encrypted, iv } = await encryptData(JSON.stringify(entryData), groupKey);

        // Update the shared entry
        const { error: updateError } = await supabase
          .from('myday_shared_safe_entries')
          .update({
            group_encrypted_data: encrypted,
            group_encrypted_data_iv: iv,
            entry_title: entryTitle,
            entry_category: entryCategory,
            entry_version: (share.entry_version || 0) + 1,
            last_updated_by: user.id,
            last_updated_at: new Date().toISOString(),
          })
          .eq('id', share.id);

        if (updateError) {
          console.error(`[SharedEntryUpdate] ❌ Failed to update share ${share.id}:`, updateError);
          result.failedShares.push(share.id);
          result.errors.push(`Update failed for share ${share.id}: ${updateError.message}`);
        } else {
          console.log(`[SharedEntryUpdate] ✅ Updated share: ${share.id}`);
          result.updatedCount++;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[SharedEntryUpdate] ❌ Error updating share ${share.id}:`, errorMsg);
        result.failedShares.push(share.id);
        result.errors.push(`Exception for share ${share.id}: ${errorMsg}`);
      }
    }

    // 4. Determine overall success
    result.success = result.failedShares.length === 0;
    
    if (result.success) {
      console.log(`[SharedEntryUpdate] 🎉 Successfully updated all ${result.updatedCount} shares`);
    } else {
      console.warn(`[SharedEntryUpdate] ⚠️ Updated ${result.updatedCount}/${shares.length} shares. ${result.failedShares.length} failed.`);
    }

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[SharedEntryUpdate] ❌ Update propagation failed:', errorMsg);
    result.success = false;
    result.errors.push(errorMsg);
    return result;
  }
}

/**
 * Check if an entry has any active shares
 * 
 * @param entryId - The safe entry ID
 * @returns True if entry has active shares
 */
export async function hasActiveShares(entryId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('myday_shared_safe_entries')
    .select('id')
    .eq('safe_entry_id', entryId)
    .eq('is_active', true)
    .limit(1);

  if (error) {
    console.error('[SharedEntryUpdate] Error checking shares:', error);
    return false;
  }

  return (data?.length || 0) > 0;
}

/**
 * Get share count for an entry (for UI display)
 * 
 * @param entryId - The safe entry ID
 * @returns Number of active shares
 */
export async function getShareCount(entryId: string): Promise<number> {
  const supabase = getSupabaseClient();
  
  const { count, error } = await supabase
    .from('myday_shared_safe_entries')
    .select('id', { count: 'exact', head: true })
    .eq('safe_entry_id', entryId)
    .eq('is_active', true);

  if (error) {
    console.error('[SharedEntryUpdate] Error counting shares:', error);
    return 0;
  }

  return count || 0;
}
