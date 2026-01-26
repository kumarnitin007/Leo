/**
 * Supabase Storage Layer
 * 
 * This replaces the localStorage-based storage with Supabase-only operations.
 * All data is stored in and retrieved from Supabase database.
 * User must be authenticated to use the app.
 */

import { getSupabaseClient } from './lib/supabase';
import { AppData, Task, TaskCompletion, Event, JournalEntry, Routine, Tag, TagSection, UserSettings, DashboardLayout, Item, SafeEntry, SafeMasterKey, Resolution, ResolutionMilestone, DocumentVault, DocumentVaultEncryptedData } from './types';
import { getTodayString } from './utils';
import { hashMasterPassword, generateSalt, verifyMasterPassword as verifyMasterPasswordUtil, deriveKeyFromPassword, encryptData, decryptData } from './utils/encryption';

// ===== HELPER FUNCTIONS =====

// Generate a valid UUID v4
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const requireAuth = async () => {
  const client = getSupabaseClient();
  if (!client) {
    console.debug('requireAuth: Supabase client not available (likely missing VITE vars)');
    throw new Error('Supabase not configured. Please check your .env file.');
  }

  // Log caller context lightly to help debug auth ordering without exposing tokens
  try {
    console.debug('requireAuth: calling client.auth.getUser()');
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      console.debug('requireAuth: no authenticated user found');
      throw new Error('User must be signed in to access data.');
    }

    console.debug('requireAuth: authenticated user id=', user.id);
    return { client, userId: user.id };
  } catch (err) {
    // Re-throw after logging so callers see expected error message
    console.debug('requireAuth: error while checking auth:', err?.message || err);
    throw err;
  }
};

// ===== TASKS =====

export const getTasks = async (): Promise<Task[]> => {
  const { client } = await requireAuth();
  
  const { data, error } = await client
    .from('myday_tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }

  return (data || []).map(task => ({
    id: task.id,
    name: task.name,
    description: task.description || '',
    category: task.category,
    color: task.color,
    customBackgroundColor: task.custom_background_color,
    weightage: task.weightage,
    frequency: task.frequency,
    daysOfWeek: task.days_of_week,
    dayOfMonth: task.day_of_month,
    customFrequency: task.custom_frequency,
    frequencyCount: task.frequency_count,
    frequencyPeriod: task.frequency_period,
    intervalValue: task.interval_value,
    intervalUnit: task.interval_unit,
    intervalStartDate: task.interval_start_date,
    startDate: task.start_date,
    endDate: task.end_date,
    specificDate: task.specific_date,
    endTime: task.end_time,
    dependentTaskIds: task.dependent_task_ids || [],
    onHold: task.on_hold || false,
    holdStartDate: task.hold_start_date,
    holdEndDate: task.hold_end_date,
    holdReason: task.hold_reason,
    tags: task.tags || [],
    createdAt: task.created_at
  }));
};

export const addTask = async (task: Task): Promise<void> => {
  const { client, userId } = await requireAuth();

  const taskData = {
    id: generateUUID(),
    user_id: userId,
    name: task.name,
    description: task.description,
    category: task.category,
    color: task.color,
    custom_background_color: task.customBackgroundColor,
    weightage: task.weightage,
    frequency: task.frequency,
    days_of_week: task.daysOfWeek,
    day_of_month: task.dayOfMonth,
    custom_frequency: task.customFrequency,
    frequency_count: task.frequencyCount,
    frequency_period: task.frequencyPeriod,
    interval_value: task.intervalValue,
    interval_unit: task.intervalUnit,
    interval_start_date: task.intervalStartDate,
    start_date: task.startDate,
    end_date: task.endDate,
    specific_date: task.specificDate,
    end_time: task.endTime,
    dependent_task_ids: task.dependentTaskIds,
    on_hold: task.onHold,
    hold_start_date: task.holdStartDate,
    hold_end_date: task.holdEndDate,
    hold_reason: task.holdReason,
    tags: task.tags,
    created_at: task.createdAt
  };
  
  const { error } = await client
    .from('myday_tasks')
    .insert([taskData]);

  if (error) throw error;
};

export const updateTask = async (taskId: string, updates: Partial<Task>): Promise<void> => {
  const { client } = await requireAuth();

  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.customBackgroundColor !== undefined) dbUpdates.custom_background_color = updates.customBackgroundColor;
  if (updates.weightage !== undefined) dbUpdates.weightage = updates.weightage;
  if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency;
  if (updates.daysOfWeek !== undefined) dbUpdates.days_of_week = updates.daysOfWeek;
  if (updates.dayOfMonth !== undefined) dbUpdates.day_of_month = updates.dayOfMonth;
  if (updates.customFrequency !== undefined) dbUpdates.custom_frequency = updates.customFrequency;
  if (updates.frequencyCount !== undefined) dbUpdates.frequency_count = updates.frequencyCount;
  if (updates.frequencyPeriod !== undefined) dbUpdates.frequency_period = updates.frequencyPeriod;
  if (updates.intervalValue !== undefined) dbUpdates.interval_value = updates.intervalValue;
  if (updates.intervalUnit !== undefined) dbUpdates.interval_unit = updates.intervalUnit;
  if (updates.intervalStartDate !== undefined) dbUpdates.interval_start_date = updates.intervalStartDate;
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
  if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
  if (updates.specificDate !== undefined) dbUpdates.specific_date = updates.specificDate;
  if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
  if (updates.dependentTaskIds !== undefined) dbUpdates.dependent_task_ids = updates.dependentTaskIds;
  if (updates.onHold !== undefined) dbUpdates.on_hold = updates.onHold;
  if (updates.holdStartDate !== undefined) dbUpdates.hold_start_date = updates.holdStartDate;
  if (updates.holdEndDate !== undefined) dbUpdates.hold_end_date = updates.holdEndDate;
  if (updates.holdReason !== undefined) dbUpdates.hold_reason = updates.holdReason;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;

  const { error } = await client
    .from('myday_tasks')
    .update(dbUpdates)
    .eq('id', taskId);

  if (error) throw error;
};

export const deleteTask = async (taskId: string): Promise<void> => {
  const { client } = await requireAuth();

  const { error } = await client
    .from('myday_tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
};

// ===== TASK COMPLETIONS =====

export const completeTask = async (taskId: string, date: string, durationMinutes?: number): Promise<void> => {
  const { client, userId } = await requireAuth();

  // First, check for dependent tasks and complete them too
  const { data: task } = await client
    .from('myday_tasks')
    .select('dependent_task_ids')
    .eq('id', taskId)
    .single();

  // Mark the main task as complete
  const { error } = await client
    .from('myday_task_completions')
    .upsert([{
      user_id: userId,
      task_id: taskId,
      completion_date: date,
      duration_minutes: durationMinutes,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    }], {
      onConflict: 'user_id,task_id,completion_date'
    });

  if (error) throw error;

  // If task has dependents, mark them as complete too
  if (task?.dependent_task_ids && task.dependent_task_ids.length > 0) {
    for (const dependentId of task.dependent_task_ids) {
      await completeTask(dependentId, date, durationMinutes);
    }
  }
};

export const uncompleteTask = async (taskId: string, date: string): Promise<void> => {
  const { client } = await requireAuth();

  const { error } = await client
    .from('myday_task_completions')
    .delete()
    .eq('task_id', taskId)
    .eq('completion_date', date);

  if (error) throw error;
};

export const getCompletions = async (): Promise<TaskCompletion[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_task_completions')
    .select('*');

  if (error) {
    console.error('Error fetching completions:', error);
    return [];
  }

  return (data || []).map(c => ({
    taskId: c.task_id,
    date: c.completion_date,
    completedAt: c.completed_at,
    durationMinutes: c.duration_minutes,
    startedAt: c.started_at
  }));
};

// Alias for getCompletions (for backward compatibility)
export const getTaskHistory = getCompletions;

// ===== EVENTS =====

/**
 * Generate reminder records for an event based on notifyDaysBefore
 * Reminder dates follow the same pattern as event dates:
 * - MM-DD format for yearly events
 * - YYYY-MM-DD format for one-time events
 */
const generateEventReminders = async (event: Event, eventId: string): Promise<void> => {
  if (!event.notifyDaysBefore || event.notifyDaysBefore === 0) return;
  
  const { client, userId } = await requireAuth();
  
  // Delete existing reminders for this event
  await client
    .from('myday_notifybeforedays')
    .delete()
    .eq('event_id', eventId);
  
  const reminders: Array<{ reminder_date: string; days_until_event: number }> = [];
  
  if (event.frequency === 'yearly') {
    // For yearly events: Generate reminders for the upcoming occurrence only
    // Since reminder_date is stored as MM-DD (same pattern as event), we only need one set
    
    // Normalize date format: handle both MM-DD and YYYY-MM-DD formats
    let month: number, day: number;
    const dateParts = event.date.split('-').map(Number);
    
    if (dateParts.length === 3) {
      // YYYY-MM-DD format: extract month and day
      [, month, day] = dateParts; // Skip year, get month and day
    } else if (dateParts.length === 2) {
      // MM-DD format: use as-is
      [month, day] = dateParts;
    } else {
      console.error('Invalid date format for yearly event:', event.date);
      return; // Skip reminder generation if date format is invalid
    }
    
    // Validate month and day
    if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      console.error('Invalid month or day for yearly event:', event.date, 'month:', month, 'day:', day);
      return; // Skip reminder generation if values are invalid
    }
    
    // Calculate the next occurrence of this event
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    let eventDate = new Date(currentYear, month - 1, day);
    eventDate.setHours(0, 0, 0, 0);
    
    // If event already passed this year, use next year
    if (eventDate < today) {
      eventDate = new Date(currentYear + 1, month - 1, day);
      eventDate.setHours(0, 0, 0, 0);
    }
    
    // Generate reminder dates (1 to notifyDaysBefore days before event)
    // Store as MM-DD format to match event pattern
    for (let d = 1; d <= event.notifyDaysBefore; d++) {
      const reminderDate = new Date(eventDate);
      reminderDate.setDate(reminderDate.getDate() - d);
      const reminderDateStr = `${String(reminderDate.getMonth() + 1).padStart(2, '0')}-${String(reminderDate.getDate()).padStart(2, '0')}`;
      reminders.push({ reminder_date: reminderDateStr, days_until_event: d });
    }
  } else if (event.frequency === 'one-time') {
    // For one-time events: Generate reminders for that specific date
    const eventDate = new Date(event.date + 'T00:00:00');
    
    for (let d = 1; d <= event.notifyDaysBefore; d++) {
      const reminderDate = new Date(eventDate);
      reminderDate.setDate(reminderDate.getDate() - d);
      const reminderDateStr = reminderDate.toISOString().split('T')[0]; // YYYY-MM-DD
      reminders.push({ reminder_date: reminderDateStr, days_until_event: d });
    }
  }
  
  // Insert reminder records
  if (reminders.length > 0) {
    const reminderRecords = reminders.map(r => ({
      user_id: userId,
      event_id: eventId,
      reminder_date: r.reminder_date,
      days_until_event: r.days_until_event,
      frequency: event.frequency
    }));
    
    const { error } = await client
      .from('myday_notifybeforedays')
      .insert(reminderRecords);
    
    if (error) {
      console.error('Error generating reminders:', error);
      throw error;
    }
  }
};

export const getEvents = async (): Promise<Event[]> => {
  const { client } = await requireAuth();

  // Select all columns including date_text (from migration)
  // Note: 'date' column doesn't exist, use date_text or event_date
  const { data, error } = await client
    .from('myday_events')
    .select('id, name, description, category, tags, date_text, event_date, frequency, custom_frequency, year, notify_days_before, color, priority, hide_from_dashboard, created_at')
    .order('date_text', { ascending: true, nullsFirst: true })
    .order('event_date', { ascending: true, nullsFirst: true });

  if (error) {
    console.error('Error fetching events:', error);
    return [];
  }

  return (data || []).map(event => {
    // Use date_text if available (from migration), fall back to event_date
    // date_text is preferred as it supports MM-DD format for yearly events
    let eventDate = event.date_text || event.event_date;
    
    return {
      id: event.id,
      name: event.name,
      description: event.description,
      category: event.category,
      tags: event.tags || [],
      date: eventDate,
      frequency: event.frequency || 'yearly',
      customFrequency: event.custom_frequency,
      year: event.year,
      notifyDaysBefore: event.notify_days_before || 0,
      color: event.color,
      priority: event.priority || 5,
      hideFromDashboard: event.hide_from_dashboard || false,
      createdAt: event.created_at || new Date().toISOString()
    };
  });
};

