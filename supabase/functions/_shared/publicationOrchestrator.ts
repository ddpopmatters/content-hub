import type {
  DurablePublicationJob,
  PublicationJobStatus,
  PublicationResultStatus,
  PublishPayload,
} from './types.ts';
import type { PublicationMediaIssue } from './publicationMedia.ts';

export type PublicationErrorCode =
  | 'connection_missing'
  | 'multiple_connections'
  | 'reconnect_required'
  | 'media_unavailable'
  | 'unsupported'
  | 'provider_rejected'
  | 'provider_timeout'
  | 'persistence_failed'
  | 'unexpected';

export interface ManualPublicationIntent {
  requestKey: string;
  requestedBy: { id: string; email: string };
  entryRevision: number;
  payload: PublishPayload;
}

export interface FailedPublicationRetryIntent {
  jobId: string;
  retryRequestKey: string;
  platform: string;
  requestedBy: { id: string; email: string };
  entryRevision: number;
  payload: PublishPayload;
}

interface PublicationJobHandle {
  id: string;
  status: PublicationJobStatus;
  created: boolean;
}

interface PublicationRetryClaim {
  id: string;
  status: PublicationJobStatus;
  claimed: boolean;
}

export interface PublicationRetryContext {
  job: DurablePublicationJob;
  payload: PublishPayload;
}

interface PublicationCompletion {
  jobId: string;
  platform: string;
  status: Extract<PublicationResultStatus, 'published' | 'failed' | 'skipped' | 'unknown'>;
  providerPostId: string | null;
  providerUrl: string | null;
  errorCode: PublicationErrorCode | null;
}

export interface DurablePublicationRepository {
  recoverStaleClaims(): Promise<number>;
  findManualJob(requestedById: string, requestKey: string): Promise<DurablePublicationJob | null>;
  createManualJob(intent: ManualPublicationIntent): Promise<PublicationJobHandle>;
  loadOwnedRetryContext(
    jobId: string,
    requestedById: string,
  ): Promise<PublicationRetryContext | null>;
  claimFailedRetry(intent: FailedPublicationRetryIntent): Promise<PublicationRetryClaim | null>;
  claimResult(jobId: string, platform: string): Promise<boolean>;
  completeResult(completion: PublicationCompletion): Promise<void>;
  loadJob(jobId: string): Promise<DurablePublicationJob>;
}

export type PublisherOutcome =
  | {
      status: 'published';
      providerPostId: string;
      providerUrl: string | null;
    }
  | {
      status: 'failed';
      errorCode: Exclude<PublicationErrorCode, 'provider_timeout' | 'persistence_failed'>;
    }
  | {
      status: 'skipped';
      errorCode: 'unsupported';
    };

interface PublicationOrchestratorDependencies {
  repository: DurablePublicationRepository;
  preflightMedia: (payload: PublishPayload) => Promise<PublicationMediaIssue | null>;
  publish: (
    platform: string,
    payload: PublishPayload,
    signal: AbortSignal,
  ) => Promise<PublisherOutcome>;
  providerTimeoutMs?: number;
}

export type ManualPublicationOutcome =
  | {
      ok: true;
      job: DurablePublicationJob;
      durabilityConfirmed: true;
    }
  | {
      ok: false;
      code:
        | 'invalid_request'
        | 'retry_not_available'
        | 'media_preflight_failed'
        | 'persistence_failed';
      message: string;
      job?: DurablePublicationJob;
    };

const DEFAULT_PROVIDER_TIMEOUT_MS = 30_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const persistenceFailure = (job?: DurablePublicationJob): ManualPublicationOutcome => ({
  ok: false,
  code: 'persistence_failed',
  message:
    'Publishing state could not be recorded safely. Check the durable result before retrying.',
  ...(job ? { job } : {}),
});

const platformPayload = (payload: PublishPayload, platform: string): PublishPayload => ({
  ...payload,
  caption: payload.platformCaptions[platform] || payload.caption,
});

const publisherCompletion = async (
  platform: string,
  payload: PublishPayload,
  publish: PublicationOrchestratorDependencies['publish'],
  timeoutMs: number,
): Promise<Omit<PublicationCompletion, 'jobId' | 'platform'>> => {
  const controller = new AbortController();
  let timedOut = false;
  let timeout: number | undefined;

  try {
    const publisherPromise = Promise.resolve().then(() =>
      publish(platform, platformPayload(payload, platform), controller.signal),
    );
    const timeoutPromise = new Promise<PublisherOutcome>((_resolve, reject) => {
      timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new Error('provider timeout'));
      }, timeoutMs);
    });
    const outcome = await Promise.race([publisherPromise, timeoutPromise]);
    if (outcome.status === 'published') {
      if (!outcome.providerPostId.trim()) {
        throw new Error('missing provider identifier');
      }
      return {
        status: 'published',
        providerPostId: outcome.providerPostId,
        providerUrl: outcome.providerUrl,
        errorCode: null,
      };
    }

    return {
      status: outcome.status,
      providerPostId: null,
      providerUrl: null,
      errorCode: outcome.errorCode,
    };
  } catch {
    return {
      status: 'unknown',
      providerPostId: null,
      providerUrl: null,
      errorCode: timedOut ? 'provider_timeout' : 'unexpected',
    };
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
};

