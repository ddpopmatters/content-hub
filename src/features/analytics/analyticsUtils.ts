import {
  ALL_PLATFORMS,
  ASSET_TYPES,
  CAMPAIGNS,
  CONTENT_PILLARS,
  PLATFORM_METRICS,
} from '../../constants';
import type { Entry } from '../../types/models';

export const TIME_PERIODS = [
  { value: 'this-week', label: 'This week' },
  { value: 'last-30-days', label: 'Last 30 days' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'this-quarter', label: 'This quarter' },
  { value: 'last-quarter', label: 'Last quarter' },
  { value: 'year-to-date', label: 'Year to date' },
  { value: 'all-time', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
] as const;

export type TimePeriod = (typeof TIME_PERIODS)[number]['value'];

export interface InsightFilters {
  timePeriod: TimePeriod;
  customStartDate: string;
  customEndDate: string;
  platforms: string[];
  metric: string;
  campaigns: string[];
  contentPillars: string[];
  assetTypes: string[];
  statuses: string[];
  authors: string[];
  audienceSegments: string[];
}

export interface InsightMetricOption {
  value: string;
  label: string;
  unit: 'count' | 'percent' | 'minutes';
}

export interface InsightBreakdownRow {
  label: string;
  value: number;
  posts: number;
  postsWithMetric: number;
  coverageRate: number;
}

export interface InsightTrendPoint {
  key: string;
  label: string;
  value: number;
  posts: number;
}

export interface TopPerformer {
  entry: Entry;
  value: number;
}

export interface InsightsSnapshot {
  rangeLabel: string;
  filteredEntries: Entry[];
  totalPosts: number;
  totalMetricValue: number;
  averageMetricValue: number;
  postsWithSelectedMetric: number;
  postsWithAnyAnalytics: number;
  coverageRate: number;
  analyticsCoverageRate: number;
  trend: InsightTrendPoint[];
  breakdowns: {
    platforms: InsightBreakdownRow[];
    contentPillars: InsightBreakdownRow[];
    campaigns: InsightBreakdownRow[];
    assetTypes: InsightBreakdownRow[];
    authors: InsightBreakdownRow[];
    audienceSegments: InsightBreakdownRow[];
  };
  topPerformers: TopPerformer[];
}

export interface InsightFilterOptions {
  platforms: string[];
  metrics: InsightMetricOption[];
  campaigns: string[];
  contentPillars: string[];
  assetTypes: string[];
  statuses: string[];
  authors: string[];
  audienceSegments: string[];
}

const BASE_METRIC_OPTIONS: InsightMetricOption[] = [
  { value: 'posts', label: 'Posts', unit: 'count' },
  { value: 'engagements', label: 'Engagements', unit: 'count' },
  { value: 'engagementRate', label: 'Engagement rate', unit: 'percent' },
  { value: 'impressions', label: 'Impressions', unit: 'count' },
  { value: 'reach', label: 'Reach', unit: 'count' },
  { value: 'clicks', label: 'Clicks', unit: 'count' },
  { value: 'likes', label: 'Likes', unit: 'count' },
  { value: 'comments', label: 'Comments', unit: 'count' },
  { value: 'shares', label: 'Shares', unit: 'count' },
  { value: 'saves', label: 'Saves', unit: 'count' },
  { value: 'views', label: 'Views', unit: 'count' },
  { value: 'watchTime', label: 'Watch time', unit: 'minutes' },
  { value: 'subscribersGained', label: 'Subscribers gained', unit: 'count' },
];

const METRIC_LABELS = (() => {
  const labels: Record<string, string> = {};
  BASE_METRIC_OPTIONS.forEach((option) => {
    labels[option.value] = option.label;
  });
  Object.values(PLATFORM_METRICS).forEach((fields) => {
    fields.forEach((field) => {
      if (!labels[field.key]) labels[field.key] = field.label;
    });
  });
  return labels;
})();

const METRIC_UNITS: Record<string, InsightMetricOption['unit']> = BASE_METRIC_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option.unit;
    return acc;
  },
  {} as Record<string, InsightMetricOption['unit']>,
);