export const addEvent = async (event: Event): Promise<void> => {
  const { client, userId } = await requireAuth();
  const eventId = generateUUID();

  // Normalize date format based on frequency
  let normalizedDate = event.date;
  if (event.frequency === 'yearly') {
    // For yearly events, ensure date is in MM-DD format
    const dateParts = event.date.split('-').map(Number);
    if (dateParts.length === 3) {
      // YYYY-MM-DD format: convert to MM-DD
      const [, month, day] = dateParts;
      normalizedDate = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else if (dateParts.length === 2) {
      // Already in MM-DD format
      normalizedDate = event.date;
    }
  }
  // For one-time events, keep YYYY-MM-DD format

  // Insert event
  const { error } = await client
    .from('myday_events')
    .insert([{
      id: eventId,
      user_id: userId,
      name: event.name,
      description: event.description,
      category: event.category,
      tags: event.tags || [],
      event_date: normalizedDate,
      date_text: normalizedDate, // Store in date_text for consistency
      notify_days_before: event.notifyDaysBefore || 0,
      color: event.color,
      priority: event.priority || 5,
      hide_from_dashboard: event.hideFromDashboard || false,
      frequency: event.frequency || 'yearly',
      custom_frequency: event.customFrequency,
      year: event.year
    }]);

  if (error) throw error;
  
  // Generate reminders if notifyDaysBefore > 0
  // Use normalized date for reminder generation
  if (event.notifyDaysBefore && event.notifyDaysBefore > 0) {
    const eventWithNormalizedDate = { ...event, date: normalizedDate };
    await generateEventReminders(eventWithNormalizedDate, eventId);
  }
};

export const updateEvent = async (eventId: string, updates: Partial<Event>): Promise<void> => {
  const { client } = await requireAuth();

  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  if (updates.date !== undefined) {
    dbUpdates.event_date = updates.date;
    dbUpdates.date_text = updates.date; // Update both for consistency
  }
  if (updates.notifyDaysBefore !== undefined) dbUpdates.notify_days_before = updates.notifyDaysBefore;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.hideFromDashboard !== undefined) dbUpdates.hide_from_dashboard = updates.hideFromDashboard;
  if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency;
  if (updates.customFrequency !== undefined) dbUpdates.custom_frequency = updates.customFrequency;
  if (updates.year !== undefined) dbUpdates.year = updates.year;

  const { error } = await client
    .from('myday_events')
    .update(dbUpdates)
    .eq('id', eventId);

  if (error) throw error;
  
  // If date or notifyDaysBefore changed, regenerate reminders
  if (updates.date !== undefined || updates.notifyDaysBefore !== undefined || updates.frequency !== undefined) {
    // Get full event to regenerate reminders
    const events = await getEvents();
    const fullEvent = events.find(e => e.id === eventId);
    if (fullEvent) {
      // Merge updates into full event
      const updatedEvent = { ...fullEvent, ...updates };
      await generateEventReminders(updatedEvent, eventId);
    }
  }
};

export const deleteEvent = async (eventId: string): Promise<void> => {
  const { client } = await requireAuth();

  const { error } = await client
    .from('myday_events')
    .delete()
    .eq('id', eventId);

  if (error) throw error;
};

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

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    tags: row.tags || [],
    expirationDate: row.expiration_date,
    value: row.value,
    currency: row.currency,
    merchant: row.merchant,
    accountNumber: row.account_number,
    autoRenew: row.auto_renew || false,
    notifyDaysBefore: row.notify_days_before || 0,
    priority: row.priority || 5,
    color: row.color,
    isClosed: row.is_closed || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

export const addItem = async (item: Item): Promise<void> => {
  const { client, userId } = await requireAuth();

  // Build insert object with only relevant fields based on category
  const insertData: any = {
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

  // Only add category-specific fields if not a Note
  if (item.category !== 'Note') {
    insertData.expiration_date = item.expirationDate || null;
    insertData.notify_days_before = item.notifyDaysBefore || 0;
  }

  // Add value/currency for Gift Cards and Subscriptions
  if (item.category === 'Gift Card' || item.category === 'Subscription') {
    insertData.value = item.value || null;
    insertData.currency = item.currency || 'USD';
  }

  // Add merchant for Gift Cards, Subscriptions, and Warranties
  if (item.category === 'Gift Card' || item.category === 'Subscription' || item.category === 'Warranty') {
    insertData.merchant = item.merchant || null;
  }

  // Add account number for Gift Cards
  if (item.category === 'Gift Card') {
    insertData.account_number = item.accountNumber || null;
  }

  // Add auto_renew for Subscriptions
  if (item.category === 'Subscription') {
    insertData.auto_renew = item.autoRenew || false;
  }

  // Add value for Warranties (purchase value)
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

  // Get the current item to check its category
  const items = await getItems();
  const currentItem = items.find(item => item.id === itemId);
  const category = updates.category || currentItem?.category || 'Note';

  const dbUpdates: any = {
    updated_at: new Date().toISOString()
  };
  
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.isClosed !== undefined) dbUpdates.is_closed = updates.isClosed;

  // Only update category-specific fields if not a Note
  if (category !== 'Note') {
    if (updates.expirationDate !== undefined) dbUpdates.expiration_date = updates.expirationDate;
    if (updates.notifyDaysBefore !== undefined) dbUpdates.notify_days_before = updates.notifyDaysBefore;
  } else {
    // For Notes, explicitly set these to null if they exist
    dbUpdates.expiration_date = null;
    dbUpdates.notify_days_before = 0;
  }

  // Update value/currency for Gift Cards, Subscriptions, and Warranties
  if (category === 'Gift Card' || category === 'Subscription' || category === 'Warranty') {
    if (updates.value !== undefined) dbUpdates.value = updates.value;
    if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
  } else if (category === 'Note') {
    // For Notes, set these to null
    dbUpdates.value = null;
    dbUpdates.currency = null;
  }

  // Update merchant for Gift Cards, Subscriptions, and Warranties
  if (category === 'Gift Card' || category === 'Subscription' || category === 'Warranty') {
    if (updates.merchant !== undefined) dbUpdates.merchant = updates.merchant;
  } else if (category === 'Note') {
    dbUpdates.merchant = null;
  }

  // Update account number for Gift Cards
  if (category === 'Gift Card') {
    if (updates.accountNumber !== undefined) dbUpdates.account_number = updates.accountNumber;
  } else if (category === 'Note') {
    dbUpdates.account_number = null;
  }

  // Update auto_renew for Subscriptions
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

// ===== JOURNAL ENTRIES =====

export const getJournalEntries = async (): Promise<JournalEntry[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_journal_entries')
    .select('*')
    .order('entry_date', { ascending: false });

  if (error) {
    console.error('Error fetching journal entries:', error);
    return [];
  }

  return (data || []).map(entry => ({
    id: entry.id,
    date: entry.entry_date,
    content: entry.content,
    mood: entry.mood,
    tags: entry.tags || [],
    createdAt: entry.created_at || new Date().toISOString(),
    updatedAt: entry.updated_at || new Date().toISOString()
  }));
};

export const saveJournalEntry = async (entry: JournalEntry): Promise<void> => {
  const { client, userId } = await requireAuth();

  const { error } = await client
    .from('myday_journal_entries')
    .upsert([{
      id: entry.id || generateUUID(),
      user_id: userId,
      entry_date: entry.date,
      content: entry.content,
      tags: entry.tags
    }], {
      onConflict: 'user_id,entry_date'
    });

  if (error) throw error;
};

export const deleteJournalEntry = async (entryId: string): Promise<void> => {
  const { client } = await requireAuth();

  const { error } = await client
    .from('myday_journal_entries')
    .delete()
    .eq('id', entryId);

  if (error) throw error;
};

export const getJournalEntryByDate = async (date: string): Promise<JournalEntry | null> => {
  const entries = await getJournalEntries();
  return entries.find(e => e.date === date) || null;
};

// ===== ROUTINES =====

export const getRoutines = async (): Promise<Routine[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_routines')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching routines:', error);
    return [];
  }

  return (data || []).map(routine => ({
    id: routine.id,
    name: routine.name,
    description: routine.description,
    taskIds: routine.task_ids || [],
    timeOfDay: routine.time_of_day,
    isPreDefined: routine.is_pre_defined || false,
    isActive: routine.is_active !== false, // Default to true for backward compatibility
    createdAt: routine.created_at || new Date().toISOString()
  }));
};

export const saveRoutine = async (routine: Routine): Promise<void> => {
  const { client, userId } = await requireAuth();

  const { error } = await client
    .from('myday_routines')
    .upsert([{
      id: routine.id || generateUUID(),
      user_id: userId,
      name: routine.name,
      description: routine.description,
      task_ids: routine.taskIds,
      time_of_day: routine.timeOfDay,
      is_pre_defined: routine.isPreDefined || false,
      is_active: routine.isActive !== false
    }], {
      onConflict: 'id'
    });

  if (error) throw error;
};

export const deleteRoutine = async (routineId: string): Promise<void> => {
  const { client } = await requireAuth();

  const { error } = await client
    .from('myday_routines')
    .delete()
    .eq('id', routineId);

  if (error) throw error;
};

// Aliases for backward compatibility
export const addRoutine = saveRoutine;
export const updateRoutine = async (routineId: string, updates: Partial<Routine>): Promise<void> => {
  const routines = await getRoutines();
  const routine = routines.find(r => r.id === routineId);
  if (!routine) throw new Error('Routine not found');
  await saveRoutine({ ...routine, ...updates });
};

export const initializeDefaultRoutines = async (): Promise<void> => {
  try {
    const { client, userId } = await requireAuth();
    
    // Check if sample routines already exist
    const { data: existingRoutines, error: checkError } = await client
      .from('myday_routines')
      .select('id')
      .eq('user_id', userId)
      .eq('is_pre_defined', true);

    if (checkError) throw checkError;
    
    // If sample routines already exist, don't create duplicates
    if (existingRoutines && existingRoutines.length > 0) {
      return;
    }

    // Create sample routines (inactive by default)
    const sampleRoutines = [
      {
        id: generateUUID(),
        user_id: userId,
        name: '🌅 Morning Energizer',
        description: 'Start your day with energy and focus',
        time_of_day: 'morning',
        task_ids: [],
        is_pre_defined: true,
        is_active: false,
        created_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: '🌙 Evening Wind Down',
        description: 'Relax and prepare for restful sleep',
        time_of_day: 'evening',
        task_ids: [],
        is_pre_defined: true,
        is_active: false,
        created_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: '💪 Workout Session',
        description: 'Complete workout and fitness routine',
        time_of_day: 'anytime',
        task_ids: [],
        is_pre_defined: true,
        is_active: false,
        created_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: '🧘 Mindfulness Break',
        description: 'Meditation, breathing, and mental reset',
        time_of_day: 'anytime',
        task_ids: [],
        is_pre_defined: true,
        is_active: false,
        created_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: '📚 Study Session',
        description: 'Focused learning and skill development',
        time_of_day: 'afternoon',
        task_ids: [],
        is_pre_defined: true,
        is_active: false,
        created_at: new Date().toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: '🏠 Home Reset',
        description: 'Quick cleaning and organization routine',
        time_of_day: 'anytime',
        task_ids: [],
        is_pre_defined: true,
        is_active: false,
        created_at: new Date().toISOString()
      }
    ];

    const { error: insertError } = await client
      .from('myday_routines')
      .insert(sampleRoutines);

    if (insertError) throw insertError;
    
    console.log('✅ Sample routines initialized successfully');
  } catch (error) {
    console.error('Error initializing sample routines:', error);
  }
};

