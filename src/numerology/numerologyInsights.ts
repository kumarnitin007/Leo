/**
 * Numerology Insights — plain-English statements derived from the engine's
 * raw numbers. ZERO API calls, all deterministic lookup tables. Cheap,
 * synchronous, identical for the same user every day.
 *
 * Used by `NumerologyPlainCard` to produce the 10 layman statements that
 * sit on top of the (now-collapsed) technical numerology cards.
 *
 * Standalone file — safe to delete if the feature is removed.
 */

import type { NumerologyProfile } from './numerologyEngine';

// ── Public configuration ─────────────────────────────────────────────────────

/**
 * Maximum number of custom numerology questions any user can save.
 * Edit this single number to roll the cap forward or back; the UI button,
 * the "n of N used" label, and the server-side insert guard all read from
 * this constant. See `myday_numerology_questions` (MYNQ) in the schema doc.
 */
export const NUMEROLOGY_CUSTOM_Q_MAX = 5;

// ── Per-Life-Path lookup tables ──────────────────────────────────────────────

interface LifePathInsight {
  bestWeekday: string;            // e.g. "Sunday"
  powerColor: { name: string; hex: string };
  powerStone: string;
  bestHourRange: string;          // e.g. "8 AM – 10 AM"
  affirmation: string;            // first-person, present-tense, 1 sentence
  careerSweetSpot: string;        // 1 short sentence
  compatibleBirthDays: number[];  // days of the month
  watchOutWeekday: string;        // e.g. "Saturday"
  vibeOneLiner: string;           // for the "Today's energy" copy
}

/** 1–9 + master numbers 11/22/33. Master numbers reduce to their root at the
 *  table boundary so we always have an entry. */
