/**
 * Family Service Layer
 * 
 * Handles all family-related operations: families, invitations, task assignments, sharing
 */

import { getSupabaseClient } from '../lib/supabase';
import {
  Family,
  FamilyMember,
  FamilyInvitation,
  TaskAssignment,
  SharedTask,
  Notification,
  FamilyData,
  InvitationStatus,
  TaskAssignmentStatus,
  TaskPriority,
  SharePermission
} from '../types/family';

// =============================================
// FAMILIES
// =============================================

export const createFamily = async (name: string, description?: string): Promise<Family> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('myday_families')
    .insert([{ name, description }])
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
};

export const getMyFamilies = async (): Promise<FamilyData[]> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  // Get families where I'm a member
  const { data: memberData, error: memberError } = await client
    .from('myday_family_members')
    .select(`
      role,
      myday_families (
        id,
        name,
        description,
        created_by,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', (await client.auth.getUser()).data.user?.id);

  if (memberError) throw memberError;

  // For each family, get all members
  const familiesData: FamilyData[] = [];
  
  for (const memberRecord of memberData) {
    const family = memberRecord.myday_families as any;
    
    const { data: membersData, error: membersError } = await client
      .from('myday_family_members_with_details')
      .select('*')
      .eq('family_id', family.id);

    if (membersError) throw membersError;

    familiesData.push({
      family: {
        id: family.id,
        name: family.name,
        description: family.description,
        createdBy: family.created_by,
        createdAt: family.created_at,
        updatedAt: family.updated_at
      },
      members: membersData.map(m => ({
        id: m.id,
        familyId: m.family_id,
        userId: m.user_id,
        role: m.role,
        joinedAt: m.joined_at,
        email: m.email,
        displayName: m.display_name,
        avatarUrl: m.avatar_url
      })),
      myRole: memberRecord.role
    });
  }

  return familiesData;
};

export const updateFamily = async (familyId: string, updates: { name?: string; description?: string }): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('myday_families')
    .update(updates)
    .eq('id', familyId);

  if (error) throw error;
};

export const deleteFamily = async (familyId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('myday_families')
    .delete()
    .eq('id', familyId);

  if (error) throw error;
};

export const leaveFamily = async (familyId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const userId = (await client.auth.getUser()).data.user?.id;

  const { error } = await client
    .from('myday_family_members')
    .delete()
    .eq('family_id', familyId)
    .eq('user_id', userId);

  if (error) throw error;
};

// =============================================
// INVITATIONS
// =============================================

export const inviteFamilyMember = async (
  familyId: string,
  email: string,
  message?: string
): Promise<FamilyInvitation> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  // Check if user with this email exists
  const { data: userData } = await client
    .from('myday_users')
    .select('id')
    .eq('email', email)
    .single();

  const { data, error } = await client
    .from('myday_family_invitations')
    .insert([{
      family_id: familyId,
      invited_email: email,
      invited_user_id: userData?.id,
      message
    }])
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    familyId: data.family_id,
    invitedBy: data.invited_by,
    invitedEmail: data.invited_email,
    invitedUserId: data.invited_user_id,
    status: data.status,
    message: data.message,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    expiresAt: data.expires_at
  };
};

export const getMyInvitations = async (): Promise<FamilyInvitation[]> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const userId = (await client.auth.getUser()).data.user?.id;

  const { data, error } = await client
    .from('myday_pending_invitations')
    .select('*')
    .eq('invited_user_id', userId);

  if (error) throw error;

  return data.map(inv => ({
    id: inv.id,
    familyId: inv.family_id,
    invitedBy: inv.invited_by,
    invitedEmail: inv.invited_email,
    invitedUserId: inv.invited_user_id,
    status: 'pending',
    message: inv.message,
    createdAt: inv.created_at,
    updatedAt: inv.created_at,
    expiresAt: inv.expires_at,
    familyName: inv.family_name,
    inviterEmail: inv.inviter_email
  }));
};

export const respondToInvitation = async (
  invitationId: string,
  accept: boolean
): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const status: InvitationStatus = accept ? 'accepted' : 'rejected';

  // Update invitation status
  const { data: invData, error: invError } = await client
    .from('myday_family_invitations')
    .update({ status })
    .eq('id', invitationId)
    .select()
    .single();

  if (invError) throw invError;

  // If accepted, add user to family
  if (accept) {
    const userId = (await client.auth.getUser()).data.user?.id;
    
    const { error: memberError } = await client
      .from('myday_family_members')
      .insert([{
        family_id: invData.family_id,
        user_id: userId,
        role: 'member'
      }]);

    if (memberError) throw memberError;
  }
};

export const cancelInvitation = async (invitationId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('myday_family_invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId);

  if (error) throw error;
};

// =============================================
// TASK ASSIGNMENTS
// =============================================

export const assignTask = async (
  taskId: string,
  assignedTo: string,
  familyId: string,
  options?: {
    dueDate?: string;
    priority?: TaskPriority;
    notes?: string;
  }
): Promise<TaskAssignment> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('myday_task_assignments')
    .insert([{
      task_id: taskId,
      assigned_to: assignedTo,
      family_id: familyId,
      due_date: options?.dueDate,
      priority: options?.priority || 'normal',
      notes: options?.notes
    }])
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    taskId: data.task_id,
    assignedBy: data.assigned_by,
    assignedTo: data.assigned_to,
    familyId: data.family_id,
    dueDate: data.due_date,
    priority: data.priority,
    status: data.status,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
};

export const getMyAssignedTasks = async (): Promise<TaskAssignment[]> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const userId = (await client.auth.getUser()).data.user?.id;

  const { data, error } = await client
    .from('myday_task_assignments')
    .select(`
      *,
      myday_tasks (name),
      assigner:assigned_by (email),
      assignee:assigned_to (email)
    `)
    .eq('assigned_to', userId)
    .in('status', ['pending', 'accepted']);

  if (error) throw error;

  return data.map(a => ({
    id: a.id,
    taskId: a.task_id,
    assignedBy: a.assigned_by,
    assignedTo: a.assigned_to,
    familyId: a.family_id,
    dueDate: a.due_date,
    priority: a.priority,
    status: a.status,
    notes: a.notes,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    taskName: a.myday_tasks?.name,
    assignerEmail: (a.assigner as any)?.email
  }));
};

export const getTasksIAssigned = async (): Promise<TaskAssignment[]> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const userId = (await client.auth.getUser()).data.user?.id;

  const { data, error } = await client
    .from('myday_task_assignments')
    .select(`
      *,
      myday_tasks (name),
      assignee:assigned_to (email)
    `)
    .eq('assigned_by', userId);

  if (error) throw error;

  return data.map(a => ({
    id: a.id,
    taskId: a.task_id,
    assignedBy: a.assigned_by,
    assignedTo: a.assigned_to,
    familyId: a.family_id,
    dueDate: a.due_date,
    priority: a.priority,
    status: a.status,
    notes: a.notes,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    taskName: a.myday_tasks?.name,
    assigneeEmail: (a.assignee as any)?.email
  }));
};

export const updateAssignmentStatus = async (
  assignmentId: string,
  status: TaskAssignmentStatus
): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('myday_task_assignments')
    .update({ status })
    .eq('id', assignmentId);

  if (error) throw error;
};

// =============================================
// TASK SHARING
// =============================================

export const shareTask = async (
  taskId: string,
  sharedWith: string,
  familyId: string,
  permission: SharePermission = 'view'
): Promise<SharedTask> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client
    .from('myday_shared_tasks')
    .insert([{
      task_id: taskId,
      shared_with: sharedWith,
      family_id: familyId,
      permission
    }])
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    taskId: data.task_id,
    sharedBy: data.shared_by,
    sharedWith: data.shared_with,
    familyId: data.family_id,
    permission: data.permission,
    createdAt: data.created_at
  };
};

export const getSharedWithMeTasks = async (): Promise<SharedTask[]> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const userId = (await client.auth.getUser()).data.user?.id;

  const { data, error } = await client
    .from('myday_shared_tasks')
    .select(`
      *,
      myday_tasks (name),
      sharer:shared_by (email)
    `)
    .eq('shared_with', userId);

  if (error) throw error;

  return data.map(s => ({
    id: s.id,
    taskId: s.task_id,
    sharedBy: s.shared_by,
    sharedWith: s.shared_with,
    familyId: s.family_id,
    permission: s.permission,
    createdAt: s.created_at,
    taskName: s.myday_tasks?.name,
    sharerEmail: (s.sharer as any)?.email
  }));
};

export const unshareTask = async (sharedTaskId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('myday_shared_tasks')
    .delete()
    .eq('id', sharedTaskId);

  if (error) throw error;
};

// =============================================
// NOTIFICATIONS
// =============================================

export const getMyNotifications = async (unreadOnly: boolean = false): Promise<Notification[]> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const userId = (await client.auth.getUser()).data.user?.id;

  let query = client
    .from('myday_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.eq('read', false);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data.map(n => ({
    id: n.id,
    userId: n.user_id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    read: n.read,
    data: n.data,
    createdAt: n.created_at
  }));
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('myday_notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) throw error;
};

export const markAllNotificationsAsRead = async (): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const userId = (await client.auth.getUser()).data.user?.id;

  const { error } = await client
    .from('myday_notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw error;
};

export const deleteNotification = async (notificationId: string): Promise<void> => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('myday_notifications')
    .delete()
    .eq('id', notificationId);

  if (error) throw error;
};

export const getUnreadNotificationCount = async (): Promise<number> => {
  const client = getSupabaseClient();
  if (!client) return 0;

  const userId = (await client.auth.getUser()).data.user?.id;

  const { count, error } = await client
    .from('myday_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) return 0;

  return count || 0;
};


