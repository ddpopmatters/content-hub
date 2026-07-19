-- Replay-safe request ledger for the narrow PM Hermes Content Hub Edge boundary.
-- This table is service-only: browser roles receive no policies or grants.

CREATE TABLE public.agent_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL CHECK (
    char_length(client_id) BETWEEN 3 AND 80
    AND client_id ~ '^[a-z0-9][a-z0-9_-]*$'
  ),
  nonce TEXT NOT NULL CHECK (
    char_length(nonce) BETWEEN 16 AND 128
    AND nonce ~ '^[A-Za-z0-9_-]+$'
  ),
  capability TEXT NOT NULL CHECK (
    char_length(capability) BETWEEN 2 AND 80
    AND capability ~ '^[a-z][a-z0-9_]*$'
  ),
  payload_hash TEXT NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  result_class TEXT NOT NULL DEFAULT 'started' CHECK (
    result_class IN (
      'started',
      'success',
      'invalid_request',
      'not_found',
      'conflict',
      'unavailable',
      'internal_error'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT agent_requests_client_nonce_key UNIQUE (client_id, nonce)
);

CREATE INDEX agent_requests_client_created_idx
  ON public.agent_requests (client_id, created_at DESC);

ALTER TABLE public.agent_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.agent_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_requests TO service_role;

CREATE OR REPLACE FUNCTION public.claim_agent_request(
  p_client_id TEXT,
  p_nonce TEXT,
  p_capability TEXT,
  p_payload_hash TEXT,
  p_per_minute_limit INTEGER DEFAULT 60
)
RETURNS TABLE (request_id UUID, decision TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request_id UUID;
  v_recent_count INTEGER;
BEGIN
  IF p_per_minute_limit < 1 OR p_per_minute_limit > 300 THEN
    RAISE EXCEPTION 'invalid rate limit';
  END IF;

  -- Serialise claims for one client so concurrent requests cannot race the limit.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_client_id, 0));

  SELECT count(*)
    INTO v_recent_count
    FROM public.agent_requests
   WHERE client_id = p_client_id
     AND created_at >= clock_timestamp() - INTERVAL '1 minute';

  IF v_recent_count >= p_per_minute_limit THEN
    RETURN QUERY SELECT NULL::UUID, 'rate_limited'::TEXT;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.agent_requests (client_id, nonce, capability, payload_hash)
    VALUES (p_client_id, p_nonce, p_capability, p_payload_hash)
    RETURNING id INTO v_request_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN QUERY SELECT NULL::UUID, 'replayed'::TEXT;
      RETURN;
  END;

  RETURN QUERY SELECT v_request_id, 'claimed'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_agent_request(TEXT, TEXT, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_agent_request(TEXT, TEXT, TEXT, TEXT, INTEGER)
  TO service_role;
