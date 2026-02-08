-- =====================================================
-- REFERENCE CALENDARS: Cultural Celebrations Data
-- Black History Month, Presidents' Day, Vernal Equinox,
-- Holi, Makar Sankranti, Pongal, Ugadi
-- =====================================================

-- ============================================================================
-- BLACK HISTORY MONTH
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'black-history-month', 
  'Black History Month', 
  'awareness',
  '#8B4513', 
  '#2F1810', 
  '#8B4513', 
  '#2F1810',
  '✊🏿', 
  '📚',
  'Honor Black excellence and contributions',
  'Black History Month, celebrated every February in the US and Canada, honors the achievements and contributions of African Americans. Started by historian Carter G. Woodson in 1926 as "Negro History Week," it expanded to a month-long celebration in 1976. The month highlights the central role of Black Americans in U.S. history.',
  85,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('black-history-month', 'historical', 'Carter G. Woodson, known as the "Father of Black History," chose February because it marks the birthdays of Abraham Lincoln and Frederick Douglass.', 'February', 10, 'Association for the Study of African American Life and History', NULL),
('black-history-month', 'statistic', 'Over 15,000 schools and organizations across the US participate in Black History Month programs and events.', '15,000', 9, 'National Education Association', NULL),
('black-history-month', 'did_you_know', 'The UK and Ireland also celebrate Black History Month, but in October instead of February.', 'October', 8, 'Black History Month UK', NULL),
('black-history-month', 'tradition', 'Each year has a different theme. Recent themes include "Black Health and Wellness" and "Black Resistance."', NULL, 7, 'ASALH', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('black-history-month', '1926', 'Started by Carter G. Woodson', '📅', 1),
('black-history-month', '15K+', 'Schools participate', '🏫', 2),
('black-history-month', '1976', 'Became month-long', '📆', 3),
('black-history-month', '28', 'Days of celebration', '🎉', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('black-history-month', 'pro_tip', 'Support Black-Owned Businesses', 'Make a conscious effort to shop at Black-owned businesses throughout February and beyond.', '🛍️', 4, 7),
('black-history-month', 'planning', 'Educate Yourself', 'Read books by Black authors, watch documentaries, or visit museums highlighting Black history and culture.', '📚', 5, 3),
('black-history-month', 'reminder', 'Attend Community Events', 'Look for local lectures, performances, and cultural celebrations in your community.', '🎭', 3, 1);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('black-history-month', 'Research Events', 'Find local Black History Month events and programs.', '🔍', 7, 1),
('black-history-month', 'Create Reading List', 'Compile books and documentaries to explore.', '📚', 5, 2),
('black-history-month', 'Support Black Businesses', 'Research and visit Black-owned establishments.', '🛍️', 3, 3),
('black-history-month', 'Share Knowledge', 'Plan to share what you learn with others.', '💬', 1, 4);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('black-history-month', 'Read Biography', '📖', 'activity', 1),
('black-history-month', 'Watch Documentary', '📺', 'activity', 2),
('black-history-month', 'Museum Visit', '🏛️', 'activity', 3),
('black-history-month', 'Support Business', '🛍️', 'activity', 4),
('black-history-month', 'Attend Lecture', '🎤', 'activity', 5),
('black-history-month', 'Cultural Event', '🎭', 'activity', 6);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('black-history-month', 'Official Website', 'ASALH • Themes and resources', 'https://asalh.org', 'official', '🌐', '10 min', 1),
('black-history-month', 'Black History Documentaries', 'YouTube • Educational films', 'https://www.youtube.com/results?search_query=black+history+documentaries', 'youtube', '🎥', 'Varies', 2),
('black-history-month', 'Reading List', 'Goodreads • Top Black authors', 'https://www.goodreads.com/shelf/show/black-history', 'article', '📚', '5 min', 3);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('black-history-month', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('black-history-month', 'create_reminder', 'Set Learning Reminder', '⏰', NULL, false, 2),
('black-history-month', 'create_todo', 'Create Action Plan', '📝', NULL, false, 3);

-- ============================================================================
-- PRESIDENTS' DAY
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'presidents-day', 
  'Presidents'' Day', 
  'patriotic',
  '#B22234', 
  '#3C3B6E', 
  '#B22234', 
  '#3C3B6E',
  '🇺🇸', 
  '🎩',
  'Honor American presidential leadership',
  'Presidents'' Day, officially Washington''s Birthday, honors all U.S. presidents but particularly George Washington and Abraham Lincoln. Celebrated on the third Monday of February, it became a federal holiday in 1879. The day is marked by patriotic celebrations and is one of the biggest shopping days of the year with major retail sales.',
  75,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('presidents-day', 'historical', 'George Washington''s actual birthday is February 22, but the holiday is celebrated on the third Monday of February.', 'February 22', 10, 'National Archives', NULL),
('presidents-day', 'statistic', 'Presidents'' Day weekend generates over $4 billion in retail sales, making it one of the top shopping holidays.', '$4 billion', 9, 'National Retail Federation', NULL),
('presidents-day', 'did_you_know', 'No federal law officially changed the name from "Washington''s Birthday" to "Presidents'' Day" - it''s still officially Washington''s Birthday.', NULL, 8, 'U.S. Office of Personnel Management', NULL),
('presidents-day', 'tradition', 'Many Americans visit presidential libraries, museums, and historic sites on Presidents'' Day.', NULL, 7, 'National Park Service', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('presidents-day', '1879', 'Became federal holiday', '📅', 1),
('presidents-day', '$4B', 'Retail sales generated', '💰', 2),
('presidents-day', '46', 'U.S. Presidents honored', '🎩', 3),
('presidents-day', '14', 'Presidential libraries', '📚', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('presidents-day', 'money_saver', 'Take Advantage of Sales', 'Presidents'' Day weekend features major sales on furniture, appliances, and electronics. Plan your big purchases now!', '💰', 5, 7),
('presidents-day', 'planning', 'Visit Presidential Sites', 'Many presidential libraries and historic sites offer free or discounted admission on Presidents'' Day.', '🏛️', 4, 3),
('presidents-day', 'reminder', 'Learn Presidential History', 'Watch documentaries or read biographies to learn about presidential leadership and American history.', '📚', 3, 1);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('presidents-day', 'Research Sales', 'Browse Presidents'' Day sale ads and plan purchases.', '🛍️', 7, 1),
('presidents-day', 'Plan Museum Visit', 'Check hours and admission for presidential sites.', '🏛️', 3, 2),
('presidents-day', 'Prepare Educational Activities', 'Download resources or plan family learning activities.', '📚', 2, 3);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('presidents-day', 'Shopping', '🛍️', 'activity', 1),
('presidents-day', 'Museum Visit', '🏛️', 'activity', 2),
('presidents-day', 'Watch Documentary', '📺', 'activity', 3),
('presidents-day', 'Read Biography', '📖', 'activity', 4),
('presidents-day', 'Patriotic Movie', '🎬', 'activity', 5);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('presidents-day', 'Presidential History', 'Wikipedia • All U.S. Presidents', 'https://en.wikipedia.org/wiki/President_of_the_United_States', 'wikipedia', '📖', '15 min', 1),
('presidents-day', 'Presidential Libraries', 'Official • Visit locations', 'https://www.archives.gov/presidential-libraries', 'official', '🏛️', '5 min', 2),
('presidents-day', 'Sale Finder', 'RetailMeNot • Best deals', 'https://www.retailmenot.com/presidents-day', 'article', '💰', '10 min', 3);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('presidents-day', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('presidents-day', 'create_reminder', 'Set Sale Reminder', '⏰', NULL, false, 2);

-- ============================================================================
-- VERNAL EQUINOX (SPRING EQUINOX)
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'vernal-equinox-day', 
  'Vernal Equinox', 
  'seasonal',
  '#90EE90', 
  '#228B22', 
  '#90EE90', 
  '#228B22',
  '🌸', 
  '🌱',
  'Welcome the arrival of spring',
  'The Vernal (Spring) Equinox marks the astronomical beginning of spring in the Northern Hemisphere, occurring around March 20-21. On this day, day and night are nearly equal in length worldwide. Ancient cultures celebrated this day as a time of renewal, rebirth, and fertility. Many spring festivals and traditions are tied to the equinox.',
  70,
  false
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('vernal-equinox-day', 'historical', 'The word "equinox" comes from Latin meaning "equal night," referring to the nearly equal hours of daylight and darkness.', 'equal night', 10, 'NASA', NULL),
('vernal-equinox-day', 'statistic', 'The exact moment of the equinox lasts only an instant, when the Sun crosses the celestial equator.', 'instant', 9, 'U.S. Naval Observatory', NULL),
('vernal-equinox-day', 'tradition', 'Many cultures celebrate spring festivals around the equinox, including Nowruz (Persian New Year) and Holi in India.', NULL, 8, 'Cultural Studies', NULL),
('vernal-equinox-day', 'did_you_know', 'You can balance an egg on its end on the equinox - though this is actually possible any day with patience!', NULL, 7, 'Science Myth Busters', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('vernal-equinox-day', '12hrs', 'Daylight and darkness', '⚖️', 1),
('vernal-equinox-day', 'Mar 20', 'Typical date', '📅', 2),
('vernal-equinox-day', '2x', 'Equinoxes per year', '🌍', 3);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('vernal-equinox-day', 'planning', 'Start Spring Cleaning', 'The equinox is a perfect time to declutter, organize, and refresh your living space for the new season.', '🧹', 4, 3),
('vernal-equinox-day', 'pro_tip', 'Plant Your Garden', 'Spring equinox marks the ideal time to start planting seeds for your spring and summer garden.', '🌱', 5, 7),
('vernal-equinox-day', 'reminder', 'Celebrate Renewal', 'Use this day to set new intentions, start fresh habits, or begin new projects.', '✨', 3, 1);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('vernal-equinox-day', 'Plan Spring Projects', 'Decide on gardening, cleaning, or renewal activities.', '📝', 7, 1),
('vernal-equinox-day', 'Buy Seeds & Supplies', 'Get gardening supplies or cleaning materials.', '🛒', 3, 2),
('vernal-equinox-day', 'Prepare Outdoor Space', 'Clean patios, balconies, or garden areas.', '🧹', 1, 3);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('vernal-equinox-day', 'Plant Seeds', '🌱', 'activity', 1),
('vernal-equinox-day', 'Spring Cleaning', '🧹', 'activity', 2),
('vernal-equinox-day', 'Nature Walk', '🚶', 'activity', 3),
('vernal-equinox-day', 'Outdoor Picnic', '🧺', 'activity', 4),
('vernal-equinox-day', 'Watch Sunrise', '🌅', 'activity', 5);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('vernal-equinox-day', 'Equinox Explained', 'NASA • Science behind equinoxes', 'https://www.nasa.gov/topics/earth/features/2010-vernal-equinox.html', 'article', '🔬', '5 min', 1),
('vernal-equinox-day', 'Spring Gardening Tips', 'YouTube • Planting guide', 'https://www.youtube.com/results?search_query=spring+equinox+gardening', 'youtube', '🌱', '10 min', 2),
('vernal-equinox-day', 'Vernal Equinox', 'Wikipedia • Cultural significance', 'https://en.wikipedia.org/wiki/March_equinox', 'wikipedia', '📖', '8 min', 3);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('vernal-equinox-day', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('vernal-equinox-day', 'create_todo', 'Create Spring Checklist', '📝', NULL, false, 2);

-- ============================================================================
-- HOLI (Festival of Colors)
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'holi', 
  'Holi', 
  'cultural',
  '#FF69B4', 
  '#9370DB', 
  '#FF69B4', 
  '#9370DB',
  '🎨', 
  '💜',
  'Festival of Colors celebrating spring and love',
  'Holi, the Hindu festival of colors, celebrates the arrival of spring, the triumph of good over evil, and the divine love of Radha and Krishna. People throw colored powder (gulal) and water at each other, sing, dance, and feast. The festival lasts two days, starting with Holika Dahan (bonfire) and culminating in Rangwali Holi (play with colors).',
  90,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('holi', 'historical', 'Holi has been celebrated for over 2,000 years, with mentions in ancient Sanskrit texts and sculptures.', '2,000 years', 10, 'Ancient Indian History', NULL),
('holi', 'tradition', 'The colored powders used in Holi were traditionally made from natural sources like turmeric, neem, and flowers.', NULL, 9, 'Indian Culture', NULL),
('holi', 'statistic', 'Over 1 billion people worldwide celebrate Holi, making it one of the most widely celebrated Hindu festivals.', '1 billion', 8, 'Global Hindu Population', NULL),
('holi', 'did_you_know', 'Holi is celebrated on the full moon day in the Hindu month of Phalguna, usually falling in March.', 'full moon', 7, 'Hindu Calendar', NULL),
('holi', 'fun_fact', 'In Mathura and Vrindavan, Holi celebrations last for 16 days, featuring unique traditions like Lathmar Holi.', '16 days', 6, 'Tourism India', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('holi', '1B+', 'People celebrate worldwide', '🌍', 1),
('holi', '2000+', 'Years of tradition', '📜', 2),
('holi', '2', 'Days of celebration', '📅', 3),
('holi', '16', 'Days in Mathura/Vrindavan', '🎉', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('holi', 'pro_tip', 'Use Natural Colors', 'Opt for organic, skin-safe colors (gulal) to avoid skin irritation and environmental harm.', '🌿', 5, 7),
('holi', 'planning', 'Wear Old Clothes', 'Colors can be difficult to remove, so wear white or old clothes you don''t mind staining.', '👕', 4, 3),
('holi', 'money_saver', 'Protect Your Skin', 'Apply coconut oil or moisturizer before playing with colors to make cleanup easier.', '🥥', 4, 1),
('holi', 'reminder', 'Stay Hydrated', 'Drink plenty of water and avoid alcohol while playing Holi, especially in hot weather.', '💧', 3, 0);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('holi', 'Buy Colors & Supplies', 'Purchase natural gulal, water guns (pichkaris), and balloons.', '🛒', 7, 1),
('holi', 'Prepare Snacks', 'Make traditional sweets like gujiya, mathri, and thandai.', '🍬', 3, 2),
('holi', 'Set Up Play Area', 'Designate outdoor space and protect valuables.', '🏡', 1, 3),
('holi', 'Invite Friends', 'Organize a Holi party or join community celebrations.', '📧', 5, 4);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('holi', 'Play with Colors', '🎨', 'activity', 1),
('holi', 'Make Thandai', '🥤', 'food', 2),
('holi', 'Dance to Music', '💃', 'activity', 3),
('holi', 'Cook Gujiya', '🍬', 'food', 4),
('holi', 'Bonfire (Holika)', '🔥', 'activity', 5),
('holi', 'Water Balloon Fight', '💦', 'activity', 6),
('holi', 'Photo Session', '📸', 'activity', 7);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('holi', 'Holi History & Traditions', 'Wikipedia • Complete guide', 'https://en.wikipedia.org/wiki/Holi', 'wikipedia', '📖', '10 min', 1),
('holi', 'Holi Recipe Videos', 'YouTube • Traditional sweets', 'https://www.youtube.com/results?search_query=holi+recipes', 'youtube', '🍬', '15 min', 2),
('holi', 'Safe Color Guide', 'Article • Natural vs chemical colors', 'https://www.youtube.com/results?search_query=natural+holi+colors', 'article', '🌿', '5 min', 3),
('holi', 'Holi Celebrations Worldwide', 'YouTube • Global festivities', 'https://www.youtube.com/results?search_query=holi+celebrations', 'youtube', '🌍', '20 min', 4);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('holi', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('holi', 'create_reminder', 'Set Preparation Reminder', '⏰', NULL, false, 2),
('holi', 'create_todo', 'Create Shopping List', '📝', NULL, false, 3);

-- ============================================================================
-- MAKAR SANKRANTI
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'makar-sankranti', 
  'Makar Sankranti', 
  'cultural',
  '#FFD700', 
  '#FF8C00', 
  '#FFD700', 
  '#FF8C00',
  '🪁', 
  '☀️',
  'Harvest festival celebrating the sun''s journey',
  'Makar Sankranti marks the Sun''s transit into Makara (Capricorn), signaling the end of winter and the beginning of longer days. It''s one of the few Hindu festivals celebrated on a fixed solar date (January 14). The festival is known for kite flying, sesame sweets (til ladoo), and taking holy dips in rivers. It''s celebrated across India with different names and traditions.',
  85,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('makar-sankranti', 'historical', 'Makar Sankranti is mentioned in ancient Hindu texts and has been celebrated for thousands of years.', 'thousands of years', 10, 'Hindu Scriptures', NULL),
('makar-sankranti', 'tradition', 'In Gujarat and Rajasthan, the sky fills with colorful kites as people participate in kite-flying competitions.', NULL, 9, 'Indian Tourism', NULL),
('makar-sankranti', 'statistic', 'Over 500 million people across India celebrate Makar Sankranti, making it one of the most widely observed festivals.', '500 million', 8, 'Census India', NULL),
('makar-sankranti', 'did_you_know', 'The festival has different names in different states: Pongal in Tamil Nadu, Lohri in Punjab, and Uttarayan in Gujarat.', NULL, 7, 'Cultural India', NULL),
('makar-sankranti', 'fun_fact', 'Sesame seeds (til) and jaggery (gur) are the traditional foods, symbolizing warmth and sweetness for the new season.', NULL, 6, 'Indian Cuisine', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('makar-sankranti', '500M+', 'People celebrate in India', '🇮🇳', 1),
('makar-sankranti', 'Jan 14', 'Fixed solar date', '📅', 2),
('makar-sankranti', '12', 'Different regional names', '🗺️', 3),
('makar-sankranti', '1000s', 'Kites flown', '🪁', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('makar-sankranti', 'pro_tip', 'Fly Kites Safely', 'Use cotton or paper strings instead of sharp manja (glass-coated strings) to prevent injuries to people and birds.', '🪁', 5, 3),
('makar-sankranti', 'planning', 'Make Traditional Sweets', 'Prepare til ladoo, gajak, and other sesame-jaggery treats to share with family and friends.', '🍬', 4, 7),
('makar-sankranti', 'reminder', 'Take a Holy Dip', 'If near a sacred river, take a ritual bath at sunrise for spiritual cleansing.', '🌊', 3, 1);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('makar-sankranti', 'Buy Kites & String', 'Purchase colorful kites and safe flying strings.', '🛒', 7, 1),
('makar-sankranti', 'Prepare Sweets', 'Make or buy til ladoo, gajak, and other treats.', '🍬', 3, 2),
('makar-sankranti', 'Plan River Visit', 'Arrange transportation for holy dip if applicable.', '🌊', 2, 3),
('makar-sankranti', 'Invite for Kite Flying', 'Organize rooftop kite-flying gathering.', '🪁', 5, 4);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('makar-sankranti', 'Fly Kites', '🪁', 'activity', 1),
('makar-sankranti', 'Make Til Ladoo', '🍬', 'food', 2),
('makar-sankranti', 'Holy Dip', '🌊', 'activity', 3),
('makar-sankranti', 'Bonfire', '🔥', 'activity', 4),
('makar-sankranti', 'Donate Food', '🍚', 'activity', 5),
('makar-sankranti', 'Watch Sunrise', '🌅', 'activity', 6);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('makar-sankranti', 'Festival Guide', 'Wikipedia • Complete overview', 'https://en.wikipedia.org/wiki/Makar_Sankranti', 'wikipedia', '📖', '8 min', 1),
('makar-sankranti', 'Til Ladoo Recipe', 'YouTube • Traditional sweet', 'https://www.youtube.com/results?search_query=til+ladoo+recipe', 'youtube', '🍬', '10 min', 2),
('makar-sankranti', 'Kite Flying Tips', 'Article • Safety and techniques', 'https://www.youtube.com/results?search_query=kite+flying+tips', 'article', '🪁', '5 min', 3);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('makar-sankranti', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('makar-sankranti', 'create_reminder', 'Set Kite Flying Reminder', '⏰', NULL, false, 2),
('makar-sankranti', 'create_todo', 'Create Preparation List', '📝', NULL, false, 3);

-- ============================================================================
-- PONGAL
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'pongal', 
  'Pongal', 
  'cultural',
  '#FF6347', 
  '#FFD700', 
  '#FF6347', 
  '#FFD700',
  '🍚', 
  '🌾',
  'Tamil harvest festival thanking the Sun God',
  'Pongal is a four-day Tamil harvest festival dedicated to the Sun God, celebrating the harvest season and prosperity. The name comes from the Tamil word meaning "to boil over," referring to the traditional dish of sweet rice. Celebrated primarily in Tamil Nadu and by Tamil communities worldwide, it includes decorating homes with kolam (rangoli), cooking Pongal dish, and honoring cattle.',
  85,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('pongal', 'historical', 'Pongal has been celebrated for over 1,000 years, dating back to the Sangam period in Tamil history.', '1,000 years', 10, 'Tamil History', NULL),
('pongal', 'tradition', 'Mattu Pongal (Day 3) honors cattle, which are bathed, decorated with flowers and bells, and fed special treats.', 'Day 3', 9, 'Tamil Culture', NULL),
('pongal', 'statistic', 'Over 75 million people in Tamil Nadu and worldwide celebrate Pongal each year.', '75 million', 8, 'Tamil Population', NULL),
('pongal', 'did_you_know', 'The Pongal dish must boil over the pot, symbolizing abundance and prosperity for the coming year.', 'boil over', 7, 'Tamil Traditions', NULL),
('pongal', 'fun_fact', 'Jallikattu, the traditional bull-taming sport, is held during Pongal celebrations in rural Tamil Nadu.', 'Jallikattu', 6, 'Tamil Sports', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('pongal', '75M+', 'People celebrate', '👥', 1),
('pongal', '4', 'Days of festivities', '📅', 2),
('pongal', '1000+', 'Years of tradition', '📜', 3),
('pongal', 'Jan 14', 'Main celebration day', '🌞', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('pongal', 'pro_tip', 'Cook Pongal Outdoors', 'Traditionally, Pongal is cooked in a clay pot outdoors, facing the rising sun for blessings.', '☀️', 5, 1),
('pongal', 'planning', 'Create Beautiful Kolam', 'Practice drawing kolam (rangoli) designs with rice flour to decorate your entrance.', '🎨', 4, 3),
('pongal', 'reminder', 'Honor Your Helpers', 'Mattu Pongal is about gratitude - thank those who help you, including animals and workers.', '🙏', 3, 2);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('pongal', 'Buy Ingredients', 'Get rice, jaggery, milk, cardamom for Pongal dish.', '🛒', 7, 1),
('pongal', 'Clean & Decorate Home', 'Deep clean and prepare for kolam decorations.', '🧹', 3, 2),
('pongal', 'Practice Kolam', 'Learn or practice traditional rangoli designs.', '🎨', 2, 3),
('pongal', 'Prepare Clay Pot', 'Get traditional clay pot for cooking Pongal.', '🏺', 5, 4);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('pongal', 'Cook Pongal', '🍚', 'food', 1),
('pongal', 'Draw Kolam', '🎨', 'activity', 2),
('pongal', 'Decorate Cattle', '🐄', 'activity', 3),
('pongal', 'Watch Jallikattu', '📺', 'activity', 4),
('pongal', 'Family Feast', '🍽️', 'food', 5),
('pongal', 'Traditional Dance', '💃', 'activity', 6);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('pongal', 'Pongal Festival Guide', 'Wikipedia • Complete traditions', 'https://en.wikipedia.org/wiki/Pongal_(festival)', 'wikipedia', '📖', '8 min', 1),
('pongal', 'Pongal Recipe', 'YouTube • Traditional cooking', 'https://www.youtube.com/results?search_query=pongal+recipe', 'youtube', '🍚', '15 min', 2),
('pongal', 'Kolam Designs', 'Pinterest • Rangoli patterns', 'https://www.pinterest.com/search/pins/?q=pongal%20kolam', 'pinterest', '🎨', '5 min', 3),
('pongal', 'Pongal Celebrations', 'YouTube • Festival videos', 'https://www.youtube.com/results?search_query=pongal+celebrations', 'youtube', '🎉', '20 min', 4);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('pongal', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('pongal', 'create_reminder', 'Set Cooking Reminder', '⏰', NULL, false, 2),
('pongal', 'create_todo', 'Create Shopping List', '📝', NULL, false, 3);

-- ============================================================================
-- UGADI (Telugu/Kannada New Year)
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'ugadi', 
  'Ugadi', 
  'cultural',
  '#FF1493', 
  '#FFD700', 
  '#FF1493', 
  '#FFD700',
  '🎊', 
  '🌺',
  'Telugu and Kannada New Year celebration',
  'Ugadi (or Yugadi) marks the New Year for Telugu and Kannada communities, falling on the first day of Chaitra month (March-April). The name comes from "Yuga" (age) and "Adi" (beginning), meaning "beginning of a new age." Families prepare special dishes like Ugadi Pachadi, which combines six tastes representing life''s experiences. Homes are decorated with mango leaves and rangoli.',
  80,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('ugadi', 'historical', 'Ugadi has been celebrated for centuries, marking the beginning of the Hindu lunar calendar year.', 'centuries', 10, 'Hindu Calendar', NULL),
('ugadi', 'tradition', 'Ugadi Pachadi contains six tastes (sweet, sour, salty, bitter, tangy, spicy) symbolizing life''s varied experiences.', '6 tastes', 9, 'Telugu Culture', NULL),
('ugadi', 'statistic', 'Over 100 million people in Andhra Pradesh, Telangana, and Karnataka celebrate Ugadi.', '100 million', 8, 'Census India', NULL),
('ugadi', 'did_you_know', 'Ugadi is considered an auspicious day to start new ventures, make investments, or begin new projects.', 'auspicious', 7, 'Hindu Traditions', NULL),
('ugadi', 'fun_fact', 'The Panchanga (almanac) for the new year is traditionally read on Ugadi, predicting the year ahead.', 'Panchanga', 6, 'Vedic Astrology', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('ugadi', '100M+', 'People celebrate', '👥', 1),
('ugadi', '6', 'Tastes in Pachadi', '🍽️', 2),
('ugadi', 'Mar-Apr', 'Celebration period', '📅', 3),
('ugadi', '2', 'States primarily celebrate', '🗺️', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('ugadi', 'pro_tip', 'Prepare Ugadi Pachadi', 'Make the traditional six-taste dish early in the morning and share with family before anything else.', '🍽️', 5, 1),
('ugadi', 'planning', 'Decorate with Mango Leaves', 'Hang fresh mango leaf torans (garlands) on doors for prosperity and good health.', '🌿', 4, 3),
('ugadi', 'reminder', 'Listen to Panchanga', 'Attend or listen to the Panchanga reading to learn about the year''s predictions.', '📖', 3, 1);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('ugadi', 'Buy Ingredients', 'Get neem flowers, jaggery, tamarind, mango for Pachadi.', '🛒', 7, 1),
('ugadi', 'Clean & Decorate', 'Deep clean home and prepare rangoli designs.', '🧹', 3, 2),
('ugadi', 'Get Mango Leaves', 'Purchase fresh mango leaves for door decorations.', '🌿', 2, 3),
('ugadi', 'Plan New Ventures', 'Decide on new projects to start on this auspicious day.', '📝', 5, 4);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('ugadi', 'Make Pachadi', '🍽️', 'food', 1),
('ugadi', 'Decorate Home', '🎨', 'activity', 2),
('ugadi', 'Temple Visit', '🛕', 'activity', 3),
('ugadi', 'Panchanga Reading', '📖', 'activity', 4),
('ugadi', 'New Clothes', '👗', 'activity', 5),
('ugadi', 'Family Feast', '🍛', 'food', 6);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('ugadi', 'Ugadi Festival Guide', 'Wikipedia • Traditions explained', 'https://en.wikipedia.org/wiki/Ugadi', 'wikipedia', '📖', '7 min', 1),
('ugadi', 'Ugadi Pachadi Recipe', 'YouTube • Traditional preparation', 'https://www.youtube.com/results?search_query=ugadi+pachadi+recipe', 'youtube', '🍽️', '10 min', 2),
('ugadi', 'Rangoli Designs', 'Pinterest • Ugadi patterns', 'https://www.pinterest.com/search/pins/?q=ugadi%20rangoli', 'pinterest', '🎨', '5 min', 3);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('ugadi', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('ugadi', 'create_reminder', 'Set Morning Reminder', '⏰', NULL, false, 2),
('ugadi', 'create_todo', 'Create Preparation List', '📝', NULL, false, 3);

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Cultural celebrations data inserted successfully';
  RAISE NOTICE '📊 Black History Month: 1 enrichment, 4 facts, 4 statistics, 3 tips, 4 timeline items, 6 quick ideas, 3 resources, 3 actions';
  RAISE NOTICE '📊 Presidents'' Day: 1 enrichment, 4 facts, 4 statistics, 3 tips, 3 timeline items, 5 quick ideas, 3 resources, 2 actions';
  RAISE NOTICE '📊 Vernal Equinox: 1 enrichment, 4 facts, 3 statistics, 3 tips, 3 timeline items, 5 quick ideas, 3 resources, 2 actions';
  RAISE NOTICE '📊 Holi: 1 enrichment, 5 facts, 4 statistics, 4 tips, 4 timeline items, 7 quick ideas, 4 resources, 3 actions';
  RAISE NOTICE '📊 Makar Sankranti: 1 enrichment, 5 facts, 4 statistics, 3 tips, 4 timeline items, 6 quick ideas, 3 resources, 3 actions';
  RAISE NOTICE '📊 Pongal: 1 enrichment, 5 facts, 4 statistics, 3 tips, 4 timeline items, 6 quick ideas, 4 resources, 3 actions';
  RAISE NOTICE '📊 Ugadi: 1 enrichment, 5 facts, 4 statistics, 3 tips, 4 timeline items, 6 quick ideas, 3 resources, 3 actions';
  RAISE NOTICE '🎉 Total: 7 holidays with comprehensive enriched data';
END $$;
