import { describe, expect, it } from 'vitest';
import type { DurablePublicationJob, Entry } from '../../../types/models';
import { applyDurablePublicationJob, shouldReconcilePublicationJob } from '../durablePublication';

const entry = {
  id: '10000000-0000-4000-8000-000000000001',
  contentRevision: 3,
  workflowStatus: 'Approved',
} as Entry;

const job = (overrides: Partial<DurablePublicationJob> = {}): DurablePublicationJob => ({
  id: '40000000-0000-4000-8000-000000000001',
  entryId: entry.id,
  entryRevision: 3,
  triggerType: 'manual',
  requestKey: '30000000-0000-4000-8000-000000000001',
  status: 'unknown',
  claimedAt: '2026-07-17T20:30:00.000Z',
  completedAt: '2026-07-17T20:31:00.000Z',
  createdAt: '2026-07-17T20:30:00.000Z',
  updatedAt: '2026-07-17T20:31:00.000Z',
  results: [
    {
      id: '50000000-0000-4000-8000-000000000001',
      platform: 'Facebook',
      status: 'unknown',
      url: null,
      error: 'Facebook may have received the post. Check the platform before retrying.',
      attemptCount: 1,
      claimedAt: '2026-07-17T20:30:00.000Z',
      completedAt: '2026-07-17T20:31:00.000Z',
      createdAt: '2026-07-17T20:30:00.000Z',
      updatedAt: '2026-07-17T20:31:00.000Z',
    },
  ],
  ...overrides,
});

describe('applyDurablePublicationJob', () => {
  it('restores an unknown result after reload without exposing provider identifiers', () => {
    const projected = applyDurablePublicationJob(entry, job());

    expect(projected.publishStatus?.Facebook.status).toBe('unknown');
    expect(projected.publicationJob?.status).toBe('unknown');
    expect(projected.workflowStatus).toBe('Approved');
    expect(projected.publicationJob?.results[0]).not.toHaveProperty('providerPostId');
  });

  it('projects a fully published durable job onto the entry workflow', () => {
    const published = job({
      status: 'published',
      results: [
        {
          ...job().results[0],
          status: 'published',
          url: 'https://www.facebook.com/123',
          error: null,
        },
      ],
    });
    const projected = applyDurablePublicationJob(entry, published);

    expect(projected.workflowStatus).toBe('Published');
    expect(projected.publishedAt).toBe(published.completedAt);
  });

  it('ignores a job for an older entry revision', () => {
    expect(applyDurablePublicationJob(entry, job({ entryRevision: 2 }))).toBe(entry);
  });
});

describe('shouldReconcilePublicationJob', () => {
  it('reconciles queued and publishing jobs without trusting the browser clock', () => {
    expect(shouldReconcilePublicationJob(job({ status: 'queued' }))).toBe(true);
    expect(shouldReconcilePublicationJob(job({ status: 'publishing' }))).toBe(true);
  });

  it('does not replay terminal jobs', () => {
    expect(shouldReconcilePublicationJob(job({ status: 'unknown' }))).toBe(false);
    expect(shouldReconcilePublicationJob(job({ status: 'failed' }))).toBe(false);
  });
});
