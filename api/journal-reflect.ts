import { applyRateLimit } from './_utils/rateLimit.js';
import { handleApiError, createErrorResponse } from './_utils/errorHandler.js';

/**
 * POST /api/journal-reflect
 *
 * Generates 3 personalised AI messages:
 *   1. Personal reflection (journal, mood, tasks, events)
 *   2. Weather/season/steps wellness suggestion
 *   3. Activity/event/motivation idea
 *
 * Works with or without a saved journal entry.
 */

interface ReflectRequest {
  userName: string;
  date: string;
  currentEntry: { date: string; content: string; mood?: string } | null;
  recentEntries: { date: string; mood?: string; snippet: string }[];
  moodTrend: string;
  todayTasks: { name: string; status: string }[];
  completionRate7d: number;

  contentDigests?: { source: string; digest: string; coversTo: string }[];
  requestDigests?: boolean;

  weather?: string;
  location?: string;
  stepsToday?: number | null;
  stepsYesterday?: number | null;
  upcomingEvents?: { name: string; category?: string; daysUntil: number }[];

  personality?: {
    favoritePlace?: string;
    favoriteCharacter?: string;
    favoriteShow?: string;
    superhero?: string;
    favoriteQuote?: string;
    favoriteHobby?: string;
    spiritAnimal?: string;
    favoriteFood?: string;
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(req, res, { windowMs: 60_000, maxRequests: 5 })) {
    return;
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.error('[journal-reflect] OPENAI_API_KEY not configured');
    return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'AI service not configured'));
  }

  try {
    const body: ReflectRequest = req.body || {};

    const recentEntries = body.recentEntries || [];
    const todayTasks = body.todayTasks || [];
    const completionRate7d = body.completionRate7d ?? 0;
    const moodTrend = body.moodTrend || 'stable';
    const personality = body.personality && typeof body.personality === 'object' ? body.personality : null;
    const upcomingEvents = body.upcomingEvents || [];

    const personalityBlock = personality
      ? `\nPERSONALISATION HINTS (weave naturally — don't force):
${Object.entries(personality).filter(([_, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n`
      : '';

    const systemPrompt = `You are Leo, the empathetic AI companion inside the MyDay journal app.
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
- ALWAYS include a "fun_quote" — a witty, fun, or inspirational one-liner tied to the user's interests if personality hints are provided.
- Never lecture. Be concise and specific.
- mood_observation: summarise the mood trend in one word.
- prompt_for_tomorrow: one curious question they might journal about.
${personalityBlock}
${body.requestDigests ? `DIGEST GENERATION:
Also return a "digests" array with compact summaries (max 100 words each) for
sources where raw data was provided.  Sources: "journal", "tasks".` : ''}

Respond ONLY with valid JSON:
{
  "reflection": "...",
  "mood_observation": "improving|declining|stable|mixed",
  "prompt_for_tomorrow": "...",
  "weather_suggestion": "...",
  "activity_idea": "...",
  "fun_quote": "..."${body.requestDigests ? ',\n  "digests": [{ "source": "journal|tasks", "digest": "...", "coversTo": "YYYY-MM-DD" }]' : ''}
}`;

    const digestMap = new Map(
      (body.contentDigests || []).map(d => [d.source, d])
    );

    const sections: string[] = [];
    sections.push(`User: ${body.userName || 'User'}`);
    sections.push(`Date: ${body.date || new Date().toISOString().slice(0, 10)}`);

    if (body.currentEntry?.content) {
      sections.push(`Today's journal entry (mood: ${body.currentEntry.mood || 'not set'}):\n"${body.currentEntry.content}"`);
    } else {
      sections.push(`No journal entry written yet today.`);
    }

    if (digestMap.has('journal')) {
      sections.push(`[Past journal digest – covers to ${digestMap.get('journal')!.coversTo}]\n${digestMap.get('journal')!.digest}`);
    } else if (recentEntries.length > 0) {
      sections.push(`Recent entries (mood trend: ${moodTrend}):\n${recentEntries.map(e => `- ${e.date} [${e.mood || '?'}]: ${e.snippet}`).join('\n')}`);
    }

    if (digestMap.has('tasks')) {
      sections.push(`[Tasks digest – covers to ${digestMap.get('tasks')!.coversTo}]\n${digestMap.get('tasks')!.digest}`);
    } else if (todayTasks.length > 0) {
      sections.push(`Tasks today (7d completion ${completionRate7d}%):\n${todayTasks.map(t => `- ${t.name} [${t.status}]`).join('\n')}`);
    }

    if (body.weather || body.location) {
      const parts = [body.weather, body.location].filter(Boolean);
      sections.push(`Weather & location: ${parts.join(' · ')}`);
    }

    if (body.stepsToday != null || body.stepsYesterday != null) {
      const stepParts: string[] = [];
      if (body.stepsToday != null) stepParts.push(`Today: ${body.stepsToday.toLocaleString()} steps`);
      if (body.stepsYesterday != null) stepParts.push(`Yesterday: ${body.stepsYesterday.toLocaleString()} steps`);
      sections.push(`Steps: ${stepParts.join(', ')}`);
    }

    if (upcomingEvents.length > 0) {
      sections.push(`Upcoming events (next 14 days):\n${upcomingEvents.map(e =>
        `- ${e.name}${e.category ? ` (${e.category})` : ''} — ${e.daysUntil === 0 ? 'today' : e.daysUntil === 1 ? 'tomorrow' : `in ${e.daysUntil} days`}`
      ).join('\n')}`);
    }

    const userMessage = sections.join('\n\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('[journal-reflect] OpenAI error:', err);
      return res.status(502).json(createErrorResponse('EXTERNAL_API_ERROR', 'AI service unavailable'));
    }

    const data = await response.json() as any;
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      return res.status(502).json(createErrorResponse('EXTERNAL_API_ERROR', 'Empty AI response'));
    }

    let parsed: any;
    try {
      const clean = rawContent.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = { reflection: rawContent, mood_observation: 'stable', prompt_for_tomorrow: '', weather_suggestion: '', activity_idea: '' };
    }

    const reflectResult = {
      reflection: parsed.reflection || rawContent,
      moodObservation: parsed.mood_observation || 'stable',
      promptForTomorrow: parsed.prompt_for_tomorrow || '',
      weatherSuggestion: parsed.weather_suggestion || '',
      activityIdea: parsed.activity_idea || '',
      funQuote: parsed.fun_quote || parsed.funQuote || undefined,
      digests: parsed.digests,
      usage: {
        prompt_tokens: data.usage?.prompt_tokens ?? 0,
        completion_tokens: data.usage?.completion_tokens ?? 0,
        model: 'gpt-4o-mini',
      },
    };

    return res.status(200).json(reflectResult);
  } catch (err: unknown) {
    handleApiError(res, err, 'journal-reflect', 500, 'SERVER_ERROR');
  }
}
