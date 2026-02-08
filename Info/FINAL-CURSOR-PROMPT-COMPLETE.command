# 🎯 CURSOR PROMPT: Reference Calendars - Complete Implementation Guide

## 🎨 Overview
Build the "Reference Calendars" feature - transforming simple calendar events into rich, engaging experiences with facts, timelines, external resources, and beautiful UI. This mobile-first, responsive implementation uses a flexible template system that scales to 100+ holidays while maintaining a polished, consistent user experience across all devices.

**Feature Name**: Reference Calendars
**Priority**: Mobile-first design, fully responsive for desktop
**Core Value**: Turn calendar notifications into educational, actionable experiences

---

## 📱 Responsive Design Requirements

### Mobile-First Approach
This feature must work flawlessly on mobile devices (320px - 768px) and scale beautifully to desktop (769px+).

**Mobile (Primary)**
- Single column layout
- Touch-friendly tap targets (min 44px)
- Scrollable content within phone viewport
- Swipeable quick ideas
- Bottom sheet / modal presentation
- Native-feeling animations

**Tablet (768px - 1024px)**
- Can show side-by-side in landscape
- Larger touch targets
- More generous spacing

**Desktop (1024px+)**
- Modal overlay presentation
- Hover states and transitions
- Can show multiple cards for comparison
- Keyboard navigation support

**Key Responsive Breakpoints:**
```css
/* Mobile first - default styles are mobile */
@media (min-width: 768px) {
  /* Tablet adjustments */
}

@media (min-width: 1024px) {
  /* Desktop enhancements */
}
```

---

## 🏷️ Feature Branding: "Reference Calendars"

Throughout the implementation, use "Reference Calendars" as the feature name:

**Footer Text**: "📆 Reference Calendars" (not "US Cultural & Social Observances")
**API Routes**: `/api/calendar/reference/...` or `/api/reference-calendars/...`
**Component Names**: `ReferenceCalendarCard`, `ReferenceCalendarModal`
**User-Facing Text**: "Learn more about this day with Reference Calendars"
**Marketing Copy**: "Reference Calendars brings holidays to life with facts, timelines, and resources"

---

## 📊 Complete Database Schema (Redesigned)

### Core Table: `calendar_enrichments`
Stores the foundational theming and metadata for each special day.

```sql
CREATE TABLE calendar_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  day_identifier VARCHAR(100) NOT NULL UNIQUE, -- e.g., "valentines-day", "christmas"
  day_name VARCHAR(255) NOT NULL, -- "Valentine's Day"
  template_category VARCHAR(50) NOT NULL, -- "romantic", "celebration", "cultural", "awareness"
  
  -- Visual Theming
  primary_color VARCHAR(7) NOT NULL, -- #ff6b9d
  secondary_color VARCHAR(7) NOT NULL, -- #c94b7f
  gradient_start VARCHAR(7) NOT NULL,
  gradient_end VARCHAR(7) NOT NULL,
  icon_emoji VARCHAR(10) NOT NULL, -- 💕
  background_emoji VARCHAR(10), -- Optional decorative emoji for header
  
  -- Content
  tagline VARCHAR(255), -- "Celebrate love and affection"
  origin_story TEXT, -- Rich historical/cultural background
  
  -- Metadata
  importance_percentage INTEGER DEFAULT 50, -- 0-100, user perception
  is_major_holiday BOOLEAN DEFAULT false, -- Top tier holidays
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_day_identifier ON calendar_enrichments(day_identifier);
CREATE INDEX idx_template_category ON calendar_enrichments(template_category);
```

### Table: `calendar_facts`
Stores interesting facts, statistics, and trivia.

```sql
CREATE TABLE calendar_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_identifier VARCHAR(100) NOT NULL REFERENCES calendar_enrichments(day_identifier) ON DELETE CASCADE,
  
  fact_type VARCHAR(50) NOT NULL, -- "fun_fact", "did_you_know", "tradition", "historical"
  content TEXT NOT NULL,
  highlight_value VARCHAR(100), -- e.g., "$25.8 billion" - extracted for emphasis
  priority INTEGER DEFAULT 0, -- Higher priority = shown first
  
  source_name VARCHAR(255), -- "History.com", "Wikipedia"
  source_url TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_facts_day ON calendar_facts(day_identifier);
CREATE INDEX idx_facts_priority ON calendar_facts(day_identifier, priority DESC);
```

### Table: `calendar_statistics`
Stores numerical statistics for the "By The Numbers" section.

```sql
CREATE TABLE calendar_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_identifier VARCHAR(100) NOT NULL REFERENCES calendar_enrichments(day_identifier) ON DELETE CASCADE,
  
  stat_value VARCHAR(50) NOT NULL, -- "1B+", "$25.8B", "27%"
  stat_label TEXT NOT NULL, -- "Cards sent worldwide"
  icon_emoji VARCHAR(10), -- Optional emoji for the stat
  
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stats_day ON calendar_statistics(day_identifier, display_order);
```

### Table: `calendar_tips`
Stores actionable tips and advice.

```sql
CREATE TABLE calendar_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_identifier VARCHAR(100) NOT NULL REFERENCES calendar_enrichments(day_identifier) ON DELETE CASCADE,
  
  tip_type VARCHAR(50) NOT NULL, -- "pro_tip", "warning", "reminder", "planning", "money_saver"
  title VARCHAR(255) NOT NULL, -- "Don't Wait!"
  content TEXT NOT NULL,
  icon_emoji VARCHAR(10) NOT NULL, -- 🎯
  
  urgency_level INTEGER DEFAULT 1, -- 1-5, determines prominence
  days_before_to_show INTEGER DEFAULT 30, -- Show tip X days before event
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tips_day ON calendar_tips(day_identifier);
CREATE INDEX idx_tips_urgency ON calendar_tips(day_identifier, urgency_level DESC);
```

