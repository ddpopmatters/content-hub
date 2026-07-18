import {
  createPublicationFailure,
  finalisePlatformResult,
  toPublicPlatformResult,
} from './publicationResult.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const TIMESTAMP = '2026-07-17T12:00:00.000Z';

Deno.test('publication failures expose only fixed messages', () => {
  const result = finalisePlatformResult('Instagram', {
    status: 'failed',
    url: 'https://evil.example/?access_token=secret',
    postId: 'provider-secret',
    error: 'OAuth code=secret-code access_token=secret-token',
    timestamp: TIMESTAMP,
  });

  assertEquals(result, {
    status: 'failed',
    url: null,
    postId: null,
    error: 'Instagram did not confirm publication. Check the platform before trying again.',
    timestamp: TIMESTAMP,
  });
});

Deno.test('known connection failures remain actionable without provider details', () => {
  const result = finalisePlatformResult(
    'LinkedIn',
    createPublicationFailure('LinkedIn', 'reconnect_required', TIMESTAMP),
  );

  assertEquals(result.error, 'Reconnect LinkedIn before publishing.');
});

Deno.test('published URLs are restricted to the selected provider', () => {
  const accepted = finalisePlatformResult('BlueSky', {
    status: 'published',
    url: 'https://bsky.app/profile/example.org/post/123?tracking=removed#fragment',
    postId: 'at://did:plc:example/app.bsky.feed.post/123',
    error: null,
    timestamp: TIMESTAMP,
  });
  const rejected = finalisePlatformResult('BlueSky', {
    status: 'published',
    url: 'https://lookalike.example/profile/example.org/post/123',
    postId: '123',
    error: null,
    timestamp: TIMESTAMP,
  });

  assertEquals(accepted.url, 'https://bsky.app/profile/example.org/post/123');
  assertEquals(rejected.url, null);
});

Deno.test('public publication results omit internal provider identifiers', () => {
  const result = toPublicPlatformResult({
    status: 'published',
    url: 'https://www.facebook.com/123',
    postId: 'provider-post-id',
    error: null,
    timestamp: TIMESTAMP,
  });

  assertEquals(result, {
    status: 'published',
    url: 'https://www.facebook.com/123',
    error: null,
    timestamp: TIMESTAMP,
  });
  assertEquals(Object.prototype.hasOwnProperty.call(result, 'postId'), false);
});
