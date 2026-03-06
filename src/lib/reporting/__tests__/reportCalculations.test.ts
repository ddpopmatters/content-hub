import { describe, expect, it } from 'vitest';
import { hydrateReportingPeriod, createReportingPeriod } from '../reportCalculations';
import type { Entry, ReportingPeriod } from '../../../types/models';

const buildEntry = (overrides: Partial<Entry> = {}): Entry => ({
  id: overrides.id || 'entry-1',
  date: overrides.date || '2026-03-10',
  platforms: overrides.platforms || ['Instagram'],
  assetType: overrides.assetType || 'Design',
  caption: overrides.caption || 'Example caption',
  platformCaptions: overrides.platformCaptions || {},
  firstComment: overrides.firstComment || '',
  status: overrides.status || 'Published',
  priorityTier: overrides.priorityTier || 'Medium',
  approvers: overrides.approvers || [],
  author: overrides.author || 'Dan',
  campaign: overrides.campaign || 'Evergreen',
  contentPillar: overrides.contentPillar || 'Population & Demographics',
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
  evergreen: overrides.evergreen || false,
  publishStatus: overrides.publishStatus,
  publishedAt: overrides.publishedAt || null,
  variantOfId: overrides.variantOfId,
  variantIds: overrides.variantIds,
  relatedEntryIds: overrides.relatedEntryIds,
  audienceSegments: overrides.audienceSegments || ['Supporters'],
  goldenThreadPass: overrides.goldenThreadPass ?? null,
  assessmentScores: overrides.assessmentScores || null,
  influencerId: overrides.influencerId,
  url: overrides.url,
  script: overrides.script,
  designCopy: overrides.designCopy,
  carouselSlides: overrides.carouselSlides || [],
  approvalDeadline: overrides.approvalDeadline,
  analyticsUpdatedAt: overrides.analyticsUpdatedAt,
  comments: overrides.comments,
  links: overrides.links,
  attachments: overrides.attachments,
});

describe('reportCalculations', () => {
  it('hydrates monthly metrics from entry analytics and builds performer tables', () => {
    const report = {
      ...createReportingPeriod('Monthly', 'Dan', new Date('2026-03-15')),
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    };

    const entries = [
      buildEntry({
        id: 'entry-a',
        caption: 'High performing post',
        analytics: {
          Instagram: {
            reach: 1000,
            impressions: 1500,
            likes: 120,
            comments: 20,
            shares: 15,
            saves: 10,
            clicks: 25,
            sends: 4,
          },
        },
      }),
      buildEntry({
        id: 'entry-b',
        caption: 'Lower performing post',
        date: '2026-03-11',
        contentPillar: 'Social Justice',
        audienceSegments: ['Members'],
        analytics: {
          LinkedIn: {
            reach: 500,
            impressions: 900,
            likes: 30,
            comments: 4,
            shares: 2,
            clicks: 10,
          },
        },
      }),
    ];

    const hydrated = hydrateReportingPeriod(report, entries, []);

    expect(hydrated.metrics.tier1.nativeShares.value).toBe(17);
    expect(hydrated.metrics.tier1.privateSends.value).toBe(4);
    expect(hydrated.metrics.tier2.saves.value).toBe(10);
    expect(hydrated.metrics.derivedTotals.totalPosts.value).toBe(2);
    expect(hydrated.metrics.derivedTotals.totalReach.value).toBe(1500);
    expect(hydrated.qualitative.topPerformers[0]?.entryId).toBe('entry-a');
    expect(hydrated.metrics.contentPillars['Social Justice'].value).toBe(1);
    expect(hydrated.metrics.audienceSegments.Members.value).toBe(1);
  });

  it('aggregates quarterly metrics from saved monthly reports when available', () => {
    const january = createReportingPeriod('Monthly', 'Dan', new Date('2026-01-10'));
    january.startDate = '2026-01-01';
    january.endDate = '2026-01-31';
    january.metrics.tier1.engagementRate.value = 10;
    january.metrics.tier2.emailSignUps.value = 20;

    const february = createReportingPeriod('Monthly', 'Dan', new Date('2026-02-10'));
    february.startDate = '2026-02-01';
    february.endDate = '2026-02-28';
    february.metrics.tier1.engagementRate.value = 20;
    february.metrics.tier2.emailSignUps.value = 30;

    const march = createReportingPeriod('Monthly', 'Dan', new Date('2026-03-10'));
    march.startDate = '2026-03-01';
    march.endDate = '2026-03-31';
    march.metrics.tier1.engagementRate.value = 30;
    march.metrics.tier2.emailSignUps.value = 40;

    const quarter: ReportingPeriod = {
      ...createReportingPeriod('Quarterly', 'Dan', new Date('2026-03-31')),
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    };

    const hydrated = hydrateReportingPeriod(quarter, [], [january, february, march]);

    expect(hydrated.metrics.tier1.engagementRate.value).toBe(20);
    expect(hydrated.metrics.tier1.engagementRate.source).toBe('aggregated');
    expect(hydrated.metrics.tier2.emailSignUps.value).toBe(90);
    expect(hydrated.metrics.tier2.emailSignUps.source).toBe('aggregated');
  });
});
