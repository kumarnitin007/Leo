-- =====================================================
-- REFERENCE CALENDARS: April-May Holidays Data
-- Baisakhi, Bihu, Ambedkar Jayanti, Vishu, Showa Day,
-- Gujarat Day, Constitution Day, Greenery Day, Children's Day,
-- Mother's Day, Buddha Purnima, Memorial Day
-- =====================================================

-- ============================================================================
-- BAISAKHI (VAISAKHI)
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'baisakhi', 
  'Baisakhi', 
  'cultural',
  '#FF9933', 
  '#FFD700', 
  '#FF9933', 
  '#FFD700',
  '🌾', 
  '🥁',
  'Celebrate the harvest and Sikh New Year',
  'Baisakhi (Vaisakhi) is a spring harvest festival celebrated primarily in Punjab, marking the Punjabi New Year. For Sikhs, it commemorates the formation of the Khalsa in 1699 by Guru Gobind Singh. The festival features energetic Bhangra and Gidda dances, vibrant processions, and visits to Gurdwaras. Farmers thank God for the bountiful harvest and pray for prosperity.',
  85,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('baisakhi', 'historical', 'Guru Gobind Singh founded the Khalsa (Sikh brotherhood) on Baisakhi in 1699, a pivotal moment in Sikh history.', '1699', 10, 'Sikh History', NULL),
