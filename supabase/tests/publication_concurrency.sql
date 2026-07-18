-- Exercise publication transitions through genuinely concurrent PostgreSQL
-- sessions. Run this only against an isolated local/test database.

CREATE EXTENSION IF NOT EXISTS dblink;

DELETE FROM public.publication_jobs
WHERE entry_id IN (
  '12000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000002'
);

DELETE FROM public.entries
WHERE id IN (
  '12000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000002'
);

CREATE OR REPLACE FUNCTION public.test_create_publication_with_delay(
  p_request_key UUID,
  p_delay_seconds DOUBLE PRECISION
)
RETURNS TABLE(job_id UUID, job_status TEXT, created BOOLEAN)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT created_job.job_id, created_job.job_status, created_job.created
  FROM public.create_manual_publication_job(
    '12000000-0000-0000-0000-000000000001',
    1,
    p_request_key,
    '22000000-0000-0000-0000-000000000001',
    'owner@example.org',
    '{
      "entryId": "12000000-0000-0000-0000-000000000001",
      "platforms": ["Facebook", "Instagram"],
      "caption": "Concurrent transition test entry",
      "platformCaptions": {},
      "assetType": "No asset",
      "mediaUrls": [],
      "previewUrl": null,
      "firstComment": ""
    }'::JSONB,
    ARRAY['Facebook', 'Instagram']
  ) AS created_job;

  PERFORM PG_SLEEP(p_delay_seconds);
END;
$$;

CREATE OR REPLACE FUNCTION public.test_create_competing_publication()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  violated_constraint TEXT;
BEGIN
  PERFORM *
  FROM public.create_manual_publication_job(
    '12000000-0000-0000-0000-000000000001',
    1,
    '32000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-000000000001',
    'owner@example.org',
    '{
      "entryId": "12000000-0000-0000-0000-000000000001",
      "platforms": ["Facebook", "Instagram"],
      "caption": "Concurrent transition test entry",
      "platformCaptions": {},
      "assetType": "No asset",
      "mediaUrls": [],
      "previewUrl": null,
      "firstComment": ""
    }'::JSONB,
    ARRAY['Facebook', 'Instagram']
  );

  RETURN 'unexpected_creation';
EXCEPTION
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME;
    RETURN violated_constraint;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_claim_publication_with_delay(
  p_job_id UUID,
  p_platform TEXT,
  p_delay_seconds DOUBLE PRECISION
)
RETURNS TABLE(result_id UUID, attempt_count INTEGER)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT claimed_result.result_id, claimed_result.attempt_count
  FROM public.claim_publication_result(p_job_id, p_platform) AS claimed_result;

  PERFORM PG_SLEEP(p_delay_seconds);
END;
$$;

CREATE OR REPLACE FUNCTION public.test_complete_publication_with_delay(
  p_job_id UUID,
  p_platform TEXT,
  p_status TEXT,
  p_provider_post_id TEXT,
  p_error_code TEXT,
  p_delay_seconds DOUBLE PRECISION
)
RETURNS TABLE(job_id UUID, job_status TEXT)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT completed_job.job_id, completed_job.job_status
  FROM public.complete_publication_result(
    p_job_id,
    p_platform,
    p_status,
    p_provider_post_id,
    NULL,
    p_error_code
  ) AS completed_job;

  PERFORM PG_SLEEP(p_delay_seconds);
END;
$$;

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
    '12000000-0000-0000-0000-000000000001',
    '2026-07-17',
    '["Facebook", "Instagram"]'::JSONB,
    'No asset',
    'Concurrent transition test entry',
    '{}'::JSONB,
    '',
    '[]'::JSONB,
    'Approved',
    'Approved',
    NOW()
  ),
  (
    '12000000-0000-0000-0000-000000000002',
    '2026-07-17',
    '["Facebook"]'::JSONB,
    'No asset',
    'Concurrent recovery test entry',
    '{}'::JSONB,
    '',
    '[]'::JSONB,
    'Approved',
    'Approved',
    NOW()
  );

