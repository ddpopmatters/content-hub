import type { PlatformResult } from './types.ts';

export type PublicationFailureReason =
  | 'connection_missing'
  | 'multiple_connections'
  | 'reconnect_required'
  | 'media_unavailable'
  | 'unsupported'
  | 'provider_rejected'
  | 'unexpected';

type InternalPlatformResult = PlatformResult & {
  failureReason?: PublicationFailureReason;
};

export type PublicPlatformResult = Omit<PlatformResult, 'postId'>;

const PUBLIC_URL_RULES: Record<string, { origin: string; pathnamePrefix: string }> = {
  BlueSky: { origin: 'https://bsky.app', pathnamePrefix: '/profile/' },
  Instagram: { origin: 'https://www.instagram.com', pathnamePrefix: '/p/' },
  Facebook: { origin: 'https://www.facebook.com', pathnamePrefix: '/' },
  LinkedIn: {
    origin: 'https://www.linkedin.com',
    pathnamePrefix: '/feed/update/',
  },
  'LinkedIn Org': {
    origin: 'https://www.linkedin.com',
    pathnamePrefix: '/feed/update/',
  },
};

const failureMessage = (platform: string, reason: PublicationFailureReason): string => {
  switch (reason) {
    case 'connection_missing':
      return `Connect ${platform} before publishing.`;
    case 'multiple_connections':
      return `Disconnect the extra ${platform} account before publishing.`;
    case 'reconnect_required':
      return `Reconnect ${platform} before publishing.`;
    case 'media_unavailable':
      return `${platform} could not load the approved media. No post was sent.`;
    case 'unsupported':
      return `Direct publishing to ${platform} is unavailable for this entry.`;
    case 'unexpected':
      return `Publishing to ${platform} could not be completed. Check the platform before trying again.`;
    case 'provider_rejected':
      return `${platform} did not confirm publication. Check the platform before trying again.`;
  }
};

const sanitisePublishedUrl = (platform: string, value: string | null): string | null => {
  if (!value) return null;
  const rule = PUBLIC_URL_RULES[platform];
  if (!rule) return null;

  try {
    const url = new URL(value);
    if (
      url.origin !== rule.origin ||
      !url.pathname.startsWith(rule.pathnamePrefix) ||
      url.username ||
      url.password
    ) {
      return null;
    }
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
};

export function createPublicationFailure(
  platform: string,
  reason: PublicationFailureReason,
  timestamp: string,
): InternalPlatformResult {
  return {
    status: 'failed',
    url: null,
    postId: null,
    error: failureMessage(platform, reason),
    timestamp,
    failureReason: reason,
  };
}

/**
 * Reduce provider output to the small, fixed contract allowed to reach storage
 * and the browser. Upstream response bodies and exception text are ignored.
 */
export function finalisePlatformResult(
  platform: string,
  result: InternalPlatformResult,
): PlatformResult {
  if (result.status === 'published') {
    return {
      status: 'published',
      url: sanitisePublishedUrl(platform, result.url),
      postId: result.postId,
      error: null,
      timestamp: result.timestamp,
    };
  }

  if (result.status === 'skipped') {
    return {
      status: 'skipped',
      url: null,
      postId: null,
      error: failureMessage(platform, 'unsupported'),
      timestamp: result.timestamp,
    };
  }

  const failure = createPublicationFailure(
    platform,
    result.failureReason ?? 'provider_rejected',
    result.timestamp,
  );
  return {
    status: failure.status,
    url: failure.url,
    postId: failure.postId,
    error: failure.error,
    timestamp: failure.timestamp,
  };
}

export function toPublicPlatformResult(result: PlatformResult): PublicPlatformResult {
  return {
    status: result.status,
    url: result.url,
    error: result.error,
    timestamp: result.timestamp,
  };
}
