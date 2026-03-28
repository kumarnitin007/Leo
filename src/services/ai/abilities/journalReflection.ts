/**
 * Journal Reflection Ability
 *
 * After a user saves a journal entry, generates a personalised reflection
 * referencing mood patterns, recent entries, and tasks.
 */

import { getJournalEntries, loadDashboardData, getUserSettings } from '../../../storage';
import { getTodayString, formatDate } from '../../../utils';
import { callAI } from '../aiClient';
import { loadFreshDigests, saveDigests, missingDigestSources } from '../aiDigestService';
import { getSupabaseClient } from '../../../lib/supabase';
import type { AICallResult, ContentDigest } from '../types';
import type { AIPersonality } from '../../../types';

// ── Types ────────────────────────────────────────────────────────────

export interface JournalReflectionResult {
  reflection: string;
  moodObservation: string;
  promptForTomorrow: string;
  funQuote?: string;
  date: string;
  lastQuery?: { systemPrompt: string; userMessage: string };
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number; model: string };
}

// ── Helpers ──────────────────────────────────────────────────────────

function snippet(text: string, maxLen = 120): string {
  if (!text) return '';
  const clean = text.replace(/\n+/g, ' ').trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) + '…' : clean;
}

function computeMoodTrend(moods: (string | undefined)[]): string {
  const s: Record<string, number> = { terrible: 1, bad: 2, okay: 3, good: 4, great: 5 };
  const scores = moods.filter(Boolean).map(m => s[m!] ?? 3);
  if (scores.length < 2) return 'stable';
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const half = Math.ceil(scores.length / 2);
  const diff = avg(scores.slice(half)) - avg(scores.slice(0, half));
  if (diff > 0.5) return 'improving';
  if (diff < -0.5) return 'declining';
  return 'stable';
}

// ── Prompt builders ──────────────────────────────────────────────────

function buildSystemPrompt(requestDigests: boolean): string {
  return `You are Leo, the empathetic AI companion inside the MyDay journal.
Your job is to provide a SHORT, thoughtful reflection after the user saves a journal entry.

Rules:
- Keep under 120 words — this is a sidebar card, not an essay.
- Acknowledge what the user wrote — quote or reference specific phrases.
- Notice mood patterns across recent entries (if provided) and mention them gently.
- If mood is declining, be supportive not preachy. If improving, celebrate it.
- Offer ONE concrete, actionable micro-suggestion tied to their real context (tasks, mood).
- If they mention gratitude, reflect it back. If they mention stress, validate it.
- End with a brief affirming or curious prompt (a question they might journal about tomorrow).
- Never lecture. Never be generic. Always feel personal.
- Tone: warm friend, not therapist or corporate bot.

${requestDigests ? `DIGEST GENERATION:
Also return a "digests" array with compact summaries (max 100 words each) for
sources where raw data was provided.  Sources: "journal", "tasks".` : ''}

Respond ONLY with valid JSON:
{
  "reflection": "...",
  "mood_observation": "improving|declining|stable|mixed",
  "prompt_for_tomorrow": "..."${requestDigests ? ',\n  "digests": [{ "source": "journal|tasks", "digest": "...", "coversTo": "YYYY-MM-DD" }]' : ''}
}`;
}