SELECT public.dblink_connect(
  'publication_session_a',
  FORMAT('dbname=%s', CURRENT_DATABASE())
);

SELECT public.dblink_connect(
  'publication_session_b',
  FORMAT('dbname=%s', CURRENT_DATABASE())
);

-- The first transaction holds its guarded-intent index entry while the
-- second tries a different request key for the same owner and revision.
DO $$
DECLARE
  first_rows INTEGER;
  competing_outcome TEXT;
  stored_jobs INTEGER;
  stored_results INTEGER;
BEGIN
  PERFORM public.dblink_send_query(
    'publication_session_a',
    $remote$
      SELECT * FROM public.test_create_publication_with_delay(
        '32000000-0000-0000-0000-000000000001',
        1
      )
    $remote$
  );

  PERFORM PG_SLEEP(0.1);

  PERFORM public.dblink_send_query(
    'publication_session_b',
    'SELECT public.test_create_competing_publication()'
  );

  SELECT COUNT(*) INTO first_rows
  FROM public.dblink_get_result('publication_session_a', TRUE)
    AS first_create(job_id UUID, job_status TEXT, created BOOLEAN);

  SELECT outcome INTO competing_outcome
  FROM public.dblink_get_result('publication_session_b', TRUE)
    AS second_create(outcome TEXT);

  -- libpq retains the completed async command until one final empty read.
  PERFORM 1
  FROM public.dblink_get_result('publication_session_a', TRUE)
    AS first_create_drain(job_id UUID, job_status TEXT, created BOOLEAN);
  PERFORM 1
  FROM public.dblink_get_result('publication_session_b', TRUE)
    AS second_create_drain(outcome TEXT);

  SELECT COUNT(*) INTO stored_jobs
  FROM public.publication_jobs
  WHERE entry_id = '12000000-0000-0000-0000-000000000001';

  SELECT COUNT(*) INTO stored_results
  FROM public.publication_results
  WHERE job_id = (
    SELECT id
    FROM public.publication_jobs
    WHERE entry_id = '12000000-0000-0000-0000-000000000001'
  );

  IF
    first_rows <> 1
    OR competing_outcome <> 'publication_jobs_one_guarded_intent_idx'
    OR stored_jobs <> 1
    OR stored_results <> 2
  THEN
    RAISE EXCEPTION 'Concurrent creation did not preserve one guarded intent';
  END IF;
END;
$$;

-- Two workers race to claim the same child result. The second worker waits
-- for the parent lock, then observes that the result is no longer pending.
DO $$
DECLARE
  publication_job_id UUID;
  first_rows INTEGER;
  second_rows INTEGER;
  stored_attempts INTEGER;
  stored_status TEXT;
BEGIN
  SELECT id INTO publication_job_id
  FROM public.publication_jobs
  WHERE entry_id = '12000000-0000-0000-0000-000000000001';

  PERFORM public.dblink_send_query(
    'publication_session_a',
    FORMAT(
      $remote$
        SELECT * FROM public.test_claim_publication_with_delay(
          %L,
          'Facebook',
          1
        )
      $remote$,
      publication_job_id
    )
  );

  PERFORM PG_SLEEP(0.1);

  PERFORM public.dblink_send_query(
    'publication_session_b',
    FORMAT(
      $remote$
        SELECT * FROM public.claim_publication_result(%L, 'Facebook')
      $remote$,
      publication_job_id
    )
  );

  SELECT COUNT(*) INTO first_rows
  FROM public.dblink_get_result('publication_session_a', TRUE)
    AS first_claim(result_id UUID, attempt_count INTEGER);

  SELECT COUNT(*) INTO second_rows
  FROM public.dblink_get_result('publication_session_b', TRUE)
    AS second_claim(result_id UUID, attempt_count INTEGER);

  PERFORM 1
  FROM public.dblink_get_result('publication_session_a', TRUE)
    AS first_claim_drain(result_id UUID, attempt_count INTEGER);
  PERFORM 1
  FROM public.dblink_get_result('publication_session_b', TRUE)
    AS second_claim_drain(result_id UUID, attempt_count INTEGER);

  SELECT attempt_count, status
  INTO stored_attempts, stored_status
  FROM public.publication_results
  WHERE job_id = publication_job_id
    AND platform = 'Facebook';

  IF
    first_rows + second_rows <> 1
    OR stored_attempts <> 1
    OR stored_status <> 'publishing'
  THEN
    RAISE EXCEPTION 'Concurrent claim did not preserve at-most-once acquisition';
  END IF;