const STATUS_ORDER = ['Published', 'Approved', 'Pending', 'Draft'];

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const formatRangeDate = (date: Date) =>
  date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const startOfWeek = (date: Date) => addDays(startOfDay(date), -startOfDay(date).getDay());

const endOfWeek = (date: Date) => endOfDay(addDays(startOfWeek(date), 6));

const startOfMonth = (date: Date) => {
  const next = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfDay(next);
};

const endOfMonth = (date: Date) => {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return endOfDay(next);
};

const startOfQuarter = (date: Date) => {
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
  return startOfDay(new Date(date.getFullYear(), quarterMonth, 1));
};

const endOfQuarter = (date: Date) => {
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
  return endOfDay(new Date(date.getFullYear(), quarterMonth + 3, 0));
};

const formatMetricKey = (metric: string) =>
  metric
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const entryStatus = (entry: Entry) => {
  if (entry.workflowStatus === 'Published' || entry.status === 'Published' || entry.publishedAt) {
    return 'Published';
  }
  if (entry.workflowStatus === 'Approved' || entry.status === 'Approved') {
    return 'Approved';
  }
  if (entry.status === 'Pending' || entry.workflowStatus === 'Ready for Review') {
    return 'Pending';
  }
  return 'Draft';
};

const entryPlatforms = (entry: Entry) =>
  unique([...entry.platforms, ...Object.keys((entry.analytics || {}) as Record<string, unknown>)]);

const scopedPlatformsForEntry = (entry: Entry, selectedPlatforms: string[]) => {
  const candidates = entryPlatforms(entry);
  if (!selectedPlatforms.length) return candidates;
  return candidates.filter((platform) => selectedPlatforms.includes(platform));
};

const numericValue = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const hasMetricOnPlatform = (stats: Record<string, unknown>, metric: string) => {
  if (metric === 'posts') return true;
  if (metric === 'engagements') {
    return ['likes', 'comments', 'shares', 'saves'].some((key) => key in stats);
  }
  if (metric === 'engagementRate') {
    return 'reach' in stats || 'impressions' in stats;
  }
  return metric in stats;
};

const platformMetricValue = (stats: Record<string, unknown>, metric: string) => {
  if (metric === 'engagements') {
    return (
      numericValue(stats.likes) +
      numericValue(stats.comments) +
      numericValue(stats.shares) +
      numericValue(stats.saves)
    );
  }
  return numericValue(stats[metric]);
};

const entryMetricValue = (entry: Entry, metric: string, selectedPlatforms: string[]) => {
  const platforms = scopedPlatformsForEntry(entry, selectedPlatforms);
  if (metric === 'posts') return 1;
  if (metric === 'engagementRate') {
    const engagements = entryMetricValue(entry, 'engagements', selectedPlatforms);
    const reach = entryMetricValue(entry, 'reach', selectedPlatforms);
    const impressions = entryMetricValue(entry, 'impressions', selectedPlatforms);
    const denominator = reach > 0 ? reach : impressions;
    return denominator > 0 ? (engagements / denominator) * 100 : 0;
  }
  return platforms.reduce((sum, platform) => {
    const stats = ((entry.analytics || {}) as Record<string, Record<string, unknown>>)[platform];
    if (!stats || typeof stats !== 'object') return sum;
    return sum + platformMetricValue(stats, metric);
  }, 0);
};

const entryRateDenominator = (entry: Entry, selectedPlatforms: string[]) => {
  const reach = entryMetricValue(entry, 'reach', selectedPlatforms);
  const impressions = entryMetricValue(entry, 'impressions', selectedPlatforms);
  return reach > 0 ? reach : impressions;
};

const entryHasMetric = (entry: Entry, metric: string, selectedPlatforms: string[]) => {
  const platforms = scopedPlatformsForEntry(entry, selectedPlatforms);
  if (metric === 'posts') return true;
  return platforms.some((platform) => {
    const stats = ((entry.analytics || {}) as Record<string, Record<string, unknown>>)[platform];
    return stats && typeof stats === 'object' ? hasMetricOnPlatform(stats, metric) : false;
  });
};

