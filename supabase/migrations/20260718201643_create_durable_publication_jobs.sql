-- Durable publication intents and per-platform outcomes.
-- Browser roles may read only their own records; all writes go through the
-- owner-authenticated publication Edge Function using the service role.

CREATE TABLE public.publication_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE RESTRICT,
  entry_revision BIGINT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  request_key UUID NOT NULL,
  requested_by UUID NOT NULL,
  requested_by_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  payload_snapshot JSONB NOT NULL,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT publication_jobs_entry_revision_positive CHECK (entry_revision > 0),
  CONSTRAINT publication_jobs_trigger_type_valid CHECK (trigger_type IN ('manual', 'scheduled')),
  CONSTRAINT publication_jobs_status_valid CHECK (
    status IN ('queued', 'publishing', 'partial', 'published', 'failed', 'unknown', 'cancelled')
  ),
  CONSTRAINT publication_jobs_requester_email_valid CHECK (
    requested_by_email = LOWER(BTRIM(requested_by_email))
    AND requested_by_email <> ''
    AND LENGTH(requested_by_email) <= 320
  ),
  CONSTRAINT publication_jobs_payload_object CHECK (
    JSONB_TYPEOF(payload_snapshot) = 'object'
    AND payload_snapshot ?& ARRAY[
      'entryId',
      'platforms',
      'caption',
      'platformCaptions',
      'assetType',
      'mediaUrls',
      'previewUrl',
      'firstComment'
    ]
    AND (
      payload_snapshot - ARRAY[
        'entryId',
        'platforms',
        'caption',
        'platformCaptions',
        'assetType',
        'mediaUrls',
        'previewUrl',
        'firstComment'
      ]
    ) = '{}'::JSONB
  ),
  CONSTRAINT publication_jobs_timestamps_valid CHECK (
    (claimed_at IS NULL OR claimed_at >= created_at)
    AND (completed_at IS NULL OR completed_at >= created_at)
    AND (
      (status IN ('partial', 'published', 'failed', 'unknown', 'cancelled') AND completed_at IS NOT NULL)
      OR (status IN ('queued', 'publishing') AND completed_at IS NULL)
    )
  ),
  CONSTRAINT publication_jobs_request_key_unique UNIQUE (requested_by, request_key)
);

CREATE TABLE public.publication_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.publication_jobs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  provider_post_id TEXT,
  provider_url TEXT,
  error_code TEXT,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT publication_results_platform_valid CHECK (
    platform IN ('BlueSky', 'Instagram', 'Facebook', 'LinkedIn', 'LinkedIn Org')
  ),
  CONSTRAINT publication_results_status_valid CHECK (
    status IN ('pending', 'publishing', 'published', 'failed', 'skipped', 'unknown')
  ),
  CONSTRAINT publication_results_attempt_count_valid CHECK (attempt_count >= 0),
  CONSTRAINT publication_results_provider_post_id_length CHECK (
    provider_post_id IS NULL
    OR (BTRIM(provider_post_id) <> '' AND LENGTH(provider_post_id) <= 2048)
  ),
  CONSTRAINT publication_results_provider_url_valid CHECK (
    provider_url IS NULL
    OR (LENGTH(provider_url) <= 4096 AND provider_url ~ '^https://')
  ),
  CONSTRAINT publication_results_error_code_valid CHECK (
    error_code IS NULL
    OR error_code IN (
      'connection_missing',
      'multiple_connections',
      'reconnect_required',
      'media_unavailable',
      'unsupported',
      'provider_rejected',
      'provider_timeout',
      'persistence_failed',
      'unexpected'
    )
  ),
  CONSTRAINT publication_results_error_message_length CHECK (
    error_message IS NULL OR LENGTH(error_message) <= 500
  ),
  CONSTRAINT publication_results_outcome_shape CHECK (
    (
      status IN ('pending', 'publishing')
      AND provider_post_id IS NULL
      AND provider_url IS NULL
      AND error_code IS NULL
      AND error_message IS NULL
      AND completed_at IS NULL
    )
    OR (
      status = 'published'
      AND provider_post_id IS NOT NULL
      AND error_code IS NULL
      AND error_message IS NULL
      AND completed_at IS NOT NULL
    )
    OR (
      status IN ('failed', 'skipped', 'unknown')
      AND provider_post_id IS NULL
      AND provider_url IS NULL
      AND error_code IS NOT NULL
      AND error_message IS NOT NULL
      AND completed_at IS NOT NULL
    )
  ),
  CONSTRAINT publication_results_timestamps_valid CHECK (
    (claimed_at IS NULL OR claimed_at >= created_at)
    AND (completed_at IS NULL OR completed_at >= created_at)
  ),
  CONSTRAINT publication_results_job_platform_unique UNIQUE (job_id, platform)
);

CREATE INDEX publication_jobs_entry_revision_created_idx
  ON public.publication_jobs(entry_id, entry_revision, created_at DESC);

CREATE INDEX publication_jobs_status_created_idx
  ON public.publication_jobs(status, created_at);

CREATE INDEX publication_results_job_status_idx
  ON public.publication_results(job_id, status);

CREATE TRIGGER update_publication_jobs_updated_at
  BEFORE UPDATE ON public.publication_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_publication_results_updated_at
  BEFORE UPDATE ON public.publication_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.publication_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY publication_jobs_select_own
  ON public.publication_jobs
  FOR SELECT
  TO authenticated
  USING (requested_by = auth.uid());

CREATE POLICY publication_results_select_own
  ON public.publication_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.publication_jobs
      WHERE publication_jobs.id = publication_results.job_id
        AND publication_jobs.requested_by = auth.uid()
    )
  );

