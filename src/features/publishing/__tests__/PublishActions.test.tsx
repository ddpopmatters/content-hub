import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublishActions } from '../PublishActions';
import { APP_CONFIG } from '../../../lib/config';
import type { Entry } from '../../../types/models';

const STORED_IMAGE = `${APP_CONFIG.SUPABASE_URL}/storage/v1/object/public/content-media/entries/image.jpg`;

const videoEntry = {
  id: 'video-entry',
  workflowStatus: 'Approved',
  platforms: ['BlueSky'],
  assetType: 'Video',
  assetPreviews: ['https://cdn.example.org/video.mp4'],
  previewUrl: 'https://cdn.example.org/video.mp4',
  approvedAt: '2026-07-17T09:00:00.000Z',
  updatedAt: '2026-07-17T09:00:00.000Z',
  contentRevision: 3,
  approvedRevision: 3,
  publishStatus: {},
} as Entry;

const publishableEntry = {
  ...videoEntry,
  id: 'publishable-entry',
  assetType: 'Design',
  platforms: ['Facebook', 'LinkedIn'],
  previewUrl: STORED_IMAGE,
  assetPreviews: [STORED_IMAGE],
} as Entry;

describe('PublishActions capability messaging', () => {
  it('hides Publish and explains why an unsupported entry cannot be published', () => {
    render(
      <PublishActions
        entry={videoEntry}
        onPublish={vi.fn().mockResolvedValue(undefined)}
        onPostAgain={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Publish Now' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Direct publishing unavailable: Video publishing is not available.',
    );
  });

  it('hides Publish and explains when the entry changed after approval', () => {
    render(
      <PublishActions
        entry={{
          ...videoEntry,
          assetType: 'Design',
          previewUrl: STORED_IMAGE,
          assetPreviews: [STORED_IMAGE],
          contentRevision: 4,
          approvedRevision: 3,
        }}
        onPublish={vi.fn().mockResolvedValue(undefined)}
        onPostAgain={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Publish Now' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Direct publishing unavailable: This entry changed after approval. Approve the latest version before publishing.',
    );
  });

  it('does not offer Retry for a failed unsupported entry', () => {
    render(
      <PublishActions
        entry={{
          ...videoEntry,
          publishStatus: {
            BlueSky: {
              status: 'failed',
              url: null,
              error: 'Unsupported',
              timestamp: '2026-07-16T16:00:00Z',
            },
          },
        }}
        onPublish={vi.fn().mockResolvedValue(undefined)}
        onPostAgain={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('explains that a complete manual publication is durable', () => {
    render(
      <PublishActions
        entry={{
          ...publishableEntry,
          workflowStatus: 'Published',
          publishStatus: {
            Facebook: {
              status: 'published',
              url: 'https://www.facebook.com/123',
              error: null,
              timestamp: '2026-07-17T12:00:00.000Z',
            },
            LinkedIn: {
              status: 'published',
              url: 'https://www.linkedin.com/feed/update/123',
              error: null,
              timestamp: '2026-07-17T12:00:00.000Z',
            },
          },
        }}
        onPublish={vi.fn().mockResolvedValue(undefined)}
        onPostAgain={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'This durable result will be restored after a reload.',
    );
  });

  it('offers a targeted retry for only the failed child of a durable Partial job', async () => {
    const onRetryPlatform = vi.fn().mockResolvedValue(undefined);
    render(
      <PublishActions
        entry={{
          ...publishableEntry,
          publicationStateAvailable: true,
          publicationJob: {
            id: '40000000-0000-4000-8000-000000000001',
            entryId: publishableEntry.id,
            entryRevision: publishableEntry.contentRevision,
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
        }}
        onPublish={vi.fn().mockResolvedValue(undefined)}
        onRetryPlatform={onRetryPlatform}
        onPostAgain={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Failed platforms can be retried individually',
    );
    expect(screen.getByText('LinkedIn did not confirm publication.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish Now' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry Facebook' })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry LinkedIn' }));
    });
    expect(onRetryPlatform).toHaveBeenCalledWith(publishableEntry.id, 'LinkedIn');
  });

  it('tells the user to check the platform when the durable outcome is unknown', () => {
    render(
      <PublishActions
        entry={{
          ...publishableEntry,
          publishStatus: {
            Facebook: {
              status: 'unknown',
              url: null,
              error: 'Facebook may have received the post. Check the platform before retrying.',
              timestamp: '2026-07-17T12:00:00.000Z',
            },
          },
        }}
        onPublish={vi.fn().mockResolvedValue(undefined)}
        onPostAgain={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('automatic retry is disabled');
    expect(screen.getByText('Check platform')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});
