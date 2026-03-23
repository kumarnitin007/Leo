/**
 * COPILOT PROMPT: Create VoiceCommandRepository using Repository Pattern
 * 
 * PURPOSE: Thin data access layer with type-safe queries
 * 
 * REQUIREMENTS:
 * 
 * Create a repository class with these methods:
 * 
 * 1. findById(id: string): Promise<VoiceCommandLog | null>
 * 2. findByUserId(userId: string, options?: QueryOptions): Promise<VoiceCommandLog[]>
 * 3. findByDateRange(userId: string, startDate: Date, endDate: Date): Promise<VoiceCommandLog[]>
 * 4. findByIntent(userId: string, intentType: IntentType): Promise<VoiceCommandLog[]>
 * 5. findByOutcome(userId: string, outcome: Outcome): Promise<VoiceCommandLog[]>
 * 6. findSuccessful(userId: string): Promise<VoiceCommandLog[]>
 * 7. findFailed(userId: string): Promise<VoiceCommandLog[]>
 * 8. findPendingUndo(userId: string): Promise<VoiceCommandLog[]>
 * 9. create(data: VoiceCommandLogInsert): Promise<VoiceCommandLog>
 * 10. update(id: string, data: VoiceCommandLogUpdate): Promise<VoiceCommandLog>
 * 11. delete(id: string): Promise<void>
 * 12. search(userId: string, keywords: string[]): Promise<VoiceCommandLog[]>
 * 13. count(userId: string, filters?: QueryFilters): Promise<number>
 * 
 * QueryOptions interface:
 * {
 *   limit?: number;
 *   offset?: number;
 *   orderBy?: 'created_at' | 'updated_at' | 'confidence';
 *   order?: 'ASC' | 'DESC';
 * }
 * 
 * FEATURES:
 * - Type-safe queries using VoiceCommandLog types
 * - Consistent error handling
 * - Query builder for complex filters
 * - Support for pagination
 * - Support for sorting
 * 
 * Use YOUR existing ORM/database client (Prisma/TypeORM/Kysely/Drizzle)
 */

import { getSupabaseClient } from '../lib/supabase';
import dbService from '../services/voice/VoiceCommandDatabaseService';
import {
  VoiceCommandLog,
  VoiceCommandLogInsert,
  VoiceCommandLogUpdate,
  IntentType,
  Outcome,
} from '../types/voice-command-db.types';

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'updated_at' | 'confidence';
  order?: 'ASC' | 'DESC';
}

export interface QueryFilters {
  intentType?: IntentType;
  entityType?: string;
  outcome?: Outcome;
  dateFrom?: Date;
  dateTo?: Date;
}

export class VoiceCommandRepository {
  private table = 'myday_voice_command_logs';

  constructor() {}

  async findById(id: string): Promise<VoiceCommandLog | null> {
    try {
      return await dbService.getCommandById(id);
    } catch (err) {
      console.error('VoiceCommandRepository.findById failed', err);
      return null;
    }
  }

  private applyOptions(q: unknown, opts?: QueryOptions) {
    if (!opts) return q;
    let query = q as any;
    const orderMap: Record<string, string> = {
      created_at: 'created_at',
      updated_at: 'updated_at',
      confidence: 'overall_confidence',
    };
    if (opts.orderBy) query = query.order(orderMap[opts.orderBy] || opts.orderBy, { ascending: (opts.order || 'DESC') === 'ASC' ? true : false });
    if (opts.limit) query = query.limit(opts.limit);
    if (opts.offset) query = query.range(opts.offset, (opts.offset || 0) + (opts.limit || 100) - 1);
    return query;
  }

