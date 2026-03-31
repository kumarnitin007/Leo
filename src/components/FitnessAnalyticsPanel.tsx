/**
 * FitnessAnalyticsPanel
 *
 * Shows cached Google Fit data (last 30 days) in a simple tabular
 * view with daily totals and a lightweight bar chart for steps.
 * Embedded inside the Analytics tab — no new screen or route.
 */

import React, { useEffect, useState } from 'react';
import { useGoogleAuth } from '../integrations/google/hooks/useGoogleAuth';
import { useGoogleFit } from '../integrations/google/hooks/useGoogleFit';
import type { DailyFitnessData } from '../integrations/google/types/fit.types';

const DAYS_TO_SHOW = 30;

const FitnessAnalyticsPanel: React.FC = () => {
  const { isFitConnected, loading: authLoading, connectService } = useGoogleAuth();
  const { data, loading, error, fetchRecent, loadCached } = useGoogleFit();
  const [selectedMetric, setSelectedMetric] = useState<'steps' | 'calories' | 'active'>('steps');

  useEffect(() => {
    if (isFitConnected) loadCached(DAYS_TO_SHOW);
  }, [isFitConnected, loadCached]);

  if (authLoading) return <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>Loading...</div>;

  if (!isFitConnected) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p style={{ fontSize: 48, margin: 0 }}>🏃</p>
        <h3 style={{ margin: '12px 0 8px', color: '#374151' }}>Google Fit Not Connected</h3>
        <p style={{ color: '#6B7280', fontSize: 14, maxWidth: 360, margin: '0 auto 16px' }}>
          Connect Google Fit to see your step counts, calories, active minutes and more here.
        </p>
        <button
          onClick={() => connectService('fit')}
          style={{
            background: '#059669', color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 24px', fontWeight: 600, cursor: 'pointer', fontSize: 14,
          }}
        >
          Connect Google Fit
        </button>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
  const maxSteps = Math.max(...sorted.map(d => d.steps ?? 0), 1);
  const maxCals = Math.max(...sorted.map(d => d.caloriesBurned ?? 0), 1);
  const maxActive = Math.max(...sorted.map(d => d.activeMinutes ?? 0), 1);

  const metricValue = (d: DailyFitnessData) =>
    selectedMetric === 'steps' ? (d.steps ?? 0)
      : selectedMetric === 'calories' ? (d.caloriesBurned ?? 0)
        : (d.activeMinutes ?? 0);

  const metricMax = selectedMetric === 'steps' ? maxSteps : selectedMetric === 'calories' ? maxCals : maxActive;
  const metricLabel = selectedMetric === 'steps' ? 'steps' : selectedMetric === 'calories' ? 'cal' : 'min';
  const barColor = selectedMetric === 'steps' ? '#059669' : selectedMetric === 'calories' ? '#F59E0B' : '#3B82F6';

  const totalSteps = sorted.reduce((s, d) => s + (d.steps ?? 0), 0);
  const totalCals = sorted.reduce((s, d) => s + (d.caloriesBurned ?? 0), 0);
  const totalActive = sorted.reduce((s, d) => s + (d.activeMinutes ?? 0), 0);
  const daysWithData = sorted.filter(d => (d.steps ?? 0) > 0).length;
  const avgSteps = daysWithData ? Math.round(totalSteps / daysWithData) : 0;

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        <SummaryCard emoji="👣" label="Total Steps" value={fmt(totalSteps)} />
        <SummaryCard emoji="📊" label="Daily Avg" value={`${fmt(avgSteps)} steps`} />
        <SummaryCard emoji="🔥" label="Total Calories" value={fmt(Math.round(totalCals))} />
        <SummaryCard emoji="⏱" label="Active Minutes" value={fmt(totalActive)} />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['steps', 'calories', 'active'] as const).map(m => (
            <button
              key={m}
              onClick={() => setSelectedMetric(m)}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                cursor: 'pointer',
                background: selectedMetric === m ? barColor : '#F3F4F6',
                color: selectedMetric === m ? '#fff' : '#6B7280',
              }}
            >
              {m === 'steps' ? '👣 Steps' : m === 'calories' ? '🔥 Calories' : '⏱ Active'}
            </button>
          ))}
        </div>
        <button
          onClick={() => fetchRecent(DAYS_TO_SHOW)}
          disabled={loading}
          style={{
            padding: '4px 14px', borderRadius: 6, border: '1px solid #D1D5DB',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#374151',
          }}
        >
          {loading ? '⏳ Syncing...' : '🔄 Sync from Google'}
        </button>
      </div>

      {error && <p style={{ color: '#EF4444', fontSize: 12, marginBottom: 8 }}>{error}</p>}

      {/* Bar Chart */}
      {sorted.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {sorted.map(d => {
            const val = metricValue(d);
            const pct = metricMax ? (val / metricMax) * 100 : 0;
            return (
              <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 75, color: '#6B7280', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {formatDateLabel(d.date)}
                </span>
                <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 4, height: 18, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.max(pct, 1)}%`, height: '100%', borderRadius: 4,
                    background: barColor, transition: 'width 0.3s ease',
                  }} />
                </div>
                <span style={{ width: 70, textAlign: 'right', fontWeight: 600, color: '#374151', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {fmt(val)} {metricLabel}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ textAlign: 'center', color: '#9CA3AF', padding: 24, fontSize: 14 }}>
          No fitness data cached yet. Click "Sync from Google" to load the last {DAYS_TO_SHOW} days.
        </p>
      )}
    </div>
  );
};

export default FitnessAnalyticsPanel;

// ── Helpers ────────────────────────────────────────────────────────────

const SummaryCard: React.FC<{ emoji: string; label: string; value: string }> = ({ emoji, label, value }) => (
  <div style={{
    background: '#F9FAFB', borderRadius: 10, padding: '12px 14px',
    border: '1px solid #E5E7EB', textAlign: 'center',
  }}>
    <div style={{ fontSize: 22 }}>{emoji}</div>
    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginTop: 2 }}>{value}</div>
  </div>
);

function fmt(n: number): string {
  return n.toLocaleString();
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
