-- Phase 3: Cross-Feature Extension
-- Extend comments system to Documents, Bank Lists, TODOs, and other features

-- ============================================================================
-- SCHEMA VALIDATION & EXTENSION
-- ============================================================================

-- The myday_entry_comments table already supports multiple entry_types via the entry_type column
-- We just need to ensure the RLS policies cover all entry types

-- Add check constraint to validate entry_types (informational, not enforced strictly)
DO $$
BEGIN
  -- Add a comment documenting supported entry types
  COMMENT ON COLUMN myday_entry_comments.entry_type IS 
    'Supported types: safe_entry, safe_document, bank_list, todo, event, resolution, journal, routine, gift_card';
END $$;

-- ============================================================================
-- HELPER FUNCTIONS FOR CROSS-FEATURE ACCESS CONTROL
-- ============================================================================

-- Function: Check if user has access to a document
CREATE OR REPLACE FUNCTION user_has_document_access(p_user_id UUID, p_document_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- User owns the document OR document is shared with user's group
  RETURN EXISTS (
    SELECT 1 FROM myday_safe_documents
    WHERE id = p_document_id AND user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 
    FROM myday_shared_safe_documents ssd
    JOIN myday_group_members gm ON gm.group_id = ssd.group_id
    WHERE ssd.document_id = p_document_id AND gm.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user has access to a todo
CREATE OR REPLACE FUNCTION user_has_todo_access(p_user_id UUID, p_todo_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- User owns the todo OR todo is shared with user
  RETURN EXISTS (
    SELECT 1 FROM myday_todos
    WHERE id = p_todo_id AND user_id = p_user_id
  );
  -- Note: Add shared todo logic when sharing is implemented
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user has access to an event
CREATE OR REPLACE FUNCTION user_has_event_access(p_user_id UUID, p_event_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- User owns the event OR event is shared with user
  RETURN EXISTS (
    SELECT 1 FROM myday_events
    WHERE id = p_event_id AND user_id = p_user_id
  );
  -- Note: Add shared event logic when sharing is implemented
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user has access to any entry (universal access checker)
CREATE OR REPLACE FUNCTION user_has_entry_access(p_user_id UUID, p_entry_id TEXT, p_entry_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  CASE p_entry_type
    WHEN 'safe_entry' THEN
      RETURN EXISTS (
        SELECT 1 FROM myday_safe_entries WHERE id = p_entry_id AND user_id = p_user_id
      ) OR EXISTS (
        SELECT 1 FROM myday_shared_safe_entries sse
        JOIN myday_group_members gm ON gm.group_id = sse.group_id
        WHERE sse.safe_entry_id = p_entry_id AND gm.user_id = p_user_id
      );
    
    WHEN 'safe_document' THEN
      RETURN user_has_document_access(p_user_id, p_entry_id);
    
    WHEN 'todo' THEN
      RETURN user_has_todo_access(p_user_id, p_entry_id);
    
    WHEN 'event' THEN
      RETURN user_has_event_access(p_user_id, p_entry_id);
    
    ELSE
      -- For other types (journal, resolution, routine, gift_card), check basic ownership
      -- These tables might not exist yet, so we use dynamic SQL with exception handling
      BEGIN
        EXECUTE format('SELECT EXISTS(SELECT 1 FROM myday_%ss WHERE id = $1 AND user_id = $2)', 
                      CASE 
                        WHEN p_entry_type = 'bank_list' THEN 'bank_item'
                        ELSE p_entry_type 
                      END)
        INTO RETURN
        USING p_entry_id, p_user_id;
        RETURN COALESCE(RETURN, FALSE);
      EXCEPTION WHEN OTHERS THEN
        -- Table doesn't exist, deny access
        RETURN FALSE;
      END;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATED RLS POLICIES (Replace existing policies)
-- ============================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view comments on entries they have access to" ON myday_entry_comments;
DROP POLICY IF EXISTS "Users can add comments to entries they have access to" ON myday_entry_comments;
DROP POLICY IF EXISTS "Users can edit their own comments" ON myday_entry_comments;
DROP POLICY IF EXISTS "Users can soft-delete their own comments" ON myday_entry_comments;

-- Create new universal policies using the access checker function
CREATE POLICY "Users can view comments on entries they have access to"
ON myday_entry_comments FOR SELECT
USING (
  user_has_entry_access(auth.uid(), entry_id, entry_type)
);

CREATE POLICY "Users can add comments to entries they have access to"
ON myday_entry_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND user_has_entry_access(auth.uid(), entry_id, entry_type)
);

CREATE POLICY "Users can edit their own comments"
ON myday_entry_comments FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can soft-delete their own comments"
ON myday_entry_comments FOR UPDATE
USING (auth.uid() = user_id AND deleted_at IS NULL)
WITH CHECK (deleted_at IS NOT NULL);

-- ============================================================================
-- HELPER FUNCTIONS FOR ENTRY TITLE FETCHING (Cross-Feature)
-- ============================================================================

-- Function: Get entry title for any entry type
CREATE OR REPLACE FUNCTION get_entry_title(p_entry_id TEXT, p_entry_type TEXT)
RETURNS TEXT AS $$
DECLARE
  v_title TEXT;
BEGIN
  CASE p_entry_type
    WHEN 'safe_entry' THEN
      SELECT title INTO v_title FROM myday_safe_entries WHERE id = p_entry_id;
    WHEN 'safe_document' THEN
      SELECT filename INTO v_title FROM myday_safe_documents WHERE id = p_entry_id;
    WHEN 'todo' THEN
      SELECT title INTO v_title FROM myday_todos WHERE id = p_entry_id;
    WHEN 'event' THEN
      SELECT title INTO v_title FROM myday_events WHERE id = p_entry_id;
    WHEN 'journal' THEN
      SELECT title INTO v_title FROM myday_journals WHERE id = p_entry_id;
    WHEN 'resolution' THEN
      SELECT title INTO v_title FROM myday_resolutions WHERE id = p_entry_id;
    WHEN 'routine' THEN
      SELECT title INTO v_title FROM myday_routines WHERE id = p_entry_id;
    WHEN 'gift_card' THEN
      SELECT merchant INTO v_title FROM myday_gift_cards WHERE id = p_entry_id;
    ELSE
      v_title := 'Unknown Entry';
  END CASE;
  
  RETURN COALESCE(v_title, 'Untitled');
EXCEPTION WHEN OTHERS THEN
  RETURN 'Entry';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PERFORMANCE INDEXES FOR CROSS-FEATURE QUERIES
-- ============================================================================

-- Index for entry_type filtering (already exists from Phase 1, but ensure it's there)
CREATE INDEX IF NOT EXISTS idx_comments_entry_type ON myday_entry_comments(entry_type);

-- Composite index for entry lookups
CREATE INDEX IF NOT EXISTS idx_comments_entry_lookup 
ON myday_entry_comments(entry_id, entry_type) 
WHERE deleted_at IS NULL;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION user_has_document_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_todo_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_event_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_entry_access(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_entry_title(TEXT, TEXT) TO authenticated;

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 3 migration completed successfully';
  RAISE NOTICE '   - Cross-feature access control functions created';
  RAISE NOTICE '   - RLS policies updated for universal entry access';
  RAISE NOTICE '   - Helper functions for title fetching added';
END $$;
