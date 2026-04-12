/**
 * Google Fit Service
 *
 * Fetches fitness data (steps, calories, distance, heart rate, etc.)
 * from the Google Fitness REST API and caches results in myday_fitness_data.
 *
 * Uses GoogleApiClient for automatic token handling.
 *
 * Cache strategy: "only-increase" — a past date's metric can only go up,
 * never down. This protects against partial syncs overwriting full-day data.
 */

import { googleApiFetch } from '../GoogleApiClient';
import { getSupabaseClient } from '../../../lib/supabase';
import { GOOGLE_API, FIT_DATA_TYPES } from '../constants';
import { perfStart } from '../../../utils/perfLogger';
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
 * Returns parsed data AND raw API responses for archival.
 */
export async function fetchFitnessData(
  userId: string,
  days: number = 30,
): Promise<{ parsed: DailyFitnessData[]; rawByDate: Map<string, any[]> }> {
  const endMs = startOfDayMs(0) + ONE_DAY_MS;
  const startMs = startOfDayMs(days - 1);
  const url = `${GOOGLE_API.FITNESS}/dataset:aggregate`;

  const emptyDays = initEmptyDays(days);
  const rawByDate = new Map<string, any[]>();
  let anySuccess = false;
  let authError: string | null = null;

  console.info(`[FitService] Fetching ${days} days of fitness data (${new Date(startMs).toISOString().slice(0, 10)} → ${new Date(endMs).toISOString().slice(0, 10)})`);

  for (const dataType of Object.values(FIT_DATA_TYPES)) {
    const endPerf = perfStart('FitService', `API ${dataType.split('.').pop()}`);
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

      endPerf();
      anySuccess = true;
      for (const bucket of response.bucket || []) {
        const date = new Date(Number(bucket.startTimeMillis)).toISOString().slice(0, 10);
        const day = emptyDays.get(date);
        if (day) mergeBucketIntoDay(day, bucket);

        // Collect raw buckets per date for archival
        if (!rawByDate.has(date)) rawByDate.set(date, []);
        rawByDate.get(date)!.push({ dataType, bucket });
      }
    } catch (err: any) {
      endPerf();
      const msg = err.message || '';
      if (msg.includes('Token refresh failed') || msg.includes('not connected') || msg.includes('reconnect Google')) {
        authError = msg;
        break;
      }
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

  if (authError) {
    throw new Error(authError);
  }

  if (!anySuccess) {
    throw new Error('Google Fit: all data type requests failed — no data fetched');
  }

  return { parsed: Array.from(emptyDays.values()), rawByDate };
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
 * Returns the **merged** DB values (keepMax applied) so the UI
 * always shows the highest known value for each metric/date.
 */
export async function fetchAndCacheFitnessData(
  userId: string,
  days: number = 30,
): Promise<DailyFitnessData[]> {
  const { parsed, rawByDate } = await fetchFitnessData(userId, days);
  await cacheFitnessData(userId, parsed, rawByDate);
  // Re-read from DB so the caller gets the merged (highest) values,
  // not the raw API values which may be lower for past dates.
  return loadCachedFitnessData(userId, days);
}

/**
 * Load cached fitness data from Supabase (no Google API call).
 */
export async function loadCachedFitnessData(
  userId: string,
  days: number = 30,
): Promise<DailyFitnessData[]> {
  const endPerf = perfStart('FitService', 'loadCached (DB)');
  const client = getSupabaseClient();
  if (!client) { endPerf(); return []; }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data } = await client
    .from('myday_fitness_data')
    .select('*')
    .eq('user_id', userId)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: false });

  endPerf();
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

// ── Caching with "only-increase" merge ──────────────────────────────

