-- Idempotent: ensure entries_update policy is open to all authenticated users.
-- The original 002_rls_policies.sql created a restrictive policy that only allowed
-- authors and listed approvers to update their own entries. This blocked approval
-- persistence for any user not matching author_email.
-- 20260320001_fix_entries_rls.sql was meant to fix this but may not have been applied.

DROP POLICY IF EXISTS "entries_update" ON entries;

CREATE POLICY "entries_update" ON entries
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