### Table: `calendar_timeline_items`
Stores recommended timeline/preparation checklist items.

```sql
CREATE TABLE calendar_timeline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_identifier VARCHAR(100) NOT NULL REFERENCES calendar_enrichments(day_identifier) ON DELETE CASCADE,
  
  title VARCHAR(255) NOT NULL, -- "Book Restaurant"
  description TEXT NOT NULL, -- "Popular spots filling fast"
  icon_emoji VARCHAR(10) NOT NULL, -- 📅
  
  days_before INTEGER NOT NULL, -- 7 = 7 days before the event
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_timeline_day ON calendar_timeline_items(day_identifier, display_order);
```

### Table: `calendar_quick_ideas`
Stores quick suggestion chips (gifts, activities, etc.).

```sql
CREATE TABLE calendar_quick_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_identifier VARCHAR(100) NOT NULL REFERENCES calendar_enrichments(day_identifier) ON DELETE CASCADE,
  
  idea_label VARCHAR(100) NOT NULL, -- "Flowers"
  idea_emoji VARCHAR(10) NOT NULL, -- 💐
  idea_category VARCHAR(50), -- "gift", "activity", "food", "experience"
  
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ideas_day ON calendar_quick_ideas(day_identifier, display_order);
```

### Table: `calendar_external_resources`
Stores links to external content (Wikipedia, YouTube, etc.).

```sql
CREATE TABLE calendar_external_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_identifier VARCHAR(100) NOT NULL REFERENCES calendar_enrichments(day_identifier) ON DELETE CASCADE,
  
  resource_title VARCHAR(255) NOT NULL, -- "History of Valentine's Day"
  resource_description VARCHAR(500) NOT NULL, -- "Wikipedia • Full historical context"
  resource_url TEXT NOT NULL,
  resource_type VARCHAR(50) NOT NULL, -- "wikipedia", "youtube", "article", "recipe", "pinterest"
  icon_emoji VARCHAR(10) NOT NULL, -- 📖
  
  estimated_time VARCHAR(50), -- "10 min read", "5 min video"
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_resources_day ON calendar_external_resources(day_identifier, display_order);
```

### Table: `calendar_action_items`
Stores action buttons (reminders, navigation, etc.).

```sql
CREATE TABLE calendar_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_identifier VARCHAR(100) NOT NULL REFERENCES calendar_enrichments(day_identifier) ON DELETE CASCADE,
  
  action_type VARCHAR(50) NOT NULL, -- "reminder", "gift_ideas", "restaurants", "shopping_list"
  action_label TEXT NOT NULL, -- "Set Dinner Reminder"
  action_icon VARCHAR(10) NOT NULL, -- 📅
  action_target TEXT, -- Deep link, route, or modal identifier
  
  is_primary BOOLEAN DEFAULT false, -- Primary button styling
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_actions_day ON calendar_action_items(day_identifier, display_order);
```

---

## 🎨 Sample Data - Valentine's Day (Complete)

