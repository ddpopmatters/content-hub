-- Content request intake briefs for internal teams.

CREATE TABLE IF NOT EXISTS content_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  key_messages TEXT,
  assets_needed TEXT,
  audience_segments JSONB DEFAULT '[]'::jsonb,
  approvers JSONB DEFAULT '[]'::jsonb,
  deadline DATE,
  notes TEXT,
  generated_brief TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Converted', 'Declined')),
  created_by TEXT,
  created_by_email TEXT,
  converted_entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE content_requests
  ALTER COLUMN generated_brief SET NOT NULL;

ALTER TABLE content_requests
  ADD CONSTRAINT content_requests_audience_segments_is_array
  CHECK (audience_segments IS NULL OR jsonb_typeof(audience_segments) = 'array');

ALTER TABLE content_requests
  ADD CONSTRAINT content_requests_approvers_is_array
  CHECK (approvers IS NULL OR jsonb_typeof(approvers) = 'array');

CREATE INDEX IF NOT EXISTS idx_content_requests_status
  ON content_requests(status);

CREATE INDEX IF NOT EXISTS idx_content_requests_deadline
  ON content_requests(deadline);

CREATE INDEX IF NOT EXISTS idx_content_requests_created_at
  ON content_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_requests_converted_entry_id
  ON content_requests(converted_entry_id);

ALTER TABLE content_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_requests_select" ON content_requests;
CREATE POLICY "content_requests_select" ON content_requests
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "content_requests_insert" ON content_requests;
CREATE POLICY "content_requests_insert" ON content_requests
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "content_requests_update" ON content_requests;
CREATE POLICY "content_requests_update" ON content_requests
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "content_requests_delete" ON content_requests;
CREATE POLICY "content_requests_delete" ON content_requests
  FOR DELETE TO authenticated
  USING (
    created_by_email = current_user_email()
    OR is_admin()
  );

DROP TRIGGER IF EXISTS update_content_requests_updated_at ON content_requests;
CREATE TRIGGER update_content_requests_updated_at
  BEFORE UPDATE ON content_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
