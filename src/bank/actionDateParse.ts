/**
 * Best-effort extract YYYY-MM-DD from free-text titles (e.g. "Till May 25", "Due 2025-06-01").
 * Used when Excel has no explicit due-date column.
 */

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function ymd(y: number, monthIndex: number, day: number): string | null {
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(y, monthIndex, day));
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== monthIndex || d.getUTCDate() !== day) return null;
  return d.toISOString().split("T")[0];
}

/** Pick year for month/day when year omitted (e.g. "May 25"): use current year, or next year if date already passed. */
function yearForMonthDay(monthIndex: number, day: number): number {
  const now = new Date();
  const y = now.getFullYear();
  const tryDate = new Date(y, monthIndex, day);
  if (tryDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    return y + 1;
  }
  return y;
}

export function extractDateFromTitle(raw: string): string | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();

  // ISO YYYY-MM-DD
  let m = s.match(/\b(20\d{2}|19\d{2})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // DD/MM/YYYY or DD-MM-YYYY (day-first, common in IN)
  m = s.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return ymd(y, mo - 1, d);
  }

  // 31 Mar 2025, 31 March 2025
  m = s.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*,?\s*(20\d{2}|19\d{2})\b/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const monKey = m[2].toLowerCase().slice(0, 3);
    const mon = MONTH_MAP[monKey];
    if (mon != null) {
      const y = parseInt(m[3], 10);
      return ymd(y, mon, day);
    }
  }

  // Till 2040 (year only)
  m = s.match(/\b[Tt]ill\s+(20\d{2}|19\d{2})\b/);
  if (m) {
    const y = parseInt(m[1], 10);
    return ymd(y, 5, 15);
  }

  // Till May 25 / till may 25 2026 / Till May 25, 2026
  m = s.match(/\b[Tt]ill\s+(\w+)\s+(\d{1,2})(?:\s*,?\s*(20\d{2}|19\d{2}))?\b/);
  if (m) {
    const monKey = m[1].toLowerCase().slice(0, 3);
    const mon = MONTH_MAP[monKey];
    const day = parseInt(m[2], 10);
    if (mon != null && day >= 1 && day <= 31) {
      const y = m[3] ? parseInt(m[3], 10) : yearForMonthDay(mon, day);
      return ymd(y, mon, day);
    }
  }

  // Till May25 (no space before day)
  m = s.match(/\b[Tt]ill\s+([A-Za-z]+)(\d{2})\b/i);
  if (m) {
    const monKey = m[1].toLowerCase().slice(0, 3);
    const mon = MONTH_MAP[monKey];
    const day = parseInt(m[2], 10);
    if (mon != null && day >= 1 && day <= 31) {
      const y = yearForMonthDay(mon, day);
      return ymd(y, mon, day);
    }
  }

  // May25 / May 25 (no year) — treat as day in month if second number is 2–4 digits year
  m = s.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{2,4})\b/i);
  if (m) {
    const monKey = m[1].toLowerCase().slice(0, 3);
    const mon = MONTH_MAP[monKey];
    const n = m[2];
    if (mon != null) {
      if (n.length === 4) {
        const y = parseInt(n, 10);
        // e.g. May2040 -> year 2040, day missing — skip
        if (y >= 1900 && y <= 2100) {
          // ambiguous "May2040" as May + year, default day 1
          return ymd(y, mon, 1);
        }
      } else {
        const day = parseInt(n, 10);
        if (day >= 1 && day <= 31) {
          const y = yearForMonthDay(mon, day);
          return ymd(y, mon, day);
        }
      }
    }
  }

  // Mon-YYYY or Mon–YYYY (e.g. Aug-2027, Aug–2027)
  m = s.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*[-–]\s*(20\d{2}|19\d{2})\b/i
  );
  if (m) {
    const monKey = m[1].toLowerCase().slice(0, 3);
    const mon = MONTH_MAP[monKey];
    const y = parseInt(m[2], 10);
    if (mon != null) return ymd(y, mon, 1);
  }

  // Mon YYYY (month + 4-digit year only, e.g. "Aug 2027" — avoids "Aug 16")
  m = s.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(20\d{2}|19\d{2})\b/i);
  if (m) {
    const monKey = m[1].toLowerCase().slice(0, 3);
    const mon = MONTH_MAP[monKey];
    const y = parseInt(m[2], 10);
    if (mon != null) return ymd(y, mon, 1);
  }

  // "2040" alone at end — weak signal, skip to avoid false positives

  return null;
}
