/**
 * Google Contacts Service
 *
 * Uses People API v1 to:
 *  - Full sync on first connect; delta sync via syncToken afterwards
 *  - Upsert into myday_contacts
 *  - Provide search/typeahead data for tasks, events, groups
 *  - Auto-create birthday/anniversary events in Leo Calendar
 *
 * All API calls go through GoogleApiClient for automatic token handling.
 */

import { googleApiFetch } from '../GoogleApiClient';
import { getSupabaseClient } from '../../../lib/supabase';
import { GOOGLE_API } from '../constants';
import type { GoogleContact, ContactRow } from '../types/contacts.types';

const PERSON_FIELDS = 'names,emailAddresses,phoneNumbers,birthdays,events,biographies,photos,organizations';
const PAGE_SIZE = 200;
const SYNC_TOKEN_KEY = 'myday_contacts_sync_token';

// ── Full & delta sync ──────────────────────────────────────────────────

export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  total: number;
}

/**
 * Sync contacts from Google People API.
 * First call does a full sync; subsequent calls use syncToken for delta.
 */
export async function syncContacts(userId: string): Promise<SyncResult> {
  const savedToken = getSyncToken(userId);
  if (savedToken) {
    try {
      return await deltaSyncContacts(userId, savedToken);
    } catch (err: any) {
      // If sync token is expired/invalid (410 Gone), fall back to full sync
      if (err.message?.includes('410') || err.message?.includes('sync token')) {
        console.warn('[ContactsService] Sync token expired, falling back to full sync');
        clearSyncToken(userId);
      } else {
        throw err;
      }
    }
  }
  return fullSyncContacts(userId);
}

