/**
 * Journal Reflection Card
 *
 * Shown in JournalView after saving an entry. Uses the AI framework
 * (abilities/journalReflection → aiClient → audit) for tracking.
 *
 * Gated on: canUseAI (tier) + aiOptIn (user preference).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { JournalEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useUserLevel } from '../hooks/useUserLevel';
import { getUserSettings } from '../storage';
import { getJournalReflection, getCachedReflection, previewReflectionQuery, JournalReflectionResult } from '../services/ai/abilities/journalReflection';
import AIQueryViewerModal from './ai/AIQueryViewerModal';

interface Props {
  entry: JournalEntry | null;
  justSaved: boolean;
}

const OBSERVATION_STYLES: Record<string, { color: string; icon: string; label: string }> = {
  improving: { color: '#10B981', icon: '📈', label: 'Mood trending up' },
  declining: { color: '#F59E0B', icon: '📉', label: 'Mood dipping lately' },
  stable:    { color: '#6B7280', icon: '➡️', label: 'Mood steady' },
  mixed:     { color: '#8B5CF6', icon: '🔀', label: 'Mood mixed' },
};

const JournalReflectionCard: React.FC<Props> = ({ entry, justSaved }) => {
  const { user } = useAuth();
  const { username: displayName } = useUser();
  const { features, loading: levelLoading } = useUserLevel();
  const [aiOptIn, setAiOptIn] = useState<boolean | null>(null);
  const [reflection, setReflection] = useState<JournalReflectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showQuery, setShowQuery] = useState(false);
  const [previewQuery, setPreviewQuery] = useState<{ systemPrompt: string; userMessage: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    getUserSettings().then(s => setAiOptIn(s.aiOptIn ?? false)).catch(() => setAiOptIn(false));
  }, []);

  const userName = displayName || user?.email?.split('@')[0] || 'there';

  // Load cached reflection for today on mount
  useEffect(() => {
    if (!user?.id || !entry?.date || aiOptIn !== true || levelLoading || !features.canUseAI) return;
    getCachedReflection(user.id, entry.date).then(cached => {
      if (cached) setReflection(cached);
    }).catch(() => {});
  }, [user?.id, entry?.date, aiOptIn, levelLoading, features.canUseAI]);

  const fetchReflection = useCallback(async () => {
    if (!user?.id || !entry?.content) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getJournalReflection(
        userName, user.id,
        { date: entry.date, content: entry.content, mood: entry.mood },
      );
      setReflection(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load reflection');
    } finally {
      setLoading(false);
    }
  }, [user?.id, entry?.date, entry?.content, entry?.mood, userName]);

  const handlePreviewQuery = useCallback(async () => {
    if (!user?.id || !entry?.content) return;
    if (reflection?.lastQuery) {
      setPreviewQuery(reflection.lastQuery);
      setShowQuery(true);
      return;
    }
    setPreviewLoading(true);
    try {
      const q = await previewReflectionQuery(userName, user.id, { date: entry.date, content: entry.content, mood: entry.mood });
      setPreviewQuery(q);
      setShowQuery(true);
    } catch { /* no-op */ }
    finally { setPreviewLoading(false); }
  }, [user?.id, entry, userName, reflection?.lastQuery]);

  // Reflection is on-demand — user clicks Generate or 🔍 to preview.
  // No auto-call to avoid unwanted API charges.

  if (levelLoading || !features.canUseAI || aiOptIn === null || !aiOptIn) return null;
  if (!entry?.content && !reflection) return null;

  const obs = OBSERVATION_STYLES[reflection?.moodObservation || 'stable'] || OBSERVATION_STYLES.stable;
  const queryData = reflection?.lastQuery || previewQuery;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
      border: '1px solid #4338CA40', borderRadius: 14, marginTop: 16,
    }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>✨</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#E0E7FF' }}>Leo's Reflection</span>
          {reflection && (
            <span style={{
              fontSize: 10, color: obs.color, background: `${obs.color}20`,
              padding: '2px 8px', borderRadius: 8, fontWeight: 600,
            }}>{obs.icon} {obs.label}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!loading && entry?.content && (
            <span
              onClick={(e) => { e.stopPropagation(); handlePreviewQuery(); }}
              style={{ fontSize: 12, cursor: 'pointer', opacity: previewLoading ? 0.3 : 0.6 }}
              title="View AI query — copy to ChatGPT"
            >{previewLoading ? '⏳' : '🔍'}</span>
          )}
          {reflection?.usage && !loading && (
            <span style={{ fontSize: 9, color: '#6B7280', fontFamily: 'monospace' }}>
              {reflection.usage.totalTokens}tok · ${reflection.usage.costUsd.toFixed(4)}
            </span>
          )}
          <span style={{
            fontSize: 10, color: '#818CF8', transition: 'transform 0.2s',
            transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
          }}>▶</span>
        </div>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #4338CA30', maxHeight: 320, overflowY: 'auto' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', color: '#A5B4FC', fontSize: 12 }}>
              <span style={{
                display: 'inline-block', width: 14, height: 14,
                border: '2px solid #6366F140', borderTopColor: '#818CF8',
                borderRadius: '50%', animation: 'reflectSpin 0.8s linear infinite',
              }} />
              Leo is reading your entry...
            </div>
          )}
          {error && !loading && (
            <div style={{ padding: '10px 0', fontSize: 12 }}>
              <div style={{
                color: '#FCA5A5', background: '#7F1D1D30', borderRadius: 8,
                padding: '8px 12px', marginBottom: 8, lineHeight: 1.5,
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Failed to generate reflection</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>{error}</div>
                {error.includes('500') && (
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
                    Likely cause: OPENAI_API_KEY not set in Vercel environment variables.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={fetchReflection} style={{
                  background: 'transparent', border: '1px solid #FCA5A540',
                  color: '#FCA5A5', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer',
                }}>Retry</button>
                <button onClick={handlePreviewQuery} style={{
                  background: 'transparent', border: '1px solid #4338CA40',
                  color: '#818CF8', borderRadius: 6, padding: '4px 12px', fontSize: 11, cursor: 'pointer',
                }}>{previewLoading ? '⏳' : '🔍'} View Prompt (free)</button>
              </div>
            </div>
          )}
          {reflection && !loading && (
            <>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: '#C7D2FE', paddingTop: 12, whiteSpace: 'pre-line' }}>
                {reflection.reflection}
              </div>
              {reflection.promptForTomorrow && (
                <div style={{
                  marginTop: 14, padding: '10px 14px', background: '#312E8180',
                  borderRadius: 10, borderLeft: '3px solid #818CF8',
                }}>
                  <div style={{ fontSize: 10, color: '#818CF8', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Tomorrow's prompt
                  </div>
                  <div style={{ fontSize: 12, color: '#E0E7FF', lineHeight: 1.5, fontStyle: 'italic' }}>
                    {reflection.promptForTomorrow}
                  </div>
                </div>
              )}
              {reflection.funQuote && (
                <div style={{
                  marginTop: 10, padding: '8px 14px',
                  background: '#4338CA20', borderRadius: 10,
                  borderLeft: '3px solid #A78BFA',
                  fontSize: 11, color: '#A78BFA', fontStyle: 'italic', lineHeight: 1.5,
                }}>
                  "{reflection.funQuote}"
                </div>
              )}
            </>
          )}
          {!reflection && !loading && !error && (
            <div style={{ padding: '10px 0', fontSize: 12 }}>
              <div style={{ color: '#A5B4FC', marginBottom: 8 }}>
                {justSaved ? 'Entry saved! Generate an AI reflection?' : 'Get AI-powered insights on this entry.'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={fetchReflection} style={{
                  background: '#4338CA', border: 'none', color: 'white',
                  borderRadius: 8, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>▶ Generate Reflection</button>
                <button onClick={handlePreviewQuery} style={{
                  background: 'transparent', border: '1px solid #4338CA40', color: '#818CF8',
                  borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
                }}>{previewLoading ? '⏳' : '🔍'} View Prompt</button>
              </div>
            </div>
          )}
        </div>
      )}

      {queryData && (
        <AIQueryViewerModal
          show={showQuery}
          onClose={() => setShowQuery(false)}
          abilityLabel="Journal Reflection"
          abilityIcon="✨"
          systemPrompt={queryData.systemPrompt}
          userMessage={queryData.userMessage}
          usage={reflection?.usage}
        />
      )}

      <style>{`@keyframes reflectSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default JournalReflectionCard;
