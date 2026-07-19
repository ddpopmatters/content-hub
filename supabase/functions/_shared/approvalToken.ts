const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface ApprovalTokenPayload {
  eid: string;
  rid?: string;
  iat: number;
  exp: number;
}

const encodeBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

const encodeText = (value: string): string => encodeBase64Url(encoder.encode(value));

const decodeBase64Url = (value: string): Uint8Array => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid base64url');
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const decoded = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
};

const importKey = (secret: string, usage: KeyUsage[]): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage,
  );

const isPayload = (value: unknown): value is ApprovalTokenPayload => {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.eid === 'string' &&
    payload.eid.length > 0 &&
    (typeof payload.rid === 'string'
      ? /^[A-Za-z0-9_-]{22}$/.test(payload.rid)
      : typeof payload.eml === 'string' && payload.eml.length > 0) &&
    Number.isInteger(payload.iat) &&
    Number.isInteger(payload.exp)
  );
};

export async function generateApprovalToken(
  secret: string,
  entryId: string,
  recipient: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = 7 * 24 * 60 * 60,
): Promise<string | null> {
  if (secret.length < 32 || !entryId || !recipient || ttlSeconds < 60) return null;
  const key = await importKey(secret, ['sign']);
  const recipientDigest = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(recipient.trim().toLowerCase()),
  );
  const recipientId = encodeBase64Url(new Uint8Array(recipientDigest)).slice(0, 22);
  const header = encodeText(JSON.stringify({ alg: 'HS256', typ: 'APT' }));
  const payload = encodeText(
    JSON.stringify({
      eid: entryId,
      rid: recipientId,
      iat: nowSeconds,
      exp: nowSeconds + ttlSeconds,
    }),
  );
  const message = `${header}.${payload}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return `${message}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyApprovalToken(
  secret: string,
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<ApprovalTokenPayload | null> {
  if (secret.length < 32 || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  try {
    const header = JSON.parse(decoder.decode(decodeBase64Url(encodedHeader))) as unknown;
    if (
      !header ||
      typeof header !== 'object' ||
      (header as Record<string, unknown>).alg !== 'HS256' ||
      (header as Record<string, unknown>).typ !== 'APT'
    ) {
      return null;
    }

    const key = await importKey(secret, ['verify']);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(encodedSignature).buffer as ArrayBuffer,
      encoder.encode(`${encodedHeader}.${encodedPayload}`),
    );
    if (!valid) return null;

    const payload = JSON.parse(decoder.decode(decodeBase64Url(encodedPayload))) as unknown;
    if (!isPayload(payload)) return null;
    if (payload.iat > nowSeconds + 300 || payload.exp <= nowSeconds || payload.exp <= payload.iat) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
