import { assertEquals, assertRejects, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  CONTENT_REVIEW_URL_PLACEHOLDER,
  injectRecipientNotificationLinks,
} from './notificationLinks.ts';

Deno.test('injects recipient-specific signed review and approval links', () => {
  const result = injectRecipientNotificationLinks(
    `Open: ${CONTENT_REVIEW_URL_PLACEHOLDER}`,
    `<a href="${CONTENT_REVIEW_URL_PLACEHOLDER}">Review</a>`,
    'https://ddpopmatters.github.io/content-hub/',
    'signed.token/value',
  );

  assertStringIncludes(result.text, '/review.html?token=signed.token%2Fvalue');
  assertStringIncludes(result.html!, '/review.html?token=signed.token%2Fvalue');
  assertEquals(
    result.approveUrl,
    'https://ddpopmatters.github.io/content-hub/approve.html?token=signed.token%2Fvalue',
  );
});

Deno.test('fails closed when a review placeholder is missing', async () => {
  await assertRejects(
    async () =>
      injectRecipientNotificationLinks(
        'Open: insecure direct link',
        undefined,
        'https://ddpopmatters.github.io/content-hub',
        'token',
      ),
    Error,
    'review URL placeholder missing',
  );
});
