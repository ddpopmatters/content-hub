-- Migration: audience simulation for Content Hub
-- Stores MiroFish content testing runs and Claude revision results

CREATE TABLE IF NOT EXISTS audience_simulations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        UUID REFERENCES entries(id) ON DELETE SET NULL,
  idea_id         UUID REFERENCES ideas(id) ON DELETE SET NULL,
  content_text    TEXT NOT NULL,
  content_type    TEXT NOT NULL CHECK (content_type IN (
                    'social_caption', 'blog_post', 'email', 'appeal', 'script', 'other'
                  )),
  segments        JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  error_message   TEXT,
  mirofish_job_id TEXT,
  results         JSONB,
  -- Iteration (Claude revision) results
  iteration_original   TEXT,
  iteration_revised    TEXT,
  iteration_diff       JSONB,
  iteration_status     TEXT CHECK (iteration_status IN ('pending','running','complete','failed')),
  iteration_error      TEXT,
  run_by          TEXT NOT NULL,
  run_by_name     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audience_simulations_entry_id
  ON audience_simulations(entry_id) WHERE entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audience_simulations_idea_id
  ON audience_simulations(idea_id) WHERE idea_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audience_simulations_created_at
  ON audience_simulations(created_at DESC);

ALTER TABLE audience_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audience_simulations_select" ON audience_simulations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "audience_simulations_insert" ON audience_simulations
  FOR INSERT TO authenticated
  WITH CHECK (run_by = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "audience_simulations_update_own" ON audience_simulations
  FOR UPDATE TO authenticated
  USING (run_by = (SELECT email FROM auth.users WHERE id = auth.uid()));
