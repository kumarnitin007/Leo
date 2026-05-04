/**
 * AI Framework — Shared Types
 *
 * All AI abilities, audit logging, digest management, and cost tracking
 * types live here.  New abilities only need to add their own AbilityId.
 */

// ── Ability registry ──────────────────────────────────────────────────

export type AIAbilityId =
  | 'daily_briefing'
  | 'journal_reflection'
  | 'astro_reading'
  | 'numerology_vibe'
  | 'numerology_question';

export interface AIAbilityMeta {
  id: AIAbilityId;
  label: string;
  description: string;
  icon: string;
  endpoint: string;            // API route, e.g. '/api/daily-briefing'
  model: string;               // default model
  maxTokens: number;
  temperature: number;
  costPer1kInput: number;      // USD per 1k prompt tokens
  costPer1kOutput: number;     // USD per 1k completion tokens
}

// ── Audit log ─────────────────────────────────────────────────────────

export interface AIAuditEntry {
  id: string;
  userId: string;
  abilityId: AIAbilityId;
  requestPayload: string;      // JSON string of what was sent
  systemPrompt: string;
  userMessage: string;
  responsePayload: string;     // JSON string of AI response
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  costUsd: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
}

// ── Content digests ───────────────────────────────────────────────────

export type DigestSource = 'journal' | 'tasks' | 'events' | 'financial';

export interface ContentDigest {
  source: DigestSource;
  digest: string;
  coversTo: string;            // YYYY-MM-DD
}

export interface StoredDigest extends ContentDigest {
  id: string;
  userId: string;
  createdAt: string;
}

// ── AI call result (returned by aiClient) ─────────────────────────────

export interface AICallResult<T = any> {
  data: T;
  rawResponse: string;
  systemPrompt: string;
  userMessage: string;
  usage: AIUsage;
  durationMs: number;
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  costUsd: number;
}

// ── Usage summary (for UI) ────────────────────────────────────────────

export interface AIUsageSummary {
  totalCalls: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  byAbility: Record<AIAbilityId, {
    calls: number;
    tokens: number;
    costUsd: number;
  }>;
  recentCalls: AIAuditEntry[];
}
