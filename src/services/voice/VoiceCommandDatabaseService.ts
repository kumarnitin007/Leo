/**
 * COPILOT PROMPT: Create VoiceCommandDatabaseService
 * 
 * PURPOSE: Handle all database operations for voice command logs
 * 
 * TABLE: myday_voice_command_logs
 * 
 * REQUIRED METHODS:
 * 
 * 1. saveCommand(commandData: Partial<VoiceCommandLog>): Promise<string>
 *    - Insert new voice command log into myday_voice_command_logs
 *    - Encrypt raw_transcript before saving (use simple base64 for now)
 *    - Set expires_at to 30 days from now
 *    - Set created_at and updated_at to NOW()
 *    - Return the new command id (UUID)
 *    - Handle errors gracefully
 * 
 * 2. getRecentCommands(userId: string, limit: number = 50): Promise<VoiceCommandLog[]>
 *    - SELECT from myday_voice_command_logs
 *    - WHERE user_id = userId AND expires_at > NOW()
 *    - ORDER BY created_at DESC
 *    - LIMIT limit
 *    - Decrypt raw_transcript before returning
 *    - Return empty array if none found
 * 
 * 3. getCommandById(commandId: string): Promise<VoiceCommandLog | null>
 *    - SELECT from myday_voice_command_logs WHERE id = commandId
 *    - Decrypt raw_transcript
 *    - Return null if not found
 * 
 * 4. updateCommand(commandId: string, updates: Partial<VoiceCommandLog>): Promise<void>
 *    - UPDATE myday_voice_command_logs
 *    - SET updated_at = NOW() automatically
 *    - WHERE id = commandId
 *    - Throw error if command not found
 * 
 * 5. undoCommand(commandId: string): Promise<void>
 *    - Get command by ID
 *    - Verify it has created_item_type and created_item_id
 *    - Update outcome to 'UNDONE'
 *    - Delete the created item from appropriate table (tasks/events/etc)
 *    - Log the undo in myday_voice_audit_logs
 *    - Handle errors if item already deleted
 * 
 * 6. learnFromCorrection(
 *      userId: string, 
 *      phrasePattern: string,
 *      mapsToEntityType: string,
 *      mapsToValue: string
 *    ): Promise<void>
 *    - INSERT INTO myday_user_voice_patterns
 *    - ON CONFLICT (user_id, phrase_pattern, maps_to_entity_type)
 *      DO UPDATE SET frequency_count = frequency_count + 1
 *    - Update confidence_score based on frequency
 *    - Set auto_apply = true if frequency_count >= 3
 * 
 * 7. getUserPatterns(userId: string): Promise<UserVoicePattern[]>
 *    - SELECT from myday_user_voice_patterns
 *    - WHERE user_id = userId
 *    - ORDER BY confidence_score DESC, frequency_count DESC
 * 
 * 8. purgeExpired(): Promise<number>
 *    - DELETE FROM myday_voice_command_logs
 *    - WHERE expires_at < NOW()
 *    - RETURN count of deleted rows
 * 
 * 9. searchCommands(
 *      userId: string,
 *      query: string,
 *      filters?: {
 *        intentType?: string;
 *        entityType?: string;
 *        dateFrom?: Date;
 *        dateTo?: Date;
 *        outcome?: string;
 *      }
 *    ): Promise<VoiceCommandLog[]>
 *    - Search using search_keywords GIN index
 *    - Apply filters if provided
 *    - Return matching commands
 * 
 * 10. logAnalytics(commandLog: VoiceCommandLog): Promise<void>
 *     - Anonymize data (hash user_id)
 *     - INSERT INTO myday_voice_command_analytics
 *     - Aggregate by date and hour
 * 
 * IMPLEMENTATION NOTES:
 * - Use YOUR existing database client (Supabase/Prisma/TypeORM/raw SQL)
 * - Import VoiceCommandLog types from '../types/voice-command-db.types'
 * - Use transactions where appropriate (especially for undo)
 * - Add proper error handling with try/catch
 * - Log errors but don't expose sensitive data
 * - Use parameterized queries to prevent SQL injection
 * 
 * ENCRYPTION HELPERS:
 * - encryptTranscript(text: string): string - Use Buffer.from(text).toString('base64')
 * - decryptTranscript(encrypted: string): string - Use Buffer.from(encrypted, 'base64').toString('utf-8')
 * 
 * EXAMPLE USAGE:
 * const dbService = new VoiceCommandDatabaseService();
 * const commandId = await dbService.saveCommand({
 *   userId: 'user-123',
 *   rawTranscript: 'add task buy groceries',
 *   intentType: 'CREATE_TASK',
 *   entityType: 'TASK',
 *   outcome: 'SUCCESS'
 * });
 */