('baisakhi', 'tradition', 'The Golden Temple in Amritsar hosts grand celebrations with thousands of devotees taking holy dips in the Sarovar.', 'Golden Temple', 9, 'Sikh Tourism', NULL),
('baisakhi', 'statistic', 'Over 30 million people celebrate Baisakhi, primarily in Punjab, Haryana, and Sikh communities worldwide.', '30 million', 8, 'Sikh Population', NULL),
('baisakhi', 'did_you_know', 'Bhangra, the energetic dance performed during Baisakhi, has become popular worldwide in music and fitness.', 'Bhangra', 7, 'Punjabi Culture', NULL),
('baisakhi', 'fun_fact', 'Traditional Baisakhi fairs feature wrestling matches, acrobatics, and folk music performances.', 'fairs', 6, 'Punjab Traditions', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('baisakhi', '30M+', 'People celebrate', '👥', 1),
('baisakhi', '1699', 'Khalsa founded', '📅', 2),
('baisakhi', '100K+', 'Visit Golden Temple', '🛕', 3),
('baisakhi', 'Apr 13', 'Fixed date', '🌾', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('baisakhi', 'planning', 'Visit Gurdwara', 'Attend special prayers and langar (community meal) at your local Gurdwara.', '🛕', 5, 3),
('baisakhi', 'pro_tip', 'Learn Bhangra', 'Join in the festive Bhangra dancing - it''s energetic and joyful!', '💃', 4, 7),
('baisakhi', 'reminder', 'Wear Traditional Attire', 'Dress in colorful Punjabi clothes - kurta-pajama for men, salwar-kameez for women.', '👗', 3, 1);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('baisakhi', 'Plan Gurdwara Visit', 'Check timings for special Baisakhi prayers and langar.', '🛕', 3, 1),
('baisakhi', 'Get Traditional Clothes', 'Purchase or prepare Punjabi attire.', '👗', 7, 2),
('baisakhi', 'Learn Bhangra Steps', 'Watch tutorials or practice dance moves.', '💃', 5, 3);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('baisakhi', 'Gurdwara Visit', '🛕', 'activity', 1),
('baisakhi', 'Bhangra Dance', '💃', 'activity', 2),
('baisakhi', 'Langar Seva', '🍽️', 'activity', 3),
('baisakhi', 'Traditional Food', '🥘', 'food', 4),
('baisakhi', 'Fair Visit', '🎪', 'activity', 5),
('baisakhi', 'Folk Music', '🎵', 'activity', 6);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('baisakhi', 'Baisakhi Guide', 'Wikipedia • Festival overview', 'https://en.wikipedia.org/wiki/Vaisakhi', 'wikipedia', '📖', '8 min', 1),
('baisakhi', 'Bhangra Dance', 'YouTube • Learn the moves', 'https://www.youtube.com/results?search_query=bhangra+dance', 'youtube', '💃', '10 min', 2),
('baisakhi', 'Khalsa History', 'Article • Sikh heritage', 'https://en.wikipedia.org/wiki/Khalsa', 'article', '📚', '12 min', 3);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('baisakhi', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('baisakhi', 'create_reminder', 'Set Reminder', '⏰', NULL, false, 2);

-- ============================================================================
-- BIHU (RONGALI BIHU)
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'bihu', 
  'Bihu', 
  'cultural',
  '#90EE90', 
  '#FFD700', 
  '#90EE90', 
  '#FFD700',
  '🌾', 
  '🥁',
  'Celebrate Assamese New Year and spring harvest',
  'Rongali Bihu (Bohag Bihu) is the Assamese New Year festival marking the beginning of spring and the agricultural season. Celebrated with traditional Bihu dance, dhol drums, and folk songs, it''s a time of joy, feasting, and community gatherings. The festival lasts seven days with different rituals each day, celebrating nature, cattle, and prosperity.',
  80,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('bihu', 'historical', 'Bihu has been celebrated in Assam for over 1,000 years, with roots in ancient agricultural rituals.', '1,000 years', 10, 'Assamese History', NULL),
('bihu', 'tradition', 'The Bihu dance is performed in groups with synchronized movements, accompanied by dhol, pepa, and gogona instruments.', 'Bihu dance', 9, 'Assamese Culture', NULL),
('bihu', 'statistic', 'Over 35 million people in Assam and neighboring states celebrate Bihu with great enthusiasm.', '35 million', 8, 'Assam Population', NULL),
('bihu', 'did_you_know', 'There are three types of Bihu: Rongali (spring), Kongali (autumn), and Bhogali (winter harvest).', '3 types', 7, 'Assamese Festivals', NULL),
('bihu', 'fun_fact', 'Traditional Bihu attire includes mekhela chador for women and dhoti-gamosa for men, all handwoven.', 'handwoven', 6, 'Assamese Textiles', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('bihu', '35M+', 'People celebrate', '👥', 1),
('bihu', '7', 'Days of celebration', '📅', 2),
('bihu', '3', 'Types of Bihu', '🌾', 3),
('bihu', '1000+', 'Years of tradition', '📜', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('bihu', 'planning', 'Learn Bihu Dance', 'Join community dance sessions or watch tutorials to learn the traditional steps.', '💃', 4, 7),
('bihu', 'pro_tip', 'Prepare Traditional Food', 'Make pitha (rice cakes), laru (sweets), and jolpan (snacks) for the celebrations.', '🍰', 5, 3),
('bihu', 'reminder', 'Wear Traditional Attire', 'Dress in mekhela chador or dhoti-gamosa to join the festivities.', '👗', 3, 1);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('bihu', 'Get Traditional Clothes', 'Purchase or prepare Assamese attire.', '👗', 7, 1),
('bihu', 'Learn Bihu Songs', 'Practice traditional Bihu songs and music.', '🎵', 5, 2),
('bihu', 'Prepare Sweets', 'Make pitha and other traditional delicacies.', '🍰', 2, 3);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('bihu', 'Bihu Dance', '💃', 'activity', 1),
('bihu', 'Make Pitha', '🍰', 'food', 2),
('bihu', 'Community Gathering', '👥', 'activity', 3),
('bihu', 'Traditional Music', '🥁', 'activity', 4),
('bihu', 'Cattle Worship', '🐄', 'activity', 5);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('bihu', 'Bihu Festival Guide', 'Wikipedia • Complete overview', 'https://en.wikipedia.org/wiki/Bihu', 'wikipedia', '📖', '10 min', 1),
('bihu', 'Bihu Dance Videos', 'YouTube • Traditional performances', 'https://www.youtube.com/results?search_query=bihu+dance', 'youtube', '💃', '15 min', 2),
('bihu', 'Pitha Recipes', 'YouTube • Traditional sweets', 'https://www.youtube.com/results?search_query=assamese+pitha', 'youtube', '🍰', '12 min', 3);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('bihu', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('bihu', 'create_reminder', 'Set Reminder', '⏰', NULL, false, 2);

-- ============================================================================
-- AMBEDKAR JAYANTI
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'ambedkar-jayanti', 
  'Ambedkar Jayanti', 
  'awareness',
  '#0000FF', 
  '#FFFFFF', 
  '#0000FF', 
  '#FFFFFF',
  '📚', 
  '⚖️',
  'Honor the architect of Indian Constitution',
  'Ambedkar Jayanti celebrates the birth anniversary of Dr. B.R. Ambedkar (April 14, 1891), the principal architect of the Indian Constitution and a champion of social justice. He fought against caste discrimination and worked tirelessly for the rights of Dalits and marginalized communities. The day is marked by paying respects at his statues, educational programs, and discussions on equality and social reform.',
  85,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('ambedkar-jayanti', 'historical', 'Dr. Ambedkar held doctorates from Columbia University and the London School of Economics, making him one of India''s most educated leaders.', 'doctorates', 10, 'Ambedkar Biography', NULL),
('ambedkar-jayanti', 'statistic', 'The Indian Constitution, drafted under Ambedkar''s leadership, is the world''s longest written constitution with 448 articles.', '448 articles', 9, 'Constitution of India', NULL),
('ambedkar-jayanti', 'did_you_know', 'Ambedkar was posthumously awarded the Bharat Ratna, India''s highest civilian honor, in 1990.', 'Bharat Ratna', 8, 'Indian Awards', NULL),
('ambedkar-jayanti', 'tradition', 'People visit Chaityabhoomi in Mumbai, where Ambedkar was cremated, to pay their respects.', 'Chaityabhoomi', 7, 'Memorial Sites', NULL),
('ambedkar-jayanti', 'fun_fact', 'Ambedkar was proficient in 9 languages and had a personal library of over 50,000 books.', '9 languages', 6, 'Ambedkar Facts', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('ambedkar-jayanti', '1891', 'Birth year', '📅', 1),
('ambedkar-jayanti', '448', 'Articles in Constitution', '📜', 2),
('ambedkar-jayanti', '9', 'Languages known', '🗣️', 3),
('ambedkar-jayanti', '50K', 'Books in library', '📚', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('ambedkar-jayanti', 'planning', 'Read Ambedkar''s Works', 'Read his books like "Annihilation of Caste" to understand his vision for social equality.', '📚', 5, 7),
('ambedkar-jayanti', 'pro_tip', 'Attend Educational Programs', 'Participate in seminars and discussions on social justice and constitutional rights.', '🎓', 4, 3),
('ambedkar-jayanti', 'reminder', 'Visit Memorials', 'Pay respects at Ambedkar statues or memorials in your area.', '🗿', 3, 1);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('ambedkar-jayanti', 'Research His Life', 'Read about Ambedkar''s contributions and philosophy.', '📖', 7, 1),
('ambedkar-jayanti', 'Find Local Events', 'Look for seminars, lectures, or memorial gatherings.', '🔍', 3, 2),
('ambedkar-jayanti', 'Plan Memorial Visit', 'Locate nearby Ambedkar statues or memorials.', '🗿', 2, 3);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('ambedkar-jayanti', 'Read His Books', '📚', 'activity', 1),
('ambedkar-jayanti', 'Attend Seminar', '🎓', 'activity', 2),
('ambedkar-jayanti', 'Visit Memorial', '🗿', 'activity', 3),
('ambedkar-jayanti', 'Watch Documentary', '📺', 'activity', 4),
('ambedkar-jayanti', 'Social Discussion', '💬', 'activity', 5);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('ambedkar-jayanti', 'Ambedkar Biography', 'Wikipedia • Life and legacy', 'https://en.wikipedia.org/wiki/B._R._Ambedkar', 'wikipedia', '📖', '15 min', 1),
('ambedkar-jayanti', 'Ambedkar Documentary', 'YouTube • Life story', 'https://www.youtube.com/results?search_query=dr+ambedkar+documentary', 'youtube', '📺', '45 min', 2),
('ambedkar-jayanti', 'Constitution of India', 'Official • Full text', 'https://legislative.gov.in/constitution-of-india', 'official', '📜', '30 min', 3);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('ambedkar-jayanti', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('ambedkar-jayanti', 'create_reminder', 'Set Reminder', '⏰', NULL, false, 2);

-- ============================================================================
-- VISHU (MALAYALAM NEW YEAR)
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'vishu', 
  'Vishu', 
  'cultural',
  '#FFD700', 
  '#FF6347', 
  '#FFD700', 
  '#FF6347',
  '🌸', 
  '🪔',
  'Celebrate Malayalam New Year with prosperity',
  'Vishu is the Malayalam New Year celebrated in Kerala and parts of Karnataka. The day begins with "Vishukkani" - the first auspicious sight of the year, featuring rice, fruits, flowers, gold, and a mirror. Families prepare a grand feast called "Sadya," exchange gifts (Vishukkaineetam), and burst firecrackers. The festival symbolizes hope, prosperity, and new beginnings.',
  80,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('vishu', 'historical', 'Vishu has been celebrated in Kerala for centuries, marking the astronomical New Year when the sun enters Mesha Rashi (Aries).', 'Mesha Rashi', 10, 'Malayalam Calendar', NULL),
('vishu', 'tradition', 'The Vishukkani arrangement includes a metal mirror (Valkannadi) so one sees their own reflection along with auspicious items.', 'Valkannadi', 9, 'Kerala Traditions', NULL),
('vishu', 'statistic', 'Over 35 million Malayalis worldwide celebrate Vishu with traditional rituals and feasts.', '35 million', 8, 'Malayalam Population', NULL),
('vishu', 'did_you_know', 'Elders give Vishukkaineetam (money) to younger family members as a blessing for prosperity.', 'Vishukkaineetam', 7, 'Kerala Customs', NULL),
('vishu', 'fun_fact', 'The Vishu Sadya feast includes over 20 dishes served on a banana leaf, showcasing Kerala cuisine.', '20 dishes', 6, 'Kerala Cuisine', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('vishu', '35M+', 'Malayalis celebrate', '👥', 1),
('vishu', '20+', 'Dishes in Sadya', '🍽️', 2),
('vishu', 'Apr 14', 'Celebration date', '📅', 3),
('vishu', '100s', 'Years of tradition', '📜', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('vishu', 'pro_tip', 'Prepare Vishukkani', 'Arrange the auspicious items the night before so family can see it first thing in the morning.', '🪔', 5, 1),
('vishu', 'planning', 'Plan Sadya Feast', 'Prepare or order traditional Kerala Sadya with all the classic dishes.', '🍽️', 4, 3),
('vishu', 'reminder', 'Get New Clothes', 'Wear new clothes (Puthukodi) on Vishu for good luck and prosperity.', '👗', 3, 7);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('vishu', 'Buy Vishukkani Items', 'Get rice, fruits, flowers, gold items, and mirror.', '🛒', 3, 1),
('vishu', 'Plan Sadya Menu', 'Decide on dishes or book Sadya from restaurant.', '🍽️', 5, 2),
('vishu', 'Get New Clothes', 'Purchase traditional Kerala attire.', '👗', 7, 3),
('vishu', 'Prepare Vishukkani', 'Arrange all items beautifully the night before.', '🪔', 1, 4);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('vishu', 'See Vishukkani', '🪔', 'activity', 1),
('vishu', 'Sadya Feast', '🍽️', 'food', 2),
('vishu', 'New Clothes', '👗', 'activity', 3),
('vishu', 'Temple Visit', '🛕', 'activity', 4),
('vishu', 'Firecrackers', '🎆', 'activity', 5),
('vishu', 'Give Kaineetam', '💰', 'activity', 6);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('vishu', 'Vishu Festival Guide', 'Wikipedia • Traditions explained', 'https://en.wikipedia.org/wiki/Vishu', 'wikipedia', '📖', '8 min', 1),
('vishu', 'Vishu Sadya Recipes', 'YouTube • Traditional dishes', 'https://www.youtube.com/results?search_query=vishu+sadya+recipes', 'youtube', '🍽️', '20 min', 2),
('vishu', 'Vishukkani Arrangement', 'Pinterest • Setup ideas', 'https://www.pinterest.com/search/pins/?q=vishukkani', 'pinterest', '🪔', '5 min', 3);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('vishu', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('vishu', 'create_reminder', 'Set Morning Reminder', '⏰', NULL, false, 2);

-- ============================================================================
-- SHOWA DAY (JAPAN)
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'showa-day', 
  'Showa Day', 
  'patriotic',
  '#BC002D', 
  '#FFFFFF', 
  '#BC002D', 
  '#FFFFFF',
  '🇯🇵', 
  '🌸',
  'Reflect on Japan''s Showa era history',
  'Showa Day (Shōwa no Hi) honors the birthday of Emperor Hirohito (April 29, 1901-1989), who reigned during the Showa era (1926-1989). The holiday encourages reflection on Japan''s tumultuous history during this period, including World War II and the country''s remarkable post-war recovery. It''s the first day of Golden Week, a series of national holidays.',
  70,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('showa-day', 'historical', 'The Showa era lasted 63 years, making it the longest reign of any Japanese emperor in recorded history.', '63 years', 10, 'Japanese History', NULL),
('showa-day', 'tradition', 'Showa Day marks the beginning of Golden Week, when many Japanese take vacations and travel.', 'Golden Week', 9, 'Japanese Holidays', NULL),
('showa-day', 'statistic', 'During Golden Week, over 30 million Japanese travel domestically or internationally.', '30 million', 8, 'Japan Tourism', NULL),
('showa-day', 'did_you_know', 'The holiday was originally called "Emperor''s Birthday" but was renamed after Hirohito''s death in 1989.', '1989', 7, 'Japanese Calendar', NULL),
('showa-day', 'fun_fact', 'Emperor Hirohito was a marine biologist and published several scientific papers on jellyfish and sea creatures.', 'marine biologist', 6, 'Emperor Facts', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('showa-day', '63', 'Years of Showa era', '📅', 1),
('showa-day', '1989', 'Holiday renamed', '🗓️', 2),
('showa-day', '30M', 'Travel during Golden Week', '✈️', 3),
('showa-day', '1st', 'Day of Golden Week', '🎌', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('showa-day', 'planning', 'Book Travel Early', 'If traveling during Golden Week, book accommodations and transport well in advance.', '✈️', 5, 30),
('showa-day', 'pro_tip', 'Visit Museums', 'Many museums offer special exhibitions about the Showa era and Japanese history.', '🏛️', 4, 7),
('showa-day', 'reminder', 'Reflect on History', 'Take time to learn about Japan''s transformation during the Showa period.', '📚', 3, 3);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('showa-day', 'Book Golden Week Travel', 'Reserve flights, hotels, or tours if planning trips.', '✈️', 30, 1),
('showa-day', 'Research Showa Era', 'Read about Japanese history during 1926-1989.', '📖', 7, 2),
('showa-day', 'Plan Activities', 'Check for special events, exhibitions, or festivals.', '🎪', 3, 3);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('showa-day', 'Museum Visit', '🏛️', 'activity', 1),
('showa-day', 'Read History', '📚', 'activity', 2),
('showa-day', 'Travel', '✈️', 'activity', 3),
('showa-day', 'Watch Documentary', '📺', 'activity', 4),
('showa-day', 'Cherry Blossom Viewing', '🌸', 'activity', 5);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('showa-day', 'Showa Day Guide', 'Wikipedia • Holiday history', 'https://en.wikipedia.org/wiki/Sh%C5%8Dwa_Day', 'wikipedia', '📖', '6 min', 1),
('showa-day', 'Showa Era History', 'Article • Japan 1926-1989', 'https://en.wikipedia.org/wiki/Sh%C5%8Dwa_(1926%E2%80%931989)', 'article', '📚', '20 min', 2),
('showa-day', 'Golden Week Guide', 'Official • Travel information', 'https://www.japan.travel/en/plan/golden-week/', 'official', '✈️', '10 min', 3);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('showa-day', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('showa-day', 'create_reminder', 'Set Travel Reminder', '⏰', NULL, false, 2);

-- ============================================================================
-- MOTHER'S DAY
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'mothers-day', 
  'Mother''s Day', 
  'celebration',
  '#FF69B4', 
  '#FFB6C1', 
  '#FF69B4', 
  '#FFB6C1',
  '💐', 
  '❤️',
  'Celebrate and honor mothers everywhere',
  'Mother''s Day honors mothers and motherhood, celebrated on the second Sunday of May in many countries. The modern holiday was established by Anna Jarvis in 1908 to honor her mother and all mothers. It''s a day to express gratitude, give gifts, and spend quality time with mothers. Over $28 billion is spent on Mother''s Day in the US alone.',
  95,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('mothers-day', 'historical', 'Anna Jarvis campaigned for Mother''s Day to become a national holiday, which was officially recognized in 1914 by President Woodrow Wilson.', '1914', 10, 'U.S. History', NULL),
('mothers-day', 'statistic', 'Americans spend over $28 billion on Mother''s Day gifts, making it one of the biggest spending holidays after Christmas.', '$28 billion', 9, 'National Retail Federation', NULL),
('mothers-day', 'tradition', 'Carnations are the traditional Mother''s Day flower - pink for living mothers and white to honor deceased mothers.', 'carnations', 8, 'Flower Traditions', NULL),
('mothers-day', 'did_you_know', 'Mother''s Day is celebrated on different dates worldwide, but over 50 countries celebrate it in May.', '50 countries', 7, 'Global Celebrations', NULL),
('mothers-day', 'fun_fact', 'More phone calls are made on Mother''s Day than any other day of the year, causing phone traffic to spike by 37%.', '37%', 6, 'Telecommunications Data', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('mothers-day', '$28B', 'Spent in US', '💰', 1),
('mothers-day', '1914', 'Became US holiday', '📅', 2),
('mothers-day', '37%', 'Increase in phone calls', '📞', 3),
('mothers-day', '50+', 'Countries celebrate', '🌍', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('mothers-day', 'pro_tip', 'Book Brunch Early', 'Restaurants fill up fast on Mother''s Day. Make reservations at least 2 weeks ahead.', '🍽️', 5, 14),
('mothers-day', 'planning', 'Order Flowers in Advance', 'Florists see 300% increase in orders. Order flowers 3-5 days early for best selection.', '💐', 5, 7),
('mothers-day', 'money_saver', 'Handmade Gifts Are Special', 'Personalized, handmade gifts often mean more than expensive store-bought items.', '🎨', 3, 10),
('mothers-day', 'reminder', 'Call Your Mom', 'If you can''t be there in person, make sure to call and express your love and gratitude.', '📞', 4, 1);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('mothers-day', 'Make Restaurant Reservation', 'Book brunch or dinner at mom''s favorite restaurant.', '🍽️', 14, 1),
('mothers-day', 'Order Flowers', 'Choose and order a beautiful bouquet.', '💐', 7, 2),
('mothers-day', 'Buy or Make Gift', 'Get a thoughtful gift or create something handmade.', '🎁', 5, 3),
('mothers-day', 'Plan Quality Time', 'Arrange activities to spend the day together.', '❤️', 3, 4),
('mothers-day', 'Write Card', 'Prepare a heartfelt card expressing your love.', '💌', 2, 5);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('mothers-day', 'Brunch', '🍽️', 'activity', 1),
('mothers-day', 'Flowers', '💐', 'gift', 2),
('mothers-day', 'Spa Day', '💆', 'activity', 3),
('mothers-day', 'Jewelry', '💎', 'gift', 4),
('mothers-day', 'Photo Album', '📸', 'gift', 5),
('mothers-day', 'Homemade Meal', '🍳', 'activity', 6),
('mothers-day', 'Movie Marathon', '🎬', 'activity', 7),
('mothers-day', 'Handwritten Letter', '💌', 'gift', 8);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('mothers-day', 'Mother''s Day History', 'Wikipedia • Origins and traditions', 'https://en.wikipedia.org/wiki/Mother%27s_Day', 'wikipedia', '📖', '8 min', 1),
('mothers-day', 'DIY Gift Ideas', 'YouTube • Handmade presents', 'https://www.youtube.com/results?search_query=mothers+day+diy+gifts', 'youtube', '🎨', '15 min', 2),
('mothers-day', 'Brunch Recipes', 'Pinterest • Cooking ideas', 'https://www.pinterest.com/search/pins/?q=mothers%20day%20brunch', 'pinterest', '🍳', '10 min', 3),
('mothers-day', 'Gift Guide', 'Article • Best gift ideas', 'https://www.goodhousekeeping.com/holidays/mothers-day/', 'article', '🎁', '12 min', 4);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('mothers-day', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('mothers-day', 'create_reminder', 'Set Reservation Reminder', '⏰', NULL, false, 2),
('mothers-day', 'create_todo', 'Create Gift Checklist', '📝', NULL, false, 3);

-- Note: Continuing with remaining holidays in next sections due to length...
-- Gujarat Day, Constitution Day, Greenery Day, Children's Day, Buddha Purnima, Memorial Day
-- will be added in continuation or separate file if needed

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ April-May holidays data inserted successfully (Part 1 of 2)';
  RAISE NOTICE '📊 Baisakhi: Complete enrichment data';
  RAISE NOTICE '📊 Bihu: Complete enrichment data';
  RAISE NOTICE '📊 Ambedkar Jayanti: Complete enrichment data';
  RAISE NOTICE '📊 Vishu: Complete enrichment data';
  RAISE NOTICE '📊 Showa Day: Complete enrichment data';
  RAISE NOTICE '📊 Mother''s Day: Complete enrichment data';
  RAISE NOTICE '⏳ Remaining April-May holidays will be in continuation file';
END $$;
