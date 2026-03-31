/**
 * Google Fit Service
 *
 * Fetches fitness data (steps, calories, distance, heart rate, etc.)
 * from the Google Fitness REST API and caches results in myday_fitness_data.
 *
 * Uses GoogleApiClient for automatic token handling.
 */

import { googleApiFetch } from '../GoogleApiClient';
import { getSupabaseClient } from '../../../lib/supabase';
import { GOOGLE_API, FIT_DATA_TYPES } from '../constants';
import type {
  DailyFitnessData,
  FitAggregateRequest,
  FitAggregateResponse,
  FitBucket,
} from '../types/fit.types';

const ONE_DAY_MS = 86_400_000;

const FIT_SCOPE_HINTS: Record<string, string> = {
  'com.google.distance.delta': 'fitness.location.read scope',
  'com.google.heart_rate.bpm': 'fitness.heart_rate.read scope',
  'com.google.blood_pressure': 'fitness.blood_pressure.read scope',
  'com.google.blood_glucose': 'fitness.blood_glucose.read scope',
  'com.google.oxygen_saturation': 'fitness.oxygen_saturation.read scope',
  'com.google.body.temperature': 'fitness.body_temperature.read scope',
};

// ── Public API ────────────────────────────────────────────────────────

/**
 * Fetch fitness data for a date range from Google Fit.
 * Fetches each data type individually so a 403 on one type
 * doesn't block the others (not all types are available for every user).
 */
export async function fetchFitnessData(
  userId: string,
  days: number = 3,
): Promise<DailyFitnessData[]> {
  const endMs = startOfDayMs(0) + ONE_DAY_MS;
  const startMs = startOfDayMs(days - 1);
  const url = `${GOOGLE_API.FITNESS}/dataset:aggregate`;

  const emptyDays = initEmptyDays(days);

  for (const dataType of Object.values(FIT_DATA_TYPES)) {
    try {
      const request: FitAggregateRequest = {
        aggregateBy: [{ dataTypeName: dataType }],
        bucketByTime: { durationMillis: ONE_DAY_MS },
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      };

      const response = await googleApiFetch<FitAggregateResponse>(
        userId, url, { method: 'POST', body: request },
      );

      for (const bucket of response.bucket || []) {
        const date = new Date(Number(bucket.startTimeMillis)).toISOString().slice(0, 10);
        const day = emptyDays.get(date);
        if (day) mergeBucketIntoDay(day, bucket);
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('403')) {
        const hint = FIT_SCOPE_HINTS[dataType] || 'additional OAuth scope';
        console.warn(
          `[FitService] 403 — ${dataType} requires ${hint}. ` +
          `User needs to grant this scope in Google Cloud Console, then reconnect.`,
        );
        continue;
      }
      if (msg.includes('400')) {
        console.warn(
          `[FitService] 400 — ${dataType}: no datasource found. ` +
          `This user's Google account has no device/app tracking this metric. ` +
          `No action needed unless a compatible device is added later.`,
        );
        continue;
      }
      console.error(`[FitService] Unexpected error fetching ${dataType}:`, msg);
    }
  }

  return Array.from(emptyDays.values());
}

function initEmptyDays(days: number): Map<string, DailyFitnessData> {
  const map = new Map<string, DailyFitnessData>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    map.set(date, {
      date, steps: null, caloriesBurned: null, distanceMeters: null,
      activeMinutes: null, heartRateAvg: null, heartRateMin: null,
      heartRateMax: null, sleepMinutes: null, weightKg: null, floorsClimbed: null,
    });
  }
  return map;
}

function mergeBucketIntoDay(day: DailyFitnessData, bucket: FitBucket): void {
  for (const dataset of bucket.dataset) {
    if (!dataset.point?.length) continue;
    const dataType = dataset.point[0]?.dataTypeName || dataset.dataSourceId || '';

    if (dataType.includes('step_count')) {
      day.steps = (day.steps ?? 0) + sumIntValues(dataset.point);
    } else if (dataType.includes('calories')) {
      day.caloriesBurned = roundTo((day.caloriesBurned ?? 0) + sumFpValues(dataset.point), 2);
    } else if (dataType.includes('distance')) {
      day.distanceMeters = roundTo((day.distanceMeters ?? 0) + sumFpValues(dataset.point), 2);
    } else if (dataType.includes('active_minutes')) {
      day.activeMinutes = (day.activeMinutes ?? 0) + sumIntValues(dataset.point);
    } else if (dataType.includes('heart_rate')) {
      const vals = dataset.point.flatMap(p => p.value.map(v => v.fpVal ?? 0)).filter(v => v > 0);
      if (vals.length) {
        day.heartRateAvg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
        day.heartRateMin = Math.round(Math.min(...vals));
        day.heartRateMax = Math.round(Math.max(...vals));
      }
    } else if (dataType.includes('sleep')) {
      const totalNanos = dataset.point.reduce(
        (s, p) => s + (Number(p.endTimeNanos) - Number(p.startTimeNanos)), 0,
      );
      day.sleepMinutes = Math.round(totalNanos / 60_000_000_000);
    } else if (dataType.includes('weight')) {
      const last = dataset.point[dataset.point.length - 1];
      day.weightKg = last?.value?.[0]?.fpVal ? roundTo(last.value[0].fpVal, 2) : null;
    } else if (dataType.includes('floor_count')) {
      day.floorsClimbed = (day.floorsClimbed ?? 0) + sumIntValues(dataset.point);
    }
  }
}

/**
 * Fetch and cache fitness data in Supabase for persistence.
 */
export async function fetchAndCacheFitnessData(
  userId: string,
  days: number = 3,
): Promise<DailyFitnessData[]> {
  const data = await fetchFitnessData(userId, days);
  await cacheFitnessData(userId, data);
  return data;
}

/**
 * Load cached fitness data from Supabase (no Google API call).
 */
export async function loadCachedFitnessData(
  userId: string,
  days: number = 7,
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

// ── Caching ───────────────────────────────────────────────────────────

async function cacheFitnessData(userId: string, rows: DailyFitnessData[]): Promise<void> {
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
    source: 'google_fit',
    synced_at: new Date().toISOString(),
  }));

  await client
    .from('myday_fitness_data')
    .upsert(upsertRows, { onConflict: 'user_id,date' });
}

// ── Numeric helpers ───────────────────────────────────────────────────

function sumIntValues(points: { value: { intVal?: number }[] }[]): number {
  return points.reduce((s, p) => s + (p.value?.[0]?.intVal ?? 0), 0);
}

function sumFpValues(points: { value: { fpVal?: number }[] }[]): number {
  return points.reduce((s, p) => s + (p.value?.[0]?.fpVal ?? 0), 0);
}

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function startOfDayMs(daysAgo: number): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.getTime();
}
