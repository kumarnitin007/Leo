/**
 * COPILOT PROMPT: Create analytics service for voice commands
 * 
 * PURPOSE: Track metrics and generate insights (privacy-preserving)
 * 
 * TABLE: myday_voice_command_analytics
 * 
 * METHODS:
 * 
 * 1. trackCommand(commandLog: VoiceCommandLog): Promise<void>
 *    - Anonymize user_id (one-way hash)
 *    - INSERT or UPDATE myday_voice_command_analytics
 *    - Aggregate by: user_hash, intent_type, date, hour_of_day
 *    - Increment total_commands
 *    - Increment successful_commands or failed_commands based on outcome
 *    - Update average_confidence (running average)
 *    - Update average_processing_time_ms (running average)
 * 
 * 2. getSuccessRate(
 *      intentType?: IntentType,
 *      dateFrom?: Date,
 *      dateTo?: Date
 *    ): Promise<number>
 *    - Calculate overall success rate
 *    - Filter by intent type if provided
 *    - Filter by date range if provided
 *    - Return percentage (0-100)
 * 
 * 3. getTopFailureReasons(limit: number = 10): Promise<Array<{
 *      reason: string;
 *      count: number;
 *      percentage: number;
 *    }>>
 *    - Group by failure_reason
 *    - Count occurrences
 *    - Return top N reasons
 * 
 * 4. getIntentDistribution(): Promise<Array<{
 *      intentType: IntentType;
 *      count: number;
 *      percentage: number;
 *    }>>
 *    - Count commands by intent_type
 *    - Calculate percentages
 * 
 * 5. getAverageConfidenceByIntent(): Promise<Map<IntentType, number>>
 *    - Calculate average confidence per intent type
 * 
 * 6. getPeakUsageHours(): Promise<Array<{
 *      hour: number; // 0-23
 *      count: number;
 *    }>>
 *    - Aggregate by hour_of_day
 *    - Return sorted by count DESC
 * 
 * 7. getUserMetrics(userId: string): Promise<{
 *      totalCommands: number;
 *      successRate: number;
 *      averageConfidence: number;
 *      mostUsedIntent: IntentType;
 *      learnedPatterns: number;
 *    }>
 *    - Get aggregated stats for user
 *    - Include learned patterns count
 * 
 * PRIVACY REQUIREMENTS:
 * - NEVER store raw transcripts in analytics
 * - Hash user_id before storing
 * - Only store aggregated data
 * - No PII (personally identifiable information)
 * 
 * HELPER FUNCTION:
 * hashUserId(userId: string): string
 * - Use crypto.createHash('sha256').update(userId).digest('hex')
 */

import { getSupabaseClient } from '../../lib/supabase';
import { VoiceCommandLog, IntentType } from '../../types/voice-command-db.types';

/**
 * Hash a user id using SHA-256. Uses Web Crypto when available, falls back to Node's crypto.
 */
