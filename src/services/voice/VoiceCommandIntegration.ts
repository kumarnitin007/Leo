/**
 * COPILOT PROMPT: Create integration helper for linking voice commands to created items
 * 
 * PURPOSE: Link voice commands to tasks/events/journals after creation
 * 
 * REQUIREMENTS:
 * 
 * Create helper functions to:
 * 
 * 1. linkVoiceCommandToTask(
 *      taskId: string,
 *      voiceCommandId: string,
 *      confidence: number
 *    ): Promise<void>
 *    - UPDATE tasks table
 *    - SET created_via_voice = true
 *    - SET voice_command_id = voiceCommandId
 *    - SET voice_confidence = confidence
 * 
 * 2. linkVoiceCommandToEvent(
 *      eventId: string,
 *      voiceCommandId: string,
 *      confidence: number
 *    ): Promise<void>
 *    - Same as above for events table
 * 
 * 3. linkVoiceCommandToJournal(...)
 * 4. linkVoiceCommandToRoutine(...)
 * 5. linkVoiceCommandToMilestone(...)
 * 6. linkVoiceCommandToItem(...)
 * 
 * 7. getVoiceCommandForItem(
 *      itemType: string,
 *      itemId: string
 *    ): Promise<VoiceCommandLog | null>
 *    - Get the voice command that created this item
 *    - Join tasks/events/etc with voice_command_logs
 *    - Return the command log
 * 
 * 8. undoVoiceCreatedItem(
 *      itemType: string,
 *      itemId: string
 *    ): Promise<void>
 *    - Get voice_command_id from item
 *    - Delete the item
 *    - Update voice command outcome to 'UNDONE'
 *    - Log the undo action
 * 
 * 9. markAsEdited(
 *      itemType: string,
 *      itemId: string
 *    ): Promise<void>
 *    - SET voice_user_edited = true
 *    - Update voice command log with user_edited = true
 * 
 * EXAMPLE USAGE:
 * // After creating a task via voice:
 * const task = await createTask(taskData);
 * await linkVoiceCommandToTask(task.id, commandLog.id, 0.92);
 * 
 * // When user undoes:
 * await undoVoiceCreatedItem('task', taskId);
 * 
 * // Check if item was voice-created:
 * const command = await getVoiceCommandForItem('task', taskId);
 * if (command) {
 *   console.log(`Created via voice: "${command.rawTranscript}"`);
 * }
 */

import { getSupabaseClient } from '../../lib/supabase';
import dbService from './VoiceCommandDatabaseService';
import { VoiceCommandLog } from '../../types/voice-command-db.types';

/** Map high-level item type to database table name */
const tableForItemType = (itemType: string): string => {
  const t = (itemType || '').toLowerCase();
  switch (t) {
    case 'task':
    case 'tasks':
      return 'myday_tasks';
    case 'event':
    case 'events':
      return 'myday_events';
    case 'journal':
    case 'journal_entry':
    case 'journal_entries':
      return 'myday_journal_entries';
    case 'routine':
    case 'routines':
      return 'myday_routines';
    case 'milestone':
    case 'milestones':
      return 'myday_milestones';
    case 'item':
    case 'items':
      return 'myday_items';
    default:
      return t; // assume caller passed correct table name
  }
};

/**
 * Link a voice command to a task by updating the task record with voice metadata.
 */
export async function linkVoiceCommandToTask(taskId: string, voiceCommandId: string, confidence: number): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  try {
    const { error } = await client
      .from('myday_tasks')
      .update({ created_via_voice: true, voice_command_id: voiceCommandId, voice_confidence: confidence })
      .eq('id', taskId);

    if (error) throw error;
  } catch (err) {
    console.error('linkVoiceCommandToTask failed', err);
    throw err;
  }
}

/**
 * Link a voice command to an event by updating the event record with voice metadata.
 */
export async function linkVoiceCommandToEvent(eventId: string, voiceCommandId: string, confidence: number): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  try {
    const { error } = await client
      .from('myday_events')
      .update({ created_via_voice: true, voice_command_id: voiceCommandId, voice_confidence: confidence })
      .eq('id', eventId);

    if (error) throw error;
  } catch (err) {
    console.error('linkVoiceCommandToEvent failed', err);
    throw err;
  }
}

