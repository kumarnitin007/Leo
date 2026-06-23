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
import type {
  GoogleContact,
  ContactRow,
  ContactDetails,
} from '../types/contacts.types';

const PERSON_FIELDS = [
  'names', 'nicknames', 'emailAddresses', 'phoneNumbers', 'addresses',
  'organizations', 'occupations', 'birthdays', 'events', 'biographies',
  'photos', 'urls', 'imClients', 'relations', 'userDefined',
].join(',');
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

  return { ...result, deleted: 0, total: allContacts.length };
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

/**
 * Toggle/set the local favourite flag for a contact (by row id).
 */
export async function updateContactFavorite(
  userId: string,
  contactId: string,
  isFavorite: boolean,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  await client
    .from('myday_contacts')
    .update({ is_favorite: isFavorite })
    .eq('user_id', userId)
    .eq('id', contactId);
}

// ── Upcoming dates (dashboard reminders) ───────────────────────────────

export interface UpcomingContactDate {
  contactId: string;
  resourceName: string;
  name: string | null;
  photoUrl: string | null;
  isFavorite: boolean;
  type: 'birthday' | 'anniversary';
  /** Stored value (MM-DD or YYYY-MM-DD). */
  date: string;
  /** Next occurrence as YYYY-MM-DD. */
  nextDate: string;
  daysUntil: number;
  /** Age/years turning, when the original year is known. */
  age: number | null;
}

