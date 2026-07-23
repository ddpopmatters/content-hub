BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.agent_actions'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'agent_actions does not have RLS enabled';
  END IF;
  IF has_table_privilege('anon', 'public.agent_actions', 'SELECT')
    OR has_table_privilege('authenticated', 'public.agent_actions', 'SELECT')
    OR has_function_privilege(
      'authenticated',
      'public.apply_agent_action(uuid,text,text,text,text,text)',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'A browser role can access or execute agent actions';
  END IF;
END;
$$;

GRANT SELECT, UPDATE ON public.monthly_reports TO authenticated;

DO $$
DECLARE
  proposed JSONB;
  applied JSONB;
  replayed JSONB;
  action_id UUID;
  entry_id UUID;
BEGIN
  proposed := public.create_agent_action(
    'pm_hermes_test',
    'create_entry',
    NULL,
    jsonb_build_object(
      'date', '2026-07-20',
      'platforms', jsonb_build_array('Instagram'),
      'caption', 'Rights-based draft',
      'status', 'Approved'
    ),
    repeat('a', 64),
    'draft:test:0001',
    'Create one Draft entry.',
    clock_timestamp() + INTERVAL '30 minutes'
  );
  action_id := (proposed->>'id')::uuid;
  applied := public.apply_agent_action(
    action_id,
    'pm_hermes_test',
    repeat('a', 64),
    'draft:test:0001',
    'cha_aaaaaaaaaaaaaaaaaaaaaaaa',
    'Dan'
  );
  entry_id := (applied#>>'{action,result,id}')::uuid;

  IF applied->>'decision' <> 'applied' OR entry_id IS NULL THEN
    RAISE EXCEPTION 'Draft action was not applied';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.entries
     WHERE id = entry_id
       AND workflow_status = 'Draft'
       AND status = 'Pending'
       AND agent_provenance->>'source' = 'PM Hermes'
  ) THEN
    RAISE EXCEPTION 'Agent-created entry escaped safe Draft state or lost provenance';
  END IF;

  replayed := public.apply_agent_action(
    action_id,
    'pm_hermes_test',
    repeat('a', 64),
    'draft:test:0001',
    'cha_aaaaaaaaaaaaaaaaaaaaaaaa',
    'Dan'
  );
  IF replayed->>'decision' <> 'idempotent_replay'
    OR (SELECT count(*) FROM public.entries WHERE id = entry_id) <> 1
  THEN
    RAISE EXCEPTION 'Applied action did not replay idempotently';
  END IF;
END;
$$;

DO $$
DECLARE
  entry_row public.entries%ROWTYPE;
  proposed JSONB;
  outcome JSONB;
BEGIN
  INSERT INTO public.entries(date, platforms, caption)
  VALUES ('2026-07-23', '["Instagram"]'::jsonb, 'Comment target')
  RETURNING * INTO entry_row;

  proposed := public.create_agent_action(
    'pm_hermes_test',
    'add_comment',
    entry_row.id,
    jsonb_build_object(
      'entryId', entry_row.id,
      'expectedUpdatedAt', entry_row.updated_at,
      'body', 'Please check the evidence source.'
    ),
    repeat('e', 64),
    'comment:test:0001',
    'Add one comment.',
    clock_timestamp() + INTERVAL '30 minutes'
  );
  outcome := public.apply_agent_action(
    (proposed->>'id')::uuid,
    'pm_hermes_test',
    repeat('e', 64),
    'comment:test:0001',
    'cha_eeeeeeeeeeeeeeeeeeeeeeee',
    'Dan'
  );
  IF outcome->>'decision' <> 'applied'
    OR jsonb_array_length((SELECT comments FROM public.entries WHERE id = entry_row.id)) <> 1
    OR (SELECT comments->0->>'author' FROM public.entries WHERE id = entry_row.id) <> 'PM Hermes'
  THEN
    RAISE EXCEPTION 'Approved comment action failed';
  END IF;
END;
$$;

DO $$
DECLARE
  proposed JSONB;
  outcome JSONB;
BEGIN
  proposed := public.create_agent_action(
    'pm_hermes_test',
    'create_idea',
    NULL,
    jsonb_build_object(
      'type', 'Topic',
      'title', 'Reproductive rights explainer',
      'notes', 'Draft concept',
      'links', '[]'::jsonb,
      'inspiration', 'Supporter question',
      'targetDate', NULL,
      'targetMonth', '2026-08'
    ),
    repeat('f', 64),
    'idea:test:0001',
    'Create one idea.',
    clock_timestamp() + INTERVAL '30 minutes'
  );
  outcome := public.apply_agent_action(
    (proposed->>'id')::uuid,
    'pm_hermes_test',
    repeat('f', 64),
    'idea:test:0001',
    'cha_ffffffffffffffffffffffff',
    'Dan'
  );
  IF outcome->>'decision' <> 'applied'
    OR NOT EXISTS (
      SELECT 1 FROM public.ideas
       WHERE title = 'Reproductive rights explainer'
         AND created_by = 'PM Hermes'
         AND agent_provenance->>'source' = 'PM Hermes'
    )
  THEN
    RAISE EXCEPTION 'Approved idea action failed';
  END IF;
END;
$$;

DO $$
DECLARE
  report_row public.monthly_reports%ROWTYPE;
  proposed JSONB;
  outcome JSONB;
BEGIN
  INSERT INTO public.monthly_reports(
    report_type,
    period_month,
    period_year,
    platform_metrics,
    qualitative
  ) VALUES (
    'monthly',
    7,
    2026,
    '{}'::jsonb,
    jsonb_build_object('whatWorked', 'Existing evidence')
  )
  RETURNING * INTO report_row;

  proposed := public.create_agent_action(
    'pm_hermes_test',
    'update_report',
    report_row.id,
    jsonb_build_object(
      'expectedUpdatedAt', report_row.updated_at,
      'platformMetrics', report_row.platform_metrics,
      'qualitative', jsonb_build_object('themes', 'Updated evidence theme')
    ),
    repeat('1', 64),
    'report:update:0001',
    'Update one report.',
    clock_timestamp() + INTERVAL '30 minutes'
  );
  outcome := public.apply_agent_action(
    (proposed->>'id')::uuid,
    'pm_hermes_test',
    repeat('1', 64),
    'report:update:0001',
    'cha_111111111111111111111111',
    'Dan'
  );
  IF outcome->>'decision' <> 'applied'
    OR (SELECT qualitative->>'themes' FROM public.monthly_reports WHERE id = report_row.id)
      <> 'Updated evidence theme'
  THEN
    RAISE EXCEPTION 'Approved report update failed';
  END IF;
END;
$$;

DO $$
DECLARE
  entry_id UUID;
  original_updated_at TIMESTAMPTZ;
  original_revision BIGINT;
  proposed JSONB;
  outcome JSONB;
BEGIN
  INSERT INTO public.entries(date, platforms, caption)
  VALUES ('2026-07-21', '["LinkedIn"]'::jsonb, 'Human draft')
  RETURNING id, updated_at, content_revision
  INTO entry_id, original_updated_at, original_revision;

  proposed := public.create_agent_action(
    'pm_hermes_test',
    'update_entry',
    entry_id,
    jsonb_build_object(
      'entryId', entry_id,
      'expectedContentRevision', original_revision,
      'expectedUpdatedAt', original_updated_at,
      'changes', jsonb_build_object('caption', 'Agent edit')
    ),
    repeat('b', 64),
    'update:test:0001',
    'Update one Draft entry.',
    clock_timestamp() + INTERVAL '30 minutes'
  );

  UPDATE public.entries SET caption = 'Concurrent human edit' WHERE id = entry_id;

  outcome := public.apply_agent_action(
    (proposed->>'id')::uuid,
    'pm_hermes_test',
    repeat('b', 64),
    'update:test:0001',
    'cha_bbbbbbbbbbbbbbbbbbbbbbbb',
    'Dan'
  );
  IF outcome->>'decision' <> 'conflict'
    OR (SELECT caption FROM public.entries WHERE id = entry_id) <> 'Concurrent human edit'
  THEN
    RAISE EXCEPTION 'Concurrent human edit was not protected';
  END IF;
END;
$$;

DO $$
DECLARE
  entry_row public.entries%ROWTYPE;
  proposed JSONB;
  outcome JSONB;
BEGIN
  INSERT INTO public.entries(date, platforms, caption)
  VALUES ('2026-07-22', '["Facebook"]'::jsonb, 'Review draft')
  RETURNING * INTO entry_row;

  proposed := public.create_agent_action(
    'pm_hermes_test',
    'submit_for_review',
    entry_row.id,
    jsonb_build_object(
      'entryId', entry_row.id,
      'expectedContentRevision', entry_row.content_revision,
      'expectedUpdatedAt', entry_row.updated_at
    ),
    repeat('c', 64),
    'review:test:0001',
    'Submit one Draft for review.',
    clock_timestamp() + INTERVAL '30 minutes'
  );
  outcome := public.apply_agent_action(
    (proposed->>'id')::uuid,
    'pm_hermes_test',
    repeat('c', 64),
    'review:test:0001',
    'cha_cccccccccccccccccccccccc',
    'Dan'
  );
  IF outcome->>'decision' <> 'applied'
    OR NOT EXISTS (
      SELECT 1 FROM public.entries
       WHERE id = entry_row.id
         AND workflow_status = 'In Review'
         AND status = 'Pending'
         AND approved_at IS NULL
         AND approved_revision IS NULL
    )
  THEN
    RAISE EXCEPTION 'Submit-for-review crossed the approval boundary';
  END IF;
END;
$$;

DO $$
DECLARE
  proposed JSONB;
  outcome JSONB;
  action_id UUID;
BEGIN
  proposed := public.create_agent_action(
    'pm_hermes_test',
    'create_report',
    NULL,
    jsonb_build_object(
      'reportType', 'monthly',
      'periodMonth', 6,
      'periodQuarter', NULL,
      'periodYear', 2026,
      'campaignName', NULL,
      'dateFrom', NULL,
      'dateTo', NULL,
      'platformMetrics', jsonb_build_object(
        'Instagram', jsonb_build_object('numberOfPosts', 2, 'reach', 120)
      ),
      'qualitative', jsonb_build_object('whatWorked', 'Rights-based stories'),
      'evidence', jsonb_build_object('source', 'content_hub_entries')
    ),
    repeat('d', 64),
    'report:test:0001',
    'Create one monthly report.',
    clock_timestamp() + INTERVAL '30 minutes'
  );
  action_id := (proposed->>'id')::uuid;
  outcome := public.apply_agent_action(
    action_id,
    'pm_hermes_test',
    repeat('d', 64),
    'report:test:0001',
    'cha_dddddddddddddddddddddddd',
    'Dan'
  );
  IF outcome->>'decision' <> 'applied'
    OR (SELECT count(*) FROM public.monthly_reports WHERE period_year = 2026 AND period_month = 6) <> 1
    OR (
      SELECT agent_evidence->>'source'
        FROM public.monthly_reports
       WHERE period_year = 2026 AND period_month = 6
    ) <> 'content_hub_entries'
  THEN
    RAISE EXCEPTION 'Canonical saved report action failed or discarded its evidence';
  END IF;
END;
$$;

DO $$
DECLARE
  report_id UUID;
  before_value JSONB;
BEGIN
  SELECT id, agent_evidence INTO report_id, before_value
    FROM public.monthly_reports
   WHERE agent_evidence->>'source' = 'content_hub_entries'
   LIMIT 1;

  SET LOCAL ROLE authenticated;
  UPDATE public.monthly_reports
     SET agent_evidence = jsonb_build_object('source', 'forged')
   WHERE id = report_id;
  RESET ROLE;

  IF (SELECT agent_evidence FROM public.monthly_reports WHERE id = report_id)
    IS DISTINCT FROM before_value
  THEN
    RAISE EXCEPTION 'Authenticated browser role altered PM Hermes report evidence';
  END IF;
END;
$$;

DO $$
DECLARE
  entry_id UUID;
  before_value JSONB;
BEGIN
  SELECT id, agent_provenance INTO entry_id, before_value
    FROM public.entries
   WHERE agent_provenance->>'source' = 'PM Hermes'
   LIMIT 1;

  SET LOCAL ROLE authenticated;
  UPDATE public.entries
     SET agent_provenance = jsonb_build_object('source', 'forged')
   WHERE id = entry_id;
  RESET ROLE;

  IF (SELECT agent_provenance FROM public.entries WHERE id = entry_id) IS DISTINCT FROM before_value THEN
    RAISE EXCEPTION 'Authenticated browser role altered agent provenance';
  END IF;
END;
$$;

ROLLBACK;
