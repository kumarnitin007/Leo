/**
 * AI Audit Service
 *
 * Writes every AI call to myday_ai_audit_log and provides read helpers
 * for the usage dashboard.  All writes are fire-and-forget so they never
 * block the main ability flow.
 */

import { getSupabaseClient } from '../../lib/supabase';
import type { AIAbilityId, AIAuditEntry, AIUsage, AIUsageSummary } from './types';

// ── Write ──────────────────────────────────────────────────────────────

export async function logAICall(params: {
  userId: string;
  abilityId: AIAbilityId;
  requestPayload: any;
  systemPrompt: string;
  userMessage: string;
  responsePayload: any;
  rawResponse: string;
  usage: AIUsage;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  await client.from('myday_ai_audit_log').insert({
    user_id: params.userId,
    ability_id: params.abilityId,
    request_payload: params.requestPayload,
    system_prompt: params.systemPrompt,
    user_message: params.userMessage,
    response_payload: params.responsePayload,
    raw_response: params.rawResponse,
    prompt_tokens: params.usage.promptTokens,
    completion_tokens: params.usage.completionTokens,
    total_tokens: params.usage.totalTokens,
    model: params.usage.model,
    cost_usd: params.usage.costUsd,
    duration_ms: params.durationMs,
    success: params.success,
    error_message: params.errorMessage,
  });
}

// ── Read ──────────────────────────────────────────────────────────────

export async function getAuditLog(
  userId: string,
  limit = 50,
  abilityFilter?: AIAbilityId,
): Promise<AIAuditEntry[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  let query = client
    .from('myday_ai_audit_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (abilityFilter) {
    query = query.eq('ability_id', abilityFilter);
  }

  const { data } = await query;
  if (!data) return [];

  return data.map(row => ({
    id: row.id,
    userId: row.user_id,
    abilityId: row.ability_id,
    requestPayload: typeof row.request_payload === 'string' ? row.request_payload : JSON.stringify(row.request_payload),
    systemPrompt: row.system_prompt || '',
    userMessage: row.user_message || '',
    responsePayload: typeof row.response_payload === 'string' ? row.response_payload : JSON.stringify(row.response_payload),
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    model: row.model,
    costUsd: Number(row.cost_usd),
    durationMs: row.duration_ms,
    success: row.success,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
}

export async function getUsageSummary(userId: string, days = 30): Promise<AIUsageSummary> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const entries = await getAuditLog(userId, 500);
  const filtered = entries.filter(e => new Date(e.createdAt) >= since);

  const byAbility: AIUsageSummary['byAbility'] = {} as any;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;
  let totalCostUsd = 0;

  for (const entry of filtered) {
    totalPromptTokens += entry.promptTokens;
    totalCompletionTokens += entry.completionTokens;
    totalTokens += entry.totalTokens;
    totalCostUsd += entry.costUsd;

    const ab = entry.abilityId as AIAbilityId;
    if (!byAbility[ab]) {
      byAbility[ab] = { calls: 0, tokens: 0, costUsd: 0 };
    }
    byAbility[ab].calls++;
    byAbility[ab].tokens += entry.totalTokens;
    byAbility[ab].costUsd += entry.costUsd;
  }

  return {
    totalCalls: filtered.length,
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    totalCostUsd,
    byAbility,
    recentCalls: filtered.slice(0, 20),
  };
}