// ===== TAGS =====

export const getTags = async (): Promise<Tag[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_tags')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching tags:', error);
    return [];
  }

  return (data || []).map(tag => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    trackable: tag.trackable || false,
    description: tag.description,
    allowedSections: tag.allowed_sections || undefined,
    isSafeOnly: tag.is_safe_only || false,
    isSystemCategory: tag.is_system_category || false,
    parentId: tag.parent_id || undefined,
    createdAt: tag.created_at || new Date().toISOString()
  }));
};

/**
 * Get tags available for a specific section
 * @param section - The section to get tags for ('tasks', 'events', 'journals', 'items', 'safe')
 */
export const getTagsForSection = async (section: TagSection): Promise<Tag[]> => {
  const { client, userId } = await requireAuth();

  let query = client
    .from('myday_tags')
    .select('*')
    .eq('user_id', userId);

  if (section === 'safe') {
    // For safe section, only show safe-only tags
    query = query.eq('is_safe_only', true);
  } else {
    // For regular sections, exclude safe-only tags
    // Include tags where allowed_sections is null (backward compatible) or contains the section
    query = query
      .or('is_safe_only.is.null,is_safe_only.eq.false');
    
    // Filter by allowed_sections: null means available in all, or array contains the section
    // Note: Supabase array contains uses cs (contains) operator
    const { data: allTags, error: fetchError } = await query;
    
    if (fetchError) {
      console.error('Error fetching tags for section:', fetchError);
      return [];
    }
    
    // Filter in memory for allowed_sections (more reliable than complex query)
    const filteredTags = (allTags || []).filter(tag => {
      // If is_safe_only is true, exclude it
      if (tag.is_safe_only) return false;
      
      // If allowed_sections is null/empty, include it (backward compatible)
      if (!tag.allowed_sections || tag.allowed_sections.length === 0) {
        return true;
      }
      
      // Check if section is in allowed_sections array
      return tag.allowed_sections.includes(section);
    });
    
    // Sort and map
    return filteredTags
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        trackable: tag.trackable || false,
        description: tag.description,
        allowedSections: tag.allowed_sections || undefined,
        isSafeOnly: tag.is_safe_only || false,
        isSystemCategory: tag.is_system_category || false,
        parentId: tag.parent_id || undefined,
        createdAt: tag.created_at || new Date().toISOString()
      }));
  }

  const { data, error } = await query.order('name', { ascending: true });

  if (error) {
    console.error('Error fetching tags for section:', error);
    return [];
  }

  return (data || []).map(tag => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    trackable: tag.trackable || false,
    description: tag.description,
    allowedSections: tag.allowed_sections || undefined,
    isSafeOnly: tag.is_safe_only || false,
    isSystemCategory: tag.is_system_category || false,
    parentId: tag.parent_id || undefined,
    createdAt: tag.created_at || new Date().toISOString()
  }));
};

export const saveTag = async (tag: Tag): Promise<void> => {
  const { client, userId } = await requireAuth();

  const { error } = await client
    .from('myday_tags')
    .upsert([{
      id: tag.id || generateUUID(),
      user_id: userId,
      name: tag.name,
      color: tag.color,
      trackable: tag.trackable,
      description: tag.description,
      allowed_sections: tag.allowedSections || null,
      is_safe_only: tag.isSafeOnly || false,
      is_system_category: tag.isSystemCategory || false,
      parent_id: tag.parentId || null
    }], {
      onConflict: 'user_id,name'
    });

  if (error) throw error;
};

export const deleteTag = async (tagId: string): Promise<void> => {
  const { client } = await requireAuth();

  const { error } = await client
    .from('myday_tags')
    .delete()
    .eq('id', tagId);

  if (error) throw error;
};

// Aliases for backward compatibility
export const addTag = saveTag;
export const updateTag = async (tagId: string, updates: Partial<Tag>): Promise<void> => {
  const tags = await getTags();
  const tag = tags.find(t => t.id === tagId);
  if (!tag) throw new Error('Tag not found');
  await saveTag({ ...tag, ...updates });
};

// ===== USER SETTINGS =====
// Note: User settings can still be stored in localStorage as they're user-preference based

const USER_SETTINGS_KEY = 'routine-ruby-user-settings';

export const loadUserSettings = async (): Promise<UserSettings> => {
  try {
    const { client, userId } = await requireAuth();
    const { data, error } = await client
      .from('myday_user_settings')
      .select('theme, dashboard_layout, notifications_enabled, location')
      .eq('user_id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error loading user settings:', error);
    }
    
    if (data) {
      return {
        theme: data.theme || 'purple',
        dashboardLayout: data.dashboard_layout || 'uniform',
        notifications: data.notifications_enabled ?? true,
        location: data.location ? JSON.parse(data.location) : undefined
      };
    }
  } catch (error: any) {
    // Silently handle auth errors (user not signed in yet) - this is expected
    if (error?.message?.includes('User must be signed in') || 
        error?.message?.includes('Supabase not configured')) {
      // This is expected when user hasn't signed in yet, don't log as error
      return {
        theme: 'purple',
        dashboardLayout: 'uniform',
        notifications: true,
        location: undefined
      };
    }
    // Log other errors
    console.error('Error loading user settings:', error);
  }
  
  // Return defaults if loading fails
  return {
    theme: 'purple',
    dashboardLayout: 'uniform',
    notifications: true,
    location: undefined
  };
};

export const saveUserSettings = async (settings: Partial<UserSettings>): Promise<void> => {
  const { client, userId } = await requireAuth();
  
  const dbUpdates: any = {};
  if (settings.theme !== undefined) dbUpdates.theme = settings.theme;
  if (settings.dashboardLayout !== undefined) dbUpdates.dashboard_layout = settings.dashboardLayout;
  if (settings.notifications !== undefined) dbUpdates.notifications_enabled = settings.notifications;
  if (settings.location !== undefined) dbUpdates.location = JSON.stringify(settings.location);
  
  const { error } = await client
    .from('myday_user_settings')
    .upsert([{
      user_id: userId,
      ...dbUpdates
    }], {
      onConflict: 'user_id'
    });
  
  if (error) throw error;
  
  // Also update localStorage cache
  try {
    const current = getUserSettingsSync();
    localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
  } catch (cacheError) {
    console.error('Error updating settings cache:', cacheError);
  }
};

// Alias for backward compatibility
export const getUserSettings = loadUserSettings;

  // Sync version for initial load (returns cached data from localStorage)
export const getUserSettingsSync = (): UserSettings => {
  const stored = localStorage.getItem(USER_SETTINGS_KEY);
  if (!stored) {
    return {
      theme: 'purple',
      dashboardLayout: 'uniform',
      notifications: true,
      location: undefined
    };
  }
  return JSON.parse(stored);
};

export const getDashboardLayout = (): DashboardLayout => {
  const settings = getUserSettingsSync();
  return settings.dashboardLayout || 'uniform';
};

export const setDashboardLayout = async (layout: DashboardLayout): Promise<void> => {
  await saveUserSettings({ dashboardLayout: layout });
};

// Alias for backward compatibility
export const saveDashboardLayout = setDashboardLayout;

// ===== ONBOARDING =====

const ONBOARDING_KEY = 'routine-ruby-onboarding-complete';

export const isFirstTimeUser = (): boolean => {
  return !localStorage.getItem(ONBOARDING_KEY);
};

export const markOnboardingComplete = (): void => {
  localStorage.setItem(ONBOARDING_KEY, 'true');
};

// ===== DATA OPERATIONS =====

export const loadData = async (): Promise<AppData> => {
  const [tasks, completions, events, journalEntries, routines, tags, items] = await Promise.all([
    getTasks(),
    getCompletions(),
    getEvents(),
    getJournalEntries(),
    getRoutines(),
    getTags(),
    getItems()
  ]);

  return {
    tasks,
    completions,
    spillovers: [], // Not implemented yet
    events,
    eventAcknowledgments: [], // Not implemented yet
    journalEntries,
    routines,
    tags,
    items,
    safeEntries: [], // Safe entries loaded separately
    safeTags: [] // Safe tags loaded separately
  };
};

// ===== HELPER FUNCTIONS FOR VIEWS =====

// Synchronous version that works with pre-loaded data
export const isTaskCompletedToday = (taskId: string, date: string, completions?: TaskCompletion[]): boolean => {
  if (!completions) {
    // If no completions provided, return false (data should be pre-loaded)
    console.warn('isTaskCompletedToday called without completions data');
    return false;
  }
  return completions.some(c => c.taskId === taskId && c.date === date);
};

export const getTaskSpilloversForDate = async (date: string): Promise<any[]> => {
  // Spillovers not yet implemented in Supabase
  return [];
};

export const moveTaskToNextDay = async (taskId: string, fromDate: string, toDate: string): Promise<void> => {
  // Spillovers not yet implemented in Supabase
  console.log('Move to next day not yet implemented');
};

export const getCompletionCountForPeriod = async (taskId: string, startDate: string, endDate: string): Promise<number> => {
  const completions = await getCompletions();
  return completions.filter(c => c.taskId === taskId && c.date >= startDate && c.date <= endDate).length;
};

export const saveTaskOrder = (taskIds: string[]): void => {
  localStorage.setItem('routine-ruby-task-order', JSON.stringify(taskIds));
};

export const loadTaskOrder = (): string[] => {
  try {
    const stored = localStorage.getItem('routine-ruby-task-order');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading task order:', error);
  }
  return [];
};

export const getUpcomingEvents = async (daysAhead: number = 7, baseDate?: string): Promise<Array<{ event: Event; date: string; daysUntil: number }>> => {
  const { client, userId } = await requireAuth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Use baseDate if provided (for selected date navigation), otherwise use today
  const selectedDate = baseDate || today.toISOString().split('T')[0];
  const selectedDateObj = new Date(selectedDate + 'T00:00:00');
  const mmdd = `${String(selectedDateObj.getMonth() + 1).padStart(2, '0')}-${String(selectedDateObj.getDate()).padStart(2, '0')}`;
  
  // Query reminders table for the selected date
  // Match MM-DD for yearly events or YYYY-MM-DD for one-time events
  const { data: reminders, error } = await client
    .from('myday_notifybeforedays')
    .select(`
      *,
      event:myday_events(*)
    `)
    .eq('user_id', userId)
    .or(`reminder_date.eq.${mmdd},reminder_date.eq.${selectedDate}`);
  
  if (error) {
    console.error('Error fetching reminders:', error);
    // Fallback to old logic if table doesn't exist yet
    return getUpcomingEventsLegacy(daysAhead, baseDate);
  }
  
  // Also check for events on the actual date (not just reminders)
  const events = await getEvents();
  const upcoming: Array<{ event: Event; date: string; daysUntil: number }> = [];
  const seenEventIds = new Set<string>();
  
  // Process reminders
  if (reminders && reminders.length > 0) {
    reminders.forEach((reminder: any) => {
      const eventData = reminder.event;
      if (!eventData || eventData.hide_from_dashboard) return;
      
      // Match by frequency pattern
      const matches = (reminder.frequency === 'yearly' && reminder.reminder_date === mmdd) ||
                     (reminder.frequency === 'one-time' && reminder.reminder_date === selectedDate);
      
      if (matches) {
        const eventKey = `${eventData.id}-${reminder.reminder_date}-${reminder.days_until_event}`;
        if (!seenEventIds.has(eventKey)) {
          seenEventIds.add(eventKey);
          
          // Map database event to Event type
          const event: Event = {
            id: eventData.id,
            name: eventData.name,
            description: eventData.description,
            category: eventData.category,
            tags: eventData.tags || [],
            date: eventData.date_text || eventData.event_date,
            frequency: eventData.frequency || 'yearly',
            customFrequency: eventData.custom_frequency,
            year: eventData.year,
            notifyDaysBefore: eventData.notify_days_before || 0,
            color: eventData.color,
            priority: eventData.priority || 5,
            hideFromDashboard: eventData.hide_from_dashboard || false,
            createdAt: eventData.created_at || new Date().toISOString()
          };
          
          upcoming.push({
            event,
            date: reminder.reminder_date,
            daysUntil: reminder.days_until_event
          });
        }
      }
    });
  }
  
  // Also check for events on the actual date (not just reminders)
  events.forEach(event => {
    if (event.hideFromDashboard) return;
    
    let eventDate: Date;
    let eventDateStr: string;
    
    if (event.frequency === 'yearly') {
      const [eventMonth, eventDay] = event.date.split('-').map(Number);
      const baseMonth = selectedDateObj.getMonth() + 1;
      const baseDay = selectedDateObj.getDate();
      
      // Check if event is on the selected date
      if (eventMonth === baseMonth && eventDay === baseDay) {
        const eventKey = `${event.id}-${selectedDate}-0`;
        if (!seenEventIds.has(eventKey)) {
          seenEventIds.add(eventKey);
          upcoming.push({
            event,
            date: selectedDate,
            daysUntil: 0 // TODAY!
          });
        }
      }
    } else if (event.frequency === 'one-time') {
      if (event.date === selectedDate) {
        const eventKey = `${event.id}-${selectedDate}-0`;
        if (!seenEventIds.has(eventKey)) {
          seenEventIds.add(eventKey);
          upcoming.push({
            event,
            date: selectedDate,
            daysUntil: 0 // TODAY!
          });
        }
      }
    }
  });
  
  // Sort by daysUntil (today/selected date first, then upcoming)
  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
};