const LIFE_PATH_TABLE: Record<number, LifePathInsight> = {
  1: {
    bestWeekday: 'Sunday',
    powerColor: { name: 'Sunset orange', hex: '#F59E0B' },
    powerStone: 'Citrine',
    bestHourRange: '8 AM – 10 AM',
    affirmation: 'I lead with clarity, not noise.',
    careerSweetSpot: 'Leadership, founding things, or being first into a new field.',
    compatibleBirthDays: [1, 10, 19, 28],
    watchOutWeekday: 'Saturday',
    vibeOneLiner: 'You set the pace today — others take their cue from you.',
  },
  2: {
    bestWeekday: 'Monday',
    powerColor: { name: 'Soft moonstone white', hex: '#E5E7EB' },
    powerStone: 'Moonstone',
    bestHourRange: '6 AM – 9 AM',
    affirmation: 'I bring people together with quiet strength.',
    careerSweetSpot: 'Mediation, partnerships, design, or any "right-hand person" role.',
    compatibleBirthDays: [2, 11, 20, 29],
    watchOutWeekday: 'Tuesday',
    vibeOneLiner: 'Today rewards listening more than talking.',
  },
  3: {
    bestWeekday: 'Thursday',
    powerColor: { name: 'Royal yellow', hex: '#EAB308' },
    powerStone: 'Yellow Sapphire',
    bestHourRange: '10 AM – 12 PM',
    affirmation: 'I create joy wherever I show up.',
    careerSweetSpot: 'Writing, performing, teaching, anything that uses your voice.',
    compatibleBirthDays: [3, 12, 21, 30],
    watchOutWeekday: 'Saturday',
    vibeOneLiner: 'A creative spark is closer than you think — make space for it.',
  },
  4: {
    bestWeekday: 'Saturday',
    powerColor: { name: 'Deep teal', hex: '#0F766E' },
    powerStone: 'Emerald',
    bestHourRange: '7 AM – 9 AM',
    affirmation: 'I build slow, steady, and built to last.',
    careerSweetSpot: 'Engineering, ops, finance, anything that rewards systems thinking.',
    compatibleBirthDays: [4, 13, 22, 31],
    watchOutWeekday: 'Friday',
    vibeOneLiner: 'Boring details today pay outsized dividends tomorrow.',
  },
  5: {
    bestWeekday: 'Wednesday',
    powerColor: { name: 'Electric green', hex: '#10B981' },
    powerStone: 'Emerald',
    bestHourRange: '11 AM – 1 PM',
    affirmation: 'I move toward what is alive.',
    careerSweetSpot: 'Sales, travel, journalism, anything with motion and variety.',
    compatibleBirthDays: [5, 14, 23],
    watchOutWeekday: 'Thursday',
    vibeOneLiner: 'Today rewards saying "yes" to one new thing.',
  },
  6: {
    bestWeekday: 'Friday',
    powerColor: { name: 'Rose pink', hex: '#F472B6' },
    powerStone: 'Diamond',
    bestHourRange: '5 PM – 7 PM',
    affirmation: 'I take care of what matters, including myself.',
    careerSweetSpot: 'Healthcare, hospitality, design, anything that nurtures people.',
    compatibleBirthDays: [6, 15, 24],
    watchOutWeekday: 'Tuesday',
    vibeOneLiner: 'Family or home calls quietly today — answer it.',
  },
  7: {
    bestWeekday: 'Monday',
    powerColor: { name: 'Deep indigo', hex: '#4338CA' },
    powerStone: 'Amethyst',
    bestHourRange: '6 AM – 8 AM',
    affirmation: 'I trust what I find when I stop looking.',
    careerSweetSpot: 'Research, analysis, philosophy, anything requiring deep focus.',
    compatibleBirthDays: [7, 16, 25],
    watchOutWeekday: 'Wednesday',
    vibeOneLiner: 'A quiet hour today is worth three noisy ones.',
  },
  8: {
    bestWeekday: 'Saturday',
    powerColor: { name: 'Dark sapphire blue', hex: '#1E40AF' },
    powerStone: 'Blue Sapphire',
    bestHourRange: '10 AM – 12 PM',
    affirmation: 'I turn vision into structure and structure into wealth.',
    careerSweetSpot: 'Business, real estate, law, anything where authority compounds.',
    compatibleBirthDays: [8, 17, 26],
    watchOutWeekday: 'Sunday',
    vibeOneLiner: 'A practical decision today reshapes the next few months.',
  },
  9: {
    bestWeekday: 'Tuesday',
    powerColor: { name: 'Crimson red', hex: '#DC2626' },
    powerStone: 'Coral',
    bestHourRange: '4 PM – 6 PM',
    affirmation: 'I finish what I start, then let it go.',
    careerSweetSpot: 'Humanitarian work, the arts, anything bigger than just you.',
    compatibleBirthDays: [9, 18, 27],
    watchOutWeekday: 'Wednesday',
    vibeOneLiner: 'Closing one door makes room for the next one.',
  },
  // Master numbers — reuse their root vibe with a small note in copy.
  11: { /* mirrors 2 with extra intuition */
    bestWeekday: 'Monday',
    powerColor: { name: 'Pearl silver', hex: '#D1D5DB' },
    powerStone: 'Pearl',
    bestHourRange: '5 AM – 7 AM',
    affirmation: 'I trust the quiet voice that arrived first.',
    careerSweetSpot: 'Counsellor, teacher, healer, or any role bridging people and ideas.',
    compatibleBirthDays: [2, 11, 20, 29],
    watchOutWeekday: 'Tuesday',
    vibeOneLiner: 'Your intuition runs hot today — note what you sense before you act.',
  },
  22: {
    bestWeekday: 'Saturday',
    powerColor: { name: 'Deep navy', hex: '#1E3A8A' },
    powerStone: 'Lapis Lazuli',
    bestHourRange: '8 AM – 11 AM',
    affirmation: 'I build things that outlive me.',
    careerSweetSpot: 'Architecture, infrastructure, founding institutions, large-scale design.',
    compatibleBirthDays: [4, 13, 22, 31],
    watchOutWeekday: 'Friday',
    vibeOneLiner: 'Think two-decade horizons today, not two-week ones.',
  },
  33: {
    bestWeekday: 'Friday',
    powerColor: { name: 'Soft rose gold', hex: '#FB923C' },
    powerStone: 'Rose Quartz',
    bestHourRange: '4 PM – 6 PM',
    affirmation: 'I serve what is greater than my own day.',
    careerSweetSpot: 'Teaching, mentoring, healing, leading creative communities.',
    compatibleBirthDays: [6, 15, 24],
    watchOutWeekday: 'Tuesday',
    vibeOneLiner: 'A small act of service ripples wider than you can see.',
  },
};

