BEGIN;

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  IF NOT (
    SELECT relrowsecurity
      FROM pg_class
     WHERE oid = 'public.monthly_reports'::regclass
  ) THEN
    RAISE EXCEPTION 'monthly_reports RLS is disabled';
  END IF;

  SELECT count(*)
    INTO policy_count
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'monthly_reports';

  IF policy_count <> 4 THEN
    RAISE EXCEPTION 'monthly_reports does not have exactly four authenticated-only policies';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'monthly_reports'
       AND policyname = 'monthly_reports_select'
       AND cmd = 'SELECT'
       AND roles = ARRAY['authenticated']::name[]
       AND qual LIKE '%auth.uid()%IS NOT NULL%'
       AND with_check IS NULL
  ) OR NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'monthly_reports'
       AND policyname = 'monthly_reports_insert'
       AND cmd = 'INSERT'
       AND roles = ARRAY['authenticated']::name[]
       AND qual IS NULL
       AND with_check LIKE '%auth.uid()%IS NOT NULL%'
  ) OR NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'monthly_reports'
       AND policyname = 'monthly_reports_update'
       AND cmd = 'UPDATE'
       AND roles = ARRAY['authenticated']::name[]
       AND qual LIKE '%auth.uid()%IS NOT NULL%'
       AND with_check LIKE '%auth.uid()%IS NOT NULL%'
  ) OR NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'monthly_reports'
       AND policyname = 'monthly_reports_delete'
       AND cmd = 'DELETE'
       AND roles = ARRAY['authenticated']::name[]
       AND qual LIKE '%auth.uid()%IS NOT NULL%'
       AND with_check IS NULL
  ) THEN
    RAISE EXCEPTION 'monthly_reports policy commands or identity predicates are incorrect';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'monthly_reports'
       AND (
         coalesce(qual, '') ~ '(^|[ (])true([ )]|$)'
         OR coalesce(with_check, '') ~ '(^|[ (])true([ )]|$)'
       )
  ) THEN
    RAISE EXCEPTION 'monthly_reports retains an always-true policy predicate';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_class AS relation
      CROSS JOIN LATERAL aclexplode(
        coalesce(relation.relacl, acldefault('r', relation.relowner))
      ) AS privilege
     WHERE relation.oid = 'public.monthly_reports'::regclass
       AND privilege.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'anon')
  ) THEN
    RAISE EXCEPTION 'anon retains a monthly_reports table privilege';
  END IF;

  IF has_table_privilege('anon', 'public.monthly_reports', 'SELECT')
    OR has_table_privilege('anon', 'public.monthly_reports', 'INSERT')
    OR has_table_privilege('anon', 'public.monthly_reports', 'UPDATE')
    OR has_table_privilege('anon', 'public.monthly_reports', 'DELETE')
    OR has_table_privilege('anon', 'public.monthly_reports', 'TRUNCATE')
    OR has_table_privilege('anon', 'public.monthly_reports', 'REFERENCES')
    OR has_table_privilege('anon', 'public.monthly_reports', 'TRIGGER')
  THEN
    RAISE EXCEPTION 'anon inherits a monthly_reports table privilege';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.monthly_reports', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.monthly_reports', 'INSERT')
    OR NOT has_table_privilege('service_role', 'public.monthly_reports', 'UPDATE')
    OR NOT has_table_privilege('service_role', 'public.monthly_reports', 'DELETE')
  THEN
    RAISE EXCEPTION 'service_role lost monthly_reports CRUD privileges';
  END IF;
END;
$$;

SET LOCAL ROLE anon;

DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.monthly_reports;
    RAISE EXCEPTION 'anon read monthly_reports';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$;

RESET ROLE;

INSERT INTO public.monthly_reports (
  id,
  report_type,
  period_year,
  campaign_name,
  platform_metrics,
  qualitative
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  'campaign',
  2099,
  'RLS invariant fixture',
  '{}'::jsonb,
  '{}'::jsonb
);

SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"20000000-0000-0000-0000-000000000001"}',
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF (
    SELECT count(*)
      FROM public.monthly_reports
     WHERE id = '30000000-0000-0000-0000-000000000001'
  ) <> 1 THEN
    RAISE EXCEPTION 'active user cannot read shared reports';
  END IF;
END;
$$;

INSERT INTO public.monthly_reports (
  id,
  report_type,
  period_year,
  campaign_name,
  platform_metrics,
  qualitative
) VALUES (
  '30000000-0000-0000-0000-000000000002',
  'campaign',
  2099,
  'Active user RLS test',
  '{}'::jsonb,
  '{}'::jsonb
);

UPDATE public.monthly_reports
   SET campaign_name = 'Active user RLS test updated'
 WHERE id = '30000000-0000-0000-0000-000000000002';

DO $$
BEGIN
  IF (
    SELECT campaign_name
      FROM public.monthly_reports
     WHERE id = '30000000-0000-0000-0000-000000000002'
  ) <> 'Active user RLS test updated' THEN
    RAISE EXCEPTION 'authenticated user update did not affect its target';
  END IF;
END;
$$;

DELETE FROM public.monthly_reports
 WHERE id = '30000000-0000-0000-0000-000000000002';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.monthly_reports
     WHERE id = '30000000-0000-0000-0000-000000000002'
  ) THEN
    RAISE EXCEPTION 'authenticated user delete did not affect its target';
  END IF;
END;
$$;

RESET ROLE;

INSERT INTO public.monthly_reports (
  id,
  report_type,
  period_year,
  campaign_name,
  platform_metrics,
  qualitative
) VALUES (
  '30000000-0000-0000-0000-000000000003',
  'campaign',
  2099,
  'Missing identity RLS test',
  '{}'::jsonb,
  '{}'::jsonb
);

SELECT set_config(
  'request.jwt.claims',
  '{"role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.monthly_reports) THEN
    RAISE EXCEPTION 'authenticated role without an identity can read shared reports';
  END IF;

  BEGIN
    INSERT INTO public.monthly_reports (
      id,
      report_type,
      period_year,
      campaign_name,
      platform_metrics,
      qualitative
    ) VALUES (
      '30000000-0000-0000-0000-000000000004',
      'campaign',
      2099,
      'Missing identity insert test',
      '{}'::jsonb,
      '{}'::jsonb
    );
    RAISE EXCEPTION 'authenticated role without an identity inserted a report';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$;

UPDATE public.monthly_reports
   SET campaign_name = 'Missing identity update escaped RLS'
 WHERE id = '30000000-0000-0000-0000-000000000003';

DELETE FROM public.monthly_reports
 WHERE id = '30000000-0000-0000-0000-000000000003';

RESET ROLE;

DO $$
BEGIN
  IF (
    SELECT campaign_name
      FROM public.monthly_reports
     WHERE id = '30000000-0000-0000-0000-000000000003'
  ) <> 'Missing identity RLS test' THEN
    RAISE EXCEPTION 'authenticated role without an identity updated or deleted a report';
  END IF;
END;
$$;

ROLLBACK;
