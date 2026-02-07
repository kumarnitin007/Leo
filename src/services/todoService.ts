/**
 * TodoService - CRUD operations for To-Do items and groups
 * 
 * Uses Supabase tables:
 * - myday_todo_groups: Groups/categories for organizing items
 * - myday_todo_items: Individual to-do items
 */

import getSupabaseClient from '../lib/supabase';
import { TodoItem, TodoGroup } from '../types';

// Get supabase client helper
const getClient = () => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');
  return client;
};

// Helper to generate unique IDs
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// ===== GROUPS =====

export async function getTodoGroups(): Promise<TodoGroup[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('myday_todo_groups')
    .select('*')
    .eq('user_id', user.id)
    .order('order_num', { ascending: true });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    order: row.order_num,
    isExpanded: row.is_expanded,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getTodoGroupById(groupId: string): Promise<TodoGroup | null> {
  const supabase = getClient();
  
  const { data, error } = await supabase
    .from('myday_todo_groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    icon: data.icon,
    order: data.order_num,
    isExpanded: data.is_expanded,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getTodoItemsByGroup(groupId: string): Promise<TodoItem[]> {
  const supabase = getClient();
  
  console.log('[getTodoItemsByGroup] Fetching items for group:', groupId);
  
  const { data, error } = await supabase
    .from('myday_todo_items')
    .select('*')
    .eq('group_id', groupId)
    .order('order_num', { ascending: true });

  if (error) {
    console.error('[getTodoItemsByGroup] Error:', error);
    throw error;
  }

  console.log('[getTodoItemsByGroup] Found', data?.length || 0, 'items');

  return (data || []).map(row => ({
    id: row.id,
    text: row.text,
    groupId: row.group_id,
    isCompleted: row.is_completed,
    completedAt: row.completed_at,
    priority: row.priority,
    dueDate: row.due_date,
    notes: row.notes,
    tags: row.tags,
    showOnDashboard: row.show_on_dashboard,
    assignedTo: row.assigned_to,
    assignedAt: row.assigned_at,
    assignedBy: row.assigned_by,
    order: row.order_num,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createTodoGroup(group: Partial<TodoGroup>): Promise<TodoGroup> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const id = generateId();

  // Get max order
  const { data: maxData } = await supabase
    .from('myday_todo_groups')
    .select('order_num')
    .eq('user_id', user.id)
    .order('order_num', { ascending: false })
    .limit(1);

  const maxOrder = maxData?.[0]?.order_num ?? -1;

  const { data, error } = await supabase
    .from('myday_todo_groups')
    .insert({
      id,
      user_id: user.id,
      name: group.name || 'New Group',
      color: group.color || '#6366f1',
      icon: group.icon || '📁',
      order_num: maxOrder + 1,
      is_expanded: true,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    icon: data.icon,
    order: data.order_num,
    isExpanded: data.is_expanded,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateTodoGroup(id: string, updates: Partial<TodoGroup>): Promise<TodoGroup> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = { updated_at: now };
  if (updates.name !== undefined) updatePayload.name = updates.name;
  if (updates.color !== undefined) updatePayload.color = updates.color;
  if (updates.icon !== undefined) updatePayload.icon = updates.icon;
  if (updates.order !== undefined) updatePayload.order_num = updates.order;
  if (updates.isExpanded !== undefined) updatePayload.is_expanded = updates.isExpanded;

  const { data, error } = await supabase
    .from('myday_todo_groups')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    icon: data.icon,
    order: data.order_num,
    isExpanded: data.is_expanded,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function deleteTodoGroup(id: string): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Move all items in this group to ungrouped
  await supabase
    .from('myday_todo_items')
    .update({ group_id: null, updated_at: new Date().toISOString() })
    .eq('group_id', id)
    .eq('user_id', user.id);

  const { error } = await supabase
    .from('myday_todo_groups')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}

// ===== ITEMS =====

export async function getTodoItems(groupIds?: string[] | 'all' | 'ungrouped'): Promise<TodoItem[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('myday_todo_items')
    .select('*')
    .eq('user_id', user.id); // Only fetch user's own items (shared items fetched separately)

  if (groupIds === 'ungrouped') {
    query = query.is('group_id', null);
  } else if (Array.isArray(groupIds) && groupIds.length > 0) {
    query = query.in('group_id', groupIds);
  }
  // 'all' = no filter

  const { data, error } = await query.order('order_num', { ascending: true });

  if (error) throw error;

  return (data || []).map(row => ({
    id: row.id,
    text: row.text,
    groupId: row.group_id,
    isCompleted: row.is_completed,
    completedAt: row.completed_at,
    priority: row.priority,
    dueDate: row.due_date,
    notes: row.notes,
    tags: row.tags || [],
    showOnDashboard: row.show_on_dashboard || false,
    assignedTo: row.assigned_to || undefined,
    assignedAt: row.assigned_at || undefined,
    assignedBy: row.assigned_by || undefined,
    order: row.order_num,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// Get todos that should show on dashboard (due date + show_on_dashboard + not completed)
export async function getDashboardTodos(): Promise<TodoItem[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get user's own items
  const { data: ownData, error: ownError } = await supabase
    .from('myday_todo_items')
    .select('*')
    .eq('user_id', user.id)
    .eq('show_on_dashboard', true)
    .eq('is_completed', false)
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true });

  if (ownError) throw ownError;

  // Also get items from:
  // 1. Groups user owns (to see items added by others)
  // 2. Groups shared with user
  
  const { data: ownGroups } = await supabase
    .from('myday_todo_groups')
    .select('id')
    .eq('user_id', user.id);

  // Get groups shared with user
  const { data: memberData } = await supabase
    .from('myday_group_members')
    .select('group_id')
    .eq('user_id', user.id);

  const memberGroupIds = (memberData || []).map(m => m.group_id);
  
  let sharedTodoGroupIds: string[] = [];
  if (memberGroupIds.length > 0) {
    const { data: sharedTodoGroups } = await supabase
      .from('myday_shared_todo_groups')
      .select('todo_group_id')
      .in('group_id', memberGroupIds)
      .neq('shared_by', user.id)
      .eq('is_active', true);
    
    sharedTodoGroupIds = (sharedTodoGroups || []).map(s => s.todo_group_id);
  }

  const ownGroupIds = (ownGroups || []).map(g => g.id);
  const allGroupIds = [...ownGroupIds, ...sharedTodoGroupIds];
  
  let sharedGroupItems: any[] = [];
  if (allGroupIds.length > 0) {
    const { data: sharedData, error: sharedError } = await supabase
      .from('myday_todo_items')
      .select('*')
      .in('group_id', allGroupIds)
      .eq('show_on_dashboard', true)
      .eq('is_completed', false)
      .not('due_date', 'is', null)
      .neq('user_id', user.id); // Only items NOT created by current user

    if (!sharedError && sharedData) {
      sharedGroupItems = sharedData;
    }
  }

  // Combine and deduplicate
  const allItems = [...(ownData || []), ...sharedGroupItems];
  const uniqueItems = Array.from(
    new Map(allItems.map(item => [item.id, item])).values()
  );

  const data = uniqueItems.sort((a, b) => 
    (a.due_date || '').localeCompare(b.due_date || '')
  );

  if (!data) return [];

  return (data || []).map(row => ({
    id: row.id,
    text: row.text,
    groupId: row.group_id,
    isCompleted: row.is_completed,
    completedAt: row.completed_at,
    priority: row.priority,
    dueDate: row.due_date,
    notes: row.notes,
    tags: row.tags || [],
    showOnDashboard: row.show_on_dashboard || false,
    assignedTo: row.assigned_to || undefined,
    assignedAt: row.assigned_at || undefined,
    assignedBy: row.assigned_by || undefined,
    order: row.order_num,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createTodoItem(item: Partial<TodoItem>): Promise<TodoItem> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const id = generateId();

  // Get max order for this group
  let query = supabase
    .from('myday_todo_items')
    .select('order_num')
    .eq('user_id', user.id);

  if (item.groupId) {
    query = query.eq('group_id', item.groupId);
  } else {
    query = query.is('group_id', null);
  }

  const { data: maxData } = await query
    .order('order_num', { ascending: false })
    .limit(1);

  const maxOrder = maxData?.[0]?.order_num ?? -1;

  const { data, error } = await supabase
    .from('myday_todo_items')
    .insert({
      id,
      user_id: user.id,
      text: item.text || '',
      group_id: item.groupId || null,
      is_completed: item.isCompleted || false,
      completed_at: item.completedAt || null,
      priority: item.priority || 'medium',
      due_date: item.dueDate || null,
      notes: item.notes || null,
      tags: item.tags || null,
      show_on_dashboard: item.showOnDashboard || false,
      assigned_to: item.assignedTo || null,
      assigned_at: item.assignedTo ? now : null,
      assigned_by: item.assignedTo ? user.id : null,
      order_num: maxOrder + 1,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    text: data.text,
    groupId: data.group_id,
    isCompleted: data.is_completed,
    completedAt: data.completed_at,
    priority: data.priority,
    dueDate: data.due_date,
    notes: data.notes,
    tags: data.tags || [],
    showOnDashboard: data.show_on_dashboard || false,
    assignedTo: data.assigned_to || undefined,
    assignedAt: data.assigned_at || undefined,
    assignedBy: data.assigned_by || undefined,
    order: data.order_num,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateTodoItem(id: string, updates: Partial<TodoItem>): Promise<TodoItem> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = { updated_at: now };
  if (updates.text !== undefined) updatePayload.text = updates.text;
  if (updates.groupId !== undefined) updatePayload.group_id = updates.groupId || null;
  if (updates.isCompleted !== undefined) {
    updatePayload.is_completed = updates.isCompleted;
    updatePayload.completed_at = updates.isCompleted ? now : null;
  }
  if (updates.priority !== undefined) updatePayload.priority = updates.priority;
  if (updates.dueDate !== undefined) updatePayload.due_date = updates.dueDate || null;
  if (updates.notes !== undefined) updatePayload.notes = updates.notes || null;
  if (updates.tags !== undefined) updatePayload.tags = updates.tags || null;
  if (updates.showOnDashboard !== undefined) updatePayload.show_on_dashboard = updates.showOnDashboard;
  if (updates.assignedTo !== undefined) {
    updatePayload.assigned_to = updates.assignedTo || null;
    updatePayload.assigned_at = updates.assignedTo ? now : null;
    updatePayload.assigned_by = updates.assignedTo ? user.id : null;
  }
  if (updates.order !== undefined) updatePayload.order_num = updates.order;

  const { data, error } = await supabase
    .from('myday_todo_items')
    .update(updatePayload)
    .eq('id', id)
    // Don't filter by user_id - RLS policies handle access control for shared items
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    text: data.text,
    groupId: data.group_id,
    isCompleted: data.is_completed,
    completedAt: data.completed_at,
    priority: data.priority,
    dueDate: data.due_date,
    notes: data.notes,
    tags: data.tags || [],
    showOnDashboard: data.show_on_dashboard || false,
    assignedTo: data.assigned_to || undefined,
    assignedAt: data.assigned_at || undefined,
    assignedBy: data.assigned_by || undefined,
    order: data.order_num,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function deleteTodoItem(id: string): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('myday_todo_items')
    .delete()
    .eq('id', id);
    // Don't filter by user_id - RLS policies handle access control for shared items

  if (error) throw error;
}

export async function toggleTodoItem(id: string): Promise<TodoItem> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get current state
  const { data: current, error: fetchError } = await supabase
    .from('myday_todo_items')
    .select('is_completed')
    .eq('id', id)
    // Don't filter by user_id - RLS policies handle access control for shared items
    .single();

  if (fetchError) throw fetchError;

  const now = new Date().toISOString();
  const newCompleted = !current.is_completed;

  const { data, error } = await supabase
    .from('myday_todo_items')
    .update({
      is_completed: newCompleted,
      completed_at: newCompleted ? now : null,
      updated_at: now,
    })
    .eq('id', id)
    // Don't filter by user_id - RLS policies handle access control for shared items
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    text: data.text,
    groupId: data.group_id,
    isCompleted: data.is_completed,
    completedAt: data.completed_at,
    priority: data.priority,
    dueDate: data.due_date,
    notes: data.notes,
    order: data.order_num,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ===== BULK OPERATIONS =====

export async function clearCompletedTodos(groupId?: string): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('myday_todo_items')
    .delete()
    .eq('user_id', user.id)
    .eq('is_completed', true);

  if (groupId) {
    query = query.eq('group_id', groupId);
  }

  const { error } = await query;
  if (error) throw error;
}

export async function moveTodoItem(itemId: string, newGroupId: string | null): Promise<TodoItem> {
  return updateTodoItem(itemId, { groupId: newGroupId || undefined });
}

// ===== ASSIGNABLE USERS =====

export interface AssignableUser {
  userId: string;
  displayName: string;
  groupId: string;
  groupName: string;
}

/**
 * Get all users from connected sharing/family groups that can be assigned todos
 */
export async function getAssignableUsers(): Promise<AssignableUser[]> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get all groups the user is a member of
  const { data: memberData } = await supabase
    .from('myday_group_members')
    .select('group_id')
    .eq('user_id', user.id);

  const groupIds = (memberData || []).map(m => m.group_id);
  if (groupIds.length === 0) return [];

  // Get group names
  const { data: groupsData } = await supabase
    .from('myday_groups')
    .select('id, name')
    .in('id', groupIds);

  const groupNames: Record<string, string> = {};
  (groupsData || []).forEach(g => {
    groupNames[g.id] = g.name;
  });

  // Get all members of those groups (excluding current user)
  const { data: allMembers, error } = await supabase
    .from('myday_group_members')
    .select('user_id, display_name, group_id')
    .in('group_id', groupIds)
    .neq('user_id', user.id);

  if (error) throw error;

  // Deduplicate users (they might be in multiple groups)
  const userMap = new Map<string, AssignableUser>();
  (allMembers || []).forEach(member => {
    if (!userMap.has(member.user_id)) {
      userMap.set(member.user_id, {
        userId: member.user_id,
        displayName: member.display_name || 'Unknown',
        groupId: member.group_id,
        groupName: groupNames[member.group_id] || 'Unknown Group',
      });
    }
  });

  return Array.from(userMap.values());
}

/**
 * Get display name for a user ID from group members
 */
export async function getUserDisplayName(userId: string): Promise<string | null> {
  const supabase = getClient();
  
  const { data } = await supabase
    .from('myday_group_members')
    .select('display_name')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  return data?.display_name || null;
}
