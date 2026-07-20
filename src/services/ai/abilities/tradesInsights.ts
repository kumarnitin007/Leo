/**
 * Trades / Portfolio Insights abilities.
 *
 * Two abilities share one endpoint (/api/trades-insights) and one compact
 * portfolio context (built client-side from the digest — never raw trades):
 *
 * - trades_insights: a daily, cached multi-insight review (headline + cards).
 * - trades_qa:       an on-demand free-text question against the same snapshot.
 *
 * Token optimisation: the context is a terse serialization of the digest, and
 * the insights result is cached per day (session + DB) so repeat opens cost 0.
 */

import { getTodayString } from '../../../utils';
import { getSupabaseClient } from '../../../lib/supabase';
import { callAI } from '../aiClient';
import type { AIUsage } from '../types';
import { serializePortfolioContext, PortfolioDigest } from '../../trades/tradesInsightsData';

export type InsightSeverity = 'good' | 'watch' | 'risk' | 'info';

export interface TradeInsight {
  category: string;      // e.g. "Income", "Concentration", "Options", "Realized", "Action"
  title: string;
  detail: string;
  severity: InsightSeverity;
}

export interface TradesInsightsResult {
  headline: string;
  insights: TradeInsight[];
  asOf: string;          // snapshot date the insights were computed from
  generatedAt: string;
  usage?: AIUsage;
  lastQuery?: { systemPrompt: string; userMessage: string };
}

const SESSION_KEY = 'myday_trades_insights_cache';

const INSIGHTS_SYSTEM = `You are a sharp, plain-spoken portfolio analyst inside a personal finance app.
You are given a COMPACT snapshot of one user's trading portfolio (holdings, open options, income, realized results). Analyse ONLY this data.
Produce 4–7 genuinely useful, SPECIFIC insights — reference real tickers, amounts, and percentages from the snapshot. No generic advice, no filler.
Cover a mix of: income mix & trend, position concentration risk, open options & assignment risk (ITM legs / near expiry), realized winners & losers, and which positions warrant closer attention.
Focus on analysing the user's PAST behaviour and current risk exposure. Do NOT predict future prices, returns, or market moves. Do NOT give buy/sell/hold recommendations or price targets. Help the user understand what they've done and where their biggest risks are so they can decide for themselves.
Be honest about risk but not alarmist. If live prices are missing for some holdings, note that values may be understated. Never invent data not in the snapshot. Analysis of the user's own data, not financial advice.
Respond ONLY with valid JSON:
{"headline":"one punchy sentence on overall portfolio pulse","insights":[{"category":"Income|Concentration|Options|Realized|Action|Risk","title":"short title","detail":"1-3 sentences, specific","severity":"good|watch|risk|info"}]}`;

const QA_SYSTEM = `You are a portfolio analyst answering a user's question about THEIR portfolio.
Use ONLY the provided snapshot. Reference specific tickers/amounts. If the snapshot lacks the info, say so briefly. Be concise (under 150 words), concrete, and neutral.
Do NOT predict future prices or market moves, and do NOT give buy/sell/hold recommendations or price targets — analyse the user's own data and risks so they can decide for themselves. Not financial advice.`;

function getSessionCache(userId: string): TradesInsightsResult | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const c: TradesInsightsResult & { _userId?: string; _date?: string } = JSON.parse(raw);
    if (c._userId === userId && c._date === getTodayString()) return c;
    sessionStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
  return null;
}

function setSessionCache(r: TradesInsightsResult, userId: string) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...r, _userId: userId, _date: getTodayString() })); } catch { /* quota */ }
}

async function loadDbCache(userId: string, date: string): Promise<TradesInsightsResult | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client
    .from('myday_ai_digests')
    .select('response_text, created_at')
    .eq('user_id', userId)
    .eq('digest_type', 'trades_insights')
    .eq('response_date', date)
    .maybeSingle();
  if (!data?.response_text) return null;
  try {
    const parsed = JSON.parse(data.response_text) as { headline: string; insights: TradeInsight[]; asOf?: string };
    return {
      headline: parsed.headline,
      insights: parsed.insights || [],
      asOf: parsed.asOf || date,
      generatedAt: data.created_at,
    };
  } catch { return null; }
}