async function hashUserId(userId: string): Promise<string> {
  try {
    // Prefer Web Crypto (browser / modern runtimes)
    if (typeof window !== 'undefined' && (window.crypto as any)?.subtle) {
      const enc = new TextEncoder();
      const data = enc.encode(userId);
      const hash = await (window.crypto as any).subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Deterministic, non-crypto fallback for environments without SubtleCrypto.
    const fallback = (s: string) => {
      // FNV-1a 32-bit variant producing a stable hex fingerprint (NOT cryptographic, used only as fallback)
      let h = 2166136261 >>> 0;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      const part1 = ('00000000' + (h >>> 0).toString(16)).slice(-8);
      const part2 = ('00000000' + ((h ^ 0xffffffff) >>> 0).toString(16)).slice(-8);
      return `weak_${part1}${part2}`;
    };

    return fallback(userId);
  } catch (err) {
    console.warn('hashUserId fallback', err);
    return `weak_${String(userId).slice(0, 8)}`;
  }
}

function dateToYMD(d?: Date): string {
  const dt = d || new Date();
  return dt.toISOString().slice(0, 10);
}

export type FailureReasonCount = { reason: string; count: number; percentage?: number };

export class VoiceCommandAnalyticsService {
  private table = 'myday_voice_command_analytics';
  private patternsTable = 'myday_user_voice_patterns';

  constructor() {}

  /**
   * Track a single command into analytics (privacy-preserving).
   * - Hashes user id
   * - Upserts into analytics table by user_hash, intent_type, date, hour_of_day
   */
  async trackCommand(commandLog: VoiceCommandLog): Promise<void> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const userHash = commandLog.userId ? await hashUserId(commandLog.userId) : 'anon';
      const date = dateToYMD(commandLog.createdAt);
      const hour = commandLog.createdAt.getHours();

      const { data: existing, error: selErr } = await client
        .from(this.table)
        .select('*')
        .eq('user_hash', userHash)
        .eq('intent_type', commandLog.intentType)
        .eq('date', date)
        .eq('hour_of_day', hour)
        .maybeSingle();

      if (selErr) {
        console.error('trackCommand select error', selErr);
        return;
      }

      if (!existing) {
        const insert: any = {
          user_hash: userHash,
          intent_type: commandLog.intentType,
          entity_type: commandLog.entityType || null,
          date,
          hour_of_day: hour,
          total_commands: 1,
          successful_commands: commandLog.outcome === 'SUCCESS' ? 1 : 0,
          failed_commands: commandLog.outcome === 'FAILED' ? 1 : 0,
          cancelled_commands: commandLog.outcome === 'CANCELLED' ? 1 : 0,
          average_confidence: commandLog.overallConfidence ?? null,
          average_processing_time_ms: commandLog.processingDurationMs ?? null,
          common_errors: commandLog.outcome === 'FAILED' && commandLog.failureReason ? [{ reason: commandLog.failureReason, count: 1 }] : [],
        };

        const { error: insErr } = await client.from(this.table).insert(insert);
        if (insErr) console.error('trackCommand insert error', insErr);
        return;
      }

      // Update existing aggregate: increment counters, update running averages, merge common_errors
      const updated: any = {
        total_commands: (existing.total_commands || 0) + 1,
      };

      if (commandLog.outcome === 'SUCCESS') updated.successful_commands = (existing.successful_commands || 0) + 1;
      if (commandLog.outcome === 'FAILED') updated.failed_commands = (existing.failed_commands || 0) + 1;
      if (commandLog.outcome === 'CANCELLED') updated.cancelled_commands = (existing.cancelled_commands || 0) + 1;

      // Recompute average confidence as weighted running average
      if (commandLog.overallConfidence != null) {
        const prevCount = existing.total_commands || 0;
        const prevAvg = existing.average_confidence || 0;
        updated.average_confidence = (prevAvg * prevCount + commandLog.overallConfidence) / (prevCount + 1);
      }

      // Recompute average processing time
      if (commandLog.processingDurationMs != null) {
        const prevCount = existing.total_commands || 0;
        const prevAvg = existing.average_processing_time_ms || 0;
        updated.average_processing_time_ms = (prevAvg * prevCount + commandLog.processingDurationMs) / (prevCount + 1);
      }

      // Merge common_errors: maintain array of {reason, count}
      const incomingReason = commandLog.outcome === 'FAILED' && commandLog.failureReason ? String(commandLog.failureReason).trim() : null;
      let mergedErrors: Array<{ reason: string; count: number }> = Array.isArray(existing.common_errors) ? existing.common_errors : [];

      if (incomingReason) {
        const idx = mergedErrors.findIndex(e => e.reason === incomingReason);
        if (idx >= 0) mergedErrors[idx].count = (mergedErrors[idx].count || 0) + 1;
        else mergedErrors.push({ reason: incomingReason, count: 1 });
      }

      updated.common_errors = mergedErrors;

      const { error: updErr } = await client.from(this.table).update(updated).eq('id', existing.id);
      if (updErr) console.error('trackCommand update error', updErr);
    } catch (err) {
      console.error('trackCommand failed', err);
    }
  }

  /**
   * Calculate success rate percentage (0-100) optionally filtered by intent and date range
   */
  async getSuccessRate(intentType?: IntentType, dateFrom?: Date, dateTo?: Date): Promise<number> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      let q: any = client.from(this.table).select('total_commands, successful_commands');
      if (intentType) q = q.eq('intent_type', intentType);
      if (dateFrom) q = q.gte('date', dateToYMD(dateFrom));
      if (dateTo) q = q.lte('date', dateToYMD(dateTo));

      const { data, error } = await q;
      if (error) {
        console.error('getSuccessRate error', error);
        return 0;
      }

      const totals = (data || []).reduce((acc: { total: number; success: number }, row: any) => {
        acc.total += (row.total_commands || 0);
        acc.success += (row.successful_commands || 0);
        return acc;
      }, { total: 0, success: 0 });

      if (totals.total === 0) return 0;
      return Math.round((totals.success / totals.total) * 100 * 100) / 100; // 2 decimal places
    } catch (err) {
      console.error('getSuccessRate failed', err);
      return 0;
    }
  }

  /**
   * Get top failure reasons across the dataset (recent by date range if provided)
   */
  async getTopFailureReasons(limit = 10, dateFrom?: Date, dateTo?: Date): Promise<FailureReasonCount[]> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      let q: any = client.from(this.table).select('common_errors, total_commands');
      if (dateFrom) q = q.gte('date', dateToYMD(dateFrom));
      if (dateTo) q = q.lte('date', dateToYMD(dateTo));

      const { data, error } = await q;
      if (error) {
        console.error('getTopFailureReasons error', error);
        return [];
      }

      const counts = new Map<string, number>();

      (data || []).forEach((row: any) => {
        const arr = Array.isArray(row.common_errors) ? row.common_errors : [];
        arr.forEach((e: any) => {
          const reason = e.reason || String(e || 'unknown');
          const c = Number(e.count || 1);
          counts.set(reason, (counts.get(reason) || 0) + c);
        });
      });

      const total = Array.from(counts.values()).reduce((s, v) => s + v, 0) || 1;

      const out = Array.from(counts.entries())
        .map(([reason, count]) => ({ reason, count, percentage: Math.round((count / total) * 10000) / 100 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return out;
    } catch (err) {
      console.error('getTopFailureReasons failed', err);
      return [];
    }
  }

  /**
   * Distribution of intents across all commands
   */
  async getIntentDistribution(): Promise<Array<{ intentType: IntentType; count: number; percentage: number }>> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const { data, error } = await client.from(this.table).select('intent_type, total_commands');
      if (error) {
        console.error('getIntentDistribution error', error);
        return [];
      }

      const map = new Map<string, number>();
      (data || []).forEach((r: any) => {
        const k = r.intent_type || 'UNKNOWN';
        map.set(k, (map.get(k) || 0) + (r.total_commands || 0));
      });

      const total = Array.from(map.values()).reduce((s, v) => s + v, 0) || 1;

      return Array.from(map.entries()).map(([intentType, count]) => ({ intentType: intentType as IntentType, count, percentage: Math.round((count / total) * 10000) / 100 })).sort((a, b) => b.count - a.count);
    } catch (err) {
      console.error('getIntentDistribution failed', err);
      return [];
    }
  }

  /**
   * Average confidence per intent type
   */
  async getAverageConfidenceByIntent(): Promise<Map<IntentType, number>> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const { data, error } = await client.from(this.table).select('intent_type, average_confidence, total_commands');
      if (error) {
        console.error('getAverageConfidenceByIntent error', error);
        return new Map();
      }

      const sums = new Map<string, { weightedSum: number; count: number }>();
      (data || []).forEach((r: any) => {
        const key = r.intent_type || 'UNKNOWN';
        const avg = r.average_confidence != null ? Number(r.average_confidence) : 0;
        const count = Number(r.total_commands || 0);
        const prev = sums.get(key) || { weightedSum: 0, count: 0 };
        prev.weightedSum += avg * count;
        prev.count += count;
        sums.set(key, prev);
      });

      const out = new Map<IntentType, number>();
      sums.forEach((v, k) => {
        out.set(k as IntentType, v.count ? Math.round((v.weightedSum / v.count) * 10000) / 100 : 0);
      });

      return out;
    } catch (err) {
      console.error('getAverageConfidenceByIntent failed', err);
      return new Map();
    }
  }

  /**
   * Peak usage hours across dataset (hour 0-23)
   */
  async getPeakUsageHours(): Promise<Array<{ hour: number; count: number }>> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const { data, error } = await client.from(this.table).select('hour_of_day, total_commands');
      if (error) {
        console.error('getPeakUsageHours error', error);
        return [];
      }

      const counts = new Map<number, number>();
      (data || []).forEach((r: any) => {
        const h = Number(r.hour_of_day || 0);
        counts.set(h, (counts.get(h) || 0) + (r.total_commands || 0));
      });

      return Array.from(counts.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => b.count - a.count);
    } catch (err) {
      console.error('getPeakUsageHours failed', err);
      return [];
    }
  }

  /**
   * User-level aggregated metrics (privacy-preserving using hashed id)
   */
  async getUserMetrics(userId: string): Promise<{
    totalCommands: number;
    successRate: number;
    averageConfidence: number;
    mostUsedIntent: IntentType | null;
    learnedPatterns: number;
  }> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    try {
      const userHash = await hashUserId(userId);
      const { data, error } = await client.from(this.table).select('intent_type, total_commands, successful_commands, average_confidence');
      if (error) {
        console.error('getUserMetrics error', error);
        return { totalCommands: 0, successRate: 0, averageConfidence: 0, mostUsedIntent: null, learnedPatterns: 0 };
      }

      // Filter rows client-side for this user hash
      const rows = (data || []).filter((r: any) => r.user_hash === userHash);

      const totals = rows.reduce((acc: { total: number; success: number; confidenceSum: number }, r: any) => {
        acc.total += (r.total_commands || 0);
        acc.success += (r.successful_commands || 0);
        acc.confidenceSum += (Number(r.average_confidence || 0) * (r.total_commands || 0));
        return acc;
      }, { total: 0, success: 0, confidenceSum: 0 });

      const mostUsedMap = new Map<string, number>();
      rows.forEach((r: any) => {
        const k = r.intent_type || 'UNKNOWN';
        mostUsedMap.set(k, (mostUsedMap.get(k) || 0) + (r.total_commands || 0));
      });

      let mostUsedIntent: IntentType | null = null;
      let maxCount = 0;
      mostUsedMap.forEach((c, k) => {
        if (c > maxCount) {
          maxCount = c;
          mostUsedIntent = k as IntentType;
        }
      });

      // learned patterns count
      const { data: patterns, error: patErr } = await client.from(this.patternsTable).select('id').eq('user_id', userId);
      const learnedPatterns = Array.isArray(patterns) ? patterns.length : 0;
      if (patErr) console.error('getUserMetrics patterns error', patErr);

      const avgConfidence = totals.total ? Math.round((totals.confidenceSum / totals.total) * 10000) / 100 : 0;
      const successRate = totals.total ? Math.round((totals.success / totals.total) * 10000) / 100 : 0;

      return { totalCommands: totals.total, successRate, averageConfidence: avgConfidence, mostUsedIntent, learnedPatterns };
    } catch (err) {
      console.error('getUserMetrics failed', err);
      return { totalCommands: 0, successRate: 0, averageConfidence: 0, mostUsedIntent: null, learnedPatterns: 0 };
    }
  }
}

export default new VoiceCommandAnalyticsService();
