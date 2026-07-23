export const REPORTING_PLATFORMS = [
  'Facebook',
  'Instagram',
  'LinkedIn',
  'YouTube',
  'BlueSky',
] as const;

export type ReportingPlatform = (typeof REPORTING_PLATFORMS)[number];

export const REPORTING_METRICS = [
  'impressions',
  'reach',
  'views',
  'engagements',
  'clicks',
  'likes',
  'comments',
  'shares',
  'saves',
  'watchTime',
  'subscribersGained',
  'quotePosts',
] as const;

type ReportingMetric = (typeof REPORTING_METRICS)[number];

export interface ReportingEntryRow {
  id?: unknown;
  date?: unknown;
  platforms?: unknown;
  analytics?: unknown;
  status?: unknown;
  workflow_status?: unknown;
  caption?: unknown;
  content_pillar?: unknown;
  campaign?: unknown;
  url?: unknown;
  published_at?: unknown;
  updated_at?: unknown;
}

const METRIC_ALIASES: Record<string, ReportingMetric> = {
  impression: 'impressions',
  impressions: 'impressions',
  postimpressions: 'impressions',
  organicimpressions: 'impressions',
  reach: 'reach',
  postreach: 'reach',
  organicreach: 'reach',
  accountsreached: 'reach',
  views: 'views',
  postviews: 'views',
  videoviews: 'views',
  engagements: 'engagements',
  postengagements: 'engagements',
  totalengagements: 'engagements',
  clicks: 'clicks',
  linkclicks: 'clicks',
  clickslink: 'clicks',
  postclicks: 'clicks',
  likes: 'likes',
  reactions: 'likes',
  likesreactions: 'likes',
  comments: 'comments',
  replies: 'comments',
  shares: 'shares',
  reposts: 'shares',
  repostsshares: 'shares',
  saves: 'saves',
  watchtime: 'watchTime',
  watchtimemins: 'watchTime',
  watchtimeminutes: 'watchTime',
  subscribersgained: 'subscribersGained',
  newsubscribers: 'subscribersGained',
  quoteposts: 'quotePosts',
  quotes: 'quotePosts',
};

