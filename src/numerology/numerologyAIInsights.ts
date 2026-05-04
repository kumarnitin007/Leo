/**
 * Numerology AI Insights — calls the OpenAI-backed `/api/astro?action=numerology-vibe`
 * endpoint to fetch the single 3-4 sentence "vibe of the day" paragraph that
 * sits above the deterministic statements on the Plain-English card.
 *
 * Caching strategy:
 *   - Cache key = profile signature + YYYY-MM-DD (so the paragraph refreshes
 *     daily, but never within the same day).
 *   - Stored via `saveAstroCache` / `getAstroCache` (same plumbing the
 *     Cosmic Fingerprint feature already uses — no new infra). Falls back
 *     to localStorage when offline / signed out.
 *
 * Audit / cost:
 *   - Every successful network call is logged through `logAICall` against
 *     the new ability `numerology_vibe` so it appears in Settings → AI Usage
 *     stats and `myday_ai_audit_log` like every other AI feature.
 *
 * Performance:
 *   - `perfStart('numerologyAIInsights', 'getDailyVibe')` measures the full
 *     round-trip including cache lookup.
 */

import { saveAstroCache, getAstroCache } from '../services/astroCacheService';
import { logAICall } from '../services/ai/aiAuditService';
import { perfStart } from '../utils/perfLogger';
import type { NumerologyProfile } from './numerologyEngine';
import { compactProfileForPrompt } from './numerologyInsights';

/** YYYY-MM-DD in local time. */
function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Stable signature of the profile so cache invalidates on name/DOB change. */
function profileSignature(p: NumerologyProfile): string {
  return `${p.lifePath}-${p.expression}-${p.soulUrge}-${p.personality}-${p.birthday}-${p.maturity}-${p.personalYear}-${p.personalMonth}-${p.personalDay}-${p.luckyNumbers.join(',')}`;
}

export interface DailyVibeResult {
  paragraph: string;
  fetchedAt: string; // ISO string
  fromCache: boolean;
}

export async function getDailyVibe(
  profile: NumerologyProfile,
  userId: string | null,
  today: Date = new Date(),
): Promise<DailyVibeResult | null> {
  const endPerf = perfStart('numerologyAIInsights', 'getDailyVibe');
  const cacheParams = {
    sig: profileSignature(profile),
    date: todayKey(today),
  };

  // 1) Cache hit?
  const cached = await getAstroCache('numerology-vibe', cacheParams);
  if (cached?.data && typeof (cached.data as any).paragraph === 'string') {
    endPerf();
    return {
      paragraph: (cached.data as any).paragraph,
      fetchedAt: cached.fetchedAt,
      fromCache: true,
    };
  }

  // 2) Network call
  const profileSummary = compactProfileForPrompt(profile);
  try {
    const r = await fetch('/api/astro?action=numerology-vibe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileSummary, today: todayKey(today) }),
    });
    if (!r.ok) {
      endPerf();
      console.warn('[numerologyAIInsights] vibe call failed:', r.status);
      return null;
    }
    const data = await r.json();
    const paragraph = (data?.paragraph || '').trim();
    if (!paragraph) {
      endPerf();
      return null;
    }

    // 3) Cache for the rest of the day
    await saveAstroCache('numerology-vibe', cacheParams, { paragraph });

    // 4) Audit log (fire-and-forget)
    if (userId && data.usage) {
      logAICall({
        userId,
        abilityId: 'numerology_vibe',
        requestPayload: { profileSummary },
        systemPrompt: data.systemPrompt || '',
        userMessage: data.userMessage || '',
        responsePayload: { paragraph },
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
      }).catch(() => { /* silent: audit failures must not break the UX */ });
    }

    endPerf();
    return {
      paragraph,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
    };
  } catch (e) {
    endPerf();
    console.warn('[numerologyAIInsights] vibe error:', e);
    return null;
  }
}
