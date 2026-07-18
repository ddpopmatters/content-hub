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
    '10000000-0000-0000-0000-000000000001',
    '2026-07-17',
    '["Facebook", "Instagram"]'::JSONB,
    'Design',
    'Approved first entry',
    '{}'::JSONB,
    '',
    '[]'::JSONB,
    'Approved',
    'Approved',
    '2026-07-17T18:00:00.000Z'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '2026-07-17',
    '["BlueSky", "LinkedIn"]'::JSONB,
    'Design',
    'Approved second entry',
    '{}'::JSONB,
    '',
    '[]'::JSONB,
    'Approved',
    'Approved',
    '2026-07-17T18:00:00.000Z'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '2026-07-17',
    '["LinkedIn Org"]'::JSONB,
    'Design',
    'Approved third entry',
    '{}'::JSONB,
    '',
    '[]'::JSONB,
    'Approved',
    'Approved',
    '2026-07-17T18:00:00.000Z'
  );

DO $$
DECLARE
  owner_id CONSTANT UUID := '20000000-0000-0000-0000-000000000001';
  first_job_id UUID;
  replayed_job_id UUID;
  was_created BOOLEAN;
  result_count INTEGER;
  payload CONSTANT JSONB := '{
    "entryId": "10000000-0000-0000-0000-000000000001",
    "platforms": ["Facebook", "Instagram"],
    "caption": "Approved first entry",
    "platformCaptions": {},
    "assetType": "Design",
    "mediaUrls": [],
    "previewUrl": null,
    "firstComment": ""
  }'::JSONB;
BEGIN
  SELECT job_id, created
  INTO first_job_id, was_created
  FROM public.create_manual_publication_job(
    '10000000-0000-0000-0000-000000000001',
    1,
    '30000000-0000-0000-0000-000000000001',
    owner_id,
    'owner@example.org',
    payload,
    ARRAY['Facebook', 'Instagram']
  );

  IF first_job_id IS NULL OR NOT was_created THEN
    RAISE EXCEPTION 'First request did not create a publication job';
  END IF;

  SELECT job_id, created
  INTO replayed_job_id, was_created
  FROM public.create_manual_publication_job(
    '10000000-0000-0000-0000-000000000001',
    1,
    '30000000-0000-0000-0000-000000000001',
    owner_id,
    'owner@example.org',
    payload,
    ARRAY['Facebook', 'Instagram']
  );

  IF replayed_job_id IS DISTINCT FROM first_job_id OR was_created THEN
    RAISE EXCEPTION 'Repeated request key did not return the existing job';
  END IF;

  SELECT COUNT(*) INTO result_count
  FROM public.publication_results
  WHERE job_id = first_job_id;

  IF result_count <> 2 THEN
    RAISE EXCEPTION 'Idempotent replay created an unexpected result count: %', result_count;
  END IF;
END;
$$;

-- Different browser keys cannot create simultaneous intents for one approved
-- entry revision.
DO $$
DECLARE
  duplicate_active_rejected BOOLEAN := FALSE;
BEGIN
  BEGIN
    PERFORM *
    FROM public.create_manual_publication_job(
      '10000000-0000-0000-0000-000000000001',
      1,
      '30000000-0000-0000-0000-000000000098',
      '20000000-0000-0000-0000-000000000001',
      'owner@example.org',
      '{
        "entryId": "10000000-0000-0000-0000-000000000001",
        "platforms": ["Facebook", "Instagram"],
        "caption": "Approved first entry",
        "platformCaptions": {},
        "assetType": "Design",
        "mediaUrls": [],
        "previewUrl": null,
        "firstComment": ""
      }'::JSONB,
      ARRAY['Facebook', 'Instagram']
    );
  EXCEPTION
    WHEN unique_violation THEN
      duplicate_active_rejected := TRUE;
  END;

  IF NOT duplicate_active_rejected THEN
    RAISE EXCEPTION 'A distinct key created a concurrent active intent';
  END IF;
END;
$$;

-- Snapshot platforms and result platforms must describe the same intent.
DO $$
DECLARE
  mismatch_rejected BOOLEAN := FALSE;
