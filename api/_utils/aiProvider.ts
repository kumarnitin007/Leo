/**
 * AI provider resolver (server-side)
 *
 * Lets every AI route target one of several providers from a single place.
 * Each supported provider exposes an OpenAI-compatible Chat Completions
 * endpoint, so callers keep their existing request/response shape (messages,
 * max_tokens, temperature, and a `usage` object with prompt_tokens /
 * completion_tokens) and only swap the base URL, auth key, and model.
 *
 * The desired provider is passed per-request in the body as `provider`;
 * anything unknown falls back to OpenAI.
 *
 * Required env vars (only the selected provider's key is needed):
 * - OPENAI_API_KEY      OpenAI
 * - GEMINI_API_KEY      Google Gemini
 * - ANTHROPIC_API_KEY   Anthropic Claude
 * - XAI_API_KEY         xAI Grok
 * - DEEPSEEK_API_KEY    DeepSeek
 *
 * Optional per-provider model overrides:
 * - OPENAI_MODEL, GEMINI_MODEL, ANTHROPIC_MODEL, XAI_MODEL, DEEPSEEK_MODEL
 */

export type AIProviderId = 'openai' | 'gemini' | 'anthropic' | 'xai' | 'deepseek';

interface ProviderConfig {
  url: string;
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel: string;
}

const PROVIDERS: Record<AIProviderId, ProviderConfig> = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    apiKeyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    defaultModel: 'gpt-4o-mini',
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    apiKeyEnv: 'GEMINI_API_KEY',
    modelEnv: 'GEMINI_MODEL',
    defaultModel: 'gemini-2.0-flash',
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/chat/completions',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    modelEnv: 'ANTHROPIC_MODEL',
    defaultModel: 'claude-3-5-haiku-20241022',
  },
  xai: {
    url: 'https://api.x.ai/v1/chat/completions',
    apiKeyEnv: 'XAI_API_KEY',
    modelEnv: 'XAI_MODEL',
    defaultModel: 'grok-2-latest',
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    modelEnv: 'DEEPSEEK_MODEL',
    defaultModel: 'deepseek-chat',
  },
};

interface ResolveOpts {
  /** Override the OpenAI model for this call (e.g. a vision model). */
  openaiModel?: string;
  /** Override the Gemini model for this call. */
  geminiModel?: string;
  /** Override the model for any provider (takes precedence over env/default). */
  modelOverrides?: Partial<Record<AIProviderId, string>>;
}

interface ResolvedProvider {
  provider: AIProviderId;
  url: string;
  apiKey: string | undefined;
  model: string;
}

function normalizeProvider(requested: unknown): AIProviderId {
  return typeof requested === 'string' && requested in PROVIDERS
    ? (requested as AIProviderId)
    : 'openai';
}

export function resolveAIProvider(requested: unknown, opts: ResolveOpts = {}): ResolvedProvider {
  const provider = normalizeProvider(requested);
  const cfg = PROVIDERS[provider];

  const legacyOverride =
    provider === 'openai' ? opts.openaiModel :
    provider === 'gemini' ? opts.geminiModel :
    undefined;

  const model =
    opts.modelOverrides?.[provider] ||
    legacyOverride ||
    process.env[cfg.modelEnv] ||
    cfg.defaultModel;

  return {
    provider,
    url: cfg.url,
    apiKey: process.env[cfg.apiKeyEnv],
    model,
  };
}
