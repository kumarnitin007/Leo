/**
 * Performance Logger
 *
 * Tracks execution time of methods/data-fetches across screens.
 * Controlled by:
 *   - import.meta.env.DEV          — auto-enabled in local dev
 *   - VITE_PERF_LOG=true in .env   — explicit opt-in (useful on Vercel preview)
 *
 * In production (Vercel) this is a no-op unless VITE_PERF_LOG=true.
 *
 * Usage:
 *   const end = perfStart('TodayView', 'loadItems');
 *   await doWork();
 *   end();                       // logs elapsed ms to console
 *
 * Console helpers (available in browser DevTools):
 *   perfSummary()   — sorted table of all recorded timings
 *   perfSummary('TodayView')  — filter to one screen
 *   perfReset()     — clear recorded entries
 */

const PERF_ENABLED: boolean =
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV === true) ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PERF_LOG === 'true');

export interface PerfEntry {
  screen: string;
  label: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  timestamp: string; // ISO wall-clock for easy scanning
}

const entries: PerfEntry[] = [];

/**
 * Start a perf timer. Returns a stop function.
 *
 * @param screen  Logical screen / component, e.g. 'TodayView', 'ItemsView'
 * @param label   What is being timed, e.g. 'loadItems', 'calculateStreak'
 */
export function perfStart(screen: string, label: string): () => void {
  if (!PERF_ENABLED) return () => {};

  const start = performance.now();
  return () => {
    const end = performance.now();
    const duration = Math.round((end - start) * 100) / 100;
    const entry: PerfEntry = {
      screen,
      label,
      startMs: Math.round(start * 100) / 100,
      endMs: Math.round(end * 100) / 100,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    };
    entries.push(entry);

    const tag = `${screen} › ${label}`;
    const color = duration > 1000 ? '#d32f2f' : duration > 500 ? '#e65100' : '#2e7d32';
    console.log(
      `%c⏱ %c${tag} %c${duration}ms`,
      'color:#888',
      'color:#1a1a1a;font-weight:600',
      `color:${color};font-weight:700`,
    );
  };
}

/**
 * Print a summary table to the console.
 * Optionally filter by screen name.
 */
export function perfSummary(screenFilter?: string): void {
  const pool = screenFilter
    ? entries.filter(e => e.screen.toLowerCase().includes(screenFilter.toLowerCase()))
    : entries;

  if (pool.length === 0) {
    console.log('[perf] No entries recorded' + (screenFilter ? ` for "${screenFilter}"` : '') + '.');
    return;
  }

  const sorted = [...pool].sort((a, b) => b.durationMs - a.durationMs);
  const total = sorted.reduce((s, e) => s + e.durationMs, 0);

  console.table(
    sorted.map(e => ({
      Screen: e.screen,
      Method: e.label,
      'Duration (ms)': e.durationMs,
      '% of total': ((e.durationMs / total) * 100).toFixed(1) + '%',
      Timestamp: e.timestamp.split('T')[1].slice(0, 12),
    })),
  );
  console.log(`[perf] Total: ${Math.round(total)}ms across ${sorted.length} calls`);
}

/** Clear recorded entries. */
export function perfReset(): void {
  entries.length = 0;
  console.log('[perf] Entries cleared.');
}

/** Get raw entries (for programmatic access). */
export function perfEntries(screenFilter?: string): readonly PerfEntry[] {
  if (screenFilter) return entries.filter(e => e.screen === screenFilter);
  return entries;
}

// Expose helpers on window for DevTools console access
if (typeof window !== 'undefined') {
  (window as any).perfSummary = perfSummary;
  (window as any).perfReset = perfReset;
  (window as any).perfEntries = perfEntries;
}
