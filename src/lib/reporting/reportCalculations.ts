import { CONTENT_PILLARS } from '../../constants';
import { monthEndISO, monthStartISO, uuid } from '../utils';
import type {
  Entry,
  ReportCadence,
  ReportMetricSource,
  ReportMetricValue,
  ReportingPeriod,
  ReportPerformanceSnapshot,
} from '../../types/models';
import {
  getMetricDefinition,
  getMetricDefinitionsForCadence,
  REPORT_CONTENT_PILLAR_LIST,
  REPORT_DERIVED_TOTAL_KEYS,
  REPORT_PLATFORM_LIST,
  REPORT_PLATFORM_SUMMARY_KEYS,
} from './metricRegistry';

const emptyMetric = (unit: string, source: ReportMetricSource): ReportMetricValue => ({
  value: null,
  unit,
  source,
  notes: '',
  updatedAt: '',
});

const numericMetric = (
  value: number | null,
  unit: string,
  source: ReportMetricSource,
  notes = '',
): ReportMetricValue => ({
  value,
  unit,
  source,
  notes,
  updatedAt: new Date().toISOString(),
});

const dateRangeForWeek = (date: Date) => {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
};

const dateRangeForQuarter = (date: Date) => {
  const start = new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
};

const dateRangeForYear = (date: Date) => {
  const start = new Date(date.getFullYear(), 0, 1);
  const end = new Date(date.getFullYear(), 11, 31);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
};

export const getDefaultDateRangeForCadence = (cadence: ReportCadence, now = new Date()) => {
  switch (cadence) {
    case 'Weekly':
      return dateRangeForWeek(now);
    case 'Quarterly':
      return dateRangeForQuarter(now);
    case 'Annual':
      return dateRangeForYear(now);
    case 'Monthly':
    default:
      return { startDate: monthStartISO(now), endDate: monthEndISO(now) };
  }
};

const formatLabelRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString(undefined, { month: 'short' })} - ${end.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
  }
  return `${start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
};

export const buildReportingLabel = (
  cadence: ReportCadence,
  startDate: string,
  endDate: string,
): string => `${cadence} report • ${formatLabelRange(startDate, endDate)}`;

const createMetricsScaffold = (cadence: ReportCadence): ReportingPeriod['metrics'] => {
  const definitions = getMetricDefinitionsForCadence(cadence);
  const tier1: ReportingPeriod['metrics']['tier1'] = {};
  const tier2: ReportingPeriod['metrics']['tier2'] = {};
  const tier3: ReportingPeriod['metrics']['tier3'] = {};

  definitions.forEach((definition) => {
    const source =
      definition.sourceType === 'manual'
        ? 'manual'
        : definition.sourceType === 'aggregated'
          ? 'aggregated'
          : 'auto-filled';
    const target =
      definition.group === 'tier1' ? tier1 : definition.group === 'tier2' ? tier2 : tier3;
    target[definition.id] = emptyMetric(definition.unit, source);
  });

  const platforms: ReportingPeriod['metrics']['platforms'] = {};
  REPORT_PLATFORM_LIST.forEach((platform) => {
    platforms[platform] = {};
    REPORT_PLATFORM_SUMMARY_KEYS.forEach((key) => {
      platforms[platform][key] = emptyMetric('count', 'auto-filled');
    });
  });

  const contentPillars: ReportingPeriod['metrics']['contentPillars'] = {};
  REPORT_CONTENT_PILLAR_LIST.forEach((pillar) => {
    contentPillars[pillar] = emptyMetric('count', 'auto-filled');
  });

  const audienceSegments: ReportingPeriod['metrics']['audienceSegments'] = {};

  const derivedTotals: ReportingPeriod['metrics']['derivedTotals'] = {};
  REPORT_DERIVED_TOTAL_KEYS.forEach((key) => {
    derivedTotals[key] = emptyMetric(key === 'coverageScore' ? '%' : 'count', 'auto-filled');
  });

  return {
    tier1,
    tier2,
    tier3,
    platforms,
    contentPillars,
    audienceSegments,
    derivedTotals,
  };
};

export const createReportingPeriod = (
  cadence: ReportCadence,
  owner: string,
  now = new Date(),
): ReportingPeriod => {
  const { startDate, endDate } = getDefaultDateRangeForCadence(cadence, now);
  const timestamp = new Date().toISOString();
  return {
    id: uuid(),
    cadence,
    label: buildReportingLabel(cadence, startDate, endDate),
    startDate,
    endDate,
    status: 'Draft',
    owner: owner || 'Unknown',
    metrics: createMetricsScaffold(cadence),
    narrative: {
      executiveSummary: '',
      notableMoments: '',
      wins: '',
      risks: '',
      nextActions: '',
      audienceQualityNotes: '',
      sentimentSummary: '',
      platformHealthCommentary: '',
      annualReflection: '',
    },
    qualitative: {
      topContentNotes: '',
      bottomContentNotes: '',
      contentPillarNotes: '',
      audienceSegmentNotes: '',
      quarterlyAuditNotes: '',
      advocacyCommentary: '',
      reportFootnote: '',
      topPerformers: [],
      bottomPerformers: [],
    },
    completeness: {
      complete: false,
      completionRatio: 0,
      missingMetricIds: [],
      missingNarrativeIds: [],
      missingQualitativeIds: [],
      lastCheckedAt: timestamp,
    },
    publishedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const isEntryInRange = (entry: Entry, startDate: string, endDate: string) =>
  Boolean(entry.date) &&
  entry.date >= startDate &&
  entry.date <= endDate &&
  !entry.deletedAt &&
  ['Approved', 'Published'].includes(entry.status);

const metricNumber = (entry: Entry, key: string) => {
  let total = 0;
  Object.values(entry.analytics || {}).forEach((platformStats) => {
    if (!platformStats || typeof platformStats !== 'object') return;
    const value = (platformStats as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      total += value;
    }
  });
  return total;
};

const entryEngagements = (entry: Entry) =>
  ['likes', 'comments', 'shares', 'saves', 'clicks'].reduce((sum, key) => sum + metricNumber(entry, key), 0);

const buildPerformanceSnapshots = (
  entries: Entry[],
  direction: 'top' | 'bottom',
): ReportPerformanceSnapshot[] => {
  const ranked = entries
    .map((entry) => ({
      entryId: entry.id,
      caption: entry.caption || entry.assetType || 'Untitled',
      date: entry.date,
      platforms: entry.platforms || [],
      metric: 'Engagements',
      value: entryEngagements(entry),
    }))
    .sort((a, b) => (direction === 'top' ? b.value - a.value : a.value - b.value));
  return ranked.slice(0, 3);
};

const aggregateFromChildren = (
  childReports: ReportingPeriod[],
  group: 'tier1' | 'tier2' | 'tier3',
  metricId: string,
  aggregation: 'sum' | 'average' | 'latest',
) => {
  const values = childReports
    .map((report) => report.metrics[group]?.[metricId]?.value)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return null;
  if (aggregation === 'latest') return values[values.length - 1];
  if (aggregation === 'average') {
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
  }
  return values.reduce((sum, value) => sum + value, 0);
};

const matchingChildReports = (report: ReportingPeriod, reports: ReportingPeriod[]) => {
  const childCadence = report.cadence === 'Quarterly' ? 'Monthly' : report.cadence === 'Annual' ? 'Quarterly' : null;
  if (!childCadence) return [];
  return reports
    .filter(
      (candidate) =>
        candidate.id !== report.id &&
        candidate.cadence === childCadence &&
        candidate.startDate >= report.startDate &&
        candidate.endDate <= report.endDate,
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
};

const daysInRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
};

export const hydrateReportingPeriod = (
  report: ReportingPeriod,
  entries: Entry[],
  reports: ReportingPeriod[],
): ReportingPeriod => {
  const filteredEntries = entries.filter((entry) => isEntryInRange(entry, report.startDate, report.endDate));
  const totalPosts = filteredEntries.length;
  const totalPublishedPosts = filteredEntries.filter((entry) => entry.status === 'Published').length;
  const totalReach = filteredEntries.reduce((sum, entry) => sum + metricNumber(entry, 'reach'), 0);
  const totalImpressions = filteredEntries.reduce((sum, entry) => sum + metricNumber(entry, 'impressions'), 0);
  const totalEngagements = filteredEntries.reduce((sum, entry) => sum + entryEngagements(entry), 0);
  const totalShares = filteredEntries.reduce((sum, entry) => sum + metricNumber(entry, 'shares'), 0);
  const totalSends = filteredEntries.reduce((sum, entry) => sum + metricNumber(entry, 'sends'), 0);
  const totalSaves = filteredEntries.reduce((sum, entry) => sum + metricNumber(entry, 'saves'), 0);
  const totalClicks = filteredEntries.reduce((sum, entry) => sum + metricNumber(entry, 'clicks'), 0);
  const engagementRate = totalReach > 0 ? Number(((totalEngagements / totalReach) * 100).toFixed(2)) : 0;
  const ctr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
  const engagementQuality = totalPosts
    ? Number((((totalShares * 3 + totalSaves * 3 + filteredEntries.reduce((sum, entry) => sum + metricNumber(entry, 'comments') * 2, 0)) / totalPosts)).toFixed(2))
    : 0;
  const postingConsistency = Number(
    (
      (new Set(filteredEntries.map((entry) => entry.date)).size / daysInRange(report.startDate, report.endDate)) *
      100
    ).toFixed(2),
  );

  const childReports = matchingChildReports(report, reports);
  const timestamp = new Date().toISOString();
  const nextReport: ReportingPeriod = {
    ...report,
    metrics: {
      ...report.metrics,
      tier1: { ...report.metrics.tier1 },
      tier2: { ...report.metrics.tier2 },
      tier3: { ...report.metrics.tier3 },
      platforms: { ...report.metrics.platforms },
      contentPillars: { ...report.metrics.contentPillars },
      audienceSegments: { ...report.metrics.audienceSegments },
      derivedTotals: { ...report.metrics.derivedTotals },
    },
    qualitative: {
      ...report.qualitative,
      topPerformers: buildPerformanceSnapshots(filteredEntries, 'top'),
      bottomPerformers: buildPerformanceSnapshots(filteredEntries, 'bottom'),
    },
    updatedAt: timestamp,
  };

  getMetricDefinitionsForCadence(report.cadence).forEach((definition) => {
    const group = definition.group;
    const existing = nextReport.metrics[group][definition.id];
    let value: number | null = null;
    let source: ReportMetricSource = existing?.source || 'manual';

    if ((report.cadence === 'Quarterly' || report.cadence === 'Annual') && childReports.length) {
      value = aggregateFromChildren(childReports, group, definition.id, definition.aggregation);
      if (value !== null) {
        source = 'aggregated';
      }
    }

    if (value === null && definition.sourceType === 'auto') {
      switch (definition.id) {
        case 'nativeShares':
          value = totalShares;
          break;
        case 'privateSends':
          value = totalSends;
          break;
        case 'engagementRate':
          value = engagementRate;
          break;
        case 'engagementQuality':
          value = engagementQuality;
          break;
        case 'saves':
          value = totalSaves;
          break;
        case 'ctr':
          value = ctr;
          break;
        case 'postingConsistency':
          value = postingConsistency;
          break;
        default:
          value = null;
      }
      if (value !== null) {
        source = 'auto-filled';
      }
    }

    if (value !== null) {
      nextReport.metrics[group][definition.id] = numericMetric(value, definition.unit, source);
    } else if (!nextReport.metrics[group][definition.id]) {
      nextReport.metrics[group][definition.id] = emptyMetric(
        definition.unit,
        definition.sourceType === 'manual' ? 'manual' : 'auto-filled',
      );
    }
  });

  REPORT_PLATFORM_LIST.forEach((platform) => {
    const platformEntries = filteredEntries.filter((entry) => entry.platforms?.includes(platform));
    const platformReach = platformEntries.reduce((sum, entry) => sum + metricNumber({ ...entry, analytics: { [platform]: (entry.analytics as Record<string, unknown>)[platform] } } as Entry, 'reach'), 0);
    const platformImpressions = platformEntries.reduce((sum, entry) => sum + metricNumber({ ...entry, analytics: { [platform]: (entry.analytics as Record<string, unknown>)[platform] } } as Entry, 'impressions'), 0);
    const platformEngagements = platformEntries.reduce((sum, entry) => {
      const scoped = {
        ...entry,
        analytics: { [platform]: (entry.analytics as Record<string, unknown>)[platform] },
      } as Entry;
      return sum + entryEngagements(scoped);
    }, 0);
    nextReport.metrics.platforms[platform] = {
      posts: numericMetric(platformEntries.length, 'count', 'auto-filled'),
      reach: numericMetric(platformReach, 'count', 'auto-filled'),
      impressions: numericMetric(platformImpressions, 'count', 'auto-filled'),
      engagements: numericMetric(platformEngagements, 'count', 'auto-filled'),
    };
  });

  CONTENT_PILLARS.forEach((pillar) => {
    const count = filteredEntries.filter((entry) => entry.contentPillar === pillar).length;
    nextReport.metrics.contentPillars[pillar] = numericMetric(count, 'count', 'auto-filled');
  });

  const segmentCounts = new Map<string, number>();
  filteredEntries.forEach((entry) => {
    (entry.audienceSegments || []).forEach((segment) => {
      segmentCounts.set(segment, (segmentCounts.get(segment) || 0) + 1);
    });
  });

  const nextAudienceSegments: ReportingPeriod['metrics']['audienceSegments'] = {};
  Array.from(segmentCounts.keys())
    .sort()
    .forEach((segment) => {
      nextAudienceSegments[segment] = numericMetric(segmentCounts.get(segment) || 0, 'count', 'auto-filled');
    });
  nextReport.metrics.audienceSegments = nextAudienceSegments;

  nextReport.metrics.derivedTotals = {
    totalPosts: numericMetric(totalPosts, 'count', 'auto-filled'),
    totalPublishedPosts: numericMetric(totalPublishedPosts, 'count', 'auto-filled'),
    totalReach: numericMetric(totalReach, 'count', 'auto-filled'),
    totalImpressions: numericMetric(totalImpressions, 'count', 'auto-filled'),
    totalEngagements: numericMetric(totalEngagements, 'count', 'auto-filled'),
    coverageScore: numericMetric(
      REPORT_PLATFORM_LIST.length
        ? Number(
            (
              (REPORT_PLATFORM_LIST.filter(
                (platform) => (nextReport.metrics.platforms[platform]?.posts?.value as number) > 0,
              ).length /
                REPORT_PLATFORM_LIST.length) *
              100
            ).toFixed(2),
          )
        : 0,
      '%',
      'auto-filled',
    ),
  };

  return nextReport;
};

export const updateMetricValue = (
  report: ReportingPeriod,
  group: 'tier1' | 'tier2' | 'tier3',
  metricId: string,
  value: number | null,
  source: ReportMetricSource = 'manual',
): ReportingPeriod => {
  const definition = getMetricDefinition(metricId);
  if (!definition) return report;
  return {
    ...report,
    metrics: {
      ...report.metrics,
      [group]: {
        ...report.metrics[group],
        [metricId]: numericMetric(value, definition.unit, source),
      },
    },
    updatedAt: new Date().toISOString(),
  };
};

export const updateNarrativeField = (
  report: ReportingPeriod,
  field: keyof ReportingPeriod['narrative'],
  value: string,
): ReportingPeriod => ({
  ...report,
  narrative: {
    ...report.narrative,
    [field]: value,
  },
  updatedAt: new Date().toISOString(),
});

export const updateQualitativeField = (
  report: ReportingPeriod,
  field: keyof ReportingPeriod['qualitative'],
  value: string,
): ReportingPeriod => ({
  ...report,
  qualitative: {
    ...report.qualitative,
    [field]: value,
  },
  updatedAt: new Date().toISOString(),
});
