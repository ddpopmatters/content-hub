import {
  buildReportingSnapshot,
  REPORTING_PLATFORMS,
  type ReportingEntryRow,
} from './agentReporting.ts';

export const AGENT_ACTION_TYPES = [
  'create_idea',
  'create_entry',
  'update_entry',
  'add_comment',
  'submit_for_review',
  'create_report',
  'update_report',
] as const;

export type AgentActionType = (typeof AGENT_ACTION_TYPES)[number];

export interface AgentWritePolicy {
  proposalsEnabled: boolean;
  executionEnabled: boolean;
  enabledActions: ReadonlySet<AgentActionType>;
}

export interface AgentActionRecord {
  id: string;
  actionType: AgentActionType;
  targetId: string | null;
  payloadHash: string;
  idempotencyKey: string;
  summary: string;
  status: 'proposed' | 'executing' | 'applied' | 'rejected' | 'expired' | 'failed';
  expiresAt: string;
  resultClass: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  appliedAt: string | null;
}

export interface CreateAgentActionInput {
  clientId: string;
  actionType: AgentActionType;
  targetId: string | null;
  payload: Record<string, unknown>;
  payloadHash: string;
  idempotencyKey: string;
  summary: string;
  expiresAt: string;
}

export interface ExecuteAgentActionInput {
  actionId: string;
  clientId: string;
  payloadHash: string;
  idempotencyKey: string;
  approvalReference: string;
  approvedBy: string;
}

export interface ExecuteAgentActionResult {
  decision: 'applied' | 'idempotent_replay' | 'expired' | 'conflict' | 'rejected' | 'failed';
  action: AgentActionRecord;
}

export interface AgentActionRepository {
  createAction(input: CreateAgentActionInput): Promise<AgentActionRecord>;
  getAction(actionId: string): Promise<AgentActionRecord | null>;
  executeAction(input: ExecuteAgentActionInput): Promise<ExecuteAgentActionResult>;
  getEntry(entryId: string): Promise<Record<string, unknown> | null>;
  getReport(reportId: string): Promise<Record<string, unknown> | null>;
  getReportingEntries(filters: {
    startDate: string;
    endDate: string;
    campaign?: string;
    limit: number;
  }): Promise<{ rows: ReportingEntryRow[]; truncated: boolean }>;
}

