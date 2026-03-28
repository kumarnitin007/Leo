/**
 * Storage Journal Module
 * 
 * Journal Entry CRUD operations.
 * Supports multiple entries per day (each with its own id).
 */

import { JournalEntry } from '../types';
import { requireAuth, generateUUID } from './core';

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function mapRow(entry: any): JournalEntry {
  return {
    id: entry.id,
    date: entry.entry_date,
    content: entry.content,
    mood: entry.mood,
    energyLevel: entry.energy_level ?? undefined,
    weather: entry.weather ?? undefined,
    activity: entry.activity ?? undefined,
    location: entry.location ?? undefined,
    wordCount: entry.word_count ?? undefined,
    entryTime: entry.entry_time ?? undefined,
    tags: entry.tags || [],
    isFavorite: entry.is_favorite || false,
    createdViaVoice: entry.created_via_voice || false,
    voiceCommandId: entry.voice_command_id,
    voiceConfidence: entry.voice_confidence,
    createdAt: entry.created_at || new Date().toISOString(),
    updatedAt: entry.updated_at || new Date().toISOString(),
  };
}

// ===== JOURNAL ENTRIES =====

export const getJournalEntries = async (): Promise<JournalEntry[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_journal_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching journal entries:', error);
    return [];
  }

  return (data || []).map(mapRow);
};

/**
 * Get all entries for a specific date (supports multiple per day).
 */
export const getJournalEntriesForDate = async (date: string): Promise<JournalEntry[]> => {
  const { client, userId } = await requireAuth();

  const { data, error } = await client
    .from('myday_journal_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('entry_date', date)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching journal entries for date:', error);
    return [];
  }
  return (data || []).map(mapRow);
};

/**
 * Save a new journal entry (always creates a new row).
 */
export const saveJournalEntry = async (entry: JournalEntry): Promise<JournalEntry> => {
  const { client, userId } = await requireAuth();

  const now = new Date().toISOString();
  const id = entry.id || generateUUID();
  const wc = countWords(entry.content);
  const time = entry.entryTime || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const insertData: Record<string, unknown> = {
    id,
    user_id: userId,
    entry_date: entry.date,
    content: entry.content || '',
    mood: entry.mood || null,
    energy_level: entry.energyLevel ?? null,
    weather: entry.weather ?? null,
    activity: entry.activity?.length ? entry.activity : null,
    location: entry.location ?? null,
    word_count: wc,
    entry_time: time,
    tags: entry.tags || [],
    is_favorite: entry.isFavorite || false,
    created_via_voice: entry.createdViaVoice || false,
    created_at: entry.createdAt || now,
    updated_at: now,
  };
  if (entry.voiceCommandId) insertData.voice_command_id = entry.voiceCommandId;
  if (entry.voiceConfidence) insertData.voice_confidence = entry.voiceConfidence;

  const { error } = await client
    .from('myday_journal_entries')
    .insert(insertData);

  if (error) {
    console.error('Journal insert error:', error, 'Data:', insertData);
    throw error;
  }

  return { ...entry, id, wordCount: wc, entryTime: time, updatedAt: now };
};

export const updateJournalEntry = async (entryId: string, updates: Partial<JournalEntry>): Promise<void> => {
  const { client } = await requireAuth();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.content !== undefined) {
    updateData.content = updates.content;
    updateData.word_count = countWords(updates.content);
  }
  if (updates.mood !== undefined) updateData.mood = updates.mood;
  if (updates.energyLevel !== undefined) updateData.energy_level = updates.energyLevel;
  if (updates.weather !== undefined) updateData.weather = updates.weather;
  if (updates.activity !== undefined) updateData.activity = updates.activity?.length ? updates.activity : null;
  if (updates.location !== undefined) updateData.location = updates.location;
  if (updates.entryTime !== undefined) updateData.entry_time = updates.entryTime;
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.isFavorite !== undefined) updateData.is_favorite = updates.isFavorite;
  if (updates.createdViaVoice !== undefined) updateData.created_via_voice = updates.createdViaVoice;
  if (updates.voiceCommandId !== undefined) updateData.voice_command_id = updates.voiceCommandId;
  if (updates.voiceConfidence !== undefined) updateData.voice_confidence = updates.voiceConfidence;

  const { error } = await client
    .from('myday_journal_entries')
    .update(updateData)
    .eq('id', entryId);

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

/**
 * Legacy compat: returns the first entry for a date.
 * New code should use getJournalEntriesForDate() instead.
 */
export const getJournalEntryByDate = async (date: string): Promise<JournalEntry | null> => {
  const entries = await getJournalEntriesForDate(date);
  return entries[0] || null;
};
