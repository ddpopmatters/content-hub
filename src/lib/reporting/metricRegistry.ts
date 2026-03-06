import { ALL_PLATFORMS, CONTENT_PILLARS } from '../../constants';
import type { ReportCadence } from '../../types/models';

export type ReportMetricGroup = 'tier1' | 'tier2' | 'tier3';
export type ReportMetricInputType = 'number' | 'percent' | 'text';
export type ReportMetricSourceType = 'auto' | 'manual' | 'aggregated';
export type ReportMetricAggregation = 'sum' | 'average' | 'latest';

export interface ReportMetricDefinition {
  id: string;
  label: string;
  description: string;
  cadence: ReportCadence[];
  group: ReportMetricGroup;
  unit: string;
  inputType: ReportMetricInputType;
  sourceType: ReportMetricSourceType;
  required: boolean;
  leadership: boolean;
  aggregation: ReportMetricAggregation;
}

export const REPORT_METRIC_REGISTRY: ReportMetricDefinition[] = [
  {
    id: 'nativeShares',
    label: 'Native shares',
    description: 'Combined reposts and shares captured on platform posts.',
    cadence: ['Weekly', 'Monthly', 'Quarterly', 'Annual'],
    group: 'tier1',
    unit: 'count',
    inputType: 'number',
    sourceType: 'auto',
    required: true,
    leadership: true,
    aggregation: 'sum',
  },
  {
    id: 'privateSends',
    label: 'Private sends',
    description: 'Private shares or sends where the platform exposes them.',
    cadence: ['Weekly', 'Monthly', 'Quarterly', 'Annual'],
    group: 'tier1',
    unit: 'count',
    inputType: 'number',
    sourceType: 'auto',
    required: true,
    leadership: true,
    aggregation: 'sum',
  },
  {
    id: 'engagementRate',
    label: 'Engagement rate',
    description: 'Engagements divided by reach, expressed as a percentage.',
    cadence: ['Weekly', 'Monthly', 'Quarterly', 'Annual'],
    group: 'tier1',
    unit: '%',
    inputType: 'percent',
    sourceType: 'auto',
    required: true,
    leadership: true,
    aggregation: 'average',
  },
  {
    id: 'employeeAdvocacyReach',
    label: 'Employee advocacy reach',
    description: 'Reach generated through staff amplification and advocacy.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier1',
    unit: 'count',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: true,
    aggregation: 'sum',
  },
  {
    id: 'audienceQualityScore',
    label: 'Audience quality score',
    description: 'Periodic health score for target audience fit and quality.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier1',
    unit: 'score',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: true,
    aggregation: 'average',
  },
  {
    id: 'engagementQuality',
    label: 'Engagement quality',
    description: 'Weighted score for comments, saves, shares, and meaningful interactions.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'score',
    inputType: 'number',
    sourceType: 'auto',
    required: true,
    leadership: false,
    aggregation: 'average',
  },
  {
    id: 'sentimentScore',
    label: 'Sentiment score',
    description: 'Manual summary score for audience sentiment over the period.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'score',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'average',
  },
  {
    id: 'saves',
    label: 'Saves',
    description: 'Total saves/bookmarks across supported platforms.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'count',
    inputType: 'number',
    sourceType: 'auto',
    required: true,
    leadership: false,
    aggregation: 'sum',
  },
  {
    id: 'completionRate',
    label: 'Completion rate',
    description: 'Video completion rate or equivalent watch-through metric.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: '%',
    inputType: 'percent',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'average',
  },
  {
    id: 'quotePosts',
    label: 'Quote posts',
    description: 'Count of quote-post or repost-with-comment executions.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'count',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'sum',
  },
  {
    id: 'websiteTrafficFromSocial',
    label: 'Website traffic from social',
    description: 'Sessions or visits attributed to social traffic.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'count',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'sum',
  },
  {
    id: 'emailSignUps',
    label: 'Email sign-ups',
    description: 'New email subscribers attributed to social activity.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'count',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'sum',
  },
  {
    id: 'donationPageVisits',
    label: 'Donation page visits',
    description: 'Visits to donation pages from social channels.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'count',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'sum',
  },
  {
    id: 'ctr',
    label: 'CTR',
    description: 'Click-through rate using tracked clicks and impressions.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: '%',
    inputType: 'percent',
    sourceType: 'auto',
    required: true,
    leadership: false,
    aggregation: 'average',
  },
  {
    id: 'advocacyActionCompletions',
    label: 'Advocacy action completions',
    description: 'Actions taken via petitions, emails, or campaign tools.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'count',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'sum',
  },
  {
    id: 'followerGrowth',
    label: 'Follower growth',
    description: 'Net audience growth over the reporting period.',
    cadence: ['Quarterly', 'Annual'],
    group: 'tier3',
    unit: 'count',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'sum',
  },
  {
    id: 'reachGrowth',
    label: 'Reach growth',
    description: 'Growth in reach versus the prior comparable period.',
    cadence: ['Quarterly', 'Annual'],
    group: 'tier3',
    unit: '%',
    inputType: 'percent',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'average',
  },
  {
    id: 'postingConsistency',
    label: 'Posting consistency',
    description: 'How consistently the team hit planned publishing cadence.',
    cadence: ['Quarterly', 'Annual'],
    group: 'tier3',
    unit: '%',
    inputType: 'percent',
    sourceType: 'auto',
    required: true,
    leadership: false,
    aggregation: 'average',
  },
  {
    id: 'responseTimeHours',
    label: 'Average response time',
    description: 'Average time to respond to comments or DMs.',
    cadence: ['Quarterly', 'Annual'],
    group: 'tier3',
    unit: 'hours',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'average',
  },
];

