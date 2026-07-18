import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type {
  DurablePublicationRepository,
  ManualPublicationIntent,
  PublicationErrorCode,
} from './publicationOrchestrator.ts';
import type {
  DurablePublicationJob,
  DurablePublicationResult,
  PublicationJobStatus,
  PublicationResultStatus,
  PublicationTriggerType,
} from './types.ts';
import { isPublishPayload } from './types.ts';

interface PublicationJobRow {
  id: string;
  entry_id: string;
  entry_revision: number;
  trigger_type: string;
  request_key: string;
  status: string;
  claimed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PublicationRetryJobRow extends PublicationJobRow {
  payload_snapshot: unknown;
}

interface PublicationResultRow {
  id: string;
  platform: string;
  status: string;
  provider_url: string | null;
  error_message: string | null;
  attempt_count: number;
  claimed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const JOB_STATUSES = new Set<PublicationJobStatus>([
  'queued',
  'publishing',
  'partial',
  'published',
  'failed',
  'unknown',
  'cancelled',
]);
const RESULT_STATUSES = new Set<PublicationResultStatus>([
  'pending',
  'publishing',
  'published',
  'failed',
  'skipped',
  'unknown',
]);
const TRIGGER_TYPES = new Set<PublicationTriggerType>(['manual', 'scheduled']);

const jobStatus = (value: string): PublicationJobStatus => {
  if (!JOB_STATUSES.has(value as PublicationJobStatus)) {
    throw new Error('invalid job status');
  }
  return value as PublicationJobStatus;
};

const resultStatus = (value: string): PublicationResultStatus => {
  if (!RESULT_STATUSES.has(value as PublicationResultStatus)) {
    throw new Error('invalid result status');
  }
  return value as PublicationResultStatus;
};

const triggerType = (value: string): PublicationTriggerType => {
  if (!TRIGGER_TYPES.has(value as PublicationTriggerType)) {
    throw new Error('invalid publication trigger');
  }
  return value as PublicationTriggerType;
};

const firstRow = <Row>(value: unknown): Row => {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error('invalid RPC response');
  }
  return value[0] as Row;
};

export const toDurablePublicationResult = (
  row: PublicationResultRow,
): DurablePublicationResult => ({
  id: row.id,
  platform: row.platform,
  status: resultStatus(row.status),
  url: row.provider_url,
  error: row.error_message,
  attemptCount: row.attempt_count,
  claimedAt: row.claimed_at,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toDurablePublicationJob = (
  row: PublicationJobRow,
  resultRows: PublicationResultRow[],
): DurablePublicationJob => ({
  id: row.id,
  entryId: row.entry_id,
  entryRevision: row.entry_revision,
  triggerType: triggerType(row.trigger_type),
  requestKey: row.request_key,
  status: jobStatus(row.status),
  claimedAt: row.claimed_at,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  results: resultRows.map(toDurablePublicationResult),
});

/** Service-role repository for the publication state machine. */
export function createPublicationRepository(client: SupabaseClient): DurablePublicationRepository {
  const loadJob = async (jobId: string): Promise<DurablePublicationJob> => {
    const { data: jobData, error: jobError } = await client
      .from('publication_jobs')
      .select(
        'id, entry_id, entry_revision, trigger_type, request_key, status, claimed_at, completed_at, created_at, updated_at',
      )
      .eq('id', jobId)
      .single();
    if (jobError || !jobData) throw new Error('publication job load failed');

    const { data: resultData, error: resultError } = await client
      .from('publication_results')
      .select(
        'id, platform, status, provider_url, error_message, attempt_count, claimed_at, completed_at, created_at, updated_at',
      )
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });
    if (resultError || !resultData) {
      throw new Error('publication result load failed');
    }

    return toDurablePublicationJob(
      jobData as unknown as PublicationJobRow,
      resultData as unknown as PublicationResultRow[],
    );
  };

  return {
    async recoverStaleClaims(): Promise<number> {
      const { data, error } = await client.rpc('recover_stale_publication_results');
      if (error || typeof data !== 'number') {
        throw new Error('publication recovery failed');
      }
      return data;
    },

    async findManualJob(
      requestedById: string,
      requestKey: string,
    ): Promise<DurablePublicationJob | null> {
      const { data, error } = await client
        .from('publication_jobs')
        .select('id')
        .eq('requested_by', requestedById)
        .eq('request_key', requestKey)
        .eq('trigger_type', 'manual')
        .maybeSingle();
      if (error) throw new Error('publication replay lookup failed');
      const jobId = (data as unknown as { id?: string } | null)?.id;
      return jobId ? loadJob(jobId) : null;
    },

    async createManualJob(intent: ManualPublicationIntent) {
      const { data, error } = await client.rpc('create_manual_publication_job', {
        p_entry_id: intent.payload.entryId,
        p_entry_revision: intent.entryRevision,
        p_request_key: intent.requestKey,
        p_requested_by: intent.requestedBy.id,
        p_requested_by_email: intent.requestedBy.email,
        p_payload_snapshot: intent.payload,
        p_platforms: intent.payload.platforms,
      });
      if (error) throw new Error('publication job creation failed');
      const row = firstRow<{ job_id: string; job_status: string; created: boolean }>(data);
      return {
        id: row.job_id,
        status: jobStatus(row.job_status),
        created: row.created,
      };
    },

    async loadOwnedRetryContext(jobId, requestedById) {
      const { data: jobData, error: jobError } = await client
        .from('publication_jobs')
        .select(
          'id, entry_id, entry_revision, trigger_type, request_key, status, payload_snapshot, claimed_at, completed_at, created_at, updated_at',
        )
        .eq('id', jobId)
        .eq('requested_by', requestedById)
        .eq('trigger_type', 'manual')
        .maybeSingle();
      if (jobError) throw new Error('publication retry lookup failed');
      if (!jobData) return null;

      const row = jobData as unknown as PublicationRetryJobRow;
      if (!isPublishPayload(row.payload_snapshot)) {
        throw new Error('invalid publication retry payload');
      }

      const { data: resultData, error: resultError } = await client
        .from('publication_results')
        .select(
          'id, platform, status, provider_url, error_message, attempt_count, claimed_at, completed_at, created_at, updated_at',
        )
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });
      if (resultError || !resultData) {
        throw new Error('publication retry results failed');
      }

      return {
        job: toDurablePublicationJob(row, resultData as unknown as PublicationResultRow[]),
        payload: row.payload_snapshot,
      };
    },

