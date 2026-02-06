-- Phase 4: Advanced Features
-- @mentions, notifications, analytics, bulk operations

-- ============================================================================
-- MENTIONS SYSTEM
-- ============================================================================

-- Table: Comment Mentions (who was @mentioned in a comment)
CREATE TABLE IF NOT EXISTS myday_comment_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES myday_entry_comments(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL,
  mentioned_by_user_id UUID NOT NULL,
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(comment_id, mentioned_user_id)
);

-- Indexes for mentions
CREATE INDEX IF NOT EXISTS idx_mentions_user ON myday_comment_mentions(mentioned_user_id, seen_at);
CREATE INDEX IF NOT EXISTS idx_mentions_comment ON myday_comment_mentions(comment_id);

-- RLS for mentions
ALTER TABLE myday_comment_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mentions directed at them"
ON myday_comment_mentions FOR SELECT
USING (auth.uid() = mentioned_user_id OR auth.uid() = mentioned_by_user_id);

CREATE POLICY "Users can create mentions"
ON myday_comment_mentions FOR INSERT
WITH CHECK (auth.uid() = mentioned_by_user_id);

CREATE POLICY "Users can mark their mentions as seen"
ON myday_comment_mentions FOR UPDATE
USING (auth.uid() = mentioned_user_id);

-- ============================================================================
-- COMMENT REACTIONS (Phase 4 Enhancement)
-- ============================================================================

-- Table: Comment Reactions (emoji reactions to comments)
CREATE TABLE IF NOT EXISTS myday_comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES myday_entry_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL, -- 'like', 'helpful', 'resolved', 'urgent'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(comment_id, user_id, reaction_type)
);

-- Indexes for reactions
CREATE INDEX IF NOT EXISTS idx_reactions_comment ON myday_comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON myday_comment_reactions(user_id);

-- RLS for reactions
ALTER TABLE myday_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions on comments they can see"
ON myday_comment_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM myday_entry_comments c
    WHERE c.id = comment_id
    AND user_has_entry_access(auth.uid(), c.entry_id, c.entry_type)
  )
);

CREATE POLICY "Users can add reactions"
ON myday_comment_reactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reactions"
ON myday_comment_reactions FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENT ANALYTICS VIEWS
-- ============================================================================

-- View: Comment activity summary per entry
CREATE OR REPLACE VIEW myday_entry_comment_stats AS
SELECT 
  entry_id,
  entry_type,
  entry_title,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as total_comments,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_resolved = false) as active_comments,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_resolved = true) as resolved_comments,
  COUNT(DISTINCT user_id) as unique_commenters,
  MAX(created_at) as last_comment_at,
  MIN(created_at) as first_comment_at
FROM myday_entry_comments
GROUP BY entry_id, entry_type, entry_title;

-- View: User comment activity
CREATE OR REPLACE VIEW myday_user_comment_stats AS
SELECT 
  user_id,
  user_display_name,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as total_comments,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_resolved = false) as active_comments,
  COUNT(DISTINCT entry_id) as entries_commented_on,
  MAX(created_at) as last_comment_at
FROM myday_entry_comments
GROUP BY user_id, user_display_name;

-- ============================================================================
-- HELPER FUNCTIONS FOR ADVANCED FEATURES
-- ============================================================================

