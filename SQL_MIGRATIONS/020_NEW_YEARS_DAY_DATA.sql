-- =====================================================
-- REFERENCE CALENDARS: New Year's Day Data
-- =====================================================

-- ============================================================================
-- CORE ENRICHMENT
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'new-years-day', 
  'New Year''s Day', 
  'celebration',
  '#FFD700', 
  '#FFA500', 
  '#FFD700', 
  '#FFA500',
  '🎆', 
  '🎉',
  'Celebrate new beginnings and fresh starts',
  'New Year''s Day marks the first day of the Gregorian calendar year. The tradition of celebrating January 1st dates back to 46 B.C. when Julius Caesar introduced the Julian calendar. Americans spend over $4 billion on New Year''s Eve celebrations, making it one of the most celebrated holidays worldwide.',
  95,
  true
);

-- ============================================================================
-- FACTS
-- ============================================================================

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('new-years-day', 'statistic', 'Over 1 million people gather in Times Square, New York City, to watch the famous ball drop at midnight.', '1 million', 10, 'Times Square Alliance', 'https://www.timessquarenyc.org'),
('new-years-day', 'fun_fact', 'The tradition of making New Year''s resolutions dates back 4,000 years to ancient Babylon, where people made promises to their gods.', '4,000 years', 9, 'History.com', 'https://www.history.com'),
('new-years-day', 'tradition', 'Eating 12 grapes at midnight is a Spanish tradition believed to bring good luck for each month of the coming year.', NULL, 8, 'Spanish Culture', NULL),
('new-years-day', 'historical', 'The Times Square ball drop tradition began in 1907 and has only been cancelled twice - in 1942 and 1943 during World War II.', '1907', 7, 'Times Square NYC', NULL),
('new-years-day', 'did_you_know', 'An estimated 360 million glasses of champagne are consumed in the United States on New Year''s Eve.', '360 million', 6, 'Wine Institute', NULL);

-- ============================================================================
-- STATISTICS (By The Numbers)
-- ============================================================================

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('new-years-day', '1M+', 'People in Times Square', '🗽', 1),
('new-years-day', '$4B', 'Spent on celebrations', '💰', 2),
('new-years-day', '45%', 'Make resolutions', '📝', 3),
('new-years-day', '360M', 'Glasses of champagne', '🍾', 4);

-- ============================================================================
-- TIPS (Actionable Advice)
-- ============================================================================

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('new-years-day', 'pro_tip', 'Plan Your Resolutions Early', 'Research shows that people who write down their resolutions are 42% more likely to achieve them. Start planning now!', '🎯', 5, 7),
('new-years-day', 'planning', 'Book Celebrations in Advance', 'Popular restaurants and venues are already 80% booked for New Year''s Eve. Make reservations at least 2 weeks ahead.', '🍽️', 4, 14),
('new-years-day', 'money_saver', 'Stay Safe - Plan Transportation', 'Arrange designated drivers or ride-sharing in advance. New Year''s Eve sees a 300% increase in DUI arrests.', '🚗', 5, 3),
('new-years-day', 'reminder', 'Reflect on the Past Year', 'Take time to journal about your accomplishments and lessons learned. This helps set meaningful goals for the new year.', '📔', 3, 1);

-- ============================================================================
-- TIMELINE (Preparation Checklist)
-- ============================================================================

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('new-years-day', 'Make Reservations', 'Book restaurant or party venue before they fill up.', '📅', 14, 1),
('new-years-day', 'Plan Resolutions', 'Write down 3-5 specific, achievable goals for the new year.', '📝', 7, 2),
('new-years-day', 'Arrange Transportation', 'Book ride-sharing or designate a driver for safety.', '🚗', 3, 3),
('new-years-day', 'Prepare Celebration', 'Get decorations, party supplies, and champagne.', '🎉', 2, 4),
('new-years-day', 'Set Intentions', 'Reflect on the past year and visualize your goals.', '🧘', 1, 5);

-- ============================================================================
-- QUICK IDEAS (Swipeable Chips)
-- ============================================================================

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('new-years-day', 'Watch Fireworks', '🎆', 'activity', 1),
('new-years-day', 'Champagne Toast', '🍾', 'activity', 2),
('new-years-day', 'Resolution Journal', '📔', 'activity', 3),
('new-years-day', 'Party at Home', '🏠', 'activity', 4),
('new-years-day', 'Times Square Stream', '📺', 'activity', 5),
('new-years-day', 'Vision Board', '🎨', 'activity', 6),
('new-years-day', 'Midnight Kiss', '💋', 'activity', 7),
('new-years-day', 'Goal Setting', '🎯', 'activity', 8);

-- ============================================================================
-- EXTERNAL RESOURCES (Links)
-- ============================================================================

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('new-years-day', 'History of New Year''s', 'Wikipedia • Full historical context', 'https://en.wikipedia.org/wiki/New_Year%27s_Day', 'wikipedia', '📖', '5 min read', 1),
('new-years-day', 'Resolution Success Tips', 'YouTube • Science-backed strategies', 'https://www.youtube.com/results?search_query=how+to+keep+new+year+resolutions', 'youtube', '🎥', '10 min', 2),
('new-years-day', 'Times Square Live Stream', 'Official • Watch the ball drop live', 'https://www.timessquarenyc.org/nye', 'official', '🗽', 'Live event', 3),
('new-years-day', 'Goal Setting Templates', 'Pinterest • Planning worksheets', 'https://www.pinterest.com/search/pins/?q=new%20year%20goals%20template', 'pinterest', '📝', '3 min browse', 4);

-- ============================================================================
-- ACTION ITEMS (Quick Actions)
-- ============================================================================

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('new-years-day', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('new-years-day', 'create_reminder', 'Set Countdown Reminder', '⏰', NULL, false, 2),
('new-years-day', 'create_todo', 'Create Resolution List', '📝', NULL, false, 3);

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ New Year''s Day data inserted successfully';
  RAISE NOTICE '📊 Inserted: 1 enrichment, 5 facts, 4 statistics, 4 tips, 5 timeline items, 8 quick ideas, 4 resources, 3 actions';
END $$;
