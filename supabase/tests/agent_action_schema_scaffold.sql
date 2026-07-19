-- Minimal isolated schema used only to validate the generated agent-action migration.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;

CREATE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$ SELECT current_user::text $$;

CREATE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TABLE public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  asset_type TEXT NOT NULL DEFAULT 'No asset',
  caption TEXT,
  platform_captions JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_comment TEXT,
  approval_deadline DATE,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  approvers JSONB NOT NULL DEFAULT '[]'::jsonb,
  author TEXT,
  author_email TEXT,
  campaign TEXT,
  content_pillar TEXT,
  priority_tier TEXT,
  url TEXT,
  content_category TEXT,
  response_mode TEXT,
  sign_off_route TEXT,
  audience_segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_verified BOOLEAN,
  link_placement TEXT,
  cta_type TEXT,
  script TEXT,
  design_copy TEXT,
  carousel_slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  workflow_status TEXT NOT NULL DEFAULT 'Draft'
    CHECK (workflow_status IN ('Draft', 'In Review', 'Approved', 'Scheduled', 'Published')),
  comments JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_revision BIGINT NOT NULL DEFAULT 1,
  approved_revision BIGINT,
  approved_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION public.test_entry_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.caption IS DISTINCT FROM OLD.caption
    OR NEW.platforms IS DISTINCT FROM OLD.platforms
    OR NEW.first_comment IS DISTINCT FROM OLD.first_comment
  THEN
    NEW.content_revision := OLD.content_revision + 1;
    NEW.approved_revision := NULL;
    NEW.approved_at := NULL;
    NEW.status := 'Pending';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER test_entry_revision
  BEFORE UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION public.test_entry_revision();
CREATE TRIGGER update_entries_updated_at
  BEFORE UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT,
  title TEXT NOT NULL,
  notes TEXT,
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  inspiration TEXT,
  created_by TEXT,
  created_by_email TEXT,
  target_date DATE,
  target_month TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('monthly', 'quarterly', 'annual', 'campaign')),
  period_month INTEGER,
  period_quarter INTEGER,
  period_year INTEGER NOT NULL,
  campaign_name TEXT,
  date_from DATE,
  date_to DATE,
  platform_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  qualitative JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE UNIQUE INDEX monthly_reports_period_idx ON public.monthly_reports (
  report_type,
  period_year,
  COALESCE(period_month, 0),
  COALESCE(period_quarter, 0),
  COALESCE(campaign_name, '')
);
CREATE TRIGGER update_monthly_reports_updated_at
  BEFORE UPDATE ON public.monthly_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  target_title TEXT,
  actor_email TEXT NOT NULL,
  actor_name TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  related_users JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.entries TO authenticated;
CREATE POLICY test_entries_authenticated ON public.entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
