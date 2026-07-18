BEGIN;

INSERT INTO public.entries (
  id,
  date,
  platforms,
  asset_type,
  caption,
  platform_captions,
  first_comment,
  asset_previews,
  workflow_status,
  status,
  approved_at
) VALUES
  (
    '11000000-0000-0000-0000-000000000001',
    '2026-07-17',
    '["Facebook"]'::JSONB,
    'No asset',
    'Stale recovery test entry',
    '{}'::JSONB,
    '',
    '[]'::JSONB,
    'Approved',
    'Approved',
    NOW()
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    '2026-07-17',
    '["Facebook"]'::JSONB,
    'No asset',
    'Fresh recovery test entry',
    '{}'::JSONB,
    '',
    '[]'::JSONB,
    'Approved',
    'Approved',
    NOW()
  ),
  (
    '11000000-0000-0000-0000-000000000003',
    '2026-07-17',
    '["Facebook"]'::JSONB,
    'No asset',
    'Abandoned queued recovery test entry',
    '{}'::JSONB,
    '',
    '[]'::JSONB,
    'Approved',
    'Approved',
    NOW()
  );

DO $$
DECLARE
  stale_job_id UUID;
  fresh_job_id UUID;
  recovered_count INTEGER;
  stale_status TEXT;
  stale_error_code TEXT;
  stale_error_message TEXT;
  stale_job_status TEXT;
  fresh_status TEXT;
  fresh_job_status TEXT;
  stale_reclaims INTEGER;
  fresh_reclaims INTEGER;
  payload CONSTANT JSONB := '{
    "entryId": "11000000-0000-0000-0000-000000000001",
    "platforms": ["Facebook"],
    "caption": "Stale recovery test entry",
    "platformCaptions": {},
    "assetType": "No asset",
    "mediaUrls": [],
    "previewUrl": null,
    "firstComment": ""
  }'::JSONB;
  fresh_payload CONSTANT JSONB := '{
    "entryId": "11000000-0000-0000-0000-000000000002",
    "platforms": ["Facebook"],
    "caption": "Fresh recovery test entry",
    "platformCaptions": {},
    "assetType": "No asset",
    "mediaUrls": [],
    "previewUrl": null,
    "firstComment": ""
  }'::JSONB;
BEGIN
  SELECT job_id INTO stale_job_id
  FROM public.create_manual_publication_job(
    '11000000-0000-0000-0000-000000000001',
    1,
    '31000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001',
    'owner@example.org',
    payload,
    ARRAY['Facebook']
  );

  SELECT job_id INTO fresh_job_id
  FROM public.create_manual_publication_job(
    '11000000-0000-0000-0000-000000000002',
    1,
    '31000000-0000-0000-0000-000000000002',
    '21000000-0000-0000-0000-000000000001',
    'owner@example.org',
    fresh_payload,
    ARRAY['Facebook']
  );

  PERFORM * FROM public.claim_publication_result(stale_job_id, 'Facebook');
  PERFORM * FROM public.claim_publication_result(fresh_job_id, 'Facebook');

  UPDATE public.publication_results
  SET
    created_at = NOW() - INTERVAL '10 minutes',
    claimed_at = NOW() - INTERVAL '6 minutes'
  WHERE job_id = stale_job_id;

  SELECT public.recover_stale_publication_results() INTO recovered_count;

  SELECT status, error_code, error_message
  INTO stale_status, stale_error_code, stale_error_message
  FROM public.publication_results
  WHERE job_id = stale_job_id;

  SELECT status INTO stale_job_status
  FROM public.publication_jobs
  WHERE id = stale_job_id;

  SELECT status INTO fresh_status
  FROM public.publication_results
  WHERE job_id = fresh_job_id;

  SELECT status INTO fresh_job_status
  FROM public.publication_jobs
  WHERE id = fresh_job_id;

  SELECT COUNT(*) INTO stale_reclaims
  FROM public.claim_publication_result(stale_job_id, 'Facebook');

  SELECT COUNT(*) INTO fresh_reclaims
  FROM public.claim_publication_result(fresh_job_id, 'Facebook');

  IF
    recovered_count <> 1
    OR stale_status <> 'unknown'
    OR stale_error_code <> 'persistence_failed'
    OR stale_error_message <> 'The publication outcome for Facebook could not be stored safely.'
    OR stale_job_status <> 'unknown'
    OR fresh_status <> 'publishing'
    OR fresh_job_status <> 'publishing'
    OR stale_reclaims <> 0
    OR fresh_reclaims <> 0
  THEN
    RAISE EXCEPTION 'Stale publication recovery did not preserve the safe state machine';
  END IF;
END;
$$;

DO $$
DECLARE
  queued_job_id UUID;
  recovered_count INTEGER;
  queued_result_status TEXT;
  queued_job_status TEXT;
  payload CONSTANT JSONB := '{
    "entryId": "11000000-0000-0000-0000-000000000003",
    "platforms": ["Facebook"],
    "caption": "Abandoned queued recovery test entry",
    "platformCaptions": {},
    "assetType": "No asset",
    "mediaUrls": [],
    "previewUrl": null,
    "firstComment": ""
  }'::JSONB;
BEGIN
  SELECT job_id INTO queued_job_id
  FROM public.create_manual_publication_job(
    '11000000-0000-0000-0000-000000000003',
    1,
    '31000000-0000-0000-0000-000000000003',
    '21000000-0000-0000-0000-000000000001',
    'owner@example.org',
    payload,
    ARRAY['Facebook']
  );

  UPDATE public.publication_jobs
  SET created_at = NOW() - INTERVAL '6 minutes'
  WHERE id = queued_job_id;

  SELECT public.recover_stale_publication_results() INTO recovered_count;

  SELECT status INTO queued_result_status
  FROM public.publication_results
  WHERE job_id = queued_job_id;

  SELECT status INTO queued_job_status
  FROM public.publication_jobs
  WHERE id = queued_job_id;

  IF
    recovered_count <> 1
    OR queued_result_status <> 'failed'
    OR queued_job_status <> 'failed'
  THEN
    RAISE EXCEPTION 'Abandoned queued publication recovery did not terminate safely';
  END IF;
END;
$$;

DO $$
BEGIN
  IF HAS_FUNCTION_PRIVILEGE(
    'authenticated',
    'public.recover_stale_publication_results()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated users can execute stale publication recovery';
  END IF;
END;
$$;

ROLLBACK;
