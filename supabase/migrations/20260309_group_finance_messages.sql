-- ============================================================================
-- Group Finance Messages Table
-- For family/group financial chat in Safe section
-- ============================================================================

-- Create the messages table
CREATE TABLE IF NOT EXISTS myday_group_finance_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES myday_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'fd', 'account', 'alert', 'doc')),
  text TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gfm_group_id ON myday_group_finance_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_gfm_created_at ON myday_group_finance_messages(group_id, created_at DESC);

-- Enable RLS
ALTER TABLE myday_group_finance_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Group members can read messages
CREATE POLICY "Group members can read messages"
  ON myday_group_finance_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM myday_group_members
      WHERE myday_group_members.group_id = myday_group_finance_messages.group_id
      AND myday_group_members.user_id = auth.uid()
    )
  );

-- Policy: Group members can send messages
CREATE POLICY "Group members can send messages"
  ON myday_group_finance_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM myday_group_members
      WHERE myday_group_members.group_id = myday_group_finance_messages.group_id
      AND myday_group_members.user_id = auth.uid()
    )
  );

-- Enable realtime for this table (ignore error if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE myday_group_finance_messages;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- Table already in publication, ignore
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE myday_group_finance_messages IS 'Group finance chat messages for sharing FDs, accounts, alerts, and documents';
COMMENT ON COLUMN myday_group_finance_messages.type IS 'Message type: text, fd (deposit card), account (bank account), alert (maturity alert), doc (document)';
COMMENT ON COLUMN myday_group_finance_messages.payload IS 'JSON payload containing fd, account, alert, or doc data depending on type';
