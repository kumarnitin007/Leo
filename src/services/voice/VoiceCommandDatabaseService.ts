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
 * UTF-8-safe base64 encode (btoa only supports Latin1; transcript may contain Unicode).
 * Uses unescape(encodeURIComponent(text)) to get a UTF-8 byte string, then btoa.
 */
const encryptTranscript = (text: string): string => {
  try {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      return window.btoa(unescape(encodeURIComponent(text)));
    }
    const BufferCtor = (globalThis as unknown as { Buffer?: { from: (input: string, encoding?: string) => { toString: (encoding: string) => string } } }).Buffer;
    if (BufferCtor && typeof BufferCtor.from === 'function') {
      return BufferCtor.from(text, 'utf-8').toString('base64');
    }
    throw new Error('No base64 encoder available');
  } catch (err) {
    console.error('encryptTranscript error', err);
    return text;
  }
};

/** Combined RRULE + human label stored in single `extracted_recurrence` text when DB has no human column */
const COMBINED_RECURRENCE_SEP = ' | ';

function splitCombinedRecurrence(raw: string | null | undefined): { recurrence?: string; human?: string } {
  if (raw == null || raw === '') return {};
  const s = String(raw);
  const i = s.indexOf(COMBINED_RECURRENCE_SEP);
  if (i === -1) return { recurrence: s };
  return {
    recurrence: s.slice(0, i).trim() || undefined,
    human: s.slice(i + COMBINED_RECURRENCE_SEP.length).trim() || undefined,
  };
}

function mergeRecurrenceForDb(rr: string | null | undefined, human: string | null | undefined): string | null {
  const h = human != null && String(human).trim() !== '' ? String(human).trim() : '';
  const r = rr != null && String(rr).trim() !== '' ? String(rr).trim() : '';
  if (r && h) return `${r}${COMBINED_RECURRENCE_SEP}${h}`;
  if (r) return r;
  if (h) return h;
  return null;
}

/** Columns that exist on production Supabase `myday_voice_command_logs` (lean schema). Inserts/updates must not reference other names. */
const LEAN_VOICE_LOG_COLUMNS = new Set([
  'user_id',
  'session_id',
  'raw_text',
  'detected_category',
  'extracted_title',
  'extracted_priority',
  'extracted_tags',
  'extracted_recurrence',
  'memo_date',
  'memo_time',
  'overall_confidence',
  'confidence_breakdown',
  'entities',
  'outcome',
  'created_item_id',
  'created_item_type',
  'user_corrections',
  'search_keywords',
  'expires_at',
  'timestamp',
  'extracted_attendees',
  'updated_at',
  'created_at',
]);

