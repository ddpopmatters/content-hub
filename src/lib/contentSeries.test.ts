import { describe, expect, it } from 'vitest';
import { buildContentSeriesSnapshot, createDefaultContentSeries } from './contentSeries';
import type { ContentSeries, Entry } from '../types/models';

describe('contentSeries', () => {
  it('creates default seeded series', () => {
    const seeded = createDefaultContentSeries('Dan');
    expect(seeded).toHaveLength(3);
    expect(seeded[0].owner).toBe('Dan');
  });

  it('builds a snapshot from matching series entries', () => {
    const series: ContentSeries = {
      id: 'series-1',
      title: 'Myth vs Reality',
      owner: 'Dan',
      status: 'Active',
      targetPlatforms: ['Instagram', 'LinkedIn'],
      targetEpisodeCount: 4,
      reviewCheckpoint: 2,
      linkedEntryIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const entries: Entry[] = [
      {
        id: 'entry-1',
        date: '2026-02-01',
        status: 'Approved',
        workflowStatus: 'Approved',
        caption: 'Episode one',
        platforms: ['Instagram'],
        assetType: 'Video',
        seriesName: 'Myth vs Reality',
        episodeNumber: 1,
      } as Entry,
      {
        id: 'entry-2',
        date: '2026-02-08',
        status: 'Published',
        workflowStatus: 'Published',
        caption: 'Episode two',
        platforms: ['LinkedIn'],
        assetType: 'Video',
        seriesName: 'Myth vs Reality',
        episodeNumber: 2,
      } as Entry,
    ];

    const snapshot = buildContentSeriesSnapshot(series, entries);
    expect(snapshot.linkedEntries).toHaveLength(2);
    expect(snapshot.latestEpisodeNumber).toBe(2);
    expect(snapshot.reviewDue).toBe(true);
    expect(snapshot.platformCoveragePercent).toBe(100);
  });
});