export class AgentActionError extends Error {
  constructor(
    readonly code: 'invalid_request' | 'not_found' | 'conflict' | 'write_disabled',
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const IDEA_TYPES = new Set(['Topic', 'Theme', 'Series', 'Campaign', 'Other']);
const ASSET_TYPES = new Set(['No asset', 'Video', 'Design', 'Carousel']);
const PRIORITY_TIERS = new Set(['Low', 'Medium', 'High', 'Urgent']);
const CONTENT_CATEGORIES = new Set([
  'Evidence & education',
  'Campaign & advocacy',
  'Counter-disinformation',
  'Community & engagement',
  'Partner & people stories',
  'Organisational',
]);
const RESPONSE_MODES = new Set(['Planned', 'Reactive', 'Pre-bunk', 'Rapid response']);
const SIGN_OFF_ROUTES = new Set([
  'Standard scheduled content',
  'Reactive / rapid response',
  'Counter-disinformation / pre-bunking',
  'Research publication content',
  'Partner / E2P content',
  'Coalition content',
  'Paid social creative',
  'Named staff content',
  'Risk audience content',
]);
const LINK_PLACEMENTS = new Set([
  'First comment',
  'Caption / body',
  'Bio / profile',
  'No external link',
]);
const CTA_TYPES = new Set([
  'Read more',
  'Donate',
  'Sign petition',
  'Share',
  'Comment',
  'Follow',
  'Register',
  'Partner action',
  'No CTA',
]);
const REPORT_TYPES = new Set(['monthly', 'quarterly', 'annual', 'campaign']);
const QUALITATIVE_FIELDS = new Set([
  'whatWorked',
  'whatDidnt',
  'themes',
  'nextPeriodFocus',
  'highlights',
  'audienceQuality',
  'coalitionSignals',
  'narrativeUptake',
  'pillarPerformance',
  'platformTierReview',
]);
const ENTRY_FIELDS = new Set([
  'date',
  'platforms',
  'assetType',
  'caption',
  'platformCaptions',
  'firstComment',
  'approvalDeadline',
  'approvers',
  'campaign',
  'contentPillar',
  'priorityTier',
  'url',
  'contentCategory',
  'responseMode',
  'signOffRoute',
  'audienceSegments',
  'sourceVerified',
  'linkPlacement',
  'ctaType',
  'script',
  'designCopy',
  'carouselSlides',
]);
const FORBIDDEN_PM_TERMS = [
  'population stabilisation',
  'overpopulation',
  'family size management',
  'population control',
];

const invalid = (message = 'The proposed action is invalid.'): never => {
  throw new AgentActionError('invalid_request', message, 400);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const exactKeys = (
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  required: readonly string[] = [],
): void => {
  if (Object.keys(value).some((key) => !allowed.has(key))) invalid();
  if (required.some((key) => !(key in value))) invalid();
};

const text = (
  value: unknown,
  maximum: number,
  options: { required?: boolean; trim?: boolean } = {},
): string => {
  if (typeof value !== 'string' || value.length > maximum || value.includes('\0')) invalid();
  const stringValue = value as string;
  const normalised = options.trim === false ? stringValue : stringValue.trim();
  if (options.required && !normalised) invalid();
  return normalised;
};

const optionalText = (value: unknown, maximum: number): string =>
  value === undefined || value === null ? '' : text(value, maximum);

const enumValue = (value: unknown, allowed: ReadonlySet<string>): string => {
  const normalised = text(value, 100, { required: true });
  if (!allowed.has(normalised)) invalid();
  return normalised;
};

const integer = (value: unknown, minimum: number, maximum: number): number => {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) invalid();
  return Number(value);
};

const isoDate = (value: unknown): string => {
  const normalised = text(value, 10, { required: true });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalised)) invalid();
  const parsed = new Date(`${normalised}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalised) invalid();
  return normalised;
};

const optionalDate = (value: unknown): string | null =>
  value === undefined || value === null || value === '' ? null : isoDate(value);

const isoTimestamp = (value: unknown): string => {
  const normalised = text(value, 40, { required: true });
  if (!/^\d{4}-\d{2}-\d{2}T/.test(normalised) || Number.isNaN(Date.parse(normalised))) invalid();
  // PostgreSQL timestamps can retain microseconds. Re-serialising through
  // Date would truncate them to milliseconds and make an unchanged row fail
  // the executor's exact optimistic-concurrency comparison.
  return normalised;
};

const identifier = (value: unknown): string => {
  const normalised = text(value, 64, { required: true });
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalised)
  )
    invalid();
  return normalised.toLowerCase();
};

const idempotencyKey = (value: unknown): string => {
  const normalised = text(value, 160, { required: true });
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(normalised)) invalid();
  return normalised;
};

const stringArray = (value: unknown, maximumItems: number, maximumLength: number): string[] => {
  if (!Array.isArray(value) || value.length > maximumItems) invalid();
  return (value as unknown[]).map((item) => text(item, maximumLength, { required: true }));
};

const httpsUrl = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return '';
  const normalised = text(value, 2_000, { required: true });
  let parsed: URL;
  try {
    parsed = new URL(normalised);
  } catch {
    return invalid();
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) invalid();
  return parsed.toString();
};

const checkPmLanguage = (value: string): void => {
  const lowered = value.toLowerCase();
  if (FORBIDDEN_PM_TERMS.some((term) => lowered.includes(term))) {
    invalid('The proposed public copy does not meet PM language guidance.');
  }
};

const sameTimestamp = (left: unknown, right: string): boolean =>
  typeof left === 'string' && Date.parse(left) === Date.parse(right);

const entryWorkflowStatus = (entry: Record<string, unknown>): string =>
  String(entry.workflowStatus ?? entry.workflow_status ?? '');

const platformList = (value: unknown): string[] => {
  const platforms = stringArray(value, REPORTING_PLATFORMS.length, 20);
  if (!platforms.length || new Set(platforms).size !== platforms.length) invalid();
  if (platforms.some((platform) => !REPORTING_PLATFORMS.includes(platform as never))) invalid();
  return platforms;
};

const platformCaptions = (value: unknown, platforms: string[]): Record<string, string> => {
  if (value === undefined || value === null) return {};
  if (!isRecord(value) || Object.keys(value).length > REPORTING_PLATFORMS.length) invalid();
  const result: Record<string, string> = {};
  for (const [platform, captionValue] of Object.entries(value)) {
    if (!platforms.includes(platform)) invalid();
    const caption = text(captionValue, 10_000);
    checkPmLanguage(caption);
    result[platform] = caption;
  }
  return result;
};

const normaliseEntryFields = (
  value: Record<string, unknown>,
  options: { create: boolean },
): Record<string, unknown> => {
  exactKeys(value, ENTRY_FIELDS, options.create ? ['date', 'platforms', 'caption'] : []);
  const result: Record<string, unknown> = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(value, key);
  const add = (key: string, normalised: unknown) => {
    if (has(key) || options.create) result[key] = normalised;
  };

  if (has('date') || options.create) add('date', isoDate(value.date));
  const platforms = has('platforms') || options.create ? platformList(value.platforms) : [];
  if (has('platforms') || options.create) add('platforms', platforms);
  if (has('assetType')) add('assetType', enumValue(value.assetType, ASSET_TYPES));
  else if (options.create) add('assetType', 'No asset');
  if (has('caption') || options.create) {
    const caption = text(value.caption, 10_000, { required: options.create });
    checkPmLanguage(caption);
    add('caption', caption);
  }
  if (has('platformCaptions')) {
    if (!platforms.length && !options.create) {
      if (!isRecord(value.platformCaptions)) invalid();
      const captions: Record<string, string> = {};
      for (const [platform, captionValue] of Object.entries(
        value.platformCaptions as Record<string, unknown>,
      )) {
        if (!REPORTING_PLATFORMS.includes(platform as never)) invalid();
        const caption = text(captionValue, 10_000);
        checkPmLanguage(caption);
        captions[platform] = caption;
      }
      add('platformCaptions', captions);
    } else {
      add('platformCaptions', platformCaptions(value.platformCaptions, platforms));
    }
  } else if (options.create) add('platformCaptions', {});
  if (has('firstComment')) {
    const firstComment = optionalText(value.firstComment, 5_000);
    checkPmLanguage(firstComment);
    add('firstComment', firstComment);
  }
  if (has('approvalDeadline')) add('approvalDeadline', optionalDate(value.approvalDeadline));
  if (has('approvers')) add('approvers', stringArray(value.approvers, 20, 160));
  if (has('campaign')) add('campaign', optionalText(value.campaign, 200));
  if (has('contentPillar')) add('contentPillar', optionalText(value.contentPillar, 200));
  if (has('priorityTier')) add('priorityTier', enumValue(value.priorityTier, PRIORITY_TIERS));
  if (has('url')) add('url', httpsUrl(value.url));
  if (has('contentCategory'))
    add('contentCategory', enumValue(value.contentCategory, CONTENT_CATEGORIES));
  if (has('responseMode')) add('responseMode', enumValue(value.responseMode, RESPONSE_MODES));
  if (has('signOffRoute')) add('signOffRoute', enumValue(value.signOffRoute, SIGN_OFF_ROUTES));
  if (has('audienceSegments'))
    add('audienceSegments', stringArray(value.audienceSegments, 20, 160));
  if (has('sourceVerified')) {
    if (typeof value.sourceVerified !== 'boolean') invalid();
    add('sourceVerified', value.sourceVerified);
  }
  if (has('linkPlacement')) add('linkPlacement', enumValue(value.linkPlacement, LINK_PLACEMENTS));
  if (has('ctaType')) add('ctaType', enumValue(value.ctaType, CTA_TYPES));
  if (has('script')) {
    const script = optionalText(value.script, 50_000);
    checkPmLanguage(script);
    add('script', script);
  }
  if (has('designCopy')) {
    const designCopy = optionalText(value.designCopy, 20_000);
    checkPmLanguage(designCopy);
    add('designCopy', designCopy);
  }
  if (has('carouselSlides')) {
    const slides = stringArray(value.carouselSlides, 20, 5_000);
    slides.forEach(checkPmLanguage);
    add('carouselSlides', slides);
  }
  if (!options.create && !Object.keys(result).length) invalid();
  return result;
};

const qualitative = (value: unknown): Record<string, string> => {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) invalid();
  const fields = value as Record<string, unknown>;
  exactKeys(fields, QUALITATIVE_FIELDS);
  return Object.fromEntries(
    Object.entries(fields).map(([key, fieldValue]) => {
      const copy = optionalText(fieldValue, 10_000);
      checkPmLanguage(copy);
      return [key, copy];
    }),
  );
};

const evidenceReferences = (value: unknown): Record<string, string>[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 50) invalid();
  return (value as unknown[]).map((item) => {
    if (!isRecord(item)) return invalid();
    exactKeys(item, new Set(['entryId', 'claim']), ['entryId', 'claim']);
    return {
      entryId: identifier(item.entryId),
      claim: text(item.claim, 1_000, { required: true }),
    };
  });
};

interface ManualMetric {
  value: number;
  source: string;
}

const manualMetrics = (value: unknown): Record<string, Record<string, ManualMetric>> => {
  if (value === undefined || value === null) return {};
  if (!isRecord(value) || Object.keys(value).length > REPORTING_PLATFORMS.length) invalid();
  const result: Record<string, Record<string, ManualMetric>> = {};
  for (const [platform, metricsValue] of Object.entries(value)) {
    if (!REPORTING_PLATFORMS.includes(platform as never) || !isRecord(metricsValue)) invalid();
    if (Object.keys(metricsValue).length > 50) invalid();
    result[platform] = {};
    for (const [metric, metricValue] of Object.entries(metricsValue)) {
      if (!/^[A-Za-z][A-Za-z0-9]{1,63}$/.test(metric) || !isRecord(metricValue)) invalid();
      const metricRecord = metricValue as Record<string, unknown>;
      exactKeys(metricRecord, new Set(['value', 'source']), ['value', 'source']);
      const number = metricRecord.value;
      if (typeof number !== 'number' || !Number.isFinite(number) || Math.abs(number) > 1e12)
        invalid();
      result[platform][metric] = {
        value: number as number,
        source: text(metricRecord.source, 500, { required: true }),
      };
    }
  }
  return result;
};

const storedReportEvidence = (report: Record<string, unknown>): Record<string, unknown> =>
  isRecord(report.agentEvidence)
    ? report.agentEvidence
    : isRecord(report.agent_evidence)
      ? report.agent_evidence
      : {};

const preserveSavedReportMetrics = (
  report: Record<string, unknown>,
  supplied: Record<string, Record<string, ManualMetric>>,
): { metrics: Record<string, Record<string, number>>; sources: Record<string, unknown> } => {
  const storedMetrics = isRecord(report.platformMetrics)
    ? report.platformMetrics
    : isRecord(report.platform_metrics)
      ? report.platform_metrics
      : {};
  const evidence = storedReportEvidence(report);
  const storedCoverage = isRecord(evidence.coverage) ? evidence.coverage : {};
  const metrics: Record<string, Record<string, number>> = {};
  const sources: Record<string, unknown> = {};

  for (const platform of REPORTING_PLATFORMS) {
    const storedPlatform = isRecord(storedMetrics[platform]) ? storedMetrics[platform] : {};
    const platformMetrics = Object.fromEntries(
      Object.entries(storedPlatform).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === 'number' && Number.isFinite(entry[1]),
      ),
    );
    for (const [metric, manual] of Object.entries(supplied[platform] ?? {})) {
      platformMetrics[metric] = manual.value;
    }
    if (Object.keys(platformMetrics).length) metrics[platform] = platformMetrics;

    const storedPlatformCoverage = isRecord(storedCoverage[platform])
      ? storedCoverage[platform]
      : {};
    const storedManual = isRecord(storedPlatformCoverage.manual)
      ? storedPlatformCoverage.manual
      : {};
    sources[platform] = {
      ...(Object.keys(storedPlatformCoverage).length
        ? storedPlatformCoverage
        : {
            source: 'existing_saved_report',
            preservedMetricsWithoutSource: Object.keys(platformMetrics),
          }),
      manual: {
        ...storedManual,
        ...Object.fromEntries(
          Object.entries(supplied[platform] ?? {}).map(([metric, manual]) => [
            metric,
            manual.source,
          ]),
        ),
      },
    };
  }
  return { metrics, sources };
};

const storedManualMetrics = (
  report: Record<string, unknown>,
): Record<string, Record<string, ManualMetric>> => {
  const storedMetrics = isRecord(report.platformMetrics)
    ? report.platformMetrics
    : isRecord(report.platform_metrics)
      ? report.platform_metrics
      : {};
  const evidence = storedReportEvidence(report);
  const storedCoverage = isRecord(evidence.coverage) ? evidence.coverage : {};
  const result: Record<string, Record<string, ManualMetric>> = {};

  for (const platform of REPORTING_PLATFORMS) {
    const platformMetrics = isRecord(storedMetrics[platform]) ? storedMetrics[platform] : {};
    const platformCoverage = isRecord(storedCoverage[platform]) ? storedCoverage[platform] : {};
    const manualSources = isRecord(platformCoverage.manual) ? platformCoverage.manual : {};
    for (const [metric, source] of Object.entries(manualSources)) {
      const value = platformMetrics[metric];
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        typeof source !== 'string' ||
        !source.trim()
      ) {
        continue;
      }
      result[platform] ??= {};
      result[platform][metric] = { value, source };
    }
  }
  return result;
};

const mergeManualMetrics = (
  base: Record<string, Record<string, ManualMetric>>,
  override: Record<string, Record<string, ManualMetric>>,
): Record<string, Record<string, ManualMetric>> =>
  Object.fromEntries(
    REPORTING_PLATFORMS.flatMap((platform) => {
      const merged = { ...(base[platform] ?? {}), ...(override[platform] ?? {}) };
      return Object.keys(merged).length ? [[platform, merged]] : [];
    }),
  );

const reportRange = (value: Record<string, unknown>): Record<string, unknown> => {
  const reportType = enumValue(value.reportType, REPORT_TYPES);
  const periodYear = integer(value.periodYear, 2020, 2100);
  let startDate: string;
  let endDate: string;
  let periodMonth: number | null = null;
  let periodQuarter: number | null = null;
  let campaignName: string | null = null;

  if (reportType === 'monthly') {
    periodMonth = integer(value.periodMonth, 1, 12);
    startDate = `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`;
    endDate = new Date(Date.UTC(periodYear, periodMonth, 0)).toISOString().slice(0, 10);
  } else if (reportType === 'quarterly') {
    periodQuarter = integer(value.periodQuarter, 1, 4);
    const firstMonth = (periodQuarter - 1) * 3;
    startDate = new Date(Date.UTC(periodYear, firstMonth, 1)).toISOString().slice(0, 10);
    endDate = new Date(Date.UTC(periodYear, firstMonth + 3, 0)).toISOString().slice(0, 10);
  } else if (reportType === 'annual') {
    startDate = `${periodYear}-01-01`;
    endDate = `${periodYear}-12-31`;
  } else {
    campaignName = text(value.campaignName, 200, { required: true });
    startDate = isoDate(value.dateFrom);
    endDate = isoDate(value.dateTo);
    if (endDate < startDate) invalid();
  }
  return {
    reportType,
    periodMonth,
    periodQuarter,
    periodYear,
    campaignName,
    dateFrom: reportType === 'campaign' ? startDate : null,
    dateTo: reportType === 'campaign' ? endDate : null,
    startDate,
    endDate,
  };
};

const snapshotToReportMetrics = (
  snapshot: Record<string, unknown>,
  supplied: Record<string, Record<string, ManualMetric>>,
): { metrics: Record<string, Record<string, number>>; sources: Record<string, unknown> } => {
  const rawSnapshots = isRecord(snapshot.snapshots) ? snapshot.snapshots : {};
  const metrics: Record<string, Record<string, number>> = {};
  const sources: Record<string, unknown> = {};
  for (const platform of REPORTING_PLATFORMS) {
    const platformSnapshot = isRecord(rawSnapshots[platform]) ? rawSnapshots[platform] : {};
    const totals = isRecord(platformSnapshot.totals) ? platformSnapshot.totals : {};
    const derived = isRecord(platformSnapshot.derivedMetrics)
      ? platformSnapshot.derivedMetrics
      : {};
    const platformMetrics: Record<string, number> = {};
    const copy = (target: string, source: Record<string, unknown>, key: string) => {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value)) platformMetrics[target] = value;
    };
    copy('numberOfPosts', platformSnapshot, 'postsInWindow');
    copy('impressions', totals, 'impressions');
    copy(
      platform === 'Instagram'
        ? 'accountsReached'
        : platform === 'LinkedIn'
          ? 'membersReached'
          : 'reach',
      totals,
      'reach',
    );
    copy('views', totals, 'views');
    copy(platform === 'LinkedIn' ? 'reactions' : 'likes', totals, 'likes');
    copy('comments', totals, 'comments');
    copy(
      platform === 'Instagram' || platform === 'LinkedIn' ? 'reposts' : 'shares',
      totals,
      'shares',
    );
    copy('saves', totals, 'saves');
    copy('clicks', totals, 'clicks');
    copy('engagements', derived, 'totalEngagements');
    copy('engagementRate', derived, 'engagementRatePercent');
    copy('ctr', derived, 'clickThroughRatePercent');
    if (platform === 'YouTube') copy('subscribers', totals, 'subscribersGained');
    const suppliedMetrics = supplied[platform] ?? {};
    for (const [metric, manual] of Object.entries(suppliedMetrics)) {
      platformMetrics[metric] = manual.value;
    }
    if (Object.keys(platformMetrics).length) metrics[platform] = platformMetrics;
    sources[platform] = {
      source: 'content_hub_entries',
      postsInWindow: platformSnapshot.postsInWindow ?? 0,
      postsWithAnalytics: platformSnapshot.postsWithAnalytics ?? 0,
      analyticsCoveragePercent: platformSnapshot.analyticsCoveragePercent ?? null,
      dataStatus: platformSnapshot.dataStatus ?? 'no_recent_posts',
      manual: Object.fromEntries(
        Object.entries(suppliedMetrics).map(([metric, manual]) => [metric, manual.source]),
      ),
    };
  }
  return { metrics, sources };
};

const actionType = (value: unknown): AgentActionType => {
  if (typeof value !== 'string' || !AGENT_ACTION_TYPES.includes(value as AgentActionType))
    invalid();
  return value as AgentActionType;
};

export const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const actionSummary = (
  type: AgentActionType,
  targetId: string | null,
  payload: Record<string, unknown>,
): string => {
  if (type === 'create_idea') return `Create idea “${String(payload.title)}”.`;
  if (type === 'create_entry') {
    return `Create Draft entry for ${String(payload.date)} on ${(payload.platforms as string[]).join(', ')}.`;
  }
  if (type === 'update_entry') {
    return `Update entry ${targetId} fields: ${Object.keys(
      payload.changes as Record<string, unknown>,
    )
      .sort()
      .join(', ')}.`;
  }
  if (type === 'add_comment') return `Add one PM Hermes comment to entry ${targetId}.`;
  if (type === 'submit_for_review') return `Move Draft entry ${targetId} to Ready for Review.`;
  const period =
    payload.reportType === 'campaign'
      ? `${String(payload.campaignName)} (${String(payload.startDate)} to ${String(payload.endDate)})`
      : `${String(payload.reportType)} ${String(payload.periodYear)}`;
  return type === 'create_report'
    ? `Create saved ${period} report from Content Hub analytics.`
    : `Update saved report ${targetId} for ${period}; ${
        payload.refreshCalculatedMetrics
          ? 'refresh calculated metrics from current Content Hub analytics'
          : 'preserve the saved metrics'
      }.`;
};

const publicAction = (action: AgentActionRecord): Record<string, unknown> => ({
  actionId: action.id,
  actionType: action.actionType,
  targetId: action.targetId,
  payloadHash: action.payloadHash,
  shortPayloadHash: action.payloadHash.slice(0, 12),
  idempotencyKey: action.idempotencyKey,
  summary: action.summary,
  status: action.status,
  expiresAt: action.expiresAt,
  resultClass: action.resultClass,
  result: action.result,
  createdAt: action.createdAt,
  appliedAt: action.appliedAt,
});

export const parseEnabledAgentActions = (value: string): ReadonlySet<AgentActionType> =>
  new Set(
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item): item is AgentActionType =>
        AGENT_ACTION_TYPES.includes(item as AgentActionType),
      ),
  );

export async function proposeAgentAction(
  parameters: Record<string, unknown>,
  clientId: string,
  repository: AgentActionRepository,
  now: Date,
): Promise<Record<string, unknown>> {
  exactKeys(parameters, new Set(['actionType', 'payload', 'idempotencyKey', 'expiresInMinutes']), [
    'actionType',
    'payload',
    'idempotencyKey',
  ]);
  const type = actionType(parameters.actionType);
  if (!isRecord(parameters.payload)) invalid();
  const requestedPayload = parameters.payload as Record<string, unknown>;
  const key = idempotencyKey(parameters.idempotencyKey);
  const expiresInMinutes =
    parameters.expiresInMinutes === undefined ? 30 : integer(parameters.expiresInMinutes, 5, 120);
  let payload: Record<string, unknown>;
  let targetId: string | null = null;

  if (type === 'create_idea') {
    exactKeys(
      requestedPayload,
      new Set(['type', 'title', 'notes', 'links', 'inspiration', 'targetDate', 'targetMonth']),
      ['title'],
    );
    const targetDate = optionalDate(requestedPayload.targetDate);
    const targetMonth =
      requestedPayload.targetMonth === undefined ||
      requestedPayload.targetMonth === null ||
      requestedPayload.targetMonth === ''
        ? (targetDate?.slice(0, 7) ?? null)
        : text(requestedPayload.targetMonth, 7, { required: true });
    if (targetMonth !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) invalid();
    const title = text(requestedPayload.title, 500, { required: true });
    const notes = optionalText(requestedPayload.notes, 10_000);
    const inspiration = optionalText(requestedPayload.inspiration, 10_000);
    [title, notes, inspiration].forEach(checkPmLanguage);
    payload = {
      type:
        requestedPayload.type === undefined
          ? 'Other'
          : enumValue(requestedPayload.type, IDEA_TYPES),
      title,
      notes,
      links:
        requestedPayload.links === undefined
          ? []
          : stringArray(requestedPayload.links, 20, 2_000).map(httpsUrl),
      inspiration,
      targetDate,
      targetMonth,
    };
  } else if (type === 'create_entry') {
    payload = normaliseEntryFields(requestedPayload, { create: true });
  } else if (type === 'update_entry') {
    exactKeys(
      requestedPayload,
      new Set(['entryId', 'expectedContentRevision', 'expectedUpdatedAt', 'changes']),
      ['entryId', 'expectedContentRevision', 'expectedUpdatedAt', 'changes'],
    );
    targetId = identifier(requestedPayload.entryId);
    if (!isRecord(requestedPayload.changes)) invalid();
    const entry = await repository.getEntry(targetId);
    if (!entry) throw new AgentActionError('not_found', 'The target entry was not found.', 404);
    if (!['Draft', 'In Review', 'Ready for Review'].includes(entryWorkflowStatus(entry))) {
      throw new AgentActionError(
        'conflict',
        'The target entry is not eligible for PM Hermes updates.',
        409,
      );
    }
    const expectedContentRevision = integer(
      requestedPayload.expectedContentRevision,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const expectedUpdatedAt = isoTimestamp(requestedPayload.expectedUpdatedAt);
    if (
      Number(entry.contentRevision ?? entry.content_revision) !== expectedContentRevision ||
      !sameTimestamp(entry.updatedAt ?? entry.updated_at, expectedUpdatedAt)
    ) {
      throw new AgentActionError(
        'conflict',
        'The target entry changed before the proposal could be created.',
        409,
      );
    }
    payload = {
      entryId: targetId,
      expectedContentRevision,
      expectedUpdatedAt,
      changes: normaliseEntryFields(requestedPayload.changes as Record<string, unknown>, {
        create: false,
      }),
    };
  } else if (type === 'add_comment') {
    exactKeys(requestedPayload, new Set(['entryId', 'expectedUpdatedAt', 'body']), [
      'entryId',
      'expectedUpdatedAt',
      'body',
    ]);
    targetId = identifier(requestedPayload.entryId);
    const entry = await repository.getEntry(targetId);
    if (!entry) throw new AgentActionError('not_found', 'The target entry was not found.', 404);
    if (!['Draft', 'In Review', 'Ready for Review'].includes(entryWorkflowStatus(entry))) {
      throw new AgentActionError(
        'conflict',
        'The target entry is not eligible for PM Hermes comments.',
        409,
      );
    }
    const expectedUpdatedAt = isoTimestamp(requestedPayload.expectedUpdatedAt);
    if (!sameTimestamp(entry.updatedAt ?? entry.updated_at, expectedUpdatedAt)) {
      throw new AgentActionError(
        'conflict',
        'The target entry changed before the proposal could be created.',
        409,
      );
    }
    payload = {
      entryId: targetId,
      expectedUpdatedAt,
      body: text(requestedPayload.body, 5_000, { required: true }),
    };
  } else if (type === 'submit_for_review') {
    exactKeys(
      requestedPayload,
      new Set(['entryId', 'expectedContentRevision', 'expectedUpdatedAt']),
      ['entryId', 'expectedContentRevision', 'expectedUpdatedAt'],
    );
    targetId = identifier(requestedPayload.entryId);
    const entry = await repository.getEntry(targetId);
    if (!entry) throw new AgentActionError('not_found', 'The target entry was not found.', 404);
    if (entryWorkflowStatus(entry) !== 'Draft') {
      throw new AgentActionError(
        'conflict',
        'Only Draft entries can be submitted for review.',
        409,
      );
    }
    const expectedContentRevision = integer(
      requestedPayload.expectedContentRevision,
      1,
      Number.MAX_SAFE_INTEGER,
    );
    const expectedUpdatedAt = isoTimestamp(requestedPayload.expectedUpdatedAt);
    if (
      Number(entry.contentRevision ?? entry.content_revision) !== expectedContentRevision ||
      !sameTimestamp(entry.updatedAt ?? entry.updated_at, expectedUpdatedAt)
    ) {
      throw new AgentActionError(
        'conflict',
        'The target entry changed before the proposal could be created.',
        409,
      );
    }
    payload = {
      entryId: targetId,
      expectedContentRevision,
      expectedUpdatedAt,
    };
  } else {
    const reportAllowed =
      type === 'update_report'
        ? new Set([
            'reportId',
            'expectedUpdatedAt',
            'qualitative',
            'evidenceReferences',
            'manualMetrics',
            'refreshCalculatedMetrics',
          ])
        : new Set([
            'reportType',
            'periodMonth',
            'periodQuarter',
            'periodYear',
            'campaignName',
            'dateFrom',
            'dateTo',
            'qualitative',
            'evidenceReferences',
            'manualMetrics',
          ]);
    exactKeys(
      requestedPayload,
      reportAllowed,
      type === 'update_report' ? ['reportId', 'expectedUpdatedAt'] : ['reportType', 'periodYear'],
    );
    let rangeSource: Record<string, unknown> = requestedPayload;
    let expectedUpdatedAt: string | null = null;
    let existingReport: Record<string, unknown> | null = null;
    if (type === 'update_report') {
      targetId = identifier(requestedPayload.reportId);
      existingReport = await repository.getReport(targetId);
      if (!existingReport)
        throw new AgentActionError('not_found', 'The target report was not found.', 404);
      rangeSource = {
        reportType: existingReport.reportType,
        periodMonth: existingReport.periodMonth,
        periodQuarter: existingReport.periodQuarter,
        periodYear: existingReport.periodYear,
        campaignName: existingReport.campaignName,
        dateFrom: existingReport.dateFrom,
        dateTo: existingReport.dateTo,
      };
      expectedUpdatedAt = isoTimestamp(requestedPayload.expectedUpdatedAt);
      if (
        !sameTimestamp(existingReport.updatedAt ?? existingReport.updated_at, expectedUpdatedAt)
      ) {
        throw new AgentActionError(
          'conflict',
          'The target report changed before the proposal could be created.',
          409,
        );
      }
    }
    const range = reportRange(rangeSource);
    const rows = await repository.getReportingEntries({
      startDate: String(range.startDate),
      endDate: String(range.endDate),
      ...(range.campaignName ? { campaign: String(range.campaignName) } : {}),
      limit: 5_000,
    });
    if (rows.truncated)
      invalid('The report range contains too many entries for an exact proposal.');
    const snapshot = buildReportingSnapshot(rows.rows, {
      startDate: String(range.startDate),
      endDate: String(range.endDate),
      ...(range.campaignName ? { campaign: String(range.campaignName) } : {}),
    });
    const supplied = manualMetrics(requestedPayload.manualMetrics);
    if (
      requestedPayload.refreshCalculatedMetrics !== undefined &&
      typeof requestedPayload.refreshCalculatedMetrics !== 'boolean'
    ) {
      invalid();
    }
    const refreshCalculatedMetrics = requestedPayload.refreshCalculatedMetrics === true;
    const reportMetrics =
      existingReport && !refreshCalculatedMetrics
        ? preserveSavedReportMetrics(existingReport, supplied)
        : snapshotToReportMetrics(
            snapshot,
            existingReport
              ? mergeManualMetrics(storedManualMetrics(existingReport), supplied)
              : supplied,
          );
    const previousEvidence = existingReport ? storedReportEvidence(existingReport) : {};
    const references = evidenceReferences(
      requestedPayload.evidenceReferences ??
        (Array.isArray(previousEvidence.references) ? previousEvidence.references : undefined),
    );
    const referencedEntries = await Promise.all(
      references.map((reference) => repository.getEntry(reference.entryId)),
    );
    if (referencedEntries.some((entry) => entry === null)) {
      invalid('A report evidence reference does not identify a live Content Hub entry.');
    }
    if (
      referencedEntries.some((entry) => {
        const entryDate = entry?.date;
        return (
          typeof entryDate !== 'string' ||
          entryDate < String(range.startDate) ||
          entryDate > String(range.endDate)
        );
      })
    ) {
      invalid('A report evidence reference falls outside the reporting period.');
    }
    if (
      range.campaignName &&
      referencedEntries.some(
        (entry) => String(entry?.campaign ?? '') !== String(range.campaignName),
      )
    ) {
      invalid('A campaign report evidence reference belongs to another campaign.');
    }
    const existingQualitative =
      existingReport && isRecord(existingReport.qualitative) ? existingReport.qualitative : {};
    payload = {
      ...range,
      expectedUpdatedAt,
      platformMetrics: reportMetrics.metrics,
      ...(existingReport ? { refreshCalculatedMetrics } : {}),
      qualitative: {
        ...existingQualitative,
        ...qualitative(requestedPayload.qualitative),
      },
      evidence: {
        source:
          existingReport && !refreshCalculatedMetrics && typeof previousEvidence.source === 'string'
            ? previousEvidence.source
            : existingReport && !refreshCalculatedMetrics
              ? 'existing_saved_report'
              : 'content_hub_entries',
        coverage: reportMetrics.sources,
        references,
      },
    };
  }

  const payloadHash = await sha256(stableStringify({ actionType: type, payload }));
  const summary = actionSummary(type, targetId, payload);
  const expiresAt = new Date(now.getTime() + expiresInMinutes * 60_000).toISOString();
  const action = await repository.createAction({
    clientId,
    actionType: type,
    targetId,
    payload,
    payloadHash,
    idempotencyKey: key,
    summary,
    expiresAt,
  });
  return {
    action: publicAction(action),
    review: {
      summary,
      proposedValues: payload,
      exactConfirmation: `execute ${action.id}`,
    },
  };
}

export const getPublicAgentAction = (action: AgentActionRecord): Record<string, unknown> =>
  publicAction(action);

export const parseActionId = identifier;
export const parseActionHash = (value: unknown): string => {
  const normalised = text(value, 64, { required: true });
  if (!/^[a-f0-9]{64}$/.test(normalised)) invalid();
  return normalised;
};
export const parseIdempotencyKey = idempotencyKey;
export const parseApprovalReference = (value: unknown): string => {
  const normalised = text(value, 28, { required: true });
  if (!/^cha_[a-f0-9]{24}$/.test(normalised)) invalid();
  return normalised;
};
export const parseApprovedBy = (value: unknown): string => text(value, 160, { required: true });
