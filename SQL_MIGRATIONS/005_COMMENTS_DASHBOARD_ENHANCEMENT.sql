-- Phase 2: Dashboard Integration & Enhanced Comment Fields
-- This migration adds dashboard-specific functionality to the comments system

-- Note: action_date, action_type, show_on_dashboard, dismissed_by, and priority 
-- were already added in 004_COMMENTS_SYSTEM.sql, so this file focuses on:
-- 1. Helper functions for dashboard queries
-- 2. Indexes for performance
-- 3. Any additional enhancements

-- ============================================================================
-- HELPER FUNCTIONS FOR DASHBOARD
-- ============================================================================

-- Function: Get dashboard comments for a user
-- Returns all unresolved, non-dismissed comments with action_date that should show on dashboard
CREATE OR REPLACE FUNCTION get_dashboard_comments_for_user(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  entry_id TEXT,
  entry_type TEXT,
  entry_title TEXT,
  user_id UUID,
  user_display_name TEXT,
  message TEXT,
  action_date DATE,
  action_type TEXT,
  priority TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.entry_id,
    c.entry_type,
    c.entry_title,
    c.user_id,
    c.user_display_name,
    c.message,
    c.action_date,
    c.action_type,
    c.priority,
    c.created_at,
    c.updated_at
  FROM myday_entry_comments c
  WHERE 
    c.show_on_dashboard = true
    AND c.is_resolved = false
    AND c.is_deleted = false
    AND c.action_date IS NOT NULL
    AND NOT (c.dismissed_by @> jsonb_build_array(to_jsonb(p_user_id)))
    -- User must have access to the entry (member of group that has access)
    AND (
      -- User is the comment author
      c.user_id = p_user_id
      OR
      -- User is member of a group that has access to this entry
      EXISTS (
        SELECT 1 
        FROM myday_shared_safe_entries sse
        JOIN myday_group_members gm ON gm.group_id = sse.group_id
        WHERE sse.safe_entry_id = c.entry_id
        AND gm.user_id = p_user_id
      )
      OR
      -- User owns the entry (for safe_entry type)
      EXISTS (
        SELECT 1
        FROM myday_safe_entries se
        WHERE se.id = c.entry_id
        AND se.user_id = p_user_id
      )
    )
  ORDER BY 
    CASE c.priority
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 3
      ELSE 4
    END,
    c.action_date ASC,
    c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Dismiss comment from dashboard for a user
CREATE OR REPLACE FUNCTION dismiss_comment_from_dashboard(p_comment_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_dismissed_by JSONB;
BEGIN
  -- Get current dismissed_by array
  SELECT dismissed_by INTO v_dismissed_by
  FROM myday_entry_comments
  WHERE id = p_comment_id;
  
  -- Add user to dismissed_by if not already there
  IF v_dismissed_by IS NULL THEN
    v_dismissed_by := jsonb_build_array(to_jsonb(p_user_id));
  ELSIF NOT (v_dismissed_by @> jsonb_build_array(to_jsonb(p_user_id))) THEN
    v_dismissed_by := v_dismissed_by || jsonb_build_array(to_jsonb(p_user_id));
  END IF;
  
  -- Update the comment
  UPDATE myday_entry_comments
  SET dismissed_by = v_dismissed_by
  WHERE id = p_comment_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get comment count for dashboard (for badge display)
CREATE OR REPLACE FUNCTION get_dashboard_comment_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM myday_entry_comments c
  WHERE 
    c.show_on_dashboard = true
    AND c.is_resolved = false
    AND c.is_deleted = false
    AND c.action_date IS NOT NULL
    AND NOT (c.dismissed_by @> jsonb_build_array(to_jsonb(p_user_id)))
    AND (
      c.user_id = p_user_id
      OR
      EXISTS (
        SELECT 1 
        FROM myday_shared_safe_entries sse
        JOIN myday_group_members gm ON gm.group_id = sse.group_id
        WHERE sse.safe_entry_id = c.entry_id
        AND gm.user_id = p_user_id
      )
      OR
      EXISTS (
        SELECT 1
        FROM myday_safe_entries se
        WHERE se.id = c.entry_id
        AND se.user_id = p_user_id
      )
    );
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Index for dashboard queries (show_on_dashboard + action_date + is_resolved)
CREATE INDEX IF NOT EXISTS idx_comments_dashboard 
ON myday_entry_comments(show_on_dashboard, action_date, is_resolved) 
WHERE show_on_dashboard = true AND is_resolved = false AND is_deleted = false;

-- Index for priority sorting
CREATE INDEX IF NOT EXISTS idx_comments_priority 
ON myday_entry_comments(priority);

-- Index for action_type filtering
CREATE INDEX IF NOT EXISTS idx_comments_action_type 
ON myday_entry_comments(action_type);

-- GIN index for dismissed_by JSONB queries
CREATE INDEX IF NOT EXISTS idx_comments_dismissed_by 
ON myday_entry_comments USING GIN(dismissed_by);

-- ============================================================================
-- RLS POLICIES FOR DASHBOARD FUNCTIONS
-- ============================================================================

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_dashboard_comments_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_comment_from_dashboard(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_comment_count(UUID) TO authenticated;

-- ============================================================================
-- VALIDATION
-- ============================================================================

-- Verify the table structure
DO $$
BEGIN
  -- Check that all required columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'myday_entry_comments' 
    AND column_name = 'action_date'
  ) THEN
    RAISE EXCEPTION 'Column action_date missing from myday_entry_comments';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'myday_entry_comments' 
    AND column_name = 'show_on_dashboard'
  ) THEN
    RAISE EXCEPTION 'Column show_on_dashboard missing from myday_entry_comments';
  END IF;
  
  RAISE NOTICE '✅ Phase 2 migration completed successfully';
END $$;
