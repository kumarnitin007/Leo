/**
 * Storage Core Module
 * 
 * Contains helper functions, query cache, and authentication utilities
 * Used by all other storage modules.
 */

import { getSupabaseClient } from '../lib/supabase';
import { AppData } from '../types';
import { PerformanceConfig } from '../config/performanceConfig';

// ===== HELPER FUNCTIONS =====

export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export interface VoiceFields {
  createdViaVoice?: boolean;
  voiceCommandId?: string;
  voiceConfidence?: number;
}

export function mapVoiceFieldsToDb(updates: VoiceFields, dbUpdates: Record<string, unknown>): void {
  if (updates.createdViaVoice !== undefined) dbUpdates.created_via_voice = updates.createdViaVoice;
  if (updates.voiceCommandId !== undefined) dbUpdates.voice_command_id = updates.voiceCommandId;
  if (updates.voiceConfidence !== undefined) dbUpdates.voice_confidence = updates.voiceConfidence;
}

export const mapVoiceFields = (updates: Record<string, unknown>, dbUpdates: Record<string, unknown>): void => {
  if ((updates as VoiceFields).createdViaVoice !== undefined) dbUpdates.created_via_voice = (updates as VoiceFields).createdViaVoice;
  if ((updates as VoiceFields).voiceCommandId !== undefined) dbUpdates.voice_command_id = (updates as VoiceFields).voiceCommandId;
  if ((updates as VoiceFields).voiceConfidence !== undefined) dbUpdates.voice_confidence = (updates as VoiceFields).voiceConfidence;
};

// ===== QUERY CACHE =====

interface CacheEntry {
  data: AppData;
  timestamp: number;
  key: string;
}

let dashboardCache: CacheEntry | null = null;

export const pendingRequests = new Map<string, Promise<AppData>>();

export const getCacheKey = (selectedDate: string, daysToLoad: number): string => {
  return `${selectedDate}-${daysToLoad}`;
};

export const isCacheValid = (cacheEntry: CacheEntry | null, key: string): boolean => {
  if (!PerformanceConfig.ENABLE_QUERY_CACHE) return false;
  if (!cacheEntry) return false;
  if (cacheEntry.key !== key) return false;
  
  const now = Date.now();
  const age = now - cacheEntry.timestamp;
  return age < PerformanceConfig.QUERY_CACHE_TTL_MS;
};

export const setCache = (key: string, data: AppData): void => {
  if (!PerformanceConfig.ENABLE_QUERY_CACHE) return;
  
  dashboardCache = {
    data,
    timestamp: Date.now(),
    key
  };
};

export const getCache = (key: string): AppData | null => {
  if (!isCacheValid(dashboardCache, key)) return null;
  return dashboardCache!.data;
};

export const clearDashboardCache = (): void => {
  dashboardCache = null;
};

// ===== AUTHENTICATION =====

export interface AuthContext {
  client: ReturnType<typeof getSupabaseClient>;
  userId: string;
}

export const requireAuth = async (): Promise<AuthContext> => {
  const client = getSupabaseClient();
  if (!client) {
    console.debug('requireAuth: Supabase client not available (likely missing VITE vars)');
    throw new Error('Supabase not configured. Please check your .env file.');
  }

  try {
    console.debug('requireAuth: calling client.auth.getUser()');
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      console.debug('requireAuth: no authenticated user found');
      throw new Error('User must be signed in to access data.');
    }

    console.debug('requireAuth: authenticated user id=', user.id);
    return { client, userId: user.id };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.debug('requireAuth: error while checking auth:', errorMessage);
    throw err;
  }
};
