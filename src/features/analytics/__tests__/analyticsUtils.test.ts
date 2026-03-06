import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entry } from '../../../types/models';
import { buildInsightsSnapshot, getInsightFilterOptions } from '../analyticsUtils';

const createEntry = (overrides: Partial<Entry>): Entry => ({
  id: overrides.id || 'entry-1',
  date: overrides.date || '2026-03-05',
  platforms: overrides.platforms || ['Instagram'],
  assetType: overrides.assetType || 'Design',
  caption: overrides.caption || 'Example post',
  platformCaptions: overrides.platformCaptions || {},
  firstComment: overrides.firstComment || '',
  status: overrides.status || 'Approved',
  priorityTier: overrides.priorityTier || 'Medium',
  approvers: overrides.approvers || [],
  author: overrides.author || 'Dan',
  campaign: overrides.campaign || 'Campaign',
  contentPillar: overrides.contentPillar || 'Social Justice',
  previewUrl: overrides.previewUrl || '',
  checklist: overrides.checklist || {},
  analytics: overrides.analytics || {},
  workflowStatus: overrides.workflowStatus || 'Published',
  statusDetail: overrides.statusDetail || '',
  aiFlags: overrides.aiFlags || [],
  aiScore: overrides.aiScore || {},
  testingFrameworkId: overrides.testingFrameworkId || '',
  testingFrameworkName: overrides.testingFrameworkName || '',
  createdAt: overrides.createdAt || '2026-03-01T09:00:00.000Z',
  updatedAt: overrides.updatedAt || '2026-03-01T09:00:00.000Z',
  approvedAt: overrides.approvedAt || null,
  deletedAt: overrides.deletedAt || null,
  evergreen: overrides.evergreen,
  publishStatus: overrides.publishStatus,
  publishedAt: overrides.publishedAt,
  variantOfId: overrides.variantOfId,
  variantIds: overrides.variantIds,
  relatedEntryIds: overrides.relatedEntryIds,
  audienceSegments: overrides.audienceSegments || [],
  goldenThreadPass: overrides.goldenThreadPass ?? null,
  assessmentScores: overrides.assessmentScores ?? null,
  influencerId: overrides.influencerId,
  url: overrides.url,
  script: overrides.script,
  designCopy: overrides.designCopy,
  carouselSlides: overrides.carouselSlides,
  approvalDeadline: overrides.approvalDeadline,
  analyticsUpdatedAt: overrides.analyticsUpdatedAt,
  comments: overrides.comments,
  links: overrides.links,
  attachments: overrides.attachments,
});

describe('analyticsUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T09:00:00.000Z'));
  });

  it('builds a scoped snapshot across timeframe, platform, and pillar filters', () => {
    const entries = [
      createEntry({
        id: 'instagram-post',
        date: '2026-03-05',
        platforms: ['Instagram'],
        assetType: 'Video',
        contentPillar: 'Social Justice',
        analytics: {
          Instagram: { impressions: 100, reach: 80, likes: 10, comments: 2, shares: 1, clicks: 4 },
        },
        audienceSegments: ['Supporters'],
      }),
      createEntry({
        id: 'linkedin-post',
        date: '2026-03-12',
        platforms: ['LinkedIn'],
        assetType: 'Design',
        contentPillar: 'Population & Demographics',
        analytics: {
          LinkedIn: { impressions: 200, likes: 5, comments: 1, clicks: 20 },
        },
        audienceSegments: ['Partners'],
      }),
      createEntry({
        id: 'february-post',
        date: '2026-02-10',
        platforms: ['Instagram'],
        assetType: 'Carousel',
        contentPillar: 'Social Justice',
        analytics: {
          Instagram: { impressions: 500, reach: 400, likes: 20, comments: 4, shares: 3 },
        },
        audienceSegments: ['Supporters'],
      }),
    ];

    const snapshot = buildInsightsSnapshot(
      entries,
      {
        timePeriod: 'this-month',
        customStartDate: '',
        customEndDate: '',
        platforms: ['Instagram'],
        metric: 'impressions',
        campaigns: [],
        contentPillars: ['Social Justice'],
        assetTypes: [],
        statuses: ['Approved', 'Published'],
        authors: [],
        audienceSegments: [],
      },
      new Date('2026-03-20T09:00:00.000Z'),
    );

    expect(snapshot.totalPosts).toBe(1);
    expect(snapshot.totalMetricValue).toBe(100);
    expect(snapshot.postsWithSelectedMetric).toBe(1);
    expect(snapshot.breakdowns.platforms[0]?.label).toBe('Instagram');
    expect(snapshot.breakdowns.contentPillars[0]?.label).toBe('Social Justice');
    expect(snapshot.topPerformers[0]?.entry.id).toBe('instagram-post');
  });

  it('calculates engagement rate using each post reach or impression denominator', () => {
    const entries = [
      createEntry({
        id: 'has-reach',
        analytics: {
          Instagram: { reach: 100, likes: 10, comments: 5, shares: 5 },
        },
      }),
      createEntry({
        id: 'impressions-only',
        analytics: {
          LinkedIn: { impressions: 200, likes: 20, comments: 0, shares: 0 },
        },
        platforms: ['LinkedIn'],
      }),
    ];

    const snapshot = buildInsightsSnapshot(
      entries,
      {
        timePeriod: 'this-month',
        customStartDate: '',
        customEndDate: '',
        platforms: [],
        metric: 'engagementRate',
        campaigns: [],
        contentPillars: [],
        assetTypes: [],
        statuses: ['Approved', 'Published'],
        authors: [],
        audienceSegments: [],
      },
      new Date('2026-03-20T09:00:00.000Z'),
    );

    expect(snapshot.totalMetricValue).toBeCloseTo(((20 + 20) / (100 + 200)) * 100, 4);
  });

  it('exposes dynamic insight filter options from the entry set', () => {
    const entries = [
      createEntry({
        author: 'Dan',
        campaign: 'Awareness Day',
        contentPillar: 'Environmental Sustainability',
        assetType: 'Carousel',
        analytics: {
          Instagram: { impressions: 100, clicks: 3, saves: 2 },
        },
        audienceSegments: ['Donors', 'Supporters'],
      }),
    ];

    const options = getInsightFilterOptions(entries);

    expect(options.platforms).toContain('Instagram');
    expect(options.metrics.some((metric) => metric.value === 'clicks')).toBe(true);
    expect(options.campaigns).toContain('Awareness Day');
    expect(options.contentPillars).toContain('Environmental Sustainability');
    expect(options.assetTypes).toContain('Carousel');
    expect(options.authors).toContain('Dan');
    expect(options.audienceSegments).toEqual(['Donors', 'Supporters']);
  });
});