    async claimFailedRetry(intent) {
      const { data, error } = await client.rpc('claim_failed_publication_retry', {
        p_job_id: intent.jobId,
        p_platform: intent.platform,
        p_requested_by: intent.requestedBy.id,
        p_entry_revision: intent.entryRevision,
        p_retry_request_key: intent.retryRequestKey,
      });
      if (error || !Array.isArray(data)) {
        throw new Error('publication retry claim failed');
      }
      if (data.length === 0) return null;
      const row = firstRow<{ job_id: string; job_status: string; claimed: boolean }>(data);
      return {
        id: row.job_id,
        status: jobStatus(row.job_status),
        claimed: row.claimed,
      };
    },

    async claimResult(jobId: string, platform: string): Promise<boolean> {
      const { data, error } = await client.rpc('claim_publication_result', {
        p_job_id: jobId,
        p_platform: platform,
      });
      if (error || !Array.isArray(data)) {
        throw new Error('publication claim failed');
      }
      return data.length === 1;
    },

    async completeResult(completion): Promise<void> {
      const { data, error } = await client.rpc('complete_publication_result', {
        p_job_id: completion.jobId,
        p_platform: completion.platform,
        p_status: completion.status,
        p_provider_post_id: completion.providerPostId,
        p_provider_url: completion.providerUrl,
        p_error_code: completion.errorCode satisfies PublicationErrorCode | null,
      });
      if (error || !Array.isArray(data) || data.length !== 1) {
        throw new Error('publication completion failed');
      }
    },

    loadJob,
  };
}