/**
 * Generic link function for journals, routines, milestones, items.
 */
async function linkGeneric(table: string, id: string, voiceCommandId: string, confidence: number): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  try {
    const { error } = await client
      .from(table)
      .update({ created_via_voice: true, voice_command_id: voiceCommandId, voice_confidence: confidence })
      .eq('id', id);

    if (error) throw error;
  } catch (err) {
    console.error(`linkGeneric(${table}) failed`, err);
    throw err;
  }
}

export async function linkVoiceCommandToJournal(journalId: string, voiceCommandId: string, confidence: number): Promise<void> {
  return linkGeneric('myday_journal_entries', journalId, voiceCommandId, confidence);
}

export async function linkVoiceCommandToRoutine(routineId: string, voiceCommandId: string, confidence: number): Promise<void> {
  return linkGeneric('myday_routines', routineId, voiceCommandId, confidence);
}

export async function linkVoiceCommandToMilestone(milestoneId: string, voiceCommandId: string, confidence: number): Promise<void> {
  return linkGeneric('myday_milestones', milestoneId, voiceCommandId, confidence);
}

export async function linkVoiceCommandToItem(itemId: string, voiceCommandId: string, confidence: number): Promise<void> {
  return linkGeneric('myday_items', itemId, voiceCommandId, confidence);
}

/**
 * Find the voice command log that created the given item (if any).
 * Returns the VoiceCommandLog or null.
 */
export async function getVoiceCommandForItem(itemType: string, itemId: string): Promise<VoiceCommandLog | null> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const table = tableForItemType(itemType);

  try {
    const { data: item, error: itemErr } = await client
      .from(table)
      .select('voice_command_id')
      .eq('id', itemId)
      .maybeSingle();

    if (itemErr) {
      console.error('getVoiceCommandForItem: fetch item error', itemErr);
      return null;
    }

    const voiceCommandId = (item as any)?.voice_command_id;
    if (!voiceCommandId) return null;

    const cmd = await dbService.getCommandById(voiceCommandId);
    return cmd;
  } catch (err) {
    console.error('getVoiceCommandForItem failed', err);
    return null;
  }
}

/**
 * Undo a voice-created item: delete the item and mark the voice command as UNDONE.
 */
export async function undoVoiceCreatedItem(itemType: string, itemId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const table = tableForItemType(itemType);

  try {
    // Get voice_command_id before deletion
    const { data: item, error: itemErr } = await client
      .from(table)
      .select('voice_command_id')
      .eq('id', itemId)
      .maybeSingle();

    if (itemErr) throw itemErr;

    const voiceCommandId = (item as any)?.voice_command_id;

    // Delete item
    const { error: delErr } = await client
      .from(table)
      .delete()
      .eq('id', itemId);

    if (delErr) throw delErr;

    // Update voice command outcome
    if (voiceCommandId) {
      await dbService.updateCommand(voiceCommandId, { outcome: 'UNDONE' as any, userEdited: true });
      // Audit
      await client.from('myday_voice_audit_logs').insert([{ action_type: 'UNDO_VOICE_CREATED_ITEM', metadata: { itemType, itemId, voiceCommandId }, timestamp: new Date().toISOString() }]);
    }
  } catch (err) {
    console.error('undoVoiceCreatedItem failed', err);
    throw err;
  }
}

/**
 * Mark an item as edited by the user and update the related voice command log.
 */
export async function markAsEdited(itemType: string, itemId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const table = tableForItemType(itemType);

  try {
    // Update the item
    const { error: updErr } = await client
      .from(table)
      .update({ voice_user_edited: true })
      .eq('id', itemId);

    if (updErr) throw updErr;

    // Find associated command and set user_edited
    const cmd = await getVoiceCommandForItem(itemType, itemId);
    if (cmd) {
      await dbService.updateCommand(cmd.id, { userEdited: true });
    }
  } catch (err) {
    console.error('markAsEdited failed', err);
    throw err;
  }
}

export default {
  linkVoiceCommandToTask,
  linkVoiceCommandToEvent,
  linkVoiceCommandToJournal,
  linkVoiceCommandToRoutine,
  linkVoiceCommandToMilestone,
  linkVoiceCommandToItem,
  getVoiceCommandForItem,
  undoVoiceCreatedItem,
  markAsEdited,
};

