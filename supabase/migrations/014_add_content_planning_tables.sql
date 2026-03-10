-- Content planning tables for strategic peaks, series, and rapid responses.

CREATE TABLE IF NOT EXISTS content_peaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  priority_tier TEXT DEFAULT 'High',
  owner TEXT,
  campaign TEXT,
  content_pillar TEXT,
  response_mode TEXT,
  required_platforms JSONB DEFAULT '[]'::jsonb,
  required_asset_types JSONB DEFAULT '[]'::jsonb,
  linked_entry_ids JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_peaks_owner
  ON content_peaks(owner);

CREATE INDEX IF NOT EXISTS idx_content_peaks_start_date
  ON content_peaks(start_date DESC);

CREATE INDEX IF NOT EXISTS idx_content_peaks_end_date
  ON content_peaks(end_date DESC);

ALTER TABLE content_peaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_peaks_select" ON content_peaks;
CREATE POLICY "content_peaks_select" ON content_peaks
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "content_peaks_insert" ON content_peaks;
CREATE POLICY "content_peaks_insert" ON content_peaks
  FOR INSERT TO authenticated
  WITH CHECK (owner = auth.jwt()->>'email');

DROP POLICY IF EXISTS "content_peaks_update" ON content_peaks;
CREATE POLICY "content_peaks_update" ON content_peaks
  FOR UPDATE TO authenticated
  USING (owner = auth.jwt()->>'email')
  WITH CHECK (owner = auth.jwt()->>'email');

DROP POLICY IF EXISTS "content_peaks_delete" ON content_peaks;
CREATE POLICY "content_peaks_delete" ON content_peaks
  FOR DELETE TO authenticated
  USING (owner = auth.jwt()->>'email');

DROP TRIGGER IF EXISTS update_content_peaks_updated_at ON content_peaks;
CREATE TRIGGER update_content_peaks_updated_at
  BEFORE UPDATE ON content_peaks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS content_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  owner TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Paused', 'Completed')),
  target_platforms JSONB DEFAULT '[]'::jsonb,
  target_episode_count INTEGER,
  review_checkpoint INTEGER DEFAULT 3,
  campaign TEXT,
  content_pillar TEXT,
  response_mode TEXT,
  linked_entry_ids JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_series_owner
  ON content_series(owner);

CREATE INDEX IF NOT EXISTS idx_content_series_status
  ON content_series(status);

ALTER TABLE content_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_series_select" ON content_series;
CREATE POLICY "content_series_select" ON content_series
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "content_series_insert" ON content_series;
CREATE POLICY "content_series_insert" ON content_series
  FOR INSERT TO authenticated
  WITH CHECK (owner = auth.jwt()->>'email');

DROP POLICY IF EXISTS "content_series_update" ON content_series;
CREATE POLICY "content_series_update" ON content_series
  FOR UPDATE TO authenticated
  USING (owner = auth.jwt()->>'email')
  WITH CHECK (owner = auth.jwt()->>'email');

DROP POLICY IF EXISTS "content_series_delete" ON content_series;
CREATE POLICY "content_series_delete" ON content_series
  FOR DELETE TO authenticated
  USING (owner = auth.jwt()->>'email');

DROP TRIGGER IF EXISTS update_content_series_updated_at ON content_series;
CREATE TRIGGER update_content_series_updated_at
  BEFORE UPDATE ON content_series
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS rapid_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  owner TEXT,
  status TEXT DEFAULT 'New' CHECK (status IN ('New', 'Drafting', 'In Review', 'Ready to Publish', 'Closed')),
  response_mode TEXT,
  trigger_date DATE,
  due_at TIMESTAMPTZ,
  sign_off_route TEXT,
  source_opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  linked_entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
  campaign TEXT,
  content_pillar TEXT,
  target_platforms JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rapid_responses_owner
  ON rapid_responses(owner);

CREATE INDEX IF NOT EXISTS idx_rapid_responses_status
  ON rapid_responses(status);

CREATE INDEX IF NOT EXISTS idx_rapid_responses_trigger_date
  ON rapid_responses(trigger_date DESC);

CREATE INDEX IF NOT EXISTS idx_rapid_responses_due_at
  ON rapid_responses(due_at DESC);

ALTER TABLE rapid_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rapid_responses_select" ON rapid_responses;
CREATE POLICY "rapid_responses_select" ON rapid_responses
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rapid_responses_insert" ON rapid_responses;
CREATE POLICY "rapid_responses_insert" ON rapid_responses
  FOR INSERT TO authenticated
  WITH CHECK (owner = auth.jwt()->>'email');

DROP POLICY IF EXISTS "rapid_responses_update" ON rapid_responses;
CREATE POLICY "rapid_responses_update" ON rapid_responses
  FOR UPDATE TO authenticated
  USING (owner = auth.jwt()->>'email')
  WITH CHECK (owner = auth.jwt()->>'email');

DROP POLICY IF EXISTS "rapid_responses_delete" ON rapid_responses;
CREATE POLICY "rapid_responses_delete" ON rapid_responses
  FOR DELETE TO authenticated
  USING (owner = auth.jwt()->>'email');

DROP TRIGGER IF EXISTS update_rapid_responses_updated_at ON rapid_responses;
CREATE TRIGGER update_rapid_responses_updated_at
  BEFORE UPDATE ON rapid_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