```sql
-- Core enrichment
INSERT INTO calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'valentines-day', 
  'Valentine''s Day', 
  'romantic',
  '#ff6b9d', 
  '#c94b7f', 
  '#ff6b9d', 
  '#c94b7f',
  '💕', 
  '💝',
  'Celebrate love and affection',
  '$25.8 billion is spent on Valentine''s Day in the US annually. The tradition dates back to 3rd century Rome, honoring Saint Valentine who performed secret marriages for soldiers forbidden to wed.',
  85,
  true
);

-- Facts
INSERT INTO calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('valentines-day', 'statistic', 'Over 1 billion Valentine''s cards are exchanged worldwide every year, making it the second-largest card-sending holiday after Christmas.', '1 billion', 1, 'Hallmark', 'https://www.hallmark.com'),
('valentines-day', 'fun_fact', '27% of people buy Valentine''s Day gifts for their pets, spending an average of $12 per furry friend.', '27%', 2, 'National Retail Federation', NULL),
('valentines-day', 'tradition', 'In Victorian England, people sent "vinegar valentines" - cruel cards meant to reject unwanted suitors.', NULL, 3, 'History.com', 'https://www.history.com/topics/holidays/history-of-valentines-day-2'),
('valentines-day', 'historical', '220 million roses are grown just for Valentine''s Day each year, with red roses making up 73% of all flowers bought.', '220 million', 4, 'Society of American Florists', NULL);

-- Statistics
INSERT INTO calendar_statistics (day_identifier, stat_value, stat_label, icon_emoji, display_order) VALUES
('valentines-day', '1B+', 'Valentine''s cards sent worldwide', '💌', 1),
('valentines-day', '220M', 'Roses produced annually', '🌹', 2),
('valentines-day', '27%', 'Buy gifts for their pets', '🐾', 3),
('valentines-day', '2-3wk', 'Book restaurants ahead', '🍽️', 4);

-- Tips
INSERT INTO calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('valentines-day', 'pro_tip', 'Don''t Wait Until the Last Minute!', 'Popular restaurants are already 60% booked. Reserve your table or plan a creative at-home experience now to avoid disappointment.', '🎯', 5, 14),
('valentines-day', 'planning', 'Order Flowers Early', 'Florists see a 300% increase in orders during Valentine''s week. Order at least 3 days early to ensure availability and freshness.', '🌹', 4, 7),
('valentines-day', 'money_saver', 'Shop Post-Valentine Sales', 'Chocolate goes on sale Feb 15th at 50-75% off. Stock up for next year or enjoy the savings!', '💰', 2, 0);

-- Timeline items
INSERT INTO calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('valentines-day', 'Book Restaurant', 'Popular spots filling fast. Reserve your table now.', '📅', 7, 1),
('valentines-day', 'Order Flowers', 'Ensure freshness and availability with early order.', '🌹', 3, 2),
('valentines-day', 'Get Gift', 'Avoid last-minute stress with planned shopping.', '🎁', 2, 3),
('valentines-day', 'Plan Date Activities', 'Research movie times, events, or experiences.', '🎭', 5, 4);

-- Quick ideas
INSERT INTO calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('valentines-day', 'Flowers', '💐', 'gift', 1),
('valentines-day', 'Chocolates', '🍫', 'gift', 2),
('valentines-day', 'Jewelry', '💎', 'gift', 3),
('valentines-day', 'Experience', '🎭', 'activity', 4),
('valentines-day', 'Love Letter', '📝', 'gift', 5),
('valentines-day', 'Dinner Date', '🍽️', 'activity', 6),
('valentines-day', 'DIY Gift', '🎨', 'gift', 7);

-- External resources
INSERT INTO calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('valentines-day', 'History of Valentine''s Day', 'Wikipedia • Full historical context', 'https://en.wikipedia.org/wiki/Valentine%27s_Day', 'wikipedia', '📖', '5 min read', 1),
('valentines-day', 'DIY Gift Ideas', 'YouTube • Creative tutorials', 'https://www.youtube.com/results?search_query=valentine+diy+gift+ideas', 'youtube', '🎥', '10 min', 2),
('valentines-day', 'Romantic Recipes', 'Tasty • Cook together ideas', 'https://tasty.co/topic/valentines-day', 'recipe', '🍽️', '15 min', 3),
('valentines-day', 'Love Letter Templates', 'Pinterest • Inspiration & examples', 'https://www.pinterest.com/search/pins/?q=love%20letter%20ideas', 'pinterest', '💌', '3 min browse', 4);

-- Action items
INSERT INTO calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('valentines-day', 'reminder', 'Set Dinner Reminder', '📅', 'modal:create_reminder', true, 1),
('valentines-day', 'gift_ideas', 'Get Personalized Gift Ideas', '💡', 'route:/gift-ideas?occasion=valentines-day', false, 2),
('valentines-day', 'restaurants', 'Find Restaurants Nearby', '🍽️', 'route:/explore/restaurants?date=2026-02-14', false, 3);
```

---

## 🏗️ TypeScript Types & Interfaces

**File:** `src/types/calendar.ts`

```typescript
export interface CalendarEnrichment {
  id: string;
  dayIdentifier: string;
  dayName: string;
  templateCategory: 'romantic' | 'celebration' | 'cultural' | 'awareness';
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
}

export interface CalendarFact {
  id: string;
  factType: string;
  content: string;
  highlightValue?: string;
  priority: number;
  sourceName?: string;
  sourceUrl?: string;
}

export interface CalendarStatistic {
  id: string;
  statValue: string;
  statLabel: string;
  iconEmoji?: string;
  displayOrder: number;
}

export interface CalendarTip {
  id: string;
  tipType: string;
  title: string;
  content: string;
  iconEmoji: string;
  urgencyLevel: number;
  daysBeforeToShow: number;
}

export interface CalendarTimelineItem {
  id: string;
  title: string;
  description: string;
  iconEmoji: string;
  daysBefore: number;
  displayOrder: number;
}

export interface CalendarQuickIdea {
  id: string;
  ideaLabel: string;
  ideaEmoji: string;
  ideaCategory?: string;
  displayOrder: number;
}

export interface CalendarExternalResource {
  id: string;
  resourceTitle: string;
  resourceDescription: string;
  resourceUrl: string;
  resourceType: string;
  iconEmoji: string;
  estimatedTime?: string;
  displayOrder: number;
}

export interface CalendarActionItem {
  id: string;
  actionType: string;
  actionLabel: string;
  actionIcon: string;
  actionTarget?: string;
  isPrimary: boolean;
  displayOrder: number;
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
```

---

## 🔌 API Endpoint

