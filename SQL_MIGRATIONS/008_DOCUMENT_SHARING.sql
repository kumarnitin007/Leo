-- Document Sharing Implementation
-- Mirrors the Safe Entry sharing architecture with group encryption

-- ============================================================================
-- SHARED DOCUMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS myday_shared_safe_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL, -- Reference to myday_document_vaults.id
  group_id TEXT NOT NULL REFERENCES myday_groups(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL,
  share_mode TEXT NOT NULL CHECK (share_mode IN ('readonly', 'readwrite')),
  
  -- Group-encrypted document data
  group_encrypted_data TEXT NOT NULL,
  group_encrypted_data_iv TEXT NOT NULL,
  
  -- Cached metadata for quick access
  document_title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  
  -- Version tracking for live sync
  document_version INTEGER DEFAULT 1,
  last_updated_by UUID,
  last_updated_at TIMESTAMPTZ,
  
  shared_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(document_id, group_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shared_documents_document ON myday_shared_safe_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_shared_documents_group ON myday_shared_safe_documents(group_id);
CREATE INDEX IF NOT EXISTS idx_shared_documents_shared_by ON myday_shared_safe_documents(shared_by);
CREATE INDEX IF NOT EXISTS idx_shared_documents_version ON myday_shared_safe_documents(document_version);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE myday_shared_safe_documents ENABLE ROW LEVEL SECURITY;

-- Users can view documents shared with their groups
CREATE POLICY "Users can view shared documents in their groups"
ON myday_shared_safe_documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM myday_group_members
    WHERE group_id = myday_shared_safe_documents.group_id
    AND user_id = auth.uid()
  )
);

-- Users can share their own documents
CREATE POLICY "Users can share their own documents"
ON myday_shared_safe_documents FOR INSERT
  WITH CHECK (
    auth.uid() = shared_by
    AND EXISTS (
      SELECT 1 FROM myday_document_vaults
      WHERE id = document_id AND user_id = auth.uid()
    )
  );

-- Document owners can update shared documents
CREATE POLICY "Document owners can update shared documents"
ON myday_shared_safe_documents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM myday_document_vaults
      WHERE id = document_id AND user_id = auth.uid()
    )
  );

-- Document owners can delete shares
CREATE POLICY "Document owners can delete shares"
ON myday_shared_safe_documents FOR DELETE
  USING (
    auth.uid() = shared_by
    OR EXISTS (
      SELECT 1 FROM myday_document_vaults
      WHERE id = document_id AND user_id = auth.uid()
    )
  );

-- ============================================================================
-- CASCADE DELETE TRIGGER
-- ============================================================================

-- When a document is deleted, delete all its shares
CREATE OR REPLACE FUNCTION delete_document_shares()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM myday_shared_safe_documents
  WHERE document_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_delete_document_shares
BEFORE DELETE ON myday_document_vaults
FOR EACH ROW
EXECUTE FUNCTION delete_document_shares();

-- ============================================================================
-- VERSION TRACKING TRIGGER
-- ============================================================================

-- Increment version when shared document is updated
CREATE OR REPLACE FUNCTION increment_shared_document_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.group_encrypted_data != NEW.group_encrypted_data THEN
    NEW.document_version := OLD.document_version + 1;
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_shared_document_version
BEFORE UPDATE ON myday_shared_safe_documents
FOR EACH ROW
EXECUTE FUNCTION increment_shared_document_version();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get all shares for a document
CREATE OR REPLACE FUNCTION get_document_shares(p_document_id TEXT)
RETURNS TABLE (
  share_id UUID,
  group_id UUID,
  group_name TEXT,
  share_mode TEXT,
  shared_at TIMESTAMPTZ,
  member_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ssd.id as share_id,
    ssd.group_id,
    g.name as group_name,
    ssd.share_mode,
    ssd.shared_at,
    COUNT(gm.user_id) as member_count
  FROM myday_shared_safe_documents ssd
  JOIN myday_groups g ON g.id = ssd.group_id
  LEFT JOIN myday_group_members gm ON gm.group_id = ssd.group_id
  WHERE ssd.document_id = p_document_id
  GROUP BY ssd.id, ssd.group_id, g.name, ssd.share_mode, ssd.shared_at
  ORDER BY ssd.shared_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if document has active shares
CREATE OR REPLACE FUNCTION document_has_active_shares(p_document_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM myday_shared_safe_documents
    WHERE document_id = p_document_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get share count for a document
CREATE OR REPLACE FUNCTION get_document_share_count(p_document_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT group_id)::INTEGER INTO v_count
  FROM myday_shared_safe_documents
  WHERE document_id = p_document_id;
  
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE ACCESS CONTROL FOR COMMENTS
-- ============================================================================

-- Update the user_has_document_access function to include shared documents
CREATE OR REPLACE FUNCTION user_has_document_access(p_user_id UUID, p_document_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- User owns the document OR document is shared with user's group
  RETURN EXISTS (
    SELECT 1 FROM myday_document_vaults
    WHERE id = p_document_id AND user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 
    FROM myday_shared_safe_documents ssd
    JOIN myday_group_members gm ON gm.group_id = ssd.group_id
    WHERE ssd.document_id = p_document_id AND gm.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_document_shares(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION document_has_active_shares(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_document_share_count(TEXT) TO authenticated;

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Document sharing migration completed successfully';
  RAISE NOTICE '   - myday_shared_safe_documents table created';
  RAISE NOTICE '   - RLS policies configured';
  RAISE NOTICE '   - Cascade delete trigger added';
  RAISE NOTICE '   - Version tracking enabled';
  RAISE NOTICE '   - Helper functions created';
END $$;
