/**
 * Unified Fitness Provider Types
 *
 * Shared types used by all fitness integrations (Google Fit, Fitbit, Garmin).
 * The DailyFitnessData interface is re-exported from here as the canonical type.
 */

export type FitnessProviderId = 'google_fit' | 'fitbit' | 'garmin';

export interface FitnessProviderMeta {
  id: FitnessProviderId;
  name: string;
  icon: string;
  description: string;
  authType: 'oauth' | 'manual_import';
  setupUrl?: string;
}

export const FITNESS_PROVIDERS: Record<FitnessProviderId, FitnessProviderMeta> = {
  google_fit: {
    id: 'google_fit',
    name: 'Google Fit',
    icon: '🏃',
    description: 'Steps, calories, heart rate, sleep via Google Fit API',
    authType: 'oauth',
    setupUrl: 'https://console.cloud.google.com/',
  },
  fitbit: {
    id: 'fitbit',
    name: 'Fitbit',
    icon: '⌚',
    description: 'Steps, calories, heart rate, sleep via Fitbit Web API',
    authType: 'oauth',
    setupUrl: 'https://dev.fitbit.com/apps/',
  },
  garmin: {
    id: 'garmin',
    name: 'Garmin Connect',
    icon: '🧭',
    description: 'Import daily summaries from Garmin Connect CSV export',
    authType: 'manual_import',
    setupUrl: 'https://connect.garmin.com/',
  },
};

export const FITNESS_PROVIDER_IDS: FitnessProviderId[] = ['google_fit', 'fitbit', 'garmin'];
