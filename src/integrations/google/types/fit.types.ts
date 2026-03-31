/**
 * Google Fit data types
 */

export interface DailyFitnessData {
  date: string;
  steps: number | null;
  caloriesBurned: number | null;
  distanceMeters: number | null;
  activeMinutes: number | null;
  heartRateAvg: number | null;
  heartRateMin: number | null;
  heartRateMax: number | null;
  sleepMinutes: number | null;
  weightKg: number | null;
  floorsClimbed: number | null;
}

export interface FitAggregateRequest {
  aggregateBy: { dataTypeName: string }[];
  bucketByTime: { durationMillis: number };
  startTimeMillis: number;
  endTimeMillis: number;
}

export interface FitAggregateResponse {
  bucket: FitBucket[];
}

export interface FitBucket {
  startTimeMillis: string;
  endTimeMillis: string;
  dataset: FitDataset[];
}

export interface FitDataset {
  dataSourceId: string;
  point: FitDataPoint[];
}

export interface FitDataPoint {
  startTimeNanos: string;
  endTimeNanos: string;
  dataTypeName: string;
  value: FitValue[];
}

export interface FitValue {
  intVal?: number;
  fpVal?: number;
  mapVal?: { key: string; value: { fpVal?: number; intVal?: number } }[];
}

export interface FitnessDataRow {
  id: string;
  user_id: string;
  date: string;
  steps: number | null;
  calories_burned: number | null;
  distance_meters: number | null;
  active_minutes: number | null;
  heart_rate_avg: number | null;
  heart_rate_min: number | null;
  heart_rate_max: number | null;
  sleep_minutes: number | null;
  weight_kg: number | null;
  floors_climbed: number | null;
  source: string;
  raw_data: unknown;
  synced_at: string;
}
