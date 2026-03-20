-- Fix RLS policies to match collaborative team tool design.
--
-- The original window.api path used a service role key (bypassing RLS),
-- so all 18 authenticated staff had full read/write access to all entries.
-- Now that the app calls Supabase directly with user JWTs, the policies
-- must reflect that intent: any authenticated team member can manage any entry.
--
-- Additionally:
-- - entries_select previously hid soft-deleted entries (deleted_at IS NULL),
--   breaking the trash view. Changed to USING (true) — let the app filter.
-- - guidelines_admin_modify previously required is_admin(), blocking all
--   non-admin saves. Changed to allow any authenticated user.
-- - ideas_update/delete previously required created_by_email match, which
--   broke for entries with null/display-name creator fields.

-- ============================================
-- ENTRIES
-- ============================================

-- Allow all authenticated users to see all entries (including soft-deleted,
-- so the trash view works)
DROP POLICY IF EXISTS "entries_select" ON entries;
CREATE POLICY "entries_select" ON entries
  FOR SELECT TO authenticated
  USING (true);

-- Allow any authenticated team member to update any entry
DROP POLICY IF EXISTS "entries_update" ON entries;
CREATE POLICY "entries_update" ON entries
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow any authenticated team member to hard-delete any entry
DROP POLICY IF EXISTS "entries_delete" ON entries;
CREATE POLICY "entries_delete" ON entries
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- IDEAS
-- ============================================

-- Allow any authenticated team member to update any idea
DROP POLICY IF EXISTS "ideas_update" ON ideas;
CREATE POLICY "ideas_update" ON ideas
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow any authenticated team member to delete any idea
DROP POLICY IF EXISTS "ideas_delete" ON ideas;
CREATE POLICY "ideas_delete" ON ideas
  FOR DELETE TO authenticated
  USING (true);

-- ============================================
-- GUIDELINES
-- ============================================

-- Allow any authenticated team member to modify guidelines
-- (previously admin-only, but guidelines are team-shared config)
DROP POLICY IF EXISTS "guidelines_admin_modify" ON guidelines;
DROP POLICY IF EXISTS "guidelines_modify" ON guidelines;
CREATE POLICY "guidelines_modify" ON guidelines
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
