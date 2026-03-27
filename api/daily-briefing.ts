import { applyRateLimit, RATE_LIMITS } from './utils/rateLimit';
import { handleApiError, createErrorResponse } from './utils/errorHandler';

/**
 * POST /api/daily-briefing
 *
 * Accepts structured context about the user's day and returns a personalised
 * morning briefing.  Two optimisation mechanisms:
 *
 * 1. **Content digests** – If the caller supplies `contentDigests` (compact
 *    AI-generated summaries from previous calls), those are injected into the
 *    prompt instead of raw text, cutting input tokens dramatically.
 *
 * 2. **Digest generation** – When `requestDigests` is true (or when no digest
 *    exists for a source), the response includes freshly generated digests the
 *    client should persist for next time.
 */

interface BriefingRequest {
  userName: string;
  date: string;                        // YYYY-MM-DD
  todayTasks: { name: string; status: string; streak?: number }[];
  upcomingEvents: { name: string; date: string; daysUntil: number }[];
  recentJournals: { date: string; mood?: string; snippet: string }[];
  financialAlerts: string[];
  completionRate7d: number;            // 0-100
  moodTrend: string;                   // e.g. "improving", "declining", "stable"

  // Digest optimisation
  contentDigests?: {
    source: string;                     // 'journal' | 'tasks' | 'events' | 'financial'
    digest: string;
    coversTo: string;                   // ISO date
  }[];
  requestDigests?: boolean;            // ask AI to return digests in response

  // Personality hints for fun references
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

interface BriefingResponse {
  briefing: string;
  tone: string;
  funQuote?: string;
  digests?: {
    source: string;
    digest: string;
    coversTo: string;
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number; model: string };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(req, res, { windowMs: 60_000, maxRequests: 3 })) {
    return;
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'AI service not configured'));
  }

  try {
    const body: BriefingRequest = req.body;

    if (!body.date) {
      return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'date is required'));
    }

    // ── Build the system prompt ──────────────────────────────────────
    const personalityBlock = body.personality
      ? `\nPERSONALISATION HINTS (use these to add fun, personal references — don't force them, weave naturally):
${Object.entries(body.personality).filter(([_, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n`
      : '';

    const systemPrompt = `You are Leo, the personal AI assistant inside the MyDay productivity app.
Your job is to deliver a warm, concise morning briefing that feels like a supportive friend — not a corporate bot.

Rules:
- Keep the briefing under 200 words.
- Mention the user by first name.
- Reference specific tasks, events, journal moods, and financial alerts from the context.
- Spot patterns (streaks, mood trends, busy days) and give ONE actionable suggestion.
- Use a tone that matches the user's recent mood (upbeat if they're doing well, gentle if struggling).
- Never be preachy or generic — be specific to THIS user's data.
- End with one short motivational or lighthearted line.
- ALWAYS include a "fun_quote" — a witty, fun, or inspirational one-liner. If personality hints are provided, reference them (e.g. a superhero quote, a show reference, a travel metaphor). If not, pick something clever and original.
${personalityBlock}
${body.requestDigests ? `IMPORTANT — DIGEST GENERATION:
In addition to the briefing, return a "digests" array.  Each digest is a compact
summary (max 150 words) of one data source that can replace the raw data in future
requests to save tokens.  Sources: "journal", "tasks", "events", "financial".
Only generate digests for sources where raw data was provided (not for sources
that already came in as a digest).` : ''}

Respond ONLY with valid JSON matching this schema:
{
  "briefing": "...",
  "tone": "upbeat|gentle|neutral|encouraging",
  "fun_quote": "..."${body.requestDigests ? ',\n  "digests": [{ "source": "journal|tasks|events|financial", "digest": "...", "coversTo": "YYYY-MM-DD" }]' : ''}
}`;

    // ── Build user message with raw data or digests ──────────────────
    const digestMap = new Map(
      (body.contentDigests || []).map(d => [d.source, d])
    );

    const sections: string[] = [];
    sections.push(`Date: ${body.date}`);
    sections.push(`User: ${body.userName}`);

    // Tasks
    if (digestMap.has('tasks')) {
      sections.push(`[Tasks digest – covers to ${digestMap.get('tasks')!.coversTo}]\n${digestMap.get('tasks')!.digest}`);
    } else {
      sections.push(`Tasks today (7-day completion ${body.completionRate7d}%):\n${body.todayTasks.map(t => `- ${t.name} [${t.status}]${t.streak ? ` (${t.streak}-day streak)` : ''}`).join('\n') || 'None'}`);
    }

    // Events
    if (digestMap.has('events')) {
      sections.push(`[Events digest – covers to ${digestMap.get('events')!.coversTo}]\n${digestMap.get('events')!.digest}`);
    } else {
      sections.push(`Upcoming events:\n${body.upcomingEvents.map(e => `- ${e.name} (${e.date}, ${e.daysUntil === 0 ? 'today' : e.daysUntil + 'd away'})`).join('\n') || 'None'}`);
    }

    // Journals
    if (digestMap.has('journal')) {
      sections.push(`[Journal digest – covers to ${digestMap.get('journal')!.coversTo}]\n${digestMap.get('journal')!.digest}`);
    } else {
      sections.push(`Recent journal mood trend: ${body.moodTrend}\nEntries:\n${body.recentJournals.map(j => `- ${j.date} [${j.mood || 'no mood'}]: ${j.snippet}`).join('\n') || 'None'}`);
    }

    // Financial
    if (digestMap.has('financial')) {
      sections.push(`[Financial digest – covers to ${digestMap.get('financial')!.coversTo}]\n${digestMap.get('financial')!.digest}`);
    } else {
      sections.push(`Financial alerts:\n${body.financialAlerts.length > 0 ? body.financialAlerts.map(a => `- ${a}`).join('\n') : 'None'}`);
    }

    const userMessage = sections.join('\n\n');

    // ── Call OpenAI ──────────────────────────────────────────────────
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
      console.error('OpenAI API error:', err);
      return res.status(502).json(createErrorResponse('EXTERNAL_API_ERROR', 'AI service unavailable'));
    }

    const data = await response.json() as any;
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      return res.status(502).json(createErrorResponse('EXTERNAL_API_ERROR', 'Empty AI response'));
    }

    // Parse JSON (strip markdown fences if present)
    let parsed: any;
    try {
      const clean = rawContent.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      // If parsing fails, wrap raw text as a briefing
      parsed = { briefing: rawContent, tone: 'neutral' };
    }

    const result: BriefingResponse = {
      briefing: parsed.briefing || rawContent,
      tone: parsed.tone || 'neutral',
      funQuote: parsed.fun_quote || parsed.funQuote || undefined,
      digests: parsed.digests,
      usage: {
        prompt_tokens: data.usage?.prompt_tokens ?? 0,
        completion_tokens: data.usage?.completion_tokens ?? 0,
        model: 'gpt-4o-mini',
      },
    };

    return res.status(200).json(result);
  } catch (err: unknown) {
    handleApiError(res, err, 'daily-briefing', 500, 'SERVER_ERROR');
  }
}
