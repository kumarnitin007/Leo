/**
 * Storage Items Module
 * 
 * Item CRUD operations (Gift Cards, Subscriptions, Warranties, Notes)
 */

import { Item } from '../types';
import { requireAuth } from './core';

// ===== ITEMS =====

export const getItems = async (): Promise<Item[]> => {
  const { client } = await requireAuth();
  
  const { data, error } = await client
    .from('myday_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching items:', error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    category: row.category as string,
    tags: (row.tags as string[]) || [],
    expirationDate: row.expiration_date as string | undefined,
    value: row.value as number | undefined,
    currency: row.currency as string | undefined,
    merchant: row.merchant as string | undefined,
    accountNumber: row.account_number as string | undefined,
    autoRenew: (row.auto_renew as boolean) || false,
    notifyDaysBefore: (row.notify_days_before as number) || 0,
    priority: (row.priority as number) || 5,
    color: row.color as string | undefined,
    isClosed: (row.is_closed as boolean) || false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string | undefined
  }));
};

export const addItem = async (item: Item): Promise<void> => {
  const { client, userId } = await requireAuth();

  const insertData: Record<string, unknown> = {
    id: item.id,
    user_id: userId,
    name: item.name,
    description: item.description,
    category: item.category,
    tags: item.tags || [],
    priority: item.priority || 5,
    color: item.color,
    is_closed: item.isClosed || false,
    created_at: item.createdAt,
    updated_at: item.updatedAt || item.createdAt
  };

  if (item.category !== 'Note') {
    insertData.expiration_date = item.expirationDate || null;
    insertData.notify_days_before = item.notifyDaysBefore || 0;
  }

  if (item.category === 'Gift Card' || item.category === 'Subscription') {
    insertData.value = item.value || null;
    insertData.currency = item.currency || 'USD';
  }

  if (item.category === 'Gift Card' || item.category === 'Subscription' || item.category === 'Warranty') {
    insertData.merchant = item.merchant || null;
  }

  if (item.category === 'Gift Card') {
    insertData.account_number = item.accountNumber || null;
  }

  if (item.category === 'Subscription') {
    insertData.auto_renew = item.autoRenew || false;
  }

  if (item.category === 'Warranty') {
    insertData.value = item.value || null;
    insertData.currency = item.currency || 'USD';
  }

  const { error } = await client
    .from('myday_items')
    .insert([insertData]);

  if (error) throw error;
};

export const updateItem = async (itemId: string, updates: Partial<Item>): Promise<void> => {
  const { client } = await requireAuth();

  const items = await getItems();
  const currentItem = items.find(item => item.id === itemId);
  const category = updates.category || currentItem?.category || 'Note';

  const dbUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };
  
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.isClosed !== undefined) dbUpdates.is_closed = updates.isClosed;

  if (category !== 'Note') {
    if (updates.expirationDate !== undefined) dbUpdates.expiration_date = updates.expirationDate;
    if (updates.notifyDaysBefore !== undefined) dbUpdates.notify_days_before = updates.notifyDaysBefore;
  } else {
    dbUpdates.expiration_date = null;
    dbUpdates.notify_days_before = 0;
  }

  if (category === 'Gift Card' || category === 'Subscription' || category === 'Warranty') {
    if (updates.value !== undefined) dbUpdates.value = updates.value;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
  } else if (category === 'Note') {
    dbUpdates.value = null;
    dbUpdates.currency = null;
  }

  if (category === 'Gift Card' || category === 'Subscription' || category === 'Warranty') {
    if (updates.merchant !== undefined) dbUpdates.merchant = updates.merchant;
  } else if (category === 'Note') {
    dbUpdates.merchant = null;
  }

  if (category === 'Gift Card') {
    if (updates.accountNumber !== undefined) dbUpdates.account_number = updates.accountNumber;
  } else if (category === 'Note') {
    dbUpdates.account_number = null;
  }

  if (category === 'Subscription') {
    if (updates.autoRenew !== undefined) dbUpdates.auto_renew = updates.autoRenew;
  } else if (category === 'Note') {
    dbUpdates.auto_renew = false;
  }

  const { error } = await client
    .from('myday_items')
    .update(dbUpdates)
    .eq('id', itemId);

  if (error) throw error;
};

export const deleteItem = async (itemId: string): Promise<void> => {
  const { client } = await requireAuth();

  const { error } = await client
    .from('myday_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
};

export const getExpiringItems = async (daysAhead: number = 30): Promise<Item[]> => {
  const items = await getItems();
  if (items.length === 0) return [];

  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysAhead);

  return items.filter(item => {
    if (!item.expirationDate) return false;
    const expDate = new Date(item.expirationDate);
    return expDate >= today && expDate <= futureDate;
  }).sort((a, b) => {
    if (!a.expirationDate || !b.expirationDate) return 0;
    return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
  });
};
