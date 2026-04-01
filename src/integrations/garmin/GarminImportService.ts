/**
 * Garmin Connect Import Service
 *
 * Garmin's Health API requires a formal business partnership, so this
 * integration works via manual CSV import from Garmin Connect:
 *   connect.garmin.com → Reports → Export CSV
 *
 * Parses the exported CSV and normalizes into DailyFitnessData,
 * then caches in myday_fitness_data (source = 'garmin').
 *
 * Supported export format: Garmin Connect "Activities" or "Daily Summary" CSV.
 */

import { getSupabaseClient } from '../../lib/supabase';
import type { DailyFitnessData } from '../google/types/fit.types';

export interface GarminImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Parse a Garmin Connect CSV file content into DailyFitnessData[].
 *
 * Handles two common export formats:
 *   1. Daily Summary: Date, Steps, Calories, Distance (km), Active Minutes, ...
 *   2. Activities: Date, Activity Type, Distance, Calories, Time, Avg HR, ...
 *
 * Column matching is case-insensitive and flexible.
 */
export function parseGarminCsv(csvText: string): DailyFitnessData[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVRow(headerLine).map(h => h.toLowerCase().trim());

  const colMap = resolveColumns(headers);

  const dayMap = new Map<string, DailyFitnessData>();

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const cols = parseCSVRow(lines[i]);

    const rawDate = cols[colMap.date ?? -1]?.trim();
    if (!rawDate) continue;

    const dateStr = normalizeDate(rawDate);
    if (!dateStr) continue;

    let day = dayMap.get(dateStr);
    if (!day) {
      day = {
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
      dayMap.set(dateStr, day);
    }

    if (colMap.steps !== undefined) {
      const v = parseNum(cols[colMap.steps]);
      if (v !== null) day.steps = (day.steps ?? 0) + v;
    }
    if (colMap.calories !== undefined) {
      const v = parseNum(cols[colMap.calories]);
      if (v !== null) day.caloriesBurned = Math.round(((day.caloriesBurned ?? 0) + v) * 100) / 100;
    }
    if (colMap.distance !== undefined) {
      const v = parseNum(cols[colMap.distance]);
      if (v !== null) {
        const meters = v >= 100 ? v : Math.round(v * 1000);
        day.distanceMeters = (day.distanceMeters ?? 0) + meters;
      }
    }
    if (colMap.activeMinutes !== undefined) {
      const v = parseNum(cols[colMap.activeMinutes]);
      if (v !== null) day.activeMinutes = (day.activeMinutes ?? 0) + v;
    }
    if (colMap.heartRate !== undefined) {
      const v = parseNum(cols[colMap.heartRate]);
      if (v !== null && v > 0) day.heartRateAvg = Math.round(v);
    }
    if (colMap.floors !== undefined) {
      const v = parseNum(cols[colMap.floors]);
      if (v !== null) day.floorsClimbed = (day.floorsClimbed ?? 0) + v;
    }
  }

  return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Import parsed Garmin data into the fitness cache.
 */
export async function importGarminData(
  userId: string,
  data: DailyFitnessData[],
): Promise<GarminImportResult> {
  const client = getSupabaseClient();
  if (!client || !data.length) {
    return { imported: 0, skipped: 0, errors: ['No data to import'] };
  }

  const result: GarminImportResult = { imported: 0, skipped: 0, errors: [] };

  const upsertRows = data.map(r => ({
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
    source: 'garmin',
    synced_at: new Date().toISOString(),
  }));

  const { error } = await client
    .from('myday_fitness_data')
    .upsert(upsertRows, { onConflict: 'user_id,date' });

  if (error) {
    result.errors.push(error.message);
  } else {
    result.imported = data.length;
  }

  return result;
}

// ── Column resolution ────────────────────────────────────────────────

interface ColumnMap {
  date?: number;
  steps?: number;
  calories?: number;
  distance?: number;
  activeMinutes?: number;
  heartRate?: number;
  floors?: number;
}

const COL_PATTERNS: Record<keyof ColumnMap, RegExp[]> = {
  date: [/\bdate\b/, /\bday\b/, /\btime\b/],
  steps: [/\bsteps?\b/, /\btotal.?steps?\b/],
  calories: [/\bcalories?\b/, /\bcal\b/, /\bkcal\b/, /\bcalories.?burned\b/],
  distance: [/\bdistance\b/, /\btotal.?distance\b/, /\bkm\b/],
  activeMinutes: [/\bactive.?min/, /\bintensity.?min/, /\bmoderate/, /\bvigorous/],
  heartRate: [/\bheart.?rate\b/, /\bavg.?hr\b/, /\bhr\b/],
  floors: [/\bfloors?\b/, /\bflights?\b/, /\bfloors?.?climbed\b/],
};

function resolveColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  for (const [field, patterns] of Object.entries(COL_PATTERNS)) {
    for (let i = 0; i < headers.length; i++) {
      if (patterns.some(p => p.test(headers[i]))) {
        (map as any)[field] = i;
        break;
      }
    }
  }
  return map;
}

// ── CSV parsing (handles quoted fields with commas) ──────────────────

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Date normalization ───────────────────────────────────────────────

function normalizeDate(raw: string): string | null {
  // Try ISO format first (2026-03-31)
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }
  // Try US format (03/31/2026 or 3/31/2026)
  const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
  }
  // Try European format (31/03/2026 or 31-03-2026)
  const euMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (euMatch) {
    const day = parseInt(euMatch[1]);
    const month = parseInt(euMatch[2]);
    if (day > 12) {
      return `${euMatch[3]}-${euMatch[2].padStart(2, '0')}-${euMatch[1].padStart(2, '0')}`;
    }
    return `${euMatch[3]}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }
  // Try Date constructor as fallback
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch { /* ignore */ }
  return null;
}

function parseNum(val: string | undefined): number | null {
  if (!val || val.trim() === '' || val === '--') return null;
  const cleaned = val.replace(/[,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}
