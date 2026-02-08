-- =====================================================
-- REFERENCE CALENDARS: MLK Day + Republic Day Data
-- =====================================================

-- ============================================================================
-- MARTIN LUTHER KING JR. DAY
-- ============================================================================

-- Core Enrichment
INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'martin-luther-king-jr-day', 
  'Martin Luther King Jr. Day', 
  'awareness',
  '#4A90E2', 
  '#2E5C8A', 
  '#4A90E2', 
  '#2E5C8A',
  '✊', 
  '🕊️',
  'Honor the legacy of civil rights and equality',
  'Martin Luther King Jr. Day honors the civil rights leader who championed nonviolent resistance and equality. Established as a federal holiday in 1986, it''s observed on the third Monday of January, near King''s birthday (January 15). It''s the only federal holiday designated as a National Day of Service, encouraging Americans to volunteer in their communities.',
  90,
  true
);

-- Facts
INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('martin-luther-king-jr-day', 'historical', 'MLK Day was first observed in 1986, making it the newest federal holiday in the United States.', '1986', 10, 'National Archives', 'https://www.archives.gov'),
('martin-luther-king-jr-day', 'statistic', 'Over 100 million Americans participate in MLK Day of Service activities, making it the largest single day of service in the nation.', '100 million', 9, 'Corporation for National Service', NULL),
('martin-luther-king-jr-day', 'tradition', 'The "I Have a Dream" speech, delivered in 1963, is one of the most famous speeches in American history with over 250,000 attendees.', '250,000', 8, 'Library of Congress', NULL),
('martin-luther-king-jr-day', 'did_you_know', 'Dr. King was the youngest person to receive the Nobel Peace Prize at age 35 in 1964.', '35', 7, 'Nobel Prize Foundation', NULL),
('martin-luther-king-jr-day', 'fun_fact', 'It took 15 years of campaigning before MLK Day became a federal holiday, with the bill signed by President Reagan in 1983.', '15 years', 6, 'History.com', NULL);

-- Statistics
INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('martin-luther-king-jr-day', '100M+', 'Americans volunteer', '🤝', 1),
('martin-luther-king-jr-day', '1986', 'First observed as holiday', '📅', 2),
('martin-luther-king-jr-day', '250K', 'At "I Have a Dream" speech', '🎤', 3),
('martin-luther-king-jr-day', '35', 'Age when won Nobel Prize', '🏆', 4);

-- Tips
INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('martin-luther-king-jr-day', 'pro_tip', 'Participate in Day of Service', 'Find local volunteer opportunities through MLKDay.gov. Service projects range from food banks to community cleanups.', '🤝', 5, 7),
('martin-luther-king-jr-day', 'planning', 'Educate Yourself and Others', 'Watch documentaries, read King''s speeches, or visit civil rights museums to honor his legacy meaningfully.', '📚', 4, 3),
('martin-luther-king-jr-day', 'reminder', 'Reflect on Progress and Work Ahead', 'Use this day to reflect on civil rights progress and consider how you can contribute to equality in your community.', '💭', 3, 1);

-- Timeline
INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('martin-luther-king-jr-day', 'Find Service Opportunities', 'Search MLKDay.gov for volunteer projects in your area.', '🔍', 7, 1),
('martin-luther-king-jr-day', 'Plan Educational Activities', 'Download resources or plan to watch documentaries.', '📚', 3, 2),
('martin-luther-king-jr-day', 'Register for Events', 'Sign up for marches, speeches, or community gatherings.', '📝', 5, 3),
('martin-luther-king-jr-day', 'Prepare to Serve', 'Gather supplies or confirm your volunteer commitment.', '🎒', 1, 4);

-- Quick Ideas
INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('martin-luther-king-jr-day', 'Volunteer', '🤝', 'activity', 1),
('martin-luther-king-jr-day', 'Watch Documentary', '📺', 'activity', 2),
('martin-luther-king-jr-day', 'Read Speeches', '📖', 'activity', 3),
('martin-luther-king-jr-day', 'Attend March', '🚶', 'activity', 4),
('martin-luther-king-jr-day', 'Donate', '💝', 'activity', 5),
('martin-luther-king-jr-day', 'Community Meeting', '👥', 'activity', 6),
('martin-luther-king-jr-day', 'Museum Visit', '🏛️', 'activity', 7);

-- External Resources
INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('martin-luther-king-jr-day', 'MLK Day of Service', 'Official • Find volunteer opportunities', 'https://www.mlkday.gov', 'official', '🤝', '5 min', 1),
('martin-luther-king-jr-day', 'I Have a Dream Speech', 'YouTube • Full original speech', 'https://www.youtube.com/watch?v=vP4iY1TtS3s', 'youtube', '🎤', '17 min', 2),
('martin-luther-king-jr-day', 'Biography & Legacy', 'Wikipedia • Complete history', 'https://en.wikipedia.org/wiki/Martin_Luther_King_Jr.', 'wikipedia', '📖', '10 min read', 3),
('martin-luther-king-jr-day', 'Teaching Resources', 'National Archives • Educational materials', 'https://www.archives.gov/education/lessons/mlk-day', 'article', '📚', '15 min', 4);

