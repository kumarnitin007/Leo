import { applyRateLimit } from './_utils/rateLimit.js';
import { handleApiError, createErrorResponse } from './_utils/errorHandler.js';
import { resolveAIProvider } from './_utils/aiProvider.js';

/**
 * POST /api/trades-insights
 *
 * Two modes (body.mode):
 * - "insights": analyse the compact portfolio `context` and return a headline +
 *   an array of specific, categorised insights (JSON).
 * - "qa": answer a free-text `question` about the same `context` (plain text).
 *
 * The caller sends only a COMPACT text snapshot (`context`) built client-side
 * from a structured digest — never raw transactions — to keep tokens small and
 * avoid sending sensitive detail.
 */

interface TradesInsightsRequest {
  mode?: 'insights' | 'qa';
  context?: string;
  question?: string;
  provider?: string;
}

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(req, res, { windowMs: 60_000, maxRequests: 10 })) {
    return;
  }

  const ai = resolveAIProvider(req.body?.provider);
  if (!ai.apiKey) {
    console.error(`[trades-insights] API key not configured for provider: ${ai.provider}`);
    return res.status(500).json(createErrorResponse('CONFIG_ERROR', 'AI service not configured'));
  }

  try {
    const body: TradesInsightsRequest = req.body || {};
    const mode = body.mode === 'qa' ? 'qa' : 'insights';
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ai.apiKey}`,
      },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: mode === 'qa' ? 600 : 1000,
        temperature: mode === 'qa' ? 0.3 : 0.4,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[trades-insights] ${ai.provider} error ${response.status} (model=${ai.model}):`, errText.slice(0, 800));
      const detail = (() => { try { return JSON.parse(errText)?.error?.message || errText; } catch { return errText; } })();
      return res.status(502).json(createErrorResponse(
        'EXTERNAL_API_ERROR',
        `${ai.provider} (${ai.model}) error ${response.status}: ${String(detail).slice(0, 300)}`,
      ));
    }

    const data = await response.json() as any;
    const rawContent = data.choices?.[0]?.message?.content;
    if (!rawContent) {
      return res.status(502).json(createErrorResponse('EXTERNAL_API_ERROR', 'Empty AI response'));
    }

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
  } catch (err: unknown) {
    handleApiError(res, err, 'trades-insights', 500, 'SERVER_ERROR');
  }
}
