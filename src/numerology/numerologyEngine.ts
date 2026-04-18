/**
 * Numerology Calculation Engine — pure client-side, zero API dependency.
 *
 * Implements Pythagorean numerology:
 *   Life Path, Expression, Soul Urge, Personality, Birthday, Maturity,
 *   Personal Year / Month / Day, Karmic Debt, Karmic Lessons, Lucky Numbers.
 *
 * Standalone file — safe to delete if feature is removed.
 */

// ── Pythagorean letter-to-number map ─────────────────────────────────────────

const PYTHAGOREAN: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
  J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
  S: 1, T: 2, U: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8,
};

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
const MASTER_NUMBERS = new Set([11, 22, 33]);

// ── Core reduction ───────────────────────────────────────────────────────────

export function reduceToSingle(n: number, keepMaster = true): number {
  while (n > 9 && !(keepMaster && MASTER_NUMBERS.has(n))) {
    n = String(n).split('').reduce((s, d) => s + parseInt(d, 10), 0);
  }
  return n;
}

function digitSum(s: string): number {
  return s.split('').reduce((acc, ch) => acc + (parseInt(ch, 10) || 0), 0);
}

// ── Name-based calculations ──────────────────────────────────────────────────

function letterValues(name: string): number[] {
  return name
    .toUpperCase()
    .split('')
    .filter(ch => PYTHAGOREAN[ch] !== undefined)
    .map(ch => PYTHAGOREAN[ch]);
}

function vowelSum(name: string): number {
  return name
    .toUpperCase()
    .split('')
    .filter(ch => VOWELS.has(ch) && PYTHAGOREAN[ch] !== undefined)
    .reduce((s, ch) => s + PYTHAGOREAN[ch], 0);
}

function consonantSum(name: string): number {
  return name
    .toUpperCase()
    .split('')
    .filter(ch => !VOWELS.has(ch) && PYTHAGOREAN[ch] !== undefined)
    .reduce((s, ch) => s + PYTHAGOREAN[ch], 0);
}

// ── Public calculation functions ─────────────────────────────────────────────

export function lifePathNumber(year: number, month: number, day: number): number {
  const m = reduceToSingle(month);
  const d = reduceToSingle(day);
  const y = reduceToSingle(digitSum(String(year)));
  return reduceToSingle(m + d + y);
}

export function expressionNumber(fullName: string): number {
  const total = letterValues(fullName).reduce((s, v) => s + v, 0);
  return reduceToSingle(total);
}

export function soulUrgeNumber(fullName: string): number {
  return reduceToSingle(vowelSum(fullName));
}

export function personalityNumber(fullName: string): number {
  return reduceToSingle(consonantSum(fullName));
}

export function birthdayNumber(day: number): number {
  return reduceToSingle(day);
}

export function maturityNumber(lifePath: number, expression: number): number {
  return reduceToSingle(lifePath + expression);
}

// ── Cycles ───────────────────────────────────────────────────────────────────

export function personalYear(birthMonth: number, birthDay: number, currentYear: number): number {
  const m = reduceToSingle(birthMonth, false);
  const d = reduceToSingle(birthDay, false);
  const y = reduceToSingle(digitSum(String(currentYear)), false);
  return reduceToSingle(m + d + y, false);
}

export function personalMonth(persYear: number, currentMonth: number): number {
  return reduceToSingle(persYear + currentMonth, false);
}

export function personalDay(persMonth: number, currentDay: number): number {
  return reduceToSingle(persMonth + currentDay, false);
}

// ── Karmic ───────────────────────────────────────────────────────────────────

export const KARMIC_DEBT_NUMBERS = [13, 14, 16, 19] as const;

export function karmicDebts(year: number, month: number, day: number, fullName: string): number[] {
  const raw = [
    digitSum(String(month)) + digitSum(String(day)) + digitSum(String(year)),
    letterValues(fullName).reduce((s, v) => s + v, 0),
    vowelSum(fullName),
    consonantSum(fullName),
  ];
  const found = new Set<number>();
  raw.forEach(n => {
    let val = n;
    while (val > 9) {
      if (KARMIC_DEBT_NUMBERS.includes(val as any)) found.add(val);
      val = digitSum(String(val));
    }
  });
  return Array.from(found).sort();
}

export function karmicLessons(fullName: string): number[] {
  const present = new Set(letterValues(fullName));
  const missing: number[] = [];
  for (let i = 1; i <= 9; i++) {
    if (!present.has(i)) missing.push(i);
  }
  return missing;
}

// ── Lucky Numbers (derived from Life Path + Birthday + current day) ──────────

export function luckyNumbers(lifePath: number, birthday: number, today: Date): number[] {
  const base = [lifePath, birthday];
  const dayNum = today.getDate();
  const monthNum = today.getMonth() + 1;
  const set = new Set(base);
  let n = lifePath * 7 + birthday * 3 + dayNum + monthNum * 11;
  let iterations = 0;
  while (set.size < 6 && iterations < 200) {
    iterations++;
    n = ((n * 1103515245 + 12345) >>> 0) % 2147483647;
    const candidate = (n % 45) + 1;
    set.add(candidate);
  }
  return Array.from(set);
}

// ── Composite snapshot ───────────────────────────────────────────────────────

export interface NumerologyProfile {
  lifePath: number;
  expression: number;
  soulUrge: number;
  personality: number;
  birthday: number;
  maturity: number;
  personalYear: number;
  personalMonth: number;
  personalDay: number;
  karmicDebts: number[];
  karmicLessons: number[];
  luckyNumbers: number[];
  signatureNumbers: number[]; // [lifePath, expression, soulUrge, personality, maturity, birthday]
}

export function calculateFullProfile(
  year: number, month: number, day: number,
  fullName: string,
  now = new Date(),
): NumerologyProfile {
  const lp = lifePathNumber(year, month, day);
  const expr = expressionNumber(fullName);
  const su = soulUrgeNumber(fullName);
  const pers = personalityNumber(fullName);
  const bd = birthdayNumber(day);
  const mat = maturityNumber(lp, expr);
  const py = personalYear(month, day, now.getFullYear());
  const pm = personalMonth(py, now.getMonth() + 1);
  const pd = personalDay(pm, now.getDate());

  return {
    lifePath: lp,
    expression: expr,
    soulUrge: su,
    personality: pers,
    birthday: bd,
    maturity: mat,
    personalYear: py,
    personalMonth: pm,
    personalDay: pd,
    karmicDebts: karmicDebts(year, month, day, fullName),
    karmicLessons: karmicLessons(fullName),
    luckyNumbers: luckyNumbers(lp, bd, now),
    signatureNumbers: [lp, expr, su, pers, mat, bd],
  };
}
