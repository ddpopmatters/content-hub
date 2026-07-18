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
    '13000000-0000-0000-0000-000000000001',
    '2026-07-17',
    '["Facebook", "LinkedIn"]'::JSONB,
    'No asset',
    'Targeted retry test entry',
    '{}'::JSONB,
    '',
    '[]'::JSONB,
    'Approved',
    'Approved',
    NOW()
  ),
  (
    '13000000-0000-0000-0000-000000000002',
    '2026-07-17',
    '["Facebook", "LinkedIn"]'::JSONB,
    'No asset',
    'Unknown retry test entry',
    '{}'::JSONB,
    '',
    '[]'::JSONB,
    'Approved',
    'Approved',
    NOW()
  ),
  (
    '13000000-0000-0000-0000-000000000003',
    '2026-07-17',
    '["Facebook", "LinkedIn"]'::JSONB,
    'No asset',
    'Stale approval retry test entry',
    '{}'::JSONB,
    '',
    '[]'::JSONB,
    'Approved',
    'Approved',
    NOW()
  );

-- Every explicit retry key claims the selected child at most once. Historical
-- keys remain idempotent after later failed attempts, while a new key can
-- represent a deliberate later retry of a definitive failure.
DO $$
DECLARE
  publication_job_id UUID;
  first_claimed BOOLEAN;
  in_flight_replay_claimed BOOLEAN;
  failed_replay_claimed BOOLEAN;
  second_claimed BOOLEAN;
  delayed_first_replay_claimed BOOLEAN;
  delayed_second_replay_claimed BOOLEAN;
  third_claimed BOOLEAN;
  published_replay_claimed BOOLEAN;
  facebook_status TEXT;
  facebook_attempts INTEGER;
  linkedin_status TEXT;
  linkedin_attempts INTEGER;
  final_job_status TEXT;
