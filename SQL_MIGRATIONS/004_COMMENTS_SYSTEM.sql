-- =====================================================
-- MIGRATION 004: COMMENTS & COLLABORATION SYSTEM
-- =====================================================
-- Run this fourth
-- Adds commenting system for collaborative features
-- Phase 1: MVP - Basic comments on Safe entries
-- =====================================================

-- =====================================================
-- 1. CREATE COMMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS myday_entry_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What is this about? (Polymorphic - supports Safe, Documents, Lists, etc.)
  entry_id TEXT NOT NULL, -- safe_entry_id, document_id, list_item_id, etc.
  entry_type TEXT NOT NULL, -- 'safe_entry', 'document', 'bank_list', 'todo', etc.
  entry_title TEXT, -- Cached for dashboard display (Phase 2)
  
  -- Who said it?
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_display_name TEXT, -- Cached for performance
  
  -- The message
  message TEXT NOT NULL CHECK (length(message) > 0 AND length(message) <= 500),
  
  -- Optional date field (Phase 2 - Dashboard Integration)
  action_date DATE, -- "Call me by 2026-02-15" or "Expires on 2026-03-01"
  action_type TEXT, -- 'reminder', 'deadline', 'expiry', 'follow_up', etc.
  
  -- Dashboard visibility (Phase 2)
  show_on_dashboard BOOLEAN DEFAULT true,
  dismissed_by JSONB DEFAULT '[]'::jsonb, -- Array of user_ids who dismissed this
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  
  -- Resolution
  is_resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  
  -- Priority (Phase 2 - for dashboard sorting)
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

-- =====================================================
-- 2. INDEXES FOR PERFORMANCE
-- =====================================================

-- Find comments for a specific entry
CREATE INDEX idx_entry_comments_entry 
  ON myday_entry_comments(entry_id, entry_type) 
  WHERE is_deleted = false;

-- Find comments by user
CREATE INDEX idx_entry_comments_user 
  ON myday_entry_comments(user_id) 
  WHERE is_deleted = false;

-- Dashboard queries (Phase 2)
CREATE INDEX idx_entry_comments_dashboard 
  ON myday_entry_comments(show_on_dashboard, action_date) 
  WHERE is_deleted = false AND is_resolved = false;

-- Recent comments
CREATE INDEX idx_entry_comments_created 
  ON myday_entry_comments(created_at DESC);

-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE myday_entry_comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on entries they have access to
CREATE POLICY "Users can view comments on accessible entries"
  ON myday_entry_comments FOR SELECT
  USING (
    -- For safe entries: Can see if they're in a group that has access
    (entry_type = 'safe_entry' AND (
      -- User owns the entry
      EXISTS (
        SELECT 1 FROM myday_safe_entries se
        WHERE se.id = entry_id::uuid
          AND se.user_id = auth.uid()
      )
      OR
      -- User is in a group that has access to this entry
      EXISTS (
        SELECT 1 FROM myday_shared_safe_entries sse
        JOIN myday_group_members gm ON gm.group_id = sse.group_id
        WHERE sse.safe_entry_id = entry_id
          AND gm.user_id = auth.uid()
          AND sse.is_active = true
      )
    ))
    -- Future: Add similar logic for documents, bank lists, etc.
  );

-- Users can add comments to entries they can access
CREATE POLICY "Users can add comments to accessible entries"
  ON myday_entry_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND
    -- Same access check as SELECT policy
    (entry_type = 'safe_entry' AND (
      EXISTS (
        SELECT 1 FROM myday_safe_entries se
        WHERE se.id = entry_id::uuid
          AND se.user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM myday_shared_safe_entries sse
        JOIN myday_group_members gm ON gm.group_id = sse.group_id
        WHERE sse.safe_entry_id = entry_id
          AND gm.user_id = auth.uid()
          AND sse.is_active = true
      )
    ))
  );

-- Users can edit their own comments (within reasonable time)
CREATE POLICY "Users can edit own comments"
  ON myday_entry_comments FOR UPDATE
  USING (
    user_id = auth.uid()
    -- Optional: Add time limit for edits (e.g., within 5 minutes)
    -- AND created_at > NOW() - INTERVAL '5 minutes'
  );

-- Users can soft-delete their own comments
CREATE POLICY "Users can delete own comments"
  ON myday_entry_comments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 4. HELPER FUNCTIONS
-- =====================================================

-- Get comment count for an entry
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

-- Get unresolved comment count for an entry
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

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
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

-- Check if table was created:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name = 'myday_entry_comments';

-- Check indexes:
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'myday_entry_comments';

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE tablename = 'myday_entry_comments';

-- =====================================================
-- USAGE NOTES
-- =====================================================

-- Phase 1 (MVP): Basic comments on Safe entries
-- - Users can add/view/edit/delete comments
-- - Comments visible to all group members
-- - Simple message text only

-- Phase 2 (Dashboard Integration): To be added later
-- - Optional action_date field
-- - Priority levels
-- - Dashboard visibility controls
-- - Dismissed_by tracking

-- Phase 3 (Cross-Feature): To be added later
-- - Extend to documents
-- - Extend to bank lists
-- - Extend to other features

-- =====================================================
-- EXAMPLE QUERIES
-- =====================================================

-- Add a comment:
-- INSERT INTO myday_entry_comments (entry_id, entry_type, user_id, user_display_name, message)
-- VALUES ('entry-uuid', 'safe_entry', auth.uid(), 'John Doe', 'Password doesn''t work');

-- Get comments for an entry:
-- SELECT * FROM myday_entry_comments 
-- WHERE entry_id = 'entry-uuid' 
-- AND entry_type = 'safe_entry'
-- AND is_deleted = false
-- ORDER BY created_at DESC;

-- Mark comment as resolved:
-- UPDATE myday_entry_comments 
-- SET is_resolved = true, resolved_by = auth.uid(), resolved_at = NOW()
-- WHERE id = 'comment-uuid';
