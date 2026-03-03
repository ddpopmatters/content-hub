-- Opportunity Radar: reactive moments that can be converted into content.

CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  angle TEXT,
  urgency TEXT DEFAULT 'Medium' CHECK (urgency IN ('High', 'Medium', 'Low')),
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'Acted', 'Dismissed')),
  created_by TEXT,
  created_by_email TEXT,
  linked_entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_urgency_date ON opportunities(urgency, date DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_linked_entry_id ON opportunities(linked_entry_id);

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opportunities_select" ON opportunities;
CREATE POLICY "opportunities_select" ON opportunities
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "opportunities_insert" ON opportunities;
CREATE POLICY "opportunities_insert" ON opportunities
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "opportunities_update" ON opportunities;
CREATE POLICY "opportunities_update" ON opportunities
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "opportunities_delete" ON opportunities;
CREATE POLICY "opportunities_delete" ON opportunities
  FOR DELETE TO authenticated
  USING (
    created_by_email = current_user_email()
    OR is_admin()
  );

DROP TRIGGER IF EXISTS update_opportunities_updated_at ON opportunities;
CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
