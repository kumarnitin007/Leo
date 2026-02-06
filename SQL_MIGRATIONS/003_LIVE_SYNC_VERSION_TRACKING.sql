-- =====================================================
-- MIGRATION 003: LIVE SYNC & VERSION TRACKING
-- =====================================================
-- Run this third
-- Adds version tracking and live sync support for shared entries
-- =====================================================

-- =====================================================
-- 1. ADD VERSION TRACKING COLUMNS TO SHARED ENTRIES
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
-- 2. HELPER FUNCTION: Get all shares for an entry
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
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for finding all shares of an entry (used during propagation)
CREATE INDEX IF NOT EXISTS idx_shared_safe_entries_safe_entry_id 
  ON myday_shared_safe_entries(safe_entry_id) 
  WHERE is_active = true;

-- Index for version tracking queries
CREATE INDEX IF NOT EXISTS idx_shared_safe_entries_updated_at 
  ON myday_shared_safe_entries(last_updated_at DESC);

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check if columns were added successfully:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'myday_shared_safe_entries' 
-- AND column_name IN ('entry_category', 'entry_version', 'last_updated_by', 'last_updated_at');