  async findByUserId(userId: string, options?: QueryOptions): Promise<VoiceCommandLog[]> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const baseQuery = client.from(this.table).select('id').eq('user_id', userId);
      const q = this.applyOptions(baseQuery, options) as any;
      const { data, error } = await q;
      if (error) throw error;
      const ids = (data || []).map((r: { id?: string }) => r.id).filter(Boolean) as string[];
      const results = await Promise.all(ids.map(id => dbService.getCommandById(id)));
      return results.filter(Boolean) as VoiceCommandLog[];
    } catch (err) {
      console.error('findByUserId failed', err);
      return [];
    }
  }

  async findByDateRange(userId: string, startDate: Date, endDate: Date): Promise<VoiceCommandLog[]> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const { data, error } = await client
        .from(this.table)
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      const ids = (data || []).map((r: { id?: string }) => r.id).filter(Boolean) as string[];
      const results = await Promise.all(ids.map(id => dbService.getCommandById(id)));
      return results.filter(Boolean) as VoiceCommandLog[];
    } catch (err) {
      console.error('findByDateRange failed', err);
      return [];
    }
  }

  async findByIntent(userId: string, intentType: IntentType): Promise<VoiceCommandLog[]> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const { data, error } = await client.from(this.table).select('id').eq('user_id', userId).eq('detected_category', intentType).order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      const ids = (data || []).map((r: { id?: string }) => r.id).filter(Boolean) as string[];
      const results = await Promise.all(ids.map(id => dbService.getCommandById(id)));
      return results.filter(Boolean) as VoiceCommandLog[];
    } catch (err) {
      console.error('findByIntent failed', err);
      return [];
    }
  }

  async findByOutcome(userId: string, outcome: Outcome): Promise<VoiceCommandLog[]> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const { data, error } = await client.from(this.table).select('id').eq('user_id', userId).eq('outcome', outcome).order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      const ids = (data || []).map((r: { id?: string }) => r.id).filter(Boolean) as string[];
      const results = await Promise.all(ids.map(id => dbService.getCommandById(id)));
      return results.filter(Boolean) as VoiceCommandLog[];
    } catch (err) {
      console.error('findByOutcome failed', err);
      return [];
    }
  }

  async findSuccessful(userId: string): Promise<VoiceCommandLog[]> {
    return this.findByOutcome(userId, 'SUCCESS');
  }

  async findFailed(userId: string): Promise<VoiceCommandLog[]> {
    return this.findByOutcome(userId, 'FAILED');
  }

  async findPendingUndo(userId: string): Promise<VoiceCommandLog[]> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      // Pending undo: commands that created an item and are not already UNDONE
      const { data, error } = await client
        .from(this.table)
        .select('id')
        .eq('user_id', userId)
        .not('created_item_id', 'is', null)
        .neq('outcome', 'UNDONE')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      const ids = (data || []).map((r: { id?: string }) => r.id).filter(Boolean) as string[];
      const results = await Promise.all(ids.map(id => dbService.getCommandById(id)));
      return results.filter(Boolean) as VoiceCommandLog[];
    } catch (err) {
      console.error('findPendingUndo failed', err);
      return [];
    }
  }

  async create(data: VoiceCommandLogInsert): Promise<VoiceCommandLog> {
    try {
      const id = await dbService.saveCommand(data as any);
      const cmd = await dbService.getCommandById(id);
      if (!cmd) throw new Error('Failed to retrieve created command');
      return cmd;
    } catch (err) {
      console.error('create failed', err);
      throw err;
    }
  }

  async update(id: string, data: VoiceCommandLogUpdate): Promise<VoiceCommandLog> {
    try {
      await dbService.updateCommand(id, data as any);
      const updated = await dbService.getCommandById(id);
      if (!updated) throw new Error('Failed to retrieve updated command');
      return updated;
    } catch (err) {
      console.error('update failed', err);
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const { error } = await client.from(this.table).delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('delete failed', err);
      throw err;
    }
  }

  async search(userId: string, keywords: string[]): Promise<VoiceCommandLog[]> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      if (!keywords || keywords.length === 0) return [];
      // Build OR condition for keywords across raw_transcript and extracted_title
      const ors: string[] = [];
      keywords.forEach(k => {
        const esc = k.replace(/%/g, '\\%').replace(/'/g, "''");
        ors.push(`raw_text.ilike.%${esc}%`);
        ors.push(`extracted_title.ilike.%${esc}%`);
      });
      const orExpr = ors.join(',');
      const { data, error } = await client.from(this.table).select('id').eq('user_id', userId).or(orExpr).order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      const ids = (data || []).map((r: { id?: string }) => r.id).filter(Boolean) as string[];
      const results = await Promise.all(ids.map(id => dbService.getCommandById(id)));
      return results.filter(Boolean) as VoiceCommandLog[];
    } catch (err) {
      console.error('search failed', err);
      return [];
    }
  }

  async count(userId: string, filters?: QueryFilters): Promise<number> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      let q = client.from(this.table).select('id', { count: 'exact', head: false }).eq('user_id', userId) as any;
      if (filters?.intentType) q = q.eq('detected_category', filters.intentType);
      // entity_type not on lean voice log table
      if (filters?.outcome) q = q.eq('outcome', filters.outcome);
      if (filters?.dateFrom) q = q.gte('created_at', filters.dateFrom.toISOString());
      if (filters?.dateTo) q = q.lte('created_at', filters.dateTo.toISOString());

      const { count, error } = await q;
      if (error) throw error;

      // Supabase client returns count in 'count' property for select with exact count
      return typeof count === 'number' ? count : 0;
    } catch (err) {
      console.error('count failed', err);
      return 0;
    }
  }
}

export default new VoiceCommandRepository();
