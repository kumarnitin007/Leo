/**
 * Daily Briefing Card
 *
 * AI-powered morning briefing on the TodayView dashboard.
 * Gated: canUseAI (tier) + aiOptIn (user setting).
 * Uses the new AI framework: abilities/dailyBriefing → aiClient → audit.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserLevel } from '../hooks/useUserLevel';
import { getUserSettings } from '../storage';
import { getDailyBriefing, refreshDailyBriefing, DailyBriefingResult } from '../services/ai/abilities/dailyBriefing';
import AIQueryViewerModal from './ai/AIQueryViewerModal';

const TONE_STYLES: Record<string, { bg: string; border: string; accent: string; icon: string }> = {
  upbeat:      { bg: 'linear-gradient(135deg, #065F46 0%, #064E3B 100%)', border: '#10B981', accent: '#34D399', icon: '☀️' },
  encouraging: { bg: 'linear-gradient(135deg, #1E3A5F 0%, #1E293B 100%)', border: '#3B82F6', accent: '#60A5FA', icon: '💪' },
  gentle:      { bg: 'linear-gradient(135deg, #3B1F5B 0%, #1E1B30 100%)', border: '#8B5CF6', accent: '#A78BFA', icon: '🌙' },
  neutral:     { bg: 'linear-gradient(135deg, #1F2937 0%, #111827 100%)', border: '#6B7280', accent: '#9CA3AF', icon: '🤖' },
};

const DailyBriefingCard: React.FC = () => {
  const { user } = useAuth();
  const { features, loading: levelLoading } = useUserLevel();
  const [briefing, setBriefing] = useState<DailyBriefingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [aiOptIn, setAiOptIn] = useState<boolean | null>(null);
  const [showQuery, setShowQuery] = useState(false);

  useEffect(() => {
    getUserSettings().then(s => setAiOptIn(s.aiOptIn ?? false)).catch(() => setAiOptIn(false));
  }, []);

  const userName = (user as any)?.user_metadata?.username
    || user?.email?.split('@')[0]
    || 'there';

  const loadBriefing = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getDailyBriefing(userName, user.id);
      setBriefing(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load briefing');
    } finally {
      setLoading(false);
    }
  }, [user?.id, userName]);

  const handleRefresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await refreshDailyBriefing(userName, user.id);
      setBriefing(result);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh briefing');
    } finally {
      setLoading(false);
    }
  }, [user?.id, userName]);

  useEffect(() => {
    if (!levelLoading && features.canUseAI && aiOptIn && user?.id) {
      loadBriefing();
    }
  }, [levelLoading, features.canUseAI, aiOptIn, user?.id, loadBriefing]);

  if (levelLoading || !features.canUseAI || aiOptIn === null || !aiOptIn) return null;

  const tone = TONE_STYLES[briefing?.tone || 'neutral'] || TONE_STYLES.neutral;

  return (
    <div style={{
      background: tone.bg,
      border: `1px solid ${tone.border}40`,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 16,
      transition: 'all 0.3s ease',
    }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{tone.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB', textAlign: 'left' }}>Leo's Daily Briefing</div>
            {briefing && (
              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, textAlign: 'left' }}>
                Generated {new Date(briefing.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                {briefing.usage && <span> · {briefing.usage.totalTokens} tokens · ${briefing.usage.costUsd.toFixed(4)}</span>}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {briefing?.lastQuery && !loading && (
            <span
              onClick={(e) => { e.stopPropagation(); setShowQuery(true); }}
              style={{ fontSize: 13, cursor: 'pointer', opacity: 0.6 }}
              title="View AI query"
            >🔍</span>
          )}
          {briefing && !loading && (
            <span
              onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
              style={{ fontSize: 14, cursor: 'pointer', opacity: 0.6 }}
              title="Refresh briefing"
            >🔄</span>
          )}
          <span style={{
            fontSize: 10, color: '#9CA3AF', transition: 'transform 0.2s',
            transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
          }}>▶</span>
        </div>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${tone.border}20` }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0', color: '#9CA3AF', fontSize: 12 }}>
              <span style={{
                display: 'inline-block', width: 14, height: 14,
                border: `2px solid ${tone.accent}40`, borderTopColor: tone.accent,
                borderRadius: '50%', animation: 'briefingSpin 0.8s linear infinite',
              }} />
              Leo is reviewing your day...
            </div>
          )}
          {error && !loading && (
            <div style={{ padding: '12px 0', color: '#F87171', fontSize: 12 }}>
              {error}
              <button onClick={loadBriefing} style={{
                marginLeft: 8, background: 'transparent', border: '1px solid #F8717140',
                color: '#F87171', borderRadius: 6, padding: '2px 10px', fontSize: 11, cursor: 'pointer',
              }}>Retry</button>
            </div>
          )}
          {briefing && !loading && (
            <>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: '#E5E7EB', paddingTop: 14, whiteSpace: 'pre-line' }}>
                {briefing.briefing}
              </div>
              {briefing.funQuote && (
                <div style={{
                  marginTop: 12, padding: '8px 14px',
                  background: `${tone.accent}15`, borderRadius: 10,
                  borderLeft: `3px solid ${tone.accent}`,
                  fontSize: 12, color: tone.accent, fontStyle: 'italic', lineHeight: 1.5,
                }}>
                  "{briefing.funQuote}"
                </div>
              )}
            </>
          )}
          {!briefing && !loading && !error && (
            <div style={{ padding: '12px 0', color: '#6B7280', fontSize: 12 }}>
              Your morning briefing will appear here. Add tasks and journal entries to get personalised insights.
            </div>
          )}
        </div>
      )}

      {briefing?.lastQuery && (
        <AIQueryViewerModal
          show={showQuery}
          onClose={() => setShowQuery(false)}
          abilityLabel="Morning Briefing"
          abilityIcon="☀️"
          systemPrompt={briefing.lastQuery.systemPrompt}
          userMessage={briefing.lastQuery.userMessage}
          usage={briefing.usage}
        />
      )}

      <style>{`@keyframes briefingSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default DailyBriefingCard;
