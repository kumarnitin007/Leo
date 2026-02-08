// =====================================================
// REFERENCE CALENDARS: TypeScript Types
// =====================================================

export interface CalendarEnrichment {
  id: string;
  dayIdentifier: string;
  dayName: string;
  templateCategory: 'romantic' | 'celebration' | 'cultural' | 'awareness' | 'religious' | 'patriotic' | 'seasonal';
  primaryColor: string;
  secondaryColor: string;
  gradientStart: string;
  gradientEnd: string;
  iconEmoji: string;
  backgroundEmoji?: string;
  tagline?: string;
  originStory?: string;
  importancePercentage: number;
  isMajorHoliday: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CalendarFact {
  id: string;
  dayIdentifier: string;
  factType: string; // "fun_fact", "did_you_know", "tradition", "historical", "statistic"
  content: string;
  highlightValue?: string;
  priority: number;
  sourceName?: string;
  sourceUrl?: string;
  createdAt?: string;
}

export interface CalendarStatistic {
  id: string;
  dayIdentifier: string;
  statValue: string;
  statLabel: string;
  statIcon?: string;
  displayOrder: number;
  createdAt?: string;
}

export interface CalendarTip {
  id: string;
  dayIdentifier: string;
  tipType: string; // "pro_tip", "warning", "reminder", "planning", "money_saver"
  title: string;
  content: string;
  iconEmoji: string;
  urgencyLevel: number;
  daysBeforeToShow: number;
  createdAt?: string;
}

export interface CalendarTimelineItem {
  id: string;
  dayIdentifier: string;
  title: string;
  description: string;
  iconEmoji: string;
  daysBefore: number;
  displayOrder: number;
  createdAt?: string;
}

export interface CalendarQuickIdea {
  id: string;
  dayIdentifier: string;
  ideaLabel: string;
  ideaEmoji: string;
  ideaCategory?: string;
  displayOrder: number;
  createdAt?: string;
}

export interface CalendarExternalResource {
  id: string;
  dayIdentifier: string;
  resourceTitle: string;
  resourceDescription: string;
  resourceUrl: string;
  resourceType: string;
  iconEmoji: string;
  estimatedTime?: string;
  displayOrder: number;
  createdAt?: string;
}

export interface CalendarActionItem {
  id: string;
  dayIdentifier: string;
  actionType: string;
  actionLabel: string;
  actionIcon: string;
  actionTarget?: string;
  isPrimary: boolean;
  displayOrder: number;
  createdAt?: string;
}

export interface EnrichedCalendarDay {
  enrichment: CalendarEnrichment;
  facts: CalendarFact[];
  statistics: CalendarStatistic[];
  tips: CalendarTip[];
  timelineItems: CalendarTimelineItem[];
  quickIdeas: CalendarQuickIdea[];
  externalResources: CalendarExternalResource[];
  actionItems: CalendarActionItem[];
}
