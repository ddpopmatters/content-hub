import {
  type DurablePublicationRepository,
  type FailedPublicationRetryIntent,
  type ManualPublicationIntent,
  orchestrateFailedPublicationRetry,
  orchestrateManualPublication,
  type PublicationErrorCode,
  type PublisherOutcome,
} from './publicationOrchestrator.ts';
import type {
  DurablePublicationJob,
  DurablePublicationResult,
  PublicationJobStatus,
  PublicationResultStatus,
} from './types.ts';

const assertEquals = (actual: unknown, expected: unknown): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
};

const OWNER_ID = '20000000-0000-4000-8000-000000000001';

const intent = (requestKey = '30000000-0000-4000-8000-000000000001'): ManualPublicationIntent => ({
  requestKey,
  requestedBy: { id: OWNER_ID, email: 'owner@example.org' },
  entryRevision: 3,
  payload: {
    entryId: '10000000-0000-4000-8000-000000000001',
    platforms: ['Facebook', 'LinkedIn'],
    caption: 'Main caption',
    platformCaptions: { LinkedIn: 'LinkedIn caption' },
    assetType: 'No asset',
    mediaUrls: [],
    previewUrl: null,
    firstComment: '',
  },
});

const aggregateStatus = (results: DurablePublicationResult[]): PublicationJobStatus => {
  if (results.some((result) => result.status === 'pending' || result.status === 'publishing')) {
    return 'publishing';
  }
  if (results.some((result) => result.status === 'unknown')) return 'unknown';
  if (results.every((result) => result.status === 'published')) {
    return 'published';
  }
  if (results.some((result) => result.status === 'published')) return 'partial';
  return 'failed';
};

class InMemoryRepository implements DurablePublicationRepository {
  readonly jobs = new Map<string, DurablePublicationJob>();
  readonly keys = new Map<string, string>();
  readonly payloads = new Map<string, ManualPublicationIntent['payload']>();
  readonly retryRequestKeys = new Map<string, Set<string>>();
  failClaim = false;
  failCompletion = false;
  failRecovery = false;

  recoverStaleClaims(): Promise<number> {
    return this.failRecovery ? Promise.reject(new Error('recovery failed')) : Promise.resolve(0);
  }

  findManualJob(requestedById: string, requestKey: string): Promise<DurablePublicationJob | null> {
    if (requestedById !== OWNER_ID) return Promise.resolve(null);
    const jobId = this.keys.get(requestKey);
    return Promise.resolve(jobId ? structuredClone(this.jobs.get(jobId) ?? null) : null);
  }

  createManualJob(publicationIntent: ManualPublicationIntent) {
    const existingId = this.keys.get(publicationIntent.requestKey);
    if (existingId) {
      const existing = this.jobs.get(existingId);
      if (!existing) return Promise.reject(new Error('missing job'));
      return Promise.resolve({
        id: existing.id,
        status: existing.status,
        created: false,
      });
    }

    const now = new Date().toISOString();
    const id = `40000000-0000-4000-8000-${String(this.jobs.size + 1).padStart(12, '0')}`;
    const results = publicationIntent.payload.platforms.map(
      (platform, index): DurablePublicationResult => ({
        id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        platform,
        status: 'pending',
        url: null,
        error: null,
        attemptCount: 0,
        claimedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      }),
    );
    const job: DurablePublicationJob = {
      id,
      entryId: publicationIntent.payload.entryId,
      entryRevision: publicationIntent.entryRevision,
      triggerType: 'manual',
      requestKey: publicationIntent.requestKey,
      status: 'queued',
      claimedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      results,
    };
    this.jobs.set(id, job);
    this.keys.set(publicationIntent.requestKey, id);
    this.payloads.set(id, structuredClone(publicationIntent.payload));
    return Promise.resolve({ id, status: job.status, created: true });
  }