BEGIN
  SELECT job_id INTO publication_job_id
  FROM public.create_manual_publication_job(
    '13000000-0000-0000-0000-000000000001',
    1,
    '33000000-0000-0000-0000-000000000001',
    '23000000-0000-0000-0000-000000000001',
    'owner@example.org',
    '{
      "entryId": "13000000-0000-0000-0000-000000000001",
      "platforms": ["Facebook", "LinkedIn"],
      "caption": "Targeted retry test entry",
      "platformCaptions": {},
      "assetType": "No asset",
      "mediaUrls": [],
      "previewUrl": null,
      "firstComment": ""
    }'::JSONB,
    ARRAY['Facebook', 'LinkedIn']
  );

  PERFORM * FROM public.claim_publication_result(publication_job_id, 'Facebook');
  PERFORM * FROM public.claim_publication_result(publication_job_id, 'LinkedIn');
  PERFORM * FROM public.complete_publication_result(
    publication_job_id,
    'Facebook',
    'published',
    'facebook-post',
    'https://www.facebook.com/123',
    NULL
  );
  PERFORM * FROM public.complete_publication_result(
    publication_job_id,
    'LinkedIn',
    'failed',
    NULL,
    NULL,
    'provider_rejected'
  );

  SELECT claimed INTO first_claimed
  FROM public.claim_failed_publication_retry(
    publication_job_id,
    'LinkedIn',
    '23000000-0000-0000-0000-000000000001',
    1,
    '63000000-0000-4000-8000-000000000001'
  );
  SELECT claimed INTO in_flight_replay_claimed
  FROM public.claim_failed_publication_retry(
    publication_job_id,
    'LinkedIn',
    '23000000-0000-0000-0000-000000000001',
    1,
    '63000000-0000-4000-8000-000000000001'
  );

  SELECT status, attempt_count INTO facebook_status, facebook_attempts
  FROM public.publication_results
  WHERE job_id = publication_job_id AND platform = 'Facebook';
  SELECT status, attempt_count INTO linkedin_status, linkedin_attempts
  FROM public.publication_results
  WHERE job_id = publication_job_id AND platform = 'LinkedIn';

  IF
    first_claimed IS DISTINCT FROM TRUE
    OR in_flight_replay_claimed IS DISTINCT FROM FALSE
    OR facebook_status <> 'published'
    OR facebook_attempts <> 1
    OR linkedin_status <> 'publishing'
    OR linkedin_attempts <> 2
  THEN
    RAISE EXCEPTION 'Targeted retry did not make one atomic provider claim';
  END IF;

  PERFORM * FROM public.complete_publication_result(
    publication_job_id,
    'LinkedIn',
    'failed',
    NULL,
    NULL,
    'provider_rejected'
  );
  SELECT claimed INTO failed_replay_claimed
  FROM public.claim_failed_publication_retry(
    publication_job_id,
    'LinkedIn',
    '23000000-0000-0000-0000-000000000001',
    1,
    '63000000-0000-4000-8000-000000000001'
  );
  SELECT claimed INTO second_claimed
  FROM public.claim_failed_publication_retry(
    publication_job_id,
    'LinkedIn',
    '23000000-0000-0000-0000-000000000001',
    1,
    '63000000-0000-4000-8000-000000000002'
  );
  SELECT attempt_count INTO linkedin_attempts
  FROM public.publication_results
  WHERE job_id = publication_job_id AND platform = 'LinkedIn';

  IF
    failed_replay_claimed IS DISTINCT FROM FALSE
    OR second_claimed IS DISTINCT FROM TRUE
    OR linkedin_attempts <> 3
  THEN
    RAISE EXCEPTION 'Retry key replay or new-intent attempt counting is unsafe';
  END IF;

  PERFORM * FROM public.complete_publication_result(
    publication_job_id,
    'LinkedIn',
    'failed',
    NULL,
    NULL,
    'provider_rejected'
  );
  SELECT claimed INTO delayed_first_replay_claimed
  FROM public.claim_failed_publication_retry(
    publication_job_id,
    'LinkedIn',
    '23000000-0000-0000-0000-000000000001',
    1,
    '63000000-0000-4000-8000-000000000001'
  );
  SELECT claimed INTO delayed_second_replay_claimed
  FROM public.claim_failed_publication_retry(
    publication_job_id,
    'LinkedIn',
    '23000000-0000-0000-0000-000000000001',
    1,
    '63000000-0000-4000-8000-000000000002'
  );
  SELECT claimed INTO third_claimed
  FROM public.claim_failed_publication_retry(
    publication_job_id,
    'LinkedIn',
    '23000000-0000-0000-0000-000000000001',
    1,
    '63000000-0000-4000-8000-000000000003'
  );
  SELECT attempt_count INTO linkedin_attempts
  FROM public.publication_results
  WHERE job_id = publication_job_id AND platform = 'LinkedIn';

  IF
    delayed_first_replay_claimed IS DISTINCT FROM FALSE
    OR delayed_second_replay_claimed IS DISTINCT FROM FALSE
    OR third_claimed IS DISTINCT FROM TRUE
    OR linkedin_attempts <> 4
  THEN
    RAISE EXCEPTION 'Historical retry keys did not remain idempotent';
  END IF;

  PERFORM * FROM public.complete_publication_result(
    publication_job_id,
    'LinkedIn',
    'published',
    'linkedin-post',
    'https://www.linkedin.com/feed/update/456',
    NULL
  );
  SELECT claimed INTO published_replay_claimed
  FROM public.claim_failed_publication_retry(
    publication_job_id,
    'LinkedIn',
    '23000000-0000-0000-0000-000000000001',
    1,
    '63000000-0000-4000-8000-000000000003'
  );
  SELECT status INTO final_job_status
  FROM public.publication_jobs
  WHERE id = publication_job_id;

  IF
    published_replay_claimed IS DISTINCT FROM FALSE
    OR final_job_status <> 'published'
  THEN
    RAISE EXCEPTION 'Confirmed retry became claimable again';
  END IF;
END;
$$;

-- Wrong-owner requests, Unknown outcomes and stale approvals fail closed.
DO $$
DECLARE
  unknown_job_id UUID;
  stale_job_id UUID;
  rejected_rows INTEGER;
