/**
 * Unified Fitness Service
 *
 * Facade that delegates to the active fitness provider.
 * All consumers (TrackedTaskEngine, FitnessGoalCards, etc.) call this
 * instead of provider-specific code.
 */

import { getSupabaseClient } from '../../lib/supabase';
import type { DailyFitnessData } from '../google/types/fit.types';
import type { FitnessProviderId } from './types';

const PROVIDER_SETTING_KEY = 'myday_fitness_provider';

// ── Provider preference (stored in localStorage + Supabase) ──────────

export function getActiveProvider(): FitnessProviderId {
  return (localStorage.getItem(PROVIDER_SETTING_KEY) as FitnessProviderId) || 'google_fit';
}

export function setActiveProvider(id: FitnessProviderId): void {
  localStorage.setItem(PROVIDER_SETTING_KEY, id);
}

// ── Fetch fitness data from active provider ──────────────────────────

export async function fetchFitnessDataUnified(
  userId: string,
  days: number = 30,
): Promise<DailyFitnessData[]> {
  const provider = getActiveProvider();

  switch (provider) {
    case 'google_fit': {
      const { fetchAndCacheFitnessData } = await import('../google/services/FitService');
      return fetchAndCacheFitnessData(userId, days);
    }
    case 'fitbit': {
      const { fetchAndCacheFitbitData } = await import('../fitbit/FitbitService');
      return fetchAndCacheFitbitData(userId, days);
    }
    case 'garmin':
      // Garmin is manual-import only; return cached data
      return loadCachedFitnessDataUnified(userId, days);
    default:
      return [];
  }
}

// ── Load cached data (works for ALL providers since they all write to myday_fitness_data) ──

export async function loadCachedFitnessDataUnified(
  userId: string,
  days: number = 30,
): Promise<DailyFitnessData[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await client
    .from('myday_fitness_data')
    .select('*')
    .eq('user_id', userId)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: false });

  if (!data?.length) return [];

  return data.map(row => ({
    date: row.date,
    steps: row.steps,
    caloriesBurned: row.calories_burned,
    distanceMeters: row.distance_meters,
    activeMinutes: row.active_minutes,
    heartRateAvg: row.heart_rate_avg,
    heartRateMin: row.heart_rate_min,
    heartRateMax: row.heart_rate_max,
    sleepMinutes: row.sleep_minutes,
    weightKg: row.weight_kg,
    floorsClimbed: row.floors_climbed,
  }));
}

// ── Check if a provider is connected ─────────────────────────────────

export async function isProviderConnected(
  userId: string,
  provider?: FitnessProviderId,
): Promise<boolean> {
  const p = provider || getActiveProvider();

  switch (p) {
    case 'google_fit': {
      const { loadTokens, hasFitScopes } = await import('../google/GoogleAuthManager');
      const tokens = await loadTokens(userId);
      return !!tokens && hasFitScopes(tokens);
    }
    case 'fitbit': {
      const { loadFitbitTokens } = await import('../fitbit/FitbitAuthManager');
      const tokens = await loadFitbitTokens(userId);
      return !!tokens;
    }
    case 'garmin':
      return true; // manual import always "available"
    default:
      return false;
  }
}
