import { ExtractedItem } from '../src/services/imageScanning/types';
import { applyRateLimit, RATE_LIMITS } from './_utils/rateLimit.js';
import { handleApiError, createErrorResponse } from './_utils/errorHandler.js';
import { resolveAIProvider } from './_utils/aiProvider.js';

/**
 * Unified AI endpoint — one serverless function for every AI *chat/vision* task.
 *
 * Dispatches on `body.task` so we don't spend one Vercel function per feature
 * (Hobby plan caps at 12). Each task owns its own system prompt, model, token
 * budget, rate limit, and output parsing below. UI look-and-feel stays in the
 * client; this route only turns a payload into an AI result.
 *
 * Tasks:
 *   - daily_briefing     → personalised morning briefing            (see #2 below)
 *   - journal_reflect    → 3 journal reflection messages
 *   - trades_insights    → portfolio insights (mode: insights | qa)
 *   - scan_image         → vision extraction from a photo
 *
 * Non-chat routes (quote, ticker-news, google-*, demo-login, keep-alive) and the
 * astrology proxy (astro.ts) stay separate — they aren't OpenAI chat calls.
 */

type TaskId =
  | 'daily_briefing'
  | 'journal_reflect'
  | 'journal_reflection'
  | 'trades_insights'
  | 'trades_qa'
  | 'scan_image';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const task = String(req.body?.task || '').trim() as TaskId;

  try {
    switch (task) {
      case 'daily_briefing':
        return await runDailyBriefing(req, res);
      case 'journal_reflect':
      case 'journal_reflection':
        return await runJournalReflect(req, res);
      case 'trades_insights':
      case 'trades_qa':
        return await runTradesInsights(req, res);
      case 'scan_image':
        return await runScanImage(req, res);
      default:
        return res.status(400).json(
          createErrorResponse('VALIDATION_ERROR', `Unknown or missing AI task: "${task || '(none)'}"`),
        );
    }
  } catch (err: unknown) {
    handleApiError(res, err, `ai-${task || 'unknown'}`, 500, 'SERVER_ERROR');
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. daily_briefing
 * ═══════════════════════════════════════════════════════════════════════════ */

interface BriefingRequest {
  userName: string;
  date: string;
  todayTasks: { name: string; status: string; streak?: number }[];
  upcomingEvents: { name: string; date: string; daysUntil: number }[];
  recentJournals: { date: string; mood?: string; snippet: string }[];
  financialAlerts: string[];
  completionRate7d: number;
  moodTrend: string;
  contentDigests?: { source: string; digest: string; coversTo: string }[];
  requestDigests?: boolean;
  personality?: Record<string, string | undefined>;
}

async function runDailyBriefing(req: any, res: any) {
  if (!applyRateLimit(req, res, { windowMs: 60_000, maxRequests: 3 })) return;

  const ai = resolveAIProvider(req.body?.provider);
  if (!ai.apiKey) {
    console.error(`[ai:daily_briefing] API key not configured for provider: ${ai.provider}`);
    return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'AI service not configured'));
  }

  const body: BriefingRequest = req.body || {};
  if (!body.date) {
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'date is required'));
  }

  const todayTasks = body.todayTasks || [];
  const upcomingEvents = body.upcomingEvents || [];
  const recentJournals = body.recentJournals || [];
  const financialAlerts = body.financialAlerts || [];
  const completionRate7d = body.completionRate7d ?? 0;
  const moodTrend = body.moodTrend || 'stable';
  const personality = body.personality && typeof body.personality === 'object' ? body.personality : null;

  const personalityBlock = personality
    ? `\nPERSONALISATION HINTS (use these to add fun, personal references — don't force them, weave naturally):
${Object.entries(personality).filter(([_, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n`
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

  const digestMap = new Map((body.contentDigests || []).map(d => [d.source, d]));
  const sections: string[] = [];
  sections.push(`Date: ${body.date}`);
  sections.push(`User: ${body.userName || 'User'}`);

  if (digestMap.has('tasks')) {
    sections.push(`[Tasks digest – covers to ${digestMap.get('tasks')!.coversTo}]\n${digestMap.get('tasks')!.digest}`);
  } else {
    sections.push(`Tasks today (7-day completion ${completionRate7d}%):\n${todayTasks.map(t => `- ${t.name} [${t.status}]${t.streak ? ` (${t.streak}-day streak)` : ''}`).join('\n') || 'None'}`);
  }
  if (digestMap.has('events')) {
    sections.push(`[Events digest – covers to ${digestMap.get('events')!.coversTo}]\n${digestMap.get('events')!.digest}`);
  } else {
    sections.push(`Upcoming events:\n${upcomingEvents.map(e => `- ${e.name} (${e.date}, ${e.daysUntil === 0 ? 'today' : e.daysUntil + 'd away'})`).join('\n') || 'None'}`);
  }
  if (digestMap.has('journal')) {
    sections.push(`[Journal digest – covers to ${digestMap.get('journal')!.coversTo}]\n${digestMap.get('journal')!.digest}`);
  } else {
    sections.push(`Recent journal mood trend: ${moodTrend}\nEntries:\n${recentJournals.map(j => `- ${j.date} [${j.mood || 'no mood'}]: ${j.snippet}`).join('\n') || 'None'}`);
  }
  if (digestMap.has('financial')) {
    sections.push(`[Financial digest – covers to ${digestMap.get('financial')!.coversTo}]\n${digestMap.get('financial')!.digest}`);
  } else {
    sections.push(`Financial alerts:\n${financialAlerts.length > 0 ? financialAlerts.map(a => `- ${a}`).join('\n') : 'None'}`);
  }

  const userMessage = sections.join('\n\n');
  const response = await fetch(ai.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ai.apiKey}` },
    body: JSON.stringify({
      model: ai.model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[ai:daily_briefing] ${ai.provider} error ${response.status} (model=${ai.model}):`, errText.slice(0, 800));
    const detail = (() => { try { return JSON.parse(errText)?.error?.message || errText; } catch { return errText; } })();
    return res.status(502).json(createErrorResponse('EXTERNAL_API_ERROR', `${ai.provider} (${ai.model}) error ${response.status}: ${String(detail).slice(0, 300)}`));
  }

  const data = await response.json() as any;
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) return res.status(502).json(createErrorResponse('EXTERNAL_API_ERROR', 'Empty AI response'));

  let parsed: any;
  try { parsed = JSON.parse(rawContent.replace(/```json\n?|\n?```/g, '').trim()); }
  catch { parsed = { briefing: rawContent, tone: 'neutral' }; }

  return res.status(200).json({
    briefing: parsed.briefing || rawContent,
    tone: parsed.tone || 'neutral',
    funQuote: parsed.fun_quote || parsed.funQuote || undefined,
    digests: parsed.digests,
    usage: {
      prompt_tokens: data.usage?.prompt_tokens ?? 0,
      completion_tokens: data.usage?.completion_tokens ?? 0,
      model: ai.model,
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. journal_reflect
 * ═══════════════════════════════════════════════════════════════════════════ */

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
  personality?: Record<string, string | undefined>;
}

async function runJournalReflect(req: any, res: any) {
  if (!applyRateLimit(req, res, { windowMs: 60_000, maxRequests: 5 })) return;

  const ai = resolveAIProvider(req.body?.provider);
  if (!ai.apiKey) {
    console.error(`[ai:journal_reflect] API key not configured for provider: ${ai.provider}`);
    return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'AI service not configured'));
  }

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

  const digestMap = new Map((body.contentDigests || []).map(d => [d.source, d]));
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
    sections.push(`Weather & location: ${[body.weather, body.location].filter(Boolean).join(' · ')}`);
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
  const response = await fetch(ai.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ai.apiKey}` },
    body: JSON.stringify({
      model: ai.model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[ai:journal_reflect] ${ai.provider} error ${response.status} (model=${ai.model}):`, errText.slice(0, 800));
    const detail = (() => { try { return JSON.parse(errText)?.error?.message || errText; } catch { return errText; } })();
    return res.status(502).json(createErrorResponse('EXTERNAL_API_ERROR', `${ai.provider} (${ai.model}) error ${response.status}: ${String(detail).slice(0, 300)}`));
  }

  const data = await response.json() as any;
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) return res.status(502).json(createErrorResponse('EXTERNAL_API_ERROR', 'Empty AI response'));

  let parsed: any;
  try { parsed = JSON.parse(rawContent.replace(/```json\n?|\n?```/g, '').trim()); }
  catch { parsed = { reflection: rawContent, mood_observation: 'stable', prompt_for_tomorrow: '', weather_suggestion: '', activity_idea: '' }; }

  return res.status(200).json({
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
      model: ai.model,
    },
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. trades_insights / trades_qa (mode: 'insights' | 'qa')
 * ═══════════════════════════════════════════════════════════════════════════ */

const INSIGHTS_SYSTEM = `You are a sharp, plain-spoken portfolio analyst inside a personal finance app.
You are given a COMPACT snapshot of one user's trading portfolio (holdings, open options, income, realized results). Analyse ONLY this data.
Produce 4-7 genuinely useful, SPECIFIC insights — reference real tickers, amounts, and percentages from the snapshot. No generic advice, no filler.
Cover a mix of: income mix & trend, position concentration risk, open options & assignment risk (ITM legs / near expiry), realized winners & losers, and which positions warrant closer attention.
Focus on analysing the user's PAST behaviour and current risk exposure. Do NOT predict future prices, returns, or market moves. Do NOT give buy/sell/hold recommendations or price targets. Instead, help the user understand what they've done and where their biggest risks are so they can decide for themselves.
Be honest about risk but not alarmist. If live prices are missing for some holdings, note that values may be understated. Never invent data not in the snapshot. This is analysis of the user's own data, not financial advice.
Respond ONLY with valid JSON matching:
{"headline":"one punchy sentence on overall portfolio pulse","insights":[{"category":"Income|Concentration|Options|Realized|Action|Risk","title":"short title","detail":"1-3 sentences, specific","severity":"good|watch|risk|info"}]}`;

const QA_SYSTEM = `You are a portfolio analyst answering a user's question about THEIR portfolio.
Use ONLY the provided snapshot. Reference specific tickers/amounts. If the snapshot lacks the info, say so briefly. Be concise (under 150 words), concrete, and neutral.
Do NOT predict future prices or market moves, and do NOT give buy/sell/hold recommendations or price targets — analyse the user's own data and risks so they can decide for themselves. This is analysis, not financial advice.
Respond ONLY with valid JSON matching: {"answer":"..."}`;

async function runTradesInsights(req: any, res: any) {
  if (!applyRateLimit(req, res, { windowMs: 60_000, maxRequests: 10 })) return;

  const ai = resolveAIProvider(req.body?.provider);
  if (!ai.apiKey) {
    console.error(`[ai:trades_insights] API key not configured for provider: ${ai.provider}`);
    return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'AI service not configured'));
  }

  const body = req.body || {};
  const mode = body.mode === 'qa' || body.task === 'trades_qa' ? 'qa' : 'insights';
  const context = (body.context || '').trim();
  if (!context) {
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'context is required'));
  }
  if (mode === 'qa' && !(body.question || '').trim()) {
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'question is required for qa mode'));
  }

  const systemPrompt = mode === 'qa' ? QA_SYSTEM : INSIGHTS_SYSTEM;
  const userMessage = mode === 'qa'
    ? `${context}\n\nQUESTION: ${(body.question || '').trim()}`
    : context;

  const response = await fetch(ai.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ai.apiKey}` },
    body: JSON.stringify({
      model: ai.model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
      max_tokens: mode === 'qa' ? 600 : 1000,
      temperature: mode === 'qa' ? 0.3 : 0.4,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[ai:trades_insights] ${ai.provider} error ${response.status} (model=${ai.model}):`, errText.slice(0, 800));
    const detail = (() => { try { return JSON.parse(errText)?.error?.message || errText; } catch { return errText; } })();
    return res.status(502).json(createErrorResponse('EXTERNAL_API_ERROR', `${ai.provider} (${ai.model}) error ${response.status}: ${String(detail).slice(0, 300)}`));
  }

  const data = await response.json() as any;
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) return res.status(502).json(createErrorResponse('EXTERNAL_API_ERROR', 'Empty AI response'));

  const clean = String(rawContent).replace(/```json\n?|\n?```/g, '').trim();
  let parsed: any;
  try { parsed = JSON.parse(clean); } catch { parsed = null; }

  const usage = {
    prompt_tokens: data.usage?.prompt_tokens ?? 0,
    completion_tokens: data.usage?.completion_tokens ?? 0,
    model: ai.model,
  };

  if (mode === 'qa') {
    const answer = parsed?.answer && typeof parsed.answer === 'string' ? parsed.answer : clean;
    return res.status(200).json({ answer, usage });
  }

  const result = parsed && typeof parsed === 'object'
    ? { headline: parsed.headline || 'Portfolio review', insights: Array.isArray(parsed.insights) ? parsed.insights : [], usage }
    : { headline: 'Portfolio review', insights: [], usage };

  return res.status(200).json(result);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. scan_image (vision)
 * ═══════════════════════════════════════════════════════════════════════════ */

