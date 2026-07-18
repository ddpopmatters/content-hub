-- A provider attempt that remains claimed beyond the execution window cannot be
-- retried safely: the provider may have accepted it before the worker stopped.
-- Recover such rows to Unknown and recompute their parent jobs.

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
BEGIN
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
    RETURNING publication_results.job_id
  )
  SELECT ARRAY_AGG(DISTINCT recovered.job_id), COUNT(*)::INTEGER
  INTO v_job_ids, v_recovered_count
  FROM recovered;

  IF v_recovered_count = 0 THEN
    RETURN 0;
  END IF;

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

REVOKE ALL ON FUNCTION public.recover_stale_publication_results()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stale_publication_results()
  TO service_role;
