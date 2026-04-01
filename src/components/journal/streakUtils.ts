/**
 * Streak utility functions for journal entries.
 * Computes streaks and dot data from a list of entry dates.
 */

import type { JournalEntry } from '../../types';

export interface StreakDotData {
  date: string;
  status: 'done' | 'miss' | 'today' | 'future';
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function calculateStreaks(entries: JournalEntry[]): { current: number; best: number } {
  if (entries.length === 0) return { current: 0, best: 0 };
  const uniqueDates = [...new Set(entries.map(e => e.date))].sort().reverse();

  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  const today = fmtDate(new Date());
  let checkDate = today;

  for (let i = 0; i < uniqueDates.length; i++) {
    if (uniqueDates[i] === checkDate) {
      currentStreak++;
      const prevDate = new Date(checkDate + 'T00:00:00');
      prevDate.setDate(prevDate.getDate() - 1);
      checkDate = fmtDate(prevDate);
    } else {
      break;
    }
  }

  for (let i = 0; i < uniqueDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prev = new Date(uniqueDates[i - 1] + 'T00:00:00');
      prev.setDate(prev.getDate() - 1);
      if (uniqueDates[i] === fmtDate(prev)) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    bestStreak = Math.max(bestStreak, tempStreak);
  }

  return { current: currentStreak, best: Math.max(bestStreak, currentStreak) };
}

export function computeStreakDots(entryDates: Set<string>, daysBack = 7): StreakDotData[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = fmtDate(today);
  const dots: StreakDotData[] = [];

  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = fmtDate(d);

    if (dateStr === todayStr) {
      dots.push({ date: dateStr, status: 'today' });
    } else {
      dots.push({ date: dateStr, status: entryDates.has(dateStr) ? 'done' : 'miss' });
    }
  }

  for (let i = 1; i <= 3; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dots.push({ date: fmtDate(d), status: 'future' });
  }

  return dots;
}