BEGIN
  SELECT job_id INTO unknown_job_id
  FROM public.create_manual_publication_job(
    '13000000-0000-0000-0000-000000000002',
    1,
    '33000000-0000-0000-0000-000000000002',
    '23000000-0000-0000-0000-000000000001',
    'owner@example.org',
    '{
      "entryId": "13000000-0000-0000-0000-000000000002",
      "platforms": ["Facebook", "LinkedIn"],
      "caption": "Unknown retry test entry",
      "platformCaptions": {},
      "assetType": "No asset",
      "mediaUrls": [],
      "previewUrl": null,
      "firstComment": ""
    }'::JSONB,
    ARRAY['Facebook', 'LinkedIn']
  );
  PERFORM * FROM public.claim_publication_result(unknown_job_id, 'Facebook');
  PERFORM * FROM public.claim_publication_result(unknown_job_id, 'LinkedIn');
  PERFORM * FROM public.complete_publication_result(
    unknown_job_id,
    'Facebook',
    'published',
    'facebook-post',
    NULL,
    NULL
  );
  PERFORM * FROM public.complete_publication_result(
    unknown_job_id,
    'LinkedIn',
    'unknown',
    NULL,
    NULL,
    'provider_timeout'
  );

  SELECT COUNT(*) INTO rejected_rows
  FROM public.claim_failed_publication_retry(
    unknown_job_id,
    'LinkedIn',
    '23000000-0000-0000-0000-000000000001',
    1,
    '63000000-0000-4000-8000-000000000004'
  );
  IF rejected_rows <> 0 THEN
    RAISE EXCEPTION 'Unknown result was claimed for retry';
  END IF;

  SELECT job_id INTO stale_job_id
  FROM public.create_manual_publication_job(
    '13000000-0000-0000-0000-000000000003',
    1,
    '33000000-0000-0000-0000-000000000003',
    '23000000-0000-0000-0000-000000000001',
    'owner@example.org',
    '{
      "entryId": "13000000-0000-0000-0000-000000000003",
      "platforms": ["Facebook", "LinkedIn"],
      "caption": "Stale approval retry test entry",
      "platformCaptions": {},
      "assetType": "No asset",
      "mediaUrls": [],
      "previewUrl": null,
      "firstComment": ""
    }'::JSONB,
    ARRAY['Facebook', 'LinkedIn']
  );
  PERFORM * FROM public.claim_publication_result(stale_job_id, 'Facebook');
  PERFORM * FROM public.claim_publication_result(stale_job_id, 'LinkedIn');
  PERFORM * FROM public.complete_publication_result(
    stale_job_id,
    'Facebook',
    'published',
    'facebook-post',
    NULL,
    NULL
  );
  PERFORM * FROM public.complete_publication_result(
    stale_job_id,
    'LinkedIn',
    'failed',
    NULL,
    NULL,
    'provider_rejected'
  );

  SELECT COUNT(*) INTO rejected_rows
  FROM public.claim_failed_publication_retry(
    stale_job_id,
    'LinkedIn',
    '23000000-0000-0000-0000-000000000099',
    1,
    '63000000-0000-4000-8000-000000000005'
  );
  IF rejected_rows <> 0 THEN
    RAISE EXCEPTION 'Wrong owner claimed a retry';
  END IF;

  UPDATE public.entries
  SET caption = 'Changed after approval'
  WHERE id = '13000000-0000-0000-0000-000000000003';

  SELECT COUNT(*) INTO rejected_rows
  FROM public.claim_failed_publication_retry(
    stale_job_id,
    'LinkedIn',
    '23000000-0000-0000-0000-000000000001',
    1,
    '63000000-0000-4000-8000-000000000006'
  );
  IF rejected_rows <> 0 THEN
    RAISE EXCEPTION 'Stale approval claimed a retry';
  END IF;
END;
$$;

DO $$
BEGIN
  IF HAS_FUNCTION_PRIVILEGE(
    'authenticated',
    'public.claim_failed_publication_retry(UUID, TEXT, UUID, BIGINT, UUID)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated users can claim publication retries';
  END IF;

  IF public.get_publication_contract_version() <> 'durable-manual-v1' THEN
    RAISE EXCEPTION 'Publication contract version does not match the release gate';
  END IF;

  IF HAS_FUNCTION_PRIVILEGE(
    'authenticated',
    'public.get_publication_contract_version()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Authenticated users can call the service-only publication contract marker';
  END IF;
END;
$$;

ROLLBACK;
