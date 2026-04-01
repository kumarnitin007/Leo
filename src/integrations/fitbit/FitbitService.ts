/**
 * Fitbit Fitness Service
 *
 * Fetches daily activity, heart rate, and sleep data from Fitbit Web API
 * and normalizes into the shared DailyFitnessData format.
 * Caches results in the same myday_fitness_data table (source = 'fitbit').
 */

import { fitbitApiFetch } from './FitbitApiClient';
import { FITBIT_API_BASE } from './constants';
import { getSupabaseClient } from '../../lib/supabase';
import type { DailyFitnessData } from '../google/types/fit.types';

// ── Fitbit API response shapes ───────────────────────────────────────

interface FitbitActivitySummary {
  steps: number;
  caloriesOut: number;
  distances: { activity: string; distance: number }[];
  fairlyActiveMinutes: number;
  veryActiveMinutes: number;
  floors: number;
}

interface FitbitActivityResponse {
  summary: FitbitActivitySummary;
}

interface FitbitHeartValue {
  restingHeartRate?: number;
  heartRateZones: { min: number; max: number; minutes: number; caloriesOut: number }[];
}

interface FitbitHeartResponse {
  'activities-heart': { dateTime: string; value: FitbitHeartValue }[];
}

interface FitbitSleepSummary {
  totalMinutesAsleep: number;
}

interface FitbitSleepResponse {
  summary: FitbitSleepSummary;
}

interface FitbitWeightLog {
  weight: number;
  date: string;
}

interface FitbitWeightResponse {
  weight: FitbitWeightLog[];
}

// ── Public API ───────────────────────────────────────────────────────

export async function fetchFitbitData(
  userId: string,
  days: number = 3,
): Promise<DailyFitnessData[]> {
  const dates = buildDateRange(days);
  const results: DailyFitnessData[] = [];

  for (const dateStr of dates) {
    const day: DailyFitnessData = {
      date: dateStr,
      steps: null,
      caloriesBurned: null,
      distanceMeters: null,
      activeMinutes: null,
      heartRateAvg: null,
      heartRateMin: null,
      heartRateMax: null,
      sleepMinutes: null,
      weightKg: null,
      floorsClimbed: null,
    };

    try {
      const activity = await fitbitApiFetch<FitbitActivityResponse>(
        userId,
        `${FITBIT_API_BASE}/1/user/-/activities/date/${dateStr}.json`,
      );
      const s = activity.summary;
      day.steps = s.steps ?? null;
      day.caloriesBurned = s.caloriesOut ?? null;
      day.activeMinutes = (s.fairlyActiveMinutes ?? 0) + (s.veryActiveMinutes ?? 0);
      day.floorsClimbed = s.floors ?? null;

      const totalDist = s.distances?.find(d => d.activity === 'total');
      if (totalDist) {
        day.distanceMeters = Math.round(totalDist.distance * 1000);
      }
    } catch (err: any) {
      console.warn(`[FitbitService] Activity fetch failed for ${dateStr}:`, err.message);
    }

    try {
      const heart = await fitbitApiFetch<FitbitHeartResponse>(
        userId,
        `${FITBIT_API_BASE}/1/user/-/activities/heart/date/${dateStr}/1d.json`,
      );
      const hv = heart['activities-heart']?.[0]?.value;
      if (hv) {
        day.heartRateAvg = hv.restingHeartRate ?? null;
        const zones = hv.heartRateZones ?? [];
        if (zones.length) {
          day.heartRateMin = Math.min(...zones.map(z => z.min));
          day.heartRateMax = Math.max(...zones.map(z => z.max));
        }
      }
    } catch {
      // heart rate scope may not be granted
    }

    try {
      const sleep = await fitbitApiFetch<FitbitSleepResponse>(
        userId,
        `${FITBIT_API_BASE}/1.2/user/-/sleep/date/${dateStr}.json`,
      );
      day.sleepMinutes = sleep.summary?.totalMinutesAsleep ?? null;
    } catch {
      // sleep scope may not be granted
    }

    try {
      const weight = await fitbitApiFetch<FitbitWeightResponse>(
        userId,
        `${FITBIT_API_BASE}/1/user/-/body/log/weight/date/${dateStr}.json`,
      );
      const last = weight.weight?.[weight.weight.length - 1];
      if (last) day.weightKg = Math.round(last.weight * 100) / 100;
    } catch {
      // weight scope may not be granted
    }

    results.push(day);
  }

  return results;
}

export async function fetchAndCacheFitbitData(
  userId: string,
  days: number = 3,
): Promise<DailyFitnessData[]> {
  const data = await fetchFitbitData(userId, days);
  await cacheFitnessData(userId, data, 'fitbit');
  return data;
}

// ── Cache (shared table) ─────────────────────────────────────────────

async function cacheFitnessData(
  userId: string,
  rows: DailyFitnessData[],
  source: string,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !rows.length) return;

  const upsertRows = rows.map(r => ({
    user_id: userId,
    date: r.date,
    steps: r.steps,
    calories_burned: r.caloriesBurned,
    distance_meters: r.distanceMeters,
    active_minutes: r.activeMinutes,
    heart_rate_avg: r.heartRateAvg,
    heart_rate_min: r.heartRateMin,
    heart_rate_max: r.heartRateMax,
    sleep_minutes: r.sleepMinutes,
    weight_kg: r.weightKg,
    floors_climbed: r.floorsClimbed,
    source,
    synced_at: new Date().toISOString(),
  }));

  await client
    .from('myday_fitness_data')
    .upsert(upsertRows, { onConflict: 'user_id,date' });
}

// ── Helpers ──────────────────────────────────────────────────────────

function buildDateRange(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
