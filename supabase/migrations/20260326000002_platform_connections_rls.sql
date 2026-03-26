-- Fix RLS policies for platform_connections — allow any authenticated user to manage connections
DROP POLICY IF EXISTS "platform_connections_insert" ON platform_connections;
DROP POLICY IF EXISTS "platform_connections_update" ON platform_connections;
DROP POLICY IF EXISTS "platform_connections_delete" ON platform_connections;

CREATE POLICY "platform_connections_insert" ON platform_connections
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "platform_connections_update" ON platform_connections
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "platform_connections_delete" ON platform_connections
  FOR DELETE TO authenticated
  USING (true);
