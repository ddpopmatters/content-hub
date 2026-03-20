-- Per-day draft posts on the planning calendar
CREATE TABLE IF NOT EXISTS planning_draft_posts (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  date        DATE        NOT NULL,
  platform    TEXT        NOT NULL,
  topic       TEXT        NOT NULL DEFAULT '',
  asset_type  TEXT        NOT NULL DEFAULT 'No asset',
  notes       TEXT        NOT NULL DEFAULT '',
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS planning_draft_posts_date_idx ON planning_draft_posts (date);

ALTER TABLE planning_draft_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read planning draft posts" ON planning_draft_posts;
CREATE POLICY "Authenticated users can read planning draft posts"
  ON planning_draft_posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert planning draft posts" ON planning_draft_posts;
CREATE POLICY "Authenticated users can insert planning draft posts"
  ON planning_draft_posts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update planning draft posts" ON planning_draft_posts;
CREATE POLICY "Authenticated users can update planning draft posts"
  ON planning_draft_posts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete planning draft posts" ON planning_draft_posts;
CREATE POLICY "Authenticated users can delete planning draft posts"
  ON planning_draft_posts FOR DELETE TO authenticated USING (true);
