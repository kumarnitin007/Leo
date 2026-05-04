/**
 * AI Ability Registry
 *
 * Central catalog of all AI abilities.  To add a new ability:
 * 1. Add its ID to AIAbilityId in types.ts
 * 2. Create its ability file in abilities/
 * 3. Register it here with metadata (endpoint, model, pricing)
 */

import type { AIAbilityId, AIAbilityMeta } from './types';

// gpt-4o-mini pricing (as of 2024-07): $0.15 / 1M input, $0.60 / 1M output
const GPT4O_MINI_INPUT  = 0.00015;  // per 1k tokens
const GPT4O_MINI_OUTPUT = 0.0006;

export const ABILITY_REGISTRY: Record<AIAbilityId, AIAbilityMeta> = {
  daily_briefing: {
    id: 'daily_briefing',
    label: 'Morning Briefing',
    description: 'Personalised morning summary of tasks, events, mood, and finances',
    icon: '☀️',
    endpoint: '/api/daily-briefing',
    model: 'gpt-4o-mini',
    maxTokens: 800,
    temperature: 0.7,
    costPer1kInput: GPT4O_MINI_INPUT,
    costPer1kOutput: GPT4O_MINI_OUTPUT,
  },
  journal_reflection: {
    id: 'journal_reflection',
    label: 'Journal Reflection',
    description: 'Thoughtful reflection after saving a journal entry',
    icon: '✨',
    endpoint: '/api/journal-reflect',
    model: 'gpt-4o-mini',
    maxTokens: 600,
    temperature: 0.7,
    costPer1kInput: GPT4O_MINI_INPUT,
    costPer1kOutput: GPT4O_MINI_OUTPUT,
  },
  astro_reading: {
    id: 'astro_reading',
    label: 'Astro Reading',
    description: 'AI-powered astrology reading synthesising Western, Vedic, and BaZi traditions',
    icon: '🌌',
    endpoint: '/api/astro?action=ask-ai',
    model: 'gpt-4o-mini',
    maxTokens: 1500,
    temperature: 0.8,
    costPer1kInput: GPT4O_MINI_INPUT,
    costPer1kOutput: GPT4O_MINI_OUTPUT,
  },
  numerology_vibe: {
    id: 'numerology_vibe',
    label: 'Numerology Vibe',
    description: '3-4 sentence plain-English daily vibe paragraph derived from the user\'s numerology profile (cached once/day)',
    icon: '🔢',
    endpoint: '/api/astro?action=numerology-vibe',
    model: 'gpt-4o-mini',
    maxTokens: 220,
    temperature: 0.7,
    costPer1kInput: GPT4O_MINI_INPUT,
    costPer1kOutput: GPT4O_MINI_OUTPUT,
  },
  numerology_question: {
    id: 'numerology_question',
    label: 'Numerology Question',
    description: 'User-submitted custom numerology question, answered through the lens of their profile (cached once/day per question)',
    icon: '❓',
    endpoint: '/api/astro?action=numerology-question',
    model: 'gpt-4o-mini',
    maxTokens: 280,
    temperature: 0.7,
    costPer1kInput: GPT4O_MINI_INPUT,
    costPer1kOutput: GPT4O_MINI_OUTPUT,
  },
};

export function getAbilityMeta(id: AIAbilityId): AIAbilityMeta {
  return ABILITY_REGISTRY[id];
}

export function getAllAbilities(): AIAbilityMeta[] {
  return Object.values(ABILITY_REGISTRY);
}
