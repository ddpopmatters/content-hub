-- Serialise job aggregation and prevent distinct browser keys from creating
-- concurrent intents for the same approved entry revision.

CREATE UNIQUE INDEX publication_jobs_one_guarded_intent_idx
  ON public.publication_jobs(requested_by, entry_id, entry_revision)
  WHERE status IN ('queued', 'publishing', 'partial', 'published', 'unknown');

CREATE OR REPLACE FUNCTION public.claim_publication_result(
  p_job_id UUID,
  p_platform TEXT
)
RETURNS TABLE(result_id UUID, attempt_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result_id UUID;
  v_attempt_count INTEGER;
BEGIN
  -- Every job transition locks parent then child. A consistent lock order
  -- prevents claim, completion, and recovery from deadlocking one another.
  PERFORM 1
  FROM public.publication_jobs
  WHERE publication_jobs.id = p_job_id
    AND publication_jobs.status IN ('queued', 'publishing')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.publication_results
  SET
    status = 'publishing',
    attempt_count = publication_results.attempt_count + 1,
    claimed_at = NOW()
  WHERE publication_results.job_id = p_job_id
    AND publication_results.platform = p_platform
    AND publication_results.status = 'pending'
  RETURNING publication_results.id, publication_results.attempt_count
  INTO v_result_id, v_attempt_count;

  IF v_result_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.publication_jobs
  SET
    status = 'publishing',
    claimed_at = COALESCE(publication_jobs.claimed_at, NOW())
  WHERE publication_jobs.id = p_job_id;

  RETURN QUERY SELECT v_result_id, v_attempt_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_publication_result(
  p_job_id UUID,
  p_platform TEXT,
  p_status TEXT,
  p_provider_post_id TEXT DEFAULT NULL,
  p_provider_url TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL
)
RETURNS TABLE(job_id UUID, job_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job_id UUID;
  v_job_status TEXT;
  v_completed_at TIMESTAMPTZ := NOW();
  v_error_message TEXT;
BEGIN
  IF p_status NOT IN ('published', 'failed', 'skipped', 'unknown') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_publication_result_status';
  END IF;

  IF
    (
      p_status = 'published'
      AND (
        p_error_code IS NOT NULL
        OR p_provider_post_id IS NULL
        OR BTRIM(p_provider_post_id) = ''
      )
    )
    OR (
      p_status <> 'published'
      AND (p_provider_post_id IS NOT NULL OR p_provider_url IS NOT NULL)
    )
    OR (
      p_status = 'failed'
      AND (
        p_error_code IS NULL
        OR p_error_code NOT IN (
          'connection_missing',
          'multiple_connections',
          'reconnect_required',
          'media_unavailable',
          'unsupported',
          'provider_rejected',
          'unexpected'
        )
      )
    )
    OR (
      p_status = 'skipped'
      AND (p_error_code IS NULL OR p_error_code <> 'unsupported')
    )
    OR (
      p_status = 'unknown'
      AND (
        p_error_code IS NULL
        OR p_error_code NOT IN ('provider_timeout', 'persistence_failed', 'unexpected')
      )
    )
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_publication_result_error';
  END IF;

  v_error_message := CASE p_error_code
    WHEN 'connection_missing' THEN FORMAT('Connect %s before publishing.', p_platform)
    WHEN 'multiple_connections' THEN FORMAT(
      'Disconnect the extra %s account before publishing.',
      p_platform
    )
    WHEN 'reconnect_required' THEN FORMAT('Reconnect %s before publishing.', p_platform)
    WHEN 'media_unavailable' THEN FORMAT(
      '%s could not load the approved media. No post was sent.',
      p_platform
    )
    WHEN 'unsupported' THEN FORMAT(
      'Direct publishing to %s is unavailable for this entry.',
      p_platform
    )
    WHEN 'provider_rejected' THEN FORMAT(
      '%s did not confirm publication. Check the platform before trying again.',
      p_platform
    )
    WHEN 'provider_timeout' THEN FORMAT(
      '%s may have received the post. Check the platform before retrying.',
      p_platform
    )
    WHEN 'persistence_failed' THEN FORMAT(
      'The publication outcome for %s could not be stored safely.',
      p_platform
    )
    WHEN 'unexpected' THEN FORMAT(
      'Publishing to %s could not be completed. Check the platform before trying again.',
      p_platform
    )
    ELSE NULL
  END;

  -- Every result transition for a job takes this lock before updating its
  -- child row. Later callers therefore aggregate against committed siblings.
  PERFORM 1
  FROM public.publication_jobs
  WHERE publication_jobs.id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'publication_job_not_found';
  END IF;

  UPDATE public.publication_results
  SET
    status = p_status,
    provider_post_id = p_provider_post_id,
    provider_url = p_provider_url,
    error_code = p_error_code,
    error_message = v_error_message,
    completed_at = v_completed_at
  WHERE publication_results.job_id = p_job_id
    AND publication_results.platform = p_platform
    AND publication_results.status = 'publishing'
  RETURNING publication_results.job_id INTO v_job_id;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'publication_result_not_claimed';
  END IF;

  SELECT CASE
    WHEN BOOL_OR(publication_results.status = 'publishing')
      OR BOOL_OR(publication_results.status = 'pending')
      THEN 'publishing'
    WHEN BOOL_OR(publication_results.status = 'unknown')
      THEN 'unknown'
    WHEN BOOL_AND(publication_results.status = 'published')
      THEN 'published'
    WHEN BOOL_OR(publication_results.status = 'published')
      THEN 'partial'
    ELSE 'failed'
  END
  INTO v_job_status
  FROM public.publication_results
  WHERE publication_results.job_id = v_job_id;

  UPDATE public.publication_jobs
  SET
    status = v_job_status,
    completed_at = CASE
      WHEN v_job_status IN ('partial', 'published', 'failed', 'unknown') THEN v_completed_at
      ELSE NULL
    END
  WHERE publication_jobs.id = v_job_id;

  RETURN QUERY SELECT v_job_id, v_job_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.recover_stale_publication_results()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cutoff CONSTANT TIMESTAMPTZ := NOW() - INTERVAL '5 minutes';
  v_job_ids UUID[];
  v_job_id UUID;
  v_job_status TEXT;
  v_recovered_count INTEGER := 0;
  v_pending_count INTEGER := 0;
BEGIN
  SELECT ARRAY_AGG(stale_job.id ORDER BY stale_job.id)
  INTO v_job_ids
  FROM public.publication_jobs AS stale_job
  WHERE (
    stale_job.status = 'queued'
    AND stale_job.created_at < v_cutoff
  ) OR (
    stale_job.status = 'publishing'
    AND (
      stale_job.updated_at < v_cutoff
      OR EXISTS (
        SELECT 1
        FROM public.publication_results AS stale_result
        WHERE stale_result.job_id = stale_job.id
          AND stale_result.status = 'publishing'
          AND stale_result.claimed_at < v_cutoff
      )
    )
  );

  IF v_job_ids IS NULL THEN
    RETURN 0;
  END IF;

  -- Match completion's lock order so recovery cannot aggregate across an
  -- uncommitted sibling result transition.
  FOREACH v_job_id IN ARRAY v_job_ids
  LOOP
    PERFORM 1
    FROM public.publication_jobs
    WHERE publication_jobs.id = v_job_id
    FOR UPDATE;
  END LOOP;

  -- A job may have advanced while recovery waited for its parent lock.
  -- Re-evaluate under lock before changing any result.
  SELECT ARRAY_AGG(stale_job.id ORDER BY stale_job.id)
  INTO v_job_ids
  FROM public.publication_jobs AS stale_job
  WHERE stale_job.id = ANY(v_job_ids)
    AND (
      (
        stale_job.status = 'queued'
        AND stale_job.created_at < v_cutoff
      ) OR (
        stale_job.status = 'publishing'
        AND (
          stale_job.updated_at < v_cutoff
          OR EXISTS (
            SELECT 1
            FROM public.publication_results AS stale_result
            WHERE stale_result.job_id = stale_job.id
              AND stale_result.status = 'publishing'
              AND stale_result.claimed_at < v_cutoff
          )
        )
      )
    );

  IF v_job_ids IS NULL THEN
    RETURN 0;
  END IF;

  WITH recovered AS (
    UPDATE public.publication_results
    SET
      status = 'unknown',
      error_code = 'persistence_failed',
      error_message = FORMAT(
        'The publication outcome for %s could not be stored safely.',
        publication_results.platform
      ),
      completed_at = NOW()
    WHERE publication_results.status = 'publishing'
      AND publication_results.claimed_at < v_cutoff
      AND publication_results.job_id = ANY(v_job_ids)
    RETURNING publication_results.job_id
  )
  SELECT COUNT(*)::INTEGER
  INTO v_recovered_count
  FROM recovered;

  -- Pending siblings prove no provider call was claimed. Close them as failed
  -- so one abandoned claim cannot leave the parent permanently Publishing.
  WITH abandoned AS (
    UPDATE public.publication_results
    SET
      status = 'failed',
      error_code = 'unexpected',
      error_message = FORMAT(
        'Publishing to %s could not be completed. Check the platform before trying again.',
        publication_results.platform
      ),
      completed_at = NOW()
    WHERE publication_results.status = 'pending'
      AND publication_results.job_id = ANY(v_job_ids)
    RETURNING publication_results.job_id
  )
  SELECT COUNT(*)::INTEGER
  INTO v_pending_count
  FROM abandoned;

  v_recovered_count := v_recovered_count + v_pending_count;

  FOREACH v_job_id IN ARRAY v_job_ids
  LOOP
    SELECT CASE
      WHEN BOOL_OR(publication_results.status = 'publishing')
        OR BOOL_OR(publication_results.status = 'pending')
        THEN 'publishing'
      WHEN BOOL_OR(publication_results.status = 'unknown')
        THEN 'unknown'
      WHEN BOOL_AND(publication_results.status = 'published')
        THEN 'published'
      WHEN BOOL_OR(publication_results.status = 'published')
        THEN 'partial'
      ELSE 'failed'
    END
    INTO v_job_status
    FROM public.publication_results
    WHERE publication_results.job_id = v_job_id;

    UPDATE public.publication_jobs
    SET
      status = v_job_status,
      completed_at = CASE
        WHEN v_job_status IN ('partial', 'published', 'failed', 'unknown') THEN NOW()
        ELSE NULL
      END
    WHERE publication_jobs.id = v_job_id;
  END LOOP;

  RETURN v_recovered_count;
END;
$$;
