/**
 * Helpers for displaying which AI engine ran a call.
 *
 * Each audit entry stores the `model` that ran (e.g. `gpt-4o-mini`,
 * `gemini-2.0-flash`, `claude-3-5-haiku-20241022`). We derive the provider from
 * that model name so the analytics UI can label, color, and filter by engine
 * without needing a separate column.
 */

export type ProviderId = 'openai' | 'gemini' | 'anthropic' | 'xai' | 'deepseek' | 'other';

export function providerOf(model: string | undefined): ProviderId {
  const m = (model || '').toLowerCase();
  if (m.startsWith('gemini')) return 'gemini';
  if (m.startsWith('claude')) return 'anthropic';
  if (m.startsWith('grok')) return 'xai';
  if (m.startsWith('deepseek')) return 'deepseek';
  if (m.startsWith('gpt') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return 'openai';
  return 'other';
}

export function providerLabel(model: string | undefined): string {
  switch (providerOf(model)) {
    case 'gemini': return 'Gemini';
    case 'openai': return 'OpenAI';
    case 'anthropic': return 'Claude';
    case 'xai': return 'Grok';
    case 'deepseek': return 'DeepSeek';
    default: return model || 'Unknown';
  }
}

export function providerColor(model: string | undefined): string {
  switch (providerOf(model)) {
    case 'gemini': return 'var(--ck-green)';
    case 'openai': return 'var(--ck-purple)';
    case 'anthropic': return '#c2683a';
    case 'xai': return '#3a3a44';
    case 'deepseek': return '#2f6df0';
    default: return 'var(--ck-ink3)';
  }
}

export function providerBg(model: string | undefined): string {
  switch (providerOf(model)) {
    case 'gemini': return 'var(--ck-green-light)';
    case 'openai': return 'var(--ck-purple-light)';
    case 'anthropic': return '#fbf0e9';
    case 'xai': return '#eeeef1';
    case 'deepseek': return '#eaf1fe';
    default: return 'var(--ck-cream)';
  }
}
