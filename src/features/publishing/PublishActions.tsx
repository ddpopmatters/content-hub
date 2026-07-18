import React, { useState } from 'react';
import { Badge, Button } from '../../components/ui';
import { cx } from '../../lib/utils';
import {
  canPostAgain,
  canPublish,
  canRetryFailedPlatform,
  getAggregatePublishStatus,
  getEntryApprovalFreshnessIssue,
  getEntryPublishCapabilityIssue,
} from './publishUtils';
import type { Entry } from '../../types/models';

export interface PublishActionsProps {
  entry: Entry;
  onPublish: (entryId: string) => Promise<void>;
  onPostAgain: (entry: Entry) => void;
  onRetryPlatform?: (entryId: string, platform: string) => Promise<void>;
  disabled?: boolean;
  onError?: (message: string) => void;
}

/**
 * Publish status badge showing aggregate and per-platform status
 */
function PublishStatusBadge({ entry, onClick }: { entry: Entry; onClick?: () => void }) {
  const status = getAggregatePublishStatus(entry.publishStatus);

  if (status === 'none') return null;

  const statusConfig = {
    pending: {
      label: 'Pending...',
      variant: 'secondary' as const,
      className: 'animate-pulse',
    },
    publishing: {
      label: 'Publishing...',
      variant: 'secondary' as const,
      className: 'animate-pulse',
    },
    published: {
      label: 'Published',
      variant: 'default' as const,
      className: 'bg-emerald-100 text-emerald-700',
    },
    partial: {
      label: 'Partial',
      variant: 'outline' as const,
      className: 'border-amber-300 text-amber-700',
    },
    failed: {
      label: 'Failed',
      variant: 'outline' as const,
      className: 'border-red-300 text-red-700',
    },
    unknown: {
      label: 'Check platform',
      variant: 'outline' as const,
      className: 'border-amber-300 text-amber-800',
    },
  };

  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      className={cx('cursor-pointer', config.className)}
      onClick={onClick}
    >
      {config.label}
    </Badge>
  );
}

/**
 * Per-platform publish status detail
 */
function PublishStatusDetail({
  entry,
  onRetryPlatform,
  retryingPlatform,
  disabled,
}: {
  entry: Entry;
  onRetryPlatform?: (entryId: string, platform: string) => Promise<void>;
  retryingPlatform: string | null;
  disabled?: boolean;
}) {
  if (!entry.publishStatus || Object.keys(entry.publishStatus).length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1 text-xs">
      {Object.entries(entry.publishStatus).map(([platform, status]) => (
        <div key={platform} className="rounded-md border border-slate-200 px-2 py-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{platform}</span>
            <div className="flex items-center gap-2">
              <span
                className={cx(
                  status.status === 'published' && 'text-emerald-600',
                  status.status === 'publishing' && 'text-ocean-600',
                  status.status === 'failed' && 'text-red-600',
                  status.status === 'unknown' && 'text-amber-700',
                )}
              >
                {status.status}
              </span>
              {status.url && (
                <a
                  href={status.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ocean-600 hover:underline"
                >
                  View
                </a>
              )}
              {onRetryPlatform && canRetryFailedPlatform(entry, platform) && (
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Retry ${platform}`}
                  onClick={() => onRetryPlatform(entry.id, platform)}
                  disabled={disabled || retryingPlatform !== null}
                  className="h-7 border-red-300 px-2 text-xs text-red-700 hover:bg-red-50"
                >
                  {retryingPlatform === platform ? 'Retrying...' : 'Retry'}
                </Button>
              )}
            </div>
          </div>
          {status.error && <p className="mt-1 text-red-600">{status.error}</p>}
        </div>
      ))}
    </div>
  );
}

function PublishOutcomeMessage({
  status,
}: {
  status: ReturnType<typeof getAggregatePublishStatus>;
}) {
  if (status === 'published') {
    return (
      <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
        Published to every selected platform. This durable result will be restored after a reload.
      </div>
    );
  }

  if (status === 'partial') {
    return (
      <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
        Only some platforms were confirmed published. Failed platforms can be retried individually;
        confirmed posts will not be sent again.
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="status">
        No platform publication was confirmed. Review the result and check the platform before
        trying again.
      </div>
    );
  }

  if (status === 'unknown') {
    return (
      <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
        The provider may have received this post. Check the platform before taking any further
        action; automatic retry is disabled to prevent a duplicate.
      </div>
    );
  }

  return null;
}

/**
 * Publish actions component - shows Publish Now, Post Again, and status
 */
export function PublishActions({
  entry,
  onPublish,
  onPostAgain,
  onRetryPlatform,
  disabled,
  onError,
}: PublishActionsProps): React.ReactElement {
  const [isPublishing, setIsPublishing] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [retryingPlatform, setRetryingPlatform] = useState<string | null>(null);

  const handlePublish = async () => {
    setIsPublishing(true);
    setLocalError(null);
    try {
      await onPublish(entry.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to publish';
      setLocalError(message);
      onError?.(message);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRetryPlatform = async (entryId: string, platform: string) => {
    if (!onRetryPlatform) return;
    setRetryingPlatform(platform);
    setLocalError(null);
    try {
      await onRetryPlatform(entryId, platform);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retry publication';
      setLocalError(message);
      onError?.(message);
    } finally {
      setRetryingPlatform(null);
    }
  };

  const status = getAggregatePublishStatus(entry.publishStatus);
  const canAttemptPublish = canPublish(entry);
  const showPublishButton = canAttemptPublish && status !== 'failed';
  const showPostAgainButton = canPostAgain(entry);
  const approvalFreshnessIssue = getEntryApprovalFreshnessIssue(entry);
  const capabilityIssue = getEntryPublishCapabilityIssue(entry);
  const directPublishIssue = approvalFreshnessIssue?.message ?? capabilityIssue?.message;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* Publish Now Button */}
        {showPublishButton && (
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={disabled || isPublishing}
            className="bg-ocean-600 hover:bg-ocean-700"
          >
            {isPublishing ? 'Publishing...' : 'Publish Now'}
          </Button>
        )}

        {/* Post Again Button */}
        {showPostAgainButton && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPostAgain(entry)}
            disabled={disabled}
          >
            Post Again
          </Button>
        )}

        {/* Status Badge */}
        <PublishStatusBadge entry={entry} onClick={() => setShowDetail(!showDetail)} />

        {/* Retry Button for failed */}
        {status === 'failed' && canAttemptPublish && (
          <Button
            size="sm"
            variant="outline"
            onClick={handlePublish}
            disabled={disabled || isPublishing}
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
            Retry
          </Button>
        )}
      </div>

      {/* Expandable Detail */}
      {(showDetail || status === 'partial' || status === 'failed') && (
        <PublishStatusDetail
          entry={entry}
          onRetryPlatform={onRetryPlatform ? handleRetryPlatform : undefined}
          retryingPlatform={retryingPlatform}
          disabled={disabled}
        />
      )}

      <PublishOutcomeMessage status={status} />

      {/* Local Error Display */}
      {localError && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{localError}</div>
      )}

      {entry.workflowStatus === 'Approved' && directPublishIssue && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
          Direct publishing unavailable: {directPublishIssue}
        </div>
      )}
    </div>
  );
}
