/**
 * Journal Reflection Ability
 *
 * Generates 3 personalised AI messages on button click:
 *   1. Personal reflection (journal context, mood, tasks)
 *   2. Weather/season/steps suggestion (outdoor, wellness)
 *   3. Activity/event/motivation idea (cultural, local, fun)
 *
 * Works with or without a saved journal entry for today.
 * All responses are saved to DB + session for same-day reuse.
 */

import { getJournalEntries, loadDashboardData, getUserSettings, getUpcomingEvents } from '../../../storage';
import { getTodayString, formatDate } from '../../../utils';
import { callAI } from '../aiClient';
import { loadFreshDigests, saveDigests, missingDigestSources } from '../aiDigestService';
import { getSupabaseClient } from '../../../lib/supabase';
import type { ContentDigest } from '../types';
import type { AIPersonality } from '../../../types';

// ── Types ────────────────────────────────────────────────────────────

export interface JournalReflectionResult {
  /** Message 1 — personal reflection (shown in center panel) */
  reflection: string;
  moodObservation: string;
  promptForTomorrow: string;
  /** Message 2 — weather/season/steps suggestion (shown in right panel) */
  weatherSuggestion: string;
  /** Message 3 — activity/event/motivation idea (shown in right panel) */
  activityIdea: string;

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
  return `You are Leo, the empathetic AI companion inside the MyDay journal app.
You produce exactly 3 distinct messages per call. Each message is SHORT (max 80 words).

MESSAGE 1 — "reflection" (Personal context)
- If the user has a journal entry for today, reference it specifically.
- If no entry yet, use recent entries, mood trend, tasks, and upcoming events to offer an encouraging personal note.
- Mention upcoming birthdays/anniversaries if within 7 days.
- Tone: warm friend. Never generic.

MESSAGE 2 — "weather_suggestion" (Outdoor / wellness)
- Use the weather, location, season, and step count data provided.
- Suggest a specific outdoor activity, walk route idea, or wellness tip tied to the actual conditions.
- If steps data is available, acknowledge progress or encourage gently.
- Be concrete (e.g. "Perfect 52°F for a trail walk" not "go outside").

MESSAGE 3 — "activity_idea" (Discover / motivate)
- Suggest something fun: a seasonal activity (tulip festival, fall colors, cherry blossoms), a local trail, a movie/show to watch, a cultural event, a recipe for the season, or a new hobby idea.
- Connect it to the user's personality, interests, or recent entries when possible.
- Make it feel like a friend's enthusiastic recommendation, not a generic tip.

Additional rules:
- Never lecture. Be concise and specific.
- mood_observation: summarise the mood trend in one word.
- prompt_for_tomorrow: one curious question they might journal about.

${requestDigests ? `DIGEST GENERATION:
Also return a "digests" array with compact summaries (max 100 words each) for
sources where raw data was provided.  Sources: "journal", "tasks".` : ''}

Respond ONLY with valid JSON:
{
  "reflection": "...",
  "mood_observation": "improving|declining|stable|mixed",
  "prompt_for_tomorrow": "...",
  "weather_suggestion": "...",
  "activity_idea": "..."${requestDigests ? ',\n  "digests": [{ "source": "journal|tasks", "digest": "...", "coversTo": "YYYY-MM-DD" }]' : ''}
}`;
}

interface UserMessageContext {
  userName: string;
  date: string;
  entry?: { date: string; content: string; mood?: string };
  recentEntries: { date: string; mood?: string; snippet: string }[];
  moodTrend: string;
  tasksToday: { name: string; status: string }[];
  completionRate7d: number;
  freshDigests: ContentDigest[];
  weather?: string;
  location?: string;
  stepsToday?: number | null;
  stepsYesterday?: number | null;
  upcomingEvents: { name: string; category?: string; daysUntil: number }[];
}