function hasAnyMetric(r: DailyFitnessData): boolean {
  return (
    (r.steps != null && r.steps > 0) ||
    (r.caloriesBurned != null && r.caloriesBurned > 0) ||
    (r.distanceMeters != null && r.distanceMeters > 0) ||
    (r.activeMinutes != null && r.activeMinutes > 0) ||
    (r.heartRateAvg != null && r.heartRateAvg > 0) ||
    (r.sleepMinutes != null && r.sleepMinutes > 0) ||
    (r.weightKg != null && r.weightKg > 0) ||
    (r.floorsClimbed != null && r.floorsClimbed > 0)
  );
}

/**
 * Pick the higher of two values. null/0 never overwrites a positive number.
 */
function keepMax(existing: number | null | undefined, incoming: number | null): number | null {
  const e = existing ?? null;
  const i = incoming ?? null;
  if (e == null) return i;
  if (i == null) return e;
  return Math.max(e, i);
}

async function cacheFitnessData(
  userId: string,
  rows: DailyFitnessData[],
  rawByDate?: Map<string, any[]>,
): Promise<void> {
  const endPerf = perfStart('FitService', 'cacheFitnessData (merge+upsert)');
  const client = getSupabaseClient();
  if (!client || !rows.length) { endPerf(); return; }

  const nonEmptyRows = rows.filter(hasAnyMetric);
  if (!nonEmptyRows.length) {
    console.warn('[FitService] All fetched rows are empty — skipping cache to protect existing data');
    endPerf();
    return;
  }

  // Load existing rows for these dates so we can merge (only-increase)
  const dates = nonEmptyRows.map(r => r.date);
  const { data: existingRows } = await client
    .from('myday_fitness_data')
    .select('date, steps, calories_burned, distance_meters, active_minutes, heart_rate_avg, heart_rate_min, heart_rate_max, sleep_minutes, weight_kg, floors_climbed')
    .eq('user_id', userId)
    .in('date', dates);

  const existingMap = new Map<string, any>();
  if (existingRows) {
    for (const r of existingRows) existingMap.set(r.date, r);
  }

  const upsertRows = nonEmptyRows.map(r => {
    const old = existingMap.get(r.date);
    const rawJson = rawByDate?.get(r.date);

    return {
      user_id: userId,
      date: r.date,
      steps: keepMax(old?.steps, r.steps),
      calories_burned: keepMax(old?.calories_burned, r.caloriesBurned),
      distance_meters: keepMax(old?.distance_meters, r.distanceMeters),
      active_minutes: keepMax(old?.active_minutes, r.activeMinutes),
      heart_rate_avg: keepMax(old?.heart_rate_avg, r.heartRateAvg),
      heart_rate_min: keepMax(old?.heart_rate_min, r.heartRateMin),
      heart_rate_max: keepMax(old?.heart_rate_max, r.heartRateMax),
      sleep_minutes: keepMax(old?.sleep_minutes, r.sleepMinutes),
      weight_kg: keepMax(old?.weight_kg, r.weightKg),
      floors_climbed: keepMax(old?.floors_climbed, r.floorsClimbed),
      source: 'google_fit',
      raw_data: rawJson ? JSON.stringify(rawJson) : undefined,
      synced_at: new Date().toISOString(),
    };
  });

  const merged = upsertRows.filter(r => {
    const old = existingMap.get(r.date);
    if (!old) return true;
    return (
      r.steps !== old.steps ||
      r.calories_burned !== old.calories_burned ||
      r.distance_meters !== old.distance_meters ||
      r.active_minutes !== old.active_minutes
    );
  });

  if (merged.length === 0) {
    console.info('[FitService] No new/increased data to write — all existing values are equal or higher');
    endPerf();
    return;
  }

  console.info(`[FitService] Upserting ${merged.length} rows (${nonEmptyRows.length} non-empty fetched, ${existingMap.size} existing in DB, ${nonEmptyRows.length - merged.length} unchanged)`);

  await client
    .from('myday_fitness_data')
    .upsert(merged, { onConflict: 'user_id,date' });

  endPerf();
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
