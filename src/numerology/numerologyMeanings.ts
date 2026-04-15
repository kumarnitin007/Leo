/**
 * Numerology number meanings, colors, and interpretive text.
 * Standalone file — safe to delete if feature is removed.
 */

// ── Number meanings (1–9 + master 11, 22, 33) ───────────────────────────────

export interface NumberMeaning {
  keyword: string;
  shortDesc: string;
  yearAdvice: string;
  monthAdvice: string;
  dayAdvice: string;
  color: string;
  /** Best-for tags when this number is the Personal Year */
  bestFor: string[];
}

export const NUMBER_MEANINGS: Record<number, NumberMeaning> = {
  1: {
    keyword: 'New Beginnings',
    shortDesc: 'Independence, leadership, originality. You find truth, knowledge, self-initiation.',
    yearAdvice: 'A powerful fresh start. Set big goals, launch new projects, take bold action.',
    monthAdvice: 'Initiate. Start what you\'ve been putting off.',
    dayAdvice: 'Power and authority. A great day for launching, pitching, and leading.',
    color: '#EF4444',
    bestFor: ['New goals', 'Career pivots', 'Starting new projects', 'Breaking old patterns'],
  },
  2: {
    keyword: 'Partnership',
    shortDesc: 'Cooperation, diplomacy, balance. Sensitive to others, seeks harmony.',
    yearAdvice: 'Patience and partnerships. Collaborate, don\'t force. Things develop slowly.',
    monthAdvice: 'Cooperate. Listen more than you speak.',
    dayAdvice: 'Diplomacy and patience. Avoid conflict — seek balance.',
    color: '#F97316',
    bestFor: ['Relationships', 'Team projects', 'Networking', 'Compromise'],
  },
  3: {
    keyword: 'Expression',
    shortDesc: 'Creativity, communication, joy. Desire to create, communicate, and be joyful.',
    yearAdvice: 'Creative expansion. Express yourself, socialize, explore artistic pursuits.',
    monthAdvice: 'Create and share. Your words carry extra power.',
    dayAdvice: 'Self-expression and social energy. Art, writing, and communication flow.',
    color: '#EAB308',
    bestFor: ['Creative projects', 'Social events', 'Writing', 'Self-expression'],
  },
  4: {
    keyword: 'Build & Organize',
    shortDesc: 'Stability, hard work, foundation. Practical, detail-oriented, builds lasting structures.',
    yearAdvice: 'Build your foundation. Hard work pays off — focus on systems and structure.',
    monthAdvice: 'Organize. Build systems that last.',
    dayAdvice: 'Structure and discipline. Good for planning, budgeting, and organizing.',
    color: '#22C55E',
    bestFor: ['Habit tracking', 'Financial planning', 'Home improvement', 'Systems building'],
  },
  5: {
    keyword: 'Freedom & Change',
    shortDesc: 'Versatile, adaptable, multi-talented. You express yourself through variety and change.',
    yearAdvice: 'A year of unexpected change, liberation, and expansion. Embrace the adventure.',
    monthAdvice: 'Adapt. Expect the unexpected.',
    dayAdvice: 'Change energy. Travel, try new things, break routine.',
    color: '#3B82F6',
    bestFor: ['Travel', 'Career pivots', 'Breaking obligations', 'Networking', 'Adventure'],
  },
  6: {
    keyword: 'Responsibility',
    shortDesc: 'Nurturing, responsible, protective. Home, family, community are your anchors.',
    yearAdvice: 'Focus on home, family, and responsibility. Nurture what matters most.',
    monthAdvice: 'Nurture. Take care of family and home.',
    dayAdvice: 'Duty and love. Family matters, home projects, and caregiving.',
    color: '#8B5CF6',
    bestFor: ['Family time', 'Home projects', 'Community service', 'Relationship deepening'],
  },
  7: {
    keyword: 'Introspection',
    shortDesc: 'Analytical, spiritual, intuitive. You find truth, knowledge, self-initiation.',
    yearAdvice: 'Go inward. Study, reflect, meditate. Answers come through solitude.',
    monthAdvice: 'Reflect. Don\'t rush decisions.',
    dayAdvice: 'Wisdom and solitude. Good for research, meditation, and deep thinking.',
    color: '#6366F1',
    bestFor: ['Study', 'Meditation', 'Research', 'Journaling', 'Spiritual growth'],
  },
  8: {
    keyword: 'Power & Achievement',
    shortDesc: 'Ambitious, authoritative, materially successful. Executive ability and financial mastery.',
    yearAdvice: 'Harvest time. Financial gains, career advancement, and recognition.',
    monthAdvice: 'Execute. Push for results and recognition.',
    dayAdvice: 'Power of authority, material success, and executive action. Avoid small thinking.',
    color: '#A855F7',
    bestFor: ['Financial goals', 'Career moves', 'Investments', 'Leadership roles'],
  },
  9: {
    keyword: 'Completion',
    shortDesc: 'Humanitarian, compassionate, wise. Universal love, endings, and transformation.',
    yearAdvice: 'Let go. Complete unfinished business. Release what no longer serves you.',
    monthAdvice: 'Release. Forgive and complete.',
    dayAdvice: 'Endings and compassion. Good for closure, charity, and releasing.',
    color: '#EC4899',
    bestFor: ['Decluttering', 'Forgiving', 'Completing projects', 'Letting go of habits'],
  },
  11: {
    keyword: 'Master Intuition',
    shortDesc: 'Master Number 11 — you are an inspirer. Intuitive, sensitive, inspiring.',
    yearAdvice: 'Heightened intuition. Trust your inner voice. Inspirational opportunities arrive.',
    monthAdvice: 'Tune in to your intuition. Powerful insights await.',
    dayAdvice: 'Spiritual download day. Pay attention to signs, dreams, and sudden insights.',
    color: '#F59E0B',
    bestFor: ['Spiritual practices', 'Teaching', 'Inspiring others', 'Creative breakthroughs'],
  },
  22: {
    keyword: 'Master Builder',
    shortDesc: 'Master Number 22 — the architect. Turns grand visions into tangible reality.',
    yearAdvice: 'Build something that outlasts you. Massive potential for lasting achievement.',
    monthAdvice: 'Think big and build bigger. Your potential is extraordinary.',
    dayAdvice: 'Master builder energy. Great day for ambitious plans and large-scale projects.',
    color: '#0EA5E9',
    bestFor: ['Large projects', 'Business building', 'Legacy planning', 'Mentoring'],
  },
  33: {
    keyword: 'Master Teacher',
    shortDesc: 'Master Number 33 — compassionate teacher. Heals and uplifts through wisdom and love.',
    yearAdvice: 'Your year to teach, heal, and uplift. Profound impact on others.',
    monthAdvice: 'Share your wisdom. Others need your guidance now.',
    dayAdvice: 'Healing energy. A day for service, teaching, and profound compassion.',
    color: '#14B8A6',
    bestFor: ['Teaching', 'Healing', 'Community leadership', 'Mentoring'],
  },
};