/** Always-defined accessor — falls back to Life Path 1 if a stranger number ever shows up. */
function getLifePathInsight(n: number): LifePathInsight {
  return LIFE_PATH_TABLE[n] ?? LIFE_PATH_TABLE[1];
}

// ── Per-Personal-Year + Personal-Day blurbs ──────────────────────────────────

const PERSONAL_YEAR_THEMES: Record<number, { theme: string; tryThis: string; avoid: string }> = {
  1: { theme: 'fresh starts', tryThis: 'launching things you\'ve been postponing.',  avoid: 'looking backward — that chapter is closed.' },
  2: { theme: 'patience and partnerships', tryThis: 'deepening one relationship that matters.', avoid: 'forcing the timeline.' },
  3: { theme: 'creativity and joy', tryThis: 'showing your work in public.', avoid: 'spreading yourself across too many shiny things.' },
  4: { theme: 'quiet building', tryThis: 'fixing your foundations — health, finances, systems.', avoid: 'expecting fast wins.' },
  5: { theme: 'freedom and change', tryThis: 'taking that trip you\'ve been postponing or changing one big routine.', avoid: 'binding contracts that lock you in for years.' },
  6: { theme: 'home, family, responsibility', tryThis: 'nurturing the people closest to you.', avoid: 'rescuing those who don\'t want rescuing.' },
  7: { theme: 'reflection and study', tryThis: 'a real break for thinking — retreat, course, sabbatical.', avoid: 'forcing big public moves; the timing is wrong.' },
  8: { theme: 'authority and money', tryThis: 'asking for more — pay, scope, ownership.', avoid: 'shrinking out of guilt.' },
  9: { theme: 'completion', tryThis: 'finishing the long-running thing and letting it go.', avoid: 'starting brand-new long-haul commitments.' },
};

const PERSONAL_DAY_NUDGES: Record<number, { nudge: string; affirmation: string }> = {
  1: { nudge: 'Begin one thing today — a small bold move counts.', affirmation: 'I start what others only talk about.' },
  2: { nudge: 'Today rewards listening, partnering, and quiet diplomacy.', affirmation: 'I bring calm to the room.' },
  3: { nudge: 'Speak, write, post, or call someone you\'ve been meaning to.', affirmation: 'My voice is welcome here.' },
  4: { nudge: 'Boring discipline today buys freedom next month — pay the tax.', affirmation: 'I do the unglamorous thing well.' },
  5: { nudge: 'Try something new — a route, a food, a question.', affirmation: 'I move toward what feels alive.' },
  6: { nudge: 'Tend to home, family, or your own well-being.', affirmation: 'I take care of what is mine.' },
  7: { nudge: 'Carve out an hour of quiet — your best ideas are waiting there.', affirmation: 'I trust what shows up in stillness.' },
  8: { nudge: 'Make one practical decision about money, scope, or authority.', affirmation: 'I act with quiet authority.' },
  9: { nudge: 'Close, finish, forgive, donate — clear something out.', affirmation: 'I let go of what is complete.' },
};

// ── The 10 plain statements ──────────────────────────────────────────────────

export interface PlainStatement {
  /** Short label (e.g. "Lucky number"). Used as the chip heading. */
  label: string;
  /** One human sentence. */
  text: string;
  /** Emoji shown on the chip (kept tiny — visual rhythm only). */
  icon: string;
  /** Optional accent colour (hex). */
  color?: string;
}