async function saveDbCache(userId: string, r: TradesInsightsResult, date: string) {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from('myday_ai_digests').upsert([{
    user_id: userId,
    digest_type: 'trades_insights',
    response_text: JSON.stringify({ headline: r.headline, insights: r.insights, asOf: r.asOf }),
    response_date: date,
    prompt_tokens: r.usage?.promptTokens,
    completion_tokens: r.usage?.completionTokens,
    model: r.usage?.model,
  }], { onConflict: 'user_id,digest_type,response_date' });
}

/** Return cached insights (session → DB) without ever calling the API. */
export async function getCachedTradesInsights(userId: string): Promise<TradesInsightsResult | null> {
  const sc = getSessionCache(userId);
  if (sc) return sc;
  const dc = await loadDbCache(userId, getTodayString());
  if (dc) { setSessionCache(dc, userId); return dc; }
  return null;
}

function normalizeInsights(data: any): { headline: string; insights: TradeInsight[] } {
  const headline = typeof data?.headline === 'string' ? data.headline : 'Portfolio review';
  const rawList = Array.isArray(data?.insights) ? data.insights : [];
  const insights: TradeInsight[] = rawList
    .map((i: any) => ({
      category: typeof i?.category === 'string' ? i.category : 'Info',
      title: typeof i?.title === 'string' ? i.title : '',
      detail: typeof i?.detail === 'string' ? i.detail : (typeof i === 'string' ? i : ''),
      severity: ['good', 'watch', 'risk', 'info'].includes(i?.severity) ? i.severity : 'info',
    }))
    .filter((i: TradeInsight) => i.title || i.detail);
  return { headline, insights };
}

/** Generate (or return cached) daily portfolio insights. */
export async function getTradesInsights(
  userId: string,
  digest: PortfolioDigest,
  opts?: { refresh?: boolean },
): Promise<TradesInsightsResult> {
  const today = getTodayString();

  if (!opts?.refresh) {
    const cached = await getCachedTradesInsights(userId);
    if (cached) return cached;
  }

  const context = serializePortfolioContext(digest);
  const result = await callAI<any>({
    abilityId: 'trades_insights',
    userId,
    requestPayload: { mode: 'insights', context },
    systemPrompt: INSIGHTS_SYSTEM,
    userMessage: context,
  });

  const { headline, insights } = normalizeInsights(result.data);
  const out: TradesInsightsResult = {
    headline,
    insights,
    asOf: digest.asOf,
    generatedAt: new Date().toISOString(),
    usage: result.usage,
    lastQuery: { systemPrompt: result.systemPrompt, userMessage: result.userMessage },
  };

  setSessionCache(out, userId);
  saveDbCache(userId, out, today).catch(() => {});
  return out;
}

/** Clear caches and regenerate. */
export async function refreshTradesInsights(userId: string, digest: PortfolioDigest): Promise<TradesInsightsResult> {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  const client = getSupabaseClient();
  if (client) {
    await client.from('myday_ai_digests').delete()
      .eq('user_id', userId).eq('digest_type', 'trades_insights').eq('response_date', getTodayString());
  }
  return getTradesInsights(userId, digest, { refresh: true });
}

export interface TradesQAResult {
  answer: string;
  usage?: AIUsage;
}

/** Answer a free-text question about the portfolio (not cached). */
export async function askTradesQuestion(
  userId: string,
  digest: PortfolioDigest,
  question: string,
): Promise<TradesQAResult> {
  const context = serializePortfolioContext(digest);
  const userMessage = `${context}\n\nQUESTION: ${question.trim()}`;
  const result = await callAI<any>({
    abilityId: 'trades_qa',
    userId,
    requestPayload: { mode: 'qa', context, question: question.trim() },
    systemPrompt: QA_SYSTEM,
    userMessage,
  });
  const answer = typeof result.data?.answer === 'string'
    ? result.data.answer
    : (typeof result.data === 'string' ? result.data : JSON.stringify(result.data));
  return { answer, usage: result.usage };
}