**File:** `src/app/api/calendar/enriched/[dayIdentifier]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  calendarEnrichments, 
  calendarFacts, 
  calendarStatistics,
  calendarTips,
  calendarTimelineItems,
  calendarQuickIdeas,
  calendarExternalResources,
  calendarActionItems
} from '@/lib/db/schema';
import { eq, asc, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { dayIdentifier: string } }
) {
  try {
    const { dayIdentifier } = params;

    // Fetch enrichment data
    const enrichment = await db.query.calendarEnrichments.findFirst({
      where: eq(calendarEnrichments.dayIdentifier, dayIdentifier),
    });

    if (!enrichment) {
      return NextResponse.json(
        { error: 'Holiday not found' },
        { status: 404 }
      );
    }

    // Fetch all related data in parallel
    const [facts, statistics, tips, timelineItems, quickIdeas, externalResources, actionItems] = 
      await Promise.all([
        // Facts - ordered by priority
        db.query.calendarFacts.findMany({
          where: eq(calendarFacts.dayIdentifier, dayIdentifier),
          orderBy: [desc(calendarFacts.priority)],
          limit: 5, // Limit to top 5 facts
        }),

        // Statistics - ordered by display order
        db.query.calendarStatistics.findMany({
          where: eq(calendarStatistics.dayIdentifier, dayIdentifier),
          orderBy: [asc(calendarStatistics.displayOrder)],
        }),

        // Tips - ordered by urgency, filtered by days before
        db.query.calendarTips.findMany({
          where: eq(calendarTips.dayIdentifier, dayIdentifier),
          orderBy: [desc(calendarTips.urgencyLevel)],
          limit: 3, // Limit to top 3 tips
        }),

        // Timeline items - ordered by days before (descending), then display order
        db.query.calendarTimelineItems.findMany({
          where: eq(calendarTimelineItems.dayIdentifier, dayIdentifier),
          orderBy: [desc(calendarTimelineItems.daysBefore), asc(calendarTimelineItems.displayOrder)],
        }),

        // Quick ideas - ordered by display order
        db.query.calendarQuickIdeas.findMany({
          where: eq(calendarQuickIdeas.dayIdentifier, dayIdentifier),
          orderBy: [asc(calendarQuickIdeas.displayOrder)],
        }),

        // External resources - ordered by display order
        db.query.calendarExternalResources.findMany({
          where: eq(calendarExternalResources.dayIdentifier, dayIdentifier),
          orderBy: [asc(calendarExternalResources.displayOrder)],
          limit: 4, // Limit to 4 resources
        }),

        // Action items - primary first, then by display order
        db.query.calendarActionItems.findMany({
          where: eq(calendarActionItems.dayIdentifier, dayIdentifier),
          orderBy: [desc(calendarActionItems.isPrimary), asc(calendarActionItems.displayOrder)],
        }),
      ]);

    return NextResponse.json({
      enrichment,
      facts,
      statistics,
      tips,
      timelineItems,
      quickIdeas,
      externalResources,
      actionItems,
    });
  } catch (error) {
    console.error('Error fetching enriched calendar data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 🎨 React Component - Enhanced Calendar Card

**File:** `src/components/calendar/EnrichedCalendarCard.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { EnrichedCalendarDay } from '@/types/calendar';
import { ExternalLink, Clock, X } from 'lucide-react';

interface EnrichedCalendarCardProps {
  eventDate: Date;
  dayIdentifier: string;
  daysUntil: number;
  onClose?: () => void;
  onActionClick?: (actionType: string, actionTarget?: string) => void;
}

