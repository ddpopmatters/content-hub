import { ALL_PLATFORMS } from '../constants';
import type { ContentPeak, Entry } from '../types/models';
import { uuid } from './utils';

const todayIso = () => new Date().toISOString();

export const createDefaultContentPeaks = (owner = ''): ContentPeak[] => {
  const year = new Date().getFullYear();
  const peaks: Array<
    Omit<ContentPeak, 'id' | 'createdAt' | 'updatedAt' | 'linkedEntryIds'> & {
      linkedEntryIds?: string[];
    }
  > = [
    {
      title: 'International Women’s Day',
      startDate: `${year}-03-01`,
      endDate: `${year}-03-10`,
      priorityTier: 'High',
      owner,
      contentPillar: 'Reproductive Rights & Bodily Autonomy',
      campaign: 'Awareness Day',
      responseMode: 'Planned',
      requiredPlatforms: ['Instagram', 'LinkedIn'],
      requiredAssetTypes: ['Video', 'Design'],
      description: 'Signature moment for gender equity and bodily autonomy content.',
      notes: '',
    },
    {
      title: 'World Population Day',
      startDate: `${year}-07-01`,
      endDate: `${year}-07-14`,
      priorityTier: 'Urgent',
      owner,
      contentPillar: 'Population & Demographics',
      campaign: 'Awareness Day',
      responseMode: 'Planned',
      requiredPlatforms: ['Instagram', 'LinkedIn', 'YouTube'],
      requiredAssetTypes: ['Video', 'Carousel'],
      description: 'Flagship moment for Population Matters narrative and evidence content.',
      notes: '',
    },
    {
      title: 'COP moment',
      startDate: `${year}-11-01`,
      endDate: `${year}-11-21`,
      priorityTier: 'High',
      owner,
      contentPillar: 'Environmental Sustainability',
      campaign: 'Event',
      responseMode: 'Reactive',
      requiredPlatforms: ['Instagram', 'LinkedIn', 'BlueSky'],
      requiredAssetTypes: ['Design', 'Carousel'],
      description: 'Climate-linked narrative window requiring reactive and pre-bunk assets.',
      notes: '',
    },
  ];

  return peaks.map((peak) => ({
    ...peak,
    id: uuid(),
    linkedEntryIds: peak.linkedEntryIds || [],
    createdAt: todayIso(),
    updatedAt: todayIso(),
  }));
};

export const sortContentPeaks = (peaks: ContentPeak[]) =>
  peaks.slice().sort((a, b) => a.startDate.localeCompare(b.startDate));

export interface ContentPeakSnapshot {
  linkedEntries: Entry[];
  approvedEntries: Entry[];
  requiredPlatformCoverage: number;
  requiredAssetCoverage: number;
  readinessScore: number;
  state: 'Upcoming' | 'Live' | 'Past';
}

const matchesPeak = (entry: Entry, peak: ContentPeak) =>
  peak.linkedEntryIds.includes(entry.id) ||
  (entry.contentPeak || '').trim().toLowerCase() === peak.title.trim().toLowerCase();

export const buildContentPeakSnapshot = (
  peak: ContentPeak,
  entries: Entry[],
  now = new Date(),
): ContentPeakSnapshot => {
  const linkedEntries = entries.filter((entry) => !entry.deletedAt && matchesPeak(entry, peak));
  const approvedEntries = linkedEntries.filter(
    (entry) =>
      entry.workflowStatus === 'Approved' ||
      entry.workflowStatus === 'Published' ||
      entry.status === 'Approved' ||
      entry.status === 'Published',
  );
  const coveredPlatforms = new Set(linkedEntries.flatMap((entry) => entry.platforms || []));
  const coveredAssets = new Set(linkedEntries.map((entry) => entry.assetType).filter(Boolean));
  const requiredPlatforms = peak.requiredPlatforms.filter((platform) =>
    ALL_PLATFORMS.includes(platform as never),
  );
  const requiredAssets = peak.requiredAssetTypes.filter(Boolean);
  const requiredPlatformCoverage = requiredPlatforms.length
    ? (requiredPlatforms.filter((platform) => coveredPlatforms.has(platform)).length /
        requiredPlatforms.length) *
      100
    : linkedEntries.length
      ? 100
      : 0;
  const requiredAssetCoverage = requiredAssets.length
    ? (requiredAssets.filter((asset) => coveredAssets.has(asset)).length / requiredAssets.length) *
      100
    : linkedEntries.length
      ? 100
      : 0;
  const linkedEntryScore = linkedEntries.length ? Math.min(linkedEntries.length / 3, 1) * 100 : 0;
  const approvalScore = linkedEntries.length
    ? (approvedEntries.length / linkedEntries.length) * 100
    : 0;
  const readinessScore = Math.round(
    linkedEntryScore * 0.25 +
      approvalScore * 0.35 +
      requiredPlatformCoverage * 0.2 +
      requiredAssetCoverage * 0.2,
  );

  const start = new Date(peak.startDate);
  const end = new Date(peak.endDate);
  let state: ContentPeakSnapshot['state'] = 'Upcoming';
  if (now > end) state = 'Past';
  else if (now >= start && now <= end) state = 'Live';

  return {
    linkedEntries,
    approvedEntries,
    requiredPlatformCoverage,
    requiredAssetCoverage,
    readinessScore,
    state,
  };
};
