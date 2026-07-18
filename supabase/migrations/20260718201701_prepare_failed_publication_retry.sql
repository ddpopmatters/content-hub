-- Claim one failed platform on an existing Partial job for an explicit owner
-- retry. The retry key makes an HTTP replay readable but never claimable twice.

ALTER TABLE public.publication_results
  ADD COLUMN retry_request_keys UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

CREATE OR REPLACE FUNCTION public.claim_failed_publication_retry(
  p_job_id UUID,
  p_platform TEXT,
  p_requested_by UUID,
  p_entry_revision BIGINT,
  p_retry_request_key UUID
)
RETURNS TABLE(job_id UUID, job_status TEXT, claimed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry_id UUID;
  v_job_status TEXT;
  v_result_status TEXT;
  v_retry_request_keys UUID[];
BEGIN
  IF
    p_job_id IS NULL
    OR p_requested_by IS NULL
    OR p_entry_revision IS NULL
    OR p_entry_revision <= 0
    OR p_retry_request_key IS NULL
    OR p_platform IS NULL
    OR p_platform NOT IN (
      'BlueSky',
      'Instagram',
      'Facebook',
      'LinkedIn',
      'LinkedIn Org'
    )
  THEN
    RETURN;
  END IF;

  -- Match every other transition's parent-before-child lock order.
  SELECT
    publication_jobs.entry_id,
    publication_jobs.status
  INTO v_entry_id, v_job_status
  FROM public.publication_jobs
  WHERE publication_jobs.id = p_job_id
    AND publication_jobs.requested_by = p_requested_by
    AND publication_jobs.entry_revision = p_entry_revision
    AND publication_jobs.trigger_type = 'manual'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    publication_results.status,
    publication_results.retry_request_keys
  INTO v_result_status, v_retry_request_keys
  FROM public.publication_results
  WHERE publication_results.job_id = p_job_id
    AND publication_results.platform = p_platform
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- The same request key is a durable replay, including after a definitive
  -- failure. It returns the job for reconciliation without another claim.
  IF p_retry_request_key = ANY(v_retry_request_keys) THEN
    RETURN QUERY SELECT p_job_id, v_job_status, FALSE;
    RETURN;
  END IF;

  -- A confirmed result is always readable and never reset, regardless of the
  -- key supplied by a late or duplicated client request.
  IF
    v_result_status = 'published'
    AND v_job_status IN ('partial', 'published')
  THEN
    RETURN QUERY SELECT p_job_id, v_job_status, FALSE;
    RETURN;
  END IF;

  IF v_job_status <> 'partial' OR v_result_status <> 'failed' THEN
    RETURN;
  END IF;

  -- Partial must contain a confirmed success. Check it explicitly so this
  -- function cannot become a general reset primitive if aggregate state is
  -- corrupted or changed later.
  IF NOT EXISTS (
    SELECT 1
    FROM public.publication_results
    WHERE publication_results.job_id = p_job_id
      AND publication_results.status = 'published'
  ) OR EXISTS (
    SELECT 1
    FROM public.publication_results
    WHERE publication_results.job_id = p_job_id
      AND publication_results.status IN ('pending', 'publishing', 'unknown')
  ) THEN
    RETURN;
  END IF;

  -- Lock and validate the entry in the same transaction as the provider claim.
  -- The immutable job snapshot remains the provider payload after this point.
  PERFORM 1
  FROM public.entries
  WHERE entries.id = v_entry_id
    AND entries.deleted_at IS NULL
    AND entries.workflow_status = 'Approved'
    AND entries.approved_at IS NOT NULL
    AND entries.content_revision = p_entry_revision
    AND entries.approved_revision = p_entry_revision
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.publication_results
  SET
    status = 'publishing',
    provider_post_id = NULL,
    provider_url = NULL,
    error_code = NULL,
    error_message = NULL,
    attempt_count = publication_results.attempt_count + 1,
    retry_request_keys = ARRAY_APPEND(
      publication_results.retry_request_keys,
      p_retry_request_key
    ),
    claimed_at = NOW(),
    completed_at = NULL
  WHERE publication_results.job_id = p_job_id
    AND publication_results.platform = p_platform
    AND publication_results.status = 'failed';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.publication_jobs
  SET
    status = 'publishing',
    claimed_at = COALESCE(publication_jobs.claimed_at, NOW()),
    completed_at = NULL
  WHERE publication_jobs.id = p_job_id;

  RETURN QUERY SELECT p_job_id, 'publishing'::TEXT, TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_failed_publication_retry(
  UUID,
  TEXT,
  UUID,
  BIGINT,
  UUID
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_failed_publication_retry(
  UUID,
  TEXT,
  UUID,
  BIGINT,
  UUID
) TO service_role;

COMMENT ON COLUMN public.publication_results.retry_request_keys IS
  'Every explicit retry intent for this result; a replay of any prior key cannot create another provider attempt.';

COMMENT ON FUNCTION public.claim_failed_publication_retry(
  UUID,
  TEXT,
  UUID,
  BIGINT,
  UUID
) IS 'Service-only atomic claim for retrying one definitive failed result on a Partial manual publication job.';

-- The frontend release gate calls the Edge Function, which in turn reads this
-- service-only marker. Readiness is true only when both runtime and schema use
-- the same durable publication contract.
CREATE OR REPLACE FUNCTION public.get_publication_contract_version()
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $$
  SELECT 'durable-manual-v1'::TEXT;
$$;

REVOKE ALL ON FUNCTION public.get_publication_contract_version()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_publication_contract_version()
TO service_role;

COMMENT ON FUNCTION public.get_publication_contract_version() IS
  'Service-only marker used to block frontend rollout until the durable publication schema is active.';
