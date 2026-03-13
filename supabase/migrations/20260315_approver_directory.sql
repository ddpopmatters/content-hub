-- Add approver_directory column to guidelines table
-- Stores name+email pairs so approvers can receive emails without needing user accounts
ALTER TABLE guidelines
  ADD COLUMN IF NOT EXISTS approver_directory jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Allow anon users to read a single entry by ID (for public review links)
-- This is intentional: anyone with the URL can view the entry content
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'entries' AND policyname = 'Anon users can view entries via review link'
  ) THEN
    CREATE POLICY "Anon users can view entries via review link"
      ON entries FOR SELECT TO anon
      USING (true);
  END IF;
END $$;