  loadOwnedRetryContext(jobId: string, requestedById: string) {
    const job = this.jobs.get(jobId);
    const payload = this.payloads.get(jobId);
    if (!job || !payload || requestedById !== OWNER_ID) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      job: structuredClone(job),
      payload: structuredClone(payload),
    });
  }

  claimFailedRetry(retryIntent: FailedPublicationRetryIntent) {
    if (this.failClaim) return Promise.reject(new Error('claim failed'));
    const job = this.jobs.get(retryIntent.jobId);
    const result = job?.results.find((candidate) => candidate.platform === retryIntent.platform);
    if (
      !job ||
      !result ||
      retryIntent.requestedBy.id !== OWNER_ID ||
      retryIntent.entryRevision !== job.entryRevision
    ) {
      return Promise.resolve(null);
    }

    const retryTarget = `${job.id}:${retryIntent.platform}`;
    if (this.retryRequestKeys.get(retryTarget)?.has(retryIntent.retryRequestKey)) {
      return Promise.resolve({
        id: job.id,
        status: job.status,
        claimed: false,
      });
    }

    if (result.status === 'published') {
      return Promise.resolve({
        id: job.id,
        status: job.status,
        claimed: false,
      });
    }

    if (job.status === 'partial' && result.status === 'failed') {
      const now = new Date().toISOString();
      result.status = 'publishing';
      result.error = null;
      result.attemptCount += 1;
      result.claimedAt = now;
      result.completedAt = null;
      result.updatedAt = now;
      job.status = 'publishing';
      job.completedAt = null;
      job.updatedAt = now;
      const requestKeys = this.retryRequestKeys.get(retryTarget) ?? new Set<string>();
      requestKeys.add(retryIntent.retryRequestKey);
      this.retryRequestKeys.set(retryTarget, requestKeys);
      return Promise.resolve({
        id: job.id,
        status: job.status,
        claimed: true,
      });
    }
    return Promise.resolve(null);
  }

  claimResult(jobId: string, platform: string): Promise<boolean> {
    if (this.failClaim) return Promise.reject(new Error('claim failed'));
    const job = this.jobs.get(jobId);
    const result = job?.results.find((candidate) => candidate.platform === platform);
    if (!job || !result || result.status !== 'pending') {
      return Promise.resolve(false);
    }
    const now = new Date().toISOString();
    result.status = 'publishing';
    result.attemptCount += 1;
    result.claimedAt = now;
    result.updatedAt = now;
    job.status = 'publishing';
    job.claimedAt ??= now;
    return Promise.resolve(true);
  }

  completeResult(completion: {
    jobId: string;
    platform: string;
    status: Extract<PublicationResultStatus, 'published' | 'failed' | 'skipped' | 'unknown'>;
    providerPostId: string | null;
    providerUrl: string | null;
    errorCode: PublicationErrorCode | null;
  }): Promise<void> {
    if (this.failCompletion) {
      return Promise.reject(new Error('completion failed'));
    }
    const job = this.jobs.get(completion.jobId);
    const result = job?.results.find((candidate) => candidate.platform === completion.platform);
    if (!job || !result || result.status !== 'publishing') {
      return Promise.reject(new Error('not claimed'));
    }
    const now = new Date().toISOString();
    result.status = completion.status;
    result.url = completion.providerUrl;
    result.error = completion.errorCode;
    result.completedAt = now;
    result.updatedAt = now;
    job.status = aggregateStatus(job.results);
    job.completedAt = job.status === 'publishing' ? null : now;
    job.updatedAt = now;
    return Promise.resolve();
  }

  loadJob(jobId: string): Promise<DurablePublicationJob> {
    const job = this.jobs.get(jobId);
    if (!job) return Promise.reject(new Error('missing job'));
    return Promise.resolve(structuredClone(job));
  }
}

const successPublisher =
  (
    calls: Record<string, number>,
  ): ((
    platform: string,
    payload: ManualPublicationIntent['payload'],
  ) => Promise<PublisherOutcome>) =>
  (platform, payload) => {
    calls[platform] = (calls[platform] ?? 0) + 1;
    if (platform === 'LinkedIn') {
      assertEquals(payload.caption, 'LinkedIn caption');
    }
    return Promise.resolve({
      status: 'published',
      providerPostId: `${platform}-post`,
      providerUrl: `https://example.org/${platform}`,
    });
  };