function buildUserMessage(ctx: UserMessageContext): string {
  const dm = new Map(ctx.freshDigests.map(d => [d.source, d]));
  const s: string[] = [];
  s.push(`User: ${ctx.userName}`);
  s.push(`Date: ${ctx.date}`);

  if (ctx.entry?.content) {
    s.push(`Today's journal entry (mood: ${ctx.entry.mood || 'not set'}):\n"${ctx.entry.content}"`);
  } else {
    s.push(`No journal entry written yet today.`);
  }

  if (dm.has('journal')) {
    s.push(`[Past journal digest – covers to ${dm.get('journal')!.coversTo}]\n${dm.get('journal')!.digest}`);
  } else if (ctx.recentEntries.length > 0) {
    s.push(`Recent entries (mood trend: ${ctx.moodTrend}):\n${ctx.recentEntries.map(e => `- ${e.date} [${e.mood || '?'}]: ${e.snippet}`).join('\n')}`);
  }

  if (dm.has('tasks')) {
    s.push(`[Tasks digest – covers to ${dm.get('tasks')!.coversTo}]\n${dm.get('tasks')!.digest}`);
  } else if (ctx.tasksToday.length > 0) {
    s.push(`Tasks today (7d completion ${ctx.completionRate7d}%):\n${ctx.tasksToday.map(t => `- ${t.name} [${t.status}]`).join('\n')}`);
  }

  if (ctx.weather || ctx.location) {
    const parts = [ctx.weather, ctx.location].filter(Boolean);
    s.push(`Weather & location: ${parts.join(' · ')}`);
  }

  if (ctx.stepsToday != null || ctx.stepsYesterday != null) {
    const stepParts: string[] = [];
    if (ctx.stepsToday != null) stepParts.push(`Today: ${ctx.stepsToday.toLocaleString()} steps`);
    if (ctx.stepsYesterday != null) stepParts.push(`Yesterday: ${ctx.stepsYesterday.toLocaleString()} steps`);
    s.push(`Steps: ${stepParts.join(', ')}`);
  }

  if (ctx.upcomingEvents.length > 0) {
    s.push(`Upcoming events (next 14 days):\n${ctx.upcomingEvents.map(e =>
      `- ${e.name}${e.category ? ` (${e.category})` : ''} — ${e.daysUntil === 0 ? 'today' : e.daysUntil === 1 ? 'tomorrow' : `in ${e.daysUntil} days`}`
    ).join('\n')}`);
  }

  return s.join('\n\n');
}

// ── Cache ────────────────────────────────────────────────────────────

const REFLECTION_SESSION_KEY = 'myday-journal-reflection';

