import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import {
  approvalRecipientId,
  generateApprovalToken,
  verifyApprovalToken,
} from './approvalToken.ts';

const SECRET = 'a-secure-test-secret-with-more-than-32-bytes';
const encodeBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

async function signLegacyToken(payload: Record<string, unknown>): Promise<string> {
  const encoder = new TextEncoder();
  const header = encodeBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'APT' })));
  const body = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  const message = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return `${message}.${encodeBase64Url(new Uint8Array(signature))}`;
}

Deno.test('approval token round-trips and expires', async () => {
  const token = await generateApprovalToken(
    SECRET,
    'entry-1',
    'approver@example.org',
    3,
    'approve',
    1_000,
    600,
  );
  assertNotEquals(token, null);
  const payload = await verifyApprovalToken(SECRET, token!, 1_100);
  assertNotEquals(payload, null);
  assertEquals(
    {
      eid: payload!.eid,
      rev: payload!.rev,
      scp: payload!.scp,
      iat: payload!.iat,
      exp: payload!.exp,
    },
    {
      eid: 'entry-1',
      rev: 3,
      scp: 'approve',
      iat: 1_000,
      exp: 1_600,
    },
  );
  assertEquals(payload!.rid?.length, 22);
  assertEquals('eml' in payload!, false);
  assertEquals(await verifyApprovalToken(SECRET, token!, 1_600), null);
});

Deno.test('approval token rejects tampering and weak secrets', async () => {
  const token = await generateApprovalToken(
    SECRET,
    'entry-1',
    'approver@example.org',
    3,
    'review',
    1_000,
    600,
  );
  assertNotEquals(token, null);
  assertEquals(await verifyApprovalToken(SECRET, `${token}x`, 1_100), null);
  assertEquals(
    await generateApprovalToken('short', 'entry-1', 'approver@example.org', 3, 'review'),
    null,
  );
  assertEquals(
    await generateApprovalToken(SECRET, 'entry-1', 'approver@example.org', 0, 'review'),
    null,
  );
  assertEquals(await verifyApprovalToken('short', token!, 1_100), null);
});

Deno.test('approval token rejects legacy links without revision and scope', async () => {
  const token = await signLegacyToken({
    eid: 'entry-1',
    rid: 'abcdefghijklmnopqrstuv',
    iat: 1_000,
    exp: 1_600,
  });
  assertEquals(await verifyApprovalToken(SECRET, token, 1_100), null);
});

Deno.test('recipient binding is stable and case insensitive', async () => {
  assertEquals(
    await approvalRecipientId(SECRET, 'Approver@Example.org'),
    await approvalRecipientId(SECRET, ' approver@example.org '),
  );
  assertEquals(await approvalRecipientId('short', 'approver@example.org'), null);
});