Deno.test('simultaneous idempotent orchestration calls publish each platform once', async () => {
  const repository = new InMemoryRepository();
  const calls: Record<string, number> = {};
  const dependencies = {
    repository,
    preflightMedia: () => Promise.resolve(null),
    publish: successPublisher(calls),
  };

  const outcomes = await Promise.all([
    orchestrateManualPublication(intent(), dependencies),
    orchestrateManualPublication(intent(), dependencies),
  ]);

  assertEquals(repository.jobs.size, 1);
  assertEquals(calls, { Facebook: 1, LinkedIn: 1 });
  assertEquals(
    outcomes.some((outcome) => outcome.ok && outcome.job.status === 'published'),
    true,
  );

  await orchestrateManualPublication(intent(), dependencies);
  assertEquals(calls, { Facebook: 1, LinkedIn: 1 });
});

Deno.test('media preflight failure creates no job and reaches no provider', async () => {
  const repository = new InMemoryRepository();
  let publisherCalls = 0;
  const outcome = await orchestrateManualPublication(intent(), {
    repository,
    preflightMedia: () =>
      Promise.resolve({
        code: 'invalid_storage_url',
        message: 'Upload media again.',
      }),
    publish: () => {
      publisherCalls += 1;
      return Promise.resolve({ status: 'failed', errorCode: 'unexpected' });
    },
  });

  assertEquals(outcome.ok, false);
  assertEquals(outcome.ok ? null : outcome.code, 'media_preflight_failed');
  assertEquals(repository.jobs.size, 0);
  assertEquals(publisherCalls, 0);
});

Deno.test('stale-claim recovery failure prevents media, job and provider work', async () => {
  const repository = new InMemoryRepository();
  repository.failRecovery = true;
  let preflightCalls = 0;
  let publisherCalls = 0;
  const outcome = await orchestrateManualPublication(intent(), {
    repository,
    preflightMedia: () => {
      preflightCalls += 1;
      return Promise.resolve(null);
    },
    publish: () => {
      publisherCalls += 1;
      return Promise.resolve({ status: 'failed', errorCode: 'unexpected' });
    },
  });

  assertEquals(outcome.ok, false);
  assertEquals(outcome.ok ? null : outcome.code, 'persistence_failed');
  assertEquals(preflightCalls, 0);
  assertEquals(repository.jobs.size, 0);
  assertEquals(publisherCalls, 0);
});

Deno.test('database claim failure prevents every provider call', async () => {
  const repository = new InMemoryRepository();
  repository.failClaim = true;
  let publisherCalls = 0;
  const outcome = await orchestrateManualPublication(intent(), {
    repository,
    preflightMedia: () => Promise.resolve(null),
    publish: () => {
      publisherCalls += 1;
      return Promise.resolve({ status: 'failed', errorCode: 'unexpected' });
    },
  });

  assertEquals(outcome.ok, false);
  assertEquals(outcome.ok ? null : outcome.code, 'persistence_failed');
  assertEquals(publisherCalls, 0);
});

Deno.test('provider timeout is persisted as unknown and aborts the adapter', async () => {
  const repository = new InMemoryRepository();
  let aborted = false;
  const outcome = await orchestrateManualPublication(intent(), {
    repository,
    providerTimeoutMs: 5,
    preflightMedia: () => Promise.resolve(null),
    publish: (_platform, _payload, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            aborted = true;
            reject(new Error('aborted'));
          },
          { once: true },
        );
      }),
  });

  assertEquals(aborted, true);
  assertEquals(outcome.ok, true);
  assertEquals(outcome.ok ? outcome.job.status : null, 'unknown');
  assertEquals(
    outcome.ok ? outcome.job.results.every((result) => result.status === 'unknown') : false,
    true,
  );
});

