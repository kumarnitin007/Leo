/**
 * AI Usage Panel
 *
 * Collapsible panel showing the user their AI token usage, cost breakdown,
 * stored digests, and recent audit trail.  Placed in Settings or a dedicated section.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getUsageSummary, getAuditLog } from '../../services/ai/aiAuditService';
import { loadAllDigestsForUser, deleteDigest } from '../../services/ai/aiDigestService';
import { ABILITY_REGISTRY } from '../../services/ai/abilityRegistry';
import type { AIUsageSummary, AIAuditEntry, StoredDigest, AIAbilityId } from '../../services/ai/types';
import AIQueryViewerModal from './AIQueryViewerModal';
import { providerLabel, providerColor, providerBg } from '../../services/ai/providerDisplay';

const AIUsagePanel: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AIUsageSummary | null>(null);
  const [digests, setDigests] = useState<StoredDigest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDigests, setShowDigests] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [queryViewer, setQueryViewer] = useState<{
    show: boolean; label: string; icon: string;
    systemPrompt: string; userMessage: string; usage?: any;
  }>({ show: false, label: '', icon: '', systemPrompt: '', userMessage: '' });

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      getUsageSummary(user.id),
      loadAllDigestsForUser(user.id),
    ]).then(([s, d]) => {
      setSummary(s);
      setDigests(d);
    }).finally(() => setLoading(false));
  }, [user?.id]);

  if (!user?.id) return null;

  const handleDeleteDigest = async (id: string) => {
    await deleteDigest(id);
    setDigests(prev => prev.filter(d => d.id !== id));
  };

  const handleViewQuery = (entry: AIAuditEntry) => {
    const ability = ABILITY_REGISTRY[entry.abilityId as AIAbilityId];
    setQueryViewer({
      show: true,
      label: ability?.label || entry.abilityId,
      icon: ability?.icon || '🤖',
      systemPrompt: entry.systemPrompt,
      userMessage: entry.userMessage,
      usage: {
        promptTokens: entry.promptTokens,
        completionTokens: entry.completionTokens,
        totalTokens: entry.totalTokens,
        costUsd: entry.costUsd,
        model: entry.model,
      },
    });
  };

  return (
    <div style={{
      background: 'var(--ck-white)', borderRadius: 'var(--ck-radius)', border: '1px solid var(--ck-border2)',
      overflow: 'hidden', boxShadow: 'var(--ck-shadow)',
    }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--ck-border)' }}>
        <span style={{ fontSize: 18 }}>📊</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ck-ink)', fontFamily: 'var(--ck-serif)' }}>AI Usage &amp; Audit</div>
          <div style={{ fontSize: 11, color: 'var(--ck-ink3)', marginTop: 2 }}>
            Last 30 days
            {summary && summary.totalCalls > 0 && (
              <> · {summary.successCount}/{summary.totalCalls} succeeded</>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '12px 18px', color: 'var(--ck-ink3)', fontSize: 12 }}>Loading...</div>
      )}

      {summary && !loading && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--ck-border)' }}>
            {[
              { label: 'Calls', value: summary.totalCalls.toString(), color: 'var(--ck-purple)' },
              { label: 'Input', value: `${(summary.totalPromptTokens / 1000).toFixed(1)}k`, color: 'var(--ck-green)' },
              { label: 'Output', value: `${(summary.totalCompletionTokens / 1000).toFixed(1)}k`, color: 'var(--ck-purple-dark)' },
              { label: 'Cost', value: `$${summary.totalCostUsd.toFixed(4)}`, color: 'var(--ck-gold)' },
            ].map(c => (
              <div key={c.label} style={{ background: 'var(--ck-paper)', padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: c.color, fontFamily: 'monospace' }}>{c.value}</div>
                <div style={{ fontSize: 9, color: 'var(--ck-ink3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* By ability */}
          <div style={{ padding: '12px 18px' }}>
            <div style={{ fontSize: 10, color: 'var(--ck-ink3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>By ability</div>
            {Object.entries(summary.byAbility).map(([id, data]) => {
              const ability = ABILITY_REGISTRY[id as AIAbilityId];
              return (
                <div key={id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0', borderBottom: '1px solid var(--ck-border)',
                }}>
                  <span style={{ fontSize: 14 }}>{ability?.icon || '🤖'}</span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--ck-ink)' }}>{ability?.label || id}</span>
                  <span style={{ fontSize: 11, color: 'var(--ck-purple)', fontFamily: 'monospace' }}>{data.calls}×</span>
                  <span style={{ fontSize: 11, color: 'var(--ck-ink3)', fontFamily: 'monospace' }}>{data.tokens} tok</span>
                  <span style={{ fontSize: 11, color: 'var(--ck-gold)', fontFamily: 'monospace' }}>${data.costUsd.toFixed(4)}</span>
                </div>
              );
            })}
          </div>

          {/* By engine / model */}
          {Object.keys(summary.byModel).length > 0 && (
            <div style={{ padding: '0 18px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--ck-ink3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>By engine</div>
              {Object.entries(summary.byModel)
                .sort((a, b) => b[1].calls - a[1].calls)
                .map(([model, data]) => (
                  <div key={model} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 0', borderBottom: '1px solid var(--ck-border)',
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: providerColor(model),
                      background: providerBg(model), border: `1px solid ${providerColor(model)}33`,
                      borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap',
                    }}>{providerLabel(model)}</span>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--ck-ink2)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model}</span>
                    <span style={{ fontSize: 11, color: 'var(--ck-purple)', fontFamily: 'monospace' }}>{data.calls}×</span>
                    <span style={{ fontSize: 11, color: 'var(--ck-ink3)', fontFamily: 'monospace' }}>{data.tokens} tok</span>
                    <span style={{ fontSize: 11, color: 'var(--ck-gold)', fontFamily: 'monospace' }}>${data.costUsd.toFixed(4)}</span>
                  </div>
                ))}
            </div>
          )}

          {/* Stored Digests */}
          <div style={{ padding: '0 18px 12px' }}>
            <button
              onClick={() => setShowDigests(s => !s)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-ink2)' }}>🗂 Stored Digests ({digests.length})</span>
              <span style={{ fontSize: 10, color: 'var(--ck-ink3)', transition: 'transform 0.2s', transform: showDigests ? 'rotate(90deg)' : 'none' }}>▶</span>
            </button>
            {showDigests && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {digests.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--ck-ink3)', padding: '8px 0' }}>No digests stored yet. They are generated after your first AI call.</div>
                )}
                {digests.map(d => (
                  <div key={d.id} style={{
                    background: 'var(--ck-paper)', borderRadius: 8, padding: '10px 12px',
                    border: '1px solid var(--ck-border2)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-purple)', textTransform: 'uppercase' }}>{d.source}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--ck-ink3)' }}>covers to {d.coversTo}</span>
                        <button
                          onClick={() => handleDeleteDigest(d.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--ck-red)', fontSize: 11, cursor: 'pointer' }}
                          title="Delete this digest"
                        >✕</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ck-ink2)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                      {d.digest}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--ck-ink3)', marginTop: 6 }}>
                      Created {new Date(d.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit History */}
          <div style={{ padding: '0 18px 14px' }}>
            <button
              onClick={() => setShowHistory(s => !s)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ck-ink2)' }}>📜 Recent Calls ({summary.recentCalls.length})</span>
              <span style={{ fontSize: 10, color: 'var(--ck-ink3)', transition: 'transform 0.2s', transform: showHistory ? 'rotate(90deg)' : 'none' }}>▶</span>
            </button>
            {showHistory && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, maxHeight: 300, overflowY: 'auto' }}>
                {summary.recentCalls.map(entry => {
                  const ability = ABILITY_REGISTRY[entry.abilityId as AIAbilityId];
                  return (
                    <div key={entry.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', background: 'var(--ck-paper)', borderRadius: 8,
                      border: entry.success ? '1px solid var(--ck-border2)' : '1px solid var(--ck-red)',
                    }}>
                      <span style={{ fontSize: 14 }}>{ability?.icon || '🤖'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--ck-ink)', fontWeight: 600 }}>
                          {ability?.label || entry.abilityId}
                          <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: providerColor(entry.model) }}>{providerLabel(entry.model)}</span>
                        </div>
                        <div style={{ fontSize: 9, color: 'var(--ck-ink3)' }}>
                          {new Date(entry.createdAt).toLocaleString()} · {entry.totalTokens} tokens · ${entry.costUsd.toFixed(4)} · {entry.durationMs}ms
                        </div>
                      </div>
                      <button
                        onClick={() => handleViewQuery(entry)}
                        style={{
                          background: 'var(--ck-purple-light)', border: '1px solid var(--ck-border2)', color: 'var(--ck-purple)',
                          borderRadius: 6, padding: '4px 10px', fontSize: 10,
                          fontWeight: 600, cursor: 'pointer',
                        }}
                        title="View full query"
                      >
                        Query
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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

export default AIUsagePanel;