function buildUserMessage(
  userName: string,
  entry: { date: string; content: string; mood?: string },
  recentEntries: { date: string; mood?: string; snippet: string }[],
  moodTrend: string,
  tasksToday: { name: string; status: string }[],
  completionRate7d: number,
  freshDigests: ContentDigest[],
): string {
  const dm = new Map(freshDigests.map(d => [d.source, d]));
  const s: string[] = [];
  s.push(`User: ${userName}`);
  s.push(`Today's entry (${entry.date}, mood: ${entry.mood || 'not set'}):\n"${entry.content}"`);
  if (dm.has('journal')) {
    s.push(`[Past journal digest – covers to ${dm.get('journal')!.coversTo}]\n${dm.get('journal')!.digest}`);
  } else if (recentEntries.length > 0) {
    s.push(`Recent entries (mood trend: ${moodTrend}):\n${recentEntries.map(e => `- ${e.date} [${e.mood || '?'}]: ${e.snippet}`).join('\n')}`);
  }
  if (dm.has('tasks')) {
    s.push(`[Tasks digest – covers to ${dm.get('tasks')!.coversTo}]\n${dm.get('tasks')!.digest}`);
  } else if (tasksToday.length > 0) {
    s.push(`Tasks today (7d completion ${completionRate7d}%):\n${tasksToday.map(t => `- ${t.name} [${t.status}]`).join('\n')}`);
  }
  return s.join('\n\n');
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Build the prompt that would be sent to OpenAI without calling the API.
 * Useful for previewing / copying into ChatGPT.
 */
export async function previewReflectionQuery(
  userName: string,
  userId: string,
  entry: { date: string; content: string; mood?: string },
): Promise<{ systemPrompt: string; userMessage: string }> {
  const today = getTodayString();
  const [allEntries, dashData, freshDigests] = await Promise.all([
    getJournalEntries(), loadDashboardData(today, 7), loadFreshDigests(userId),
  ]);
  const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return formatDate(d); });
  const recentEntries = allEntries
    .filter(j => j.date !== entry.date && j.date >= last7[last7.length - 1])
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
    .map(j => ({ date: j.date, mood: j.mood, snippet: snippet(j.content) }));
  const moodTrend = computeMoodTrend([...recentEntries.map(e => e.mood), entry.mood]);
  const tasksToday = dashData.tasks.map(t => ({
    name: t.name,
    status: dashData.completions.some(c => c.taskId === t.id && c.date === today) ? 'done' : 'pending',
  }));
  const completionRate7d = Math.round(
    (dashData.completions.filter(c => last7.includes(c.date)).length / ((dashData.tasks.length || 1) * 7)) * 100
  );
  const needsDigests = missingDigestSources(freshDigests, ['journal', 'tasks']).length > 0;
  return {
    systemPrompt: buildSystemPrompt(needsDigests),
    userMessage: buildUserMessage(userName, entry, recentEntries, moodTrend, tasksToday, completionRate7d, freshDigests),
  };
}

export async function getJournalReflection(
  userName: string,
  userId: string,
  entry: { date: string; content: string; mood?: string },
): Promise<JournalReflectionResult> {
  const today = getTodayString();

  const [allEntries, dashData, freshDigests, settings] = await Promise.all([
    getJournalEntries(), loadDashboardData(today, 7), loadFreshDigests(userId), getUserSettings(),
  ]);
  const personality: AIPersonality | undefined = settings.aiPersonality;

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i); return formatDate(d);
  });

  const recentEntries = allEntries
    .filter(j => j.date !== entry.date && j.date >= last7[last7.length - 1])
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map(j => ({ date: j.date, mood: j.mood, snippet: snippet(j.content) }));

  const moodTrend = computeMoodTrend([...recentEntries.map(e => e.mood), entry.mood]);

  const tasksToday = dashData.tasks.map(t => ({
    name: t.name,
    status: dashData.completions.some(c => c.taskId === t.id && c.date === today) ? 'done' : 'pending',
  }));
  const completionRate7d = Math.round(
    (dashData.completions.filter(c => last7.includes(c.date)).length / ((dashData.tasks.length || 1) * 7)) * 100
  );

  const needsDigests = missingDigestSources(freshDigests, ['journal', 'tasks']).length > 0;
  const systemPrompt = buildSystemPrompt(needsDigests);
  const userMessage = buildUserMessage(userName, entry, recentEntries, moodTrend, tasksToday, completionRate7d, freshDigests);

  const hasPersonality = personality && Object.values(personality).some(v => v?.trim());
  const requestPayload = {
    userName,
    currentEntry: entry,
    recentEntries,
    moodTrend,
    todayTasks: tasksToday,
    completionRate7d,
    contentDigests: freshDigests.length > 0 ? freshDigests : undefined,
    requestDigests: needsDigests,
    personality: hasPersonality ? personality : undefined,
  };

  const result = await callAI<any>({
    abilityId: 'journal_reflection',
    userId,
    requestPayload,
    systemPrompt,
    userMessage,
  });

  // Save digests + reflection (fire-and-forget)
  if (result.data.digests?.length) saveDigests(userId, result.data.digests).catch(() => {});
  const client = getSupabaseClient();
  if (client) {
    client.from('myday_ai_digests').upsert([{
      user_id: userId, digest_type: 'journal_reflection',
      response_text: result.data.reflection, response_date: entry.date,
      prompt_tokens: result.usage.promptTokens, completion_tokens: result.usage.completionTokens,
      model: result.usage.model,
    }], { onConflict: 'user_id,digest_type,response_date' }).then(() => {});
  }

  return {
    reflection: result.data.reflection,
    moodObservation: result.data.moodObservation || result.data.mood_observation || 'stable',
    promptForTomorrow: result.data.promptForTomorrow || result.data.prompt_for_tomorrow || '',
    funQuote: result.data.funQuote || result.data.fun_quote,
    date: entry.date,
    lastQuery: { systemPrompt: result.systemPrompt, userMessage: result.userMessage },
    usage: result.usage,
  };
}
