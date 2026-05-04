/**
 * Numerology custom questions service.
 *
 * Handles CRUD against `myday_numerology_questions` (MYNQ in the schema doc)
 * plus per-question AI answers cached daily in `myday_astro_cache`.
 *
 * Why answers aren't stored in the questions table:
 *   The answer is supposed to refresh once per day because the user's
 *   Personal Day / Month / Year change daily. Storing the answer alongside
 *   the question would force us to add another date column and write
 *   timestamp-aware updates. Caching via the existing `myday_astro_cache`
 *   table is cheaper, already RLS-scoped to the user, and free for us
 *   schema-wise.
 *
 * Limit:
 *   Enforced both client-side (the UI button is disabled at the cap) and
 *   server-side here (`createQuestion` rejects above NUMEROLOGY_CUSTOM_Q_MAX).
 *   Tweak `NUMEROLOGY_CUSTOM_Q_MAX` in `numerologyInsights.ts` to change it.
 *
 * Performance:
 *   Each network operation is wrapped in `perfStart` so we can spot regressions.
 *   The AI call itself returns a short answer (~280 tokens) and is gated by
 *   the cache so typical days fire 0 calls.
 */

import { getSupabaseClient } from '../lib/supabase';
import { saveAstroCache, getAstroCache } from '../services/astroCacheService';
import { logAICall } from '../services/ai/aiAuditService';
import { perfStart } from '../utils/perfLogger';
import {
  NUMEROLOGY_CUSTOM_Q_MAX,
  compactProfileForPrompt,
} from './numerologyInsights';
import type { NumerologyProfile } from './numerologyEngine';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NumerologyQuestion {
  id: string;
  userId: string;
  question: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface NumerologyAnswer {
  text: string;
  fetchedAt: string;
  fromCache: boolean;
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── CRUD: questions ──────────────────────────────────────────────────────────

export async function listQuestions(userId: string): Promise<NumerologyQuestion[]> {
  const endPerf = perfStart('numerologyCustomQuestions', 'listQuestions');
  const client = getSupabaseClient();
  if (!client) {
    endPerf();
    return [];
  }
  const { data, error } = await client
    .from('myday_numerology_questions')
    .select('id, user_id, question, position, created_at, updated_at')
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  endPerf();
  if (error || !data) return [];
  return data.map(rowToQuestion);
}

export async function createQuestion(
  userId: string,
  question: string,
): Promise<NumerologyQuestion | { error: string }> {
  const endPerf = perfStart('numerologyCustomQuestions', 'createQuestion');
  const trimmed = question.trim();
  if (trimmed.length < 3 || trimmed.length > 240) {
    endPerf();
    return { error: 'Question must be between 3 and 240 characters.' };
  }
  const client = getSupabaseClient();
  if (!client) {
    endPerf();
    return { error: 'Not signed in.' };
  }

  // Server-side limit check (RLS guarantees scope).
  const { count, error: countErr } = await client
    .from('myday_numerology_questions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countErr) {
    endPerf();
    return { error: countErr.message };
  }
  if ((count ?? 0) >= NUMEROLOGY_CUSTOM_Q_MAX) {
    endPerf();
    return { error: `You can save up to ${NUMEROLOGY_CUSTOM_Q_MAX} questions.` };
  }

  const { data, error } = await client
    .from('myday_numerology_questions')
    .insert({
      user_id: userId,
      question: trimmed,
      position: count ?? 0,
    })
    .select('id, user_id, question, position, created_at, updated_at')
    .single();

  endPerf();
  if (error || !data) return { error: error?.message || 'Failed to save question.' };
  return rowToQuestion(data);
}

export async function updateQuestion(
  userId: string,
  questionId: string,
  newText: string,
): Promise<NumerologyQuestion | { error: string }> {
  const endPerf = perfStart('numerologyCustomQuestions', 'updateQuestion');
  const trimmed = newText.trim();
  if (trimmed.length < 3 || trimmed.length > 240) {
    endPerf();
    return { error: 'Question must be between 3 and 240 characters.' };
  }
  const client = getSupabaseClient();
  if (!client) {
    endPerf();
    return { error: 'Not signed in.' };
  }
  const { data, error } = await client
    .from('myday_numerology_questions')
    .update({ question: trimmed, updated_at: new Date().toISOString() })
    .eq('id', questionId)
    .eq('user_id', userId)
    .select('id, user_id, question, position, created_at, updated_at')
    .single();
  endPerf();
  if (error || !data) return { error: error?.message || 'Failed to update question.' };
  return rowToQuestion(data);
}

export async function deleteQuestion(
  userId: string,
  questionId: string,
): Promise<{ ok: true } | { error: string }> {
  const endPerf = perfStart('numerologyCustomQuestions', 'deleteQuestion');
  const client = getSupabaseClient();
  if (!client) {
    endPerf();
    return { error: 'Not signed in.' };
  }
  const { error } = await client
    .from('myday_numerology_questions')
    .delete()
    .eq('id', questionId)
    .eq('user_id', userId);
  endPerf();
  if (error) return { error: error.message };
  return { ok: true };
}

// ── AI answer (per-question, daily cache) ────────────────────────────────────

/**
 * Get today's answer for a single question. Re-uses the cache for the rest
 * of the day so the same question never costs us more than one OpenAI call
 * per user per day.
 */
export async function getAnswerForQuestion(
  question: NumerologyQuestion,
  profile: NumerologyProfile,
  today: Date = new Date(),
): Promise<NumerologyAnswer | null> {
  const endPerf = perfStart('numerologyCustomQuestions', 'getAnswerForQuestion');
  const cacheParams = {
    qid: question.id,
    // Include question text so editing a question invalidates the cache
    // automatically (the row's updated_at also changes but that's not in
    // the call_key).
    qhash: simpleHash(question.question),
    date: todayKey(today),
  };

  // 1) Cache hit?
  const cached = await getAstroCache('numerology-question', cacheParams);
  if (cached?.data && typeof (cached.data as any).answer === 'string') {
    endPerf();
    return {
      text: (cached.data as any).answer,
      fetchedAt: cached.fetchedAt,
      fromCache: true,
    };
  }

  // 2) Network call
  try {
    const profileSummary = compactProfileForPrompt(profile);
    const r = await fetch('/api/astro?action=numerology-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileSummary,
        question: question.question,
        today: todayKey(today),
      }),
    });
    if (!r.ok) {
      endPerf();
      return null;
    }
    const data = await r.json();
    const answer = (data?.answer || '').trim();
    if (!answer) {
      endPerf();
      return null;
    }

    // 3) Cache for the rest of the day
    await saveAstroCache('numerology-question', cacheParams, { answer });

    // 4) Audit log
    if (question.userId && data.usage) {
      logAICall({
        userId: question.userId,
        abilityId: 'numerology_question',
        requestPayload: { questionId: question.id, profileSummary },
        systemPrompt: data.systemPrompt || '',
        userMessage: data.userMessage || '',
        responsePayload: { answer },
        rawResponse: JSON.stringify(data),
        usage: {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
          model: data.usage.model || 'gpt-4o-mini',
          costUsd: data.usage.cost_usd || 0,
        },
        durationMs: data.durationMs || 0,
        success: true,
      }).catch(() => { /* silent */ });
    }

    endPerf();
    return {
      text: answer,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
    };
  } catch (e) {
    endPerf();
    console.warn('[numerologyCustomQuestions] AI call failed:', e);
    return null;
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function rowToQuestion(row: any): NumerologyQuestion {
  return {
    id: row.id,
    userId: row.user_id,
    question: row.question,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Tiny non-crypto hash, just for the cache key. */
function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
