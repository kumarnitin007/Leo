-- =====================================================
-- MIGRATION 004: COMMENTS SYSTEM
-- =====================================================
-- Run this fourth
-- Fixed: Proper table references for myday_encrypted_entries
-- =====================================================

-- =====================================================
-- 1. CREATE COMMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS myday_entry_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What is this about?
  entry_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  entry_title TEXT,
  
  -- Who said it?
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_display_name TEXT,
  
  -- The message
  message TEXT NOT NULL CHECK (length(message) > 0 AND length(message) <= 500),
  
  -- Optional fields (Phase 2)
  action_date DATE,
  action_type TEXT,
  show_on_dashboard BOOLEAN DEFAULT true,
  dismissed_by JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  
  -- Resolution
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  
  -- Priority
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- =====================================================
-- 2. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_entry_comments_entry 
  ON myday_entry_comments(entry_id, entry_type) 
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_entry_comments_user 
  ON myday_entry_comments(user_id) 
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_entry_comments_dashboard 
  ON myday_entry_comments(show_on_dashboard, action_date) 
  WHERE is_deleted = false AND is_resolved = false;

CREATE INDEX IF NOT EXISTS idx_entry_comments_created 
  ON myday_entry_comments(created_at DESC);

-- =====================================================
-- 3. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE myday_entry_comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on entries they have access to
CREATE POLICY "Users can view comments on accessible entries"
  ON myday_entry_comments FOR SELECT
  USING (
    -- User owns the entry (check myday_encrypted_entries)
    EXISTS (
      SELECT 1 FROM myday_encrypted_entries ee
      WHERE ee.id::text = myday_entry_comments.entry_id
        AND ee.user_id = auth.uid()
    )
    OR
    -- User is in a group that has access (check myday_shared_safe_entries)
    EXISTS (
      SELECT 1 FROM myday_shared_safe_entries sse
      JOIN myday_group_members gm ON gm.group_id = sse.group_id
      WHERE sse.safe_entry_id = myday_entry_comments.entry_id
        AND gm.user_id = auth.uid()
    )
  );

-- Users can add comments to entries they can access
CREATE POLICY "Users can add comments to accessible entries"
  ON myday_entry_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND
    (
      -- User owns the entry
      EXISTS (
        SELECT 1 FROM myday_encrypted_entries ee
        WHERE ee.id::text = myday_entry_comments.entry_id
          AND ee.user_id = auth.uid()
      )
      OR
      -- User is in a group that has access
      EXISTS (
        SELECT 1 FROM myday_shared_safe_entries sse
        JOIN myday_group_members gm ON gm.group_id = sse.group_id
        WHERE sse.safe_entry_id = myday_entry_comments.entry_id
          AND gm.user_id = auth.uid()
      )
    )
  );

-- Users can edit their own comments
CREATE POLICY "Users can edit own comments"
  ON myday_entry_comments FOR UPDATE
  USING (user_id = auth.uid());

-- Users can soft-delete their own comments
CREATE POLICY "Users can delete own comments"
  ON myday_entry_comments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 4. HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION get_entry_comment_count(
  p_entry_id TEXT,
  p_entry_type TEXT
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM myday_entry_comments
    WHERE entry_id = p_entry_id
      AND entry_type = p_entry_type
      AND is_deleted = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_entry_unresolved_comment_count(
  p_entry_id TEXT,
  p_entry_type TEXT
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM myday_entry_comments
    WHERE entry_id = p_entry_id
      AND entry_type = p_entry_type
      AND is_deleted = false
      AND is_resolved = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_entry_comment_count(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_entry_unresolved_comment_count(TEXT, TEXT) TO authenticated;

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_entry_comment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_entry_comment_timestamp ON myday_entry_comments;
CREATE TRIGGER trigger_update_entry_comment_timestamp
  BEFORE UPDATE ON myday_entry_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_entry_comment_timestamp();

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 004 completed successfully';
  RAISE NOTICE '   - myday_entry_comments table created';
  RAISE NOTICE '   - RLS policies configured for myday_encrypted_entries';
  RAISE NOTICE '   - Helper functions created';
END $$;