// Legacy function as fallback (old complex logic)
const getUpcomingEventsLegacy = async (daysAhead: number = 7, baseDate?: string): Promise<Array<{ event: Event; date: string; daysUntil: number }>> => {
  const events = await getEvents();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const base = baseDate ? new Date(baseDate + 'T00:00:00') : today;
  base.setHours(0, 0, 0, 0);
  
  const upcoming: Array<{ event: Event; date: string; daysUntil: number }> = [];
  const seenEventIds = new Set<string>();
  
  events.forEach(event => {
    if (event.hideFromDashboard) return;
    const notifyDays = event.notifyDaysBefore || 7;
    let eventDate: Date;
    let eventDateStr: string;
    
    if (event.frequency === 'yearly') {
      eventDateStr = event.date;
      if (!eventDateStr || !eventDateStr.includes('-')) return;
      const [eventMonth, eventDay] = eventDateStr.split('-').map(Number);
      if (isNaN(eventMonth) || isNaN(eventDay)) return;
      const currentYear = base.getFullYear();
      eventDate = new Date(currentYear, eventMonth - 1, eventDay);
      eventDate.setHours(0, 0, 0, 0);
      const baseMonth = base.getMonth() + 1;
      const baseDay = base.getDate();
      const eventMatchesToday = (eventMonth === baseMonth && eventDay === baseDay);
      if (eventMatchesToday) {
        eventDate = new Date(base);
        eventDate.setHours(0, 0, 0, 0);
      } else {
        const daysDiff = Math.floor((eventDate.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff < 0) {
          eventDate = new Date(currentYear + 1, eventMonth - 1, eventDay);
          eventDate.setHours(0, 0, 0, 0);
        }
      }
    } else if (event.frequency === 'one-time') {
      eventDateStr = event.date;
      eventDate = new Date(eventDateStr + 'T00:00:00');
      if (isNaN(eventDate.getTime())) return;
      eventDate.setHours(0, 0, 0, 0);
    } else {
      return;
    }
    
    const daysUntil = Math.floor((eventDate.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilFromToday = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const shouldShow = daysUntilFromToday >= 0 && (
      daysUntil === 0 ||
      (daysUntil > 0 && daysUntil <= notifyDays) ||
      (daysUntil < 0 && daysUntil >= -notifyDays)
    );
    
    if (shouldShow) {
      const eventDateStrForKey = event.frequency === 'yearly' 
        ? `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`
        : eventDateStr;
      const eventKey = `${event.id}-${eventDateStrForKey}-${daysUntil}`;
      if (!seenEventIds.has(eventKey)) {
        seenEventIds.add(eventKey);
        upcoming.push({
          event,
          date: eventDateStrForKey,
          daysUntil: daysUntil === 0 ? 0 : daysUntil
        });
      }
    }
  });
  
  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
};

const EVENT_ACK_KEY = 'routine-ruby-event-acknowledgments';

export const acknowledgeEvent = (eventId: string, date: string): void => {
  try {
    const stored = localStorage.getItem(EVENT_ACK_KEY);
    const acks = stored ? JSON.parse(stored) : {};
    acks[`${eventId}-${date}`] = true;
    localStorage.setItem(EVENT_ACK_KEY, JSON.stringify(acks));
  } catch (error) {
    console.error('Error acknowledging event:', error);
  }
};

export const isEventAcknowledged = (eventId: string, date: string): boolean => {
  try {
    const stored = localStorage.getItem(EVENT_ACK_KEY);
    const acks = stored ? JSON.parse(stored) : {};
    return !!acks[`${eventId}-${date}`];
  } catch (error) {
    console.error('Error checking event acknowledgment:', error);
    return false;
  }
};

export const bulkHoldTasks = async (endDate?: string, reason?: string): Promise<void> => {
  const tasks = await getTasks();
  for (const task of tasks) {
    await updateTask(task.id, {
      onHold: true,
      holdStartDate: getTodayString(),
      holdEndDate: endDate,
      holdReason: reason
    });
  }
};

export const bulkUnholdTasks = async (): Promise<void> => {
  const tasks = await getTasks();
  for (const task of tasks) {
    if (task.onHold) {
      await updateTask(task.id, {
        onHold: false,
        holdStartDate: undefined,
        holdEndDate: undefined,
        holdReason: undefined
      });
    }
  }
};

// ===== USER PROFILE =====

export const getUserProfile = async (): Promise<{ username: string; email: string; avatarEmoji: string } | null> => {
  try {
    const { client, userId } = await requireAuth();
    const { data, error } = await client
      .from('myday_users')
      .select('username, email, avatar_emoji')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
    
    return {
      username: data.username || 'User',
      email: data.email || '',
      avatarEmoji: data.avatar_emoji || '😊'
    };
  } catch (error) {
    console.error('Error loading user profile:', error);
    return null;
  }
};

export const updateUserProfile = async (updates: { username?: string; email?: string; avatarEmoji?: string }): Promise<void> => {
  const { client, userId } = await requireAuth();
  
  const dbUpdates: any = {};
  if (updates.username !== undefined) dbUpdates.username = updates.username;
  if (updates.email !== undefined) dbUpdates.email = updates.email;
  if (updates.avatarEmoji !== undefined) dbUpdates.avatar_emoji = updates.avatarEmoji;
  
  const { error } = await client
    .from('myday_users')
    .update(dbUpdates)
    .eq('id', userId);
  
  if (error) throw error;
};

// ===== CLEAR LOCAL STORAGE =====

export const clearLocalStorage = (): void => {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith('myday-') || key.startsWith('routine-ruby-')) {
      if (key !== USER_SETTINGS_KEY && key !== ONBOARDING_KEY) {
        localStorage.removeItem(key);
      }
    }
  });
};

// ===== SAMPLE DATA =====

export const importSampleTasks = async (replace: boolean = false): Promise<boolean> => {
  try {
    const { client, userId } = await requireAuth();

    if (replace) {
      const { error: deleteError } = await client
        .from('myday_tasks')
        .delete()
        .eq('user_id', userId);
      if (deleteError) {
        console.error('Error deleting existing tasks:', deleteError);
        return false;
      }
    }

    // Load sample tasks from utility
    const { loadSampleTasks } = await import('./utils/sampleData');
    const samples = loadSampleTasks();
    const now = new Date().toISOString();

    const rows = samples.map(t => ({
      id: generateUUID(),
      user_id: userId,
      name: t.name,
      description: t.description || null,
      category: t.category || null,
      tags: t.tags || [],
      weightage: t.weightage || 5,
      frequency: t.frequency || 'daily',
      days_of_week: t.daysOfWeek || null,
      day_of_month: t.dayOfMonth || null,
      custom_frequency: t.customFrequency || null,
      frequency_count: t.frequencyCount || null,
      frequency_period: t.frequencyPeriod || null,
      interval_value: t.intervalValue || null,
      interval_unit: t.intervalUnit || null,
      interval_start_date: t.intervalStartDate || null,
      start_date: t.startDate || null,
      end_date: t.endDate || null,
      specific_date: t.specificDate || null,
      end_time: t.endTime || null,
      dependent_task_ids: t.dependentTaskIds || null,
      on_hold: t.onHold || false,
      hold_start_date: t.holdStartDate || null,
      hold_end_date: t.holdEndDate || null,
      hold_reason: t.holdReason || null,
      color: t.color || null,
      custom_background_color: t.customBackgroundColor || null,
      created_at: t.createdAt || now
    }));

    const { error } = await client
      .from('myday_tasks')
      .insert(rows);

    if (error) {
      console.error('Error inserting sample tasks:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('importSampleTasks error:', err);
    return false;
  }
};

export const importSampleEvents = async (replace: boolean = false): Promise<boolean> => {
  try {
    const { client, userId } = await requireAuth();

    if (replace) {
      const { error: deleteError } = await client
        .from('myday_events')
        .delete()
        .eq('user_id', userId);
      if (deleteError) {
        console.error('Error deleting existing events:', deleteError);
        return false;
      }
    }

    const now = new Date().toISOString();

    // Ensure demo tag IDs exist for 'Pinned' and 'Milestone'
    const demoTagNames = ['Pinned', 'Milestone'];
    const { data: existingTags } = await client
      .from('myday_tags')
      .select('id,name')
      .eq('user_id', userId)
      .in('name', demoTagNames);

    const tagMap = new Map<string, string>();
    if (existingTags && Array.isArray(existingTags)) {
      for (const t of existingTags as any[]) {
        tagMap.set(t.name, t.id);
      }
    }

    const tagsToInsert = demoTagNames.filter(n => !tagMap.has(n)).map(n => ({
      id: generateUUID(),
      user_id: userId,
      name: n,
      color: n === 'Pinned' ? '#f59e0b' : '#10b981',
      trackable: false,
      description: null,
      allowed_sections: ['tasks', 'events', 'journals', 'items'],
      is_safe_only: false,
      is_system_category: false,
      created_at: now
    }));

    if (tagsToInsert.length > 0) {
      const { error: tagInsertError } = await client.from('myday_tags').insert(tagsToInsert);
      if (tagInsertError) {
        console.warn('Failed to insert demo tags:', tagInsertError);
      } else {
        // Refresh existing tags
        const { data: reloaded } = await client
          .from('myday_tags')
          .select('id,name')
          .eq('user_id', userId)
          .in('name', demoTagNames);
        if (reloaded && Array.isArray(reloaded)) {
          for (const t of reloaded as any[]) tagMap.set(t.name, t.id);
        }
      }
    }

    const pinnedId = tagMap.get('Pinned') || null;
    const milestoneId = tagMap.get('Milestone') || null;

    // Create a richer set of sample events (12 items)
    const sampleEvents: any[] = [
      { name: '🎂 Demo User Birthday', category: 'Birthday', date: '01-01', frequency: 'yearly', notify_days_before: 3, color: '#ef4444', tags: pinnedId ? [pinnedId] : [] },
      { name: '💍 Anniversary', category: 'Anniversary', date: '06-15', frequency: 'yearly', notify_days_before: 3, color: '#f59e0b', tags: milestoneId ? [milestoneId] : [] },
      { name: '📅 Product Launch', category: 'Special Event', date: new Date().toISOString().split('T')[0], frequency: 'one-time', notify_days_before: 0, color: '#3b82f6' },
      { name: '📌 Team Offsite', category: 'Work', date: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().split('T')[0], frequency: 'one-time', notify_days_before: 2, color: '#06b6d4', tags: pinnedId ? [pinnedId] : [] },
      { name: '🏁 Sprint Deadline', category: 'Milestone', date: new Date(new Date().setDate(new Date().getDate() + 20)).toISOString().split('T')[0], frequency: 'one-time', notify_days_before: 5, color: '#a855f7', tags: milestoneId ? [milestoneId] : [] },
      { name: '🎉 Product Beta Release', category: 'Release', date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0], frequency: 'one-time', notify_days_before: 7, color: '#10b981' },
      { name: '📅 Monthly Book Club', category: 'Community', date: '15', frequency: 'monthly', notify_days_before: 1, color: '#3b82f6' },
      { name: '🔁 Payroll Day', category: 'Finance', date: '2026-01-31', frequency: 'monthly', notify_days_before: 2, color: '#f97316' },
      { name: '🛠️ Maintenance Window', category: 'Ops', date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0], frequency: 'one-time', notify_days_before: 1, color: '#ef4444' },
      { name: '📚 Course Enrollment Ends', category: 'Education', date: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString().split('T')[0], frequency: 'one-time', notify_days_before: 3, color: '#6366f1' },
      { name: '🏆 Quarterly Review', category: 'Work', date: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString().split('T')[0], frequency: 'one-time', notify_days_before: 5, color: '#f59e0b' },
      { name: '🎈 Anniversary Celebration', category: 'Personal', date: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0], frequency: 'yearly', notify_days_before: 7, color: '#ec4899' }
    ];

    const rows = sampleEvents.map(ev => ({
      id: generateUUID(),
      user_id: userId,
      name: ev.name,
      description: ev.description || null,
      category: ev.category || null,
      tags: ev.tags || [],
      event_date: ev.date,
      date_text: ev.date,
      notify_days_before: ev.notify_days_before || 0,
      color: ev.color || null,
      priority: ev.priority || 5,
      hide_from_dashboard: ev.hide_from_dashboard || false,
  frequency: ev.frequency || 'yearly',
      custom_frequency: ev.customFrequency || null,
      year: ev.year || null,
      created_at: now
    }));

    const { error } = await client
      .from('myday_events')
      .insert(rows);

    if (error) {
      console.error('Error inserting sample events:', error);
      return false;
    }

    // Generate reminders for events with notify_days_before
    for (const ev of rows) {
      if (ev.notify_days_before && ev.notify_days_before > 0) {
        try {
          // Build a minimal Event-shaped object for reminder generation
          const reminderEvent = {
            id: ev.id,
            name: ev.name,
            date: ev.event_date,
            frequency: ev.frequency as any,
            notifyDaysBefore: ev.notify_days_before || 0,
            createdAt: ev.created_at || now
          } as any;

          await generateEventReminders(reminderEvent, ev.id);
        } catch (remErr) {
          // non-fatal
        }
      }
    }

    return true;
  } catch (err) {
    console.error('importSampleEvents error:', err);
    return false;
  }
};

