/**
 * useGoogleContacts Hook
 *
 * Provides:
 *  - Full/delta sync trigger
 *  - Typeahead search (from local DB cache)
 *  - Contact count and loading states
 *  - Birthday/anniversary contacts for calendar events
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  syncContacts as doSync,
  searchContacts as doSearch,
  loadAllContacts,
  getContactsWithBirthdays,
  getContactsWithAnniversaries,
  getContactCount,
  type SyncResult,
} from '../services/ContactsService';
import type { GoogleContact } from '../types/contacts.types';

export interface GoogleContactsState {
  contacts: GoogleContact[];
  contactCount: number;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  lastSyncResult: SyncResult | null;
  syncContacts: () => Promise<SyncResult | null>;
  searchContacts: (query: string) => Promise<GoogleContact[]>;
  loadAll: () => Promise<void>;
  getBirthdayContacts: () => Promise<GoogleContact[]>;
  getAnniversaryContacts: () => Promise<GoogleContact[]>;
}

export function useGoogleContacts(): GoogleContactsState {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<GoogleContact[]>([]);
  const [contactCount, setContactCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    if (user?.id) {
      getContactCount(user.id).then(setContactCount).catch(() => {});
    }
  }, [user?.id]);

  const syncContactsFn = useCallback(async (): Promise<SyncResult | null> => {
    if (!user?.id) return null;
    setSyncing(true);
    setError(null);
    try {
      const result = await doSync(user.id);
      setLastSyncResult(result);
      setContactCount(result.total || contactCount);
      return result;
    } catch (err: any) {
      const msg = err.message || 'Sync failed';
      setError(msg);
      console.error('[useGoogleContacts] Sync error:', msg);
      return null;
    } finally {
      setSyncing(false);
    }
  }, [user?.id, contactCount]);

  const searchContactsFn = useCallback(async (query: string): Promise<GoogleContact[]> => {
    if (!user?.id) return [];
    try {
      return await doSearch(user.id, query);
    } catch {
      return [];
    }
  }, [user?.id]);

  const loadAll = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const all = await loadAllContacts(user.id);
      setContacts(all);
      setContactCount(all.length);
    } catch (err: any) {
      setError(err.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const getBirthdayContacts = useCallback(async (): Promise<GoogleContact[]> => {
    if (!user?.id) return [];
    return getContactsWithBirthdays(user.id);
  }, [user?.id]);

  const getAnniversaryContacts = useCallback(async (): Promise<GoogleContact[]> => {
    if (!user?.id) return [];
    return getContactsWithAnniversaries(user.id);
  }, [user?.id]);

  return {
    contacts, contactCount, loading, syncing, error, lastSyncResult,
    syncContacts: syncContactsFn,
    searchContacts: searchContactsFn,
    loadAll,
    getBirthdayContacts,
    getAnniversaryContacts,
  };
}
