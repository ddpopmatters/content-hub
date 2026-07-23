BEGIN;

ALTER TABLE public.monthly_reports
  ADD COLUMN IF NOT EXISTS agent_evidence JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(agent_evidence) = 'object');

CREATE OR REPLACE FUNCTION public.protect_monthly_report_agent_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_evidence JSONB;
BEGIN
  IF current_user NOT IN ('postgres', 'service_role')
    AND auth.role() IS DISTINCT FROM 'service_role'
  THEN
    IF TG_OP = 'INSERT' THEN
      NEW.agent_evidence := '{}'::jsonb;
    ELSE
      NEW.agent_evidence := OLD.agent_evidence;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.agent_provenance->>'source' = 'PM Hermes'
    AND NEW.agent_provenance->>'actionId' IS NOT NULL
  THEN
    SELECT action.payload->'evidence'
      INTO v_evidence
      FROM public.agent_actions AS action
     WHERE action.id = (NEW.agent_provenance->>'actionId')::uuid
       AND action.action_type IN ('create_report', 'update_report');

    IF jsonb_typeof(v_evidence) = 'object' THEN
      NEW.agent_evidence := v_evidence;
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.agent_evidence := '{}'::jsonb;
  ELSE
    NEW.agent_evidence := OLD.agent_evidence;
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN invalid_text_representation THEN
    IF TG_OP = 'INSERT' THEN
      NEW.agent_evidence := '{}'::jsonb;
    ELSE
      NEW.agent_evidence := OLD.agent_evidence;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_monthly_report_agent_evidence ON public.monthly_reports;
CREATE TRIGGER protect_monthly_report_agent_evidence
  BEFORE INSERT OR UPDATE ON public.monthly_reports
  FOR EACH ROW EXECUTE FUNCTION public.protect_monthly_report_agent_evidence();

REVOKE ALL ON FUNCTION public.protect_monthly_report_agent_evidence()
  FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.monthly_reports.agent_evidence IS
  'Evidence and source metadata persisted from the exact PM Hermes report action payload.';

COMMIT;
