/**
 * Daily Briefing Ability
 *
 * Gathers user context and produces a personalised morning briefing via
 * the central AI client.  Uses the digest system for token optimisation.
 */

import { getJournalEntries, getUpcomingEvents, loadDashboardData, getUserSettings } from '../../../storage';
import { getTodayString, formatDate } from '../../../utils';
import { getSupabaseClient } from '../../../lib/supabase';
import { callAI } from '../aiClient';
import { loadFreshDigests, saveDigests, missingDigestSources } from '../aiDigestService';
import type { AICallResult, ContentDigest } from '../types';
import type { AIPersonality } from '../../../types';

// ── Types ────────────────────────────────────────────────────────────

export interface DailyBriefingResult {
  briefing: string;
  tone: string;
  funQuote?: string;
  date: string;
  generatedAt: string;
  lastQuery?: { systemPrompt: string; userMessage: string };
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number; model: string };
}

// ── Caching ──────────────────────────────────────────────────────────

const SESSION_KEY = 'myday_briefing_cache';

function getSessionCache(): DailyBriefingResult | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const c: DailyBriefingResult = JSON.parse(raw);
    if (c.date === getTodayString()) return c;
    sessionStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
  return null;
}

function setSessionCache(b: DailyBriefingResult) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(b)); } catch { /* quota */ }
}

async function loadDbCache(userId: string, date: string): Promise<DailyBriefingResult | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client
    .from('myday_ai_digests')
    .select('response_text, created_at')
    .eq('user_id', userId)
    .eq('digest_type', 'daily_briefing')
    .eq('response_date', date)
    .maybeSingle();
  if (!data?.response_text) return null;
  return { briefing: data.response_text, tone: 'neutral', date, generatedAt: data.created_at };
}

async function saveDbCache(userId: string, briefing: string, date: string, usage?: any) {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('myday_ai_digests').upsert([{
    user_id: userId, digest_type: 'daily_briefing', response_text: briefing,
    response_date: date, prompt_tokens: usage?.promptTokens,
    completion_tokens: usage?.completionTokens, model: usage?.model,
  }], { onConflict: 'user_id,digest_type,response_date' });
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
  return `You are Leo, the personal AI assistant inside the MyDay productivity app.
Your job is to deliver a warm, concise morning briefing that feels like a supportive friend — not a corporate bot.

Rules:
- Keep the briefing under 200 words.
- Mention the user by first name.
- Reference specific tasks, events, journal moods, and financial alerts from the context.
- Spot patterns (streaks, mood trends, busy days) and give ONE actionable suggestion.
- Use a tone that matches the user's recent mood (upbeat if they're doing well, gentle if struggling).
- Never be preachy or generic — be specific to THIS user's data.
- End with one short motivational or lighthearted line.

${requestDigests ? `IMPORTANT — DIGEST GENERATION:
In addition to the briefing, return a "digests" array.  Each digest is a compact
summary (max 150 words) of one data source that can replace the raw data in future
requests to save tokens.  Sources: "journal", "tasks", "events", "financial".
Only generate digests for sources where raw data was provided (not for sources
that already came in as a digest).` : ''}

Respond ONLY with valid JSON:
{
  "briefing": "...",
  "tone": "upbeat|gentle|neutral|encouraging"${requestDigests ? ',\n  "digests": [{ "source": "journal|tasks|events|financial", "digest": "...", "coversTo": "YYYY-MM-DD" }]' : ''}
}`;
}

function buildUserMessage(
  userName: string, date: string,
  tasksToday: { name: string; status: string; streak?: number }[],
  upcomingEvents: { name: string; date: string; daysUntil: number }[],
  recentJournals: { date: string; mood?: string; snippet: string }[],
  financialAlerts: string[],
  completionRate7d: number, moodTrend: string,
  freshDigests: ContentDigest[],
): string {
  const dm = new Map(freshDigests.map(d => [d.source, d]));
  const s: string[] = [];
  s.push(`Date: ${date}`);
  s.push(`User: ${userName}`);
  s.push(dm.has('tasks')
    ? `[Tasks digest – covers to ${dm.get('tasks')!.coversTo}]\n${dm.get('tasks')!.digest}`
    : `Tasks today (7-day completion ${completionRate7d}%):\n${tasksToday.map(t => `- ${t.name} [${t.status}]${t.streak ? ` (${t.streak}-day streak)` : ''}`).join('\n') || 'None'}`);
  s.push(dm.has('events')
    ? `[Events digest – covers to ${dm.get('events')!.coversTo}]\n${dm.get('events')!.digest}`
    : `Upcoming events:\n${upcomingEvents.map(e => `- ${e.name} (${e.date}, ${e.daysUntil === 0 ? 'today' : e.daysUntil + 'd away'})`).join('\n') || 'None'}`);
  s.push(dm.has('journal')
    ? `[Journal digest – covers to ${dm.get('journal')!.coversTo}]\n${dm.get('journal')!.digest}`
    : `Recent journal mood trend: ${moodTrend}\nEntries:\n${recentJournals.map(j => `- ${j.date} [${j.mood || 'no mood'}]: ${j.snippet}`).join('\n') || 'None'}`);
  s.push(dm.has('financial')
    ? `[Financial digest – covers to ${dm.get('financial')!.coversTo}]\n${dm.get('financial')!.digest}`
    : `Financial alerts:\n${financialAlerts.length > 0 ? financialAlerts.map(a => `- ${a}`).join('\n') : 'None'}`);
  return s.join('\n\n');
}

/**
 * Returns today's briefing from session or DB cache — never calls the API.
 */
