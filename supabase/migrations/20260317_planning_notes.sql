-- Shared per-day planning notes for the calendar planning layer
CREATE TABLE IF NOT EXISTS planning_notes (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  date        DATE        NOT NULL UNIQUE,
  content     TEXT        NOT NULL DEFAULT '',
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE planning_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read planning notes"
  ON planning_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert planning notes"
  ON planning_notes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update planning notes"
  ON planning_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
