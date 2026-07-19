-- Canonical inert proposals and one-time transactional execution for PM Hermes.
-- Browser roles cannot read or mutate this ledger or invoke its service-only RPCs.

CREATE TABLE public.agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL CHECK (
    char_length(client_id) BETWEEN 3 AND 80
    AND client_id ~ '^[a-z0-9][a-z0-9_-]*$'
  ),
  action_type TEXT NOT NULL CHECK (
    action_type IN (
      'create_idea',
      'create_entry',
      'update_entry',
      'add_comment',
      'submit_for_review',
      'create_report',
      'update_report'
    )
  ),
  target_id UUID,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  payload_hash TEXT NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  idempotency_key TEXT NOT NULL CHECK (
    char_length(idempotency_key) BETWEEN 8 AND 160
    AND idempotency_key ~ '^[A-Za-z0-9._:-]+$'
  ),
  summary TEXT NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (
    status IN ('proposed', 'executing', 'applied', 'rejected', 'expired', 'failed')
  ),
  expires_at TIMESTAMPTZ NOT NULL,
  approval_reference TEXT CHECK (
    approval_reference IS NULL OR approval_reference ~ '^cha_[a-f0-9]{24}$'
  ),
  approved_by TEXT CHECK (
    approved_by IS NULL OR char_length(approved_by) BETWEEN 1 AND 160
  ),
  approved_at TIMESTAMPTZ,
  result_class TEXT CHECK (
    result_class IS NULL OR result_class IN (
      'applied',
      'approval_mismatch',
      'conflict',
      'expired',
      'validation_failed',
      'internal_error'
    )
  ),
  result JSONB CHECK (result IS NULL OR jsonb_typeof(result) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  executing_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT agent_actions_client_idempotency_key UNIQUE (client_id, idempotency_key)
);

CREATE INDEX agent_actions_client_created_idx
  ON public.agent_actions (client_id, created_at DESC);
CREATE INDEX agent_actions_status_expiry_idx
  ON public.agent_actions (status, expires_at);
CREATE UNIQUE INDEX agent_actions_approval_reference_idx
  ON public.agent_actions (approval_reference)
  WHERE approval_reference IS NOT NULL;

ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.agent_actions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_actions TO service_role;

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS agent_provenance JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(agent_provenance) = 'object');
ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS agent_provenance JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(agent_provenance) = 'object');
ALTER TABLE public.monthly_reports
  ADD COLUMN IF NOT EXISTS agent_provenance JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(agent_provenance) = 'object');

CREATE OR REPLACE FUNCTION public.protect_agent_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role')
    AND auth.role() IS DISTINCT FROM 'service_role'
  THEN
    IF TG_OP = 'INSERT' THEN
      NEW.agent_provenance := '{}'::jsonb;
    ELSE
      NEW.agent_provenance := OLD.agent_provenance;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_entries_agent_provenance ON public.entries;
CREATE TRIGGER protect_entries_agent_provenance
  BEFORE INSERT OR UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION public.protect_agent_provenance();

DROP TRIGGER IF EXISTS protect_ideas_agent_provenance ON public.ideas;
CREATE TRIGGER protect_ideas_agent_provenance
  BEFORE INSERT OR UPDATE ON public.ideas
  FOR EACH ROW EXECUTE FUNCTION public.protect_agent_provenance();

DROP TRIGGER IF EXISTS protect_monthly_reports_agent_provenance ON public.monthly_reports;
CREATE TRIGGER protect_monthly_reports_agent_provenance
  BEFORE INSERT OR UPDATE ON public.monthly_reports
  FOR EACH ROW EXECUTE FUNCTION public.protect_agent_provenance();