-- Action Items
INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('martin-luther-king-jr-day', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('martin-luther-king-jr-day', 'create_reminder', 'Set Service Reminder', '⏰', NULL, false, 2),
('martin-luther-king-jr-day', 'create_todo', 'Create Action Plan', '📝', NULL, false, 3);

-- ============================================================================
-- REPUBLIC DAY (INDIA)
-- ============================================================================

-- Core Enrichment
INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'republic-day', 
  'Republic Day', 
  'patriotic',
  '#FF9933', 
  '#138808', 
  '#FF9933', 
  '#138808',
  '🇮🇳', 
  '🎉',
  'Celebrate India''s democratic constitution',
  'Republic Day marks the date when India''s Constitution came into effect on January 26, 1950, replacing the Government of India Act (1935). The day is celebrated with a grand parade in New Delhi, showcasing India''s military might, cultural diversity, and social progress. The parade at Rajpath is one of the largest and most diverse in the world.',
  95,
  true
);

-- Facts
INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('republic-day', 'historical', 'India''s Constitution is the longest written constitution in the world, with 448 articles in 25 parts.', '448 articles', 10, 'Constitution of India', NULL),
('republic-day', 'tradition', 'The Republic Day parade lasts approximately 3 hours and showcases 26 tableaux from different states and ministries.', '3 hours', 9, 'Ministry of Defence', NULL),
('republic-day', 'statistic', 'Over 1 million people attend the Republic Day celebrations in New Delhi, with millions more watching on television.', '1 million', 8, 'India Today', NULL),
('republic-day', 'did_you_know', 'The Indian Constitution took 2 years, 11 months, and 18 days to complete, with Dr. B.R. Ambedkar as the chief architect.', '2 years 11 months', 7, 'National Archives of India', NULL),
('republic-day', 'fun_fact', 'The President of India, as the chief guest, unfurls the national flag at Rajpath, followed by the national anthem and a 21-gun salute.', '21-gun salute', 6, 'Government of India', NULL);

-- Statistics
INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('republic-day', '1950', 'Constitution came into effect', '📜', 1),
('republic-day', '448', 'Articles in Constitution', '📖', 2),
('republic-day', '26', 'Tableaux in parade', '🎭', 3),
('republic-day', '1M+', 'Attend celebrations', '👥', 4);

-- Tips
INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('republic-day', 'pro_tip', 'Watch the Parade Live', 'The Republic Day parade starts at 9 AM IST. Watch it live on Doordarshan or stream online to witness India''s diversity.', '📺', 5, 1),
('republic-day', 'planning', 'Plan Your Celebration', 'Organize flag hoisting ceremonies, cultural programs, or patriotic movie screenings with family and friends.', '🎉', 4, 7),
('republic-day', 'reminder', 'Reflect on Democratic Values', 'Read the Preamble to the Constitution and reflect on the values of justice, liberty, equality, and fraternity.', '📖', 3, 3);

-- Timeline
INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('republic-day', 'Get Indian Flag', 'Purchase or prepare the Indian tricolor for flag hoisting.', '🇮🇳', 7, 1),
('republic-day', 'Plan Viewing Party', 'Arrange to watch the parade with family or community.', '📺', 3, 2),
('republic-day', 'Prepare Patriotic Songs', 'Download or practice singing national songs and anthems.', '🎵', 2, 3),
('republic-day', 'Cook Traditional Food', 'Plan to make tricolor dishes or traditional Indian sweets.', '🍛', 1, 4);

-- Quick Ideas
INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('republic-day', 'Watch Parade', '📺', 'activity', 1),
('republic-day', 'Flag Hoisting', '🇮🇳', 'activity', 2),
('republic-day', 'Patriotic Songs', '🎵', 'activity', 3),
('republic-day', 'Tricolor Food', '🍛', 'food', 4),
('republic-day', 'Cultural Program', '🎭', 'activity', 5),
('republic-day', 'Read Constitution', '📖', 'activity', 6),
('republic-day', 'Patriotic Movies', '🎬', 'activity', 7);

-- External Resources
INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('republic-day', 'Live Parade Stream', 'Doordarshan • Official broadcast', 'https://www.youtube.com/@DDNational', 'youtube', '📺', '3 hours', 1),
('republic-day', 'Constitution of India', 'Official • Full text online', 'https://legislative.gov.in/constitution-of-india', 'official', '📜', '30 min read', 2),
('republic-day', 'Republic Day History', 'Wikipedia • Complete background', 'https://en.wikipedia.org/wiki/Republic_Day_(India)', 'wikipedia', '📖', '8 min read', 3),
('republic-day', 'Patriotic Recipes', 'Tasty • Tricolor dishes', 'https://www.youtube.com/results?search_query=republic+day+tricolor+recipes', 'recipe', '🍛', '15 min', 4);

-- Action Items
INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('republic-day', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('republic-day', 'create_reminder', 'Set Parade Reminder', '⏰', NULL, false, 2),
('republic-day', 'create_todo', 'Create Celebration Plan', '📝', NULL, false, 3);

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ MLK Day and Republic Day data inserted successfully';
  RAISE NOTICE '📊 MLK Day: 1 enrichment, 5 facts, 4 statistics, 3 tips, 4 timeline items, 7 quick ideas, 4 resources, 3 actions';
  RAISE NOTICE '📊 Republic Day: 1 enrichment, 5 facts, 4 statistics, 3 tips, 4 timeline items, 7 quick ideas, 4 resources, 3 actions';
END $$;