import { getSupabaseClient } from '../../lib/supabase';
import {
  VoiceCommandLog,
  VoiceCommandLogInsert,
  VoiceCommandLogUpdate,
  Entity,
  UserCorrection,
  UserCorrection as UserCorrectionType,
} from '../../types/voice-command-db.types';

/**
 * Simple base64 helpers that work in both browser and Node-like environments
 */
const encryptTranscript = (text: string): string => {
  try {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      return window.btoa(text);
    }
    // Node-friendly fallback using global Buffer if available
    const BufferCtor: any = (globalThis as any).Buffer;
    if (BufferCtor && typeof BufferCtor.from === 'function') {
      return BufferCtor.from(text).toString('base64');
    }
    throw new Error('No base64 encoder available');
  } catch (err) {
    console.error('encryptTranscript error', err);
    return text;
  }
};

const decryptTranscript = (encrypted: string): string => {
  try {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return window.atob(encrypted);
    }
    // Node-friendly fallback using global Buffer if available
    const BufferCtor: any = (globalThis as any).Buffer;
    if (BufferCtor && typeof BufferCtor.from === 'function') {
      return BufferCtor.from(encrypted, 'base64').toString('utf-8');
    }
    throw new Error('No base64 decoder available');
  } catch (err) {
    console.error('decryptTranscript error', err);
    return encrypted;
  }
};

/**
 * Helper: map DB row (snake_case) to VoiceCommandLog (camelCase)
 */
const mapRowToVoiceCommandLog = (row: any): VoiceCommandLog => {
  return {
    id: row.id,
    userId: row.user_id || null,
    sessionId: row.session_id,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    expiresAt: row.expires_at || new Date().toISOString(),
    rawTranscript: row.raw_transcript_encrypted ? decryptTranscript(row.raw_transcript) : row.raw_transcript,
    rawTranscriptEncrypted: !!row.raw_transcript_encrypted,
    language: row.language,
    intentType: row.intent_type,
    intentConfidence: row.intent_confidence === null ? undefined : Number(row.intent_confidence),
    intentMethod: row.intent_method,
    intentAlternatives: row.intent_alternatives,
    entityType: row.entity_type,
    entities: (row.entities || []) as Entity[],
    memoDate: row.memo_date || null,
    memoDateExpression: row.memo_date_expression,
    memoTime: row.memo_time,
    memoTimeExpression: row.memo_time_expression,
    allDayEvent: !!row.all_day_event,
    extractedTitle: row.extracted_title,
    extractedPriority: row.extracted_priority,
    extractedTags: row.extracted_tags || [],
    extractedRecurrence: row.extracted_recurrence,
    extractedRecurrenceHuman: row.extracted_recurrence_human,
    extractedDuration: row.extracted_duration,
    extractedLocation: row.extracted_location,
    extractedAttendees: row.extracted_attendees || [],
    processingDurationMs: row.processing_duration_ms,
    overallConfidence: row.overall_confidence === null ? undefined : Number(row.overall_confidence),
    confidenceBreakdown: row.confidence_breakdown,
    isValid: !!row.is_valid,
    missingFields: row.missing_fields || [],
    validationErrors: row.validation_errors || [],
    needsUserInput: !!row.needs_user_input,
    userCorrections: row.user_corrections || [],
    confirmationShown: !!row.confirmation_shown,
    userConfirmed: !!row.user_confirmed,
    userEdited: !!row.user_edited,
    outcome: row.outcome,
    failureReason: row.failure_reason,
    retryCount: row.retry_count,
    createdItemType: row.created_item_type,
    createdItemId: row.created_item_id ? String(row.created_item_id) : null,
    createdItemData: row.created_item_data,
    fuzzyMatchUsed: !!row.fuzzy_match_used,
    fuzzyMatchScore: row.fuzzy_match_score === null ? undefined : Number(row.fuzzy_match_score),
    searchKeywords: row.search_keywords || [],
    contextData: row.context_data,
    learnedFromHistory: !!row.learned_from_history,
    userPatternMatched: !!row.user_pattern_matched,
    customVocabularyUsed: row.custom_vocabulary_used || [],
    deviceType: row.device_type,
    deviceOs: row.device_os,
    appVersion: row.app_version,
    modelVersion: row.model_version,
    containsPii: !!row.contains_pii,
    anonymized: !!row.anonymized,
  };
};