export const importSampleItems = async (replace: boolean = false): Promise<boolean> => {
  try {
    const { client, userId } = await requireAuth();
    
    if (replace) {
      // Delete all existing items
      const { error: deleteError } = await client
        .from('myday_items')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) {
        console.error('Error deleting existing items:', deleteError);
        return false;
      }
    }
    
    const now = new Date();
    const sampleItems = [
      // Gift Cards (5 items)
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Amazon Gift Card',
        description: 'Received as birthday gift',
        category: 'Gift Card',
        tags: [],
        expiration_date: null,
        value: 50.00,
        currency: 'USD',
        merchant: 'Amazon',
        account_number: '****1234',
        auto_renew: false,
        notify_days_before: 0,
        priority: 7,
        color: '#ff9900',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Starbucks Gift Card',
        description: 'Coffee fund',
        category: 'Gift Card',
        tags: [],
        expiration_date: null,
        value: 25.00,
        currency: 'USD',
        merchant: 'Starbucks',
        account_number: '****5678',
        auto_renew: false,
        notify_days_before: 0,
        priority: 5,
        color: '#00704a',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Target Gift Card',
        description: 'For household items',
        category: 'Gift Card',
        tags: [],
        expiration_date: new Date(now.getFullYear() + 1, 11, 31).toISOString().split('T')[0],
        value: 100.00,
        currency: 'USD',
        merchant: 'Target',
        account_number: '****9012',
        auto_renew: false,
        notify_days_before: 30,
        priority: 6,
        color: '#cc0000',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Apple Store Gift Card',
        description: 'For accessories',
        category: 'Gift Card',
        tags: [],
        expiration_date: null,
        value: 75.00,
        currency: 'USD',
        merchant: 'Apple',
        account_number: '****3456',
        auto_renew: false,
        notify_days_before: 0,
        priority: 8,
        color: '#000000',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Restaurant Gift Card',
        description: 'Local Italian restaurant',
        category: 'Gift Card',
        tags: [],
        expiration_date: new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()).toISOString().split('T')[0],
        value: 40.00,
        currency: 'USD',
        merchant: 'Bella Italia',
        account_number: null,
        auto_renew: false,
        notify_days_before: 14,
        priority: 5,
        color: '#8b4513',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      
      // Subscriptions (5 items)
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Netflix Subscription',
        description: 'Monthly streaming service',
        category: 'Subscription',
        tags: [],
        expiration_date: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString().split('T')[0],
        value: 15.99,
        currency: 'USD',
        merchant: 'Netflix',
        account_number: 'user@example.com',
        auto_renew: true,
        notify_days_before: 3,
        priority: 8,
        color: '#e50914',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Spotify Premium',
        description: 'Music streaming',
        category: 'Subscription',
        tags: [],
        expiration_date: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString().split('T')[0],
        value: 9.99,
        currency: 'USD',
        merchant: 'Spotify',
        account_number: 'premium@example.com',
        auto_renew: true,
        notify_days_before: 3,
        priority: 7,
        color: '#1db954',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Adobe Creative Cloud',
        description: 'Annual subscription',
        category: 'Subscription',
        tags: [],
        expiration_date: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString().split('T')[0],
        value: 599.88,
        currency: 'USD',
        merchant: 'Adobe',
        account_number: 'creative@example.com',
        auto_renew: true,
        notify_days_before: 30,
        priority: 9,
        color: '#ff0000',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Gym Membership',
        description: 'Monthly fitness center',
        category: 'Subscription',
        tags: [],
        expiration_date: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString().split('T')[0],
        value: 49.99,
        currency: 'USD',
        merchant: 'FitLife Gym',
        account_number: 'MEMBER-12345',
        auto_renew: true,
        notify_days_before: 7,
        priority: 6,
        color: '#0066cc',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Microsoft 365',
        description: 'Office suite subscription',
        category: 'Subscription',
        tags: [],
        expiration_date: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString().split('T')[0],
        value: 99.99,
        currency: 'USD',
        merchant: 'Microsoft',
        account_number: 'office@example.com',
        auto_renew: true,
        notify_days_before: 30,
        priority: 8,
        color: '#0078d4',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      
      // Warranties (4 items)
      {
        id: generateUUID(),
        user_id: userId,
        name: 'iPhone 15 Pro Warranty',
        description: 'AppleCare+ coverage',
        category: 'Warranty',
        tags: [],
        expiration_date: new Date(now.getFullYear() + 2, now.getMonth(), now.getDate()).toISOString().split('T')[0],
        value: 1299.00,
        currency: 'USD',
        merchant: 'Apple',
        account_number: 'SN-ABC123XYZ',
        auto_renew: false,
        notify_days_before: 60,
        priority: 9,
        color: '#000000',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Laptop Warranty',
        description: 'Extended warranty for Dell XPS',
        category: 'Warranty',
        tags: [],
        expiration_date: new Date(now.getFullYear() + 1, now.getMonth() + 6, now.getDate()).toISOString().split('T')[0],
        value: 1499.99,
        currency: 'USD',
        merchant: 'Dell',
        account_number: 'SVC-789456',
        auto_renew: false,
        notify_days_before: 90,
        priority: 8,
        color: '#007db8',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Refrigerator Warranty',
        description: 'Home appliance warranty',
        category: 'Warranty',
        tags: [],
        expiration_date: new Date(now.getFullYear() + 4, now.getMonth(), now.getDate()).toISOString().split('T')[0],
        value: 899.00,
        currency: 'USD',
        merchant: 'Samsung',
        account_number: 'MOD-2024-001',
        auto_renew: false,
        notify_days_before: 180,
        priority: 6,
        color: '#1428a0',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Car Extended Warranty',
        description: 'Vehicle service contract',
        category: 'Warranty',
        tags: [],
        expiration_date: new Date(now.getFullYear() + 3, now.getMonth(), now.getDate()).toISOString().split('T')[0],
        value: 25000.00,
        currency: 'USD',
        merchant: 'AutoCare Plus',
        account_number: 'VIN-123456789',
        auto_renew: false,
        notify_days_before: 90,
        priority: 10,
        color: '#ff6600',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      
      // Notes (4 items)
      {
        id: generateUUID(),
        user_id: userId,
        name: 'WiFi Password',
        description: 'Home network: MyNetwork2024!',
        category: 'Note',
        tags: [],
        expiration_date: null,
        value: null,
        currency: null,
        merchant: null,
        account_number: null,
        auto_renew: false,
        notify_days_before: 0,
        priority: 7,
        color: '#6366f1',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Insurance Policy Numbers',
        description: 'Health: POL-123456\nAuto: POL-789012\nHome: POL-345678',
        category: 'Note',
        tags: [],
        expiration_date: null,
        value: null,
        currency: null,
        merchant: null,
        account_number: null,
        auto_renew: false,
        notify_days_before: 0,
        priority: 9,
        color: '#059669',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Emergency Contacts',
        description: 'Doctor: Dr. Smith - 555-0101\nVet: Animal Hospital - 555-0202\nPlumber: Fix-It Now - 555-0303',
        category: 'Note',
        tags: [],
        expiration_date: null,
        value: null,
        currency: null,
        merchant: null,
        account_number: null,
        auto_renew: false,
        notify_days_before: 0,
        priority: 10,
        color: '#dc2626',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      },
      {
        id: generateUUID(),
        user_id: userId,
        name: 'Important Account Numbers',
        description: 'Bank Account: ****5678\nCredit Card: ****9012\nSSN: ***-**-1234',
        category: 'Note',
        tags: [],
        expiration_date: null,
        value: null,
        currency: null,
        merchant: null,
        account_number: null,
        auto_renew: false,
        notify_days_before: 0,
        priority: 8,
        color: '#7c3aed',
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      }
    ];
    
    const { error } = await client
      .from('myday_items')
      .insert(sampleItems);
    
    if (error) {
      console.error('Error importing sample items:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error importing sample items:', error);
    return false;
  }
};

