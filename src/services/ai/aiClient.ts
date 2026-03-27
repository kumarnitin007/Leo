/**
 * AI Client
 *
 * Central wrapper for all AI API calls.  Every call goes through here so we can:
 * 1. Capture the exact query (system prompt + user message) for the viewer.
 * 2. Record token usage & cost in the audit log.
 * 3. Return a uniform AICallResult regardless of which ability triggered it.
 *
 * This calls our own Vercel API routes (not OpenAI directly), but the API routes
 * return `usage` in a standard shape that we parse here.
 */

import { logAICall } from './aiAuditService';
import { ABILITY_REGISTRY } from './abilityRegistry';
import type { AIAbilityId, AICallResult, AIUsage } from './types';

export interface AIClientCallParams {
  abilityId: AIAbilityId;
  userId: string;
  requestPayload: any;       // the body sent to the API route
  systemPrompt: string;      // for audit/query viewer
  userMessage: string;       // for audit/query viewer
}

/**
 * Call an AI ability's API endpoint and return a structured result
 * with usage + audit logging.
 */
export async function callAI<T = any>(
  params: AIClientCallParams,
): Promise<AICallResult<T>> {
  const ability = ABILITY_REGISTRY[params.abilityId];
  if (!ability) throw new Error(`Unknown AI ability: ${params.abilityId}`);

  const startMs = Date.now();
  let rawResponse = '';
  let success = true;
  let errorMessage: string | undefined;

  try {
    const resp = await fetch(ability.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params.requestPayload),
    });

    rawResponse = await resp.text();

    if (!resp.ok) {
      success = false;
      let parsed: any;
      try { parsed = JSON.parse(rawResponse); } catch { parsed = {}; }
      errorMessage = parsed.error || `HTTP ${resp.status}`;
      throw new Error(errorMessage);
    }

    const data: T & { usage?: { prompt_tokens: number; completion_tokens: number; model: string } } = JSON.parse(rawResponse);
    const durationMs = Date.now() - startMs;

    const usage = computeUsage(
      data.usage?.prompt_tokens ?? 0,
      data.usage?.completion_tokens ?? 0,
      data.usage?.model ?? ability.model,
      ability,
    );

    const result: AICallResult<T> = {
      data,
      rawResponse,
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      usage,
      durationMs,
    };

    // Audit (fire-and-forget)
    logAICall({
      userId: params.userId,
      abilityId: params.abilityId,
      requestPayload: params.requestPayload,
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      responsePayload: data,
      rawResponse,
      usage,
      durationMs,
      success: true,
    }).catch(() => {});

    return result;

  } catch (err: any) {
    const durationMs = Date.now() - startMs;
    const usage = computeUsage(0, 0, ability.model, ability);

    // Audit failure
    logAICall({
      userId: params.userId,
      abilityId: params.abilityId,
      requestPayload: params.requestPayload,
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      responsePayload: null,
      rawResponse,
      usage,
      durationMs,
      success: false,
      errorMessage: err.message,
    }).catch(() => {});

    throw err;
  }
}

// ── Cost calculation ──────────────────────────────────────────────────

function computeUsage(
  promptTokens: number,
  completionTokens: number,
  model: string,
  ability: { costPer1kInput: number; costPer1kOutput: number },
): AIUsage {
  const totalTokens = promptTokens + completionTokens;
  const costUsd =
    (promptTokens / 1000) * ability.costPer1kInput +
    (completionTokens / 1000) * ability.costPer1kOutput;

  return { promptTokens, completionTokens, totalTokens, model, costUsd };
}