BEGIN
  BEGIN
    PERFORM *
    FROM public.create_manual_publication_job(
      '10000000-0000-0000-0000-000000000002',
      1,
      '30000000-0000-0000-0000-000000000099',
      '20000000-0000-0000-0000-000000000001',
      'owner@example.org',
      '{
        "entryId": "10000000-0000-0000-0000-000000000002",
        "platforms": ["Facebook"],
        "caption": "Approved second entry",
        "platformCaptions": {},
        "assetType": "Design",
        "mediaUrls": [],
        "previewUrl": null,
        "firstComment": ""
      }'::JSONB,
      ARRAY['BlueSky', 'LinkedIn']
    );
  EXCEPTION
    WHEN invalid_parameter_value THEN
      mismatch_rejected := TRUE;
  END;

  IF NOT mismatch_rejected THEN
    RAISE EXCEPTION 'Mismatched snapshot and result platforms were accepted';
  END IF;
END;
$$;

-- A request key cannot be reused for a different publication intent.
DO $$
DECLARE
  conflict_rejected BOOLEAN := FALSE;
BEGIN
  BEGIN
    PERFORM *
    FROM public.create_manual_publication_job(
      '10000000-0000-0000-0000-000000000002',
      1,
      '30000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'owner@example.org',
      '{
        "entryId": "10000000-0000-0000-0000-000000000002",
        "platforms": ["BlueSky", "LinkedIn"],
        "caption": "Approved second entry",
        "platformCaptions": {},
        "assetType": "Design",
        "mediaUrls": [],
        "previewUrl": null,
        "firstComment": ""
      }'::JSONB,
      ARRAY['BlueSky', 'LinkedIn']
    );
  EXCEPTION
    WHEN unique_violation THEN
      conflict_rejected := TRUE;
  END;

  IF NOT conflict_rejected THEN
    RAISE EXCEPTION 'Reused request key was accepted for a different intent';
  END IF;
END;
$$;

-- A result can be claimed once. Failed plus skipped with no successes is failed.
DO $$
DECLARE
  job_id UUID;
  first_claims INTEGER;
  second_claims INTEGER;
  aggregate_status TEXT;
BEGIN
  SELECT publication_jobs.id INTO job_id
  FROM public.publication_jobs
  WHERE request_key = '30000000-0000-0000-0000-000000000001';

  SELECT COUNT(*) INTO first_claims
  FROM public.claim_publication_result(job_id, 'Facebook');

  SELECT COUNT(*) INTO second_claims
  FROM public.claim_publication_result(job_id, 'Facebook');

  IF first_claims <> 1 OR second_claims <> 0 THEN
    RAISE EXCEPTION 'Atomic claim did not allow exactly one caller';
  END IF;

  PERFORM * FROM public.claim_publication_result(job_id, 'Instagram');

  PERFORM *
  FROM public.complete_publication_result(
    job_id,
    'Facebook',
    'failed',
    NULL,
    NULL,
    'provider_rejected'
  );

  SELECT job_status INTO aggregate_status
  FROM public.complete_publication_result(
    job_id,
    'Instagram',
    'skipped',
    NULL,
    NULL,
    'unsupported'
  );

  IF aggregate_status <> 'failed' THEN
    RAISE EXCEPTION 'Failed plus skipped was aggregated as %', aggregate_status;
  END IF;
END;
$$;

-- One success plus one failure is partial, and a published result is immutable.
DO $$
DECLARE
  job_id UUID;
  aggregate_status TEXT;
  published_reclaims INTEGER;
BEGIN
  SELECT created_job.job_id INTO job_id
  FROM public.create_manual_publication_job(
    '10000000-0000-0000-0000-000000000002',
    1,
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    'owner@example.org',
    '{
      "entryId": "10000000-0000-0000-0000-000000000002",
      "platforms": ["BlueSky", "LinkedIn"],
      "caption": "Approved second entry",
      "platformCaptions": {},
      "assetType": "Design",
      "mediaUrls": [],
      "previewUrl": null,
      "firstComment": ""
    }'::JSONB,
    ARRAY['BlueSky', 'LinkedIn']
  ) AS created_job;

  PERFORM * FROM public.claim_publication_result(job_id, 'BlueSky');
  PERFORM * FROM public.claim_publication_result(job_id, 'LinkedIn');

  PERFORM *
  FROM public.complete_publication_result(
    job_id,
    'BlueSky',
    'published',
    'at://did:example/app.bsky.feed.post/one',
    'https://bsky.app/profile/example/post/one'
  );

  SELECT job_status INTO aggregate_status
  FROM public.complete_publication_result(
    job_id,
    'LinkedIn',
    'failed',
    NULL,
    NULL,
    'provider_rejected'
  );

  SELECT COUNT(*) INTO published_reclaims
  FROM public.claim_publication_result(job_id, 'BlueSky');

  IF aggregate_status <> 'partial' OR published_reclaims <> 0 THEN
    RAISE EXCEPTION 'Partial result or published-result protection failed';
  END IF;
