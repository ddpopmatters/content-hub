const encoder = new TextEncoder();

export const AGENT_SIGNATURE_VERSION = '1';
export const MAX_AGENT_BODY_BYTES = 32_768;

export interface AgentAuthConfig {
  enabled: boolean;
  clientId: string;
  secret: string;
  nowSeconds?: number;
  maxClockSkewSeconds?: number;
}

export type AgentAuthFailureCode =
  | 'integration_disabled'
  | 'invalid_configuration'
  | 'invalid_headers'
  | 'invalid_client'
  | 'expired_request'
  | 'request_too_large'
  | 'invalid_signature';

export type AgentAuthResult =
  | {
      ok: true;
      clientId: string;
      nonce: string;
      payloadHash: string;
    }
  | {
      ok: false;
      code: AgentAuthFailureCode;
    };

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const hexToBytes = (value: string): Uint8Array => {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('invalid hex');
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
};

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

export function buildAgentCanonicalRequest(
  method: string,
  pathname: string,
  timestamp: string,
  nonce: string,
  payloadHash: string,
): string {
  return [
    AGENT_SIGNATURE_VERSION,
    method.toUpperCase(),
    pathname,
    timestamp,
    nonce,
    payloadHash,
  ].join('\n');
}

export async function verifyAgentRequest(
  request: Request,
  body: string,
  config: AgentAuthConfig,
): Promise<AgentAuthResult> {
  if (!config.enabled) return { ok: false, code: 'integration_disabled' };
  if (!/^[a-z0-9][a-z0-9_-]{2,79}$/.test(config.clientId) || config.secret.length < 32) {
    return { ok: false, code: 'invalid_configuration' };
  }
  if (encoder.encode(body).byteLength > MAX_AGENT_BODY_BYTES) {
    return { ok: false, code: 'request_too_large' };
  }

  const version = request.headers.get('x-pm-agent-version') ?? '';
  const clientId = request.headers.get('x-pm-agent-client') ?? '';
  const timestamp = request.headers.get('x-pm-agent-timestamp') ?? '';
  const nonce = request.headers.get('x-pm-agent-nonce') ?? '';
  const signature = (request.headers.get('x-pm-agent-signature') ?? '').toLowerCase();
  if (
    version !== AGENT_SIGNATURE_VERSION ||
    !/^\d{10}$/.test(timestamp) ||
    !/^[A-Za-z0-9_-]{16,128}$/.test(nonce) ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return { ok: false, code: 'invalid_headers' };
  }
  if (clientId !== config.clientId) return { ok: false, code: 'invalid_client' };

  const nowSeconds = config.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxClockSkewSeconds = config.maxClockSkewSeconds ?? 300;
  if (Math.abs(nowSeconds - Number(timestamp)) > maxClockSkewSeconds) {
    return { ok: false, code: 'expired_request' };
  }

  const payloadHash = await sha256Hex(body);
  const canonical = buildAgentCanonicalRequest(
    request.method,
    new URL(request.url).pathname,
    timestamp,
    nonce,
    payloadHash,
  );
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(config.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      hexToBytes(signature).buffer as ArrayBuffer,
      encoder.encode(canonical),
    );
    return valid
      ? { ok: true, clientId, nonce, payloadHash }
      : { ok: false, code: 'invalid_signature' };
  } catch {
    return { ok: false, code: 'invalid_signature' };
  }
}
