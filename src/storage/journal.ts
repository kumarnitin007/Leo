/**
 * Storage Journal Module
 * 
 * Journal Entry CRUD operations
 */

import { JournalEntry } from '../types';
import { requireAuth, generateUUID } from './core';

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
    isFavorite: entry.is_favorite || false,
    createdViaVoice: entry.created_via_voice || false,
    voiceCommandId: entry.voice_command_id,
    voiceConfidence: entry.voice_confidence,
    createdAt: entry.created_at || new Date().toISOString(),
    updatedAt: entry.updated_at || new Date().toISOString()
  }));
};

export const saveJournalEntry = async (entry: JournalEntry): Promise<void> => {
  const { client, userId } = await requireAuth();

  const { data: existing } = await client
    .from('myday_journal_entries')
    .select('id, content, created_via_voice')
    .eq('user_id', userId)
    .eq('entry_date', entry.date)
    .maybeSingle();

  if (existing) {
    let newContent = entry.content;
    if (entry.createdViaVoice && existing.content && existing.content.trim()) {
      newContent = existing.content + '\n\n---\n\n' + entry.content;
    }

    const { error } = await client
      .from('myday_journal_entries')
      .update({
        content: newContent,
        mood: entry.mood || null,
        tags: entry.tags || [],
        created_via_voice: entry.createdViaVoice || existing.created_via_voice || false,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (error) throw error;
  } else {
    const now = new Date().toISOString();
    const insertData = {
      id: entry.id || generateUUID(),
      user_id: userId,
      entry_date: entry.date,
      content: entry.content || '',
      mood: entry.mood || null,
      tags: entry.tags || [],
      created_via_voice: entry.createdViaVoice || false,
      created_at: now,
      updated_at: now
    };
    
    const { error } = await client
      .from('myday_journal_entries')
      .insert(insertData);

    if (error) {
      console.error('Journal insert error:', error, 'Data:', insertData);
      throw error;
    }
  }
};

export const updateJournalEntry = async (entryId: string, updates: Partial<JournalEntry>): Promise<void> => {
  const { client } = await requireAuth();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  };

  if (updates.content !== undefined) updateData.content = updates.content;
  if (updates.mood !== undefined) updateData.mood = updates.mood;
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

export const getJournalEntryByDate = async (date: string): Promise<JournalEntry | null> => {
  const entries = await getJournalEntries();
  return entries.find(e => e.date === date) || null;
};