END;
$$;

-- Any uncertain result makes the whole job unknown and blocks another claim.
DO $$
DECLARE
  unknown_job_id UUID;
  aggregate_status TEXT;
  unknown_reclaims INTEGER;
  invalid_error_rejected BOOLEAN := FALSE;
  stored_error TEXT;
BEGIN
  SELECT created_job.job_id INTO unknown_job_id
  FROM public.create_manual_publication_job(
    '10000000-0000-0000-0000-000000000003',
    1,
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    'owner@example.org',
    '{
      "entryId": "10000000-0000-0000-0000-000000000003",
      "platforms": ["LinkedIn Org"],
      "caption": "Approved third entry",
      "platformCaptions": {},
      "assetType": "Design",
      "mediaUrls": [],
      "previewUrl": null,
      "firstComment": ""
    }'::JSONB,
    ARRAY['LinkedIn Org']
  ) AS created_job;

  PERFORM * FROM public.claim_publication_result(unknown_job_id, 'LinkedIn Org');

  BEGIN
    PERFORM *
    FROM public.complete_publication_result(
      unknown_job_id,
      'LinkedIn Org',
      'unknown',
      NULL,
      NULL,
      'provider_rejected'
    );
  EXCEPTION
    WHEN invalid_parameter_value THEN
      invalid_error_rejected := TRUE;
  END;

  SELECT job_status INTO aggregate_status
  FROM public.complete_publication_result(
    unknown_job_id,
    'LinkedIn Org',
    'unknown',
    NULL,
    NULL,
    'provider_timeout'
  );

  SELECT COUNT(*) INTO unknown_reclaims
  FROM public.claim_publication_result(unknown_job_id, 'LinkedIn Org');

  SELECT error_message INTO stored_error
  FROM public.publication_results
  WHERE publication_results.job_id = unknown_job_id
    AND publication_results.platform = 'LinkedIn Org';

  IF
    NOT invalid_error_rejected
    OR aggregate_status <> 'unknown'
    OR unknown_reclaims <> 0
    OR stored_error <> 'LinkedIn Org may have received the post. Check the platform before retrying.'
  THEN
    RAISE EXCEPTION 'Unknown outcome was not retained safely';
  END IF;
END;
$$;

-- Browser roles may read their own jobs and results but cannot mutate or call
-- the service-only orchestration functions.
DO $$
BEGIN
  IF NOT HAS_COLUMN_PRIVILEGE(
      'authenticated',
      'public.publication_jobs',
      'id',
      'SELECT'
    )
    OR NOT HAS_COLUMN_PRIVILEGE(
      'authenticated',
      'public.publication_results',
      'provider_url',
      'SELECT'
    )
    OR HAS_COLUMN_PRIVILEGE(
      'authenticated',
      'public.publication_jobs',
      'payload_snapshot',
      'SELECT'
    )
    OR HAS_COLUMN_PRIVILEGE(
      'authenticated',
      'public.publication_results',
      'provider_post_id',
      'SELECT'
    )
    OR HAS_TABLE_PRIVILEGE('authenticated', 'public.publication_jobs', 'INSERT')
    OR HAS_TABLE_PRIVILEGE('authenticated', 'public.publication_results', 'UPDATE')
    OR HAS_FUNCTION_PRIVILEGE(
      'authenticated',
      'public.claim_publication_result(uuid,text)',
      'EXECUTE'
    )
  THEN
    RAISE EXCEPTION 'Publication job browser privileges are unsafe';
  END IF;
END;
$$;

SET LOCAL ROLE authenticated;
SELECT SET_CONFIG('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', TRUE);

DO $$
DECLARE
  visible_jobs INTEGER;
  visible_results INTEGER;
BEGIN
  SELECT COUNT(id) INTO visible_jobs FROM public.publication_jobs;
  SELECT COUNT(id) INTO visible_results FROM public.publication_results;

  IF visible_jobs <> 3 OR visible_results <> 5 THEN
    RAISE EXCEPTION 'Owner could not read durable publication state';
  END IF;
END;
$$;

SELECT SET_CONFIG('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000099', TRUE);

DO $$
BEGIN
  IF EXISTS (SELECT id FROM public.publication_jobs)
    OR EXISTS (SELECT id FROM public.publication_results)
  THEN
    RAISE EXCEPTION 'Another authenticated user could read owner publication state';
  END IF;
END;
$$;

RESET ROLE;
ROLLBACK;
