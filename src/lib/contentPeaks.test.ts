import { describe, expect, it, vi } from 'vitest';
import { buildContentPeakSnapshot, createDefaultContentPeaks } from './contentPeaks';
import type { ContentPeak, Entry } from '../types/models';

const createEntry = (overrides: Partial<Entry>): Entry => ({
  id: overrides.id || 'entry-1',
  date: overrides.date || '2026-07-05',
  platforms: overrides.platforms || ['Instagram'],
  assetType: overrides.assetType || 'Design',
  caption: overrides.caption || 'Peak content',
  platformCaptions: overrides.platformCaptions || {},
  firstComment: overrides.firstComment || '',
  status: overrides.status || 'Approved',
  priorityTier: overrides.priorityTier || 'High',
  approvers: overrides.approvers || [],
  author: overrides.author || 'Dan',
  campaign: overrides.campaign || 'Awareness Day',
  contentPillar: overrides.contentPillar || 'Population & Demographics',
  previewUrl: overrides.previewUrl || '',
  checklist: overrides.checklist || {},
  analytics: overrides.analytics || {},
  workflowStatus: overrides.workflowStatus || 'Approved',
  statusDetail: overrides.statusDetail || '',
  aiFlags: overrides.aiFlags || [],
  aiScore: overrides.aiScore || {},
  testingFrameworkId: overrides.testingFrameworkId || '',
  testingFrameworkName: overrides.testingFrameworkName || '',
  createdAt: overrides.createdAt || '2026-06-01T09:00:00.000Z',
  updatedAt: overrides.updatedAt || '2026-06-01T09:00:00.000Z',
  approvedAt: overrides.approvedAt || null,
  deletedAt: overrides.deletedAt || null,
  contentPeak: overrides.contentPeak,
});

describe('contentPeaks', () => {
  it('creates seeded default peaks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T12:00:00.000Z'));

    const peaks = createDefaultContentPeaks('Dan');

    expect(peaks.length).toBeGreaterThan(0);
    expect(peaks[0]?.owner).toBe('Dan');
    expect(peaks[0]?.id).toBeTruthy();
  });

  it('builds readiness from tagged and linked entries', () => {
    const peak: ContentPeak = {
      id: 'peak-1',
      title: 'World Population Day',
      startDate: '2026-07-01',
      endDate: '2026-07-14',
      priorityTier: 'Urgent',
      owner: 'Dan',
      campaign: 'Awareness Day',
      contentPillar: 'Population & Demographics',
      responseMode: 'Planned',
      requiredPlatforms: ['Instagram', 'LinkedIn'],
      requiredAssetTypes: ['Video', 'Carousel'],
      linkedEntryIds: ['entry-2'],
      description: '',
      notes: '',
      createdAt: '2026-03-01T09:00:00.000Z',
      updatedAt: '2026-03-01T09:00:00.000Z',
    };

    const snapshot = buildContentPeakSnapshot(
      peak,
      [
        createEntry({
          id: 'entry-1',
          contentPeak: 'World Population Day',
          platforms: ['Instagram'],
          assetType: 'Video',
          workflowStatus: 'Approved',
        }),
        createEntry({
          id: 'entry-2',
          platforms: ['LinkedIn'],
          assetType: 'Carousel',
          workflowStatus: 'Published',
        }),
      ],
      new Date('2026-07-06T09:00:00.000Z'),
    );

    expect(snapshot.linkedEntries).toHaveLength(2);
    expect(snapshot.approvedEntries).toHaveLength(2);
    expect(snapshot.requiredPlatformCoverage).toBe(100);
    expect(snapshot.requiredAssetCoverage).toBe(100);
    expect(snapshot.state).toBe('Live');
    expect(snapshot.readinessScore).toBeGreaterThanOrEqual(80);
  });
});
