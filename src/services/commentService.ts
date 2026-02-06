/**
 * Comment Service
 * 
 * Handles collaborative comments on shared entries
 * Phase 1: Basic comments on Safe entries
 * Phase 2: Dashboard integration with advanced fields
 * Phase 3: Cross-feature extension (documents, todos, events, etc.)
 * Phase 4: Advanced features (@mentions, reactions, analytics, bulk ops)
 */

import getSupabaseClient from '../lib/supabase';
import { EntryComment } from '../types';

// ============================================================================
// TYPES FOR ADVANCED FEATURES
// ============================================================================

export interface CommentMention {
  mentionId: string;
  commentId: string;
  entryId: string;
  entryType: string;
  entryTitle: string;
  commentMessage: string;
  mentionedByUserId: string;
  mentionedByDisplayName: string;
  seenAt: string | null;
  createdAt: string;
}

export interface CommentReaction {
  id: string;
  commentId: string;
  userId: string;
  reactionType: 'like' | 'helpful' | 'resolved' | 'urgent';
  createdAt: string;
}

export interface CommentTemplate {
  id: string;
  userId: string;
  templateName: string;
  templateMessage: string;
  entryType: string | null;
  isGlobal: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentAnalytics {
  totalComments: number;
  activeComments: number;
  resolvedComments: number;
  uniqueCommenters: number;
  avgResolutionTimeHours: number | null;
  lastCommentAt: string | null;
  firstCommentAt: string | null;
}

// ============================================================================
// BASIC COMMENT OPERATIONS (Phase 1)
// ============================================================================

/**
 * Add a comment to an entry
 */
export async function addComment(
  entryId: string,
  entryType: 'safe_entry' | 'document' | 'bank_list' | 'todo',
  message: string,
  options?: {
    actionDate?: string; // YYYY-MM-DD (Phase 2)
    actionType?: 'reminder' | 'deadline' | 'expiry' | 'follow_up'; // (Phase 2)
    priority?: 'low' | 'normal' | 'high' | 'urgent'; // (Phase 2)
    showOnDashboard?: boolean; // (Phase 2)
  }
): Promise<EntryComment> {
  console.log('[CommentService] 💬 Adding comment:', { entryId, entryType, messageLength: message.length });
  
  const supabase = getSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    throw new Error('User not authenticated');
  }

  // Get user display name
  const { data: memberData } = await supabase
    .from('myday_group_members')
    .select('display_name')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  const displayName = memberData?.display_name || 'Someone';

  // Get entry title for caching
  let entryTitle = 'Entry';
  if (entryType === 'safe_entry') {
    const { data: entryData } = await supabase
      .from('myday_safe_entries')
      .select('title')
      .eq('id', entryId)
      .single();
    entryTitle = entryData?.title || 'Entry';
  }

  const { data, error } = await supabase
    .from('myday_entry_comments')
    .insert({
      entry_id: entryId,
      entry_type: entryType,
      entry_title: entryTitle,
      user_id: user.id,
      user_display_name: displayName,
      message: message.trim(),
      action_date: options?.actionDate,
      action_type: options?.actionType,
      priority: options?.priority || 'normal',
      show_on_dashboard: options?.showOnDashboard ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error('[CommentService] ❌ Failed to add comment:', error);
    throw error;
  }

  console.log('[CommentService] ✅ Comment added:', data.id);
  return mapCommentFromDB(data);
}

/**
 * Get dashboard comments for current user
 */
export async function getDashboardComments(userId: string): Promise<EntryComment[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_dashboard_comments_for_user', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[CommentService] Error fetching dashboard comments:', error);
    throw new Error(`Failed to fetch dashboard comments: ${error.message}`);
  }

  return (data || []).map(mapCommentFromDB);
}

/**
 * Get dashboard comment count for badge display
 */
