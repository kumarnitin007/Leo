/**
 * useGoogleFit Hook
 *
 * Used by JournalView (Milestone 1) and later by Analytics / Goals.
 * Provides fetch + cache of daily fitness data.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchAndCacheFitnessData, loadCachedFitnessData } from '../services/FitService';
import type { DailyFitnessData } from '../types/fit.types';

export interface GoogleFitState {
  data: DailyFitnessData[];
  loading: boolean;
  error: string | null;
  fetchRecent: (days?: number) => Promise<void>;
  loadCached: (days?: number) => Promise<void>;
}

export function useGoogleFit(): GoogleFitState {
  const { user } = useAuth();
  const [data, setData] = useState<DailyFitnessData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecent = useCallback(async (days = 3) => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAndCacheFitnessData(user.id, days);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch fitness data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadCached = useCallback(async (days = 7) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const cached = await loadCachedFitnessData(user.id, days);
      setData(cached);
    } catch {
      // Cache miss is not an error
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  return { data, loading, error, fetchRecent, loadCached };
}