-- Function: Get unseen mentions count for a user
CREATE OR REPLACE FUNCTION get_unseen_mentions_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM myday_comment_mentions
  WHERE mentioned_user_id = p_user_id
  AND seen_at IS NULL;
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get mentions for a user
CREATE OR REPLACE FUNCTION get_user_mentions(p_user_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  mention_id UUID,
  comment_id UUID,
  entry_id TEXT,
  entry_type TEXT,
  entry_title TEXT,
  comment_message TEXT,
  mentioned_by_user_id UUID,
  mentioned_by_display_name TEXT,
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as mention_id,
    m.comment_id,
    c.entry_id,
    c.entry_type,
    c.entry_title,
    c.message as comment_message,
    m.mentioned_by_user_id,
    c.user_display_name as mentioned_by_display_name,
    m.seen_at,
    m.created_at
  FROM myday_comment_mentions m
  JOIN myday_entry_comments c ON c.id = m.comment_id
  WHERE m.mentioned_user_id = p_user_id
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Mark mention as seen
CREATE OR REPLACE FUNCTION mark_mention_seen(p_mention_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE myday_comment_mentions
  SET seen_at = NOW()
  WHERE id = p_mention_id
  AND mentioned_user_id = p_user_id
  AND seen_at IS NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Bulk resolve comments for an entry
CREATE OR REPLACE FUNCTION bulk_resolve_comments(p_entry_id TEXT, p_entry_type TEXT, p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Only allow if user has access to the entry
  IF NOT user_has_entry_access(p_user_id, p_entry_id, p_entry_type) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  UPDATE myday_entry_comments
  SET is_resolved = true, updated_at = NOW()
  WHERE entry_id = p_entry_id
  AND entry_type = p_entry_type
  AND is_resolved = false
  AND deleted_at IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Bulk dismiss dashboard comments for a user
CREATE OR REPLACE FUNCTION bulk_dismiss_dashboard_comments(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
  v_comment RECORD;
BEGIN
  v_count := 0;
  
  FOR v_comment IN 
    SELECT id FROM myday_entry_comments
    WHERE show_on_dashboard = true
    AND is_resolved = false
    AND deleted_at IS NULL
    AND NOT (dismissed_by @> jsonb_build_array(to_jsonb(p_user_id)))
  LOOP
    UPDATE myday_entry_comments
    SET dismissed_by = COALESCE(dismissed_by, '[]'::jsonb) || jsonb_build_array(to_jsonb(p_user_id))
    WHERE id = v_comment.id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get comment analytics for an entry
CREATE OR REPLACE FUNCTION get_entry_comment_analytics(p_entry_id TEXT, p_entry_type TEXT)
RETURNS TABLE (
  total_comments INTEGER,
  active_comments INTEGER,
  resolved_comments INTEGER,
  unique_commenters INTEGER,
  avg_resolution_time_hours NUMERIC,
  last_comment_at TIMESTAMPTZ,
  first_comment_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_comments,
    COUNT(*) FILTER (WHERE is_resolved = false)::INTEGER as active_comments,
    COUNT(*) FILTER (WHERE is_resolved = true)::INTEGER as resolved_comments,
    COUNT(DISTINCT user_id)::INTEGER as unique_commenters,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) FILTER (WHERE is_resolved = true) as avg_resolution_time_hours,
    MAX(created_at) as last_comment_at,
    MIN(created_at) as first_comment_at
  FROM myday_entry_comments
  WHERE entry_id = p_entry_id
  AND entry_type = p_entry_type
  AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENT TEMPLATES (Phase 4 Enhancement)
-- ============================================================================

-- Table: Comment Templates (predefined comment messages)
CREATE TABLE IF NOT EXISTS myday_comment_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  template_name TEXT NOT NULL,
  template_message TEXT NOT NULL,
  entry_type TEXT, -- NULL means applies to all types
  is_global BOOLEAN DEFAULT false, -- Admin-created templates
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for templates
CREATE INDEX IF NOT EXISTS idx_templates_user ON myday_comment_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_type ON myday_comment_templates(entry_type);
CREATE INDEX IF NOT EXISTS idx_templates_global ON myday_comment_templates(is_global) WHERE is_global = true;

-- RLS for templates
ALTER TABLE myday_comment_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own templates and global templates"
ON myday_comment_templates FOR SELECT
USING (auth.uid() = user_id OR is_global = true);

CREATE POLICY "Users can create their own templates"
ON myday_comment_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
ON myday_comment_templates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
ON myday_comment_templates FOR DELETE
USING (auth.uid() = user_id);

-- Insert some default global templates
INSERT INTO myday_comment_templates (user_id, template_name, template_message, entry_type, is_global)
VALUES 
  ('00000000-0000-0000-0000-000000000000', 'Password Not Working', 'Tried this password but it didn''t work. Please verify.', 'safe_entry', true),
  ('00000000-0000-0000-0000-000000000000', 'Needs Update', 'This needs to be updated. Please review when you have time.', NULL, true),
  ('00000000-0000-0000-0000-000000000000', 'Call Me', 'Please call me when you update this.', NULL, true),
  ('00000000-0000-0000-0000-000000000000', 'Expiring Soon', 'This is expiring soon. Action required.', NULL, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_unseen_mentions_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_mentions(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_mention_seen(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_resolve_comments(TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_dismiss_dashboard_comments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_entry_comment_analytics(TEXT, TEXT) TO authenticated;

GRANT SELECT ON myday_entry_comment_stats TO authenticated;
GRANT SELECT ON myday_user_comment_stats TO authenticated;

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 4 migration completed successfully';
  RAISE NOTICE '   - @mentions system created';
  RAISE NOTICE '   - Comment reactions table created';
  RAISE NOTICE '   - Analytics views and functions added';
  RAISE NOTICE '   - Bulk operations functions created';
  RAISE NOTICE '   - Comment templates system created';
END $$;