/**
 * Execute one durable manual intent. Database claim succeeds before the
 * provider is called; any exception after claim is conservatively Unknown.
 */
export async function orchestrateManualPublication(
  intent: ManualPublicationIntent,
  {
    repository,
    preflightMedia,
    publish,
    providerTimeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS,
  }: PublicationOrchestratorDependencies,
): Promise<ManualPublicationOutcome> {
  if (
    !UUID_PATTERN.test(intent.requestKey) ||
    !UUID_PATTERN.test(intent.requestedBy.id) ||
    !Number.isSafeInteger(intent.entryRevision) ||
    intent.entryRevision <= 0
  ) {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'A valid publication request is required.',
    };
  }

  try {
    await repository.recoverStaleClaims();
  } catch {
    return persistenceFailure();
  }

  let mediaIssue: PublicationMediaIssue | null;
  try {
    mediaIssue = await preflightMedia(intent.payload);
  } catch {
    mediaIssue = {
      code: 'media_unavailable',
      message: 'The approved media could not be verified safely.',
    };
  }
  if (mediaIssue) {
    return {
      ok: false,
      code: 'media_preflight_failed',
      message: mediaIssue.message,
    };
  }

  let handle: PublicationJobHandle;
  try {
    handle = await repository.createManualJob(intent);
  } catch {
    return persistenceFailure();
  }

  let durabilityConfirmed = true;
  await Promise.all(
    intent.payload.platforms.map(async (platform) => {
      let claimed: boolean;
      try {
        claimed = await repository.claimResult(handle.id, platform);
      } catch {
        durabilityConfirmed = false;
        return;
      }
      if (!claimed) return;

      const completion = await publisherCompletion(
        platform,
        intent.payload,
        publish,
        providerTimeoutMs,
      );
      try {
        await repository.completeResult({
          jobId: handle.id,
          platform,
          ...completion,
        });
      } catch {
        // The claimed row remains Publishing. Recovery must treat a stale
        // publishing claim as Unknown rather than attempting it again.
        durabilityConfirmed = false;
      }
    }),
  );

  let job: DurablePublicationJob;
  try {
    job = await repository.loadJob(handle.id);
  } catch {
    return persistenceFailure();
  }

  if (!durabilityConfirmed) return persistenceFailure(job);
  return { ok: true, job, durabilityConfirmed: true };
}

/**
 * Retry one definitive failed child on its existing Partial job. The database
 * validates approval and claims the selected child atomically, keyed to one
 * explicit retry request so concurrent calls and HTTP replays are at-most-once.
 */
export async function orchestrateFailedPublicationRetry(
  intent: FailedPublicationRetryIntent,
  {
    repository,
    preflightMedia,
    publish,
    providerTimeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS,
  }: PublicationOrchestratorDependencies,
): Promise<ManualPublicationOutcome> {
  if (
    !UUID_PATTERN.test(intent.jobId) ||
    !UUID_PATTERN.test(intent.retryRequestKey) ||
    !UUID_PATTERN.test(intent.requestedBy.id) ||
    !Number.isSafeInteger(intent.entryRevision) ||
    intent.entryRevision <= 0 ||
    !intent.payload.platforms.includes(intent.platform)
  ) {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'A valid publication retry is required.',
    };
  }

  try {
    await repository.recoverStaleClaims();
  } catch {
    return persistenceFailure();
  }

  let mediaIssue: PublicationMediaIssue | null;
  try {
    mediaIssue = await preflightMedia(intent.payload);
  } catch {
    mediaIssue = {
      code: 'media_unavailable',
      message: 'The approved media could not be verified safely.',
    };
  }
  if (mediaIssue) {
    return {
      ok: false,
      code: 'media_preflight_failed',
      message: mediaIssue.message,
    };
  }

  let claim: PublicationRetryClaim | null;
  try {
    claim = await repository.claimFailedRetry(intent);
  } catch {
    return persistenceFailure();
  }
  if (!claim) {
    return {
      ok: false,
      code: 'retry_not_available',
      message: 'This platform result is not available for a safe retry.',
    };
  }

  if (claim.claimed) {
    const completion = await publisherCompletion(
      intent.platform,
      intent.payload,
      publish,
      providerTimeoutMs,
    );
    try {
      await repository.completeResult({
        jobId: claim.id,
        platform: intent.platform,
        ...completion,
      });
    } catch {
      let job: DurablePublicationJob | undefined;
      try {
        job = await repository.loadJob(claim.id);
      } catch {
        // The fixed persistence response remains sufficient when reload fails.
      }
      return persistenceFailure(job);
    }
  }

  try {
    const job = await repository.loadJob(claim.id);
    return { ok: true, job, durabilityConfirmed: true };
  } catch {
    return persistenceFailure();
  }
}
