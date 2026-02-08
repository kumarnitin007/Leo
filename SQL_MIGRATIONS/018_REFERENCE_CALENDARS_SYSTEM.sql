-- =====================================================
-- REFERENCE CALENDARS: Complete System
-- =====================================================
-- Creates tables for enriched calendar/holiday data
-- with template-based rendering system
-- =====================================================

-- ============================================================================
-- TABLE 1: calendar_enrichments (Core metadata and theming)
-- ============================================================================

CREATE TABLE IF NOT EXISTS myday_calendar_enrichments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  day_identifier TEXT NOT NULL UNIQUE,
  day_name TEXT NOT NULL,
  template_category TEXT NOT NULL CHECK (template_category IN ('romantic', 'celebration', 'cultural', 'awareness', 'religious', 'patriotic', 'seasonal')),
  
  -- Visual Theming
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  gradient_start TEXT NOT NULL,
  gradient_end TEXT NOT NULL,
  icon_emoji TEXT NOT NULL,
  background_emoji TEXT,
  
  -- Content
  tagline TEXT,
  origin_story TEXT,
  
  -- Metadata
  importance_percentage INTEGER DEFAULT 50 CHECK (importance_percentage >= 0 AND importance_percentage <= 100),
  is_major_holiday BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_enrichments_day_identifier ON myday_calendar_enrichments(day_identifier);
CREATE INDEX IF NOT EXISTS idx_calendar_enrichments_template_category ON myday_calendar_enrichments(template_category);
CREATE INDEX IF NOT EXISTS idx_calendar_enrichments_is_major ON myday_calendar_enrichments(is_major_holiday);

-- ============================================================================
-- TABLE 2: calendar_facts (Interesting facts and trivia)
-- ============================================================================

CREATE TABLE IF NOT EXISTS myday_calendar_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_identifier TEXT NOT NULL REFERENCES myday_calendar_enrichments(day_identifier) ON DELETE CASCADE,
  
  fact_type TEXT NOT NULL, -- "fun_fact", "did_you_know", "tradition", "historical", "statistic"
  content TEXT NOT NULL,
  highlight_value TEXT, -- e.g., "$25.8 billion" - extracted for emphasis
  priority INTEGER DEFAULT 0, -- Higher priority = shown first
  source_name TEXT,
  source_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_facts_day ON myday_calendar_facts(day_identifier);
CREATE INDEX IF NOT EXISTS idx_calendar_facts_priority ON myday_calendar_facts(day_identifier, priority DESC);

-- ============================================================================
-- TABLE 3: calendar_statistics (Key numbers and data points)
-- ============================================================================

CREATE TABLE IF NOT EXISTS myday_calendar_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_identifier TEXT NOT NULL REFERENCES myday_calendar_enrichments(day_identifier) ON DELETE CASCADE,
  
  stat_value TEXT NOT NULL, -- "145M", "$21B", "54%"
  stat_label TEXT NOT NULL, -- "greeting cards sold", "total spending"
  stat_icon TEXT, -- 📊, 💰, 🎁
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_statistics_day ON myday_calendar_statistics(day_identifier, display_order);

-- ============================================================================
-- TABLE 4: calendar_tips (Actionable advice and suggestions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS myday_calendar_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_identifier TEXT NOT NULL REFERENCES myday_calendar_enrichments(day_identifier) ON DELETE CASCADE,
  
  tip_type TEXT NOT NULL, -- "pro_tip", "warning", "reminder", "planning", "money_saver"
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  icon_emoji TEXT NOT NULL,
  urgency_level INTEGER DEFAULT 1 CHECK (urgency_level >= 1 AND urgency_level <= 5),
  days_before_to_show INTEGER DEFAULT 30,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_tips_day ON myday_calendar_tips(day_identifier);
CREATE INDEX IF NOT EXISTS idx_calendar_tips_urgency ON myday_calendar_tips(day_identifier, urgency_level DESC);

-- ============================================================================
-- TABLE 5: calendar_timeline_items (Preparation checklist)
-- ============================================================================

CREATE TABLE IF NOT EXISTS myday_calendar_timeline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_identifier TEXT NOT NULL REFERENCES myday_calendar_enrichments(day_identifier) ON DELETE CASCADE,
  
  title TEXT NOT NULL, -- "Book Restaurant"
  description TEXT NOT NULL, -- "Popular spots filling fast"
  icon_emoji TEXT NOT NULL, -- 📅
  days_before INTEGER NOT NULL, -- 7 = 7 days before event
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_timeline_day ON myday_calendar_timeline_items(day_identifier, display_order);

-- ============================================================================
-- TABLE 6: calendar_quick_ideas (Swipeable activity suggestions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS myday_calendar_quick_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_identifier TEXT NOT NULL REFERENCES myday_calendar_enrichments(day_identifier) ON DELETE CASCADE,
  
  idea_label TEXT NOT NULL, -- "Flowers"
  idea_emoji TEXT NOT NULL, -- 💐
  idea_category TEXT, -- "gift", "activity", "food", "experience"
  
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_quick_ideas_day ON myday_calendar_quick_ideas(day_identifier, display_order);

-- ============================================================================
-- TABLE 7: calendar_external_resources (Links and references)
-- ============================================================================

CREATE TABLE IF NOT EXISTS myday_calendar_external_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_identifier TEXT NOT NULL REFERENCES myday_calendar_enrichments(day_identifier) ON DELETE CASCADE,
  
  resource_title TEXT NOT NULL,
  resource_description TEXT,
  resource_url TEXT NOT NULL,
  resource_type TEXT, -- "article", "video", "recipe", "guide", "shop"
  icon_emoji TEXT, -- 📖, 🎥, 🍳
  estimated_time TEXT, -- "5 min read", "15 min watch"
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_resources_day ON myday_calendar_external_resources(day_identifier, display_order);

-- ============================================================================
-- TABLE 8: calendar_action_items (Quick action buttons)
-- ============================================================================

CREATE TABLE IF NOT EXISTS myday_calendar_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_identifier TEXT NOT NULL REFERENCES myday_calendar_enrichments(day_identifier) ON DELETE CASCADE,
  
  action_type TEXT NOT NULL, -- "create_event", "create_reminder", "create_todo", "share"
  action_label TEXT NOT NULL, -- "Add to Calendar", "Set Reminder"
  action_icon TEXT, -- 📅, ⏰, 📝
  action_target TEXT, -- Optional: specific data for the action
  is_primary BOOLEAN DEFAULT false, -- Highlight as primary CTA
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_actions_day ON myday_calendar_action_items(day_identifier, is_primary DESC, display_order);

-- ============================================================================
-- ENABLE RLS ON ALL TABLES (Public read access)
-- ============================================================================

ALTER TABLE myday_calendar_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_calendar_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_calendar_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_calendar_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_calendar_timeline_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_calendar_quick_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_calendar_external_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE myday_calendar_action_items ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read calendar data
CREATE POLICY "Anyone can view calendar enrichments"
  ON myday_calendar_enrichments FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view calendar facts"
  ON myday_calendar_facts FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view calendar statistics"
  ON myday_calendar_statistics FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view calendar tips"
  ON myday_calendar_tips FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view calendar timeline"
  ON myday_calendar_timeline_items FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view calendar quick ideas"
  ON myday_calendar_quick_ideas FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view calendar resources"
  ON myday_calendar_external_resources FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view calendar actions"
  ON myday_calendar_action_items FOR SELECT
  USING (true);

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Reference Calendars system created successfully';
  RAISE NOTICE '📊 8 tables created with indexes and RLS policies';
END $$;
