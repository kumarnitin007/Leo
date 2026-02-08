-- =====================================================
-- REFERENCE CALENDARS: Valentine's Day Sample Data
-- =====================================================
-- Complete example data for Valentine's Day
-- =====================================================

-- ============================================================================
-- CORE ENRICHMENT
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
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

-- ============================================================================
-- FACTS
-- ============================================================================

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('valentines-day', 'statistic', 'Over 1 billion Valentine''s cards are exchanged worldwide every year, making it the second-largest card-sending holiday after Christmas.', '1 billion', 10, 'Hallmark', 'https://www.hallmark.com'),
('valentines-day', 'fun_fact', '27% of people buy Valentine''s Day gifts for their pets, spending an average of $12 per furry friend.', '27%', 9, 'National Retail Federation', NULL),
('valentines-day', 'tradition', 'In Victorian England, people sent "vinegar valentines" - cruel cards meant to reject unwanted suitors.', NULL, 8, 'History.com', 'https://www.history.com/topics/holidays/history-of-valentines-day-2'),
('valentines-day', 'historical', '220 million roses are grown just for Valentine''s Day each year, with red roses making up 73% of all flowers bought.', '220 million', 7, 'Society of American Florists', NULL),
('valentines-day', 'did_you_know', 'Teachers receive the most Valentine''s Day cards, followed by children, mothers, wives, and pets.', NULL, 6, 'Greeting Card Association', NULL);

-- ============================================================================
-- STATISTICS (By The Numbers)
-- ============================================================================

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('valentines-day', '1B+', 'Valentine''s cards sent worldwide', '💌', 1),
('valentines-day', '220M', 'Roses produced annually', '🌹', 2),
('valentines-day', '27%', 'Buy gifts for their pets', '🐾', 3),
('valentines-day', '2-3wk', 'Book restaurants ahead', '🍽️', 4);

-- ============================================================================
-- TIPS (Actionable Advice)
-- ============================================================================

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('valentines-day', 'pro_tip', 'Don''t Wait Until the Last Minute!', 'Popular restaurants are already 60% booked. Reserve your table or plan a creative at-home experience now to avoid disappointment.', '🎯', 5, 14),
('valentines-day', 'planning', 'Order Flowers Early', 'Florists see a 300% increase in orders during Valentine''s week. Order at least 3 days early to ensure availability and freshness.', '🌹', 4, 7),
('valentines-day', 'money_saver', 'Shop Post-Valentine Sales', 'Chocolate goes on sale Feb 15th at 50-75% off. Stock up for next year or enjoy the savings!', '💰', 2, 0);

-- ============================================================================
-- TIMELINE (Preparation Checklist)
-- ============================================================================

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('valentines-day', 'Book Restaurant', 'Popular spots filling fast. Reserve your table now.', '📅', 7, 1),
('valentines-day', 'Order Flowers', 'Ensure freshness and availability with early order.', '🌹', 3, 2),
('valentines-day', 'Get Gift', 'Avoid last-minute stress with planned shopping.', '🎁', 2, 3),
('valentines-day', 'Plan Date Activities', 'Research movie times, events, or experiences.', '🎭', 5, 4);

-- ============================================================================
-- QUICK IDEAS (Swipeable Chips)
-- ============================================================================

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('valentines-day', 'Flowers', '💐', 'gift', 1),
('valentines-day', 'Chocolates', '🍫', 'gift', 2),
('valentines-day', 'Jewelry', '💎', 'gift', 3),
('valentines-day', 'Experience', '🎭', 'activity', 4),
('valentines-day', 'Love Letter', '📝', 'gift', 5),
('valentines-day', 'Dinner Date', '🍽️', 'activity', 6),
('valentines-day', 'DIY Gift', '🎨', 'gift', 7),
('valentines-day', 'Movie Night', '🎬', 'activity', 8);

-- ============================================================================
-- EXTERNAL RESOURCES (Links)
-- ============================================================================

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('valentines-day', 'History of Valentine''s Day', 'Wikipedia • Full historical context', 'https://en.wikipedia.org/wiki/Valentine%27s_Day', 'wikipedia', '📖', '5 min read', 1),
('valentines-day', 'DIY Gift Ideas', 'YouTube • Creative tutorials', 'https://www.youtube.com/results?search_query=valentine+diy+gift+ideas', 'youtube', '🎥', '10 min', 2),
('valentines-day', 'Romantic Recipes', 'Tasty • Cook together ideas', 'https://tasty.co/topic/valentines-day', 'recipe', '🍽️', '15 min', 3),
('valentines-day', 'Love Letter Templates', 'Pinterest • Inspiration & examples', 'https://www.pinterest.com/search/pins/?q=love%20letter%20ideas', 'pinterest', '💌', '3 min browse', 4);

-- ============================================================================
-- ACTION ITEMS (Quick Actions)
-- ============================================================================

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('valentines-day', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('valentines-day', 'create_reminder', 'Set Reminder', '⏰', NULL, false, 2),
('valentines-day', 'create_todo', 'Create Checklist', '📝', NULL, false, 3);

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Valentine''s Day sample data inserted successfully';
  RAISE NOTICE '📊 Inserted: 1 enrichment, 5 facts, 4 statistics, 3 tips, 4 timeline items, 8 quick ideas, 4 resources, 3 actions';
END $$;
