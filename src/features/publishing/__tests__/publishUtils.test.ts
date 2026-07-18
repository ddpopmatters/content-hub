import { describe, expect, it } from 'vitest';
import {
  canPublish,
  canRetryFailedPlatform,
  getAggregatePublishStatus,
  getEntryApprovalFreshnessIssue,
  getEntryPublishCapabilityIssue,
  getPublishRequestError,
} from '../publishUtils';
import { APP_CONFIG } from '../../../lib/config';
import type { Entry } from '../../../types/models';

const STORED_IMAGE = `${APP_CONFIG.SUPABASE_URL}/storage/v1/object/public/content-media/entries/image.jpg`;

const baseEntry = {
  id: '1',
  platforms: ['LinkedIn'],
  assetType: 'Design',
  assetPreviews: [],
  previewUrl: '',
  workflowStatus: 'Approved',
  approvedAt: '2026-07-17T09:00:00.000Z',
  updatedAt: '2026-07-17T09:00:00.000Z',
  contentRevision: 3,
  approvedRevision: 3,
  publishStatus: {},
} as unknown as Entry;

describe('getAggregatePublishStatus', () => {
  it('returns failed when all platforms are skipped', () => {
    expect(
      getAggregatePublishStatus({
        Instagram: {
          status: 'skipped',
          url: null,
          error: 'not implemented',
          timestamp: 't',
        },
      }),
    ).toBe('failed');
  });

  it('returns partial when a published result is mixed with a skipped result', () => {
    expect(
      getAggregatePublishStatus({
        Facebook: {
          status: 'published',
          url: null,
          error: null,
          timestamp: 't',
        },
        LinkedIn: {
          status: 'skipped',
          url: null,
          error: 'Unavailable',
          timestamp: 't',
        },
      }),
    ).toBe('partial');
  });
});

describe('publish request errors', () => {
  it('maps authentication failures to an actionable fixed message', () => {
    expect(getPublishRequestError(401)).toBe('Sign in again before publishing.');
  });

  it('does not include an upstream response body in an unexpected failure', () => {
    expect(getPublishRequestError(500)).toBe(
      'Publishing failed. No confirmed result was recorded.',
    );
  });
});

describe('publish capability guard', () => {
  it('allows a supported image post', () => {
    const entry = {
      ...baseEntry,
      previewUrl: STORED_IMAGE,
    } as Entry;

    expect(getEntryPublishCapabilityIssue(entry)).toBeNull();
    expect(canPublish(entry)).toBe(true);
  });

  it.each([
    ['Video', ['BlueSky'], 'https://cdn.example.org/video.mp4'],
    ['Design', ['YouTube'], 'https://cdn.example.org/image.jpg'],
    ['Carousel', ['LinkedIn'], ''],
  ])('blocks unsupported %s publishing to %s', (assetType, platforms, previewUrl) => {
    const entry = {
      ...baseEntry,
      assetType,
      platforms,
      previewUrl,
      assetPreviews: ['https://cdn.example.org/one.jpg', 'https://cdn.example.org/two.jpg'],
    } as Entry;

    expect(getEntryPublishCapabilityIssue(entry)).not.toBeNull();
    expect(canPublish(entry)).toBe(false);
  });

  it('blocks an incomplete carousel', () => {
    const entry = {
      ...baseEntry,
      assetType: 'Carousel',
      platforms: ['Instagram'],
      assetPreviews: ['https://cdn.example.org/only-one.jpg'],
    } as Entry;

    expect(getEntryPublishCapabilityIssue(entry)?.code).toBe('missing_carousel_images');
    expect(canPublish(entry)).toBe(false);
  });

  it('blocks external and signed publication media', () => {
    for (const previewUrl of [
      'https://cdn.example.org/image.jpg',
      `${STORED_IMAGE}?token=temporary`,
    ]) {
      const entry = { ...baseEntry, previewUrl } as Entry;

      expect(getEntryPublishCapabilityIssue(entry)?.code).toBe('invalid_storage_url');
      expect(canPublish(entry)).toBe(false);
    }
  });

  it('blocks captions that would be silently truncated by a platform', () => {
    const entry = {
      ...baseEntry,
      assetType: 'No asset',
      platforms: ['BlueSky'],
      caption: 'a'.repeat(301),
      platformCaptions: {},
      firstComment: '',
    } as Entry;

    expect(getEntryPublishCapabilityIssue(entry)?.code).toBe('caption_too_long');
    expect(canPublish(entry)).toBe(false);
  });

  it('blocks first comments until their outcome can be tracked durably', () => {
    const entry = {
      ...baseEntry,
      previewUrl: STORED_IMAGE,
      caption: 'Approved caption',
      platformCaptions: {},
      firstComment: 'Approved first comment',
    } as Entry;

    expect(getEntryPublishCapabilityIssue(entry)?.code).toBe('first_comment_unsupported');
    expect(canPublish(entry)).toBe(false);
  });

  it('blocks another direct attempt after a partial result', () => {
    const entry = {
      ...baseEntry,
      previewUrl: STORED_IMAGE,
      publishStatus: {
        Facebook: {
          status: 'published',
          url: null,
          error: null,
          timestamp: 't',
        },
        LinkedIn: {
          status: 'failed',
          url: null,
          error: 'Failed',
          timestamp: 't',
        },
      },
    } as Entry;

    expect(getAggregatePublishStatus(entry.publishStatus)).toBe('partial');
    expect(canPublish(entry)).toBe(false);
  });

  it('blocks automatic retry when a provider outcome is unknown', () => {
    const entry = {
      ...baseEntry,
      previewUrl: STORED_IMAGE,
      publishStatus: {
        Facebook: {
          status: 'unknown',
          url: null,
          error: 'Facebook may have received the post.',
          timestamp: 't',
        },
      },
    } as Entry;

    expect(getAggregatePublishStatus(entry.publishStatus)).toBe('unknown');
    expect(canPublish(entry)).toBe(false);
  });

  it('fails closed when durable publication state cannot be loaded', () => {
    const entry = {
      ...baseEntry,
      previewUrl: STORED_IMAGE,
      publicationStateAvailable: false,
    } as Entry;

    expect(canPublish(entry)).toBe(false);
  });
});

