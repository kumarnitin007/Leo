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
      background: '#111827', borderRadius: 14, border: '1px solid #1F2937',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>📊</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB' }}>AI Usage & Audit</div>
          <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>Last 30 days</div>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '12px 18px', color: '#6B7280', fontSize: 12 }}>Loading...</div>
      )}

      {summary && !loading && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#1F2937' }}>
            {[
              { label: 'Calls', value: summary.totalCalls.toString(), color: '#818CF8' },
              { label: 'Input', value: `${(summary.totalPromptTokens / 1000).toFixed(1)}k`, color: '#34D399' },
              { label: 'Output', value: `${(summary.totalCompletionTokens / 1000).toFixed(1)}k`, color: '#60A5FA' },
              { label: 'Cost', value: `$${summary.totalCostUsd.toFixed(4)}`, color: '#F59E0B' },
            ].map(c => (
              <div key={c.label} style={{ background: '#111827', padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: c.color, fontFamily: 'monospace' }}>{c.value}</div>
                <div style={{ fontSize: 9, color: '#6B7280', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* By ability */}
          <div style={{ padding: '12px 18px' }}>
            <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>By ability</div>
            {Object.entries(summary.byAbility).map(([id, data]) => {
              const ability = ABILITY_REGISTRY[id as AIAbilityId];
              return (
                <div key={id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0', borderBottom: '1px solid #1F2937',
                }}>
                  <span style={{ fontSize: 14 }}>{ability?.icon || '🤖'}</span>
                  <span style={{ flex: 1, fontSize: 12, color: '#D1D5DB' }}>{ability?.label || id}</span>
                  <span style={{ fontSize: 11, color: '#818CF8', fontFamily: 'monospace' }}>{data.calls}×</span>
                  <span style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace' }}>{data.tokens} tok</span>
                  <span style={{ fontSize: 11, color: '#F59E0B', fontFamily: 'monospace' }}>${data.costUsd.toFixed(4)}</span>
                </div>
              );
            })}
          </div>

          {/* Stored Digests */}
          <div style={{ padding: '0 18px 12px' }}>
            <button
              onClick={() => setShowDigests(s => !s)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF' }}>🗂 Stored Digests ({digests.length})</span>
              <span style={{ fontSize: 10, color: '#6B7280', transition: 'transform 0.2s', transform: showDigests ? 'rotate(90deg)' : 'none' }}>▶</span>
            </button>
            {showDigests && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {digests.length === 0 && (
                  <div style={{ fontSize: 11, color: '#4B5563', padding: '8px 0' }}>No digests stored yet. They are generated after your first AI call.</div>
                )}
                {digests.map(d => (
                  <div key={d.id} style={{
                    background: '#1F2937', borderRadius: 8, padding: '10px 12px',
                    border: '1px solid #374151',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#818CF8', textTransform: 'uppercase' }}>{d.source}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: '#6B7280' }}>covers to {d.coversTo}</span>
                        <button
                          onClick={() => handleDeleteDigest(d.id)}
                          style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 11, cursor: 'pointer' }}
                          title="Delete this digest"
                        >✕</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                      {d.digest}
                    </div>
                    <div style={{ fontSize: 9, color: '#4B5563', marginTop: 6 }}>
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
              <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF' }}>📜 Recent Calls ({summary.recentCalls.length})</span>
              <span style={{ fontSize: 10, color: '#6B7280', transition: 'transform 0.2s', transform: showHistory ? 'rotate(90deg)' : 'none' }}>▶</span>
            </button>
            {showHistory && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, maxHeight: 300, overflowY: 'auto' }}>
                {summary.recentCalls.map(entry => {
                  const ability = ABILITY_REGISTRY[entry.abilityId as AIAbilityId];
                  return (
                    <div key={entry.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', background: '#1F2937', borderRadius: 8,
                      border: entry.success ? '1px solid #374151' : '1px solid #EF444440',
                    }}>
                      <span style={{ fontSize: 14 }}>{ability?.icon || '🤖'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: '#D1D5DB', fontWeight: 600 }}>{ability?.label || entry.abilityId}</div>
                        <div style={{ fontSize: 9, color: '#6B7280' }}>
                          {new Date(entry.createdAt).toLocaleString()} · {entry.totalTokens} tokens · ${entry.costUsd.toFixed(4)} · {entry.durationMs}ms
                        </div>
                      </div>
                      <button
                        onClick={() => handleViewQuery(entry)}
                        style={{
                          background: '#374151', border: 'none', color: '#818CF8',
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
