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

export type AIProviderId = 'openai' | 'gemini' | 'anthropic' | 'xai' | 'deepseek';

const PROVIDER_IDS: AIProviderId[] = ['openai', 'gemini', 'anthropic', 'xai', 'deepseek'];

/** Display-only default model per provider. Mirrors api/_utils/aiProvider.ts. */
const DEFAULT_MODELS: Record<AIProviderId, string> = {
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  anthropic: 'claude-3-5-haiku-20241022',
  xai: 'grok-2-latest',
  deepseek: 'deepseek-chat',
};

export function getSelectedAIProvider(): AIProviderId {
  try {
    const p = getUserSettingsSync().aiProvider;
    return p && PROVIDER_IDS.includes(p) ? p : 'openai';
  } catch {
    return 'openai';
  }
}

/**
 * Display-only default model name for a provider. Used to label calls (e.g. a
 * failed call) when the server didn't return a model. Must mirror the server
 * defaults in api/_utils/aiProvider.ts.
 */
export function defaultModelForProvider(provider: AIProviderId): string {
  return DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai;
}

/**
 * Approximate token pricing (USD per 1K tokens) by model, used for the local
 * cost estimate in the audit log. Falls back to the ability's own price when a
 * model isn't listed. Keep in sync with provider pricing pages.
 */
const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
  'gpt-4o': { in: 0.0025, out: 0.01 },
  // Gemini is treated as $0 here because we run on its free tier. If you move
  // to a paid Gemini plan, set the real per-1K rates below.
  'gemini-2.0-flash': { in: 0, out: 0 },
  'gemini-2.5-flash': { in: 0, out: 0 },
  'gemini-2.5-flash-lite': { in: 0, out: 0 },
  // Anthropic Claude (per 1K tokens).
  'claude-3-5-haiku': { in: 0.0008, out: 0.004 },
  'claude-3-5-sonnet': { in: 0.003, out: 0.015 },
  'claude-3-7-sonnet': { in: 0.003, out: 0.015 },
  // xAI Grok (per 1K tokens).
  'grok-2': { in: 0.002, out: 0.01 },
  'grok-3': { in: 0.003, out: 0.015 },
  // DeepSeek (per 1K tokens).
  'deepseek-chat': { in: 0.00027, out: 0.0011 },
  'deepseek-reasoner': { in: 0.00055, out: 0.00219 },
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
