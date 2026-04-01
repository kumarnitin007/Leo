/**
 * FitnessGoalCards
 *
 * Shows tracked tasks (steps, calories, etc.) with today's progress
 * as goal cards. Embedded in the Goals/Resolutions view.
 */

import React, { useEffect } from 'react';
import { useFitness, FITNESS_PROVIDERS } from '../integrations/fitness';
import type { Task } from '../types';

interface FitnessGoalCardsProps {
  tasks: Task[];
}

const FitnessGoalCards: React.FC<FitnessGoalCardsProps> = ({ tasks }) => {
  const { data, loadCached, activeProvider } = useFitness();

  const trackedTasks = tasks.filter(t => t.trackedMetric && !t.onHold);

  useEffect(() => {
    if (trackedTasks.length > 0) {
      loadCached(3);
    }
  }, [trackedTasks.length, loadCached]);

  if (!trackedTasks.length) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayData = data.find(d => d.date === todayStr);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>📊</span> Tracked Goals — Today
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {trackedTasks.map(task => {
          const m = task.trackedMetric!;
          const actual = todayData ? getMetricValue(todayData, m.type) : null;
          const pct = actual !== null && m.target > 0 ? Math.min((actual / m.target) * 100, 100) : 0;
          const met = actual !== null && actual >= m.target;

          return (
            <div key={task.id} style={{
              background: met ? '#F0FDF4' : '#fff',
              border: `1px solid ${met ? '#10B981' : '#E5E7EB'}`,
              borderRadius: 12, padding: '12px 14px',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: 4, background: '#E5E7EB',
              }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: met ? '#10B981' : '#3B82F6',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                {task.name}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: met ? '#059669' : '#374151' }}>
                {actual !== null ? actual.toLocaleString() : '—'}
                <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', marginLeft: 4 }}>
                  / {m.target.toLocaleString()} {m.unit}
                </span>
              </div>
              {met && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', marginTop: 4, display: 'inline-block' }}>
                  ✓ Goal reached!
                </span>
              )}
              {!met && actual !== null && (
                <span style={{ fontSize: 10, color: '#6B7280', marginTop: 4, display: 'inline-block' }}>
                  {Math.round(pct)}% complete
                </span>
              )}
              {actual === null && (
                <span style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4, display: 'inline-block' }}>
                  No data — sync {FITNESS_PROVIDERS[activeProvider].name}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FitnessGoalCards;

function getMetricValue(day: import('../integrations/google/types/fit.types').DailyFitnessData, type: string): number | null {
  switch (type) {
    case 'steps': return day.steps;
    case 'calories': return day.caloriesBurned ? Math.round(day.caloriesBurned) : null;
    case 'active_minutes': return day.activeMinutes;
    case 'distance': return day.distanceMeters ? Math.round(day.distanceMeters / 1000) : null;
    default: return null;
  }
}
