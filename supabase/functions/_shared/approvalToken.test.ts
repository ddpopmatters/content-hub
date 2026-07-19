import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import { generateApprovalToken, verifyApprovalToken } from './approvalToken.ts';

const SECRET = 'a-secure-test-secret-with-more-than-32-bytes';

Deno.test('approval token round-trips and expires', async () => {
  const token = await generateApprovalToken(SECRET, 'entry-1', 'approver@example.org', 1_000, 600);
  assertNotEquals(token, null);
  const payload = await verifyApprovalToken(SECRET, token!, 1_100);
  assertNotEquals(payload, null);
  assertEquals(
    { eid: payload!.eid, iat: payload!.iat, exp: payload!.exp },
    {
      eid: 'entry-1',
      iat: 1_000,
      exp: 1_600,
    },
  );
  assertEquals(payload!.rid?.length, 22);
  assertEquals('eml' in payload!, false);
  assertEquals(await verifyApprovalToken(SECRET, token!, 1_600), null);
});

Deno.test('approval token rejects tampering and weak secrets', async () => {
  const token = await generateApprovalToken(SECRET, 'entry-1', 'approver@example.org', 1_000, 600);
  assertNotEquals(token, null);
  assertEquals(await verifyApprovalToken(SECRET, `${token}x`, 1_100), null);
  assertEquals(await generateApprovalToken('short', 'entry-1', 'approver@example.org'), null);
  assertEquals(await verifyApprovalToken('short', token!, 1_100), null);
});