// ── Karmic Debt meanings ─────────────────────────────────────────────────────

export const KARMIC_DEBT_MEANINGS: Record<number, { title: string; description: string }> = {
  13: {
    title: 'The Debt of Hard Work',
    description: 'In a past life, others carried your load. Now: discipline and structure don\'t come easy — building them is literally your karma. Your habit tracking is your karmic path.',
  },
  14: {
    title: 'The Debt of Freedom Misused',
    description: 'In a past life, freedom was abused — overindulgence, scattered energy, avoiding commitment. This lifetime, you are learning healthy discipline alongside freedom. Your planner\'s structure and liberty in your own timeline.',
  },
  16: {
    title: 'The Debt of Ego Destruction',
    description: 'Past-life ego and vanity must be transmuted. Unexpected setbacks strip away false pride. True growth comes through humility and spiritual awakening.',
  },
  19: {
    title: 'The Debt of Self-Reliance',
    description: 'You once abused power over others. Now you must learn independence without isolation. Ask for help — that\'s the karmic lesson. Building community is your growth edge.',
  },
};

// ── Karmic Lesson meanings ───────────────────────────────────────────────────

export const KARMIC_LESSON_MEANINGS: Record<number, { keyword: string; description: string }> = {
  1: { keyword: 'Independence', description: 'Structure and discipline don\'t come naturally — building them is your growth area.' },
  2: { keyword: 'Cooperation', description: 'Patience and partnership are skills to develop. Collaboration amplifies your power.' },
  3: { keyword: 'Expression', description: 'Creativity and self-expression need deliberate cultivation. Your voice matters.' },
  4: { keyword: 'Stability', description: 'Responsibility and commitment need conscious effort. Routines are your teacher.' },
  5: { keyword: 'Adaptability', description: 'Freedom, flexibility, and willingness to change are your growth opportunities.' },
  6: { keyword: 'Responsibility', description: 'Nurturing others and accepting duty develops your greatest strengths.' },
  7: { keyword: 'Inner Wisdom', description: 'Quiet reflection, spiritual depth, and trust in intuition are your karmic assignments.' },
  8: { keyword: 'Material Mastery', description: 'Financial wisdom and authority are growth areas — partially your strongest potential.' },
  9: { keyword: 'Compassion', description: 'Universal love, letting go, and serving others — your deepest growth frontier.' },
};

// ── Signature label names ────────────────────────────────────────────────────

export const SIGNATURE_LABELS = [
  'Life Path', 'Expression', 'Soul Urge', 'Personality', 'Maturity', 'Birthday',
] as const;

export const SIGNATURE_DESCRIPTIONS: Record<string, string> = {
  'Life Path': 'Your life\'s purpose and journey.',
  'Expression': 'Your natural talents and abilities.',
  'Soul Urge': 'Your inner desires and motivations.',
  'Personality': 'How others perceive you.',
  'Maturity': 'Your life\'s ultimate goal.',
  'Birthday': 'A special talent you possess.',
};

// ── Personal Year cycle position labels ──────────────────────────────────────

export const YEAR_CYCLE_LABELS: Record<number, string> = {
  1: 'Plant', 2: 'Nurture', 3: 'Create', 4: 'Build',
  5: 'Change', 6: 'Harmonize', 7: 'Reflect', 8: 'Harvest', 9: 'Release',
};

export function getMeaning(n: number): NumberMeaning {
  return NUMBER_MEANINGS[n] || NUMBER_MEANINGS[reduceToSingleForLookup(n)];
}

function reduceToSingleForLookup(n: number): number {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n).split('').reduce((s, d) => s + parseInt(d, 10), 0);
  }
  return n;
}