/**
 * VoiceCommandDatabaseService
 */
export class VoiceCommandDatabaseService {
  private tableName = 'myday_voice_command_logs';
  private patternsTable = 'myday_user_voice_patterns';
  private analyticsTable = 'myday_voice_command_analytics';
  private auditTable = 'myday_voice_audit_logs';

  constructor() {}

  /** Insert new voice command log and return id */
  async saveCommand(commandData: Partial<VoiceCommandLog> | VoiceCommandLogInsert): Promise<string> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const encrypted = encryptTranscript(String(commandData.rawTranscript || ''));
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

      const row: any = {
        user_id: (commandData as any).userId || null,
        session_id: (commandData as any).sessionId || undefined,
        raw_transcript: encrypted,
        raw_transcript_encrypted: true,
        language: (commandData as any).language || 'en-US',
        intent_type: (commandData as any).intentType,
        intent_confidence: (commandData as any).intentConfidence,
        intent_method: (commandData as any).intentMethod,
        intent_alternatives: (commandData as any).intentAlternatives,
        entity_type: (commandData as any).entityType,
        entities: (commandData as any).entities || [],
        memo_date: (commandData as any).memoDate ? new Date((commandData as any).memoDate).toISOString() : null,
        memo_date_expression: (commandData as any).memoDateExpression,
        memo_time: (commandData as any).memoTime,
        memo_time_expression: (commandData as any).memoTimeExpression,
        all_day_event: (commandData as any).allDayEvent || false,
        extracted_title: (commandData as any).extractedTitle,
        extracted_priority: (commandData as any).extractedPriority,
        extracted_tags: (commandData as any).extractedTags || [],
        extracted_recurrence: (commandData as any).extractedRecurrence,
        extracted_recurrence_human: (commandData as any).extractedRecurrenceHuman,
        extracted_duration: (commandData as any).extractedDuration,
        extracted_location: (commandData as any).extractedLocation,
        extracted_attendees: (commandData as any).extractedAttendees || [],
        created_item_type: (commandData as any).createdItemType,
        created_item_id: (commandData as any).createdItemId || null,
        created_item_data: (commandData as any).createdItemData,
        expires_at: expiresAt,
      };

      const { data, error } = await client
        .from(this.tableName)
        .insert(row)
        .select('id')
        .single();

      if (error) {
        console.error('saveCommand error', error);
        throw error;
      }

