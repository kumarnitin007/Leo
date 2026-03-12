/**
 * Storage Events Module
 * 
 * Event CRUD operations and reminder generation
 */

import { Event } from '../types';
import { requireAuth, generateUUID, mapVoiceFieldsToDb, VoiceFields } from './core';

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
  
  await client
    .from('myday_notifybeforedays')
    .delete()
    .eq('event_id', eventId);
  
  const reminders: Array<{ reminder_date: string; days_until_event: number }> = [];
  
  if (event.frequency === 'yearly') {
    let month: number, day: number;
    const dateParts = event.date.split('-').map(Number);
    
    if (dateParts.length === 3) {
      [, month, day] = dateParts;
    } else if (dateParts.length === 2) {
      [month, day] = dateParts;
    } else {
      console.error('Invalid date format for yearly event:', event.date);
      return;
    }
    
    if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      console.error('Invalid month or day for yearly event:', event.date, 'month:', month, 'day:', day);
      return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    let eventDate = new Date(currentYear, month - 1, day);
    eventDate.setHours(0, 0, 0, 0);
    
    if (eventDate < today) {
      eventDate = new Date(currentYear + 1, month - 1, day);
      eventDate.setHours(0, 0, 0, 0);
    }
    
    for (let d = 1; d <= event.notifyDaysBefore; d++) {
      const reminderDate = new Date(eventDate);
      reminderDate.setDate(reminderDate.getDate() - d);
      const reminderDateStr = `${String(reminderDate.getMonth() + 1).padStart(2, '0')}-${String(reminderDate.getDate()).padStart(2, '0')}`;
      reminders.push({ reminder_date: reminderDateStr, days_until_event: d });
    }
  } else if (event.frequency === 'one-time') {
    const eventDate = new Date(event.date + 'T00:00:00');
    
    for (let d = 1; d <= event.notifyDaysBefore; d++) {
      const reminderDate = new Date(eventDate);
      reminderDate.setDate(reminderDate.getDate() - d);
      const reminderDateStr = reminderDate.toISOString().split('T')[0];
      reminders.push({ reminder_date: reminderDateStr, days_until_event: d });
    }
  }
  
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
    const eventDate = event.date_text || event.event_date;
    
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

  let normalizedDate = event.date;
  if (event.frequency === 'yearly') {
    const dateParts = event.date.split('-').map(Number);
    if (dateParts.length === 3) {
      const [, month, day] = dateParts;
      normalizedDate = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else if (dateParts.length === 2) {
      normalizedDate = event.date;
    }
  }

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
      date_text: normalizedDate,
      notify_days_before: event.notifyDaysBefore || 0,
      color: event.color,
      priority: event.priority || 5,
      hide_from_dashboard: event.hideFromDashboard || false,
      frequency: event.frequency || 'yearly',
      custom_frequency: event.customFrequency,
      year: event.year
    }]);

  if (error) throw error;
  
  if (event.notifyDaysBefore && event.notifyDaysBefore > 0) {
    const eventWithNormalizedDate = { ...event, date: normalizedDate };
    await generateEventReminders(eventWithNormalizedDate, eventId);
  }
};

export const updateEvent = async (eventId: string, updates: Partial<Event>): Promise<void> => {
  const { client } = await requireAuth();

  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;
  if (updates.category !== undefined) dbUpdates.category = updates.category;
  if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
  if (updates.date !== undefined) {
    dbUpdates.event_date = updates.date;
    dbUpdates.date_text = updates.date;
  }
  if (updates.notifyDaysBefore !== undefined) dbUpdates.notify_days_before = updates.notifyDaysBefore;
  if (updates.color !== undefined) dbUpdates.color = updates.color;
  if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
  if (updates.hideFromDashboard !== undefined) dbUpdates.hide_from_dashboard = updates.hideFromDashboard;
  if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency;
  if (updates.customFrequency !== undefined) dbUpdates.custom_frequency = updates.customFrequency;
  if (updates.year !== undefined) dbUpdates.year = updates.year;

  mapVoiceFieldsToDb(updates as VoiceFields, dbUpdates);

  const { error } = await client
    .from('myday_events')
    .update(dbUpdates)
    .eq('id', eventId);

  if (error) throw error;
  
  if (updates.date !== undefined || updates.notifyDaysBefore !== undefined || updates.frequency !== undefined) {
    const events = await getEvents();
    const fullEvent = events.find(e => e.id === eventId);
    if (fullEvent) {
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
