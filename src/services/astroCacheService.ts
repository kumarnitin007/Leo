import { getCurrentUser, getSupabaseClient } from '../lib/supabase';

const LOCAL_STORAGE_KEY = 'astro_response_cache';

type AstroLocalEntry = { data: unknown; fetchedAt: string };
type AstroLocalByCallKey = Record<string, AstroLocalEntry>;
type AstroLocalRoot = Record<string, AstroLocalByCallKey>;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readLocalRoot(): AstroLocalRoot {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as AstroLocalRoot;
  } catch {
    return {};
  }
}

function writeLocalRoot(root: AstroLocalRoot): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(root));
  } catch {
    /* silent */
  }
}

function saveLocalCache(apiAction: string, callKey: string, responseData: unknown): void {
  try {
    const root = readLocalRoot();
    if (!root[apiAction]) root[apiAction] = {};
    root[apiAction][callKey] = {
      data: responseData,
      fetchedAt: new Date().toISOString(),
    };
    writeLocalRoot(root);
  } catch {
    /* silent */
  }
}

function getLocalExact(
  apiAction: string,
  callKey: string
): { data: unknown; fetchedAt: string } | null {
  try {
    const root = readLocalRoot();
    const entry = root[apiAction]?.[callKey];
    if (!entry) return null;
    return { data: entry.data, fetchedAt: entry.fetchedAt };
  } catch {
    return null;
  }
}

function getLocalLastForAction(
  apiAction: string
): { data: unknown; fetchedAt: string; callKey: string } | null {
  try {
    const byKey = readLocalRoot()[apiAction];
    if (!byKey) return null;
    let best: { callKey: string; fetchedAt: string; data: unknown } | null = null;
    for (const [callKey, entry] of Object.entries(byKey)) {
      if (!entry?.fetchedAt) continue;
      if (!best || entry.fetchedAt > best.fetchedAt) {
        best = { callKey, fetchedAt: entry.fetchedAt, data: entry.data };
      }
    }
    if (!best) return null;
    return { data: best.data, fetchedAt: best.fetchedAt, callKey: best.callKey };
  } catch {
    return null;
  }
}

export function makeCacheKey(params: Record<string, any>): string {
  try {
    const sortedKeys = Object.keys(params).sort();
    const sorted: Record<string, any> = {};
    for (const k of sortedKeys) {
      sorted[k] = params[k];
    }
    return JSON.stringify(sorted);
  } catch {
    return '{}';
  }
}

export async function saveAstroCache(
  apiAction: string,
  params: Record<string, any>,
  responseData: any
): Promise<void> {
  try {
    const callKey = makeCacheKey(params);
    const client = getSupabaseClient();
    if (!client) {
      saveLocalCache(apiAction, callKey, responseData);
      return;
    }
    const user = await getCurrentUser();
    if (!user) return;

    const fetchedAt = new Date().toISOString();
    await client.from('myday_astro_cache').upsert(
      {
        user_id: user.id,
        api_action: apiAction,
        call_key: callKey,
        response_data: responseData,
        fetched_at: fetchedAt,
      },
      { onConflict: 'user_id,api_action,call_key' }
    );
  } catch {
    /* silent */
  }
}

export async function getAstroCache(
  apiAction: string,
  params: Record<string, any>
): Promise<{ data: any; fetchedAt: string } | null> {
  try {
    const callKey = makeCacheKey(params);
    const client = getSupabaseClient();
    if (!client) {
      const local = getLocalExact(apiAction, callKey);
      if (!local) return null;
      return { data: local.data, fetchedAt: local.fetchedAt };
    }

    const user = await getCurrentUser();
    if (!user) return null;

    const { data: row, error } = await client
      .from('myday_astro_cache')
      .select('response_data, fetched_at')
      .eq('user_id', user.id)
      .eq('api_action', apiAction)
      .eq('call_key', callKey)
      .maybeSingle();

    if (error || !row) return null;
    return {
      data: row.response_data,
      fetchedAt: typeof row.fetched_at === 'string' ? row.fetched_at : String(row.fetched_at),
    };
  } catch {
    return null;
  }
}

export async function getLastSuccessfulAstroCache(
  apiAction: string
): Promise<{ data: any; fetchedAt: string; callKey: string } | null> {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return getLocalLastForAction(apiAction);
    }

    const user = await getCurrentUser();
    if (!user) return null;

    const { data: rows, error } = await client
      .from('myday_astro_cache')
      .select('response_data, fetched_at, call_key')
      .eq('user_id', user.id)
      .eq('api_action', apiAction)
      .order('fetched_at', { ascending: false })
      .limit(1);

    if (error || !rows?.length) return null;
    const row = rows[0] as {
      response_data: unknown;
      fetched_at: string;
      call_key: string;
    };
    return {
      data: row.response_data,
      fetchedAt: typeof row.fetched_at === 'string' ? row.fetched_at : String(row.fetched_at),
      callKey: row.call_key,
    };
  } catch {
    return null;
  }
}
