BEGIN;

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.monthly_reports FROM anon;

DROP POLICY IF EXISTS monthly_reports_select ON public.monthly_reports;
CREATE POLICY monthly_reports_select
  ON public.monthly_reports
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS monthly_reports_insert ON public.monthly_reports;
CREATE POLICY monthly_reports_insert
  ON public.monthly_reports
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS monthly_reports_update ON public.monthly_reports;
CREATE POLICY monthly_reports_update
  ON public.monthly_reports
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS monthly_reports_delete ON public.monthly_reports;
CREATE POLICY monthly_reports_delete
  ON public.monthly_reports
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);

COMMIT;