function getSessionReflection(): JournalReflectionResult | null {
  try {
    const raw = sessionStorage.getItem(REFLECTION_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setSessionReflection(r: JournalReflectionResult) {
  try { sessionStorage.setItem(REFLECTION_SESSION_KEY, JSON.stringify(r)); } catch { /* quota */ }
}

async function loadDbReflection(userId: string, date: string): Promise<JournalReflectionResult | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client
    .from('myday_ai_digests')
    .select('response_text, created_at')
    .eq('user_id', userId)
    .eq('digest_type', 'journal_reflection')
    .eq('response_date', date)
    .maybeSingle();
  if (!data?.response_text) return null;
  try {
    const parsed = JSON.parse(data.response_text);
    return {
      reflection: parsed.reflection || data.response_text,
      moodObservation: parsed.moodObservation || 'stable',
      promptForTomorrow: parsed.promptForTomorrow || '',
      weatherSuggestion: parsed.weatherSuggestion || '',
      activityIdea: parsed.activityIdea || '',
      funQuote: parsed.funQuote,
      date,
    };
  } catch {
    return { reflection: data.response_text, moodObservation: 'stable', promptForTomorrow: '', weatherSuggestion: '', activityIdea: '', date };
  }
}

/**
 * Returns today's reflection from session or DB cache — never calls the API.
 */
export async function getCachedReflection(userId: string, date: string): Promise<JournalReflectionResult | null> {
  const sc = getSessionReflection();
  if (sc && sc.date === date) return sc;
  const dc = await loadDbReflection(userId, date);
  if (dc) { setSessionReflection(dc); return dc; }
  return null;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Build the prompt that would be sent to OpenAI without calling the API.
 */
export async function previewReflectionQuery(
  userName: string,
  userId: string,
  entry?: { date: string; content: string; mood?: string } | null,
): Promise<{ systemPrompt: string; userMessage: string }> {
  const today = getTodayString();
  const [allEntries, dashData, freshDigests, settings, upcomingEvents] = await Promise.all([
    getJournalEntries(), loadDashboardData(today, 7), loadFreshDigests(userId), getUserSettings(), getUpcomingEvents(14),
  ]);
  const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return formatDate(d); });
  const recentEntries = allEntries
    .filter(j => j.date >= last7[last7.length - 1])
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
    .map(j => ({ date: j.date, mood: j.mood, snippet: snippet(j.content) }));
  const moodTrend = computeMoodTrend([...recentEntries.map(e => e.mood), entry?.mood]);
  const tasksToday = dashData.tasks.map(t => ({
    name: t.name,
    status: dashData.completions.some(c => c.taskId === t.id && c.date === today) ? 'done' : 'pending',
  }));
  const completionRate7d = Math.round(
    (dashData.completions.filter(c => last7.includes(c.date)).length / ((dashData.tasks.length || 1) * 7)) * 100
  );
  const needsDigests = missingDigestSources(freshDigests, ['journal', 'tasks']).length > 0;

  const loc = settings.location;
  const locationStr = loc ? [loc.city, loc.country].filter(Boolean).join(', ') : undefined;

  return {
    systemPrompt: buildSystemPrompt(needsDigests),
    userMessage: buildUserMessage({
      userName, date: today,
      entry: entry || undefined,
      recentEntries, moodTrend, tasksToday, completionRate7d, freshDigests,
      location: locationStr,
      upcomingEvents: upcomingEvents.map(e => ({ name: e.event.name, category: e.event.category, daysUntil: e.daysUntil })),
    }),
  };
}

export interface ReflectionCallContext {
  entry?: { date: string; content: string; mood?: string } | null;
  weather?: string;
  stepsToday?: number | null;
  stepsYesterday?: number | null;
}

export async function getJournalReflection(
  userName: string,
  userId: string,
  ctx: ReflectionCallContext,
): Promise<JournalReflectionResult> {
  const today = getTodayString();

  const [allEntries, dashData, freshDigests, settings, upcomingEvents] = await Promise.all([
    getJournalEntries(), loadDashboardData(today, 7), loadFreshDigests(userId), getUserSettings(), getUpcomingEvents(14),
  ]);
  const personality: AIPersonality | undefined = settings.aiPersonality;

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i); return formatDate(d);
  });

  const recentEntries = allEntries
    .filter(j => j.date >= last7[last7.length - 1])
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map(j => ({ date: j.date, mood: j.mood, snippet: snippet(j.content) }));

  const moodTrend = computeMoodTrend([...recentEntries.map(e => e.mood), ctx.entry?.mood]);

  const tasksToday = dashData.tasks.map(t => ({
    name: t.name,
    status: dashData.completions.some(c => c.taskId === t.id && c.date === today) ? 'done' : 'pending',
  }));
  const completionRate7d = Math.round(
    (dashData.completions.filter(c => last7.includes(c.date)).length / ((dashData.tasks.length || 1) * 7)) * 100
  );

  const loc = settings.location;
  const locationStr = loc ? [loc.city, loc.country].filter(Boolean).join(', ') : undefined;

  const needsDigests = missingDigestSources(freshDigests, ['journal', 'tasks']).length > 0;
  const systemPrompt = buildSystemPrompt(needsDigests);
  const userMessage = buildUserMessage({
    userName, date: today,
    entry: ctx.entry || undefined,
    recentEntries, moodTrend, tasksToday, completionRate7d, freshDigests,
    weather: ctx.weather,
    location: locationStr,
    stepsToday: ctx.stepsToday,
    stepsYesterday: ctx.stepsYesterday,
    upcomingEvents: upcomingEvents.map(e => ({ name: e.event.name, category: e.event.category, daysUntil: e.daysUntil })),
  });

  const hasPersonality = personality && Object.values(personality).some(v => v?.trim());
  const requestPayload = {
    userName, date: today,
    currentEntry: ctx.entry || null,
    recentEntries, moodTrend, todayTasks: tasksToday, completionRate7d,
    contentDigests: freshDigests.length > 0 ? freshDigests : undefined,
    requestDigests: needsDigests,
    personality: hasPersonality ? personality : undefined,
    weather: ctx.weather, location: locationStr,
    stepsToday: ctx.stepsToday, stepsYesterday: ctx.stepsYesterday,
    upcomingEvents: upcomingEvents.slice(0, 10).map(e => ({ name: e.event.name, category: e.event.category, daysUntil: e.daysUntil })),
  };

  const result = await callAI<any>({
    abilityId: 'journal_reflection',
    userId,
    requestPayload,
    systemPrompt,
    userMessage,
  });

  if (result.data.digests?.length) saveDigests(userId, result.data.digests).catch(() => {});

  const entryDate = ctx.entry?.date || today;
  const reflectionResult: JournalReflectionResult = {
    reflection: result.data.reflection || '',
    moodObservation: result.data.moodObservation || result.data.mood_observation || 'stable',
    promptForTomorrow: result.data.promptForTomorrow || result.data.prompt_for_tomorrow || '',
    weatherSuggestion: result.data.weatherSuggestion || result.data.weather_suggestion || '',
    activityIdea: result.data.activityIdea || result.data.activity_idea || '',
    funQuote: result.data.funQuote || result.data.fun_quote,
    date: entryDate,
    lastQuery: { systemPrompt: result.systemPrompt, userMessage: result.userMessage },
    usage: result.usage,
  };

  const client = getSupabaseClient();
  if (client) {
    const cachePayload = {
      reflection: reflectionResult.reflection,
      moodObservation: reflectionResult.moodObservation,
      promptForTomorrow: reflectionResult.promptForTomorrow,
      weatherSuggestion: reflectionResult.weatherSuggestion,
      activityIdea: reflectionResult.activityIdea,
      funQuote: reflectionResult.funQuote,
    };
    client.from('myday_ai_digests').upsert([{
      user_id: userId, digest_type: 'journal_reflection',
      response_text: JSON.stringify(cachePayload), response_date: entryDate,
      prompt_tokens: result.usage.promptTokens, completion_tokens: result.usage.completionTokens,
      model: result.usage.model,
    }], { onConflict: 'user_id,digest_type,response_date' }).then(() => {});
  }

  setSessionReflection(reflectionResult);
  return reflectionResult;
}