export async function getCachedBriefing(userId: string): Promise<DailyBriefingResult | null> {
  const today = getTodayString();
  const sc = getSessionCache();
  if (sc) return sc;
  const dc = await loadDbCache(userId, today);
  if (dc) { setSessionCache(dc); return dc; }
  return null;
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Gather user context and build the prompt that would be sent to OpenAI.
 * Does NOT call the API — useful for previewing / copying into ChatGPT.
 */
export async function previewBriefingQuery(
  userName: string, _userId: string, financialAlerts?: string[],
): Promise<{ systemPrompt: string; userMessage: string }> {
  const today = getTodayString();
  const [dashData, journalEntries, upcomingEvents, freshDigests] = await Promise.all([
    loadDashboardData(today, 7), getJournalEntries(), getUpcomingEvents(7), loadFreshDigests(_userId),
  ]);

  const tasksToday = dashData.tasks.map(t => ({
    name: t.name,
    status: dashData.completions.some(c => c.taskId === t.id && c.date === today) ? 'done' : 'pending',
  }));

  const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return formatDate(d); });
  const completionRate7d = Math.round((dashData.completions.filter(c => last7.includes(c.date)).length / ((dashData.tasks.length || 1) * 7)) * 100);

  const recentJournals = journalEntries
    .filter(j => j.date >= last7[last7.length - 1])
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map(j => ({ date: j.date, mood: j.mood, snippet: snippet(j.content) }));
  const moodTrend = computeMoodTrend(recentJournals.map(j => j.mood));
  const eventList = upcomingEvents.map(e => ({ name: e.event.name, date: e.date, daysUntil: e.daysUntil }));

  const needsDigests = missingDigestSources(freshDigests).length > 0;
  return {
    systemPrompt: buildSystemPrompt(needsDigests),
    userMessage: buildUserMessage(userName, today, tasksToday, eventList, recentJournals, financialAlerts || [], completionRate7d, moodTrend, freshDigests),
  };
}

export async function getDailyBriefing(
  userName: string, userId: string, financialAlerts?: string[],
): Promise<DailyBriefingResult> {
  const today = getTodayString();

  // 1. Session cache
  const sc = getSessionCache();
  if (sc) return sc;

  // 2. DB cache
  const dc = await loadDbCache(userId, today);
  if (dc) { setSessionCache(dc); return dc; }

  // 3. Gather context
  const [dashData, journalEntries, upcomingEvents, freshDigests, settings] = await Promise.all([
    loadDashboardData(today, 7), getJournalEntries(), getUpcomingEvents(7), loadFreshDigests(userId), getUserSettings(),
  ]);
  const personality: AIPersonality | undefined = settings.aiPersonality;

  const tasksToday = dashData.tasks.map(t => ({
    name: t.name,
    status: dashData.completions.some(c => c.taskId === t.id && c.date === today) ? 'done' : 'pending',
  }));

  const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return formatDate(d); });
  const completionRate7d = Math.round((dashData.completions.filter(c => last7.includes(c.date)).length / ((dashData.tasks.length || 1) * 7)) * 100);

  const recentJournals = journalEntries
    .filter(j => j.date >= last7[last7.length - 1])
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map(j => ({ date: j.date, mood: j.mood, snippet: snippet(j.content) }));
  const moodTrend = computeMoodTrend(recentJournals.map(j => j.mood));

  const eventList = upcomingEvents.map(e => ({ name: e.event.name, date: e.date, daysUntil: e.daysUntil }));

  const needsDigests = missingDigestSources(freshDigests).length > 0;
  const systemPrompt = buildSystemPrompt(needsDigests);
  const userMessage = buildUserMessage(
    userName, today, tasksToday, eventList, recentJournals,
    financialAlerts || [], completionRate7d, moodTrend, freshDigests,
  );

  const hasPersonality = personality && Object.values(personality).some(v => v?.trim());
  const requestPayload = {
    userName, date: today, todayTasks: tasksToday, upcomingEvents: eventList,
    recentJournals, financialAlerts: financialAlerts || [], completionRate7d, moodTrend,
    contentDigests: freshDigests.length > 0 ? freshDigests : undefined,
    requestDigests: needsDigests,
    personality: hasPersonality ? personality : undefined,
  };

  // 4. Call via central client
  const result = await callAI<any>({
    abilityId: 'daily_briefing',
    userId,
    requestPayload,
    systemPrompt,
    userMessage,
  });

  // OpenAI sometimes returns briefing as an object {main, supporting, tags} instead of a string
  const rawBriefing = result.data.briefing;
  const briefingText = typeof rawBriefing === 'string'
    ? rawBriefing
    : typeof rawBriefing === 'object' && rawBriefing !== null
      ? (rawBriefing.main || JSON.stringify(rawBriefing))
      : String(rawBriefing ?? '');

  const briefing: DailyBriefingResult = {
    briefing: briefingText,
    tone: result.data.tone || 'neutral',
    funQuote: result.data.funQuote || result.data.fun_quote,
    date: today,
    generatedAt: new Date().toISOString(),
    lastQuery: { systemPrompt: result.systemPrompt, userMessage: result.userMessage },
    usage: result.usage,
  };

  // 5. Persist
  saveDbCache(userId, briefingText, today, result.usage).catch(() => {});
  if (result.data.digests?.length) saveDigests(userId, result.data.digests).catch(() => {});
  setSessionCache(briefing);

  return briefing;
}

export async function refreshDailyBriefing(
  userName: string, userId: string, financialAlerts?: string[],
): Promise<DailyBriefingResult> {
  sessionStorage.removeItem(SESSION_KEY);
  const client = getSupabaseClient();
  if (client) {
    await client.from('myday_ai_digests').delete()
      .eq('user_id', userId).eq('digest_type', 'daily_briefing').eq('response_date', getTodayString());
  }
  return getDailyBriefing(userName, userId, financialAlerts);
}