function nextOccurrence(dateStr: string, from: Date): { nextDate: string; daysUntil: number; year: number | null } | null {
  const parts = dateStr.split('-').map(Number);
  let year: number | null = null;
  let month: number;
  let day: number;
  if (parts.length === 3) {
    [year, month, day] = parts;
  } else if (parts.length === 2) {
    [month, day] = parts;
  } else {
    return null;
  }
  if (!month || !day) return null;

  const fromMid = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let next = new Date(fromMid.getFullYear(), month - 1, day);
  if (next.getTime() < fromMid.getTime()) {
    next = new Date(fromMid.getFullYear() + 1, month - 1, day);
  }
  const daysUntil = Math.round((next.getTime() - fromMid.getTime()) / 86400000);
  const nextDate = `${next.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { nextDate, daysUntil, year };
}

/**
 * Contacts whose birthday/anniversary falls within the next `windowDays`.
 * Favourites first, then by soonest. Used by the dashboard reminders widget.
 */
export async function getUpcomingContactDates(
  userId: string,
  windowDays = 30,
): Promise<UpcomingContactDate[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data } = await client
    .from('myday_contacts')
    .select('id, google_resource_name, name, photo_url, is_favorite, birthday, anniversary')
    .eq('user_id', userId)
    .or('birthday.not.is.null,anniversary.not.is.null');

  if (!data?.length) return [];

  const now = new Date();
  const out: UpcomingContactDate[] = [];

  for (const row of data as Array<Partial<ContactRow>>) {
    const fields: { type: 'birthday' | 'anniversary'; value: string | null | undefined }[] = [
      { type: 'birthday', value: row.birthday },
      { type: 'anniversary', value: row.anniversary },
    ];
    for (const f of fields) {
      if (!f.value) continue;
      const occ = nextOccurrence(f.value, now);
      if (!occ || occ.daysUntil > windowDays) continue;
      out.push({
        contactId: row.id!,
        resourceName: row.google_resource_name || '',
        name: row.name ?? null,
        photoUrl: row.photo_url ?? null,
        isFavorite: row.is_favorite ?? false,
        type: f.type,
        date: f.value,
        nextDate: occ.nextDate,
        daysUntil: occ.daysUntil,
        age: occ.year ? Number(occ.nextDate.slice(0, 4)) - occ.year : null,
      });
    }
  }

  out.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return a.daysUntil - b.daysUntil;
  });
  return out;
}

// ── DB helpers ─────────────────────────────────────────────────────────

async function upsertContacts(
  userId: string,
  contacts: GoogleContact[],
): Promise<{ added: number; updated: number; total: number }> {
  const client = getSupabaseClient();
  if (!client || !contacts.length) return { added: 0, updated: 0, total: 0 };

  // NOTE: is_favorite and leo_tags are intentionally omitted so an upsert never
  // clobbers a user's local favourite/tag choices on re-sync (new rows fall back
  // to the DB column default of false / null).
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
    raw_details: c.details ?? null,
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

function formatGoogleDate(d?: GoogleDate): string | null {
  if (!d || !d.month || !d.day) return null;
  const mm = String(d.month).padStart(2, '0');
  const dd = String(d.day).padStart(2, '0');
  return d.year ? `${d.year}-${mm}-${dd}` : `${mm}-${dd}`;
}

function parseConnection(conn: PeopleConnection): GoogleContact {
  const name = conn.names?.[0]?.displayName || null;
  const email = conn.emailAddresses?.[0]?.value || null;
  const phone = conn.phoneNumbers?.[0]?.value || null;
  const photoUrl = conn.photos?.[0]?.url || null;
  const organization = conn.organizations?.[0]?.name || null;
  const notes = conn.biographies?.[0]?.value || null;

  const birthday = formatGoogleDate(conn.birthdays?.[0]?.date);
  const annEvent = conn.events?.find(e => (e.type || '').toLowerCase() === 'anniversary');
  const anniversary = formatGoogleDate(annEvent?.date);

  // Full detail (everything People returned) → stored as JSONB.
  const details: ContactDetails = {
    emails: (conn.emailAddresses || [])
      .filter(e => e.value)
      .map(e => ({ value: e.value!, type: e.type || null })),
    phones: (conn.phoneNumbers || [])
      .filter(p => p.value)
      .map(p => ({ value: p.value!, type: p.type || null })),
    addresses: (conn.addresses || []).map(a => ({
      formatted: a.formattedValue || null,
      type: a.type || null,
      street: a.streetAddress || null,
      city: a.city || null,
      region: a.region || null,
      postalCode: a.postalCode || null,
      country: a.country || null,
    })),
    organizations: (conn.organizations || []).map(o => ({
      name: o.name || null,
      title: o.title || null,
      department: o.department || null,
    })),
    occupations: (conn.occupations || []).map(o => o.value).filter(Boolean) as string[],
    nicknames: (conn.nicknames || []).map(n => n.value).filter(Boolean) as string[],
    urls: (conn.urls || [])
      .filter(u => u.value)
      .map(u => ({ value: u.value!, type: u.type || null })),
    relations: (conn.relations || [])
      .filter(r => r.person)
      .map(r => ({ person: r.person!, type: r.type || null })),
    ims: (conn.imClients || [])
      .filter(i => i.username)
      .map(i => ({ username: i.username!, protocol: i.protocol || null })),
    events: (conn.events || [])
      .map(e => ({ type: e.type || null, date: formatGoogleDate(e.date) }))
      .filter((e): e is { type: string | null; date: string } => !!e.date),
    userDefined: (conn.userDefined || [])
      .filter(u => u.key && u.value)
      .map(u => ({ key: u.key!, value: u.value! })),
  };

  return {
    resourceName: conn.resourceName,
    name, email, phone, birthday, anniversary,
    photoUrl, organization, notes,
    details,
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
    isFavorite: row.is_favorite ?? false,
    details: row.raw_details ?? null,
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
  nicknames?: { value?: string }[];
  emailAddresses?: { value?: string; type?: string }[];
  phoneNumbers?: { value?: string; type?: string }[];
  addresses?: {
    formattedValue?: string;
    type?: string;
    streetAddress?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  }[];
  birthdays?: { date: GoogleDate }[];
  events?: { date: GoogleDate; type?: string }[];
  biographies?: { value: string }[];
  photos?: { url: string }[];
  organizations?: { name?: string; title?: string; department?: string }[];
  occupations?: { value?: string }[];
  urls?: { value?: string; type?: string }[];
  relations?: { person?: string; type?: string }[];
  imClients?: { username?: string; protocol?: string }[];
  userDefined?: { key?: string; value?: string }[];
}

interface GoogleDate {
  year?: number;
  month?: number;
  day?: number;
}
