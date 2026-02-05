-- =====================================================
-- LIVE SYNC ENHANCEMENT FOR SHARED ENTRIES (Option B)
-- =====================================================
-- 
-- CONCEPT: Update Propagation Model
-- - When User1 edits an entry, automatically update all shares
-- - Each user has their own copy (snapshot)
-- - Updates propagate to all shared copies
-- - Version tracking for UI display
--
-- =====================================================

-- =====================================================
-- 1. ADD MISSING COLUMNS FROM EARLIER (if not already added)
-- =====================================================

-- Add entry_category column (from earlier session)
ALTER TABLE myday_shared_safe_entries
ADD COLUMN IF NOT EXISTS entry_category TEXT;

COMMENT ON COLUMN myday_shared_safe_entries.entry_category IS 
'Category of the shared entry. Stored directly so recipients can filter by category without RLS access to parent entry.';

-- =====================================================
-- 2. ADD VERSION TRACKING COLUMNS
-- =====================================================

ALTER TABLE myday_shared_safe_entries
ADD COLUMN IF NOT EXISTS entry_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN myday_shared_safe_entries.entry_version IS 
'Version number incremented on each update. Used to track changes and show "Updated X mins ago" in UI.';

COMMENT ON COLUMN myday_shared_safe_entries.last_updated_by IS 
'User who last updated this shared entry (could be original sharer or someone with edit permissions).';

COMMENT ON COLUMN myday_shared_safe_entries.last_updated_at IS 
'Timestamp of last update to the encrypted data. Used for "Updated X mins ago" display.';

-- =====================================================
-- 3. ADD VERSION TRACKING TO SAFE ENTRIES (for comparison)
-- =====================================================

ALTER TABLE myday_safe_entries
ADD COLUMN IF NOT EXISTS entry_version INTEGER DEFAULT 1;

COMMENT ON COLUMN myday_safe_entries.entry_version IS 
'Version number incremented on each edit. Used to detect when shared copies are out of sync.';

-- =====================================================
-- 4. CREATE FUNCTION TO UPDATE ALL SHARES WHEN ENTRY IS EDITED
-- =====================================================

CREATE OR REPLACE FUNCTION update_shared_entry_versions()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment version on the main entry
  NEW.entry_version = COALESCE(OLD.entry_version, 0) + 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment version on myday_safe_entries
DROP TRIGGER IF EXISTS increment_entry_version ON myday_safe_entries;
CREATE TRIGGER increment_entry_version
  BEFORE UPDATE ON myday_safe_entries
  FOR EACH ROW
  WHEN (OLD.encrypted_data IS DISTINCT FROM NEW.encrypted_data)
  EXECUTE FUNCTION update_shared_entry_versions();

-- =====================================================
-- 5. HELPER FUNCTION: Get all shares for an entry
-- =====================================================

CREATE OR REPLACE FUNCTION get_entry_shares(entry_uuid UUID)
RETURNS TABLE (
  share_id TEXT,
  group_id TEXT,
  shared_by UUID,
  share_mode TEXT,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    myday_shared_safe_entries.group_id,
    myday_shared_safe_entries.shared_by,
    myday_shared_safe_entries.share_mode,
    myday_shared_safe_entries.is_active
  FROM myday_shared_safe_entries
  WHERE safe_entry_id = entry_uuid
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for finding all shares of an entry (used during propagation)
CREATE INDEX IF NOT EXISTS idx_shared_safe_entries_safe_entry_id 
  ON myday_shared_safe_entries(safe_entry_id) 
  WHERE is_active = true;

-- Index for version tracking queries
CREATE INDEX IF NOT EXISTS idx_shared_safe_entries_updated_at 
  ON myday_shared_safe_entries(last_updated_at DESC);

-- =====================================================
-- USAGE NOTES
-- =====================================================

-- When User1 edits an entry:
-- 1. App updates myday_safe_entries (version auto-increments via trigger)
-- 2. App calls updateSharedEntries(entryId, newData, groupKeys) in TypeScript
-- 3. Function finds all shares and re-encrypts with each group key
-- 4. Updates myday_shared_safe_entries rows with new data + version + timestamp
-- 5. User2 sees update on next load (or via real-time listener)

-- Example query to check sync status:
-- SELECT 
--   se.id, 
--   se.title, 
--   se.entry_version as main_version,
--   sse.entry_version as shared_version,
--   sse.last_updated_at
-- FROM myday_safe_entries se
-- JOIN myday_shared_safe_entries sse ON sse.safe_entry_id = se.id
-- WHERE se.entry_version > sse.entry_version; -- Out of sync entries

-- =====================================================
-- SUMMARY OF CHANGES
-- =====================================================

-- ✅ COLUMNS ADDED TO myday_shared_safe_entries:
--    - entry_category TEXT (for filtering)
--    - entry_version INTEGER (tracks update count)
--    - last_updated_by UUID (who last edited)
--    - last_updated_at TIMESTAMPTZ (when last edited)

-- ✅ COLUMNS ADDED TO myday_safe_entries:
--    - entry_version INTEGER (tracks update count)

-- ✅ TRIGGERS CREATED:
--    - increment_entry_version (auto-increments version on edit)

-- ✅ FUNCTIONS CREATED:
--    - update_shared_entry_versions() (trigger function)
--    - get_entry_shares(entry_uuid) (helper for TypeScript)

-- ✅ INDEXES CREATED:
--    - idx_shared_safe_entries_safe_entry_id (for propagation queries)
--    - idx_shared_safe_entries_updated_at (for version tracking)

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if columns were added successfully:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'myday_shared_safe_entries' 
-- AND column_name IN ('entry_category', 'entry_version', 'last_updated_by', 'last_updated_at');

-- Check if trigger exists:
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_name = 'increment_entry_version';

-- Check if indexes exist:
-- SELECT indexname, tablename 
-- FROM pg_indexes 
-- WHERE tablename IN ('myday_shared_safe_entries', 'myday_safe_entries')
-- AND indexname LIKE 'idx_%';

-- =====================================================
-- READY TO TEST!
-- =====================================================
-- After running this SQL:
-- 1. User1 shares a password to User2 (existing functionality)
-- 2. User1 edits the password
-- 3. User2 refreshes Safe
-- 4. User2 should see blue badge: "Updated Xm ago by User1"
-- =====================================================
