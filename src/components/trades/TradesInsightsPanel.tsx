/**
 * AI Portfolio Insights panel for the Trades dashboard.
 *
 * - Collapsed/opt-in: no tokens are spent until the user generates insights.
 * - Daily-cached multi-insight review (headline + categorised cards).
 * - Free-text Q&A against the same compact snapshot.
 * All context is built client-side from the digest (never raw trades).
 */

import React, { useEffect, useState } from 'react';
import type { PortfolioDigest } from '../../services/trades/tradesInsightsData';
import {
  getTradesInsights,
  getCachedTradesInsights,
  refreshTradesInsights,
  askTradesQuestion,
  TradesInsightsResult,
  TradeInsight,
  InsightSeverity,
} from '../../services/ai/abilities/tradesInsights';

const SEVERITY_STYLE: Record<InsightSeverity, { bg: string; border: string; color: string; icon: string }> = {
  good:  { bg: '#ecfdf5', border: '#a7f3d0', color: '#047857', icon: '✅' },
  watch: { bg: '#fffbeb', border: '#fde68a', color: '#b45309', icon: '👀' },
  risk:  { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', icon: '⚠️' },
  info:  { bg: '#eef2ff', border: '#c7d2fe', color: '#4338ca', icon: 'ℹ️' },
};

const SUGGESTED = [
  'What is my biggest risk right now?',
  'Which open options are most at risk of assignment?',
  'How is my income trending?',
  'Am I too concentrated in any position?',
];

interface Props {
  userId: string;
  digest: PortfolioDigest;
}

const TradesInsightsPanel: React.FC<Props> = ({ userId, digest }) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TradesInsightsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [qaAnswer, setQaAnswer] = useState<string | null>(null);
  const [qaError, setQaError] = useState<string | null>(null);

  // Paint from cache on mount (no API call). If present, auto-expand.
  useEffect(() => {
    let alive = true;
    getCachedTradesInsights(userId).then(cached => {
      if (alive && cached) { setResult(cached); setExpanded(true); }
    }).catch(() => {});
    return () => { alive = false; };
  }, [userId]);

  const unpriced = digest.totals.unpricedHoldings;

  const generate = async (refresh = false) => {
    setLoading(true);
    setError(null);
    setExpanded(true);
    try {
      const r = refresh ? await refreshTradesInsights(userId, digest) : await getTradesInsights(userId, digest);
      setResult(r);
    } catch (e: any) {
      setError(e?.message || 'Could not generate insights.');
    } finally {
      setLoading(false);
    }
  };

  const ask = async (q: string) => {
    const query = q.trim();
    if (!query) return;
    setQaLoading(true);
    setQaError(null);
    setQaAnswer(null);
    try {
      const r = await askTradesQuestion(userId, digest, query);
      setQaAnswer(r.answer);
    } catch (e: any) {
      setQaError(e?.message || 'Could not answer that.');
    } finally {
      setQaLoading(false);
    }
  };

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: 14,
      background: 'linear-gradient(180deg, #faf5ff 0%, #ffffff 60%)',
      marginBottom: '1.5rem',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '0.75rem', padding: '0.85rem 1rem', cursor: 'pointer', flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
          <span style={{ fontSize: '1.25rem' }}>✨</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>AI Portfolio Insights</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
              {result
                ? `Updated ${new Date(result.generatedAt).toLocaleString()}`
                : 'Get a specific, data-driven read on your holdings, options & income'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
          {!result && !loading && (
            <button className="ck-btn ck-btn-primary" onClick={() => generate(false)}>✨ Generate insights</button>
          )}
          {result && (
            <button className="ck-btn" onClick={() => generate(true)} disabled={loading} title="Regenerate with the latest data (uses tokens)">
              {loading ? '⏳' : '🔄 Refresh'}
            </button>
          )}
          <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 1rem 1rem' }}>
          {unpriced > 0 && (
            <div style={{
              fontSize: '0.8rem', color: '#b45309', background: '#fffbeb',
              border: '1px solid #fde68a', borderRadius: 8, padding: '0.5rem 0.75rem', marginBottom: '0.75rem',
            }}>
              {unpriced} holding{unpriced === 1 ? '' : 's'} have no live price — hit “Refresh prices” for more accurate insights.
            </div>
          )}

          {loading && !result && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#6b7280' }}>⏳ Analysing your portfolio…</div>
          )}

          {error && (
            <div style={{
              padding: '0.75rem', color: '#b91c1c', background: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: 8, fontSize: '0.85rem', marginBottom: '0.75rem',
            }}>
              {error}{' '}
              <button className="ck-btn" style={{ marginLeft: 8 }} onClick={() => generate(false)}>Retry</button>
            </div>
          )}

          {result && (
            <>
              {result.headline && (
                <div style={{ fontSize: '0.98rem', fontWeight: 600, color: '#111827', margin: '0.25rem 0 0.9rem' }}>
                  {result.headline}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.7rem' }}>
                {result.insights.map((ins: TradeInsight, i: number) => {
                  const s = SEVERITY_STYLE[ins.severity] || SEVERITY_STYLE.info;
                  return (
                    <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '0.7rem 0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                        <span>{s.icon}</span>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: s.color }}>{ins.title || ins.category}</span>
                      </div>
                      {ins.category && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: s.color, opacity: 0.8 }}>
                          {ins.category}
                        </span>
                      )}
                      <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.5, marginTop: '0.2rem' }}>{ins.detail}</div>
                    </div>
                  );
                })}
              </div>

              {/* Q&A */}
              <div style={{ marginTop: '1rem', paddingTop: '0.9rem', borderTop: '1px dashed #e5e7eb' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111827', marginBottom: '0.5rem' }}>💬 Ask about your portfolio</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
                  {SUGGESTED.map(q => (
                    <button
                      key={q}
                      onClick={() => { setQuestion(q); ask(q); }}
                      disabled={qaLoading}
                      style={{
                        fontSize: '0.75rem', padding: '0.3rem 0.6rem', borderRadius: 999,
                        border: '1px solid #ddd6fe', background: '#f5f3ff', color: '#5b21b6', cursor: 'pointer',
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') ask(question); }}
                    placeholder="e.g. Which holding is dragging me down?"
                    style={{ flex: 1, minWidth: 200, padding: '0.5rem 0.7rem', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.85rem' }}
                  />
                  <button className="ck-btn ck-btn-primary" onClick={() => ask(question)} disabled={qaLoading || !question.trim()}>
                    {qaLoading ? '⏳' : 'Ask'}
                  </button>
                </div>
                {qaError && <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#b91c1c' }}>{qaError}</div>}
                {qaAnswer && (
                  <div style={{
                    marginTop: '0.6rem', background: '#f9fafb', border: '1px solid #e5e7eb',
                    borderRadius: 10, padding: '0.7rem 0.85rem', fontSize: '0.87rem', color: '#374151', lineHeight: 1.55, whiteSpace: 'pre-wrap',
                  }}>
                    {qaAnswer}
                  </div>
                )}
              </div>

              {/* Meta */}
              <div style={{ marginTop: '0.85rem', fontSize: '0.72rem', color: '#9ca3af', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span>AI analysis of your data — not financial advice.</span>
                {result.usage && (
                  <span title="Tokens & estimated cost for the last generation">
                    {result.usage.model} · {result.usage.totalTokens} tok · ${result.usage.costUsd.toFixed(4)}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TradesInsightsPanel;
