/**
 * AI Digest Service
 *
 * CRUD for content digests — compact AI-generated summaries of user data
 * (journals, tasks, events, financial) that replace raw text in subsequent
 * AI calls to save input tokens.
 */

import { getSupabaseClient } from '../../lib/supabase';
import type { ContentDigest, StoredDigest, DigestSource } from './types';

const DIGEST_MAX_AGE_DAYS = 3;

// ── Read ──────────────────────────────────────────────────────────────

export async function loadDigests(userId: string): Promise<ContentDigest[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data } = await client
    .from('myday_ai_digests')
    .select('source_type, content_digest, source_date_to')
    .eq('user_id', userId)
    .eq('digest_type', 'content_digest')
    .order('source_date_to', { ascending: false });

  if (!data?.length) return [];

  const latest = new Map<string, ContentDigest>();
  for (const row of data) {
    if (!latest.has(row.source_type)) {
      latest.set(row.source_type, {
        source: row.source_type as DigestSource,
        digest: row.content_digest,
        coversTo: row.source_date_to,
      });
    }
  }
  return Array.from(latest.values());
}

/** Returns only digests that are still fresh (within DIGEST_MAX_AGE_DAYS). */
export async function loadFreshDigests(userId: string): Promise<ContentDigest[]> {
  const all = await loadDigests(userId);
  return all.filter(d => {
    const age = (Date.now() - new Date(d.coversTo).getTime()) / 86400000;
    return age <= DIGEST_MAX_AGE_DAYS;
  });
}

/** Load all stored digests (with metadata) for display. */
export async function loadAllDigestsForUser(userId: string): Promise<StoredDigest[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data } = await client
    .from('myday_ai_digests')
    .select('id, user_id, source_type, content_digest, source_date_to, created_at')
    .eq('user_id', userId)
    .eq('digest_type', 'content_digest')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!data?.length) return [];

  return data.map(r => ({
    id: r.id,
    userId: r.user_id,
    source: r.source_type as DigestSource,
    digest: r.content_digest,
    coversTo: r.source_date_to,
    createdAt: r.created_at,
  }));
}

// ── Write ─────────────────────────────────────────────────────────────

export async function saveDigests(userId: string, digests: ContentDigest[]): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !digests?.length) return;

  for (const d of digests) {
    await client.from('myday_ai_digests').insert({
      user_id: userId,
      digest_type: 'content_digest',
      source_type: d.source,
      content_digest: d.digest,
      source_date_to: d.coversTo,
    });
  }
}

export async function deleteDigest(digestId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  await client.from('myday_ai_digests').delete().eq('id', digestId);
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Returns sources that are NOT covered by a fresh digest. */
export function missingDigestSources(
  digests: ContentDigest[],
  wanted: DigestSource[] = ['journal', 'tasks', 'events', 'financial'],
): DigestSource[] {
  const have = new Set(digests.map(d => d.source));
  return wanted.filter(s => !have.has(s));
}