REVOKE ALL ON TABLE public.publication_jobs FROM anon, authenticated;
REVOKE ALL ON TABLE public.publication_results FROM anon, authenticated;
GRANT SELECT (
  id,
  entry_id,
  entry_revision,
  trigger_type,
  request_key,
  requested_by,
  status,
  claimed_at,
  completed_at,
  created_at,
  updated_at
) ON TABLE public.publication_jobs TO authenticated;
GRANT SELECT (
  id,
  job_id,
  platform,
  status,
  provider_url,
  error_code,
  error_message,
  attempt_count,
  claimed_at,
  completed_at,
  created_at,
  updated_at
) ON TABLE public.publication_results TO authenticated;
GRANT ALL ON TABLE public.publication_jobs TO service_role;
GRANT ALL ON TABLE public.publication_results TO service_role;

CREATE OR REPLACE FUNCTION public.create_manual_publication_job(
  p_entry_id UUID,
  p_entry_revision BIGINT,
  p_request_key UUID,
  p_requested_by UUID,
  p_requested_by_email TEXT,
  p_payload_snapshot JSONB,
  p_platforms TEXT[]
)
RETURNS TABLE(job_id UUID, job_status TEXT, created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.publication_jobs%ROWTYPE;
  v_created BOOLEAN := FALSE;
BEGIN
  IF
    p_entry_id IS NULL
    OR p_entry_revision IS NULL
    OR p_entry_revision <= 0
    OR p_request_key IS NULL
    OR p_requested_by IS NULL
    OR p_requested_by_email IS NULL
    OR BTRIM(p_requested_by_email) = ''
    OR p_payload_snapshot IS NULL
    OR JSONB_TYPEOF(p_payload_snapshot) <> 'object'
    OR p_platforms IS NULL
    OR CARDINALITY(p_platforms) = 0
    OR CARDINALITY(p_platforms) > 5
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_publication_intent';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM UNNEST(p_platforms) AS requested_platform(platform)
    WHERE requested_platform.platform IS NULL
      OR requested_platform.platform NOT IN (
        'BlueSky',
        'Instagram',
        'Facebook',
        'LinkedIn',
        'LinkedIn Org'
      )
  ) OR (
    SELECT COUNT(DISTINCT requested_platform.platform)
    FROM UNNEST(p_platforms) AS requested_platform(platform)
  ) <> CARDINALITY(p_platforms)
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_publication_platforms';
  END IF;

  IF
    p_payload_snapshot ->> 'entryId' IS DISTINCT FROM p_entry_id::TEXT
    OR p_payload_snapshot -> 'platforms' IS DISTINCT FROM TO_JSONB(p_platforms)
    OR NOT p_payload_snapshot ?& ARRAY[
      'platforms',
      'caption',
      'platformCaptions',
      'assetType',
      'mediaUrls',
      'previewUrl',
      'firstComment'
    ]
  THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_publication_payload';
  END IF;

  PERFORM 1
  FROM public.entries
  WHERE entries.id = p_entry_id
    AND entries.deleted_at IS NULL
    AND entries.workflow_status = 'Approved'
    AND entries.content_revision = p_entry_revision
    AND entries.approved_revision = p_entry_revision;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'entry_revision_not_publishable';
  END IF;

  INSERT INTO public.publication_jobs (
    entry_id,
    entry_revision,
    trigger_type,
    request_key,
    requested_by,
    requested_by_email,
    status,
    payload_snapshot
  ) VALUES (
    p_entry_id,
    p_entry_revision,
    'manual',
    p_request_key,
    p_requested_by,
    LOWER(BTRIM(p_requested_by_email)),
    'queued',
    p_payload_snapshot
  )
  ON CONFLICT (requested_by, request_key) DO NOTHING
  RETURNING * INTO v_job;

  v_created := FOUND;

  IF v_created THEN
    INSERT INTO public.publication_results (job_id, platform)
    SELECT v_job.id, requested_platform.platform
    FROM UNNEST(p_platforms) AS requested_platform(platform);
  ELSE
    SELECT * INTO v_job
    FROM public.publication_jobs
    WHERE publication_jobs.requested_by = p_requested_by
      AND publication_jobs.request_key = p_request_key;

    IF
      v_job.id IS NULL
      OR v_job.entry_id IS DISTINCT FROM p_entry_id
      OR v_job.entry_revision IS DISTINCT FROM p_entry_revision
      OR v_job.requested_by_email IS DISTINCT FROM LOWER(BTRIM(p_requested_by_email))
      OR v_job.payload_snapshot IS DISTINCT FROM p_payload_snapshot
    THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'publication_request_key_conflict';
    END IF;
  END IF;

  RETURN QUERY SELECT v_job.id, v_job.status, v_created;
END;
$$;

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
  WHERE publication_jobs.id = p_job_id
    AND publication_jobs.status IN ('queued', 'publishing');

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

REVOKE ALL ON FUNCTION public.create_manual_publication_job(
  UUID,
  BIGINT,
  UUID,
  UUID,
  TEXT,
  JSONB,
  TEXT[]
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_publication_result(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_publication_result(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_manual_publication_job(
  UUID,
  BIGINT,
  UUID,
  UUID,
  TEXT,
  JSONB,
  TEXT[]
) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_publication_result(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_publication_result(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) TO service_role;

COMMENT ON TABLE public.publication_jobs IS
  'Durable, idempotent publication intents bound to one approved entry revision.';
COMMENT ON TABLE public.publication_results IS
  'One durable provider outcome per platform and publication job.';
COMMENT ON COLUMN public.publication_jobs.payload_snapshot IS
  'Server-authored approved payload only; browser reads and provider credential fields are prohibited.';