export function EnrichedCalendarCard({
  eventDate,
  dayIdentifier,
  daysUntil,
  onClose,
  onActionClick,
}: EnrichedCalendarCardProps) {
  const [data, setData] = useState<EnrichedCalendarDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(`/api/calendar/enriched/${dayIdentifier}`);
        
        if (!response.ok) {
          throw new Error('Failed to load holiday data');
        }
        
        const enrichedData = await response.json();
        setData(enrichedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [dayIdentifier]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return <ErrorCard error={error} />;
  }

  const { enrichment, facts, statistics, tips, timelineItems, quickIdeas, externalResources, actionItems } = data;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const getDaysUntilText = () => {
    if (daysUntil === 0) return 'TODAY';
    if (daysUntil === 1) return 'TOMORROW';
    return `IN ${daysUntil} DAY${daysUntil !== 1 ? 'S' : ''}`;
  };

  return (
    <div className="enriched-calendar-card">
      {/* Header with gradient background */}
      <div
        className="card-header"
        style={{
          background: `linear-gradient(135deg, ${enrichment.gradientStart} 0%, ${enrichment.gradientEnd} 100%)`,
        }}
      >
        {/* Close button */}
        {onClose && (
          <button onClick={onClose} className="close-btn" aria-label="Close">
            <X size={20} />
          </button>
        )}

        {/* Background decorative emoji */}
        {enrichment.backgroundEmoji && (
          <div className="bg-emoji" aria-hidden="true">
            {enrichment.backgroundEmoji}
          </div>
        )}

        {/* Countdown badge */}
        {daysUntil >= 0 && (
          <div className="countdown">
            <Clock size={14} />
            <span>{getDaysUntilText()}</span>
          </div>
        )}

        {/* Title section */}
        <h1 className="card-title">{enrichment.dayName}</h1>
        <p className="card-subtitle">{formatDate(eventDate)}</p>

        {/* Tags */}
        <div className="tags">
          <span className="tag category">{enrichment.templateCategory}</span>
          {enrichment.importancePercentage > 0 && (
            <span className="tag importance">
              {enrichment.importancePercentage}% Important
            </span>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="card-body">
        {/* Origin story / Did you know */}
        {enrichment.originStory && (
          <section className="section">
            <h2 className="section-title">💡 Did You Know?</h2>
            <div className="fun-fact">{enrichment.originStory}</div>
          </section>
        )}

        {/* Statistics grid */}
        {statistics.length > 0 && (
          <section className="section">
            <h2 className="section-title">📊 By The Numbers</h2>
            <div className="stats-grid">
              {statistics.map((stat) => (
                <div key={stat.id} className="stat-card">
                  <div className="stat-value">{stat.statValue}</div>
                  <div className="stat-label">{stat.statLabel}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Timeline / Recommended actions */}
        {timelineItems.length > 0 && (
          <section className="section">
            <h2 className="section-title">⏰ Recommended Timeline</h2>
            <div className="timeline">
              {timelineItems.map((item) => (
                <div key={item.id} className="timeline-item">
                  <div className="timeline-icon">{item.iconEmoji}</div>
                  <div className="timeline-content">
                    <h3 className="timeline-title">
                      {item.daysBefore > 0 ? `${item.daysBefore} Days Before - ` : 'On The Day - '}
                      {item.title}
                    </h3>
                    <p className="timeline-desc">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Pro tips */}
        {tips.length > 0 && (
          <section className="section">
            <h2 className="section-title">💡 Pro Tip</h2>
            <div className="tip-box">
              <div className="tip-icon">{tips[0].iconEmoji}</div>
              <div className="tip-content">
                <h3 className="tip-title">{tips[0].title}</h3>
                <p className="tip-text">{tips[0].content}</p>
              </div>
            </div>
          </section>
        )}

        {/* Quick ideas */}
        {quickIdeas.length > 0 && (
          <section className="section">
            <h2 className="section-title">🎁 Quick Ideas</h2>
            <div className="quick-ideas">
              {quickIdeas.map((idea) => (
                <button key={idea.id} className="idea-chip">
                  {idea.ideaEmoji} {idea.ideaLabel}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* External resources */}
        {externalResources.length > 0 && (
          <section className="section">
            <h2 className="section-title">🔗 Learn More</h2>
            <div className="resources-section">
              {externalResources.map((resource) => (
                <a
                  key={resource.id}
                  href={resource.resourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="resource-link"
                >
                  <div className="resource-icon">{resource.iconEmoji}</div>
                  <div className="resource-content">
                    <h3 className="resource-title">{resource.resourceTitle}</h3>
                    <p className="resource-desc">{resource.resourceDescription}</p>
                  </div>
                  <ExternalLink size={18} className="external-arrow" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Action buttons */}
        {actionItems.length > 0 && (
          <section className="section action-buttons">
            {actionItems.map((action) => (
              <button
                key={action.id}
                onClick={() => onActionClick?.(action.actionType, action.actionTarget)}
                className={`action-btn ${action.isPrimary ? 'primary' : 'secondary'}`}
              >
                {action.actionIcon} {action.actionLabel}
              </button>
            ))}
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="card-footer">
        📆 US Cultural & Social Observances
      </div>
    </div>
  );
}

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="enriched-calendar-card skeleton">
      <div className="skeleton-header" />
      <div className="skeleton-body">
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-grid" />
      </div>
    </div>
  );
}

// Error card component
function ErrorCard({ error }: { error: string | null }) {
  return (
    <div className="enriched-calendar-card error">
      <p>Unable to load holiday details</p>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}
```

---

## 🎨 Styling (Mobile-First + Responsive)

**File:** `src/components/calendar/EnrichedCalendarCard.module.css`

```css
/* ============================================
   MOBILE-FIRST STYLES (Default: 320px+)
   ============================================ */

/* Card Container */
.enriched-calendar-card {
  background: white;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 100%; /* Mobile takes full width */
  margin: 0 auto;
}

/* Header */
.card-header {
  padding: 24px 20px; /* Smaller padding on mobile */
  position: relative;
  color: white;
  overflow: hidden;
}

.bg-emoji {
  position: absolute;
  font-size: 100px; /* Smaller on mobile */
  opacity: 0.12;
  right: -20px;
  top: -25px;
  transform: rotate(15deg);
  pointer-events: none;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 44px; /* Touch-friendly size */
  height: 44px;
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(10px);
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  z-index: 10;
  transition: background 0.2s;
  -webkit-tap-highlight-color: transparent; /* Remove tap highlight on mobile */
}

.close-btn:hover,
.close-btn:active {
  background: rgba(255, 255, 255, 0.35);
}

.countdown {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(10px);
  border-radius: 14px;
  padding: 8px 16px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.card-title {
  font-size: 28px; /* Smaller on mobile */
  font-weight: 800;
  margin: 0 0 8px 0;
  line-height: 1.2;
}

.card-subtitle {
  font-size: 15px;
  opacity: 0.95;
  margin: 0 0 12px 0;
}

.tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.tag.category {
  background: rgba(255, 255, 255, 0.3);
}

.tag.importance {
  background: #ffd700;
  color: #8b4513;
}

/* Body */
.card-body {
  padding: 20px; /* Smaller padding on mobile */
}

.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 15px;
  font-weight: 800;
  color: #1a1a1a;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Fun Fact */
.fun-fact {
  background: linear-gradient(135deg, #fff5f7 0%, #ffe8ed 100%);
  border-left: 4px solid var(--primary-color, #ff6b9d);
  padding: 14px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.7;
  color: #2d2d2d;
}

/* Statistics Grid */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.stat-card {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  border: 1px solid #dee2e6;
  transition: transform 0.2s;
}

.stat-card:active {
  transform: scale(0.98);
}

.stat-value {
  font-size: 22px; /* Smaller on mobile */
  font-weight: 900;
  background: linear-gradient(135deg, var(--primary-color, #ff6b9d) 0%, var(--secondary-color, #c94b7f) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 11px;
  color: #495057;
  line-height: 1.4;
  font-weight: 500;
}

/* Timeline */
.timeline {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 14px;
}

.timeline-item {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #dee2e6;
}

.timeline-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.timeline-icon {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, var(--primary-color, #ff6b9d) 0%, var(--secondary-color, #c94b7f) 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.timeline-title {
  font-weight: 700;
  font-size: 13px;
  color: #2d2d2d;
  margin-bottom: 3px;
}

.timeline-desc {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

/* Tip Box */
.tip-box {
  background: linear-gradient(135deg, #fff9e6 0%, #ffeb99 100%);
  border: 2px solid #ffd700;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  gap: 12px;
  align-items: start;
}

.tip-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.tip-title {
  font-weight: 700;
  color: #996b00;
  margin-bottom: 4px;
  font-size: 14px;
}

.tip-text {
  font-size: 13px;
  color: #665500;
  line-height: 1.6;
}

/* Quick Ideas - Horizontal Scroll on Mobile */
.quick-ideas {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 8px 0;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
}

.quick-ideas::-webkit-scrollbar {
  display: none;
}

.idea-chip {
  background: white;
  border: 2px solid #e0e0e0;
  padding: 10px 16px;
  border-radius: 24px;
  font-size: 13px;
  white-space: nowrap;
  color: #555;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 600;
  -webkit-tap-highlight-color: transparent;
  min-width: fit-content; /* Prevents shrinking */
}

.idea-chip:active {
  border-color: var(--primary-color, #ff6b9d);
  color: var(--primary-color, #ff6b9d);
  background: #fff5f7;
  transform: scale(0.98);
}

/* External Resources */
.resources-section {
  background: linear-gradient(135deg, #e7f5ff 0%, #d0ebff 100%);
  border: 2px solid #74c0fc;
  border-radius: 12px;
  padding: 14px;
}

.resource-link {
  background: white;
  border: 1px solid #74c0fc;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: #1971c2;
  transition: all 0.2s;
  margin-bottom: 8px;
  -webkit-tap-highlight-color: transparent;
  min-height: 60px; /* Touch-friendly */
}

.resource-link:last-child {
  margin-bottom: 0;
}

.resource-link:active {
  background: #f8f9fa;
  border-color: #4dabf7;
  transform: scale(0.98);
}

.resource-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.resource-title {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 2px;
}

.resource-desc {
  font-size: 11px;
  color: #495057;
}

.external-arrow {
  color: #74c0fc;
  margin-left: auto;
  font-size: 16px;
}

/* Action Buttons - Touch Optimized */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-btn {
  border: none;
  padding: 16px; /* Larger touch target */
  border-radius: 14px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
  min-height: 52px; /* Accessible touch target */
}

.action-btn.primary {
  background: linear-gradient(135deg, var(--primary-color, #ff6b9d) 0%, var(--secondary-color, #c94b7f) 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(255, 107, 157, 0.3);
}

.action-btn.primary:active {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(255, 107, 157, 0.3);
}

.action-btn.secondary {
  background: white;
  color: var(--primary-color, #ff6b9d);
  border: 2px solid var(--primary-color, #ff6b9d);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.action-btn.secondary:active {
  background: #fff5f7;
  transform: scale(0.98);
}

/* Footer */
.card-footer {
  text-align: center;
  padding: 14px;
  background: #f8f9fa;
  color: #adb5bd;
  font-size: 12px;
  border-top: 1px solid #e9ecef;
}

/* Loading skeleton */
.skeleton-header {
  height: 160px;
  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

.skeleton-body {
  padding: 20px;
}

.skeleton-line {
  height: 16px;
  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  border-radius: 4px;
  margin-bottom: 10px;
  animation: shimmer 2s infinite;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  height: 80px;
  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  border-radius: 8px;
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* ============================================
   TABLET (768px+)
   ============================================ */
@media (min-width: 768px) {
  .enriched-calendar-card {
    max-width: 500px;
  }

  .card-header {
    padding: 28px 24px;
  }

  .card-body {
    padding: 24px;
  }

  .bg-emoji {
    font-size: 120px;
  }

  .card-title {
    font-size: 32px;
  }

  .card-subtitle {
    font-size: 16px;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.35);
  }

  .idea-chip:hover {
    border-color: var(--primary-color, #ff6b9d);
    color: var(--primary-color, #ff6b9d);
    background: #fff5f7;
    transform: scale(1.05);
  }

  .resource-link:hover {
    background: #f8f9fa;
    border-color: #4dabf7;
    transform: translateX(4px);
  }

  .stat-card:hover {
    transform: translateY(-2px);
  }

  .action-btn.primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(255, 107, 157, 0.4);
  }

  .action-btn.secondary:hover {
    background: #fff5f7;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }
}

/* ============================================
   DESKTOP (1024px+)
   ============================================ */
@media (min-width: 1024px) {
  .enriched-calendar-card {
    max-width: 480px;
  }

  .bg-emoji {
    font-size: 140px;
  }

  .card-title {
    font-size: 34px;
  }

  .stat-value {
    font-size: 26px;
  }

  .timeline-icon {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }

  .tip-icon {
    font-size: 28px;
  }

  .quick-ideas {
    flex-wrap: wrap; /* Allow wrapping on desktop */
    overflow-x: visible;
  }
}

/* ============================================
   ACCESSIBILITY
   ============================================ */

/* Focus states for keyboard navigation */
.action-btn:focus-visible,
.close-btn:focus-visible,
.idea-chip:focus-visible,
.resource-link:focus-visible {
  outline: 3px solid var(--primary-color, #ff6b9d);
  outline-offset: 2px;
}

/* Reduced motion for users who prefer it */
@media (prefers-reduced-motion: reduce) {
  .countdown,
  .action-btn,
  .stat-card,
  .idea-chip {
    animation: none;
    transition: none;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .stat-card,
  .timeline,
  .tip-box,
  .resources-section {
    border: 2px solid currentColor;
  }
}
```

---

## 🛠️ Utility Functions

**File:** `src/lib/calendar/dayIdentifierMapper.ts`

```typescript
/**
 * Maps calendar event names to standardized day identifiers
 */
export function getDayIdentifier(eventName: string): string | null {
  const identifierMap: Record<string, string> = {
    "Valentine's Day": 'valentines-day',
    "Christmas": 'christmas',
    "Christmas Eve": 'christmas-eve',
    "New Year's Day": 'new-years-day',
    "New Year's Eve": 'new-years-eve',
    "Independence Day": 'independence-day',
    "Thanksgiving": 'thanksgiving',
    "Halloween": 'halloween',
    "Easter": 'easter',
    "Mother's Day": 'mothers-day',
    "Father's Day": 'fathers-day',
    "Memorial Day": 'memorial-day',
    "Labor Day": 'labor-day',
    "Veterans Day": 'veterans-day',
    "Martin Luther King Jr. Day": 'mlk-day',
    "Presidents' Day": 'presidents-day',
    "Earth Day": 'earth-day',
    "St. Patrick's Day": 'st-patricks-day',
    "Cinco de Mayo": 'cinco-de-mayo',
    // Add more as needed
  };
  
  return identifierMap[eventName] || null;
}

/**
 * Calculates days until a given date
 */
export function calculateDaysUntil(targetDate: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}
```

**File:** `src/lib/calendar/actionHandler.ts`

```typescript
import { useRouter } from 'next/navigation';

export function useCalendarActions() {
  const router = useRouter();

  const handleAction = (actionType: string, actionTarget?: string) => {
    // Parse the action target
    if (!actionTarget) {
      console.warn('No action target specified');
      return;
    }

    const [targetType, targetValue] = actionTarget.split(':');

    switch (targetType) {
      case 'modal':
        // Open a modal (implement your modal system)
        openModal(targetValue);
        break;

      case 'route':
        // Navigate to a route
        router.push(targetValue);
        break;

      case 'external':
        // Open external link
        window.open(targetValue, '_blank', 'noopener,noreferrer');
        break;

      default:
        console.warn('Unknown action target type:', targetType);
    }
  };

  return { handleAction };
}

// Modal handler (implement based on your modal system)
function openModal(modalId: string) {
  // Example implementation
  switch (modalId) {
    case 'create_reminder':
      // Open reminder creation modal
      console.log('Opening reminder modal');
      break;

    default:
      console.warn('Unknown modal:', modalId);
  }
}
```

---

## 🔄 Integration with Existing Calendar

**File:** `src/app/(app)/home/page.tsx` or wherever your calendar events are displayed

```typescript
'use client';

import { EnrichedCalendarCard } from '@/components/calendar/EnrichedCalendarCard';
import { getDayIdentifier, calculateDaysUntil } from '@/lib/calendar/dayIdentifierMapper';
import { useCalendarActions } from '@/lib/calendar/actionHandler';
import { useState } from 'react';

export default function HomePage() {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const { handleAction } = useCalendarActions();

  // Your existing calendar events
  const upcomingEvents = [
    {
      id: '1',
      name: "Valentine's Day",
      date: new Date('2026-02-14'),
      importance: 85,
    },
    // ... more events
  ];

  return (
    <div>
      {/* Existing UI */}
      
      {/* Calendar events list */}
      {upcomingEvents.map((event) => {
        const dayIdentifier = getDayIdentifier(event.name);
        const daysUntil = calculateDaysUntil(event.date);

        // If event has enrichment data, show enhanced card
        if (dayIdentifier) {
          return (
            <div key={event.id} onClick={() => setSelectedEvent(event)}>
              {/* Your existing event card - clickable */}
              <div className="event-preview">
                {event.name} - {daysUntil} days
              </div>
            </div>
          );
        }

        // Otherwise, show basic card
        return (
          <div key={event.id}>
            <BasicEventCard event={event} />
          </div>
        );
      })}

      {/* Modal/Overlay for detailed view */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEvent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <EnrichedCalendarCard
              eventDate={selectedEvent.date}
              dayIdentifier={getDayIdentifier(selectedEvent.name)!}
              daysUntil={calculateDaysUntil(selectedEvent.date)}
              onClose={() => setSelectedEvent(null)}
              onActionClick={handleAction}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 📝 Data Seeding Script

**File:** `src/scripts/seedCalendarEnrichments.ts`

```typescript
import { db } from '@/lib/db';
import { 
  calendarEnrichments, 
  calendarFacts, 
  calendarStatistics,
  // ... other tables
} from '@/lib/db/schema';

interface HolidayData {
  identifier: string;
  name: string;
  category: string;
  colors: {
    primary: string;
    secondary: string;
    gradientStart: string;
    gradientEnd: string;
  };
  emoji: string;
  backgroundEmoji?: string;
  tagline: string;
  originStory: string;
  importance: number;
  isMajor: boolean;
  facts: Array<{
    type: string;
    content: string;
    highlightValue?: string;
    priority: number;
  }>;
  statistics: Array<{
    value: string;
    label: string;
    emoji?: string;
    order: number;
  }>;
  // ... more data structures
}

const holidayDataset: HolidayData[] = [
  {
    identifier: 'christmas',
    name: 'Christmas',
    category: 'celebration',
    colors: {
      primary: '#c41e3a',
      secondary: '#165b33',
      gradientStart: '#c41e3a',
      gradientEnd: '#165b33',
    },
    emoji: '🎄',
    backgroundEmoji: '🎅',
    tagline: 'Season of joy and giving',
    originStory: 'Christmas celebrates the birth of Jesus Christ. The modern Christmas tree tradition began in Germany in the 16th century. Over $1 trillion is spent globally on Christmas celebrations.',
    importance: 95,
    isMajor: true,
    facts: [
      {
        type: 'tradition',
        content: 'The modern Christmas tree tradition originated in 16th-century Germany, where Christians brought decorated trees into their homes.',
        priority: 1,
      },
      // ... more facts
    ],
    statistics: [
      { value: '$1T+', label: 'Global spending', emoji: '💰', order: 1 },
      { value: '160M', label: 'Trees sold (US)', emoji: '🎄', order: 2 },
      // ... more stats
    ],
    // ... more sections
  },
  // Add more holidays...
];

async function seedHolidayData(holiday: HolidayData) {
  try {
    // Insert enrichment
    await db.insert(calendarEnrichments).values({
      dayIdentifier: holiday.identifier,
      dayName: holiday.name,
      templateCategory: holiday.category,
      primaryColor: holiday.colors.primary,
      secondaryColor: holiday.colors.secondary,
      gradientStart: holiday.colors.gradientStart,
      gradientEnd: holiday.colors.gradientEnd,
      iconEmoji: holiday.emoji,
      backgroundEmoji: holiday.backgroundEmoji,
      tagline: holiday.tagline,
      originStory: holiday.originStory,
      importancePercentage: holiday.importance,
      isMajorHoliday: holiday.isMajor,
    });

    // Insert facts
    for (const fact of holiday.facts) {
      await db.insert(calendarFacts).values({
        dayIdentifier: holiday.identifier,
        factType: fact.type,
        content: fact.content,
        highlightValue: fact.highlightValue,
        priority: fact.priority,
      });
    }

    // Insert statistics
    for (const stat of holiday.statistics) {
      await db.insert(calendarStatistics).values({
        dayIdentifier: holiday.identifier,
        statValue: stat.value,
        statLabel: stat.label,
        iconEmoji: stat.emoji,
        displayOrder: stat.order,
      });
    }

    // ... insert other data types

    console.log(`✅ Seeded: ${holiday.name}`);
  } catch (error) {
    console.error(`❌ Error seeding ${holiday.name}:`, error);
  }
}

async function seedAllHolidays() {
  console.log('🌱 Starting holiday data seed...');
  
  for (const holiday of holidayDataset) {
    await seedHolidayData(holiday);
  }
  
  console.log('✅ Seeding complete!');
}

// Run the seed
seedAllHolidays();
```

---

## ✅ Implementation Checklist

### Phase 1: Database Setup
- [ ] Run database migrations for all 8 tables
- [ ] Verify table creation and indexes
- [ ] Seed Valentine's Day sample data
- [ ] Test API endpoint with sample data

### Phase 2: Component Development
- [ ] Create TypeScript types
- [ ] Build API route handler
- [ ] Develop EnrichedCalendarCard component
- [ ] Add CSS styling (responsive)
- [ ] Implement loading and error states

### Phase 3: Integration
- [ ] Create day identifier mapper
- [ ] Build action handler system
- [ ] Integrate with existing calendar view
- [ ] Add modal/overlay for card display
- [ ] Test user interactions

### Phase 4: Content Creation
- [ ] Seed 10-15 major holidays
- [ ] Add external resource links
- [ ] Test all data displays correctly
- [ ] Verify timeline calculations

### Phase 5: Polish & Testing
- [ ] Mobile responsive testing
- [ ] Cross-browser testing
- [ ] Performance optimization (caching)
- [ ] Analytics tracking setup
- [ ] User feedback collection

---

## 🎯 Success Metrics

Track these metrics to measure engagement:

1. **Card Open Rate**: % of users who click to view enriched cards
2. **Action Button Clicks**: Which actions users take most
3. **External Link Clicks**: Which resources users explore
4. **Time Spent**: Average time viewing each card
5. **Repeat Views**: Users coming back to view cards multiple times

---

## 🚀 Future Enhancements

### Phase 2 Features:
1. **Personalization**: AI-generated gift suggestions based on user preferences
2. **Location Services**: Nearby restaurant/event recommendations
3. **Reminders**: Automatic reminder creation from timeline items
4. **Shopping Integration**: Direct links to gift marketplaces
5. **Social Sharing**: Share holiday cards with friends
6. **Multi-language**: Support for international holidays
7. **User Contributions**: Allow users to add their own traditions/tips

### Technical Improvements:
1. **Caching**: Redis cache for frequently accessed holidays
2. **CDN**: Image optimization for faster loading
3. **A/B Testing**: Test different card layouts/content
4. **Analytics Dashboard**: Admin view of engagement metrics
5. **Content CMS**: UI for non-technical team to add holidays

---

## 📚 Additional Resources

- **Design Inspiration**: Behance, Dribbble holiday card designs
- **Content Sources**: Wikipedia, History.com, National Today
- **External APIs**: Google Places (restaurants), YouTube Data API
- **Analytics**: Mixpanel, Amplitude for user behavior tracking

---

## 🎉 Final Notes

This implementation provides:
- ✅ **Scalable**: Add 100+ holidays with just database entries
- ✅ **Engaging**: Rich content keeps users interested
- ✅ **Actionable**: Direct paths to useful actions
- ✅ **Beautiful**: Polished UI with dynamic theming
- ✅ **Maintainable**: Template-based system is easy to update

The template system means you'll spend 5 minutes adding a new holiday (just database rows) instead of hours building custom UI. Content updates don't require deployments - just database changes!

Good luck with your implementation! 🚀