async function runScanImage(req: any, res: any) {
  if (!applyRateLimit(req, res, RATE_LIMITS.imageProcessing)) return;

  // Vision needs a vision-capable model. OpenAI uses gpt-4o; Gemini flash is multimodal.
  const ai = resolveAIProvider(req.body?.provider, { openaiModel: 'gpt-4o' });
  if (!ai.apiKey) {
    return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'Image scanning not available'));
  }

  const { image, mimeType, hints } = req.body || {};
  if (!image) {
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'No image provided'));
  }

  const keywords = hints?.keywords || '';
  const isFinancial = hints?.isFinancial || false;

  if (image.length > 10 * 1024 * 1024) {
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Image too large (max 10MB)'));
  }
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (mimeType && !allowedMimeTypes.includes(mimeType)) {
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid image type'));
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(image)) {
    return res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid image encoding'));
  }

  const response = await fetch(ai.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ai.apiKey}` },
    body: JSON.stringify({
      model: ai.model,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this image and extract structured information. Identify what type of document/image this is and extract relevant data.
${keywords ? `\nIMPORTANT CONTEXT from user: "${keywords}" - use this hint to help identify the source/content.` : ''}
${isFinancial ? `\nIMPORTANT: User has indicated this is FINANCIAL INFORMATION - prioritize extracting financial/investment data.` : ''}

Possible types:
- Birthday card (extract: person name, date, message)
- Invitation (extract: event name, date, time, location, host)
- Handwritten TODO list (extract: list of tasks)
- Receipt (extract: merchant, amount, date, items)
- Gift card (extract: brand, amount, code/pin)
- Meeting notes (extract: action items, attendees, notes)
- Workout plan (extract: goal, exercises, target)
- Prescription (extract: medicine name, dosage, frequency)
- Financial screenshot - brokerage/investment app screenshot (Robinhood, Fidelity, Schwab, Vanguard, E*Trade, Zerodha, Groww, Coinbase, etc.)
  Extract: source app name, accounts with names/types/balances, individual holdings with symbol/name/quantity/value/change

Return a JSON array of objects with this structure:
{
  "type": "birthday|invitation|todo|receipt|gift-card|meeting-notes|workout-plan|prescription|financial-screenshot",
  "confidence": 0.0-1.0,
  "title": "Short title",
  "description": "Brief description",
  "data": { ...type-specific fields... }
}

For financial-screenshot type, data should be:
{
  "source": "robinhood|fidelity|schwab|vanguard|etrade|zerodha|groww|coinbase|unknown",
  "accounts": [{ "name": "...", "type": "brokerage|retirement|savings|checking|crypto|other", "balance": number, "currency": "USD|INR|...", "holdings": [{ "symbol": "AAPL", "name": "Apple Inc", "quantity": 10, "value": 1500.00, "change": 25.50, "changePercent": 1.5 }] }],
  "totalValue": number
}

If multiple items are found (e.g., birthday AND a task to buy a gift), return multiple objects.
If nothing relevant is found, return an empty array.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanations.`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${image}` },
          },
        ],
      }],
      max_tokens: 1000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error(`[ai:scan_image] ${ai.provider} API error:`, error);
    return res.status(500).json(createErrorResponse('EXTERNAL_API_ERROR', 'Image analysis failed'));
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return res.status(500).json(createErrorResponse('EXTERNAL_API_ERROR', 'No response from AI'));
  }

  let parsedItems: any[] = [];
  try { parsedItems = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim()); }
  catch {
    console.error('[ai:scan_image] Failed to parse AI response:', String(content).slice(0, 200));
    return res.status(500).json(createErrorResponse('PARSE_ERROR', 'Failed to process AI response'));
  }

  const items: ExtractedItem[] = parsedItems.map((item: any) => ({
    id: crypto.randomUUID(),
    type: item.type || 'todo',
    confidence: item.confidence || 0.8,
    title: item.title || 'Untitled',
    description: item.description,
    data: item.data || {},
    suggestedDestination: getSuggestedDestination(item.type),
    icon: getIcon(item.type),
  }));

  return res.status(200).json({ items, rawText: content });
}

function getSuggestedDestination(type: string): 'event' | 'task' | 'todo' | 'journal' | 'safe' | 'gift-card' | 'resolution' | 'financial-import' {
  const mapping: Record<string, 'event' | 'task' | 'todo' | 'journal' | 'safe' | 'gift-card' | 'resolution' | 'financial-import'> = {
    'birthday': 'event',
    'invitation': 'event',
    'todo': 'todo',
    'receipt': 'safe',
    'gift-card': 'gift-card',
    'meeting-notes': 'task',
    'workout-plan': 'resolution',
    'prescription': 'safe',
    'financial-screenshot': 'financial-import',
  };
  return mapping[type] || 'task';
}

function getIcon(type: string): string {
  const icons: Record<string, string> = {
    'birthday': '🎂',
    'invitation': '💌',
    'todo': '✅',
    'receipt': '🧾',
    'gift-card': '🎁',
    'meeting-notes': '📋',
    'workout-plan': '🏃',
    'prescription': '💊',
    'financial-screenshot': '📊',
  };
  return icons[type] || '📄';
}
