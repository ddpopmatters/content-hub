import { assertEquals } from 'jsr:@std/assert@1';
import {
  AGENT_SIGNATURE_VERSION,
  buildAgentCanonicalRequest,
  sha256Hex,
  verifyAgentRequest,
} from './agentAuth.ts';

const CLIENT_ID = 'pm_hermes';
const SECRET = 'secure-agent-test-secret-with-32-plus-bytes';
const PATH = '/functions/v1/content-hub-agent';

const signRequest = async (body: string, timestamp: string, nonce: string): Promise<Request> => {
  const payloadHash = await sha256Hex(body);
  const canonical = buildAgentCanonicalRequest('POST', PATH, timestamp, nonce, payloadHash);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical)),
  );
  const signature = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return new Request(`https://example.supabase.co${PATH}`, {
    method: 'POST',
    headers: {
      'x-pm-agent-version': AGENT_SIGNATURE_VERSION,
      'x-pm-agent-client': CLIENT_ID,
      'x-pm-agent-timestamp': timestamp,
      'x-pm-agent-nonce': nonce,
      'x-pm-agent-signature': signature,
    },
    body,
  });
};

Deno.test('agent auth accepts an exact signed request', async () => {
  const body = JSON.stringify({ operation: 'health' });
  const request = await signRequest(body, '1000000000', 'nonce_1234567890abcdef');
  assertEquals(
    await verifyAgentRequest(request, body, {
      enabled: true,
      clientId: CLIENT_ID,
      secret: SECRET,
      nowSeconds: 1_000_000_100,
    }),
    {
      ok: true,
      clientId: CLIENT_ID,
      nonce: 'nonce_1234567890abcdef',
      payloadHash: await sha256Hex(body),
    },
  );
});

Deno.test('agent auth rejects changed bodies and stale timestamps', async () => {
  const body = JSON.stringify({ operation: 'health' });
  const request = await signRequest(body, '1000000000', 'nonce_1234567890abcdef');
  assertEquals(
    await verifyAgentRequest(request, `${body} `, {
      enabled: true,
      clientId: CLIENT_ID,
      secret: SECRET,
      nowSeconds: 1_000_000_100,
    }),
    { ok: false, code: 'invalid_signature' },
  );
  assertEquals(
    await verifyAgentRequest(request, body, {
      enabled: true,
      clientId: CLIENT_ID,
      secret: SECRET,
      nowSeconds: 1_000_000_301,
    }),
    { ok: false, code: 'expired_request' },
  );
});

Deno.test('agent auth is disabled and fail-closed by default', async () => {
  const body = JSON.stringify({ operation: 'health' });
  const request = await signRequest(body, '1000000000', 'nonce_1234567890abcdef');
  assertEquals(
    await verifyAgentRequest(request, body, {
      enabled: false,
      clientId: CLIENT_ID,
      secret: SECRET,
    }),
    { ok: false, code: 'integration_disabled' },
  );
});
