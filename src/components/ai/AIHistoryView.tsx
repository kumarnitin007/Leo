/**
 * AI History View
 *
 * Full-screen view for AI transaction history — shows every AI call with
 * spending breakdown, projected spend, cost timeline, and query viewer.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAuditLog, getUsageSummary } from '../../services/ai/aiAuditService';
import { loadAllDigestsForUser } from '../../services/ai/aiDigestService';
import { ABILITY_REGISTRY } from '../../services/ai/abilityRegistry';
import type { AIAuditEntry, AIUsageSummary, StoredDigest, AIAbilityId } from '../../services/ai/types';
import AIQueryViewerModal from './AIQueryViewerModal';
import { providerOf, providerLabel, providerColor, providerBg } from '../../services/ai/providerDisplay';
import type { ProviderId } from '../../services/ai/providerDisplay';

interface DailySpend { date: string; cost: number; tokens: number; calls: number; }

function groupByDay(entries: AIAuditEntry[]): DailySpend[] {
  const map = new Map<string, DailySpend>();
  for (const e of entries) {
    const d = e.createdAt.slice(0, 10);
    const existing = map.get(d) || { date: d, cost: 0, tokens: 0, calls: 0 };
    existing.cost += e.costUsd;
    existing.tokens += e.totalTokens;
    existing.calls += 1;
    map.set(d, existing);
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function projectMonthlySpend(dailySpends: DailySpend[]): number {
  if (dailySpends.length === 0) return 0;
  const totalCost = dailySpends.reduce((s, d) => s + d.cost, 0);
  const avgDaily = totalCost / dailySpends.length;
  return avgDaily * 30;
}

const AIHistoryView: React.FC<{ onBack?: () => void; hideHeader?: boolean }> = ({ onBack, hideHeader }) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AIAuditEntry[]>([]);
  const [summary, setSummary] = useState<AIUsageSummary | null>(null);
  const [digests, setDigests] = useState<StoredDigest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AIAbilityId | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'passed' | 'failed'>('all');
  const [providerFilter, setProviderFilter] = useState<'all' | ProviderId>('all');
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);
  const [queryViewer, setQueryViewer] = useState<{
    show: boolean; label: string; icon: string;
    systemPrompt: string; userMessage: string; usage?: any;
  }>({ show: false, label: '', icon: '', systemPrompt: '', userMessage: '' });

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const [allEntries, usageSummary, allDigests] = await Promise.all([
      getAuditLog(user.id, 200),
      getUsageSummary(user.id, timeRange),
      loadAllDigestsForUser(user.id),
    ]);
    setEntries(allEntries);
    setSummary(usageSummary);
    setDigests(allDigests);
    setLoading(false);
  }, [user?.id, timeRange]);

  useEffect(() => { loadData(); }, [loadData]);

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - timeRange);

  // Base scope = ability + status + time range (NOT engine). Used to count how
  // many calls each engine has, so the engine pills can show live counts.
  const baseInRange = entries
    .filter(e => filter === 'all' || e.abilityId === filter)
    .filter(e => statusFilter === 'all' || (statusFilter === 'passed' ? e.success : !e.success))
    .filter(e => new Date(e.createdAt) >= sinceDate);
  const providerCounts = {
    all: baseInRange.length,
    openai: baseInRange.filter(e => providerOf(e.model) === 'openai').length,
    gemini: baseInRange.filter(e => providerOf(e.model) === 'gemini').length,
    other: baseInRange.filter(e => providerOf(e.model) === 'other').length,
  };

  const inRange = baseInRange.filter(e => providerFilter === 'all' || providerOf(e.model) === providerFilter);
  const dailySpends = groupByDay(inRange);
  const projected = projectMonthlySpend(dailySpends);
  const maxDailyCost = Math.max(...dailySpends.map(d => d.cost), 0.0001);

  // Per-engine breakdown for the visible range (respects all active filters)
  const byEngine = inRange.reduce((acc, e) => {
    const key = providerLabel(e.model);
    if (!acc[key]) acc[key] = { model: e.model, calls: 0, tokens: 0, costUsd: 0 };
    acc[key].calls += 1;
    acc[key].tokens += e.totalTokens;
    acc[key].costUsd += e.costUsd;
    return acc;
  }, {} as Record<string, { model: string; calls: number; tokens: number; costUsd: number }>);
  const engineRows = Object.entries(byEngine).sort((a, b) => b[1].calls - a[1].calls);

  const handleViewQuery = (entry: AIAuditEntry) => {
    const ability = ABILITY_REGISTRY[entry.abilityId as AIAbilityId];
    setQueryViewer({
      show: true,
      label: ability?.label || entry.abilityId,
      icon: ability?.icon || '🤖',
      systemPrompt: entry.systemPrompt,
      userMessage: entry.userMessage,
      usage: { promptTokens: entry.promptTokens, completionTokens: entry.completionTokens, totalTokens: entry.totalTokens, costUsd: entry.costUsd, model: entry.model },
    });
  };

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', fontSize: 11, fontWeight: active ? 700 : 500,
    fontFamily: 'var(--ck-font)',
    color: active ? '#fff' : 'var(--ck-ink2)',
    background: active ? 'var(--ck-purple)' : 'var(--ck-white)',
    border: active ? '0.5px solid transparent' : '0.5px solid var(--ck-border2)',
    borderRadius: 20, cursor: 'pointer',
  });

  const cardStyle: React.CSSProperties = {
    background: 'var(--ck-white)', borderRadius: 12, padding: 18,
    border: '0.5px solid var(--ck-border2)', boxShadow: 'var(--ck-shadow)',
  };

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: hideHeader ? 0 : '0 16px 32px', fontFamily: 'var(--ck-font)', color: 'var(--ck-ink)' }}>
      {/* Header (hidden when a parent pane already supplies the title) */}
      {!hideHeader && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ck-ink2)' }}>←</button>
        )}
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, fontFamily: 'var(--ck-serif)', color: 'var(--ck-ink)' }}>AI History &amp; Spending</h2>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--ck-ink3)' }}>Track every AI call, token usage, and projected costs</p>
        </div>
      </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--ck-ink3)' }}>Loading AI history…</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total Calls', value: summary?.totalCalls ?? 0, fmt: (v: number) => v.toString(), color: 'var(--ck-purple)' },
              { label: 'Total Tokens', value: summary?.totalTokens ?? 0, fmt: (v: number) => v > 1000 ? `${(v / 1000).toFixed(1)}k` : v.toString(), color: 'var(--ck-green)' },
              { label: `Spent (${timeRange}d)`, value: summary?.totalCostUsd ?? 0, fmt: (v: number) => `$${v.toFixed(4)}`, color: 'var(--ck-gold)' },
              { label: 'Projected /mo', value: projected, fmt: (v: number) => `$${v.toFixed(4)}`, color: 'var(--ck-red)' },
              { label: 'Avg per Call', value: (summary?.totalCalls ?? 0) > 0 ? (summary!.totalCostUsd / summary!.totalCalls) : 0, fmt: (v: number) => `$${v.toFixed(5)}`, color: 'var(--ck-purple)' },
              { label: 'Stored Digests', value: digests.length, fmt: (v: number) => v.toString(), color: 'var(--ck-ink2)' },
            ].map(c => (
              <div key={c.label} style={{ ...cardStyle, padding: '14px 16px' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: c.color, fontFamily: 'ui-monospace, monospace' }}>{c.fmt(c.value)}</div>
                <div style={{ fontSize: 10, color: 'var(--ck-ink3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <button style={pill(filter === 'all')} onClick={() => setFilter('all')}>All</button>
            {Object.values(ABILITY_REGISTRY).map(a => (
              <button key={a.id} style={pill(filter === a.id)} onClick={() => setFilter(a.id)}>
                {a.icon} {a.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {([7, 30, 90] as const).map(d => (
              <button key={d} style={pill(timeRange === d)} onClick={() => setTimeRange(d)}>{d}d</button>
            ))}
          </div>

          {/* Engine (provider) filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--ck-ink3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: 2 }}>Engine</span>
            {([
              { key: 'all' as const, label: 'All engines', count: providerCounts.all },
              { key: 'openai' as const, label: 'OpenAI', count: providerCounts.openai },
              { key: 'gemini' as const, label: 'Gemini', count: providerCounts.gemini },
              ...(providerCounts.other > 0 ? [{ key: 'other' as const, label: 'Other', count: providerCounts.other }] : []),
            ]).map(p => {
              const active = providerFilter === p.key;
              const accent = p.key === 'gemini' ? 'var(--ck-green)' : p.key === 'openai' ? 'var(--ck-purple)' : 'var(--ck-ink2)';
              return (
                <button
                  key={p.key}
                  onClick={() => setProviderFilter(p.key)}
                  style={{
                    padding: '5px 12px', fontSize: 11, fontWeight: active ? 700 : 500,
                    fontFamily: 'var(--ck-font)',
                    color: active ? '#fff' : 'var(--ck-ink2)',
                    background: active ? accent : 'var(--ck-white)',
                    border: active ? '0.5px solid transparent' : '0.5px solid var(--ck-border2)',
                    borderRadius: 20, cursor: 'pointer',
                  }}
                >{p.label} ({p.count})</button>
              );
            })}
          </div>

          {/* Daily Cost Bar Chart */}
          {dailySpends.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ck-ink2)', marginBottom: 12 }}>Daily Spending</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
                {dailySpends.slice(-30).map((d, i) => {
                  const h = Math.max(4, (d.cost / maxDailyCost) * 70);
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div
                        title={`${d.date}: $${d.cost.toFixed(5)} (${d.calls} calls, ${d.tokens} tokens)`}
                        style={{
                          width: '100%', maxWidth: 16, height: h, borderRadius: '3px 3px 0 0',
                          background: 'var(--ck-purple)',
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 9, color: 'var(--ck-ink3)' }}>{dailySpends.slice(-30)[0]?.date}</span>
                <span style={{ fontSize: 9, color: 'var(--ck-ink3)' }}>{dailySpends[dailySpends.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* By Ability Breakdown */}
          {summary && Object.keys(summary.byAbility).length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ck-ink2)', marginBottom: 12 }}>By Ability</div>
              {Object.entries(summary.byAbility).map(([id, data]) => {
                const ability = ABILITY_REGISTRY[id as AIAbilityId];
                const pct = summary.totalCostUsd > 0 ? (data.costUsd / summary.totalCostUsd * 100) : 0;
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid var(--ck-border)' }}>
                    <span style={{ fontSize: 18, width: 28 }}>{ability?.icon || '🤖'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ck-ink)' }}>{ability?.label || id}</div>
                      <div style={{ height: 4, background: 'var(--ck-cream)', borderRadius: 2, marginTop: 4 }}>
                        <div style={{ height: 4, borderRadius: 2, width: `${pct}%`, background: 'var(--ck-purple)' }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--ck-gold)', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>${data.costUsd.toFixed(4)}</div>
                      <div style={{ fontSize: 9, color: 'var(--ck-ink3)' }}>{data.calls}× · {data.tokens} tok</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* By Engine Breakdown */}
          {engineRows.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ck-ink2)', marginBottom: 12 }}>By Engine</div>
              {engineRows.map(([label, data]) => {
                const totalCalls = inRange.length || 1;
                const pct = (data.calls / totalCalls) * 100;
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid var(--ck-border)' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: providerColor(data.model),
                      background: providerBg(data.model), border: `1px solid ${providerColor(data.model)}33`,
                      borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', minWidth: 64, textAlign: 'center',
                    }}>{label}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--ck-ink3)', fontFamily: 'ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.model || 'unknown'}</div>
                      <div style={{ height: 4, background: 'var(--ck-cream)', borderRadius: 2, marginTop: 4 }}>
                        <div style={{ height: 4, borderRadius: 2, width: `${pct}%`, background: providerColor(data.model) }} />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--ck-gold)', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>${data.costUsd.toFixed(4)}</div>
                      <div style={{ fontSize: 9, color: 'var(--ck-ink3)' }}>{data.calls}× · {data.tokens} tok</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Transaction Log */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ck-ink2)' }}>
                Transaction Log ({inRange.length} calls)
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {([
                  { key: 'all' as const, label: 'All' },
                  { key: 'passed' as const, label: '✓ Passed' },
                  { key: 'failed' as const, label: '✗ Failed' },
                ]).map(s => (
                  <button
                    key={s.key}
                    onClick={() => setStatusFilter(s.key)}
                    style={{
                      padding: '3px 10px', fontSize: 10, fontWeight: statusFilter === s.key ? 700 : 500,
                      fontFamily: 'var(--ck-font)',
                      color: statusFilter === s.key ? '#fff' : 'var(--ck-ink2)',
                      background: statusFilter === s.key
                        ? (s.key === 'failed' ? 'var(--ck-red)' : s.key === 'passed' ? 'var(--ck-green)' : 'var(--ck-purple)')
                        : 'var(--ck-white)',
                      border: statusFilter === s.key ? '0.5px solid transparent' : '0.5px solid var(--ck-border2)',
                      borderRadius: 12, cursor: 'pointer',
                    }}
                  >{s.label}</button>
                ))}
              </div>
            </div>
            {inRange.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ck-ink3)', fontSize: 12 }}>
                {providerFilter !== 'all' ? `No ${providerFilter === 'gemini' ? 'Gemini' : providerFilter === 'openai' ? 'OpenAI' : 'matching'} calls in this period — try "All engines" or a wider time range.` :
                 statusFilter === 'failed' ? 'No failed AI calls in this period.' :
                 statusFilter === 'passed' ? 'No successful AI calls in this period.' :
                 'No AI calls in this period. Use the Morning Briefing or Journal Reflection to get started.'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
              {inRange.map(entry => {
                const ability = ABILITY_REGISTRY[entry.abilityId as AIAbilityId];
                const funQuote = (() => {
                  try {
                    const p = typeof entry.responsePayload === 'string' ? JSON.parse(entry.responsePayload) : entry.responsePayload;
                    return p?.funQuote || p?.fun_quote;
                  } catch { return undefined; }
                })();
                return (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', background: 'var(--ck-paper)', borderRadius: 10,
                    border: entry.success ? '0.5px solid var(--ck-border2)' : '1px solid rgba(201,74,46,0.4)',
                  }}>
                    <span style={{ fontSize: 16 }}>{ability?.icon || '🤖'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ck-ink)' }}>{ability?.label || entry.abilityId}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: providerColor(entry.model),
                          background: providerBg(entry.model), border: `1px solid ${providerColor(entry.model)}33`,
                          padding: '1px 7px', borderRadius: 999, whiteSpace: 'nowrap',
                        }}>{providerLabel(entry.model)}</span>
                        {!entry.success && <span style={{ fontSize: 9, color: 'var(--ck-red)', background: 'var(--ck-red-light)', padding: '1px 6px', borderRadius: 4 }}>FAILED</span>}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--ck-ink3)', marginTop: 2 }}>
                        {new Date(entry.createdAt).toLocaleString()} · {entry.durationMs}ms · {entry.model}
                      </div>
                      {funQuote && (
                        <div style={{ fontSize: 10, color: 'var(--ck-purple)', fontStyle: 'italic', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          "{funQuote}"
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: 'var(--ck-gold)', fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>${entry.costUsd.toFixed(5)}</div>
                      <div style={{ fontSize: 9, color: 'var(--ck-ink3)' }}>{entry.totalTokens} tok</div>
                    </div>
                    <button
                      onClick={() => handleViewQuery(entry)}
                      style={{
                        background: 'var(--ck-white)', border: '0.5px solid var(--ck-border2)', color: 'var(--ck-purple)',
                        borderRadius: 6, padding: '5px 10px', fontSize: 10,
                        fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                      }}
                      title="View full query"
                    >Query</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stored Digests */}
          {digests.length > 0 && (
            <div style={{ ...cardStyle, marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ck-ink2)', marginBottom: 12 }}>
                🗂 Content Digests ({digests.length})
              </div>
              <p style={{ fontSize: 11, color: 'var(--ck-ink3)', marginBottom: 10 }}>
                AI-generated summaries that replace raw data in future calls to save tokens.
              </p>
              {digests.map(d => (
                <div key={d.id} style={{ background: 'var(--ck-paper)', borderRadius: 8, padding: '10px 12px', marginBottom: 6, border: '0.5px solid var(--ck-border2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ck-purple)', textTransform: 'uppercase' }}>{d.source}</span>
                    <span style={{ fontSize: 9, color: 'var(--ck-ink3)' }}>covers to {d.coversTo} · {new Date(d.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ck-ink2)', lineHeight: 1.5 }}>{d.digest}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <AIQueryViewerModal
        show={queryViewer.show}
        onClose={() => setQueryViewer(prev => ({ ...prev, show: false }))}
        abilityLabel={queryViewer.label}
        abilityIcon={queryViewer.icon}
        systemPrompt={queryViewer.systemPrompt}
        userMessage={queryViewer.userMessage}
        usage={queryViewer.usage}
      />
    </div>
  );
};

export default AIHistoryView;
