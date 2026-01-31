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
    .order('order', { ascending: true });

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
    .eq('user_id', user.id);

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
  if (updates.order !== undefined) updatePayload.order_num = updates.order;

  const { data, error } = await supabase
    .from('myday_todo_items')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', user.id)
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

export async function deleteTodoItem(id: string): Promise<void> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('myday_todo_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

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
    .eq('user_id', user.id)
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
    .eq('user_id', user.id)
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