export const REPORT_QUALITATIVE_FIELDS: Record<
  ReportCadence,
  { id: string; label: string; description: string }[]
> = {
  Weekly: [
    { id: 'wins', label: 'Wins this week', description: 'Short summary of wins or positive movement.' },
    { id: 'risks', label: 'Risks this week', description: 'Known issues or attention points.' },
    { id: 'nextActions', label: 'Next actions', description: 'Immediate next steps for the team.' },
  ],
  Monthly: [
    { id: 'executiveSummary', label: 'Executive summary', description: 'Monthly summary for leadership.' },
    { id: 'notableMoments', label: 'Notable moments', description: 'Campaign moments, spikes, or lessons.' },
    { id: 'wins', label: 'Top wins', description: 'What worked best this month.' },
    { id: 'risks', label: 'Watchouts', description: 'Performance or delivery concerns.' },
    { id: 'nextActions', label: 'Next actions', description: 'Actions for the upcoming month.' },
    { id: 'audienceQualityNotes', label: 'Audience quality notes', description: 'Audience fit and quality observations.' },
    { id: 'sentimentSummary', label: 'Sentiment summary', description: 'Tone and sentiment overview.' },
    { id: 'topContentNotes', label: 'Top content notes', description: 'Context on the strongest posts.' },
    { id: 'bottomContentNotes', label: 'Bottom content notes', description: 'Context on underperforming posts.' },
    { id: 'contentPillarNotes', label: 'Content pillar review', description: 'How pillar mix supported strategy.' },
    { id: 'audienceSegmentNotes', label: 'Audience segment review', description: 'How well posts served target segments.' },
  ],
  Quarterly: [
    { id: 'executiveSummary', label: 'Quarterly summary', description: 'Quarterly strategic overview.' },
    { id: 'notableMoments', label: 'Quarterly notable moments', description: 'Events, peaks, and important shifts.' },
    { id: 'wins', label: 'Quarterly wins', description: 'What created the strongest result.' },
    { id: 'risks', label: 'Quarterly risks', description: 'Risks or weak spots in the quarter.' },
    { id: 'nextActions', label: 'Strategic next actions', description: 'Actions for the next quarter.' },
    { id: 'audienceQualityNotes', label: 'Audience quality notes', description: 'Audience fit observations and account quality.' },
    { id: 'sentimentSummary', label: 'Sentiment summary', description: 'Quarter-level audience sentiment.' },
    { id: 'platformHealthCommentary', label: 'Platform health commentary', description: 'Platform-by-platform health summary.' },
    { id: 'quarterlyAuditNotes', label: '50-account audience audit', description: 'Quarterly quality audit notes.' },
    { id: 'contentPillarNotes', label: 'Content pillar review', description: 'How pillar mix supported strategy.' },
    { id: 'audienceSegmentNotes', label: 'Audience segment review', description: 'How well posts served target segments.' },
    { id: 'advocacyCommentary', label: 'Advocacy commentary', description: 'Interpretation of advocacy and action data.' },
  ],
  Annual: [
    { id: 'executiveSummary', label: 'Annual summary', description: 'Annual leadership-ready overview.' },
    { id: 'wins', label: 'Annual wins', description: 'Major wins across the year.' },
    { id: 'risks', label: 'Annual risks', description: 'Structural or strategic risks.' },
    { id: 'nextActions', label: 'Next-year priorities', description: 'Priorities for the next reporting cycle.' },
    { id: 'annualReflection', label: 'Annual reflection', description: 'Overall reflection on the year.' },
    { id: 'platformHealthCommentary', label: 'Platform health commentary', description: 'Year-end platform health summary.' },
    { id: 'contentPillarNotes', label: 'Content pillar review', description: 'How pillar mix evolved over the year.' },
    { id: 'audienceSegmentNotes', label: 'Audience segment review', description: 'How audience targeting evolved over the year.' },
  ],
};

export const getMetricDefinitionsForCadence = (cadence: ReportCadence): ReportMetricDefinition[] =>
  REPORT_METRIC_REGISTRY.filter((metric) => metric.cadence.includes(cadence));

export const getMetricDefinitionsForGroup = (
  cadence: ReportCadence,
  group: ReportMetricGroup,
): ReportMetricDefinition[] =>
  getMetricDefinitionsForCadence(cadence).filter((metric) => metric.group === group);

export const getMetricDefinition = (metricId: string): ReportMetricDefinition | undefined =>
  REPORT_METRIC_REGISTRY.find((metric) => metric.id === metricId);

export const REPORT_PLATFORM_SUMMARY_KEYS = ['posts', 'reach', 'impressions', 'engagements'] as const;

export const REPORT_DERIVED_TOTAL_KEYS = [
  'totalPosts',
  'totalPublishedPosts',
  'totalReach',
  'totalImpressions',
  'totalEngagements',
  'coverageScore',
] as const;

export const REPORT_PLATFORM_LIST = [...ALL_PLATFORMS];
export const REPORT_CONTENT_PILLAR_LIST = [...CONTENT_PILLARS];
