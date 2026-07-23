import { assertEquals } from 'jsr:@std/assert@1';
import { notificationRecipientsAreAuthorised } from './notificationAuthorization.ts';

Deno.test('approval notification recipients must be current approvers', () => {
  assertEquals(
    notificationRecipientsAreAuthorised({
      requestedNames: ['Current approver'],
      directEmails: [],
      allowedNames: ['Current approver'],
      allowedEmails: ['approver@example.org'],
    }),
    true,
  );
  assertEquals(
    notificationRecipientsAreAuthorised({
      requestedNames: ['Entry author'],
      directEmails: [],
      allowedNames: ['Current approver'],
      allowedEmails: ['approver@example.org'],
    }),
    false,
  );
});

Deno.test('direct email recipients must resolve from the allowed identities', () => {
  assertEquals(
    notificationRecipientsAreAuthorised({
      requestedNames: [],
      directEmails: ['approver@example.org'],
      allowedNames: ['Current approver'],
      allowedEmails: ['approver@example.org'],
    }),
    true,
  );
  assertEquals(
    notificationRecipientsAreAuthorised({
      requestedNames: [],
      directEmails: ['attacker@example.org'],
      allowedNames: ['Current approver'],
      allowedEmails: ['approver@example.org'],
    }),
    false,
  );
});
