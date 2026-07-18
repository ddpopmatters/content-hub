import type { Entry, PlatformPublishStatus } from '../../types/models';
import { APP_CONFIG } from '../../lib/config';
import {
  getPublishCapabilityIssue,
  type PublishCapabilityIssue,
} from '../../../supabase/functions/_shared/publishCapabilities';
import {
  type ApprovalFreshnessIssue,
  getApprovalFreshnessIssue,
} from '../../../supabase/functions/_shared/approvalFreshness';
import {
  getPublicationMediaLocationIssue,
  type PublicationMediaIssue,
} from '../../../supabase/functions/_shared/publicationMedia';

/**
 * Initialise publish status for all platforms on an entry
 */
export function initializePublishStatus(
  platforms: string[],
): Record<string, PlatformPublishStatus> {
  const status: Record<string, PlatformPublishStatus> = {};
  platforms.forEach((platform) => {
    status[platform] = {
      status: 'publishing',
      url: null,
      error: null,
      timestamp: new Date().toISOString(),
    };
  });
  return status;
}

/**
 * Get aggregate publish status from per-platform statuses
 */
export function getAggregatePublishStatus(
  publishStatus: Record<string, PlatformPublishStatus> | undefined,
): 'none' | 'pending' | 'publishing' | 'published' | 'partial' | 'failed' | 'unknown' {
  if (!publishStatus || Object.keys(publishStatus).length === 0) {
    return 'none';
  }

  const statuses = Object.values(publishStatus);
  const allPublished = statuses.every((s) => s.status === 'published');
  const allFailed = statuses.every((s) => s.status === 'failed' || s.status === 'skipped');
  const anyPending = statuses.some((s) => s.status === 'pending');
  const anyPublishing = statuses.some((s) => s.status === 'publishing');
  const anyUnknown = statuses.some((s) => s.status === 'unknown');
  const anyPublished = statuses.some((s) => s.status === 'published');
  const anyNotPublished = statuses.some((s) => s.status !== 'published');

  if (allPublished) return 'published';
  if (anyUnknown) return 'unknown';
  if (allFailed) return 'failed';
  // Treat pending and publishing as in-flight states
  if (anyPublishing) return 'publishing';
  if (anyPending) return 'pending';
  if (anyPublished && anyNotPublished) return 'partial';
  return 'none';
}

/**
 * Convert transport status to fixed, actionable copy. Response bodies are not
 * displayed or persisted because they may originate outside the application.
 */
export function getPublishRequestError(status: number): string {
  switch (status) {
    case 400:
      return 'The publishing request was invalid.';
    case 401:
      return 'Sign in again before publishing.';
    case 403:
      return 'This account is not allowed to publish.';
    case 404:
      return 'This entry could not be found.';
    case 409:
      return 'This entry must be approved again before publishing.';
    case 422:
      return 'This entry is not ready for direct publishing.';
    case 503:
      return 'Publishing is temporarily unavailable.';
    default:
      return 'Publishing failed. No confirmed result was recorded.';
  }
}

/**
 * Resolve the shared server/UI capability guard for an entry.
 */
export function getEntryPublishCapabilityIssue(
  entry: Entry,
): PublishCapabilityIssue | PublicationMediaIssue | null {
  const payload = {
    assetType: entry.assetType,
    platforms: entry.platforms,
    mediaUrls: entry.assetPreviews ?? [],
    previewUrl: entry.previewUrl || null,
    caption: entry.caption,
    platformCaptions: entry.platformCaptions,
    firstComment: entry.firstComment,
  };
  return (
    getPublishCapabilityIssue(payload) ??
    getPublicationMediaLocationIssue(
      {
        ...payload,
        entryId: entry.id,
        caption: entry.caption,
        platformCaptions: entry.platformCaptions,
        firstComment: entry.firstComment,
      },
      APP_CONFIG.SUPABASE_URL,
    )
  );
}

/**
 * Resolve the shared server/UI approval freshness guard for an entry.
 */
export function getEntryApprovalFreshnessIssue(entry: Entry): ApprovalFreshnessIssue | null {
  return getApprovalFreshnessIssue({
    approvedAt: entry.approvedAt,
    contentRevision: entry.contentRevision,
    approvedRevision: entry.approvedRevision,
  });
}

/**
 * Check if an entry can be published
 */
export function canPublish(entry: Entry): boolean {
  // If durable reads fail, publishing is unsafe because an earlier Unknown or
  // successful intent may exist even when the entry projection is empty.
  if (entry.publicationStateAvailable === false) return false;
  // Must be approved
  if (entry.workflowStatus !== 'Approved') return false;
  // The current database revision must be the exact revision approved.
  if (getEntryApprovalFreshnessIssue(entry)) return false;
  // Must have platforms selected
  if (!entry.platforms || entry.platforms.length === 0) return false;
  // Server owns enforcement; this shared guard keeps the UI truthful.
  if (getEntryPublishCapabilityIssue(entry)) return false;
  // Must not be in any active publish state
  const status = getAggregatePublishStatus(entry.publishStatus);
  if (
    status === 'pending' ||
    status === 'publishing' ||
    status === 'unknown' ||
    status === 'published' ||
    status === 'partial'
  ) {
    return false;
  }
  return true;
}

/**
 * A targeted retry is safe only for one definitive failed child on the exact
 * approved revision of a durable Partial job.
 */
export function canRetryFailedPlatform(entry: Entry, platform: string): boolean {
  const job = entry.publicationJob;
  if (
    entry.publicationStateAvailable === false ||
    entry.workflowStatus !== 'Approved' ||
    getEntryApprovalFreshnessIssue(entry) ||
    !job ||
    job.status !== 'partial' ||
    job.entryId !== entry.id ||
    job.entryRevision !== entry.contentRevision ||
    entry.publishStatus?.[platform]?.status !== 'failed'
  ) {
    return false;
  }

  return job.results.some((result) => result.platform === platform && result.status === 'failed');
}

/**
 * Check if an entry can use "Post Again"
 */
export function canPostAgain(entry: Entry): boolean {
  // Must be published or have been published
  return (
    entry.workflowStatus === 'Published' ||
    getAggregatePublishStatus(entry.publishStatus) === 'published'
  );
}
