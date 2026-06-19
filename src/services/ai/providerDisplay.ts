/**
 * Helpers for displaying which AI engine ran a call.
 *
 * Each audit entry stores the `model` that ran (e.g. `gpt-4o-mini`,
 * `gemini-2.0-flash`). We derive the provider from that model name so the
 * analytics UI can label, color, and filter by engine without needing a
 * separate column.
 */

export type ProviderId = 'openai' | 'gemini' | 'other';

export function providerOf(model: string | undefined): ProviderId {
  const m = (model || '').toLowerCase();
  if (m.startsWith('gemini')) return 'gemini';
  if (m.startsWith('gpt') || m.startsWith('o1') || m.startsWith('o3')) return 'openai';
  return 'other';
}

export function providerLabel(model: string | undefined): string {
  switch (providerOf(model)) {
    case 'gemini': return 'Gemini';
    case 'openai': return 'OpenAI';
    default: return model || 'Unknown';
  }
}

export function providerColor(model: string | undefined): string {
  switch (providerOf(model)) {
    case 'gemini': return 'var(--ck-green)';
    case 'openai': return 'var(--ck-purple)';
    default: return 'var(--ck-ink3)';
  }
}

export function providerBg(model: string | undefined): string {
  switch (providerOf(model)) {
    case 'gemini': return 'var(--ck-green-light)';
    case 'openai': return 'var(--ck-purple-light)';
    default: return 'var(--ck-cream)';
  }
}