END;
$$;

DO $$
DECLARE
  publication_job_id UUID;
BEGIN
  SELECT id INTO publication_job_id
  FROM public.publication_jobs
  WHERE entry_id = '12000000-0000-0000-0000-000000000001';

  PERFORM *
  FROM public.claim_publication_result(publication_job_id, 'Instagram');
END;
$$;

-- Sibling completions run in separate sessions. Parent-first serialisation
-- must aggregate the committed pair as Partial, never whichever write wins.
DO $$
DECLARE
  publication_job_id UUID;
  first_rows INTEGER;
  second_rows INTEGER;
  stored_job_status TEXT;
  facebook_status TEXT;
  instagram_status TEXT;
BEGIN
  SELECT id INTO publication_job_id
  FROM public.publication_jobs
  WHERE entry_id = '12000000-0000-0000-0000-000000000001';

  PERFORM public.dblink_send_query(
    'publication_session_a',
    FORMAT(
      $remote$
        SELECT * FROM public.test_complete_publication_with_delay(
          %L,
          'Facebook',
          'published',
          'facebook-post-1',
          NULL,
          1
        )
      $remote$,
      publication_job_id
    )
  );

  PERFORM PG_SLEEP(0.1);

  PERFORM public.dblink_send_query(
    'publication_session_b',
    FORMAT(
      $remote$
        SELECT * FROM public.complete_publication_result(
          %L,
          'Instagram',
          'failed',
          NULL,
          NULL,
          'provider_rejected'
        )
      $remote$,
      publication_job_id
    )
  );

  SELECT COUNT(*) INTO first_rows
  FROM public.dblink_get_result('publication_session_a', TRUE)
    AS first_completion(job_id UUID, job_status TEXT);

  SELECT COUNT(*) INTO second_rows
  FROM public.dblink_get_result('publication_session_b', TRUE)
    AS second_completion(job_id UUID, job_status TEXT);

  PERFORM 1
  FROM public.dblink_get_result('publication_session_a', TRUE)
    AS first_completion_drain(job_id UUID, job_status TEXT);
  PERFORM 1
  FROM public.dblink_get_result('publication_session_b', TRUE)
    AS second_completion_drain(job_id UUID, job_status TEXT);

  SELECT status INTO stored_job_status
  FROM public.publication_jobs
  WHERE id = publication_job_id;

  SELECT status INTO facebook_status
  FROM public.publication_results
  WHERE job_id = publication_job_id
    AND platform = 'Facebook';

  SELECT status INTO instagram_status
  FROM public.publication_results
  WHERE job_id = publication_job_id
    AND platform = 'Instagram';

  IF
    first_rows <> 1
    OR second_rows <> 1
    OR stored_job_status <> 'partial'
    OR facebook_status <> 'published'
    OR instagram_status <> 'failed'
  THEN
    RAISE EXCEPTION 'Concurrent completion produced an invalid aggregate';
  END IF;
END;
$$;

-- Prepare a genuinely stale claim in a committed transaction so both remote
-- sessions can observe it before completion and recovery race.
DO $$
DECLARE
  publication_job_id UUID;
