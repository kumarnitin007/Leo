-- =====================================================
-- REFERENCE CALENDARS: Remaining Holidays Data
-- Coming of Age Day, National Foundation Day, Maha Shivratri,
-- Gangaur, Odisha Day, Hanuman Jayanti, Ram Navami
-- =====================================================

-- ============================================================================
-- COMING OF AGE DAY (JAPAN)
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'coming-of-age-day', 
  'Coming of Age Day', 
  'cultural',
  '#FF1493', 
  '#9370DB', 
  '#FF1493', 
  '#9370DB',
  '🎌', 
  '👘',
  'Celebrate young adults entering adulthood',
  'Coming of Age Day (Seijin no Hi) is a Japanese holiday celebrating young people who have reached the age of 20, the age of majority in Japan. Held on the second Monday of January, young adults attend ceremonies in traditional dress - women wear furisode (long-sleeved kimono) and men wear hakama. It became a national holiday in 1948 and is a significant milestone in Japanese culture.',
  75,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('coming-of-age-day', 'historical', 'Coming of Age Day became a national holiday in 1948, celebrating those who turned 20 during the previous year.', '1948', 10, 'Japanese Government', NULL),
('coming-of-age-day', 'tradition', 'Young women wear furisode, the most formal kimono for unmarried women, often costing thousands of dollars to rent or buy.', 'furisode', 9, 'Japanese Culture', NULL),
('coming-of-age-day', 'statistic', 'Approximately 1.2 million young Japanese celebrate Coming of Age Day each year.', '1.2 million', 8, 'Statistics Japan', NULL),
('coming-of-age-day', 'did_you_know', 'At age 20, Japanese citizens gain the right to vote, drink alcohol, and smoke legally.', '20', 7, 'Japanese Law', NULL),
('coming-of-age-day', 'fun_fact', 'The ceremonies are held at municipal offices, and attendance is voluntary but highly encouraged by families.', NULL, 6, 'Japanese Traditions', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('coming-of-age-day', '1.2M', 'Young adults celebrate', '👥', 1),
('coming-of-age-day', '20', 'Age of majority', '🎂', 2),
('coming-of-age-day', '1948', 'Became national holiday', '📅', 3),
('coming-of-age-day', '$1000+', 'Average kimono rental cost', '👘', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('coming-of-age-day', 'planning', 'Book Kimono Early', 'If celebrating in Japan, reserve furisode rentals months in advance as they book up quickly.', '👘', 5, 90),
('coming-of-age-day', 'pro_tip', 'Attend Local Ceremonies', 'Check with your municipal office for ceremony times and locations if you''re eligible.', '🏛️', 4, 7),
('coming-of-age-day', 'reminder', 'Celebrate Responsibly', 'While gaining new rights, remember that with adulthood comes responsibility.', '🎓', 3, 1);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('coming-of-age-day', 'Reserve Kimono', 'Book furisode or hakama rental well in advance.', '👘', 90, 1),
('coming-of-age-day', 'Register for Ceremony', 'Confirm attendance at municipal ceremony.', '📝', 14, 2),
('coming-of-age-day', 'Plan Celebration', 'Organize family gathering or party with friends.', '🎉', 7, 3),
('coming-of-age-day', 'Prepare for Photos', 'Arrange professional photography session.', '📸', 3, 4);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('coming-of-age-day', 'Wear Kimono', '👘', 'activity', 1),
('coming-of-age-day', 'Attend Ceremony', '🏛️', 'activity', 2),
('coming-of-age-day', 'Photo Session', '📸', 'activity', 3),
('coming-of-age-day', 'Family Dinner', '🍽️', 'activity', 4),
('coming-of-age-day', 'Shrine Visit', '⛩️', 'activity', 5),
('coming-of-age-day', 'Celebration Party', '🎉', 'activity', 6);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('coming-of-age-day', 'Coming of Age Day Guide', 'Wikipedia • Complete overview', 'https://en.wikipedia.org/wiki/Coming_of_Age_Day', 'wikipedia', '📖', '7 min', 1),
('coming-of-age-day', 'Kimono Traditions', 'YouTube • Furisode explained', 'https://www.youtube.com/results?search_query=coming+of+age+day+japan', 'youtube', '👘', '10 min', 2),
('coming-of-age-day', 'Ceremony Photos', 'Pinterest • Traditional celebrations', 'https://www.pinterest.com/search/pins/?q=seijin+no+hi', 'pinterest', '📸', '5 min', 3);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('coming-of-age-day', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('coming-of-age-day', 'create_reminder', 'Set Ceremony Reminder', '⏰', NULL, false, 2);

-- ============================================================================
-- NATIONAL FOUNDATION DAY (JAPAN)
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'national-foundation-day', 
  'National Foundation Day', 
  'patriotic',
  '#BC002D', 
  '#FFFFFF', 
  '#BC002D', 
  '#FFFFFF',
  '🇯🇵', 
  '🏯',
  'Celebrate Japan''s founding and heritage',
  'National Foundation Day (Kenkoku Kinen no Hi) celebrates the founding of Japan and the accession of its first Emperor, Jimmu, in 660 BC. Established as a national holiday in 1966, it replaced the pre-war Kigensetsu. The day is marked by patriotic ceremonies, flag displays, and reflection on Japanese history and culture. Many people visit shrines and participate in traditional festivities.',
  80,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('national-foundation-day', 'historical', 'According to legend, Emperor Jimmu founded Japan on February 11, 660 BC, though this is mythological rather than historical.', '660 BC', 10, 'Japanese Mythology', NULL),
('national-foundation-day', 'tradition', 'The holiday was reinstated in 1966 after being abolished following World War II due to its association with militarism.', '1966', 9, 'Japanese History', NULL),
('national-foundation-day', 'did_you_know', 'The date February 11 was chosen because it corresponds to the first day of spring in the traditional Japanese calendar.', 'February 11', 8, 'Japanese Calendar', NULL),
('national-foundation-day', 'statistic', 'Over 10,000 people gather at Kashihara Shrine in Nara, believed to be Emperor Jimmu''s burial site.', '10,000', 7, 'Japanese Tourism', NULL),
('national-foundation-day', 'fun_fact', 'Many Japanese display the national flag (Hinomaru) at their homes and businesses on this day.', 'Hinomaru', 6, 'Japanese Customs', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('national-foundation-day', '660BC', 'Legendary founding date', '📜', 1),
('national-foundation-day', '1966', 'Holiday reinstated', '📅', 2),
('national-foundation-day', '10K+', 'Gather at Kashihara Shrine', '⛩️', 3),
('national-foundation-day', '2684', 'Years of history (legendary)', '🏯', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('national-foundation-day', 'planning', 'Visit Historic Sites', 'Plan trips to Kashihara Shrine, Imperial Palace, or other historic Japanese landmarks.', '⛩️', 4, 7),
('national-foundation-day', 'pro_tip', 'Learn Japanese History', 'Read about Japan''s founding myths and the role of the imperial family in Japanese culture.', '📚', 3, 3),
('national-foundation-day', 'reminder', 'Display the Flag', 'If in Japan, consider displaying the Hinomaru flag to show patriotic spirit.', '🇯🇵', 3, 1);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('national-foundation-day', 'Plan Shrine Visit', 'Research and plan visit to historic shrines.', '⛩️', 7, 1),
('national-foundation-day', 'Learn History', 'Read about Emperor Jimmu and Japanese founding.', '📖', 3, 2),
('national-foundation-day', 'Prepare Flag', 'Get Japanese flag for display if celebrating.', '🇯🇵', 2, 3);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('national-foundation-day', 'Shrine Visit', '⛩️', 'activity', 1),
('national-foundation-day', 'Watch Ceremony', '📺', 'activity', 2),
('national-foundation-day', 'Read History', '📚', 'activity', 3),
('national-foundation-day', 'Display Flag', '🇯🇵', 'activity', 4),
('national-foundation-day', 'Traditional Food', '🍱', 'food', 5),
('national-foundation-day', 'Cultural Event', '🎭', 'activity', 6);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('national-foundation-day', 'Foundation Day Guide', 'Wikipedia • History and traditions', 'https://en.wikipedia.org/wiki/National_Foundation_Day', 'wikipedia', '📖', '8 min', 1),
('national-foundation-day', 'Emperor Jimmu Story', 'YouTube • Founding legend', 'https://www.youtube.com/results?search_query=emperor+jimmu+japan', 'youtube', '🏯', '15 min', 2),
('national-foundation-day', 'Kashihara Shrine', 'Official • Visit information', 'https://en.wikipedia.org/wiki/Kashihara_Shrine', 'article', '⛩️', '5 min', 3);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('national-foundation-day', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('national-foundation-day', 'create_reminder', 'Set Reminder', '⏰', NULL, false, 2);

-- ============================================================================
-- MAHA SHIVARATRI
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'maha-shivaratri', 
  'Maha Shivaratri', 
  'religious',
  '#FF6347', 
  '#4169E1', 
  '#FF6347', 
  '#4169E1',
  '🕉️', 
  '🔱',
  'The Great Night of Lord Shiva',
  'Maha Shivaratri, meaning "The Great Night of Shiva," is one of the most significant Hindu festivals dedicated to Lord Shiva. Celebrated on the 14th night of the new moon in the Hindu month of Phalguna (February-March), devotees observe fasts, perform night-long vigils, chant mantras, and visit Shiva temples. The festival commemorates the marriage of Shiva and Parvati and represents the convergence of Shiva and Shakti.',
  90,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('maha-shivaratri', 'historical', 'Maha Shivaratri has been celebrated for thousands of years, with references in ancient Hindu scriptures like the Puranas.', 'thousands of years', 10, 'Hindu Texts', NULL),
('maha-shivaratri', 'tradition', 'Devotees observe a strict fast and stay awake all night, offering prayers every three hours (prahar) to Lord Shiva.', 'all night', 9, 'Hindu Traditions', NULL),
('maha-shivaratri', 'statistic', 'Over 500 million Hindus worldwide observe Maha Shivaratri with fasting and temple visits.', '500 million', 8, 'Hindu Population', NULL),
('maha-shivaratri', 'did_you_know', 'The Shiva Lingam is bathed with milk, honey, yogurt, ghee, and water throughout the night in a ritual called Abhishekam.', 'Abhishekam', 7, 'Hindu Rituals', NULL),
('maha-shivaratri', 'fun_fact', 'Many devotees consume bhang (cannabis preparation) on this day as it''s believed to be favored by Lord Shiva.', 'bhang', 6, 'Hindu Customs', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('maha-shivaratri', '500M+', 'Devotees worldwide', '🙏', 1),
('maha-shivaratri', '24hrs', 'Fasting duration', '⏰', 2),
('maha-shivaratri', '4', 'Prayer sessions (prahars)', '🕉️', 3),
('maha-shivaratri', '1000s', 'Years of tradition', '📜', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('maha-shivaratri', 'pro_tip', 'Prepare for Fasting', 'If observing the fast, eat a nutritious meal before starting and stay hydrated with water and milk.', '🥛', 5, 1),
('maha-shivaratri', 'planning', 'Visit Shiva Temple', 'Plan to visit a Shiva temple for darshan and participate in the night-long prayers and chanting.', '🛕', 5, 3),
('maha-shivaratri', 'reminder', 'Chant Om Namah Shivaya', 'The most powerful mantra for Maha Shivaratri is "Om Namah Shivaya" - chant it throughout the day.', '🕉️', 4, 0),
('maha-shivaratri', 'money_saver', 'Offer Simple Items', 'Traditional offerings include bel leaves, milk, and flowers - simple yet deeply meaningful.', '🌿', 3, 2);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('maha-shivaratri', 'Prepare for Fast', 'Plan pre-fast meal and gather fasting supplies.', '🍽️', 1, 1),
('maha-shivaratri', 'Get Puja Items', 'Buy bel leaves, milk, flowers, and incense.', '🛒', 3, 2),
('maha-shivaratri', 'Plan Temple Visit', 'Check temple timings for night prayers.', '🛕', 2, 3),
('maha-shivaratri', 'Arrange Vigil', 'Organize home puja or join temple vigil.', '🕉️', 1, 4);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('maha-shivaratri', 'Temple Visit', '🛕', 'activity', 1),
('maha-shivaratri', 'Fasting', '🙏', 'activity', 2),
('maha-shivaratri', 'Night Vigil', '🌙', 'activity', 3),
('maha-shivaratri', 'Abhishekam', '🥛', 'activity', 4),
('maha-shivaratri', 'Chant Mantras', '🕉️', 'activity', 5),
('maha-shivaratri', 'Meditation', '🧘', 'activity', 6),
('maha-shivaratri', 'Read Scriptures', '📖', 'activity', 7);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('maha-shivaratri', 'Maha Shivaratri Guide', 'Wikipedia • Complete traditions', 'https://en.wikipedia.org/wiki/Maha_Shivaratri', 'wikipedia', '📖', '10 min', 1),
('maha-shivaratri', 'Shivaratri Puja Vidhi', 'YouTube • Ritual procedures', 'https://www.youtube.com/results?search_query=maha+shivaratri+puja', 'youtube', '🕉️', '20 min', 2),
('maha-shivaratri', 'Om Namah Shivaya', 'YouTube • Mantra chanting', 'https://www.youtube.com/results?search_query=om+namah+shivaya', 'youtube', '🎵', '30 min', 3),
('maha-shivaratri', 'Shiva Stories', 'Article • Mythology and legends', 'https://en.wikipedia.org/wiki/Shiva', 'article', '📚', '15 min', 4);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('maha-shivaratri', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('maha-shivaratri', 'create_reminder', 'Set Fast Reminder', '⏰', NULL, false, 2),
('maha-shivaratri', 'create_todo', 'Create Puja Checklist', '📝', NULL, false, 3);

-- ============================================================================
-- GANGAUR
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'gangaur', 
  'Gangaur', 
  'cultural',
  '#FF1493', 
  '#FFD700', 
  '#FF1493', 
  '#FFD700',
  '👸', 
  '💐',
  'Celebrate marital bliss and devotion',
  'Gangaur is a colorful festival celebrated primarily in Rajasthan, honoring Goddess Gauri (Parvati) and Lord Shiva. The name combines "Gan" (Shiva) and "Gaur" (Parvati). Celebrated for 18 days after Holi, married women pray for their husbands'' well-being while unmarried girls pray for good husbands. The festival features processions with beautifully decorated idols, traditional songs, and vibrant attire.',
  75,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('gangaur', 'historical', 'Gangaur has been celebrated in Rajasthan for over 300 years, with royal families traditionally leading grand processions.', '300 years', 10, 'Rajasthan History', NULL),
('gangaur', 'tradition', 'Women carry earthen pots (kalash) on their heads during processions, dressed in traditional ghagra-choli and jewelry.', 'kalash', 9, 'Rajasthani Culture', NULL),
('gangaur', 'statistic', 'The Jaipur Gangaur procession attracts over 100,000 spectators, making it one of Rajasthan''s biggest festivals.', '100,000', 8, 'Rajasthan Tourism', NULL),
('gangaur', 'did_you_know', 'Girls and women wake up early to worship clay idols of Gauri, decorating them with flowers and offering sweets.', 'clay idols', 7, 'Hindu Traditions', NULL),
('gangaur', 'fun_fact', 'The festival culminates with immersion of Gauri idols in water bodies, similar to Durga Puja visarjan.', 'immersion', 6, 'Festival Customs', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('gangaur', '18', 'Days of celebration', '📅', 1),
('gangaur', '100K+', 'Spectators in Jaipur', '👥', 2),
('gangaur', '300+', 'Years of tradition', '📜', 3),
('gangaur', '16', 'Days of worship', '🙏', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('gangaur', 'planning', 'Watch the Procession', 'If in Rajasthan, especially Jaipur or Udaipur, don''t miss the grand Gangaur procession with decorated elephants and camels.', '🐘', 5, 7),
('gangaur', 'pro_tip', 'Wear Traditional Attire', 'Women wear colorful ghagra-choli and men wear traditional Rajasthani dress for the celebrations.', '👗', 4, 3),
('gangaur', 'reminder', 'Make Clay Idols', 'Create or purchase clay idols of Gauri to worship during the 18-day festival.', '🎨', 3, 10);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('gangaur', 'Get Clay Idols', 'Purchase or make Gauri and Isar idols for worship.', '🎨', 18, 1),
('gangaur', 'Buy Traditional Clothes', 'Get ghagra-choli or traditional Rajasthani attire.', '👗', 10, 2),
('gangaur', 'Plan Procession Visit', 'Check dates and routes for local Gangaur processions.', '🚶', 5, 3),
('gangaur', 'Prepare Offerings', 'Gather flowers, sweets, and puja items.', '🌸', 2, 4);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('gangaur', 'Watch Procession', '🎭', 'activity', 1),
('gangaur', 'Worship Gauri', '🙏', 'activity', 2),
('gangaur', 'Wear Traditional', '👗', 'activity', 3),
('gangaur', 'Make Idols', '🎨', 'activity', 4),
('gangaur', 'Sing Folk Songs', '🎵', 'activity', 5),
('gangaur', 'Prepare Sweets', '🍬', 'food', 6);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('gangaur', 'Gangaur Festival Guide', 'Wikipedia • Traditions explained', 'https://en.wikipedia.org/wiki/Gangaur', 'wikipedia', '📖', '7 min', 1),
('gangaur', 'Gangaur Procession', 'YouTube • Jaipur celebrations', 'https://www.youtube.com/results?search_query=gangaur+festival+jaipur', 'youtube', '🎭', '15 min', 2),
('gangaur', 'Rajasthani Culture', 'Article • Festival significance', 'https://www.youtube.com/results?search_query=gangaur+festival', 'article', '📚', '10 min', 3);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('gangaur', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('gangaur', 'create_reminder', 'Set Procession Reminder', '⏰', NULL, false, 2);

-- ============================================================================
-- ODISHA DAY (UTKALA DIBASA)
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'odisha-day', 
  'Odisha Day', 
  'patriotic',
  '#FF9933', 
  '#138808', 
  '#FF9933', 
  '#138808',
  '🏛️', 
  '🌊',
  'Celebrate Odisha''s statehood and heritage',
  'Odisha Day (Utkala Dibasa) commemorates the formation of Odisha as a separate province on April 1, 1936, carved out from Bihar and Orissa Province. It celebrates Odia language, culture, and heritage. The day is marked by cultural programs, flag hoisting, and celebrations showcasing Odisha''s rich traditions including Odissi dance, Pattachitra art, and temple architecture.',
  70,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('odisha-day', 'historical', 'Odisha became the first state in India to be formed on linguistic basis on April 1, 1936.', '1936', 10, 'Indian History', NULL),
('odisha-day', 'tradition', 'The state is home to the famous Jagannath Temple in Puri, one of the Char Dham pilgrimage sites.', 'Jagannath Temple', 9, 'Odisha Tourism', NULL),
('odisha-day', 'statistic', 'Odisha has a population of over 45 million people, making it India''s 11th most populous state.', '45 million', 8, 'Census India', NULL),
('odisha-day', 'did_you_know', 'Odissi is one of India''s eight classical dance forms, originating from the temples of Odisha.', 'Odissi', 7, 'Indian Classical Arts', NULL),
('odisha-day', 'fun_fact', 'The Konark Sun Temple, a UNESCO World Heritage Site, is shaped like a giant chariot with 24 wheels.', 'Sun Temple', 6, 'UNESCO', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('odisha-day', '1936', 'State formation year', '📅', 1),
('odisha-day', '45M+', 'Population', '👥', 2),
('odisha-day', '1st', 'Linguistic state in India', '🗣️', 3),
('odisha-day', '30', 'Districts', '🗺️', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('odisha-day', 'planning', 'Explore Odia Culture', 'Learn about Odisha''s rich heritage through Odissi dance, Pattachitra art, and traditional cuisine.', '🎨', 4, 7),
('odisha-day', 'pro_tip', 'Visit Cultural Programs', 'Attend local cultural events showcasing Odia music, dance, and theater.', '🎭', 3, 3),
('odisha-day', 'reminder', 'Learn Odia Language', 'Try learning a few phrases in Odia to connect with the culture.', '🗣️', 2, 1);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('odisha-day', 'Research Events', 'Find local Odisha Day celebrations and programs.', '🔍', 7, 1),
('odisha-day', 'Learn About Heritage', 'Read about Odisha''s history, temples, and culture.', '📚', 3, 2),
('odisha-day', 'Plan Celebration', 'Organize or attend cultural gatherings.', '🎉', 2, 3);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('odisha-day', 'Cultural Program', '🎭', 'activity', 1),
('odisha-day', 'Odia Cuisine', '🍛', 'food', 2),
('odisha-day', 'Odissi Dance', '💃', 'activity', 3),
('odisha-day', 'Temple Visit', '🛕', 'activity', 4),
('odisha-day', 'Art Exhibition', '🎨', 'activity', 5);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('odisha-day', 'Odisha History', 'Wikipedia • State formation', 'https://en.wikipedia.org/wiki/Odisha_Day', 'wikipedia', '📖', '6 min', 1),
('odisha-day', 'Odissi Dance', 'YouTube • Classical performance', 'https://www.youtube.com/results?search_query=odissi+dance', 'youtube', '💃', '10 min', 2),
('odisha-day', 'Odisha Tourism', 'Official • Places to visit', 'https://www.odishatourism.gov.in', 'official', '🏛️', '15 min', 3);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('odisha-day', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('odisha-day', 'create_reminder', 'Set Reminder', '⏰', NULL, false, 2);

-- ============================================================================
-- HANUMAN JAYANTI
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'hanuman-jayanti', 
  'Hanuman Jayanti', 
  'religious',
  '#FF6347', 
  '#FFD700', 
  '#FF6347', 
  '#FFD700',
  '🐒', 
  '🙏',
  'Celebrate the birth of Lord Hanuman',
  'Hanuman Jayanti celebrates the birth of Lord Hanuman, the monkey god and devoted follower of Lord Rama. Observed on the full moon day of Chaitra month (March-April), devotees visit Hanuman temples, recite the Hanuman Chalisa, and offer special prayers. Hanuman symbolizes strength, devotion, courage, and selfless service. The festival is marked by processions, bhajans, and distribution of prasad.',
  85,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('hanuman-jayanti', 'historical', 'Hanuman is a central character in the Ramayana, where he helped Lord Rama rescue Sita from demon king Ravana.', 'Ramayana', 10, 'Hindu Epic', NULL),
('hanuman-jayanti', 'tradition', 'Devotees recite the Hanuman Chalisa (40 verses) which is believed to bring protection and remove obstacles.', 'Hanuman Chalisa', 9, 'Hindu Texts', NULL),
('hanuman-jayanti', 'statistic', 'Over 300 million Hindus worldwide celebrate Hanuman Jayanti with temple visits and prayers.', '300 million', 8, 'Hindu Population', NULL),
('hanuman-jayanti', 'did_you_know', 'Hanuman is believed to be immortal (Chiranjeevi) and still lives on Earth in subtle form.', 'immortal', 7, 'Hindu Beliefs', NULL),
('hanuman-jayanti', 'fun_fact', 'Offering sindoor (vermillion) to Hanuman is considered highly auspicious as he applied it to please Lord Rama.', 'sindoor', 6, 'Hindu Customs', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('hanuman-jayanti', '300M+', 'Devotees worldwide', '🙏', 1),
('hanuman-jayanti', '40', 'Verses in Hanuman Chalisa', '📖', 2),
('hanuman-jayanti', '1000s', 'Hanuman temples in India', '🛕', 3),
('hanuman-jayanti', '8', 'Chiranjeevis (immortals)', '♾️', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('hanuman-jayanti', 'pro_tip', 'Recite Hanuman Chalisa', 'Recite the Hanuman Chalisa 108 times or as many times as possible for maximum blessings.', '📖', 5, 1),
('hanuman-jayanti', 'planning', 'Visit Hanuman Temple', 'Plan to visit a Hanuman temple early morning for special puja and darshan.', '🛕', 5, 3),
('hanuman-jayanti', 'reminder', 'Offer Sindoor & Flowers', 'Traditional offerings include sindoor, red flowers, besan ladoo, and coconut.', '🌺', 4, 2),
('hanuman-jayanti', 'money_saver', 'Fast on Tuesday', 'Many devotees fast on Tuesdays leading up to Hanuman Jayanti for spiritual benefits.', '🙏', 3, 7);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('hanuman-jayanti', 'Get Puja Items', 'Buy sindoor, flowers, besan ladoo, and coconut.', '🛒', 3, 1),
('hanuman-jayanti', 'Learn Hanuman Chalisa', 'Practice reciting if you don''t know it by heart.', '📖', 7, 2),
('hanuman-jayanti', 'Plan Temple Visit', 'Check temple timings for special Hanuman Jayanti puja.', '🛕', 2, 3),
('hanuman-jayanti', 'Prepare for Fast', 'If fasting, plan pre-fast meal and breaking fast items.', '🍽️', 1, 4);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('hanuman-jayanti', 'Temple Visit', '🛕', 'activity', 1),
('hanuman-jayanti', 'Recite Chalisa', '📖', 'activity', 2),
('hanuman-jayanti', 'Fasting', '🙏', 'activity', 3),
('hanuman-jayanti', 'Offer Sindoor', '🌺', 'activity', 4),
('hanuman-jayanti', 'Read Ramayana', '📚', 'activity', 5),
('hanuman-jayanti', 'Bhajan Singing', '🎵', 'activity', 6),
('hanuman-jayanti', 'Distribute Prasad', '🍬', 'activity', 7);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('hanuman-jayanti', 'Hanuman Jayanti Guide', 'Wikipedia • Festival details', 'https://en.wikipedia.org/wiki/Hanuman_Jayanti', 'wikipedia', '📖', '8 min', 1),
('hanuman-jayanti', 'Hanuman Chalisa', 'YouTube • Full recitation', 'https://www.youtube.com/results?search_query=hanuman+chalisa', 'youtube', '🎵', '10 min', 2),
('hanuman-jayanti', 'Hanuman Stories', 'YouTube • Mythology and legends', 'https://www.youtube.com/results?search_query=hanuman+stories', 'youtube', '📚', '20 min', 3),
('hanuman-jayanti', 'Puja Vidhi', 'Article • Worship procedure', 'https://www.youtube.com/results?search_query=hanuman+jayanti+puja', 'article', '🛕', '5 min', 4);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('hanuman-jayanti', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('hanuman-jayanti', 'create_reminder', 'Set Temple Visit Reminder', '⏰', NULL, false, 2),
('hanuman-jayanti', 'create_todo', 'Create Puja Checklist', '📝', NULL, false, 3);

-- ============================================================================
-- RAM NAVAMI
-- ============================================================================

INSERT INTO myday_calendar_enrichments (
  day_identifier, day_name, template_category,
  primary_color, secondary_color, gradient_start, gradient_end,
  icon_emoji, background_emoji, tagline, origin_story, importance_percentage, is_major_holiday
) VALUES (
  'ram-navami', 
  'Ram Navami', 
  'religious',
  '#FFD700', 
  '#FF6347', 
  '#FFD700', 
  '#FF6347',
  '🏹', 
  '👑',
  'Celebrate the birth of Lord Rama',
  'Ram Navami celebrates the birth of Lord Rama, the seventh avatar of Lord Vishnu and the hero of the epic Ramayana. Observed on the ninth day of Chaitra Navratri (March-April), the festival marks the victory of good over evil. Devotees observe fasts, recite the Ramayana, visit temples, and participate in processions. Rama symbolizes righteousness, virtue, and ideal kingship.',
  90,
  true
);

INSERT INTO myday_calendar_facts (day_identifier, fact_type, content, highlight_value, priority, source_name, source_url) VALUES
('ram-navami', 'historical', 'The Ramayana, composed by sage Valmiki around 500 BCE, narrates Lord Rama''s life and is one of Hinduism''s greatest epics.', '500 BCE', 10, 'Hindu Literature', NULL),
('ram-navami', 'tradition', 'Devotees perform Ramayana Parayana (continuous reading) and organize Ram Katha (storytelling sessions) throughout the nine days.', 'Ramayana Parayana', 9, 'Hindu Traditions', NULL),
('ram-navami', 'statistic', 'Over 400 million Hindus worldwide celebrate Ram Navami with temple visits, fasting, and prayers.', '400 million', 8, 'Hindu Population', NULL),
('ram-navami', 'did_you_know', 'Ram Navami coincides with the last day of Chaitra Navratri, a nine-day festival honoring Goddess Durga.', 'Navratri', 7, 'Hindu Calendar', NULL),
('ram-navami', 'fun_fact', 'In Ayodhya, Rama''s birthplace, grand processions with decorated chariots (raths) carry idols of Rama through the streets.', 'Ayodhya', 6, 'Indian Festivals', NULL);

INSERT INTO myday_calendar_statistics (day_identifier, stat_value, stat_label, stat_icon, display_order) VALUES
('ram-navami', '400M+', 'Devotees worldwide', '🙏', 1),
('ram-navami', '9', 'Days of Chaitra Navratri', '📅', 2),
('ram-navami', '500BCE', 'Ramayana composed', '📜', 3),
('ram-navami', '7th', 'Avatar of Vishnu', '👑', 4);

INSERT INTO myday_calendar_tips (day_identifier, tip_type, title, content, icon_emoji, urgency_level, days_before_to_show) VALUES
('ram-navami', 'pro_tip', 'Read or Listen to Ramayana', 'Complete reading or listening to the Ramayana during the nine days of Navratri for spiritual merit.', '📖', 5, 9),
('ram-navami', 'planning', 'Visit Ram Temple', 'Plan to visit a Ram temple for special abhishekam and aarti on Ram Navami day.', '🛕', 5, 3),
('ram-navami', 'reminder', 'Chant Ram Naam', 'Chant "Jai Shri Ram" or "Sri Ram Jai Ram Jai Jai Ram" throughout the day for blessings.', '🕉️', 4, 1),
('ram-navami', 'money_saver', 'Prepare Prasad at Home', 'Make traditional prasad like panakam (jaggery drink) and kosambari (lentil salad) at home.', '🍽️', 3, 2);

INSERT INTO myday_calendar_timeline_items (day_identifier, title, description, icon_emoji, days_before, display_order) VALUES
('ram-navami', 'Start Navratri Fast', 'Begin nine-day fast or partial fast if observing.', '🙏', 9, 1),
('ram-navami', 'Read Ramayana Daily', 'Complete one chapter of Ramayana each day.', '📖', 9, 2),
('ram-navami', 'Get Puja Items', 'Buy flowers, fruits, tulsi leaves, and incense.', '🛒', 3, 3),
('ram-navami', 'Plan Temple Visit', 'Check temple schedule for Ram Navami celebrations.', '🛕', 2, 4),
('ram-navami', 'Prepare Prasad', 'Make panakam, kosambari, and other traditional items.', '🍽️', 1, 5);

INSERT INTO myday_calendar_quick_ideas (day_identifier, idea_label, idea_emoji, idea_category, display_order) VALUES
('ram-navami', 'Temple Visit', '🛕', 'activity', 1),
('ram-navami', 'Read Ramayana', '📖', 'activity', 2),
('ram-navami', 'Fasting', '🙏', 'activity', 3),
('ram-navami', 'Ram Katha', '🎤', 'activity', 4),
('ram-navami', 'Bhajan Singing', '🎵', 'activity', 5),
('ram-navami', 'Make Prasad', '🍽️', 'food', 6),
('ram-navami', 'Watch Ramayana', '📺', 'activity', 7);

INSERT INTO myday_calendar_external_resources (day_identifier, resource_title, resource_description, resource_url, resource_type, icon_emoji, estimated_time, display_order) VALUES
('ram-navami', 'Ram Navami Guide', 'Wikipedia • Festival overview', 'https://en.wikipedia.org/wiki/Rama_Navami', 'wikipedia', '📖', '8 min', 1),
('ram-navami', 'Ramayana Full Story', 'YouTube • Complete epic', 'https://www.youtube.com/results?search_query=ramayana+full+story', 'youtube', '📚', '3 hours', 2),
('ram-navami', 'Ram Bhajans', 'YouTube • Devotional songs', 'https://www.youtube.com/results?search_query=ram+bhajan', 'youtube', '🎵', '30 min', 3),
('ram-navami', 'Puja Vidhi', 'Article • Worship procedure', 'https://www.youtube.com/results?search_query=ram+navami+puja', 'article', '🛕', '10 min', 4);

INSERT INTO myday_calendar_action_items (day_identifier, action_type, action_label, action_icon, action_target, is_primary, display_order) VALUES
('ram-navami', 'create_event', 'Add to Calendar', '📅', NULL, true, 1),
('ram-navami', 'create_reminder', 'Set Navratri Start Reminder', '⏰', NULL, false, 2),
('ram-navami', 'create_todo', 'Create 9-Day Checklist', '📝', NULL, false, 3);

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Remaining holidays data inserted successfully';
  RAISE NOTICE '📊 Coming of Age Day: 1 enrichment, 5 facts, 4 statistics, 3 tips, 4 timeline items, 6 quick ideas, 3 resources, 2 actions';
  RAISE NOTICE '📊 National Foundation Day: 1 enrichment, 5 facts, 4 statistics, 3 tips, 3 timeline items, 6 quick ideas, 3 resources, 2 actions';
  RAISE NOTICE '📊 Maha Shivaratri: 1 enrichment, 5 facts, 4 statistics, 4 tips, 4 timeline items, 7 quick ideas, 4 resources, 3 actions';
  RAISE NOTICE '📊 Gangaur: 1 enrichment, 5 facts, 4 statistics, 3 tips, 4 timeline items, 6 quick ideas, 3 resources, 2 actions';
  RAISE NOTICE '📊 Odisha Day: 1 enrichment, 5 facts, 4 statistics, 3 tips, 3 timeline items, 5 quick ideas, 3 resources, 2 actions';
  RAISE NOTICE '📊 Hanuman Jayanti: 1 enrichment, 5 facts, 4 statistics, 4 tips, 4 timeline items, 7 quick ideas, 4 resources, 3 actions';
  RAISE NOTICE '📊 Ram Navami: 1 enrichment, 5 facts, 4 statistics, 4 tips, 5 timeline items, 7 quick ideas, 4 resources, 3 actions';
  RAISE NOTICE '🎉 Total: 7 holidays with comprehensive enriched data';
  RAISE NOTICE '🌟 Grand Total: 17 holidays fully enriched across all files!';
END $$;