const entryHasAnyAnalytics = (entry: Entry, selectedPlatforms: string[]) =>
  scopedPlatformsForEntry(entry, selectedPlatforms).some((platform) => {
    const stats = ((entry.analytics || {}) as Record<string, Record<string, unknown>>)[platform];
    return stats && typeof stats === 'object' && Object.keys(stats).length > 0;
  });

const aggregateMetric = (entries: Entry[], metric: string, selectedPlatforms: string[]) => {
  if (metric === 'engagementRate') {
    const totalEngagements = entries.reduce(
      (sum, entry) => sum + entryMetricValue(entry, 'engagements', selectedPlatforms),
      0,
    );
    const denominator = entries.reduce(
      (sum, entry) => sum + entryRateDenominator(entry, selectedPlatforms),
      0,
    );
    return denominator > 0 ? (totalEngagements / denominator) * 100 : 0;
  }
  if (metric === 'posts') return entries.length;
  return entries.reduce(
    (sum, entry) => sum + entryMetricValue(entry, metric, selectedPlatforms),
    0,
  );
};

const buildDimensionBreakdown = (
  entries: Entry[],
  labels: string[],
  metric: string,
  selectedPlatforms: string[],
  matchEntry: (entry: Entry, label: string) => boolean,
) =>
  labels
    .map((label) => {
      const subset = entries.filter((entry) => matchEntry(entry, label));
      if (!subset.length) return null;
      const postsWithMetric = subset.filter((entry) =>
        entryHasMetric(entry, metric, selectedPlatforms),
      ).length;
      return {
        label,
        value: aggregateMetric(subset, metric, selectedPlatforms),
        posts: subset.length,
        postsWithMetric,
        coverageRate: subset.length ? (postsWithMetric / subset.length) * 100 : 0,
      };
    })
    .filter((item): item is InsightBreakdownRow => Boolean(item))
    .sort((a, b) => b.value - a.value || b.posts - a.posts);

const getTrendGranularity = (rangeDays: number) => {
  if (rangeDays <= 14) return 'day';
  if (rangeDays <= 120) return 'week';
  return 'month';
};

const bucketKey = (date: Date, granularity: 'day' | 'week' | 'month') => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (granularity === 'day') return `${year}-${month}-${day}`;
  if (granularity === 'month') return `${year}-${month}`;
  const weekStart = startOfWeek(date);
  return weekStart.toISOString().slice(0, 10);
};

const bucketLabel = (key: string, granularity: 'day' | 'week' | 'month') => {
  if (granularity === 'month') {
    const [year, month] = key.split('-').map(Number);
    return new Date(year, (month || 1) - 1, 1).toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric',
    });
  }
  const start = new Date(key);
  if (granularity === 'week') {
    const end = addDays(start, 6);
    return `${formatRangeDate(start)} - ${formatRangeDate(end)}`;
  }
  return formatRangeDate(start);
};

export const getDateRange = (
  period: TimePeriod,
  customStartDate = '',
  customEndDate = '',
  now = new Date(),
) => {
  const today = startOfDay(now);
  switch (period) {
    case 'this-week':
      return { start: startOfWeek(today), end: endOfWeek(today) };
    case 'last-30-days':
      return { start: startOfDay(addDays(today, -29)), end: endOfDay(today) };
    case 'this-month':
      return { start: startOfMonth(today), end: endOfMonth(today) };
    case 'last-month': {
      const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return { start: startOfMonth(previousMonth), end: endOfMonth(previousMonth) };
    }
    case 'this-quarter':
      return { start: startOfQuarter(today), end: endOfQuarter(today) };
    case 'last-quarter': {
      const previousQuarter = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      return { start: startOfQuarter(previousQuarter), end: endOfQuarter(previousQuarter) };
    }
    case 'year-to-date':
      return { start: startOfDay(new Date(today.getFullYear(), 0, 1)), end: endOfDay(today) };
    case 'custom': {
      const start = customStartDate ? new Date(customStartDate) : today;
      const end = customEndDate ? new Date(customEndDate) : today;
      return { start: startOfDay(start), end: endOfDay(end) };
    }
    case 'all-time':
    default:
      return { start: new Date(0), end: endOfDay(today) };
  }
};