/** Decode UTF-8-safe base64 back to string. */
const decryptTranscript = (encrypted: string): string => {
  try {
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      return decodeURIComponent(escape(window.atob(encrypted)));
    }
    const BufferCtor = (globalThis as unknown as { Buffer?: { from: (input: string, encoding?: string) => { toString: (encoding: string) => string } } }).Buffer;
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
const mapRowToVoiceCommandLog = (row: Record<string, unknown>): VoiceCommandLog => {
  const rawCombined =
    (row.raw_text != null && row.raw_text !== ''
      ? String(row.raw_text)
      : row.raw_transcript_encrypted
        ? decryptTranscript(String(row.raw_transcript))
        : String(row.raw_transcript ?? '')) as string;
  const recSplit = splitCombinedRecurrence(row.extracted_recurrence as string | null | undefined);
  const legacyHuman = (row as Record<string, unknown>).extracted_recurrence_human as string | null | undefined;

  return {
    id: String(row.id),
    userId: (row.user_id as string | null) || null,
    sessionId: String(row.session_id),
    createdAt: (row.created_at as string) || new Date().toISOString(),
    updatedAt: (row.updated_at as string) || new Date().toISOString(),
    expiresAt: (row.expires_at as string) || new Date().toISOString(),
    rawTranscript: rawCombined,
    rawTranscriptEncrypted: !!(row.raw_transcript_encrypted && row.raw_text == null),
    language: row.language as string | undefined,
    intentType: ((row.detected_category ?? row.intent_type) as VoiceCommandLog['intentType']) || 'UNKNOWN',
    intentConfidence: row.intent_confidence === null || row.intent_confidence === undefined ? undefined : Number(row.intent_confidence),
    intentMethod: row.intent_method as VoiceCommandLog['intentMethod'],
    intentAlternatives: row.intent_alternatives,
    entityType: row.entity_type as VoiceCommandLog['entityType'],
    entities: (Array.isArray(row.entities) ? row.entities : []) as Entity[],
    memoDate: (row.memo_date as string | null) || null,
    memoDateExpression: row.memo_date_expression as string | null | undefined,
    memoTime: row.memo_time as string | null | undefined,
    memoTimeExpression: row.memo_time_expression as string | null | undefined,
    allDayEvent: !!(row as Record<string, unknown>).all_day_event,
    extractedTitle: row.extracted_title as string | null | undefined,
    extractedPriority: row.extracted_priority as VoiceCommandLog['extractedPriority'],
    extractedTags: (row.extracted_tags as string[]) || [],
    extractedRecurrence:
      legacyHuman != null && !(String(row.extracted_recurrence ?? '').includes(COMBINED_RECURRENCE_SEP))
        ? (row.extracted_recurrence as string | null | undefined) ?? undefined
        : recSplit.recurrence ?? (row.extracted_recurrence as string | null | undefined) ?? undefined,
    extractedRecurrenceHuman: recSplit.human ?? legacyHuman ?? undefined,
    extractedDuration: row.extracted_duration as number | null | undefined,
    extractedLocation: row.extracted_location as string | null | undefined,
    extractedAttendees: (() => {
      const plural = row.extracted_attendees as string[] | string | null | undefined;
      if (Array.isArray(plural)) return plural;
      const singular = (row as Record<string, unknown>).extracted_attendee as string | null | undefined;
      if (singular != null && singular !== '') return [String(singular)];
      return [];
    })(),
    processingDurationMs: row.processing_duration_ms as number | null | undefined,
    overallConfidence: row.overall_confidence === null || row.overall_confidence === undefined ? undefined : Number(row.overall_confidence),
    confidenceBreakdown: row.confidence_breakdown as VoiceCommandLog['confidenceBreakdown'],
    isValid: !!row.is_valid,
    missingFields: (row.missing_fields as string[]) || [],
    validationErrors: (row.validation_errors as string[]) || [],
    needsUserInput: !!row.needs_user_input,
    userCorrections: (row.user_corrections as VoiceCommandLog['userCorrections']) || [],
    confirmationShown: !!row.confirmation_shown,
    userConfirmed: !!row.user_confirmed,
    userEdited: !!(row as Record<string, unknown>).user_edited,
    outcome: row.outcome as VoiceCommandLog['outcome'],
    failureReason: (row as Record<string, unknown>).failure_reason as string | null | undefined,
    retryCount: row.retry_count as number | undefined,
    createdItemType: row.created_item_type as string | null | undefined,
    createdItemId: row.created_item_id ? String(row.created_item_id) : null,
    createdItemData: row.created_item_data as unknown,
    fuzzyMatchUsed: !!row.fuzzy_match_used,
    fuzzyMatchScore: row.fuzzy_match_score === null || row.fuzzy_match_score === undefined ? undefined : Number(row.fuzzy_match_score),
    searchKeywords: (row.search_keywords as string[]) || [],
    contextData: row.context_data as unknown,
    learnedFromHistory: !!row.learned_from_history,
    userPatternMatched: !!row.user_pattern_matched,
    customVocabularyUsed: (row.custom_vocabulary_used as string[]) || [],
    deviceType: row.device_type as string | null | undefined,
    deviceOs: row.device_os as string | null | undefined,
    appVersion: row.app_version as string | null | undefined,
    modelVersion: row.model_version as string | null | undefined,
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
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
      const sessionId = (commandData as any).sessionId || `scan-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const d = commandData as Record<string, unknown>;
      const memoDateRaw = d.memoDate as string | Date | null | undefined;
      const memo_date =
        memoDateRaw == null
          ? null
          : typeof memoDateRaw === 'string'
            ? memoDateRaw
            : new Date(memoDateRaw as Date).toISOString().slice(0, 10);

      const row: Record<string, unknown> = {
        user_id: d.userId || null,
        session_id: sessionId,
        raw_text: String(d.rawTranscript ?? ''),
        detected_category: d.intentType,
        extracted_title: d.extractedTitle ?? null,
        extracted_priority: d.extractedPriority ?? null,
        extracted_tags: Array.isArray(d.extractedTags) ? d.extractedTags : [],
        extracted_recurrence: mergeRecurrenceForDb(
          d.extractedRecurrence as string | null | undefined,
          d.extractedRecurrenceHuman as string | null | undefined
        ),
        memo_date,
        memo_time: (d.memoTime as string | null | undefined) ?? null,
        overall_confidence: d.overallConfidence ?? null,
        confidence_breakdown: d.confidenceBreakdown ?? null,
        entities: d.entities || [],
        outcome: d.outcome || 'PENDING',
        created_item_id: d.createdItemId || null,
        created_item_type: d.createdItemType || null,
        user_corrections: d.userCorrections ?? [],
        search_keywords: d.searchKeywords ?? [],
        expires_at: expiresAt,
        extracted_attendees: (() => {
          const a = d.extractedAttendees;
          const b = d.extractedAttendee;
          if (Array.isArray(a)) return a;
          if (b != null && b !== '') return [String(b)];
          return [];
        })(),
        timestamp: new Date().toISOString(),
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
    } catch (err: unknown) {
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
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const u = updates as Record<string, unknown>;

      if (u.rawTranscript !== undefined) {
        payload.raw_text = String(u.rawTranscript ?? '');
      }

      // Lean Supabase columns only (see LEO_DB_SCHEMA.schema — myday_voice_command_logs)
      const mapping: Record<string, string> = {
        intentType: 'detected_category',
        entities: 'entities',
        memoDate: 'memo_date',
        memoTime: 'memo_time',
        extractedTitle: 'extracted_title',
        extractedPriority: 'extracted_priority',
        extractedTags: 'extracted_tags',
        extractedAttendee: 'extracted_attendees',
        extractedAttendees: 'extracted_attendees',
        overallConfidence: 'overall_confidence',
        confidenceBreakdown: 'confidence_breakdown',
        userCorrections: 'user_corrections',
        outcome: 'outcome',
        createdItemType: 'created_item_type',
        createdItemId: 'created_item_id',
        searchKeywords: 'search_keywords',
      };

      for (const [k, v] of Object.entries(u)) {
        if (k === 'id' || k === 'rawTranscript') continue;
        if (k === 'extractedRecurrence' || k === 'extractedRecurrenceHuman') continue;
        if (mapping[k]) {
          const col = mapping[k];
          if (col === 'memo_date' && v != null && typeof v !== 'string') {
            payload[col] = new Date(v as Date).toISOString().slice(0, 10);
          } else {
            payload[col] = v;
          }
        } else if (k === 'userId') {
          payload['user_id'] = u.userId;
        } else if (k === 'sessionId') {
          payload['session_id'] = u.sessionId;
        } else if (k === 'extracted_attendee') {
          payload['extracted_attendees'] = u.extracted_attendee;
        }
      }

      if (u.extractedRecurrence !== undefined || u.extractedRecurrenceHuman !== undefined) {
        payload['extracted_recurrence'] = mergeRecurrenceForDb(
          u.extractedRecurrence as string | null | undefined,
          u.extractedRecurrenceHuman as string | null | undefined
        );
      }

      const filtered: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(payload)) {
        if (LEAN_VOICE_LOG_COLUMNS.has(key)) {
          filtered[key] = val;
        }
      }

      const { error } = await client
        .from(this.tableName)
        .update(filtered)
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
      await this.updateCommand(commandId, { outcome: 'UNDONE' as any });

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

  /** Permanently delete a command log entry */
  async deleteCommand(commandId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const { error } = await client
        .from(this.tableName)
        .delete()
        .eq('id', commandId);

      if (error) {
        console.error('deleteCommand error', error);
        throw error;
      }
    } catch (err) {
      console.error('deleteCommand failed', err);
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

      if (filters?.intentType) q = q.eq('detected_category', filters.intentType);
      // entity_type not on lean myday_voice_command_logs — intent is detected_category
      if (filters?.dateFrom) q = q.gte('memo_date', (filters.dateFrom as Date).toISOString().slice(0, 10));
      if (filters?.dateTo) q = q.lte('memo_date', (filters.dateTo as Date).toISOString().slice(0, 10));
      if (filters?.outcome) q = q.eq('outcome', filters.outcome);

      // Basic full-text strategy: ilike on raw_text and extracted_title (lean schema)
      q = (q as any).or(`raw_text.ilike.%${query}%,extracted_title.ilike.%${query}%`);

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
          common_errors: commandLog.outcome === 'FAILED' && commandLog.failureReason ? [{ reason: commandLog.failureReason }] : null,
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
      const updatedRow: Record<string, unknown> = {
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