Deno.test('provider timeout remains bounded when an adapter ignores abort', async () => {
  const repository = new InMemoryRepository();
  const outcome = await orchestrateManualPublication(intent(), {
    repository,
    providerTimeoutMs: 5,
    preflightMedia: () => Promise.resolve(null),
    publish: () => new Promise(() => undefined),
  });

  assertEquals(outcome.ok, true);
  assertEquals(outcome.ok ? outcome.job.status : null, 'unknown');
});

Deno.test('unexpected adapter exceptions are conservatively persisted as unknown', async () => {
  const repository = new InMemoryRepository();
  const outcome = await orchestrateManualPublication(intent(), {
    repository,
    preflightMedia: () => Promise.resolve(null),
    publish: () => Promise.reject(new Error('provider body must not escape')),
  });

  assertEquals(outcome.ok, true);
  assertEquals(outcome.ok ? outcome.job.status : null, 'unknown');
  assertEquals(outcome.ok ? outcome.job.results.map((result) => result.error) : null, [
    'unexpected',
    'unexpected',
  ]);
});

Deno.test('completion failure cannot report a false durable success', async () => {
  const repository = new InMemoryRepository();
  repository.failCompletion = true;
  const outcome = await orchestrateManualPublication(intent(), {
    repository,
    preflightMedia: () => Promise.resolve(null),
    publish: successPublisher({}),
  });

  assertEquals(outcome.ok, false);
  assertEquals(outcome.ok ? null : outcome.code, 'persistence_failed');
  assertEquals(outcome.ok ? null : outcome.job?.status, 'publishing');
  assertEquals(outcome.ok ? null : outcome.job?.results.map((result) => result.status), [
    'publishing',
    'publishing',
  ]);
});

Deno.test('invalid request identifiers fail before preflight or persistence', async () => {
  const repository = new InMemoryRepository();
  let preflightCalls = 0;
  const outcome = await orchestrateManualPublication(intent('not-a-uuid'), {
    repository,
    preflightMedia: () => {
      preflightCalls += 1;
      return Promise.resolve(null);
    },
    publish: successPublisher({}),
  });

  assertEquals(outcome.ok, false);
  assertEquals(outcome.ok ? null : outcome.code, 'invalid_request');
  assertEquals(preflightCalls, 0);
  assertEquals(repository.jobs.size, 0);
});

Deno.test(
  'targeted retry claims only the failed platform on the existing partial job',
  async () => {
    const repository = new InMemoryRepository();
    const calls: Record<string, number> = {};
    const initial = await orchestrateManualPublication(intent(), {
      repository,
      preflightMedia: () => Promise.resolve(null),
      publish: (platform) => {
        calls[platform] = (calls[platform] ?? 0) + 1;
        return Promise.resolve(
          platform === 'Facebook'
            ? {
                status: 'published' as const,
                providerPostId: 'facebook-post',
                providerUrl: 'https://www.facebook.com/facebook-post',
              }
            : { status: 'failed' as const, errorCode: 'provider_rejected' },
        );
      },
    });
    if (!initial.ok) throw new Error('Expected initial partial publication');

    const retryIntent: FailedPublicationRetryIntent = {
      jobId: initial.job.id,
      retryRequestKey: '60000000-0000-4000-8000-000000000001',
      platform: 'LinkedIn',
      requestedBy: intent().requestedBy,
      entryRevision: intent().entryRevision,
      payload: intent().payload,
    };
    const retryDependencies = {
      repository,
      preflightMedia: () => Promise.resolve(null),
      publish: (platform: string) => {
        calls[platform] = (calls[platform] ?? 0) + 1;
        return Promise.resolve({
          status: 'published' as const,
          providerPostId: 'linkedin-retry-post',
          providerUrl: 'https://www.linkedin.com/feed/update/linkedin-retry-post/',
        });
      },
    };
    const retry = await orchestrateFailedPublicationRetry(retryIntent, retryDependencies);
    const replay = await orchestrateFailedPublicationRetry(retryIntent, retryDependencies);

    assertEquals(initial.job.status, 'partial');
    assertEquals(retry.ok ? retry.job.status : null, 'published');
    assertEquals(replay.ok ? replay.job.status : null, 'published');
    assertEquals(calls, { Facebook: 1, LinkedIn: 2 });
    assertEquals(
      retry.ok
        ? retry.job.results.map((result) => [result.platform, result.status, result.attemptCount])
        : null,
      [
        ['Facebook', 'published', 1],
        ['LinkedIn', 'published', 2],
      ],
    );
    assertEquals(repository.jobs.size, 1);
  },
);