export const getMetricOptions = (entries: Entry[]): InsightMetricOption[] => {
  const dynamicKeys = unique(
    entries.flatMap((entry) =>
      Object.values((entry.analytics || {}) as Record<string, Record<string, unknown>>).flatMap(
        (stats) => Object.keys(stats || {}),
      ),
    ),
  );
  const options = new Map<string, InsightMetricOption>();
  BASE_METRIC_OPTIONS.forEach((option) => {
    options.set(option.value, option);
  });
  dynamicKeys.forEach((key) => {
    if (options.has(key)) return;
    options.set(key, {
      value: key,
      label: METRIC_LABELS[key] || formatMetricKey(key),
      unit: METRIC_UNITS[key] || 'count',
    });
  });
  return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label));
};

export const getInsightFilterOptions = (entries: Entry[]): InsightFilterOptions => ({
  platforms: ALL_PLATFORMS.filter((platform) =>
    entries.some((entry) => entryPlatforms(entry).includes(platform)),
  ),
  metrics: getMetricOptions(entries),
  campaigns: unique(entries.map((entry) => entry.campaign)).filter((value) =>
    CAMPAIGNS.includes(value as never),
  ),
  contentPillars: unique(entries.map((entry) => entry.contentPillar)).filter((value) =>
    CONTENT_PILLARS.includes(value as never),
  ),
  assetTypes: unique(entries.map((entry) => entry.assetType)).filter((value) =>
    ASSET_TYPES.includes(value as never),
  ),
  statuses: STATUS_ORDER.filter((status) => entries.some((entry) => entryStatus(entry) === status)),
  authors: unique(entries.map((entry) => entry.author)).sort((a, b) => a.localeCompare(b)),
  audienceSegments: unique(entries.flatMap((entry) => entry.audienceSegments || [])).sort((a, b) =>
    a.localeCompare(b),
  ),
});

