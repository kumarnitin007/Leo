/**
 * useFitness — Unified Fitness Hook
 *
 * Drop-in replacement for useGoogleFit that works with any provider.
 * Consumers call fetchRecent / loadCached without knowing which provider is active.
 * After every fetch, runs the Tracked Task auto-completion engine.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchFitnessDataUnified,
  loadCachedFitnessDataUnified,
  getActiveProvider,
  isProviderConnected,
} from './UnifiedFitnessService';
import { runAutoComplete } from '../google/services/TrackedTaskEngine';
import { getTasks } from '../../storage/tasks';
import type { DailyFitnessData } from '../google/types/fit.types';
import type { AutoCompleteResult } from '../google/services/TrackedTaskEngine';
import type { FitnessProviderId } from './types';

export interface FitnessState {
  data: DailyFitnessData[];
  loading: boolean;
  error: string | null;
  activeProvider: FitnessProviderId;
  connected: boolean | null;
  lastAutoComplete: AutoCompleteResult | null;
  fetchRecent: (days?: number) => Promise<void>;
  loadCached: (days?: number) => Promise<void>;
}

export function useFitness(): FitnessState {
  const { user } = useAuth();
  const [data, setData] = useState<DailyFitnessData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [lastAutoComplete, setLastAutoComplete] = useState<AutoCompleteResult | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    isProviderConnected(user.id).then(setConnected).catch(() => setConnected(false));
  }, [user?.id]);

  const runTrackedAutoComplete = useCallback(async (fitnessData: DailyFitnessData[]) => {
    if (!user?.id || !fitnessData.length) return;
    try {
      const tasks = await getTasks();
      const hasTracked = tasks.some(t => t.trackedMetric?.autoComplete);
      if (!hasTracked) return;
      const result = await runAutoComplete(tasks, fitnessData, user.id);
      setLastAutoComplete(result);
    } catch (err) {
      console.warn('[useFitness] Auto-complete check failed:', err);
    }
  }, [user?.id]);

  const fetchRecent = useCallback(async (days = 3) => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFitnessDataUnified(user.id, days);
      setData(result);
      await runTrackedAutoComplete(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch fitness data');
    } finally {
      setLoading(false);
    }
  }, [user?.id, runTrackedAutoComplete]);

  const loadCached = useCallback(async (days = 7) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const cached = await loadCachedFitnessDataUnified(user.id, days);
      setData(cached);
      await runTrackedAutoComplete(cached);
    } catch {
      // Cache miss is not an error
    } finally {
      setLoading(false);
    }
  }, [user?.id, runTrackedAutoComplete]);

  return {
    data,
    loading,
    error,
    activeProvider: getActiveProvider(),
    connected,
    lastAutoComplete,
    fetchRecent,
    loadCached,
  };
}
