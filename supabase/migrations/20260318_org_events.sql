-- Organisation-wide events for the org Gantt view
CREATE TABLE IF NOT EXISTS org_events (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'event',
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  colour      TEXT        NOT NULL DEFAULT '#6366f1',
  notes       TEXT        NOT NULL DEFAULT '',
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS org_events_start_date_idx ON org_events (start_date);

ALTER TABLE org_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Authenticated users can read org events"
  ON org_events FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Authenticated users can insert org events"
  ON org_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Authenticated users can update org events"
  ON org_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Authenticated users can delete org events"
  ON org_events FOR DELETE TO authenticated USING (true);