BEGIN
  SELECT job_id INTO publication_job_id
  FROM public.create_manual_publication_job(
    '12000000-0000-0000-0000-000000000002',
    1,
    '32000000-0000-0000-0000-000000000003',
    '22000000-0000-0000-0000-000000000001',
    'owner@example.org',
    '{
      "entryId": "12000000-0000-0000-0000-000000000002",
      "platforms": ["Facebook"],
      "caption": "Concurrent recovery test entry",
      "platformCaptions": {},
      "assetType": "No asset",
      "mediaUrls": [],
      "previewUrl": null,
      "firstComment": ""
    }'::JSONB,
    ARRAY['Facebook']
  );

  PERFORM *
  FROM public.claim_publication_result(publication_job_id, 'Facebook');

  UPDATE public.publication_results
  SET
    created_at = NOW() - INTERVAL '10 minutes',
    claimed_at = NOW() - INTERVAL '6 minutes'
  WHERE job_id = publication_job_id;
END;
$$;

-- Completion acquires the parent lock first. Recovery may select the stale
-- snapshot while waiting, but must re-check after the completion commits and
-- leave its definitive Failed result untouched.
DO $$
DECLARE
  publication_job_id UUID;
  completion_rows INTEGER;
  recovery_rows INTEGER;
  stored_job_status TEXT;
  stored_result_status TEXT;
  stored_error_code TEXT;
BEGIN
  SELECT id INTO publication_job_id
  FROM public.publication_jobs
  WHERE entry_id = '12000000-0000-0000-0000-000000000002';

  PERFORM public.dblink_send_query(
    'publication_session_a',
    FORMAT(
      $remote$
        SELECT * FROM public.test_complete_publication_with_delay(
          %L,
          'Facebook',
          'failed',
          NULL,
          'provider_rejected',
          1
        )
      $remote$,
      publication_job_id
    )
  );

  PERFORM PG_SLEEP(0.1);

  PERFORM public.dblink_send_query(
    'publication_session_b',
    'SELECT public.recover_stale_publication_results()'
  );

  SELECT COUNT(*) INTO completion_rows
  FROM public.dblink_get_result('publication_session_a', TRUE)
    AS completion(job_id UUID, job_status TEXT);

  SELECT COALESCE(SUM(recovered_count), 0)::INTEGER INTO recovery_rows
  FROM public.dblink_get_result('publication_session_b', TRUE)
    AS recovery(recovered_count INTEGER);

  PERFORM 1
  FROM public.dblink_get_result('publication_session_a', TRUE)
    AS completion_drain(job_id UUID, job_status TEXT);
  PERFORM 1
  FROM public.dblink_get_result('publication_session_b', TRUE)
    AS recovery_drain(recovered_count INTEGER);

  SELECT status INTO stored_job_status
  FROM public.publication_jobs
  WHERE id = publication_job_id;

  SELECT status, error_code
  INTO stored_result_status, stored_error_code
  FROM public.publication_results
  WHERE job_id = publication_job_id
    AND platform = 'Facebook';

  IF
    completion_rows <> 1
    OR recovery_rows <> 0
    OR stored_job_status <> 'failed'
    OR stored_result_status <> 'failed'
    OR stored_error_code <> 'provider_rejected'
  THEN
    RAISE EXCEPTION 'Concurrent recovery overwrote a committed completion';
  END IF;
END;
$$;

SELECT public.dblink_disconnect('publication_session_a');
SELECT public.dblink_disconnect('publication_session_b');

DROP FUNCTION public.test_create_publication_with_delay(UUID, DOUBLE PRECISION);
DROP FUNCTION public.test_create_competing_publication();
DROP FUNCTION public.test_claim_publication_with_delay(UUID, TEXT, DOUBLE PRECISION);
DROP FUNCTION public.test_complete_publication_with_delay(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  DOUBLE PRECISION
);

DELETE FROM public.publication_jobs
WHERE entry_id IN (
  '12000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000002'
);

DELETE FROM public.entries
WHERE id IN (
  '12000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000002'
);