export const buildInsightsSnapshot = (
  entries: Entry[],
  filters: InsightFilters,
  now = new Date(),
): InsightsSnapshot => {
  const { start, end } = getDateRange(
    filters.timePeriod,
    filters.customStartDate,
    filters.customEndDate,
    now,
  );
  const filteredEntries = entries.filter((entry) => {
    if (!entry.date) return false;
    const entryDate = new Date(entry.date);
    if (Number.isNaN(entryDate.getTime())) return false;
    if (entryDate < start || entryDate > end) return false;
    if (filters.statuses.length && !filters.statuses.includes(entryStatus(entry))) return false;
    if (
      filters.platforms.length &&
      !entryPlatforms(entry).some((platform) => filters.platforms.includes(platform))
    ) {
      return false;
    }
    if (filters.campaigns.length && !filters.campaigns.includes(entry.campaign)) return false;
    if (filters.contentPillars.length && !filters.contentPillars.includes(entry.contentPillar)) {
      return false;
    }
    if (filters.assetTypes.length && !filters.assetTypes.includes(entry.assetType)) return false;
    if (filters.authors.length && !filters.authors.includes(entry.author)) return false;
    if (
      filters.audienceSegments.length &&
      !(entry.audienceSegments || []).some((segment) => filters.audienceSegments.includes(segment))
    ) {
      return false;
    }
    return true;
  });

  const totalPosts = filteredEntries.length;
  const totalMetricValue = aggregateMetric(filteredEntries, filters.metric, filters.platforms);
  const postsWithSelectedMetric = filteredEntries.filter((entry) =>
    entryHasMetric(entry, filters.metric, filters.platforms),
  ).length;
  const postsWithAnyAnalytics = filteredEntries.filter((entry) =>
    entryHasAnyAnalytics(entry, filters.platforms),
  ).length;
  const rangeDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const granularity = getTrendGranularity(rangeDays);
  const trendBuckets = new Map<string, Entry[]>();
  filteredEntries.forEach((entry) => {
    const key = bucketKey(new Date(entry.date), granularity);
    if (!trendBuckets.has(key)) trendBuckets.set(key, []);
    trendBuckets.get(key)!.push(entry);
  });
  const trend = Array.from(trendBuckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, bucketEntries]) => ({
      key,
      label: bucketLabel(key, granularity),
      value: aggregateMetric(bucketEntries, filters.metric, filters.platforms),
      posts: bucketEntries.length,
    }));

  const filterOptions = getInsightFilterOptions(filteredEntries);
  const selectedPlatforms = filters.platforms.length ? filters.platforms : filterOptions.platforms;

  const breakdowns = {
    platforms: buildDimensionBreakdown(
      filteredEntries,
      selectedPlatforms,
      filters.metric,
      filters.platforms,
      (entry, label) => entryPlatforms(entry).includes(label),
    ),
    contentPillars: buildDimensionBreakdown(
      filteredEntries,
      filterOptions.contentPillars,
      filters.metric,
      filters.platforms,
      (entry, label) => entry.contentPillar === label,
    ),
    campaigns: buildDimensionBreakdown(
      filteredEntries,
      filterOptions.campaigns,
      filters.metric,
      filters.platforms,
      (entry, label) => entry.campaign === label,
    ),
    assetTypes: buildDimensionBreakdown(
      filteredEntries,
      filterOptions.assetTypes,
      filters.metric,
      filters.platforms,
      (entry, label) => entry.assetType === label,
    ),
    authors: buildDimensionBreakdown(
      filteredEntries,
      filterOptions.authors,
      filters.metric,
      filters.platforms,
      (entry, label) => entry.author === label,
    ),
    audienceSegments: buildDimensionBreakdown(
      filteredEntries,
      filterOptions.audienceSegments,
      filters.metric,
      filters.platforms,
      (entry, label) => (entry.audienceSegments || []).includes(label),
    ),
  };

  const rankingMetric = filters.metric === 'posts' ? 'engagements' : filters.metric;
  const topPerformers = filteredEntries
    .map((entry) => ({
      entry,
      value: entryMetricValue(entry, rankingMetric, filters.platforms),
    }))
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);

  return {
    rangeLabel: `${formatRangeDate(start)} - ${formatRangeDate(end)}`,
    filteredEntries,
    totalPosts,
    totalMetricValue,
    averageMetricValue: totalPosts ? totalMetricValue / totalPosts : 0,
    postsWithSelectedMetric,
    postsWithAnyAnalytics,
    coverageRate: totalPosts ? (postsWithSelectedMetric / totalPosts) * 100 : 0,
    analyticsCoverageRate: totalPosts ? (postsWithAnyAnalytics / totalPosts) * 100 : 0,
    trend,
    breakdowns,
    topPerformers,
  };
};

export const metricLabel = (metric: string) => METRIC_LABELS[metric] || formatMetricKey(metric);

export const formatMetricValue = (metric: string, value: number) => {
  const unit = METRIC_UNITS[metric] || 'count';
  if (unit === 'percent') return `${value.toFixed(1)}%`;
  if (unit === 'minutes')
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} min`;
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  });
};

export const createDefaultInsightFilters = (entries: Entry[]): InsightFilters => ({
  timePeriod: 'this-month',
  customStartDate: '',
  customEndDate: '',
  platforms: [],
  metric: getMetricOptions(entries).some((option) => option.value === 'engagements')
    ? 'engagements'
    : getMetricOptions(entries)[0]?.value || 'posts',
  campaigns: [],
  contentPillars: [],
  assetTypes: [],
  statuses: ['Approved', 'Published'],
  authors: [],
  audienceSegments: [],
});