CREATE OR REPLACE FUNCTION public.agent_action_public_json(p_action public.agent_actions)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', p_action.id,
    'action_type', p_action.action_type,
    'target_id', p_action.target_id,
    'payload_hash', p_action.payload_hash,
    'idempotency_key', p_action.idempotency_key,
    'summary', p_action.summary,
    'status', p_action.status,
    'expires_at', p_action.expires_at,
    'result_class', p_action.result_class,
    'result', p_action.result,
    'created_at', p_action.created_at,
    'applied_at', p_action.applied_at
  )
$$;

REVOKE ALL ON FUNCTION public.agent_action_public_json(public.agent_actions)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_action_public_json(public.agent_actions)
  TO service_role;

CREATE OR REPLACE FUNCTION public.create_agent_action(
  p_client_id TEXT,
  p_action_type TEXT,
  p_target_id UUID,
  p_payload JSONB,
  p_payload_hash TEXT,
  p_idempotency_key TEXT,
  p_summary TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action public.agent_actions%ROWTYPE;
BEGIN
  IF p_action_type NOT IN (
    'create_idea',
    'create_entry',
    'update_entry',
    'add_comment',
    'submit_for_review',
    'create_report',
    'update_report'
  ) OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR p_payload_hash !~ '^[a-f0-9]{64}$'
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,160}$'
    OR char_length(p_summary) NOT BETWEEN 1 AND 2000
    OR p_expires_at <= clock_timestamp()
    OR p_expires_at > clock_timestamp() + INTERVAL '2 hours'
  THEN
    RAISE EXCEPTION 'invalid agent action proposal';
  END IF;

  IF (p_action_type IN ('create_idea', 'create_entry', 'create_report') AND p_target_id IS NOT NULL)
    OR (p_action_type IN ('update_entry', 'add_comment', 'submit_for_review', 'update_report') AND p_target_id IS NULL)
  THEN
    RAISE EXCEPTION 'invalid agent action target';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_client_id || ':' || p_idempotency_key, 0));

  SELECT * INTO v_action
    FROM public.agent_actions
   WHERE client_id = p_client_id
     AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_action.action_type IS DISTINCT FROM p_action_type
      OR v_action.target_id IS DISTINCT FROM p_target_id
      OR v_action.payload_hash IS DISTINCT FROM p_payload_hash
      OR v_action.payload IS DISTINCT FROM p_payload
    THEN
      RAISE EXCEPTION 'idempotency key reused for different agent action';
    END IF;
    RETURN public.agent_action_public_json(v_action);
  END IF;

  INSERT INTO public.agent_actions (
    client_id,
    action_type,
    target_id,
    payload,
    payload_hash,
    idempotency_key,
    summary,
    expires_at
  ) VALUES (
    p_client_id,
    p_action_type,
    p_target_id,
    p_payload,
    p_payload_hash,
    p_idempotency_key,
    p_summary,
    p_expires_at
  )
  RETURNING * INTO v_action;

  RETURN public.agent_action_public_json(v_action);
END;
$$;

