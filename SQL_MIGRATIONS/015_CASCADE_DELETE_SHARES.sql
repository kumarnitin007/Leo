-- =====================================================
-- CASCADE DELETE: Remove shares when parent entry deleted
-- =====================================================
-- When User1 deletes their entry, all shares are removed
-- This only affects readonly shares (copy mode creates independent entries)
-- =====================================================

-- For Safe Entries: Add cascade delete from myday_encrypted_entries
-- Note: We can't add FK constraint because myday_encrypted_entries.id is UUID
-- and myday_shared_safe_entries.safe_entry_id is TEXT
-- Solution: Use a trigger instead

CREATE OR REPLACE FUNCTION cascade_delete_entry_shares()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all shares when the parent entry is deleted
  DELETE FROM myday_shared_safe_entries
  WHERE safe_entry_id = OLD.id::text;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cascade_delete_entry_shares ON myday_encrypted_entries;

CREATE TRIGGER trigger_cascade_delete_entry_shares
BEFORE DELETE ON myday_encrypted_entries
FOR EACH ROW
EXECUTE FUNCTION cascade_delete_entry_shares();

-- For Documents: Add cascade delete from myday_document_vaults
CREATE OR REPLACE FUNCTION cascade_delete_document_shares()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all shares when the parent document is deleted
  DELETE FROM myday_shared_safe_documents
  WHERE document_id = OLD.id::text;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cascade_delete_document_shares ON myday_document_vaults;

CREATE TRIGGER trigger_cascade_delete_document_shares
BEFORE DELETE ON myday_document_vaults
FOR EACH ROW
EXECUTE FUNCTION cascade_delete_document_shares();

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Cascade delete triggers created';
  RAISE NOTICE '   - myday_encrypted_entries → myday_shared_safe_entries';
  RAISE NOTICE '   - myday_document_vaults → myday_shared_safe_documents';
  RAISE NOTICE '   - When User1 deletes entry, all shares are removed';
  RAISE NOTICE '   - Copy mode entries are independent and not affected';
END $$;
