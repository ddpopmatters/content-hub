import { ALL_PLATFORMS } from '../constants';
import type { ContentSeries, Entry } from '../types/models';
import { uuid } from './utils';

const nowIso = () => new Date().toISOString();

export const createDefaultContentSeries = (owner = ''): ContentSeries[] => {
  const series: Array<Omit<ContentSeries, 'id' | 'createdAt' | 'updatedAt'>> = [
    {
      title: 'Myth vs Reality',
      owner,
      status: 'Active',
      targetPlatforms: ['Instagram', 'LinkedIn'],
      targetEpisodeCount: 12,
      reviewCheckpoint: 8,
      contentPillar: 'Population & Demographics',
      responseMode: 'Pre-bunk',
      linkedEntryIds: [],
      description: 'Recurring myth-busting format for panic narratives and misinformation.',
      notes: '',
    },
    {
      title: 'Data in Focus',
      owner,
      status: 'Active',
      targetPlatforms: ['Instagram', 'LinkedIn', 'YouTube'],
      targetEpisodeCount: 10,
      reviewCheckpoint: 8,
      campaign: 'Research Launch',
      contentPillar: 'Population & Demographics',
      responseMode: 'Planned',
      linkedEntryIds: [],
      description: 'Evidence-led recurring format translating research into short explainers.',
      notes: '',
    },
    {
      title: 'Partner Voices',
      owner,
      status: 'Active',
      targetPlatforms: ['Instagram', 'LinkedIn'],
      targetEpisodeCount: 6,
      reviewCheckpoint: 6,
      contentPillar: 'Social Justice',
      responseMode: 'Planned',
      linkedEntryIds: [],
      description:
        'Partner and people stories adapted into a repeatable interview/testimonial format.',
      notes: '',
    },
  ];

  return series.map((item) => ({
    ...item,
    id: uuid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));
};

export const sortContentSeries = (series: ContentSeries[]) =>
  series.slice().sort((a, b) => a.title.localeCompare(b.title));

export interface ContentSeriesSnapshot {
  linkedEntries: Entry[];
  publishedEntries: Entry[];
  latestEpisodeNumber: number | null;
  progressPercent: number;
  platformCoveragePercent: number;
  reviewDue: boolean;
}

const matchesSeries = (entry: Entry, series: ContentSeries) =>
  series.linkedEntryIds.includes(entry.id) ||
  (entry.seriesName || '').trim().toLowerCase() === series.title.trim().toLowerCase();

export const buildContentSeriesSnapshot = (
  series: ContentSeries,
  entries: Entry[],
): ContentSeriesSnapshot => {
  const linkedEntries = entries.filter((entry) => !entry.deletedAt && matchesSeries(entry, series));
  const publishedEntries = linkedEntries.filter(
    (entry) =>
      entry.workflowStatus === 'Published' ||
      entry.status === 'Published' ||
      entry.workflowStatus === 'Approved' ||
      entry.status === 'Approved',
  );
  const latestEpisodeNumber = linkedEntries.reduce<number | null>((latest, entry) => {
    if (typeof entry.episodeNumber !== 'number') return latest;
    if (latest === null) return entry.episodeNumber;
    return Math.max(latest, entry.episodeNumber);
  }, null);
  const coveredPlatforms = new Set(linkedEntries.flatMap((entry) => entry.platforms || []));
  const targetPlatforms = series.targetPlatforms.filter((platform) =>
    ALL_PLATFORMS.includes(platform as never),
  );
  const platformCoveragePercent = targetPlatforms.length
    ? Math.round(
        (targetPlatforms.filter((platform) => coveredPlatforms.has(platform)).length /
          targetPlatforms.length) *
          100,
      )
    : linkedEntries.length
      ? 100
      : 0;
  const progressPercent = series.targetEpisodeCount
    ? Math.min(Math.round((linkedEntries.length / series.targetEpisodeCount) * 100), 100)
    : Math.min(linkedEntries.length * 20, 100);
  const reviewDue = linkedEntries.length >= series.reviewCheckpoint;

  return {
    linkedEntries,
    publishedEntries,
    latestEpisodeNumber,
    progressPercent,
    platformCoveragePercent,
    reviewDue,
  };
};