REVOKE ALL ON FUNCTION public.create_agent_action(TEXT, TEXT, UUID, JSONB, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_agent_action(TEXT, TEXT, UUID, JSONB, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;

CREATE OR REPLACE FUNCTION public.apply_agent_action(
  p_action_id UUID,
  p_client_id TEXT,
  p_payload_hash TEXT,
  p_idempotency_key TEXT,
  p_approval_reference TEXT,
  p_approved_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action public.agent_actions%ROWTYPE;
  v_entry public.entries%ROWTYPE;
  v_idea public.ideas%ROWTYPE;
  v_report public.monthly_reports%ROWTYPE;
  v_changes JSONB;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_provenance JSONB;
  v_result JSONB;
  v_comment_id UUID;
BEGIN
  IF p_payload_hash !~ '^[a-f0-9]{64}$'
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{8,160}$'
    OR p_approval_reference !~ '^cha_[a-f0-9]{24}$'
    OR char_length(p_approved_by) NOT BETWEEN 1 AND 160
  THEN
    RAISE EXCEPTION 'invalid approved agent action';
  END IF;

  SELECT * INTO v_action
    FROM public.agent_actions
   WHERE id = p_action_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown agent action';
  END IF;

  IF v_action.client_id IS DISTINCT FROM p_client_id
    OR v_action.payload_hash IS DISTINCT FROM p_payload_hash
    OR v_action.idempotency_key IS DISTINCT FROM p_idempotency_key
  THEN
    UPDATE public.agent_actions
       SET status = 'failed',
           result_class = 'approval_mismatch',
           result = jsonb_build_object('outcome', 'not_applied'),
           updated_at = v_now
     WHERE id = p_action_id;
    SELECT * INTO v_action FROM public.agent_actions WHERE id = p_action_id;
    RETURN jsonb_build_object(
      'decision', 'rejected',
      'action', public.agent_action_public_json(v_action)
    );
  END IF;

  IF v_action.status = 'applied' THEN
    IF v_action.approval_reference IS DISTINCT FROM p_approval_reference THEN
      RETURN jsonb_build_object(
        'decision', 'rejected',
        'action', public.agent_action_public_json(v_action)
      );
    END IF;
    RETURN jsonb_build_object(
      'decision', 'idempotent_replay',
      'action', public.agent_action_public_json(v_action)
    );
  END IF;

  IF v_action.status <> 'proposed' THEN
    RETURN jsonb_build_object(
      'decision', CASE WHEN v_action.status = 'expired' THEN 'expired' ELSE 'failed' END,
      'action', public.agent_action_public_json(v_action)
    );
  END IF;

  IF v_action.expires_at <= v_now THEN
    UPDATE public.agent_actions
       SET status = 'expired',
           result_class = 'expired',
           result = jsonb_build_object('outcome', 'not_applied'),
           updated_at = v_now
     WHERE id = p_action_id;
    SELECT * INTO v_action FROM public.agent_actions WHERE id = p_action_id;
    RETURN jsonb_build_object(
      'decision', 'expired',
      'action', public.agent_action_public_json(v_action)
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('agent-approval:' || p_approval_reference, 0));

  IF EXISTS (
    SELECT 1 FROM public.agent_actions
     WHERE approval_reference = p_approval_reference
       AND id <> p_action_id
  ) THEN
    UPDATE public.agent_actions
       SET status = 'failed',
           result_class = 'approval_mismatch',
           result = jsonb_build_object('outcome', 'not_applied'),
           updated_at = v_now
     WHERE id = p_action_id;
    SELECT * INTO v_action FROM public.agent_actions WHERE id = p_action_id;
    RETURN jsonb_build_object(
      'decision', 'rejected',
      'action', public.agent_action_public_json(v_action)
    );
  END IF;

  UPDATE public.agent_actions
     SET status = 'executing',
         approval_reference = p_approval_reference,
         approved_by = p_approved_by,
         approved_at = v_now,
         executing_at = v_now,
         updated_at = v_now
   WHERE id = p_action_id
     AND status = 'proposed';

  v_provenance := jsonb_build_object(
    'source', 'PM Hermes',
    'actionId', v_action.id,
    'actionType', v_action.action_type,
    'approvalReference', p_approval_reference,
    'approvedBy', p_approved_by,
    'appliedAt', v_now
  );

  BEGIN
    IF v_action.action_type = 'create_idea' THEN
      INSERT INTO public.ideas (
        type,
        title,
        notes,
        links,
        attachments,
        inspiration,
        created_by,
        created_by_email,
        target_date,
        target_month,
        agent_provenance
      ) VALUES (
        v_action.payload->>'type',
        v_action.payload->>'title',
        v_action.payload->>'notes',
        COALESCE(v_action.payload->'links', '[]'::jsonb),
        '[]'::jsonb,
        v_action.payload->>'inspiration',
        'PM Hermes',
        'pm-hermes@agent.local',
        NULLIF(v_action.payload->>'targetDate', '')::date,
        NULLIF(v_action.payload->>'targetMonth', ''),
        v_provenance
      )
      RETURNING * INTO v_idea;

      v_result := jsonb_build_object(
        'recordType', 'idea',
        'id', v_idea.id,
        'type', v_idea.type,
        'title', v_idea.title,
        'targetDate', v_idea.target_date,
        'targetMonth', v_idea.target_month,
        'createdAt', v_idea.created_at,
        'agentProvenance', v_idea.agent_provenance
      );

    ELSIF v_action.action_type = 'create_entry' THEN
      INSERT INTO public.entries (
        date,
        platforms,
        asset_type,
        caption,
        platform_captions,
        first_comment,
        approval_deadline,
        status,
        approvers,
        author,
        author_email,
        campaign,
        content_pillar,
        priority_tier,
        url,
        content_category,
        response_mode,
        sign_off_route,
        audience_segments,
        source_verified,
        link_placement,
        cta_type,
        script,
        design_copy,
        carousel_slides,
        workflow_status,
        agent_provenance
      ) VALUES (
        (v_action.payload->>'date')::date,
        v_action.payload->'platforms',
        COALESCE(v_action.payload->>'assetType', 'No asset'),
        v_action.payload->>'caption',
        COALESCE(v_action.payload->'platformCaptions', '{}'::jsonb),
        COALESCE(v_action.payload->>'firstComment', ''),
        NULLIF(v_action.payload->>'approvalDeadline', '')::date,
        'Pending',
        COALESCE(v_action.payload->'approvers', '[]'::jsonb),
        'PM Hermes',
        'pm-hermes@agent.local',
        COALESCE(v_action.payload->>'campaign', ''),
        COALESCE(v_action.payload->>'contentPillar', ''),
        COALESCE(v_action.payload->>'priorityTier', 'Medium'),
        NULLIF(v_action.payload->>'url', ''),
        NULLIF(v_action.payload->>'contentCategory', ''),
        NULLIF(v_action.payload->>'responseMode', ''),
        NULLIF(v_action.payload->>'signOffRoute', ''),
        COALESCE(v_action.payload->'audienceSegments', '[]'::jsonb),
        CASE WHEN v_action.payload ? 'sourceVerified' THEN (v_action.payload->>'sourceVerified')::boolean ELSE NULL END,
        NULLIF(v_action.payload->>'linkPlacement', ''),
        NULLIF(v_action.payload->>'ctaType', ''),
        NULLIF(v_action.payload->>'script', ''),
        NULLIF(v_action.payload->>'designCopy', ''),
        COALESCE(v_action.payload->'carouselSlides', '[]'::jsonb),
        'Draft',
        v_provenance
      )
      RETURNING * INTO v_entry;

      v_result := jsonb_build_object(
        'recordType', 'entry',
        'id', v_entry.id,
        'date', v_entry.date,
        'platforms', v_entry.platforms,
        'caption', v_entry.caption,
        'status', v_entry.status,
        'workflowStatus', v_entry.workflow_status,
        'contentRevision', v_entry.content_revision,
        'updatedAt', v_entry.updated_at,
        'agentProvenance', v_entry.agent_provenance
      );

    ELSIF v_action.action_type = 'update_entry' THEN
      v_changes := v_action.payload->'changes';
      UPDATE public.entries
         SET date = CASE WHEN v_changes ? 'date' THEN (v_changes->>'date')::date ELSE date END,
             platforms = CASE WHEN v_changes ? 'platforms' THEN v_changes->'platforms' ELSE platforms END,
             asset_type = CASE WHEN v_changes ? 'assetType' THEN v_changes->>'assetType' ELSE asset_type END,
             caption = CASE WHEN v_changes ? 'caption' THEN v_changes->>'caption' ELSE caption END,
             platform_captions = CASE WHEN v_changes ? 'platformCaptions' THEN v_changes->'platformCaptions' ELSE platform_captions END,
             first_comment = CASE WHEN v_changes ? 'firstComment' THEN v_changes->>'firstComment' ELSE first_comment END,
             approval_deadline = CASE WHEN v_changes ? 'approvalDeadline' THEN NULLIF(v_changes->>'approvalDeadline', '')::date ELSE approval_deadline END,
             approvers = CASE WHEN v_changes ? 'approvers' THEN v_changes->'approvers' ELSE approvers END,
             campaign = CASE WHEN v_changes ? 'campaign' THEN v_changes->>'campaign' ELSE campaign END,
             content_pillar = CASE WHEN v_changes ? 'contentPillar' THEN v_changes->>'contentPillar' ELSE content_pillar END,
             priority_tier = CASE WHEN v_changes ? 'priorityTier' THEN v_changes->>'priorityTier' ELSE priority_tier END,
             url = CASE WHEN v_changes ? 'url' THEN NULLIF(v_changes->>'url', '') ELSE url END,
             content_category = CASE WHEN v_changes ? 'contentCategory' THEN NULLIF(v_changes->>'contentCategory', '') ELSE content_category END,
             response_mode = CASE WHEN v_changes ? 'responseMode' THEN NULLIF(v_changes->>'responseMode', '') ELSE response_mode END,
             sign_off_route = CASE WHEN v_changes ? 'signOffRoute' THEN NULLIF(v_changes->>'signOffRoute', '') ELSE sign_off_route END,
             audience_segments = CASE WHEN v_changes ? 'audienceSegments' THEN v_changes->'audienceSegments' ELSE audience_segments END,
             source_verified = CASE WHEN v_changes ? 'sourceVerified' THEN (v_changes->>'sourceVerified')::boolean ELSE source_verified END,
             link_placement = CASE WHEN v_changes ? 'linkPlacement' THEN NULLIF(v_changes->>'linkPlacement', '') ELSE link_placement END,
             cta_type = CASE WHEN v_changes ? 'ctaType' THEN NULLIF(v_changes->>'ctaType', '') ELSE cta_type END,
             script = CASE WHEN v_changes ? 'script' THEN NULLIF(v_changes->>'script', '') ELSE script END,
             design_copy = CASE WHEN v_changes ? 'designCopy' THEN NULLIF(v_changes->>'designCopy', '') ELSE design_copy END,
             carousel_slides = CASE WHEN v_changes ? 'carouselSlides' THEN v_changes->'carouselSlides' ELSE carousel_slides END,
             agent_provenance = v_provenance
       WHERE id = v_action.target_id
         AND deleted_at IS NULL
         AND workflow_status IN ('Draft', 'In Review')
         AND content_revision = (v_action.payload->>'expectedContentRevision')::bigint
         AND updated_at = (v_action.payload->>'expectedUpdatedAt')::timestamptz
      RETURNING * INTO v_entry;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'agent action conflict';
      END IF;

      v_result := jsonb_build_object(
        'recordType', 'entry',
        'id', v_entry.id,
        'date', v_entry.date,
        'platforms', v_entry.platforms,
        'caption', v_entry.caption,
        'status', v_entry.status,
        'workflowStatus', v_entry.workflow_status,
        'contentRevision', v_entry.content_revision,
        'updatedAt', v_entry.updated_at,
        'agentProvenance', v_entry.agent_provenance
      );

    ELSIF v_action.action_type = 'add_comment' THEN
      v_comment_id := gen_random_uuid();
      UPDATE public.entries
         SET comments = COALESCE(comments, '[]'::jsonb) || jsonb_build_array(
               jsonb_build_object(
                 'id', v_comment_id,
                 'author', 'PM Hermes',
                 'body', v_action.payload->>'body',
                 'createdAt', v_now,
                 'mentions', '[]'::jsonb,
                 'type', 'comment'
               )
             ),
             agent_provenance = v_provenance
       WHERE id = v_action.target_id
         AND deleted_at IS NULL
         AND workflow_status IN ('Draft', 'In Review')
         AND updated_at = (v_action.payload->>'expectedUpdatedAt')::timestamptz
      RETURNING * INTO v_entry;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'agent action conflict';
      END IF;

      v_result := jsonb_build_object(
        'recordType', 'entry_comment',
        'id', v_comment_id,
        'entryId', v_entry.id,
        'workflowStatus', v_entry.workflow_status,
        'contentRevision', v_entry.content_revision,
        'updatedAt', v_entry.updated_at,
        'agentProvenance', v_entry.agent_provenance
      );

    ELSIF v_action.action_type = 'submit_for_review' THEN
      UPDATE public.entries
         SET workflow_status = 'In Review',
             status = 'Pending',
             approved_at = NULL,
             approved_revision = NULL,
             agent_provenance = v_provenance
       WHERE id = v_action.target_id
         AND deleted_at IS NULL
         AND workflow_status = 'Draft'
         AND content_revision = (v_action.payload->>'expectedContentRevision')::bigint
         AND updated_at = (v_action.payload->>'expectedUpdatedAt')::timestamptz
      RETURNING * INTO v_entry;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'agent action conflict';
      END IF;

      v_result := jsonb_build_object(
        'recordType', 'entry',
        'id', v_entry.id,
        'status', v_entry.status,
        'workflowStatus', v_entry.workflow_status,
        'contentRevision', v_entry.content_revision,
        'updatedAt', v_entry.updated_at,
        'agentProvenance', v_entry.agent_provenance
      );

    ELSIF v_action.action_type = 'create_report' THEN
      INSERT INTO public.monthly_reports (
        report_type,
        period_month,
        period_quarter,
        period_year,
        campaign_name,
        date_from,
        date_to,
        platform_metrics,
        qualitative,
        created_by,
        created_by_email,
        agent_provenance
      ) VALUES (
        v_action.payload->>'reportType',
        (v_action.payload->>'periodMonth')::integer,
        (v_action.payload->>'periodQuarter')::integer,
        (v_action.payload->>'periodYear')::integer,
        v_action.payload->>'campaignName',
        (v_action.payload->>'dateFrom')::date,
        (v_action.payload->>'dateTo')::date,
        v_action.payload->'platformMetrics',
        v_action.payload->'qualitative',
        'PM Hermes',
        'pm-hermes@agent.local',
        v_provenance
      )
      RETURNING * INTO v_report;

      v_result := jsonb_build_object(
        'recordType', 'report',
        'id', v_report.id,
        'reportType', v_report.report_type,
        'periodMonth', v_report.period_month,
        'periodQuarter', v_report.period_quarter,
        'periodYear', v_report.period_year,
        'campaignName', v_report.campaign_name,
        'dateFrom', v_report.date_from,
        'dateTo', v_report.date_to,
        'platformMetrics', v_report.platform_metrics,
        'qualitative', v_report.qualitative,
        'updatedAt', v_report.updated_at,
        'agentProvenance', v_report.agent_provenance
      );

    ELSIF v_action.action_type = 'update_report' THEN
      UPDATE public.monthly_reports
         SET platform_metrics = v_action.payload->'platformMetrics',
             qualitative = v_action.payload->'qualitative',
             agent_provenance = v_provenance
       WHERE id = v_action.target_id
         AND updated_at = (v_action.payload->>'expectedUpdatedAt')::timestamptz
      RETURNING * INTO v_report;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'agent action conflict';
      END IF;

      v_result := jsonb_build_object(
        'recordType', 'report',
        'id', v_report.id,
        'reportType', v_report.report_type,
        'periodMonth', v_report.period_month,
        'periodQuarter', v_report.period_quarter,
        'periodYear', v_report.period_year,
        'campaignName', v_report.campaign_name,
        'dateFrom', v_report.date_from,
        'dateTo', v_report.date_to,
        'platformMetrics', v_report.platform_metrics,
        'qualitative', v_report.qualitative,
        'updatedAt', v_report.updated_at,
        'agentProvenance', v_report.agent_provenance
      );
    ELSE
      RAISE EXCEPTION 'unsupported agent action';
    END IF;

    INSERT INTO public.activity_log (
      action_type,
      target_type,
      target_id,
      target_title,
      actor_email,
      actor_name,
      details,
      related_users
    ) VALUES (
      'agent_' || v_action.action_type,
      CASE
        WHEN v_action.action_type = 'create_idea' THEN 'idea'
        WHEN v_action.action_type IN ('create_report', 'update_report') THEN 'report'
        ELSE 'entry'
      END,
      (CASE
        WHEN v_action.action_type = 'add_comment' THEN v_result->>'entryId'
        ELSE v_result->>'id'
      END)::uuid,
      v_action.summary,
      'pm-hermes@agent.local',
      'PM Hermes',
      jsonb_build_object(
        'actionId', v_action.id,
        'approvalReference', p_approval_reference,
        'approvedBy', p_approved_by,
        'payloadHash', left(v_action.payload_hash, 12),
        'outcome', 'applied'
      ),
      '[]'::jsonb
    );
  EXCEPTION
    WHEN serialization_failure THEN
      UPDATE public.agent_actions
         SET status = 'failed',
             result_class = 'conflict',
             result = jsonb_build_object('outcome', 'not_applied'),
             updated_at = clock_timestamp()
       WHERE id = p_action_id;
      SELECT * INTO v_action FROM public.agent_actions WHERE id = p_action_id;
      RETURN jsonb_build_object(
        'decision', 'conflict',
        'action', public.agent_action_public_json(v_action)
      );
    WHEN unique_violation THEN
      UPDATE public.agent_actions
         SET status = 'failed',
             result_class = 'conflict',
             result = jsonb_build_object('outcome', 'not_applied'),
             updated_at = clock_timestamp()
       WHERE id = p_action_id;
      SELECT * INTO v_action FROM public.agent_actions WHERE id = p_action_id;
      RETURN jsonb_build_object(
        'decision', 'conflict',
        'action', public.agent_action_public_json(v_action)
      );
    WHEN check_violation OR not_null_violation OR invalid_text_representation THEN
      UPDATE public.agent_actions
         SET status = 'failed',
             result_class = 'validation_failed',
             result = jsonb_build_object('outcome', 'not_applied'),
             updated_at = clock_timestamp()
       WHERE id = p_action_id;
      SELECT * INTO v_action FROM public.agent_actions WHERE id = p_action_id;
      RETURN jsonb_build_object(
        'decision', 'failed',
        'action', public.agent_action_public_json(v_action)
      );
    WHEN OTHERS THEN
      UPDATE public.agent_actions
         SET status = 'failed',
             result_class = 'internal_error',
             result = jsonb_build_object('outcome', 'not_applied'),
             updated_at = clock_timestamp()
       WHERE id = p_action_id;
      SELECT * INTO v_action FROM public.agent_actions WHERE id = p_action_id;
      RETURN jsonb_build_object(
        'decision', 'failed',
        'action', public.agent_action_public_json(v_action)
      );
  END;

  UPDATE public.agent_actions
     SET status = 'applied',
         result_class = 'applied',
         result = v_result,
         applied_at = clock_timestamp(),
         updated_at = clock_timestamp()
   WHERE id = p_action_id
     AND status = 'executing';

  SELECT * INTO v_action FROM public.agent_actions WHERE id = p_action_id;
  RETURN jsonb_build_object(
    'decision', 'applied',
    'action', public.agent_action_public_json(v_action)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_agent_action(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_agent_action(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

COMMENT ON TABLE public.agent_actions IS
  'Service-only canonical PM Hermes proposals and one-time outcomes. Payloads are never browser-readable.';
COMMENT ON COLUMN public.entries.agent_provenance IS
  'Latest approval-gated PM Hermes action provenance; browser writes are ignored.';