/**
 * Build the 10 deterministic statements. Pure — same input ⇒ same output,
 * safe to memoise on `(profile, today.toDateString())`.
 */
export function buildPlainStatements(
  profile: NumerologyProfile,
  today: Date = new Date(),
): PlainStatement[] {
  const lp = getLifePathInsight(profile.lifePath);
  const yearTheme = PERSONAL_YEAR_THEMES[profile.personalYear] ?? PERSONAL_YEAR_THEMES[1];
  const dayNudge  = PERSONAL_DAY_NUDGES[profile.personalDay]   ?? PERSONAL_DAY_NUDGES[1];
  const luckyToday = profile.luckyNumbers[0] ?? profile.lifePath;

  const compatibleDays = lp.compatibleBirthDays
    .map((d) => `${d}${ordinalSuffix(d)}`)
    .join(', ');

  const monthName = today.toLocaleDateString('en-US', { month: 'long' });

  return [
    {
      label: 'Lucky number',
      text: `Your lucky number this week is ${luckyToday}.`,
      icon: '🎯',
      color: '#10B981',
    },
    {
      label: 'Best day',
      text: `${lp.bestWeekday}s are your best day — energy aligns with your Life Path ${profile.lifePath}.`,
      icon: '📅',
      color: '#3B82F6',
    },
    {
      label: 'Power colour',
      text: `Wear ${lp.powerColor.name.toLowerCase()} today for a confidence boost.`,
      icon: '🎨',
      color: lp.powerColor.hex,
    },
    {
      label: 'Power stone',
      text: `${lp.powerStone} is your power stone — keep one near your desk.`,
      icon: '💎',
      color: '#8B5CF6',
    },
    {
      label: 'Decision hours',
      text: `Best time for big decisions: ${lp.bestHourRange}.`,
      icon: '⏰',
      color: '#F59E0B',
    },
    {
      label: 'Compatibility',
      text: `You vibe with people born on the ${compatibleDays} of any month.`,
      icon: '💞',
      color: '#EC4899',
    },
    {
      label: 'This year',
      text: `${today.getFullYear()} is about ${yearTheme.theme} — try ${yearTheme.tryThis}`,
      icon: '🧭',
      color: '#0EA5E9',
    },
    {
      label: 'Today\'s energy',
      text: dayNudge.nudge,
      icon: '✨',
      color: '#A855F7',
    },
    {
      label: 'Watch out for',
      text: `Avoid signing important contracts on ${lp.watchOutWeekday}s this ${monthName}.`,
      icon: '✋',
      color: '#EF4444',
    },
    {
      label: 'Today\'s affirmation',
      text: `"${dayNudge.affirmation}"`,
      icon: '🌅',
      color: '#14B8A6',
    },
  ];
}

/** "1st", "2nd", "3rd", "4th", … */
function ordinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

// ── Convenience export for the AI vibe paragraph and question prompts ───────

/**
 * Compact, machine-readable summary of the user's numerology profile that
 * we send to the OpenAI prompt. Stays within ~250 input tokens.
 */
export function compactProfileForPrompt(profile: NumerologyProfile): string {
  return [
    `Life Path: ${profile.lifePath}`,
    `Expression: ${profile.expression}`,
    `Soul Urge: ${profile.soulUrge}`,
    `Personality: ${profile.personality}`,
    `Birthday: ${profile.birthday}`,
    `Maturity: ${profile.maturity}`,
    `Personal Year: ${profile.personalYear}`,
    `Personal Month: ${profile.personalMonth}`,
    `Personal Day: ${profile.personalDay}`,
    `Karmic Lessons: ${profile.karmicLessons.join(', ') || 'none'}`,
    `Karmic Debts: ${profile.karmicDebts.join(', ') || 'none'}`,
    `Lucky: ${profile.luckyNumbers.join(', ')}`,
  ].join(' | ');
}