const normaliseText = (value: unknown, limit = 180): string => {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 3).trimEnd()}...`;
};

const finiteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replaceAll(',', '').replace(/%$/, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const normaliseStats = (entry: ReportingEntryRow, platform: ReportingPlatform) => {
  if (!entry.analytics || typeof entry.analytics !== 'object' || Array.isArray(entry.analytics)) {
    return {} as Partial<Record<ReportingMetric, number>>;
  }
  const raw = (entry.analytics as Record<string, unknown>)[platform];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {} as Partial<Record<ReportingMetric, number>>;
  }
  const stats: Partial<Record<ReportingMetric, number>> = {};
  for (const [key, value] of Object.entries(raw)) {
    const canonical = METRIC_ALIASES[key.toLowerCase().replace(/[^a-z0-9]/g, '')];
    const number = finiteNumber(value);
    if (canonical && number !== null) stats[canonical] = number;
  }
  return stats;
};

const isPublished = (entry: ReportingEntryRow): boolean =>
  typeof entry.published_at === 'string' ||
  entry.status === 'Published' ||
  entry.workflow_status === 'Published';

const entryPlatforms = (entry: ReportingEntryRow): string[] =>
  Array.isArray(entry.platforms)
    ? entry.platforms.filter((platform): platform is string => typeof platform === 'string')
    : [];

const metricTotal = (
  statsRows: Partial<Record<ReportingMetric, number>>[],
  metric: ReportingMetric,
): number | null => {
  const measured = statsRows
    .map((stats) => stats[metric])
    .filter((value): value is number => typeof value === 'number');
  return measured.length ? measured.reduce((total, value) => total + value, 0) : null;
};

export interface ReportingSnapshotOptions {
  startDate: string;
  endDate: string;
  platform?: ReportingPlatform;
  campaign?: string;
  contentPillar?: string;
  assetType?: string;
  truncated?: boolean;
}

export function buildReportingSnapshot(
  entries: ReportingEntryRow[],
  options: ReportingSnapshotOptions,
): Record<string, unknown> {
  const selectedPlatforms = options.platform ? [options.platform] : [...REPORTING_PLATFORMS];
  const snapshots: Record<string, unknown> = {};

  for (const platform of selectedPlatforms) {
    const candidates = entries
      .filter((entry) => entryPlatforms(entry).includes(platform))
      .map((entry) => ({ entry, stats: normaliseStats(entry, platform) }))
      .filter(({ entry, stats }) => isPublished(entry) || Object.keys(stats).length > 0);
    const measured = candidates.filter(({ stats }) => Object.keys(stats).length > 0);
    const statsRows = measured.map(({ stats }) => stats);
    const totals = Object.fromEntries(
      REPORTING_METRICS.map((metric) => [metric, metricTotal(statsRows, metric)]),
    );
    const engagementComponents = ['likes', 'comments', 'shares', 'saves']
      .map((key) => totals[key])
      .filter((value): value is number => typeof value === 'number');
    const componentEngagements = engagementComponents.reduce((total, value) => total + value, 0);
    const totalEngagements =
      totals.engagements ?? (engagementComponents.length ? componentEngagements : null);
    const denominator = totals.reach ?? totals.impressions;
    const topPosts = measured
      .map(({ entry, stats }) => {
        const components = [stats.likes, stats.comments, stats.shares, stats.saves].filter(
          (value): value is number => typeof value === 'number',
        );
        return {
          entryId: String(entry.id ?? ''),
          date: typeof entry.date === 'string' ? entry.date : null,
          caption: normaliseText(entry.caption),
          campaign: normaliseText(entry.campaign, 100) || null,
          contentPillar: normaliseText(entry.content_pillar, 100) || null,
          url: typeof entry.url === 'string' ? entry.url : null,
          engagementScore:
            stats.engagements ??
            (components.length ? components.reduce((total, value) => total + value, 0) : null),
          reach: stats.reach ?? null,
          impressions: stats.impressions ?? null,
          views: stats.views ?? null,
        };
      })
      .sort(
        (left, right) =>
          (right.engagementScore ?? -1) - (left.engagementScore ?? -1) ||
          (right.reach ?? 0) - (left.reach ?? 0) ||
          (right.impressions ?? 0) - (left.impressions ?? 0),
      )
      .slice(0, 5);

    snapshots[platform] = {
      postsInWindow: candidates.length,
      postsWithAnalytics: measured.length,
      analyticsCoveragePercent: candidates.length
        ? Number(((measured.length / candidates.length) * 100).toFixed(2))
        : null,
      dataStatus: measured.length
        ? 'available'
        : candidates.length
          ? 'missing_metrics'
          : 'no_recent_posts',
      totals,
      derivedMetrics: {
        totalEngagements,
        engagementRatePercent:
          totalEngagements !== null && denominator
            ? Number(((totalEngagements / denominator) * 100).toFixed(2))
            : null,
        clickThroughRatePercent:
          totals.clicks !== null && totals.impressions
            ? Number(((totals.clicks / totals.impressions) * 100).toFixed(2))
            : null,
      },
      topPosts,
    };
  }

  return {
    source: 'content_hub_entries',
    startDate: options.startDate,
    endDate: options.endDate,
    filters: {
      platform: options.platform ?? null,
      campaign: options.campaign ?? null,
      contentPillar: options.contentPillar ?? null,
      assetType: options.assetType ?? null,
    },
    truncated: Boolean(options.truncated),
    snapshots,
  };
}

const reportMetrics = (report: Record<string, unknown>): Record<string, Record<string, number>> => {
  const raw = report.platformMetrics ?? report.platform_metrics;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).map(([platform, values]) => [
      platform,
      values && typeof values === 'object' && !Array.isArray(values)
        ? Object.fromEntries(
            Object.entries(values)
              .map(([key, value]) => [key, finiteNumber(value)])
              .filter((entry): entry is [string, number] => entry[1] !== null),
          )
        : {},
    ]),
  );
};

export function compareSavedReports(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): Record<string, unknown> {
  const leftMetrics = reportMetrics(left);
  const rightMetrics = reportMetrics(right);
  const platforms = Array.from(
    new Set([...Object.keys(leftMetrics), ...Object.keys(rightMetrics)]),
  );
  const comparison = Object.fromEntries(
    platforms.map((platform) => {
      const metricKeys = Array.from(
        new Set([
          ...Object.keys(leftMetrics[platform] ?? {}),
          ...Object.keys(rightMetrics[platform] ?? {}),
        ]),
      );
      return [
        platform,
        Object.fromEntries(
          metricKeys.map((metric) => {
            const leftValue = leftMetrics[platform]?.[metric] ?? null;
            const rightValue = rightMetrics[platform]?.[metric] ?? null;
            return [
              metric,
              {
                left: leftValue,
                right: rightValue,
                delta: leftValue !== null && rightValue !== null ? rightValue - leftValue : null,
              },
            ];
          }),
        ),
      ];
    }),
  );
  return { leftReportId: left.id, rightReportId: right.id, comparison };
}
