-- =====================================================
-- FIX: Remaining myday_safe_entries references
-- =====================================================
-- Fix references in functions from 005 and 006
-- =====================================================

-- Fix user_has_entry_access function (from 006)
-- Note: CASCADE will drop dependent RLS policies, which will be recreated by this migration
DROP FUNCTION IF EXISTS user_has_entry_access(uuid, text, text) CASCADE;

CREATE OR REPLACE FUNCTION user_has_entry_access(p_user_id UUID, p_entry_id TEXT, p_entry_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  CASE p_entry_type
    WHEN 'safe_entry' THEN
      RETURN EXISTS (
        SELECT 1 FROM myday_encrypted_entries WHERE id::text = p_entry_id AND user_id = p_user_id
      ) OR EXISTS (
        SELECT 1 FROM myday_shared_safe_entries sse
        JOIN myday_group_members gm ON gm.group_id = sse.group_id
        WHERE sse.safe_entry_id = p_entry_id AND gm.user_id = p_user_id
      );
    
    WHEN 'safe_document' THEN
      RETURN user_has_document_access(p_user_id, p_entry_id);
    
    WHEN 'document' THEN
      RETURN user_has_document_access(p_user_id, p_entry_id);
    
    WHEN 'todo' THEN
      RETURN user_has_todo_access(p_user_id, p_entry_id);
    
    WHEN 'event' THEN
      RETURN user_has_event_access(p_user_id, p_entry_id);
    
    WHEN 'journal' THEN
      RETURN user_has_journal_access(p_user_id, p_entry_id);
    
    WHEN 'resolution' THEN
      RETURN user_has_resolution_access(p_user_id, p_entry_id);
    
    WHEN 'routine' THEN
      RETURN user_has_routine_access(p_user_id, p_entry_id);
    
    WHEN 'gift_card' THEN
      RETURN user_has_item_access(p_user_id, p_entry_id);
    
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix get_dashboard_comments_for_user function (from 005)
DROP FUNCTION IF EXISTS get_dashboard_comments_for_user(uuid);

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
  is_resolved BOOLEAN
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
    c.is_resolved
  FROM myday_entry_comments c
  WHERE c.show_on_dashboard = true
    AND c.is_deleted = false
    AND (
      -- User is in a group that has access to the entry
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
        FROM myday_encrypted_entries se
        WHERE se.id::text = c.entry_id
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
    c.action_date ASC NULLS LAST,
    c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix get_dashboard_comment_count function (from 005)
DROP FUNCTION IF EXISTS get_dashboard_comment_count(uuid);

CREATE OR REPLACE FUNCTION get_dashboard_comment_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM myday_entry_comments c
  WHERE c.show_on_dashboard = true
    AND c.is_deleted = false
    AND c.is_resolved = false
    AND NOT (c.dismissed_by @> jsonb_build_array(p_user_id::text))
    AND (
      -- User is in a group that has access
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
        FROM myday_encrypted_entries se
        WHERE se.id::text = c.entry_id
        AND se.user_id = p_user_id
      )
    );
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- RECREATE POLICIES (dropped by CASCADE)
-- =====================================================

-- Recreate comment policies that depend on user_has_entry_access
CREATE POLICY "Users can view comments on entries they have access to"
  ON myday_entry_comments FOR SELECT
  USING (
    is_deleted = false
    AND user_has_entry_access(auth.uid(), entry_id, entry_type)
  );

CREATE POLICY "Users can add comments to entries they have access to"
  ON myday_entry_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_has_entry_access(auth.uid(), entry_id, entry_type)
  );

-- Recreate reaction policy
CREATE POLICY "Users can view reactions on comments they can see"
  ON myday_comment_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM myday_entry_comments c
      WHERE c.id = myday_comment_reactions.comment_id
        AND user_has_entry_access(auth.uid(), c.entry_id, c.entry_type)
    )
  );

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Fixed remaining table references';
  RAISE NOTICE '   - user_has_entry_access: myday_safe_entries → myday_encrypted_entries';
  RAISE NOTICE '   - get_dashboard_comments_for_user: myday_safe_entries → myday_encrypted_entries';
  RAISE NOTICE '   - get_dashboard_comment_count: myday_safe_entries → myday_encrypted_entries';
  RAISE NOTICE '   - Added ::text casting for UUID comparisons';
  RAISE NOTICE '   - Recreated dependent RLS policies';
END $$;
