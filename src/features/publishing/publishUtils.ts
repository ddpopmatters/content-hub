import type { Entry, PublishSettings, PlatformPublishStatus } from '../../types/models';

/**
 * Build the webhook payload for publishing an entry
 * Note: webhookSecret is included in body (not header) due to browser no-cors limitations
 */
export function buildPublishPayload(entry: Entry, callbackUrl?: string, webhookSecret?: string) {
  return {
    entryId: entry.id,
    platforms: entry.platforms,
    caption: entry.caption,
    platformCaptions: entry.platformCaptions || {},
    mediaUrls: entry.attachments?.map((a) => a.url || a.dataUrl).filter(Boolean) || [],
    previewUrl: entry.previewUrl || null,
    scheduledDate: entry.date,
    firstComment: entry.firstComment || '',
    campaign: entry.campaign || '',
    contentPillar: entry.contentPillar || '',
    links: entry.links || [],
    callbackUrl: callbackUrl || null,
    ...(webhookSecret && { webhookSecret }),
  };
}

/**
 * Validate webhook URL - warn if using HTTP with a secret
 */
export function validateWebhookUrl(
  url: string,
  hasSecret: boolean,
): { valid: boolean; warning?: string } {
  if (!url) return { valid: false };

  try {
    const parsed = new URL(url);
    if (hasSecret && parsed.protocol === 'http:') {
      return {
        valid: true,
        warning: 'Using HTTP with a webhook secret is insecure. Use HTTPS.',
      };
    }
    return { valid: true };
  } catch {
    return { valid: false };
  }
}

/**
 * Send entry to Zapier webhook for publishing
 *
 * IMPORTANT: Uses no-cors mode since Zapier doesn't support CORS from browsers.
 * This means:
 * - We cannot read the response status or body
 * - Request will be sent but success is assumed if no network error
 * - Use the callback URL with a Supabase Edge Function to get actual confirmation
 *
 * The webhook secret is sent in the payload body (not header) due to CORS.
 */
export async function triggerPublish(
  entry: Entry,
  settings: PublishSettings,
  callbackUrl?: string,
): Promise<{ success: boolean; error?: string; warning?: string }> {
  if (!settings.webhookUrl) {
    return { success: false, error: 'No webhook URL configured' };
  }

  // Validate URL and check for security issues
  const validation = validateWebhookUrl(settings.webhookUrl, !!settings.webhookSecret);
  if (!validation.valid) {
    return { success: false, error: 'Invalid webhook URL' };
  }

  try {
    // Secret is included in payload body since no-cors strips custom headers
    const payload = buildPublishPayload(entry, callbackUrl, settings.webhookSecret);

    await fetch(settings.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      mode: 'no-cors', // Zapier doesn't support CORS - response will be opaque
    });

    // With no-cors we can't check response status
    // The request was sent - actual success depends on callback confirmation
    return {
      success: true,
      warning: validation.warning,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to trigger publish',
    };
  }
}

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
): 'none' | 'pending' | 'publishing' | 'published' | 'partial' | 'failed' {
  if (!publishStatus || Object.keys(publishStatus).length === 0) {
    return 'none';
  }

  const statuses = Object.values(publishStatus);
  const allPublished = statuses.every((s) => s.status === 'published');
  const allFailed = statuses.every((s) => s.status === 'failed' || s.status === 'skipped');
  const anyPending = statuses.some((s) => s.status === 'pending');
  const anyPublishing = statuses.some((s) => s.status === 'publishing');
  const anyPublished = statuses.some((s) => s.status === 'published');
  const anyFailed = statuses.some((s) => s.status === 'failed');

  if (allPublished) return 'published';
  if (allFailed) return 'failed';
  // Treat pending and publishing as in-flight states
  if (anyPublishing) return 'publishing';
  if (anyPending) return 'pending';
  if (anyPublished && anyFailed) return 'partial';
  return 'none';
}

/**
 * Check if an entry can be published
 */
export function canPublish(entry: Entry): boolean {
  // Must be approved
  if (entry.workflowStatus !== 'Approved') return false;
  // Must have platforms selected
  if (!entry.platforms || entry.platforms.length === 0) return false;
  // Must not be in any active publish state
  const status = getAggregatePublishStatus(entry.publishStatus);
  if (status === 'pending' || status === 'publishing' || status === 'published') return false;
  return true;
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
