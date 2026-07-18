import { toDurablePublicationJob, toDurablePublicationResult } from './publicationRepository.ts';

const assertEquals = (actual: unknown, expected: unknown): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
};

const now = '2026-07-17T20:30:00.000Z';

Deno.test('publication repository maps only browser-safe durable fields', () => {
  const result = toDurablePublicationResult({
    id: '50000000-0000-4000-8000-000000000001',
    platform: 'Facebook',
    status: 'published',
    provider_url: 'https://www.facebook.com/123',
    error_message: null,
    attempt_count: 1,
    claimed_at: now,
    completed_at: now,
    created_at: now,
    updated_at: now,
  });
  const job = toDurablePublicationJob(
    {
      id: '40000000-0000-4000-8000-000000000001',
      entry_id: '10000000-0000-4000-8000-000000000001',
      entry_revision: 3,
      trigger_type: 'manual',
      request_key: '30000000-0000-4000-8000-000000000001',
      status: 'published',
      claimed_at: now,
      completed_at: now,
      created_at: now,
      updated_at: now,
    },
    [
      {
        id: result.id,
        platform: result.platform,
        status: result.status,
        provider_url: result.url,
        error_message: result.error,
        attempt_count: result.attemptCount,
        claimed_at: result.claimedAt,
        completed_at: result.completedAt,
        created_at: result.createdAt,
        updated_at: result.updatedAt,
      },
    ],
  );

  assertEquals(job.results, [result]);
  assertEquals(Object.hasOwn(job, 'payloadSnapshot'), false);
  assertEquals(Object.hasOwn(job.results[0], 'providerPostId'), false);
});

Deno.test('publication repository rejects unexpected persisted states', () => {
  let threw = false;
  try {
    toDurablePublicationResult({
      id: '50000000-0000-4000-8000-000000000001',
      platform: 'Facebook',
      status: 'retrying',
      provider_url: null,
      error_message: null,
      attempt_count: 1,
      claimed_at: now,
      completed_at: null,
      created_at: now,
      updated_at: now,
    });
  } catch {
    threw = true;
  }

  assertEquals(threw, true);
});