      return data.id;
    } catch (err: any) {
      console.error('saveCommand failed', err);
      throw err;
    }
  }

  /** Get recent commands for a user */
  async getRecentCommands(userId: string, limit = 50): Promise<VoiceCommandLog[]> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      console.log('getRecentCommands called with userId:', userId);
      
      const { data, error } = await client
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      console.log('getRecentCommands result:', { data, error, count: data?.length });

      if (error) {
        console.error('getRecentCommands error', error);
        return [];
      }

      return (data || []).map(mapRowToVoiceCommandLog);
    } catch (err) {
      console.error('getRecentCommands failed', err);
      return [];
    }
  }

  /** Get a command by id */
  async getCommandById(commandId: string): Promise<VoiceCommandLog | null> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const { data, error } = await client
        .from(this.tableName)
        .select('*')
        .eq('id', commandId)
        .maybeSingle();

      if (error) {
        console.error('getCommandById error', error);
        return null;
      }

      if (!data) return null;
      return mapRowToVoiceCommandLog(data);
    } catch (err) {
      console.error('getCommandById failed', err);
      return null;
    }
  }

  /** Update a command row */
  async updateCommand(commandId: string, updates: Partial<VoiceCommandLog>): Promise<void> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const payload: any = { updated_at: new Date().toISOString() };

      if (updates.rawTranscript !== undefined) {
        payload.raw_transcript = encryptTranscript(String(updates.rawTranscript || ''));
        payload.raw_transcript_encrypted = true;
      }

      // Map known camelCase keys to snake_case
      const mapping: Record<string, string> = {
        intentType: 'intent_type',
        intentConfidence: 'intent_confidence',
        intentMethod: 'intent_method',
        entityType: 'entity_type',
        entities: 'entities',
        memoDate: 'memo_date',
        memoDateExpression: 'memo_date_expression',
        memoTime: 'memo_time',
        memoTimeExpression: 'memo_time_expression',
        allDayEvent: 'all_day_event',
        extractedTitle: 'extracted_title',
        extractedPriority: 'extracted_priority',
        extractedTags: 'extracted_tags',
        extractedRecurrence: 'extracted_recurrence',
        extractedRecurrenceHuman: 'extracted_recurrence_human',
        extractedDuration: 'extracted_duration',
        extractedLocation: 'extracted_location',
        extractedAttendees: 'extracted_attendees',
        overallConfidence: 'overall_confidence',
        confidenceBreakdown: 'confidence_breakdown',
        isValid: 'is_valid',
        missingFields: 'missing_fields',
        validationErrors: 'validation_errors',
        needsUserInput: 'needs_user_input',
        userCorrections: 'user_corrections',
        confirmationShown: 'confirmation_shown',
        userConfirmed: 'user_confirmed',
        userEdited: 'user_edited',
        outcome: 'outcome',
        failureReason: 'failure_reason',
        retryCount: 'retry_count',
        createdItemType: 'created_item_type',
        createdItemId: 'created_item_id',
        createdItemData: 'created_item_data',
        fuzzyMatchUsed: 'fuzzy_match_used',
        fuzzyMatchScore: 'fuzzy_match_score',
        searchKeywords: 'search_keywords',
        contextData: 'context_data',
        learnedFromHistory: 'learned_from_history',
        userPatternMatched: 'user_pattern_matched',
        customVocabularyUsed: 'custom_vocabulary_used',
        deviceType: 'device_type',
        deviceOs: 'device_os',
        appVersion: 'app_version',
        modelVersion: 'model_version',
        containsPii: 'contains_pii',
        anonymized: 'anonymized',
      };

      for (const [k, v] of Object.entries(updates as any)) {
        if (k === 'rawTranscript') continue; // handled above
        if ((mapping as any)[k]) {
          payload[(mapping as any)[k]] = (updates as any)[k];
        } else if (k === 'userId') {
          payload['user_id'] = (updates as any).userId;
        } else if (k === 'sessionId') {
          payload['session_id'] = (updates as any).sessionId;
        } else if (k === 'language') {
          payload['language'] = (updates as any).language;
        } else {
          // allow unknown fields to be set directly
          payload[k] = (updates as any)[k];
        }
      }

      const { error } = await client
        .from(this.tableName)
        .update(payload)
        .eq('id', commandId);

      if (error) {
        console.error('updateCommand error', error);
        throw error;
      }
    } catch (err) {
      console.error('updateCommand failed', err);
      throw err;
    }
  }

  /** Undo a command: delete created item and mark command UNDONE */
  async undoCommand(commandId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const cmd = await this.getCommandById(commandId);
      if (!cmd) throw new Error('Command not found');
      if (!cmd.createdItemType || !cmd.createdItemId) {
        throw new Error('No created item associated with this command');
      }

      const tableMap: Record<string, string> = {
        TASK: 'tasks',
        EVENT: 'events',
        JOURNAL: 'journal_entries',
        ROUTINE: 'routines',
        ITEM: 'items',
        MILESTONE: 'milestones',
      };

      const table = tableMap[(cmd.createdItemType || '').toUpperCase()] || (cmd.createdItemType as string);

      const trx = client;

      // Attempt to delete the created item
      const { data: deleted, error: delErr } = await trx
        .from(table)
        .delete()
        .eq('id', cmd.createdItemId)
        .select('*');

      if (delErr) {
        // If item not found, still mark command as UNDONE but log the failure
        console.warn('undoCommand: delete error', delErr);
      }

      // Update the command outcome
      await this.updateCommand(commandId, { outcome: 'UNDONE' as any, userEdited: true });

      // Record audit
      const auditRow = {
        action_type: 'UNDO_COMMAND',
        user_id: cmd.userId || null,
        session_id: cmd.sessionId,
        metadata: {
          commandId,
          createdItemType: cmd.createdItemType,
          createdItemId: cmd.createdItemId,
          deleted: Array.isArray(deleted) ? deleted.length > 0 : !!deleted,
        },
      };

      const { error: auditErr } = await trx.from(this.auditTable).insert(auditRow);
      if (auditErr) console.error('undoCommand audit insert error', auditErr);
    } catch (err) {
      console.error('undoCommand failed', err);
      throw err;
    }
  }

  /** Learn from a user correction: upsert into patterns and increment frequency */
  async learnFromCorrection(
    userId: string,
    phrasePattern: string,
    mapsToEntityType: string,
    mapsToValue: string
  ): Promise<void> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      // Check existing
      const { data: existing, error: selErr } = await client
        .from(this.patternsTable)
        .select('*')
        .eq('user_id', userId)
        .eq('phrase_pattern', phrasePattern)
        .eq('maps_to_entity_type', mapsToEntityType)
        .maybeSingle();

      if (selErr) {
        console.error('learnFromCorrection select error', selErr);
        throw selErr;
      }

      if (!existing) {
        const insertRow = {
          user_id: userId,
          phrase_pattern: phrasePattern,
          normalized_phrase: mapsToValue,
          maps_to_entity_type: mapsToEntityType,
          maps_to_value: mapsToValue,
          frequency_count: 1,
          confidence_score: 0.5,
          auto_apply: false,
        };
        const { error: insErr } = await client.from(this.patternsTable).insert(insertRow);
        if (insErr) throw insErr;
        return;
      }

      // Update frequency and confidence
      const newFreq = (existing.frequency_count || 0) + 1;
      const newConfidence = Math.min(1, (existing.confidence_score || 0.5) + 0.05);
      const autoApply = newFreq >= 3;

      const { error: updErr } = await client
        .from(this.patternsTable)
        .update({ frequency_count: newFreq, confidence_score: newConfidence, auto_apply: autoApply, last_used_at: new Date().toISOString() })
        .eq('id', existing.id);

      if (updErr) throw updErr;
    } catch (err) {
      console.error('learnFromCorrection failed', err);
      throw err;
    }
  }

  /** Get user patterns ordered by confidence and frequency */
  async getUserPatterns(userId: string): Promise<any[]> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const { data, error } = await client
        .from(this.patternsTable)
        .select('*')
        .eq('user_id', userId)
        .order('confidence_score', { ascending: false })
        .order('frequency_count', { ascending: false });

      if (error) {
        console.error('getUserPatterns error', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('getUserPatterns failed', err);
      return [];
    }
  }

  /** Purge expired voice command logs */
  async purgeExpired(): Promise<number> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const { data, error } = await client
        .from(this.tableName)
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (error) {
        console.error('purgeExpired error', error);
        return 0;
      }

      return Array.isArray(data) ? data.length : 0;
    } catch (err) {
      console.error('purgeExpired failed', err);
      return 0;
    }
  }

  /** Search commands for a user with basic filters */
  async searchCommands(
    userId: string,
    query: string,
    filters?: {
      intentType?: string;
      entityType?: string;
      dateFrom?: Date;
      dateTo?: Date;
      outcome?: string;
    }
  ): Promise<VoiceCommandLog[]> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      let q = client.from(this.tableName).select('*').eq('user_id', userId);

      if (filters?.intentType) q = q.eq('intent_type', filters.intentType);
      if (filters?.entityType) q = q.eq('entity_type', filters.entityType);
      if (filters?.dateFrom) q = q.gte('memo_date', (filters.dateFrom as Date).toISOString().slice(0, 10));
      if (filters?.dateTo) q = q.lte('memo_date', (filters.dateTo as Date).toISOString().slice(0, 10));
      if (filters?.outcome) q = q.eq('outcome', filters.outcome);

      // Basic full-text strategy: ilike on raw_transcript and extracted_title
      q = (q as any).or(`raw_transcript.ilike.%${query}%,extracted_title.ilike.%${query}%`);

      const { data, error } = await q.order('created_at', { ascending: false }).limit(100);
      if (error) {
        console.error('searchCommands error', error);
        return [];
      }

      return (data || []).map(mapRowToVoiceCommandLog);
    } catch (err) {
      console.error('searchCommands failed', err);
      return [];
    }
  }

  /** Log analytics (simple aggregation insert/update) */
  async logAnalytics(commandLog: VoiceCommandLog): Promise<void> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      // Simple anonymization for demo: prefix + first 8 chars
      const userHash = commandLog.userId ? `hash_${String(commandLog.userId).slice(0, 8)}` : 'anon';

      const createdAtDate = commandLog.createdAt ? new Date(commandLog.createdAt) : new Date();
      const date = createdAtDate.toISOString().slice(0, 10);
      const hour = createdAtDate.getHours();

      // Upsert a single daily/hourly aggregate (increment counters)
      // Simple approach: attempt select then insert/update
      const { data: existing, error: selErr } = await client
        .from(this.analyticsTable)
        .select('*')
        .eq('user_hash', userHash)
        .eq('intent_type', commandLog.intentType)
        .eq('date', date)
        .eq('hour_of_day', hour)
        .maybeSingle();

      if (selErr) {
        console.error('logAnalytics select error', selErr);
        return;
      }

      if (!existing) {
        const insertRow = {
          user_hash: userHash,
          intent_type: commandLog.intentType,
          entity_type: commandLog.entityType || null,
          success_rate: commandLog.outcome === 'SUCCESS' ? 1 : 0,
          average_confidence: commandLog.overallConfidence || null,
          average_processing_time_ms: commandLog.processingDurationMs || null,
          common_errors: commandLog.outcome === 'FAILED' ? [{ reason: commandLog.failureReason }] : null,
          date,
          hour_of_day: hour,
          total_commands: 1,
          successful_commands: commandLog.outcome === 'SUCCESS' ? 1 : 0,
          failed_commands: commandLog.outcome === 'FAILED' ? 1 : 0,
          cancelled_commands: commandLog.outcome === 'CANCELLED' ? 1 : 0,
        };

        const { error: insErr } = await client.from(this.analyticsTable).insert(insertRow);
        if (insErr) console.error('logAnalytics insert error', insErr);
        return;
      }

      // Update existing aggregate
      const updatedRow: any = {
        total_commands: (existing.total_commands || 0) + 1,
      };
      if (commandLog.outcome === 'SUCCESS') updatedRow.successful_commands = (existing.successful_commands || 0) + 1;
      if (commandLog.outcome === 'FAILED') updatedRow.failed_commands = (existing.failed_commands || 0) + 1;
      if (commandLog.outcome === 'CANCELLED') updatedRow.cancelled_commands = (existing.cancelled_commands || 0) + 1;

      // Recompute average confidence (simple running average)
      if (commandLog.overallConfidence != null) {
        const prevCount = existing.total_commands || 0;
        const prevAvg = existing.average_confidence || 0;
        const newAvg = (prevAvg * prevCount + (commandLog.overallConfidence || 0)) / (prevCount + 1);
        updatedRow.average_confidence = newAvg;
      }

      const { error: updErr } = await client
        .from(this.analyticsTable)
        .update(updatedRow)
        .eq('id', existing.id);

      if (updErr) console.error('logAnalytics update error', updErr);
    } catch (err) {
      console.error('logAnalytics failed', err);
    }
  }
}

export default new VoiceCommandDatabaseService();