Deno.test(
  'a definitive failed retry is not called twice when its request is replayed',
  async () => {
    const repository = new InMemoryRepository();
    let retryCalls = 0;
    const initial = await orchestrateManualPublication(intent(), {
      repository,
      preflightMedia: () => Promise.resolve(null),
      publish: (platform) =>
        platform === 'Facebook'
          ? Promise.resolve({
              status: 'published',
              providerPostId: 'facebook-post',
              providerUrl: 'https://www.facebook.com/facebook-post',
            })
          : Promise.resolve({
              status: 'failed',
              errorCode: 'provider_rejected',
            }),
    });
    if (!initial.ok) throw new Error('Expected initial partial publication');

    const retryIntent: FailedPublicationRetryIntent = {
      jobId: initial.job.id,
      retryRequestKey: '60000000-0000-4000-8000-000000000003',
      platform: 'LinkedIn',
      requestedBy: intent().requestedBy,
      entryRevision: intent().entryRevision,
      payload: intent().payload,
    };
    const dependencies = {
      repository,
      preflightMedia: () => Promise.resolve(null),
      publish: () => {
        retryCalls += 1;
        return Promise.resolve({
          status: 'failed' as const,
          errorCode: 'provider_rejected' as const,
        });
      },
    };

    const retry = await orchestrateFailedPublicationRetry(retryIntent, dependencies);
    const replay = await orchestrateFailedPublicationRetry(retryIntent, dependencies);
    const secondRetry = await orchestrateFailedPublicationRetry(
      {
        ...retryIntent,
        retryRequestKey: '60000000-0000-4000-8000-000000000004',
      },
      dependencies,
    );
    const delayedFirstReplay = await orchestrateFailedPublicationRetry(retryIntent, dependencies);

    assertEquals(retry.ok ? retry.job.status : null, 'partial');
    assertEquals(replay.ok ? replay.job.status : null, 'partial');
    assertEquals(secondRetry.ok ? secondRetry.job.status : null, 'partial');
    assertEquals(delayedFirstReplay.ok ? delayedFirstReplay.job.status : null, 'partial');
    assertEquals(retryCalls, 2);
    assertEquals(
      delayedFirstReplay.ok
        ? delayedFirstReplay.job.results.find((result) => result.platform === 'LinkedIn')
            ?.attemptCount
        : null,
      3,
    );
  },
);

Deno.test('targeted retry refuses an unknown platform outcome', async () => {
  const repository = new InMemoryRepository();
  let retryCalls = 0;
  const initial = await orchestrateManualPublication(intent(), {
    repository,
    preflightMedia: () => Promise.resolve(null),
    publish: (platform) =>
      platform === 'Facebook'
        ? Promise.resolve({
            status: 'published',
            providerPostId: 'facebook-post',
            providerUrl: 'https://www.facebook.com/facebook-post',
          })
        : Promise.reject(new Error('ambiguous transport')),
  });
  if (!initial.ok) throw new Error('Expected durable unknown publication');

  const retry = await orchestrateFailedPublicationRetry(
    {
      jobId: initial.job.id,
      retryRequestKey: '60000000-0000-4000-8000-000000000002',
      platform: 'LinkedIn',
      requestedBy: intent().requestedBy,
      entryRevision: intent().entryRevision,
      payload: intent().payload,
    },
    {
      repository,
      preflightMedia: () => Promise.resolve(null),
      publish: () => {
        retryCalls += 1;
        return Promise.resolve({ status: 'failed', errorCode: 'unexpected' });
      },
    },
  );

  assertEquals(initial.job.status, 'unknown');
  assertEquals(retry.ok, false);
  assertEquals(retry.ok ? null : retry.code, 'retry_not_available');
  assertEquals(retryCalls, 0);
});