export const importSampleTags = async (replace: boolean = false): Promise<boolean> => {
  try {
    const { client, userId } = await requireAuth();

    if (replace) {
      const { error: deleteError } = await client
        .from('myday_tags')
        .delete()
        .eq('user_id', userId);
      if (deleteError) {
        console.error('Error deleting existing tags:', deleteError);
        return false;
      }
    }

    const now = new Date().toISOString();
    const sampleTags = [
      { name: 'Health', color: '#ef4444', allowed_sections: ['tasks', 'journals'] },
      { name: 'Work', color: '#3b82f6', allowed_sections: ['tasks', 'events'] },
      { name: 'Personal', color: '#f59e0b', allowed_sections: ['tasks', 'journals'] },
      { name: 'Finance', color: '#10b981', allowed_sections: ['items'] }
    ];

    const rows = sampleTags.map(t => ({
      id: generateUUID(),
      user_id: userId,
      name: t.name,
      color: t.color,
      trackable: false,
      description: null,
      allowed_sections: t.allowed_sections,
      is_safe_only: false,
      is_system_category: false,
      created_at: now
    }));

    const { error } = await client
      .from('myday_tags')
      .insert(rows);

    if (error) {
      console.error('Error inserting sample tags:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('importSampleTags error:', err);
    return false;
  }
};

export const importSampleJournals = async (replace: boolean = false): Promise<boolean> => {
  try {
    const { client, userId } = await requireAuth();

    if (replace) {
      const { error: deleteError } = await client
        .from('myday_journal_entries')
        .delete()
        .eq('user_id', userId);
      if (deleteError) {
        console.error('Error deleting existing journal entries:', deleteError);
        return false;
      }
    }

    const now = new Date().toISOString();
    const sampleJournals = [
      { date: new Date().toISOString().split('T')[0], content: 'Today I started exploring the demo of the app. Great first impressions!', mood: 'good' },
      { date: new Date(new Date().setDate(new Date().getDate()-1)).toISOString().split('T')[0], content: 'A productive day. Completed several tasks and felt accomplished.', mood: 'great' }
    ];

    for (const j of sampleJournals) {
      const { error } = await client
        .from('myday_journal_entries')
        .insert([{
          id: generateUUID(),
          user_id: userId,
          entry_date: j.date,
          content: j.content,
          mood: j.mood,
          tags: [] ,
          created_at: now,
          updated_at: now
        }]);

      if (error) {
        console.error('Error inserting sample journal entry:', error);
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error('importSampleJournals error:', err);
    return false;
  }
};

export const importSampleSafe = async (replace: boolean = false): Promise<boolean> => {
  try {
    const { client, userId } = await requireAuth();

    if (replace) {
      const { error: deleteError } = await client
        .from('myday_encrypted_entries')
        .delete()
        .eq('user_id', userId);
      if (deleteError) {
        console.error('Error deleting existing safe entries:', deleteError);
        return false;
      }
    }

    // Try to derive encryption key using demo safe password if available
    const demoSafeFromEnv = (import.meta.env.VITE_DEMO_SAFE_PASSWORD as string) || null;
    const demoSafeFromLocal = localStorage.getItem('myday-demo-safe-password') || null;
    const demoSafe = demoSafeFromEnv || demoSafeFromLocal;

    if (demoSafe) {
      try {
        await setMasterPassword(demoSafe);
      } catch (e) {
        // ignore if already set
      }
    }

    // Get encryption key
    let encryptionKey: any = null;
    if (demoSafe) {
      try {
        encryptionKey = await getEncryptionKey(demoSafe);
      } catch (e) {
        console.warn('Could not derive encryption key for demo safe:', e);
      }
    }

    // Prepare a larger set (15-20) of sample safe entries with varied categories
    const sampleEntries = [
      {
        title: 'Demo Login - example.com',
        url: 'https://example.com',
        tags: [],
        is_favorite: true,
        expires_at: null,
        encryptedData: { username: 'demo.user', password: 'demo1234', notes: 'This is a demo credential.' }
      },
      {
        title: 'Work Email - acme',
        url: 'https://mail.acme.com',
        tags: [],
        is_favorite: false,
        expires_at: null,
        encryptedData: { username: 'employee@acme.com', password: 'Acme!Pass2024', notes: 'Work email access.' }
      },
      {
        title: 'Personal Bank Account',
        url: null,
        tags: [],
        is_favorite: false,
        expires_at: null,
        encryptedData: { accountNumber: '****1234', routingNumber: '110000', bankName: 'Demo Bank', notes: 'Checking account (demo).' }
      },
      {
        title: 'Demo Credit Card',
        url: null,
        tags: [],
        is_favorite: false,
        expires_at: '2027-08-01',
        encryptedData: { cardNumber: '4111 1111 1111 1111', cvv: '123', cardholderName: 'Demo User', billingAddress: '123 Demo St' }
      },
      {
        title: 'GitHub Token',
        url: 'https://github.com',
        tags: [],
        is_favorite: true,
        expires_at: null,
        encryptedData: { apiKey: 'ghp_demo_token_XXXXXXXXXXXXXXXX', apiSecret: '', notes: 'Demo GitHub PAT (read-only)' }
      },
      {
        title: 'AWS Console (Demo)',
        url: 'https://console.aws.amazon.com',
        tags: [],
        is_favorite: false,
        expires_at: null,
        encryptedData: { username: 'aws-demo', password: 'AwsDemo!234', apiKey: 'AKIADEMO', apiSecret: 'secret' }
      },
      {
        title: 'Home WiFi',
        url: null,
        tags: [],
        is_favorite: false,
        expires_at: null,
        encryptedData: { networkName: 'DemoNet', securityType: 'WPA2', password: 'DemoWifiPass' }
      },
      {
        title: 'Licensing - Photoshop',
        url: null,
        tags: [],
        is_favorite: false,
        expires_at: null,
        encryptedData: { licenseKey: 'PHSP-DEMO-XXXX-XXXX', productName: 'Photoshop 2024', vendor: 'Adobe' }
      },
      {
        title: 'Insurance Policy',
        url: null,
        tags: [],
        is_favorite: false,
        expires_at: null,
        encryptedData: { policyNumber: 'INS-000-DEMO', provider: 'Demo Insurance Co.', agentName: 'Jane Agent', agentPhone: '555-0100' }
      },
      {
        title: 'Medical Member ID',
        url: null,
        tags: [],
        is_favorite: false,
        expires_at: null,
        encryptedData: { memberId: 'MED-DEMO-123', medicalProvider: 'Demo Health', planName: 'Demo Plan' }
      },
      {
        title: 'Gift Card - DemoShop',
        url: 'https://demoshop.example',
        tags: [],
        is_favorite: false,
        expires_at: null,
        encryptedData: { giftCardNumber: 'GC-DEMO-0001', giftCardPin: '9999', balance: 25, merchant: 'DemoShop' }
      },
      {
        title: 'TOTP - Demo Service',
        url: null,
        tags: [],
        is_favorite: false,
        expires_at: null,
        encryptedData: { totpSecret: 'JBSWY3DPEHPK3PXP', totpIssuer: 'DemoService', totpAccount: 'demo@example.com' }
      },
      {
        title: 'Passport (Demo)',
        url: null,
        tags: [],
        is_favorite: false,
        expires_at: null,
        encryptedData: { documentNumber: 'P-DEMO-7890', issueDate: '2018-01-01', issueAuthority: 'Demo Country' }
      },
      {
        title: 'VPN Account',
        url: 'https://vpn.demo',
        tags: [],
        is_favorite: false,
        expires_at: null,
        encryptedData: { username: 'vpn-demo', password: 'VpnDemoPass', endpoint: 'vpn.demo:443' }
      },
      {
        title: 'Bank Routing Info',
        url: null,
        tags: [],
        is_favorite: false,
        expires_at: null,
        encryptedData: { routingNumber: '110000', accountNumber: '****5678', notes: 'Routing for wire transfers (demo)' }
      },
      {
        title: 'Software License - Demo App',
        url: null,
        tags: [],
        is_favorite: false,
        expires_at: null,
        encryptedData: { licenseKey: 'DEMO-APP-KEY-1234', productName: 'Demo App', vendor: 'DemoSoft' }
      }
    ];

    for (const e of sampleEntries) {
      if (encryptionKey) {
        // Use existing addSafeEntry helper to handle encryption and insertion
        try {
          await addSafeEntry({
            title: e.title,
            url: e.url,
            categoryTagId: null,
            tags: e.tags,
            isFavorite: e.is_favorite,
            expiresAt: e.expires_at,
            encryptedData: JSON.stringify(e.encryptedData)
          }, encryptionKey);
        } catch (err) {
          console.error('Error adding safe entry:', err);
        }
      } else {
        // As fallback, store a plaintext placeholder entry in myday_encrypted_entries (not encrypted) so demo users can see entries
        const now = new Date().toISOString();
        try {
          await client.from('myday_encrypted_entries').insert([{
            id: generateUUID(),
            user_id: userId,
            title: e.title,
            url: e.url || null,
            category_tag_id: null,
            tags: e.tags || [],
            is_favorite: e.is_favorite,
            expires_at: e.expires_at || null,
            encrypted_data: JSON.stringify(e.encryptedData),
            encrypted_data_iv: null,
            created_at: now,
            updated_at: now
          }]);
        } catch (err) {
          console.error('Error inserting plaintext demo safe entry:', err);
        }
      }
    }

    return true;
  } catch (err) {
    console.error('importSampleSafe error:', err);
    return false;
  }
};

export const clearAllData = async (): Promise<void> => {
  throw new Error('Clear all data not supported. Please delete tasks individually or sign out and delete your account.');
};

// ===== SAFE SECTION FUNCTIONS =====

/**
 * Initialize default system categories for safe section
 * Now uses unified myday_tags table
 */
export const initializeSafeCategories = async (): Promise<void> => {
  const { client, userId } = await requireAuth();
  
  const systemCategories = [
    { name: 'Login/Credentials', color: '#3b82f6' },
    { name: 'Credit Card', color: '#ef4444' },
    { name: 'Bank Account', color: '#10b981' },
    { name: 'Stock Trading Account', color: '#f59e0b' },
    { name: 'Identity Documents', color: '#8b5cf6' },
    { name: 'Insurance', color: '#f97316' },
    { name: 'Medical', color: '#ec4899' },
    { name: 'License/Software', color: '#06b6d4' },
    { name: 'API Key', color: '#84cc16' },
    { name: 'WiFi', color: '#a855f7' },
    { name: 'Gift Card', color: '#f43f5e' },
    { name: 'Address', color: '#06b6d4' },
    { name: 'Other', color: '#6b7280' }
  ];

  // Check if categories already exist in unified tags table
  const { data: existingTags } = await client
    .from('myday_tags')
    .select('name')
    .eq('user_id', userId)
    .eq('is_safe_only', true)
    .in('name', systemCategories.map(c => c.name));

  const existingNames = new Set(existingTags?.map(t => t.name) || []);
  const categoriesToInsert = systemCategories.filter(c => !existingNames.has(c.name));

  if (categoriesToInsert.length > 0) {
    const now = new Date();
    const tagsToInsert = categoriesToInsert.map(cat => ({
      id: generateUUID(),
      user_id: userId,
      name: cat.name,
      is_system_category: true,
      is_safe_only: true,
      allowed_sections: ['safe'],
      color: cat.color,
      created_at: now.toISOString()
    }));

    const { error } = await client
      .from('myday_tags')
      .insert(tagsToInsert);

    if (error) {
      console.error('Error initializing safe categories:', error);
    }
  }
};

/**
 * Get all safe tags (categories and custom tags)
 * Now uses unified tags system - returns Tag[] but compatible with SafeTag interface
 */
export const getSafeTags = async (): Promise<Tag[]> => {
  // Use getTagsForSection which filters for safe-only tags
  return await getTagsForSection('safe');
};

/**
 * Create a custom safe tag
 * Now uses unified tags system
 */
export const createSafeTag = async (name: string, color: string = '#667eea'): Promise<Tag | null> => {
  const tag: Tag = {
    id: generateUUID(),
    name: name.trim(),
    color: color,
    isSafeOnly: true,
    isSystemCategory: false,
    allowedSections: ['safe'],
    createdAt: new Date().toISOString()
  };

  try {
    await saveTag(tag);
    return tag;
  } catch (error) {
    console.error('Error creating safe tag:', error);
    return null;
  }
};

/**
 * Check if master password is set
 */
export const hasMasterPassword = async (): Promise<boolean> => {
  try {
    const { client, userId } = await requireAuth();
    
    const { data, error } = await client
      .from('myday_safe_master_keys')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle no rows gracefully

    if (error) {
      console.error('[Safe] Error checking master password:', error);
      return false;
    }

    const hasPassword = !!data;
    return hasPassword;
  } catch (error) {
    console.error('[Safe] Error in hasMasterPassword:', error);
    return false;
  }
};

/**
 * Set master password (first time setup)
 */
export const setMasterPassword = async (password: string): Promise<boolean> => {
  const { client, userId } = await requireAuth();
  
  // Check if already exists
  const exists = await hasMasterPassword();
  if (exists) {
    throw new Error('Master password already set. Use changeMasterPassword to update it.');
  }

  // Generate salt and hash
  const salt = generateSalt();
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const keyHash = await hashMasterPassword(password, salt);

  const now = new Date();
  const masterKey = {
    id: generateUUID(),
    user_id: userId,
    key_hash: keyHash,
    salt: saltBase64,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  const { error } = await client
    .from('myday_safe_master_keys')
    .insert(masterKey);

  if (error) {
    console.error('Error setting master password:', error);
    return false;
  }

  // Initialize default categories
  await initializeSafeCategories();

  return true;
};

/**
 * Verify master password
 */
export const verifyMasterPassword = async (password: string): Promise<boolean> => {
  const { client, userId } = await requireAuth();
  
  const { data, error } = await client
    .from('myday_safe_master_keys')
    .select('key_hash, salt')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return await verifyMasterPasswordUtil(password, data.key_hash, data.salt);
};

/**
 * Change master password (requires old password)
 */
export const changeMasterPassword = async (oldPassword: string, newPassword: string): Promise<boolean> => {
  const { client, userId } = await requireAuth();
  
  // Verify old password
  const isValid = await verifyMasterPassword(oldPassword);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  // Get all encrypted entries to re-encrypt with new key
  const entries = await getSafeEntries();
  
  // Derive old key for decryption
  const { data: oldKeyData } = await client
    .from('myday_safe_master_keys')
    .select('salt')
    .eq('user_id', userId)
    .single();

  const oldSaltArray = Uint8Array.from(atob(oldKeyData.salt), c => c.charCodeAt(0));
  const oldKey = await deriveKeyFromPassword(oldPassword, oldSaltArray);

  // Derive new key for encryption
  const newSalt = generateSalt();
  const newSaltBase64 = btoa(String.fromCharCode(...newSalt));
  const newKey = await deriveKeyFromPassword(newPassword, newSalt);
  const newKeyHash = await hashMasterPassword(newPassword, newSalt);

  // Re-encrypt all entries
  for (const entry of entries) {
    try {
      // Decrypt with old key
      const decryptedData = await decryptData(entry.encryptedData, entry.encryptedDataIv, oldKey);
      
      // Encrypt with new key
      const { encrypted, iv } = await encryptData(decryptedData, newKey);
      
      // Update entry
      await client
        .from('myday_encrypted_entries')
        .update({
          encrypted_data: encrypted,
          encrypted_data_iv: iv,
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id);
    } catch (error) {
      console.error(`Error re-encrypting entry ${entry.id}:`, error);
      throw new Error('Failed to re-encrypt some entries. Please try again.');
    }
  }

  // Update master key
  const { error } = await client
    .from('myday_safe_master_keys')
    .update({
      key_hash: newKeyHash,
      salt: newSaltBase64,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating master password:', error);
    return false;
  }

  return true;
};

/**
 * Get encryption key from master password (for session)
 * This should be stored in memory only, never persisted
 */
export async function getEncryptionKey(password: string): Promise<CryptoKey> {
  const { client, userId } = await requireAuth();
  
  const { data, error } = await client
    .from('myday_safe_master_keys')
    .select('salt')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error('Master password not set');
  }

  const saltArray = Uint8Array.from(atob(data.salt), c => c.charCodeAt(0));
  return await deriveKeyFromPassword(password, saltArray);
}

/**
 * Get all safe entries (plaintext fields only)
 */
export const getSafeEntries = async (): Promise<SafeEntry[]> => {
  const { client, userId } = await requireAuth();
  
  const { data, error } = await client
    .from('myday_encrypted_entries')
    .select('*')
    .eq('user_id', userId)
    .order('is_favorite', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching safe entries:', error);
    return [];
  }

  return (data || []).map(entry => ({
    id: entry.id,
    title: entry.title,
    url: entry.url,
    categoryTagId: entry.category_tag_id,
    tags: entry.tags || [],
    isFavorite: entry.is_favorite,
    expiresAt: entry.expires_at,
    encryptedData: entry.encrypted_data,
    encryptedDataIv: entry.encrypted_data_iv,
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
    lastAccessedAt: entry.last_accessed_at
  }));
};

/**
 * Get count of safe entries (for locked state)
 */
export const getSafeEntriesCount = async (): Promise<number> => {
  const { client, userId } = await requireAuth();
  
  const { count, error } = await client
    .from('myday_encrypted_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Error counting safe entries:', error);
    return 0;
  }

  return count || 0;
};

/**
 * Add a new safe entry
 */
export const addSafeEntry = async (
  entry: Omit<SafeEntry, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessedAt' | 'encryptedDataIv'> & { encryptedDataIv?: string },
  encryptionKey: CryptoKey
): Promise<SafeEntry | null> => {
  const { client, userId } = await requireAuth();
  
  // Encrypt the data
  const { encrypted, iv } = await encryptData(entry.encryptedData, encryptionKey);

  const now = new Date();
  const dbEntry = {
    id: generateUUID(),
    user_id: userId,
    title: entry.title,
    url: entry.url || null,
    category_tag_id: entry.categoryTagId || null,
    tags: entry.tags || [],
    is_favorite: entry.isFavorite || false,
    expires_at: entry.expiresAt || null,
    encrypted_data: encrypted,
    encrypted_data_iv: iv,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    last_accessed_at: null
  };

  const { data, error } = await client
    .from('myday_encrypted_entries')
    .insert(dbEntry)
    .select()
    .single();

  if (error) {
    console.error('Error adding safe entry:', error);
    return null;
  }

  return {
    id: data.id,
    title: data.title,
    url: data.url,
    categoryTagId: data.category_tag_id,
    tags: data.tags || [],
    isFavorite: data.is_favorite,
    expiresAt: data.expires_at,
    encryptedData: data.encrypted_data,
    encryptedDataIv: data.encrypted_data_iv,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    lastAccessedAt: data.last_accessed_at
  };
};

/**
 * Update a safe entry
 */
export const updateSafeEntry = async (
  entryId: string,
  updates: Partial<Omit<SafeEntry, 'id' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'>>,
  encryptionKey?: CryptoKey
): Promise<boolean> => {
  const { client } = await requireAuth();
  
  const dbUpdates: any = {
    updated_at: new Date().toISOString()
  };

  // Update plaintext fields
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.url !== undefined) dbUpdates.url = updates.url || null;
  if (updates.categoryTagId !== undefined) dbUpdates.category_tag_id = updates.categoryTagId || null;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags || [];
  if (updates.isFavorite !== undefined) dbUpdates.is_favorite = updates.isFavorite;
  if (updates.expiresAt !== undefined) dbUpdates.expires_at = updates.expiresAt || null;

  // Update encrypted data if provided
  if (updates.encryptedData && encryptionKey) {
    const { encrypted, iv } = await encryptData(updates.encryptedData, encryptionKey);
    dbUpdates.encrypted_data = encrypted;
    dbUpdates.encrypted_data_iv = iv;
  }

  const { error } = await client
    .from('myday_encrypted_entries')
    .update(dbUpdates)
    .eq('id', entryId);

  if (error) {
    console.error('Error updating safe entry:', error);
    return false;
  }

  return true;
};

/**
 * Delete a safe entry
 */
export const deleteSafeEntry = async (entryId: string): Promise<boolean> => {
  const { client } = await requireAuth();
  
  const { error } = await client
    .from('myday_encrypted_entries')
    .delete()
    .eq('id', entryId);

  if (error) {
    console.error('Error deleting safe entry:', error);
    return false;
  }

  return true;
};

/**
 * Mark entry as accessed (update last_accessed_at)
 */
export const markSafeEntryAccessed = async (entryId: string): Promise<void> => {
  const { client } = await requireAuth();
  
  await client
    .from('myday_encrypted_entries')
    .update({ last_accessed_at: new Date().toISOString() })
    .eq('id', entryId);
};

/**
 * Delete all entries with a specific tag
 * Returns the number of entries deleted
 */
export const deleteSafeEntriesByTag = async (tagId: string): Promise<number> => {
  const { client } = await requireAuth();
  
  // Get all entries with this tag
  const { data: entries, error: fetchError } = await client
    .from('myday_encrypted_entries')
    .select('id')
    .contains('tags', [tagId]);
  
  if (fetchError) {
    console.error('Error fetching entries by tag:', fetchError);
    throw new Error('Failed to fetch entries');
  }
  
  if (!entries || entries.length === 0) {
    return 0;
  }
  
  // Delete entries in batches to avoid URL length limits
  const entryIds = entries.map(e => e.id);
  const batchSize = 100; // Delete 100 entries at a time
  let deletedCount = 0;
  
  for (let i = 0; i < entryIds.length; i += batchSize) {
    const batch = entryIds.slice(i, i + batchSize);
    const { error: deleteError } = await client
      .from('myday_encrypted_entries')
      .delete()
      .in('id', batch);
    
    if (deleteError) {
      console.error('Error deleting entries by tag:', deleteError);
      throw new Error('Failed to delete entries');
    }
    
    deletedCount += batch.length;
  }
  
  return deletedCount;
};

/**
 * Decrypt an entry's data
 */
export const decryptSafeEntry = async (
  entry: SafeEntry,
  encryptionKey: CryptoKey
): Promise<string> => {
  return await decryptData(entry.encryptedData, entry.encryptedDataIv, encryptionKey);
};

/**
 * Import safe entries (for backup restoration)
 */
export const importSafeEntries = async (
  entries: SafeEntry[],
  encryptionKey: CryptoKey
): Promise<{ success: number; failed: number }> => {
  const { client, userId } = await requireAuth();
  
  let success = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      // Check if entry already exists (use maybeSingle to handle case where entry doesn't exist)
      const { data: existing, error: checkError } = await client
        .from('myday_encrypted_entries')
        .select('id')
        .eq('id', entry.id)
        .maybeSingle();

      // If there's an error checking, skip this entry
      if (checkError) {
        console.error('Error checking for existing entry:', checkError);
        failed++;
        continue;
      }

      if (existing) {
        // Update existing entry
        const { error } = await client
          .from('myday_encrypted_entries')
          .update({
            title: entry.title,
            url: entry.url || null,
            category_tag_id: entry.categoryTagId || null,
            tags: entry.tags || [],
            is_favorite: entry.isFavorite || false,
            expires_at: entry.expiresAt || null,
            encrypted_data: entry.encryptedData,
            encrypted_data_iv: entry.encryptedDataIv,
            updated_at: new Date().toISOString()
          })
          .eq('id', entry.id);

        if (error) throw error;
        success++;
      } else {
        // Insert new entry
        const dbEntry = {
          id: entry.id,
          user_id: userId,
          title: entry.title,
          url: entry.url || null,
          category_tag_id: entry.categoryTagId || null,
          tags: entry.tags || [],
          is_favorite: entry.isFavorite || false,
          expires_at: entry.expiresAt || null,
          encrypted_data: entry.encryptedData,
          encrypted_data_iv: entry.encryptedDataIv,
          created_at: entry.createdAt,
          updated_at: entry.updatedAt || new Date().toISOString(),
          last_accessed_at: entry.lastAccessedAt || null
        };

        const { error } = await client
          .from('myday_encrypted_entries')
          .insert(dbEntry);

        if (error) throw error;
        success++;
      }
    } catch (error) {
      console.error(`Error importing entry ${entry.id}:`, error);
      failed++;
    }
  }

  return { success, failed };
};

// ===== DOCUMENT VAULT =====

export const getDocumentVaults = async (): Promise<DocumentVault[]> => {
  const { client, userId } = await requireAuth();
  
  const { data, error } = await client
    .from('myday_document_vaults')
    .select('*')
    .eq('user_id', userId)
    .order('is_favorite', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching document vaults:', error);
    return [];
  }

  return (data || []).map(doc => ({
    id: doc.id,
    title: doc.title,
    provider: doc.provider,
    documentType: doc.document_type,
    tags: doc.tags || [],
    issueDate: doc.issue_date,
    expiryDate: doc.expiry_date,
    isFavorite: doc.is_favorite,
    encryptedData: doc.encrypted_data,
    encryptedDataIv: doc.encrypted_data_iv,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at
  }));
};

export const addDocumentVault = async (
  vault: Omit<DocumentVault, 'id' | 'createdAt' | 'updatedAt' | 'encryptedDataIv'> & { encryptedDataIv?: string },
  encryptionKey: CryptoKey
): Promise<DocumentVault | null> => {
  const { client, userId } = await requireAuth();
  
  // Encrypt the data
  const { encrypted, iv } = await encryptData(vault.encryptedData, encryptionKey);

  const now = new Date();
  const dbVault = {
    id: generateUUID(),
    user_id: userId,
    title: vault.title,
    provider: vault.provider,
    document_type: vault.documentType,
    tags: vault.tags || [],
    issue_date: vault.issueDate || null,
    expiry_date: vault.expiryDate || null,
    is_favorite: vault.isFavorite || false,
    encrypted_data: encrypted,
    encrypted_data_iv: iv,
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  const { data, error } = await client
    .from('myday_document_vaults')
    .insert(dbVault)
    .select()
    .single();

  if (error) {
    console.error('Error adding document vault:', error);
    return null;
  }

  return {
    id: data.id,
    title: data.title,
    provider: data.provider,
    documentType: data.document_type,
    tags: data.tags || [],
    issueDate: data.issue_date,
    expiryDate: data.expiry_date,
    isFavorite: data.is_favorite,
    encryptedData: data.encrypted_data,
    encryptedDataIv: data.encrypted_data_iv,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
};

export const updateDocumentVault = async (
  vaultId: string,
  updates: Partial<Omit<DocumentVault, 'id' | 'createdAt' | 'updatedAt'>>,
  encryptionKey?: CryptoKey
): Promise<boolean> => {
  const { client } = await requireAuth();
  
  const dbUpdates: any = {
    updated_at: new Date().toISOString()
  };

  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.provider !== undefined) dbUpdates.provider = updates.provider;
  if (updates.documentType !== undefined) dbUpdates.document_type = updates.documentType;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags || [];
  if (updates.issueDate !== undefined) dbUpdates.issue_date = updates.issueDate || null;
  if (updates.expiryDate !== undefined) dbUpdates.expiry_date = updates.expiryDate || null;
  if (updates.isFavorite !== undefined) dbUpdates.is_favorite = updates.isFavorite;

  if (updates.encryptedData && encryptionKey) {
    const { encrypted, iv } = await encryptData(updates.encryptedData, encryptionKey);
    dbUpdates.encrypted_data = encrypted;
    dbUpdates.encrypted_data_iv = iv;
  }

  const { error } = await client
    .from('myday_document_vaults')
    .update(dbUpdates)
    .eq('id', vaultId);

  if (error) {
    console.error('Error updating document vault:', error);
    return false;
  }

  return true;
};

export const deleteDocumentVault = async (vaultId: string): Promise<boolean> => {
  const { client } = await requireAuth();

  const { error } = await client
    .from('myday_document_vaults')
    .delete()
    .eq('id', vaultId);

  if (error) {
    console.error('Error deleting document vault:', error);
    return false;
  }

  return true;
};

export const decryptDocumentVault = async (
  vault: DocumentVault,
  encryptionKey: CryptoKey
): Promise<DocumentVaultEncryptedData> => {
  try {
    const decryptedJson = await decryptData(vault.encryptedData, vault.encryptedDataIv, encryptionKey);
    return JSON.parse(decryptedJson);
  } catch (error) {
    console.error('Error decrypting document vault:', error);
    throw new Error('Failed to decrypt document vault data');
  }
};

export const getResolutions = async (): Promise<Resolution[]> => {
  const { client } = await requireAuth();
  
  const { data, error } = await client
    .from('myday_resolutions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching resolutions:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: row.tags || [],
    targetYear: row.target_year,
    startDate: row.start_date,
    endDate: row.end_date,
    progressMetric: row.progress_metric,
    targetValue: row.target_value,
    currentValue: row.current_value,
    milestones: row.milestones || [],
    linkedTaskIds: row.linked_task_ids || [],
    priority: row.priority || 5,
    color: row.color,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
};

export const addResolution = async (resolution: Resolution): Promise<void> => {
  const { client, userId } = await requireAuth();

  const resolutionData = {
    id: resolution.id || generateUUID(),
    user_id: userId,
    title: resolution.title,
    description: resolution.description,
    category: resolution.category,
    tags: resolution.tags || [],
    target_year: resolution.targetYear,
    start_date: resolution.startDate,
    end_date: resolution.endDate,
    progress_metric: resolution.progressMetric,
    target_value: resolution.targetValue,
    current_value: resolution.currentValue || 0,
    milestones: resolution.milestones || [],
    linked_task_ids: resolution.linkedTaskIds || [],
    priority: resolution.priority || 5,
    color: resolution.color,
    status: resolution.status || 'active',
    created_at: resolution.createdAt || new Date().toISOString(),
    updated_at: resolution.updatedAt || new Date().toISOString()
  };
  
  const { error } = await client
    .from('myday_resolutions')
    .insert([resolutionData]);

  if (error) throw error;
};

export const updateResolution = async (resolutionId: string, updates: Partial<Resolution>): Promise<void> => {
  const { client } = await requireAuth();

  const dbUpdates: any = {
    updated_at: new Date().toISOString()
  };

  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  if (updates.targetYear !== undefined) dbUpdates.target_year = updates.targetYear;
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
  if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
  if (updates.progressMetric !== undefined) dbUpdates.progress_metric = updates.progressMetric;
  if (updates.targetValue !== undefined) dbUpdates.target_value = updates.targetValue;
  if (updates.currentValue !== undefined) dbUpdates.current_value = updates.currentValue;
  if (updates.milestones !== undefined) dbUpdates.milestones = updates.milestones;
  if (updates.linkedTaskIds !== undefined) dbUpdates.linked_task_ids = updates.linkedTaskIds;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.status !== undefined) dbUpdates.status = updates.status;

  const { error } = await client
    .from('myday_resolutions')
    .update(dbUpdates)
    .eq('id', resolutionId);

  if (error) throw error;
};

export const deleteResolution = async (resolutionId: string): Promise<void> => {
  const { client } = await requireAuth();

  const { error } = await client
    .from('myday_resolutions')
    .delete()
    .eq('id', resolutionId);

  if (error) throw error;
};

// ===== HOLIDAY & BULK EVENT IMPORT =====

interface ImportedEventFile {
  version: string;
  description: string;
  events: Array<{
    name: string;
    description?: string;
    category: string;
    date: string;
    frequency: 'yearly' | 'one-time' | 'monthly' | 'custom';
    notifyDaysBefore?: number;
    priority?: number;
    color?: string;
    tags?: string[];
  }>;
}

interface TagSelectionMap {
  [tagName: string]: string | 'CREATE_NEW'; // tag ID or 'CREATE_NEW' signal
}

/**
 * Imports events from a JSON file with optional tag creation/selection
 * @param fileUrl URL to the JSON file (e.g., '/sample-indian-holidays-national.json')
 * @param selectedTags Map of tag names to IDs. If tag name maps to 'CREATE_NEW', a new tag will be created
 * @param replace If true, deletes all existing events before importing
 */
export const importEventsFromFile = async (
  fileUrl: string,
  selectedTags: TagSelectionMap = {},
  replace: boolean = false
): Promise<{ success: boolean; message: string; importedCount: number }> => {
  try {
    const { client, userId } = await requireAuth();

    // Fetch the JSON file
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${fileUrl}: ${response.statusText}`);
    }

    const fileData: ImportedEventFile = await response.json();

    // Validate file structure
    if (!fileData.events || !Array.isArray(fileData.events)) {
      throw new Error('Invalid event file format: missing events array');
    }

    if (replace) {
      const { error: deleteError } = await client
        .from('myday_events')
        .delete()
        .eq('user_id', userId);
      if (deleteError) {
        console.error('Error deleting existing events:', deleteError);
        return {
          success: false,
          message: 'Failed to delete existing events',
          importedCount: 0
        };
      }
    }

    const now = new Date().toISOString();
    const tagMap = new Map<string, string>();

    // Get all existing tags for the user
    const { data: existingTags } = await client
      .from('myday_tags')
      .select('id,name')
      .eq('user_id', userId)
      .eq('allowed_sections', 'events'); // Filter for event tags

    if (existingTags && Array.isArray(existingTags)) {
      for (const t of existingTags as any[]) {
        tagMap.set(t.name, t.id);
      }
    }

    // Process tag selections and create new tags if needed
    const tagsToCreate: any[] = [];
    const finalTagMap = new Map<string, string>(tagMap);

    for (const [tagName, tagValue] of Object.entries(selectedTags)) {
      if (tagValue === 'CREATE_NEW' && !finalTagMap.has(tagName)) {
        // Need to create this tag
        const newTagId = generateUUID();
        tagsToCreate.push({
          id: newTagId,
          user_id: userId,
          name: tagName,
          color: '#3b82f6', // Default blue color
          trackable: false,
          description: null,
          allowed_sections: ['events'],
          is_safe_only: false,
          is_system_category: false,
          created_at: now
        });
        finalTagMap.set(tagName, newTagId);
      } else if (typeof tagValue === 'string' && tagValue !== 'CREATE_NEW') {
        // Use provided tag ID
        finalTagMap.set(tagName, tagValue);
      }
    }

    // Insert new tags if any
    if (tagsToCreate.length > 0) {
      const { error: tagInsertError } = await client.from('myday_tags').insert(tagsToCreate);
      if (tagInsertError) {
        console.warn('Failed to insert new tags:', tagInsertError);
      }
    }

    // Convert imported events to database format
    const eventRows = fileData.events.map(ev => {
      // Resolve tag IDs from event tag names
      const resolvedTagIds = (ev.tags || [])
        .map(tagName => finalTagMap.get(tagName))
        .filter((id): id is string => !!id);

      return {
        id: generateUUID(),
        user_id: userId,
        name: ev.name,
        description: ev.description || null,
        category: ev.category || null,
        tags: resolvedTagIds,
        event_date: ev.date,
        date_text: ev.date,
        notify_days_before: ev.notifyDaysBefore || 0,
        color: ev.color || null,
        priority: ev.priority || 5,
        hide_from_dashboard: false,
        frequency: ev.frequency || 'yearly',
        custom_frequency: null,
        year: null,
        created_at: now
      };
    });

    // Insert events
    const { error: insertError } = await client
      .from('myday_events')
      .insert(eventRows);

    if (insertError) {
      console.error('Error inserting events:', insertError);
      return {
        success: false,
        message: `Failed to insert events: ${insertError.message}`,
        importedCount: 0
      };
    }

    // Generate reminders for events with notify_days_before
    for (const ev of eventRows) {
      if (ev.notify_days_before && ev.notify_days_before > 0) {
        try {
          const reminderEvent = {
            id: ev.id,
            name: ev.name,
            date: ev.event_date,
            frequency: ev.frequency as any,
            notifyDaysBefore: ev.notify_days_before || 0,
            createdAt: ev.created_at || now
          } as any;

          await generateEventReminders(reminderEvent, ev.id);
        } catch (remErr) {
          // Non-fatal reminder generation error
          console.warn('Failed to generate reminders for event:', ev.name, remErr);
        }
      }
    }

    return {
      success: true,
      message: `Successfully imported ${eventRows.length} events from ${fileData.description}`,
      importedCount: eventRows.length
    };
  } catch (err) {
    console.error('importEventsFromFile error:', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Unknown error occurred',
      importedCount: 0
    };
  }
};

/**
 * Get all unique tags from imported event file (without importing events)
 * Useful for showing user what tags will be created/used
 */
export const getEventFileTagPreview = async (fileUrl: string): Promise<string[]> => {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${fileUrl}`);
    }

    const fileData: ImportedEventFile = await response.json();
    
    if (!fileData.events || !Array.isArray(fileData.events)) {
      return [];
    }

    // Collect all unique tags from events
    const uniqueTags = new Set<string>();
    for (const event of fileData.events) {
      if (event.tags && Array.isArray(event.tags)) {
        for (const tag of event.tags) {
          uniqueTags.add(tag);
        }
      }
    }

    return Array.from(uniqueTags).sort();
  } catch (err) {
    console.error('getEventFileTagPreview error:', err);
    return [];
  }
};

