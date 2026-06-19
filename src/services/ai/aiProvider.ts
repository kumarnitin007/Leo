/**
 * AI provider selection (client-side)
 *
 * Single source of truth for which AI engine the user picked in Settings.
 * Read from the cached user settings (localStorage) so it's synchronous and
 * safe to call from any request site. Every AI request includes this in its
 * body as `provider`; the server (`api/_utils/aiProvider.ts`) resolves it to
 * the right endpoint, key, and model.
 */

import { getUserSettingsSync } from '../../storage';

export type AIProviderId = 'openai' | 'gemini';

export function getSelectedAIProvider(): AIProviderId {
  try {
    return getUserSettingsSync().aiProvider === 'gemini' ? 'gemini' : 'openai';
  } catch {
    return 'openai';
  }
}

/**
 * Approximate token pricing (USD per 1K tokens) by model, used for the local
 * cost estimate in the audit log. Falls back to the ability's own price when a
 * model isn't listed. Keep in sync with provider pricing pages.
 */
const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
  'gpt-4o': { in: 0.0025, out: 0.01 },
  'gemini-2.0-flash': { in: 0.000075, out: 0.0003 },
  'gemini-2.5-flash': { in: 0.0003, out: 0.0025 },
  'gemini-2.5-flash-lite': { in: 0.0001, out: 0.0004 },
};

export function getModelPricing(
  model: string,
  fallback: { in: number; out: number },
): { in: number; out: number } {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  // Prefix match (e.g. "gemini-2.0-flash-001" → "gemini-2.0-flash")
  const key = Object.keys(MODEL_PRICING).find(k => model.startsWith(k));
  return key ? MODEL_PRICING[key] : fallback;
}
