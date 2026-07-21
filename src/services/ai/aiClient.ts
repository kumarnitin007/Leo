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
import { getSelectedAIProvider, getModelPricing, defaultModelForProvider } from './aiProvider';
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

  const provider = getSelectedAIProvider();
  console.log(`[AI] → ${params.abilityId} | requested engine=${provider} | endpoint=${ability.endpoint}`);

  try {
    const resp = await fetch(ability.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `task` lets the unified /api/ai endpoint dispatch to the right handler.
      // Endpoints that route by other means (e.g. astro's ?action=) ignore it.
      body: JSON.stringify({ ...params.requestPayload, task: params.abilityId, provider }),
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

    const returnedModel = data.usage?.model ?? ability.model;
    const usage = computeUsage(
      data.usage?.prompt_tokens ?? 0,
      data.usage?.completion_tokens ?? 0,
      returnedModel,
      ability,
    );

    console.log(
      `[AI] ✓ ${params.abilityId} | requested engine=${provider} | model returned=${data.usage?.model ?? '(none — server did not report a model)'} | ` +
      `tokens=${usage.totalTokens} (in ${usage.promptTokens}/out ${usage.completionTokens}) | cost=$${usage.costUsd.toFixed(6)} | ${durationMs}ms`,
    );
    if (provider === 'gemini' && !/^gemini/i.test(returnedModel)) {
      console.warn(
        `[AI] ⚠ ${params.abilityId}: you selected Gemini but the server ran "${returnedModel}". ` +
        `The API route is likely running older code (redeploy to Vercel / restart \`vercel dev\`) or GEMINI_API_KEY is not set for it.`,
      );
    }

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
    // Label the failed call with the engine the user actually requested, so the
    // audit log / analytics don't misattribute a failed Gemini attempt to OpenAI.
    const usage = computeUsage(0, 0, defaultModelForProvider(provider), ability);
    console.warn(`[AI] ✗ ${params.abilityId} | requested engine=${provider} | failed: ${err?.message}`);

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
  // Price by the model that actually ran (e.g. a Gemini model) so the audit
  // cost is accurate; fall back to the ability's configured price.
  const pricing = getModelPricing(model, {
    in: ability.costPer1kInput,
    out: ability.costPer1kOutput,
  });
  const costUsd =
    (promptTokens / 1000) * pricing.in +
    (completionTokens / 1000) * pricing.out;

  return { promptTokens, completionTokens, totalTokens, model, costUsd };
}
