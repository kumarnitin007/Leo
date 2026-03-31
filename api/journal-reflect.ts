import { applyRateLimit } from './_utils/rateLimit.js';
import { handleApiError, createErrorResponse } from './_utils/errorHandler.js';

/**
 * POST /api/journal-reflect
 *
 * Given the current journal entry + recent context (past entries, mood trend,
 * tasks), returns a personalised reflection and, optionally, fresh content
 * digests to optimise future calls.
 */

interface ReflectRequest {
  userName: string;
  currentEntry: { date: string; content: string; mood?: string };
  recentEntries: { date: string; mood?: string; snippet: string }[];
  moodTrend: string;
  todayTasks: { name: string; status: string }[];
  completionRate7d: number;

  contentDigests?: { source: string; digest: string; coversTo: string }[];
  requestDigests?: boolean;

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

    if (!body.currentEntry?.content) {
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Journal content is required'));
    }

    const recentEntries = body.recentEntries || [];
    const todayTasks = body.todayTasks || [];
    const completionRate7d = body.completionRate7d ?? 0;
    const moodTrend = body.moodTrend || 'stable';
    const personality = body.personality && typeof body.personality === 'object' ? body.personality : null;

    const personalityBlock = personality
      ? `\nPERSONALISATION HINTS (weave naturally — don't force):
${Object.entries(personality).filter(([_, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n`
      : '';

    const systemPrompt = `You are Leo, the empathetic AI companion inside the MyDay journal.
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
- ALWAYS include a "fun_quote" — a witty, fun, or inspirational one-liner. If personality hints are provided, tie it to the user's interests (superhero reference, show quote, etc.). Otherwise pick something original.
${personalityBlock}
${body.requestDigests ? `DIGEST GENERATION:
Also return a "digests" array with compact summaries (max 100 words each) for
sources where raw data was provided.  Sources: "journal", "tasks".` : ''}

Respond ONLY with valid JSON:
{
  "reflection": "...",
  "mood_observation": "improving|declining|stable|mixed",
  "prompt_for_tomorrow": "...",
  "fun_quote": "..."${body.requestDigests ? ',\n  "digests": [{ "source": "journal|tasks", "digest": "...", "coversTo": "YYYY-MM-DD" }]' : ''}
}`;

    const digestMap = new Map(
      (body.contentDigests || []).map(d => [d.source, d])
    );

    const sections: string[] = [];
    sections.push(`User: ${body.userName || 'User'}`);
    sections.push(`Today's entry (${body.currentEntry.date}, mood: ${body.currentEntry.mood || 'not set'}):\n"${body.currentEntry.content}"`);

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
        max_tokens: 600,
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
      parsed = { reflection: rawContent, mood_observation: 'stable', prompt_for_tomorrow: '' };
    }

    const reflectResult = {
      reflection: parsed.reflection || rawContent,
      moodObservation: parsed.mood_observation || 'stable',
      promptForTomorrow: parsed.prompt_for_tomorrow || '',
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