async function fullSyncContacts(userId: string): Promise<SyncResult> {
  console.info('[ContactsService] Starting full sync...');
  const allContacts: GoogleContact[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  do {
    const params = new URLSearchParams({
      personFields: PERSON_FIELDS,
      pageSize: String(PAGE_SIZE),
      requestSyncToken: 'true',
      sortOrder: 'FIRST_NAME_ASCENDING',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const url = `${GOOGLE_API.PEOPLE}/people/me/connections?${params.toString()}`;
    const res = await googleApiFetch<PeopleListResponse>(userId, url);

    if (res.connections) {
      allContacts.push(...res.connections.map(parseConnection));
    }

    pageToken = res.nextPageToken;
    if (res.nextSyncToken) nextSyncToken = res.nextSyncToken;
  } while (pageToken);

  const result = await upsertContacts(userId, allContacts);

  if (nextSyncToken) saveSyncToken(userId, nextSyncToken);
  console.info(`[ContactsService] Full sync complete — ${allContacts.length} contacts`);

  return { ...result, total: allContacts.length };
}

async function deltaSyncContacts(userId: string, syncToken: string): Promise<SyncResult> {
  console.info('[ContactsService] Starting delta sync...');
  const updated: GoogleContact[] = [];
  const deletedResourceNames: string[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  do {
    const params = new URLSearchParams({
      personFields: PERSON_FIELDS,
      pageSize: String(PAGE_SIZE),
      requestSyncToken: 'true',
      syncToken,
    });
    if (pageToken) params.set('pageToken', pageToken);

    const url = `${GOOGLE_API.PEOPLE}/people/me/connections?${params.toString()}`;
    const res = await googleApiFetch<PeopleListResponse>(userId, url);

    if (res.connections) {
      for (const conn of res.connections) {
        if (conn.metadata?.deleted) {
          deletedResourceNames.push(conn.resourceName);
        } else {
          updated.push(parseConnection(conn));
        }
      }
    }

    pageToken = res.nextPageToken;
    if (res.nextSyncToken) nextSyncToken = res.nextSyncToken;
  } while (pageToken);

  const result = await upsertContacts(userId, updated);
  const deleted = await deleteContacts(userId, deletedResourceNames);

  if (nextSyncToken) saveSyncToken(userId, nextSyncToken);
  console.info(
    `[ContactsService] Delta sync complete — ${updated.length} updated, ${deleted} deleted`,
  );

  return { added: result.added, updated: result.updated, deleted, total: result.total };
}

// ── Search (local DB) ──────────────────────────────────────────────────

export async function searchContacts(
  userId: string,
  query: string,
): Promise<GoogleContact[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const q = query.trim().toLowerCase();
  if (!q) return [];

  const { data } = await client
    .from('myday_contacts')
    .select('*')
    .eq('user_id', userId)
    .or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,organization.ilike.%${q}%`)
    .order('name', { ascending: true })
    .limit(20);

  if (!data?.length) return [];
  return data.map(rowToContact);
}

/**
 * Load all contacts from local cache (for typeahead list).
 */
export async function loadAllContacts(userId: string): Promise<GoogleContact[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data } = await client
    .from('myday_contacts')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (!data?.length) return [];
  return data.map(rowToContact);
}

/**
 * Get contacts that have birthdays (for calendar event creation).
 */
export async function getContactsWithBirthdays(userId: string): Promise<GoogleContact[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data } = await client
    .from('myday_contacts')
    .select('*')
    .eq('user_id', userId)
    .not('birthday', 'is', null)
    .order('name', { ascending: true });

  if (!data?.length) return [];
  return data.map(rowToContact);
}

/**
 * Get contacts that have anniversaries (for calendar event creation).
 */
export async function getContactsWithAnniversaries(userId: string): Promise<GoogleContact[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data } = await client
    .from('myday_contacts')
    .select('*')
    .eq('user_id', userId)
    .not('anniversary', 'is', null)
    .order('name', { ascending: true });

  if (!data?.length) return [];
  return data.map(rowToContact);
}

/**
 * Get total contact count from local cache.
 */
export async function getContactCount(userId: string): Promise<number> {
  const client = getSupabaseClient();
  if (!client) return 0;

  const { count } = await client
    .from('myday_contacts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return count ?? 0;
}

/**
 * Update local tags for a contact (two-way sync of notes planned later).
 */
export async function updateContactTags(
  userId: string,
  contactId: string,
  tags: string[],
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  await client
    .from('myday_contacts')
    .update({ leo_tags: tags })
    .eq('user_id', userId)
    .eq('id', contactId);
}

// ── DB helpers ─────────────────────────────────────────────────────────

async function upsertContacts(
  userId: string,
  contacts: GoogleContact[],
): Promise<{ added: number; updated: number; total: number }> {
  const client = getSupabaseClient();
  if (!client || !contacts.length) return { added: 0, updated: 0, total: 0 };

  const rows = contacts.map(c => ({
    user_id: userId,
    google_resource_name: c.resourceName,
    name: c.name,
    email: c.email,
    phone: c.phone,
    birthday: c.birthday,
    anniversary: c.anniversary,
    photo_url: c.photoUrl,
    organization: c.organization,
    notes: c.notes,
    last_synced: new Date().toISOString(),
  }));

  // Batch upsert in chunks of 100
  let totalUpserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await client
      .from('myday_contacts')
      .upsert(chunk, { onConflict: 'user_id,google_resource_name' });

    if (error) {
      console.error(`[ContactsService] Upsert error (batch ${i / 100 + 1}):`, error.message);
    } else {
      totalUpserted += chunk.length;
    }
  }

  return { added: totalUpserted, updated: 0, total: totalUpserted };
}

async function deleteContacts(userId: string, resourceNames: string[]): Promise<number> {
  if (!resourceNames.length) return 0;
  const client = getSupabaseClient();
  if (!client) return 0;

  const { error, count } = await client
    .from('myday_contacts')
    .delete({ count: 'exact' })
    .eq('user_id', userId)
    .in('google_resource_name', resourceNames);

  if (error) console.error('[ContactsService] Delete error:', error.message);
  return count ?? 0;
}

// ── Parse Google People API response ───────────────────────────────────

function parseConnection(conn: PeopleConnection): GoogleContact {
  const name = conn.names?.[0]?.displayName || null;
  const email = conn.emailAddresses?.[0]?.value || null;
  const phone = conn.phoneNumbers?.[0]?.value || null;
  const photoUrl = conn.photos?.[0]?.url || null;
  const organization = conn.organizations?.[0]?.name || null;
  const notes = conn.biographies?.[0]?.value || null;

  let birthday: string | null = null;
  if (conn.birthdays?.[0]?.date) {
    const bd = conn.birthdays[0].date;
    if (bd.month && bd.day) {
      birthday = bd.year
        ? `${bd.year}-${String(bd.month).padStart(2, '0')}-${String(bd.day).padStart(2, '0')}`
        : `${String(bd.month).padStart(2, '0')}-${String(bd.day).padStart(2, '0')}`;
    }
  }

  let anniversary: string | null = null;
  const annEvent = conn.events?.find(e => e.type === 'anniversary');
  if (annEvent?.date) {
    const ad = annEvent.date;
    if (ad.month && ad.day) {
      anniversary = ad.year
        ? `${ad.year}-${String(ad.month).padStart(2, '0')}-${String(ad.day).padStart(2, '0')}`
        : `${String(ad.month).padStart(2, '0')}-${String(ad.day).padStart(2, '0')}`;
    }
  }

  return {
    resourceName: conn.resourceName,
    name, email, phone, birthday, anniversary,
    photoUrl, organization, notes,
  };
}

function rowToContact(row: ContactRow): GoogleContact {
  return {
    resourceName: row.google_resource_name,
    name: row.name,
    email: row.email,
    phone: row.phone,
    birthday: row.birthday,
    anniversary: row.anniversary,
    photoUrl: row.photo_url,
    organization: row.organization,
    notes: row.notes,
  };
}

// ── Sync token persistence (sessionStorage + localStorage) ─────────────

function getSyncToken(userId: string): string | null {
  return localStorage.getItem(`${SYNC_TOKEN_KEY}_${userId}`);
}

function saveSyncToken(userId: string, token: string): void {
  localStorage.setItem(`${SYNC_TOKEN_KEY}_${userId}`, token);
}

function clearSyncToken(userId: string): void {
  localStorage.removeItem(`${SYNC_TOKEN_KEY}_${userId}`);
}

// ── Google People API types (internal) ─────────────────────────────────

interface PeopleListResponse {
  connections?: PeopleConnection[];
  nextPageToken?: string;
  nextSyncToken?: string;
  totalPeople?: number;
}

interface PeopleConnection {
  resourceName: string;
  metadata?: { deleted?: boolean };
  names?: { displayName: string }[];
  emailAddresses?: { value: string }[];
  phoneNumbers?: { value: string }[];
  birthdays?: { date: GoogleDate }[];
  events?: { date: GoogleDate; type: string }[];
  biographies?: { value: string }[];
  photos?: { url: string }[];
  organizations?: { name: string }[];
}

interface GoogleDate {
  year?: number;
  month?: number;
  day?: number;
}
