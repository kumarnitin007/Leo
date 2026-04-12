/**
 * ContextPanel — Desktop Right Panel
 *
 * Read-only context cards: streak, steps, mood chart, on-this-day, AI reflection.
 * Data is computed/passed from the parent layout.
 */

import React, { useMemo, useState, useEffect } from 'react';
import type { JournalEntry } from '../../types';
import type { DailyFitnessData } from '../../integrations/google/types/fit.types';
import { StreakWidget, getMoodEmoji } from './shared';
import type { StreakDotData } from './streakUtils';
import type { JournalReflectionResult } from '../../services/ai/abilities/journalReflection';
import { getUserSettings } from '../../storage';

interface WeatherInfo {
  temp: number;
  description: string;
  icon: string;
  city: string;
  symbol: string;
}

interface ContextPanelProps {
  currentStreak: number;
  bestStreak: number;
  dots: StreakDotData[];
  allEntries: JournalEntry[];
  selectedDate: string;
  editingEntry: JournalEntry | null;
  justSaved: boolean;
  aiReflection?: JournalReflectionResult | null;
  fitnessData: DailyFitnessData[];
  fitnessLoading: boolean;
  fitnessConnected?: boolean | null;
  onFetchFitness: () => void;
}

const ContextPanel: React.FC<ContextPanelProps> = ({
  currentStreak, bestStreak, dots, allEntries, selectedDate,
  editingEntry, justSaved, aiReflection, fitnessData, fitnessLoading, fitnessConnected, onFetchFitness,
}) => {
  // On this day — 1 year ago
  const onThisDay = useMemo(() => {
    const yearAgo = new Date(selectedDate + 'T00:00:00');
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const yearAgoStr = `${yearAgo.getFullYear()}-${String(yearAgo.getMonth() + 1).padStart(2, '0')}-${String(yearAgo.getDate()).padStart(2, '0')}`;
    return allEntries.find(e => e.date === yearAgoStr) || null;
  }, [allEntries, selectedDate]);

  // Mood chart — last 7 entries
  const moodChart = useMemo(() => {
    const moodValues: Record<string, number> = { great: 5, good: 4, okay: 3, bad: 2, terrible: 1 };
    const recent = allEntries
      .filter(e => e.mood)
      .slice(0, 7)
      .reverse();
    return recent.map(e => ({
      emoji: getMoodEmoji(e.mood),
      height: ((moodValues[e.mood || 'okay'] || 3) / 5) * 100,
    }));
  }, [allEntries]);

  // Steps data
  const todaySteps = fitnessData.find(d => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return d.date === todayStr;
  });

  const stepGoal = 10000;
  const stepsPercent = todaySteps?.steps ? Math.min((todaySteps.steps / stepGoal) * 100, 100) : 0;

  // Weather context card
  const [weatherInfo, setWeatherInfo] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await getUserSettings();
        const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
        const loc = settings.location;
        if (!apiKey || !loc || (!loc.zipCode && !loc.city)) return;

        const query = loc.zipCode
          ? `zip=${loc.zipCode}${loc.country ? ',' + loc.country : ''}`
          : `q=${loc.city}${loc.country ? ',' + loc.country : ''}`;
        const units = settings.temperatureUnit === 'celsius' ? 'metric' : 'imperial';
        const symbol = units === 'metric' ? '°C' : '°F';
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?${query}&appid=${apiKey}&units=${units}`
        );
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (cancelled) return;
        setWeatherInfo({
          temp: Math.round(d.main?.temp ?? 0),
          description: d.weather?.[0]?.description || '',
          icon: d.weather?.[0]?.icon || '01d',
          city: loc.city || loc.zipCode || '',
          symbol,
        });
      } catch {
        // Non-critical
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="j-right">
      <div className="j-right-head">
        <span className="j-section-label">Today's context</span>
      </div>
      <div className="j-right-scroll">
        {/* Streak Card */}
        <StreakWidget currentStreak={currentStreak} bestStreak={bestStreak} dots={dots} />

        {/* Steps Card */}
        <div className="j-insight-card">
          <div className="j-ic-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="j-ic-dot" style={{ background: 'var(--j-green)' }} />
              Steps today
            </span>
            {fitnessConnected !== false && fitnessData.length > 0 && (
              <button
                onClick={onFetchFitness}
                disabled={fitnessLoading}
                type="button"
                style={{
                  padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  border: '1px solid var(--j-green)', color: 'var(--j-green)',
                  background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                  opacity: fitnessLoading ? 0.5 : 1,
                }}
              >
                {fitnessLoading ? '…' : 'Refresh'}
              </button>
            )}
          </div>
          {fitnessData.length > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="j-stat-val">{(todaySteps?.steps ?? 0).toLocaleString()}</span>
                <span className="j-stat-unit">
                  {todaySteps?.caloriesBurned ? `${Math.round(todaySteps.caloriesBurned)} cal` : ''}
                  {todaySteps?.activeMinutes ? ` · ${todaySteps.activeMinutes} min` : ''}
                </span>
              </div>
              <div className="j-mini-bar">
                <div className="j-mini-bar-fill" style={{ width: `${stepsPercent}%`, background: 'var(--j-green)' }} />
              </div>
              <div className="j-steps-list">
                {fitnessData.filter(d => d.date !== todaySteps?.date).slice(0, 2).map((d, i) => (
                  <div key={d.date} className="j-steps-row">
                    <span className="j-steps-day">{i === 0 ? 'Yesterday' : '2 days ago'}</span>
                    <span className="j-steps-val" style={{ color: (d.steps ?? 0) >= stepGoal ? 'var(--j-green)' : undefined }}>
                      {(d.steps ?? 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : fitnessConnected === false ? (
            <div style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500,
              border: '1px solid var(--j-gold)', color: 'var(--j-ink2)',
              background: 'var(--j-gold-light, #fef9ef)', marginTop: 4,
              lineHeight: 1.5,
            }}>
              No fitness tracker connected.
              <br />
              Go to <strong>Settings → Integrations</strong> to connect Google Fit, Fitbit, or Garmin.
            </div>
          ) : (
            <button
              onClick={onFetchFitness}
              disabled={fitnessLoading}
              type="button"
              style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500,
                border: '1px solid var(--j-green)', color: 'var(--j-green)',
                background: 'var(--j-green-light)', cursor: 'pointer', fontFamily: 'inherit',
                marginTop: 4,
              }}
            >
              {fitnessLoading ? 'Loading…' : 'Fetch Steps'}
            </button>
          )}
        </div>

        {/* Mood Chart */}
        {moodChart.length > 0 && (
          <div className="j-insight-card">
            <div className="j-ic-title">
              <span className="j-ic-dot" style={{ background: 'var(--j-purple)' }} />
              Mood this week
            </div>
            <div className="j-mood-bars">
              {moodChart.map((m, i) => (
                <div
                  key={i}
                  className="j-mood-bar"
                  style={{
                    height: `${m.height}%`,
                    background: m.height > 60 ? 'var(--j-purple-light)' : 'var(--j-red-light)',
                  }}
                >
                  {m.emoji}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--j-ink3)', marginTop: 4 }}>
              {moodChart.filter(m => m.height >= 60).length >= moodChart.length * 0.6
                ? 'Generally positive week'
                : 'Mixed moods this week'}
            </div>
          </div>
        )}

        {/* On This Day */}
        {onThisDay && (
          <div className="j-otd-card">
            <div className="j-otd-label">✦ On this day · 1 year ago</div>
            <div className="j-otd-text">
              "{onThisDay.content.substring(0, 150)}{onThisDay.content.length > 150 ? '…' : ''}"
            </div>
            <div className="j-otd-meta">
              {new Date(onThisDay.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {onThisDay.mood && ` · ${getMoodEmoji(onThisDay.mood)} ${onThisDay.mood}`}
            </div>
          </div>
        )}

        {/* AI Weather & Wellness Suggestion (Message 2 from Leo) */}
        {aiReflection?.weatherSuggestion ? (
          <div className="j-insight-card" style={{ borderLeft: '3px solid #60A5FA' }}>
            <div className="j-ic-title">
              <span style={{ fontSize: 14 }}>🌤️</span>
              <span style={{ marginLeft: 6 }}>Leo's Wellness Tip</span>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--j-ink2)' }}>
              {aiReflection.weatherSuggestion}
            </div>
          </div>
        ) : (
          <div className="j-insight-card" style={{ borderLeft: '3px solid #A5B4FC', opacity: 0.7 }}>
            <div className="j-ic-title">
              <span style={{ fontSize: 14 }}>✨</span>
              <span style={{ marginLeft: 6 }}>Leo's Wellness Tip</span>
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--j-ink3)' }}>
              Click <strong>Reflect</strong> in the center panel to get a personalized wellness tip based on your weather, steps, and journal.
            </div>
          </div>
        )}

        {/* Weather Card */}
        {weatherInfo && (
          <div className="j-insight-card">
            <div className="j-ic-title">
              <span className="j-ic-dot" style={{ background: 'var(--j-gold)' }} />
              Weather · {weatherInfo.city}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <img
                src={`https://openweathermap.org/img/wn/${weatherInfo.icon}@2x.png`}
                alt={weatherInfo.description}
                loading="lazy"
                style={{ width: 40, height: 40 }}
              />
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--j-ink)' }}>
                  {weatherInfo.temp}{weatherInfo.symbol} · {weatherInfo.description.charAt(0).toUpperCase() + weatherInfo.description.slice(1)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--j-ink3)' }}>
                  {weatherInfo.city} · {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContextPanel;
