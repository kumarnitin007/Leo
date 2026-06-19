/**
 * AI provider resolver (server-side)
 *
 * Lets every AI route target either OpenAI or Google Gemini from a single place.
 * Gemini exposes an OpenAI-compatible Chat Completions endpoint, so callers can
 * keep their existing request/response shape (messages, max_tokens, temperature,
 * and a `usage` object with prompt_tokens / completion_tokens) and only swap the
 * base URL, auth key, and model.
 *
 * The desired provider is passed per-request in the body as `provider`
 * ('openai' | 'gemini'); anything else falls back to OpenAI.
 *
 * Required env vars:
 * - OPENAI_API_KEY  (existing)
 * - GEMINI_API_KEY  (new — only needed when a user selects Gemini)
 * - GEMINI_MODEL    (optional override; defaults to gemini-2.0-flash)
 */

export type AIProviderId = 'openai' | 'gemini';

interface ResolveOpts {
  /** Override the OpenAI model for this call (e.g. a vision model). */
  openaiModel?: string;
  /** Override the Gemini model for this call. */
  geminiModel?: string;
}

interface ResolvedProvider {
  provider: AIProviderId;
  url: string;
  apiKey: string | undefined;
  model: string;
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

export function resolveAIProvider(requested: unknown, opts: ResolveOpts = {}): ResolvedProvider {
  const provider: AIProviderId = requested === 'gemini' ? 'gemini' : 'openai';

  if (provider === 'gemini') {
    return {
      provider,
      url: GEMINI_URL,
      apiKey: process.env.GEMINI_API_KEY,
      model: opts.geminiModel || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    };
  }

  return {
    provider,
    url: OPENAI_URL,
    apiKey: process.env.OPENAI_API_KEY,
    model: opts.openaiModel || DEFAULT_OPENAI_MODEL,
  };
}
