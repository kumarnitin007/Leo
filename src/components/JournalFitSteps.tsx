/**
 * Journal Fit Steps — Milestone 1
 *
 * Renders a "Fetch Steps" button near the energy/activity fields in the
 * journal entry form. Displays last 3 days of step data inline.
 *
 * If Google Fit is not connected → shows "Connect Google Fit to see steps"
 * with a link to IntegrationsView.
 */

import React from 'react';
import { useFitness, FITNESS_PROVIDERS } from '../integrations/fitness';
import type { DailyFitnessData } from '../integrations/google/types/fit.types';

interface JournalFitStepsProps {
  onNavigateToIntegrations?: () => void;
}

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString();
}

function dayLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}

function formatMetric(value: number | null, unit: string): string | null {
  if (value === null || value === undefined || value === 0) return null;
  if (unit === 'km') return `${(value / 1000).toFixed(1)} km`;
  if (unit === 'cal') return `${Math.round(value)} cal`;
  if (unit === 'min') return `${value} min`;
  if (unit === 'bpm') return `${value} bpm`;
  if (unit === 'hr') {
    const h = Math.floor(value / 60);
    const m = value % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  return `${value}`;
}

const JournalFitSteps: React.FC<JournalFitStepsProps> = ({ onNavigateToIntegrations }) => {
  const { data, loading, error, activeProvider, fetchRecent } = useFitness();
  const providerName = FITNESS_PROVIDERS[activeProvider].name;

  return (
    <div style={{ padding: '8px 0.5rem' }}>
      <button
        onClick={() => fetchRecent()}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 10,
          border: '1.5px solid #10B98130', background: '#F0FDF4',
          color: '#059669', fontSize: 12, fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer', width: '100%',
        }}
      >
        {loading ? (
          <>
            <span style={{ display: 'inline-block', animation: 'briefingSpin 0.8s linear infinite', width: 14, height: 14, border: '2px solid #10B98140', borderTopColor: '#10B981', borderRadius: '50%' }} />
            Fetching from {providerName}...
          </>
        ) : (
          <>
            <span style={{ fontSize: 16 }}>🏃</span>
            {data.length > 0 ? 'Refresh Steps' : `Fetch Steps (${providerName})`}
          </>
        )}
      </button>

      {error && (
        <div style={{ fontSize: 11, color: '#EF4444', marginTop: 6, padding: '0 4px' }}>
          {error}
        </div>
      )}

      {data.length > 0 && !loading && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.map((day: DailyFitnessData) => (
            <DayRow key={day.date} day={day} />
          ))}
        </div>
      )}
    </div>
  );
};

const DayRow: React.FC<{ day: DailyFitnessData }> = ({ day }) => {
  const metrics: { icon: string; text: string }[] = [];
  const cal = formatMetric(day.caloriesBurned, 'cal');
  const dist = formatMetric(day.distanceMeters, 'km');
  const active = formatMetric(day.activeMinutes, 'min');
  const hr = formatMetric(day.heartRateAvg, 'bpm');
  const sleep = formatMetric(day.sleepMinutes, 'hr');
  const weight = day.weightKg ? `${day.weightKg} kg` : null;
  const floors = day.floorsClimbed ? `${day.floorsClimbed} floors` : null;

  if (cal) metrics.push({ icon: '🔥', text: cal });
  if (dist) metrics.push({ icon: '📏', text: dist });
  if (active) metrics.push({ icon: '⏱', text: active });
  if (hr) metrics.push({ icon: '❤️', text: hr });
  if (sleep) metrics.push({ icon: '😴', text: sleep });
  if (weight) metrics.push({ icon: '⚖️', text: weight });
  if (floors) metrics.push({ icon: '🏢', text: floors });

  return (
    <div style={{
      padding: '6px 10px', background: '#F9FAFB', borderRadius: 8,
      fontSize: 12, color: '#374151',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontWeight: 600, minWidth: 75, color: '#6B7280' }}>
          {dayLabel(day.date)}
        </span>
        <span style={{ fontWeight: 700, color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
          {formatNumber(day.steps)} steps
        </span>
      </div>
      {metrics.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginTop: 2, paddingLeft: 83 }}>
          {metrics.map((m, i) => (
            <span key={i} style={{ fontSize: 10, color: '#9CA3AF' }}>{m.icon} {m.text}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export default JournalFitSteps;