export async function getDashboardCommentCount(userId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_dashboard_comment_count', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[CommentService] Error fetching dashboard comment count:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Dismiss a comment from dashboard for current user
 */
export async function dismissCommentFromDashboard(
  commentId: string,
  userId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('dismiss_comment_from_dashboard', {
    p_comment_id: commentId,
    p_user_id: userId,
  });

  if (error) {
    console.error('[CommentService] Error dismissing comment:', error);
    throw new Error(`Failed to dismiss comment: ${error.message}`);
  }
}

// ============================================================================
// MENTIONS SYSTEM (Phase 4)
// ============================================================================

/**
 * Get unseen mentions count for current user
 */
export async function getUnseenMentionsCount(userId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_unseen_mentions_count', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[CommentService] Error fetching unseen mentions count:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Get mentions for current user
 */
export async function getUserMentions(userId: string, limit: number = 50): Promise<CommentMention[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_user_mentions', {
    p_user_id: userId,
    p_limit: limit,
  });

  if (error) {
    console.error('[CommentService] Error fetching mentions:', error);
    throw new Error(`Failed to fetch mentions: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    mentionId: row.mention_id,
    commentId: row.comment_id,
    entryId: row.entry_id,
    entryType: row.entry_type,
    entryTitle: row.entry_title,
    commentMessage: row.comment_message,
    mentionedByUserId: row.mentioned_by_user_id,
    mentionedByDisplayName: row.mentioned_by_display_name,
    seenAt: row.seen_at,
    createdAt: row.created_at,
  }));
}

/**
 * Mark mention as seen
 */
export async function markMentionSeen(mentionId: string, userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('mark_mention_seen', {
    p_mention_id: mentionId,
    p_user_id: userId,
  });

  if (error) {
    console.error('[CommentService] Error marking mention as seen:', error);
    throw new Error(`Failed to mark mention as seen: ${error.message}`);
  }
}

/**
 * Create mentions from comment text (parse @username)
 */
export async function createMentionsFromComment(
  commentId: string,
  commentText: string,
  mentionedByUserId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Extract @mentions from text (e.g., @john, @user1)
  const mentionRegex = /@(\w+)/g;
  const matches = [...commentText.matchAll(mentionRegex)];
  
  if (matches.length === 0) return;
  
  // Get display names and user IDs for mentioned users
  const displayNames = matches.map(m => m[1]);
  const { data: users, error: usersError } = await supabase
    .from('myday_group_members')
    .select('user_id, display_name')
    .in('display_name', displayNames);
  
  if (usersError || !users || users.length === 0) return;
  
  // Create mention records
  const mentions = users.map(user => ({
    comment_id: commentId,
    mentioned_user_id: user.user_id,
    mentioned_by_user_id: mentionedByUserId,
  }));
  
  const { error } = await supabase
    .from('myday_comment_mentions')
    .insert(mentions);
  
  if (error) {
    console.error('[CommentService] Error creating mentions:', error);
  }
}

// ============================================================================
// REACTIONS SYSTEM (Phase 4)
// ============================================================================

/**
 * Add reaction to a comment
 */
export async function addReaction(
  commentId: string,
  userId: string,
  reactionType: 'like' | 'helpful' | 'resolved' | 'urgent'
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('myday_comment_reactions')
    .insert({
      comment_id: commentId,
      user_id: userId,
      reaction_type: reactionType,
    });

  if (error) {
    console.error('[CommentService] Error adding reaction:', error);
    throw new Error(`Failed to add reaction: ${error.message}`);
  }
}

/**
 * Remove reaction from a comment
 */
export async function removeReaction(
  commentId: string,
  userId: string,
  reactionType: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('myday_comment_reactions')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .eq('reaction_type', reactionType);

  if (error) {
    console.error('[CommentService] Error removing reaction:', error);
    throw new Error(`Failed to remove reaction: ${error.message}`);
  }
}

/**
 * Get reactions for a comment
 */
export async function getReactionsForComment(commentId: string): Promise<CommentReaction[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('myday_comment_reactions')
    .select('*')
    .eq('comment_id', commentId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[CommentService] Error fetching reactions:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    commentId: row.comment_id,
    userId: row.user_id,
    reactionType: row.reaction_type,
    createdAt: row.created_at,
  }));
}

// ============================================================================
// BULK OPERATIONS (Phase 4)
// ============================================================================

/**
 * Bulk resolve all comments for an entry
 */
export async function bulkResolveComments(
  entryId: string,
  entryType: string,
  userId: string
): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('bulk_resolve_comments', {
    p_entry_id: entryId,
    p_entry_type: entryType,
    p_user_id: userId,
  });

  if (error) {
    console.error('[CommentService] Error bulk resolving comments:', error);
    throw new Error(`Failed to bulk resolve comments: ${error.message}`);
  }

  return data || 0;
}

/**
 * Bulk dismiss all dashboard comments for current user
 */
export async function bulkDismissDashboardComments(userId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('bulk_dismiss_dashboard_comments', {
    p_user_id: userId,
  });

  if (error) {
    console.error('[CommentService] Error bulk dismissing comments:', error);
    throw new Error(`Failed to bulk dismiss comments: ${error.message}`);
  }

  return data || 0;
}

// ============================================================================
// ANALYTICS (Phase 4)
// ============================================================================

/**
 * Get comment analytics for an entry
 */
export async function getEntryCommentAnalytics(
  entryId: string,
  entryType: string
): Promise<CommentAnalytics> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_entry_comment_analytics', {
    p_entry_id: entryId,
    p_entry_type: entryType,
  });

  if (error) {
    console.error('[CommentService] Error fetching analytics:', error);
    throw new Error(`Failed to fetch analytics: ${error.message}`);
  }

  const row = data?.[0];
  return {
    totalComments: row?.total_comments || 0,
    activeComments: row?.active_comments || 0,
    resolvedComments: row?.resolved_comments || 0,
    uniqueCommenters: row?.unique_commenters || 0,
    avgResolutionTimeHours: row?.avg_resolution_time_hours || null,
    lastCommentAt: row?.last_comment_at || null,
    firstCommentAt: row?.first_comment_at || null,
  };
}

// ============================================================================
// TEMPLATES (Phase 4)
// ============================================================================

/**
 * Get comment templates for user
 */
export async function getCommentTemplates(
  userId: string,
  entryType?: string
): Promise<CommentTemplate[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('myday_comment_templates')
    .select('*')
    .or(`user_id.eq.${userId},is_global.eq.true`)
    .order('usage_count', { ascending: false });

  if (entryType) {
    query = query.or(`entry_type.eq.${entryType},entry_type.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[CommentService] Error fetching templates:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    templateName: row.template_name,
    templateMessage: row.template_message,
    entryType: row.entry_type,
    isGlobal: row.is_global,
    usageCount: row.usage_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Create comment template
 */
export async function createCommentTemplate(
  userId: string,
  templateName: string,
  templateMessage: string,
  entryType?: string
): Promise<CommentTemplate> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('myday_comment_templates')
    .insert({
      user_id: userId,
      template_name: templateName,
      template_message: templateMessage,
      entry_type: entryType || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[CommentService] Error creating template:', error);
    throw new Error(`Failed to create template: ${error.message}`);
  }

  return {
    id: data.id,
    userId: data.user_id,
    templateName: data.template_name,
    templateMessage: data.template_message,
    entryType: data.entry_type,
    isGlobal: data.is_global,
    usageCount: data.usage_count,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Increment template usage count
 */
export async function incrementTemplateUsage(templateId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('increment', {
    row_id: templateId,
    table_name: 'myday_comment_templates',
    column_name: 'usage_count',
  });

  if (error) {
    // Non-critical, just log
    console.warn('[CommentService] Failed to increment template usage:', error);
  }
}

/**
 * Get comments for an entry
 */
export async function getCommentsForEntry(
  entryId: string,
  entryType: 'safe_entry' | 'document' | 'bank_list' | 'todo'
): Promise<EntryComment[]> {
  console.log('[CommentService] 📥 Fetching comments for:', { entryId, entryType });
  
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('myday_entry_comments')
    .select('*')
    .eq('entry_id', entryId)
    .eq('entry_type', entryType)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[CommentService] ❌ Failed to fetch comments:', error);
    throw error;
  }

  console.log(`[CommentService] ✅ Fetched ${data?.length || 0} comments`);
  return (data || []).map(mapCommentFromDB);
}

/**
 * Get comment count for an entry
 */
export async function getCommentCount(
  entryId: string,
  entryType: 'safe_entry' | 'document' | 'bank_list' | 'todo'
): Promise<number> {
  const supabase = getSupabaseClient();
  
  const { count, error } = await supabase
    .from('myday_entry_comments')
    .select('id', { count: 'exact', head: true })
    .eq('entry_id', entryId)
    .eq('entry_type', entryType)
    .eq('is_deleted', false);

  if (error) {
    console.error('[CommentService] ❌ Failed to count comments:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Get unresolved comment count for an entry
 */
export async function getUnresolvedCommentCount(
  entryId: string,
  entryType: 'safe_entry' | 'document' | 'bank_list' | 'todo'
): Promise<number> {
  const supabase = getSupabaseClient();
  
  const { count, error } = await supabase
    .from('myday_entry_comments')
    .select('id', { count: 'exact', head: true })
    .eq('entry_id', entryId)
    .eq('entry_type', entryType)
    .eq('is_deleted', false)
    .eq('is_resolved', false);

  if (error) {
    console.error('[CommentService] ❌ Failed to count unresolved comments:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Update a comment (user can edit their own)
 */
export async function updateComment(
  commentId: string,
  message: string
): Promise<void> {
  console.log('[CommentService] ✏️ Updating comment:', commentId);
  
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('myday_entry_comments')
    .update({ message: message.trim() })
    .eq('id', commentId);

  if (error) {
    console.error('[CommentService] ❌ Failed to update comment:', error);
    throw error;
  }

  console.log('[CommentService] ✅ Comment updated');
}

/**
 * Delete a comment (soft delete)
 */
export async function deleteComment(commentId: string): Promise<void> {
  console.log('[CommentService] 🗑️ Deleting comment:', commentId);
  
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('myday_entry_comments')
    .update({ is_deleted: true })
    .eq('id', commentId);

  if (error) {
    console.error('[CommentService] ❌ Failed to delete comment:', error);
    throw error;
  }

  console.log('[CommentService] ✅ Comment deleted');
}

/**
 * Mark comment as resolved
 */
export async function resolveComment(commentId: string): Promise<void> {
  console.log('[CommentService] ✅ Resolving comment:', commentId);
  
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('myday_entry_comments')
    .update({
      is_resolved: true,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', commentId);

  if (error) {
    console.error('[CommentService] ❌ Failed to resolve comment:', error);
    throw error;
  }

  console.log('[CommentService] ✅ Comment resolved');
}

/**
 * Unresolve a comment
 */
export async function unresolveComment(commentId: string): Promise<void> {
  console.log('[CommentService] 🔄 Unresolving comment:', commentId);
  
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('myday_entry_comments')
    .update({
      is_resolved: false,
      resolved_by: null,
      resolved_at: null,
    })
    .eq('id', commentId);

  if (error) {
    console.error('[CommentService] ❌ Failed to unresolve comment:', error);
    throw error;
  }

  console.log('[CommentService] ✅ Comment unresolved');
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Map database row to EntryComment type
 */
function mapCommentFromDB(row: any): EntryComment {
  return {
    id: row.id,
    entryId: row.entry_id,
    entryType: row.entry_type,
    entryTitle: row.entry_title,
    userId: row.user_id,
    userDisplayName: row.user_display_name,
    message: row.message,
    actionDate: row.action_date,
    actionType: row.action_type,
    showOnDashboard: row.show_on_dashboard,
    dismissedBy: row.dismissed_by || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDeleted: row.is_deleted,
    isResolved: row.is_resolved,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    priority: row.priority,
  };
}
