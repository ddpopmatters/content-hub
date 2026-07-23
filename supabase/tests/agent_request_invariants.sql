BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE oid = 'public.agent_requests'::regclass
      AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'agent_requests does not have RLS enabled';
  END IF;

  IF has_table_privilege('anon', 'public.agent_requests', 'SELECT')
    OR has_table_privilege('authenticated', 'public.agent_requests', 'SELECT')
    OR has_table_privilege('anon', 'public.agent_requests', 'INSERT')
    OR has_table_privilege('authenticated', 'public.agent_requests', 'INSERT')
  THEN
    RAISE EXCEPTION 'A browser role can access agent_requests';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.claim_agent_request(text,text,text,text,integer)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.claim_agent_request(text,text,text,text,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'A browser role can claim an agent request';
  END IF;
END;
$$;

DO $$
DECLARE
  first_decision TEXT;
  replay_decision TEXT;
  first_request_id UUID;
BEGIN
  SELECT request_id, decision
  INTO first_request_id, first_decision
  FROM public.claim_agent_request(
    'pm_hermes_test',
    'nonce_1234567890abcdef',
    'health',
    repeat('a', 64),
    60
  );

  SELECT decision
  INTO replay_decision
  FROM public.claim_agent_request(
    'pm_hermes_test',
    'nonce_1234567890abcdef',
    'health',
    repeat('a', 64),
    60
  );

  IF first_request_id IS NULL OR first_decision <> 'claimed' THEN
    RAISE EXCEPTION 'First request was not claimed';
  END IF;
  IF replay_decision <> 'replayed' THEN
    RAISE EXCEPTION 'Repeated nonce was not rejected as replayed';
  END IF;
END;
$$;

DO $$
DECLARE
  first_decision TEXT;
  limited_decision TEXT;
BEGIN
  SELECT decision
  INTO first_decision
  FROM public.claim_agent_request(
    'pm_hermes_rate_test',
    'nonce_rate_1234567890a',
    'health',
    repeat('b', 64),
    1
  );

  SELECT decision
  INTO limited_decision
  FROM public.claim_agent_request(
    'pm_hermes_rate_test',
    'nonce_rate_1234567890b',
    'health',
    repeat('c', 64),
    1
  );

  IF first_decision <> 'claimed' OR limited_decision <> 'rate_limited' THEN
    RAISE EXCEPTION 'Per-client request limit did not fail closed';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'entries'
      AND policyname = 'Anon users can view entries via review link'
  ) THEN
    RAISE EXCEPTION 'Anonymous review-link entries policy still exists';
  END IF;
END;
$$;

ROLLBACK;