describe('approval freshness guard', () => {
  it('requires an approval timestamp for approved entries', () => {
    const entry = { ...baseEntry, approvedAt: null } as Entry;

    expect(getEntryApprovalFreshnessIssue(entry)?.code).toBe('invalid_approval_revision');
    expect(canPublish(entry)).toBe(false);
  });

  it('blocks entries updated after their approval window', () => {
    const entry = {
      ...baseEntry,
      contentRevision: 4,
      approvedRevision: 3,
    } as Entry;

    expect(getEntryApprovalFreshnessIssue(entry)?.code).toBe('revision_not_approved');
    expect(canPublish(entry)).toBe(false);
  });

  it('allows unrelated later updates when the content revision remains approved', () => {
    const entry = {
      ...baseEntry,
      previewUrl: STORED_IMAGE,
      updatedAt: '2026-07-18T09:00:00.000Z',
    } as Entry;

    expect(getEntryApprovalFreshnessIssue(entry)).toBeNull();
    expect(canPublish(entry)).toBe(true);
  });
});

describe('targeted publication retry guard', () => {
  const partialEntry = {
    ...baseEntry,
    platforms: ['Facebook', 'LinkedIn'],
    publicationStateAvailable: true,
    publicationJob: {
      id: '40000000-0000-4000-8000-000000000001',
      entryId: baseEntry.id,
      entryRevision: baseEntry.contentRevision,
      triggerType: 'manual',
      requestKey: '30000000-0000-4000-8000-000000000001',
      status: 'partial',
      claimedAt: '2026-07-17T12:00:00.000Z',
      completedAt: '2026-07-17T12:00:00.000Z',
      createdAt: '2026-07-17T12:00:00.000Z',
      updatedAt: '2026-07-17T12:00:00.000Z',
      results: [
        {
          id: '50000000-0000-4000-8000-000000000001',
          platform: 'Facebook',
          status: 'published',
          url: 'https://www.facebook.com/123',
          error: null,
          attemptCount: 1,
          claimedAt: '2026-07-17T12:00:00.000Z',
          completedAt: '2026-07-17T12:00:00.000Z',
          createdAt: '2026-07-17T12:00:00.000Z',
          updatedAt: '2026-07-17T12:00:00.000Z',
        },
        {
          id: '50000000-0000-4000-8000-000000000002',
          platform: 'LinkedIn',
          status: 'failed',
          url: null,
          error: 'LinkedIn did not confirm publication.',
          attemptCount: 1,
          claimedAt: '2026-07-17T12:00:00.000Z',
          completedAt: '2026-07-17T12:00:00.000Z',
          createdAt: '2026-07-17T12:00:00.000Z',
          updatedAt: '2026-07-17T12:00:00.000Z',
        },
      ],
    },
    publishStatus: {
      Facebook: {
        status: 'published',
        url: 'https://www.facebook.com/123',
        error: null,
        timestamp: '2026-07-17T12:00:00.000Z',
      },
      LinkedIn: {
        status: 'failed',
        url: null,
        error: 'LinkedIn did not confirm publication.',
        timestamp: '2026-07-17T12:00:00.000Z',
      },
    },
  } as Entry;

  it('allows only the definitive failed child on the matching Partial job', () => {
    expect(canRetryFailedPlatform(partialEntry, 'LinkedIn')).toBe(true);
    expect(canRetryFailedPlatform(partialEntry, 'Facebook')).toBe(false);
  });

  it('refuses unknown outcomes and stale local durable state', () => {
    expect(
      canRetryFailedPlatform(
        {
          ...partialEntry,
          publicationStateAvailable: false,
        },
        'LinkedIn',
      ),
    ).toBe(false);
    expect(
      canRetryFailedPlatform(
        {
          ...partialEntry,
          publishStatus: {
            ...partialEntry.publishStatus,
            LinkedIn: {
              ...partialEntry.publishStatus!.LinkedIn,
              status: 'unknown',
            },
          },
        },
        'LinkedIn',
      ),
    ).toBe(false);
  });
});
