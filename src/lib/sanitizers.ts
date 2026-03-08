/**
 * Sanitisation functions for data normalisation
 */
import {
  ASSET_TYPES,
  CAMPAIGNS,
  CONTENT_PILLARS,
  CONTENT_CATEGORIES,
  CTA_TYPES,
  EXECUTION_STATUSES,
  ALL_CHECKLIST_ITEMS,
  getChecklistItemsForEntry,
  KANBAN_STATUSES,
  LEGACY_STATUS_MAP,
  LINK_PLACEMENTS,
  IDEA_TYPES,
  PRIORITY_TIERS,
  RESPONSE_MODES,
  SIGN_OFF_ROUTES,
  WORKFLOW_STAGES,
} from '../constants';
import {
  uuid,
  ensureArray,
  ensurePeopleArray,
  ensureLinksArray,
  ensureAttachments,
  extractMentions,
  serializeForComparison,
} from './utils';
import type { Entry, Idea, Comment } from '../types/models';

// Type for checklist object
export type Checklist = Record<string, boolean>;

// Type for analytics data
export type Analytics = Record<string, Record<string, unknown>>;

// Type for platform captions
export type PlatformCaptions = Record<string, string>;

// Checklist helpers
export const createEmptyChecklist = (): Checklist => {
  const checklist: Checklist = {};
  ALL_CHECKLIST_ITEMS.forEach(({ key }) => {
    checklist[key] = false;
  });
  return checklist;
};

export const ensureChecklist = (value: unknown): Checklist => {
  const base = createEmptyChecklist();
  if (value && typeof value === 'object') {
    const valueObj = value as Record<string, unknown>;
    Object.keys(base).forEach((key) => {
      base[key] = Boolean(valueObj[key]);
    });
  }
  return base;
};

// Comments helper
export const ensureComments = (value: unknown): Comment[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (comment): comment is Record<string, unknown> =>
        comment && typeof comment === 'object' && 'body' in comment && Boolean(comment.body),
    )
    .map((comment) => ({
      id: typeof comment.id === 'string' ? comment.id : uuid(),
      author: typeof comment.author === 'string' ? comment.author : 'Unknown',
      body: String(comment.body),
      createdAt:
        typeof comment.createdAt === 'string' ? comment.createdAt : new Date().toISOString(),
      mentions:
        Array.isArray(comment.mentions) && comment.mentions.length
          ? (comment.mentions as string[])
          : extractMentions(String(comment.body)),
    }));
};

// Analytics helper
export const ensureAnalytics = (value: unknown): Analytics => {
  if (!value || typeof value !== 'object') return {};
  const valueObj = value as Record<string, unknown>;
  const analytics: Analytics = {};
  Object.entries(valueObj).forEach(([platform, metrics]) => {
    if (!platform) return;
    if (!metrics || typeof metrics !== 'object') return;
    const metricsObj = metrics as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    Object.entries(metricsObj).forEach(([key, metricValue]) => {
      if (metricValue === undefined || metricValue === null || metricValue === '') return;
      cleaned[key] = metricValue;
    });
    analytics[platform] = cleaned;
  });
  return analytics;
};

// Platform captions helper
export const ensurePlatformCaptions = (value: unknown): PlatformCaptions => {
  if (!value || typeof value !== 'object') return {};
  const valueObj = value as Record<string, unknown>;
  const cleaned: PlatformCaptions = {};
  Object.entries(valueObj).forEach(([key, val]) => {
    if (typeof val === 'string') cleaned[key] = val;
  });
  return cleaned;
};

// Helper to check if value is in readonly array
const isInArray = <T extends readonly string[]>(arr: T, value: string): value is T[number] =>
  arr.includes(value as T[number]);

// Main entry sanitizer
export const sanitizeEntry = (entry: unknown): Entry | null => {
  if (!entry || typeof entry !== 'object') return null;
  const raw = entry as Record<string, unknown>;

  const approvers = ensurePeopleArray(raw.approvers ?? raw.approver);
  const platforms = ensureArray(raw.platforms);
  const assetType =
    typeof raw.assetType === 'string' && isInArray(ASSET_TYPES, raw.assetType)
      ? raw.assetType
      : 'Design';
  const priorityTier =
    typeof raw.priorityTier === 'string' && isInArray(PRIORITY_TIERS, raw.priorityTier)
      ? raw.priorityTier
      : 'Medium';
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString();
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt;
  const author =
    typeof raw.author === 'string'
      ? raw.author.trim()
      : raw.author
        ? String(raw.author).trim()
        : '';
  const caption = typeof raw.caption === 'string' ? raw.caption : '';
  const url = typeof raw.url === 'string' ? raw.url.trim() : raw.url ? String(raw.url).trim() : '';
  const firstComment = typeof raw.firstComment === 'string' ? raw.firstComment : '';

  const workflowStatus = (() => {
    const rawWf = typeof raw.workflowStatus === 'string' ? raw.workflowStatus : '';
    if (isInArray(KANBAN_STATUSES, rawWf)) return rawWf;
    if (rawWf && LEGACY_STATUS_MAP[rawWf]) return LEGACY_STATUS_MAP[rawWf];
    // Legacy fallback: derive from raw.status field
    if (typeof raw.status === 'string' && raw.status.toLowerCase() === 'approved')
      return 'Approved';
    return 'Draft';
  })();
  // status is always derived from workflowStatus — never set independently
  const status = workflowStatus === 'Approved' ? 'Approved' : 'Pending';

  const base: Entry = {
    ...(raw as Partial<Entry>),
    id: typeof raw.id === 'string' ? raw.id : uuid(),
    date: typeof raw.date === 'string' ? raw.date : new Date().toISOString().slice(0, 10),
    status,
    priorityTier,
    approvers,
    author,
    caption,
    url,
    approvalDeadline: typeof raw.approvalDeadline === 'string' ? raw.approvalDeadline : '',
    campaign:
      typeof raw.campaign === 'string' && isInArray(CAMPAIGNS, raw.campaign) ? raw.campaign : '',
    contentPillar:
      typeof raw.contentPillar === 'string' && isInArray(CONTENT_PILLARS, raw.contentPillar)
        ? raw.contentPillar
        : '',
    analytics: ensureAnalytics(raw.analytics),
    analyticsUpdatedAt: typeof raw.analyticsUpdatedAt === 'string' ? raw.analyticsUpdatedAt : '',
    testingFrameworkId: typeof raw.testingFrameworkId === 'string' ? raw.testingFrameworkId : '',
    testingFrameworkName:
      typeof raw.testingFrameworkName === 'string' ? raw.testingFrameworkName : '',
    assetType,
    script: assetType === 'Video' && typeof raw.script === 'string' ? raw.script : undefined,
    designCopy:
      assetType === 'Design' && typeof raw.designCopy === 'string' ? raw.designCopy : undefined,
    carouselSlides:
      assetType === 'Carousel' && Array.isArray(raw.carouselSlides)
        ? raw.carouselSlides.map((slide) => (typeof slide === 'string' ? slide : ''))
        : assetType === 'Carousel'
          ? ['', '', '']
          : undefined,
    firstComment,
    checklist: ensureChecklist(raw.checklist),
    comments: ensureComments(raw.comments),
    platformCaptions: ensurePlatformCaptions(raw.platformCaptions),
    platforms,
    previewUrl: raw.previewUrl ? String(raw.previewUrl) : '',
    createdAt,
    updatedAt,
    workflowStatus,
    statusDetail: typeof raw.statusDetail === 'string' ? raw.statusDetail : '',
    aiFlags: Array.isArray(raw.aiFlags) ? (raw.aiFlags as string[]) : [],
    aiScore:
      raw.aiScore && typeof raw.aiScore === 'object' ? (raw.aiScore as Record<string, number>) : {},
    approvedAt: typeof raw.approvedAt === 'string' ? raw.approvedAt : null,
    deletedAt: typeof raw.deletedAt === 'string' ? raw.deletedAt : null,
  };

  if (assetType !== 'Video') base.script = undefined;
  if (assetType !== 'Design') base.designCopy = undefined;
  if (assetType !== 'Carousel') base.carouselSlides = undefined;

  // Strategy alignment fields
  base.audienceSegments = Array.isArray(raw.audienceSegments)
    ? (raw.audienceSegments as string[]).filter((s) => typeof s === 'string')
    : [];
  base.contentCategory =
    typeof raw.contentCategory === 'string' && isInArray(CONTENT_CATEGORIES, raw.contentCategory)
      ? raw.contentCategory
      : undefined;
  base.responseMode =
    typeof raw.responseMode === 'string' && isInArray(RESPONSE_MODES, raw.responseMode)
      ? raw.responseMode
      : undefined;
  base.signOffRoute =
    typeof raw.signOffRoute === 'string' && isInArray(SIGN_OFF_ROUTES, raw.signOffRoute)
      ? raw.signOffRoute
      : undefined;
  base.contentPeak =
    typeof raw.contentPeak === 'string' && raw.contentPeak.trim()
      ? raw.contentPeak.trim()
      : undefined;
  base.seriesName =
    typeof raw.seriesName === 'string' && raw.seriesName.trim() ? raw.seriesName.trim() : undefined;
  base.originContentId =
    typeof raw.originContentId === 'string' && raw.originContentId.trim()
      ? raw.originContentId.trim()
      : undefined;
  base.partnerOrg =
    typeof raw.partnerOrg === 'string' && raw.partnerOrg.trim() ? raw.partnerOrg.trim() : undefined;
  base.altTextStatus =
    typeof raw.altTextStatus === 'string' && isInArray(EXECUTION_STATUSES, raw.altTextStatus)
      ? raw.altTextStatus
      : undefined;
  base.subtitlesStatus =
    typeof raw.subtitlesStatus === 'string' && isInArray(EXECUTION_STATUSES, raw.subtitlesStatus)
      ? raw.subtitlesStatus
      : undefined;
  base.utmStatus =
    typeof raw.utmStatus === 'string' && isInArray(EXECUTION_STATUSES, raw.utmStatus)
      ? raw.utmStatus
      : undefined;
  base.sourceVerified = typeof raw.sourceVerified === 'boolean' ? raw.sourceVerified : undefined;
  base.seoPrimaryQuery =
    typeof raw.seoPrimaryQuery === 'string' && raw.seoPrimaryQuery.trim()
      ? raw.seoPrimaryQuery.trim()
      : undefined;
  base.linkPlacement =
    typeof raw.linkPlacement === 'string' && isInArray(LINK_PLACEMENTS, raw.linkPlacement)
      ? raw.linkPlacement
      : undefined;
  base.ctaType =
    typeof raw.ctaType === 'string' && isInArray(CTA_TYPES, raw.ctaType) ? raw.ctaType : undefined;
  const parsedEpisodeNumber =
    typeof raw.episodeNumber === 'number'
      ? raw.episodeNumber
      : typeof raw.episodeNumber === 'string' && raw.episodeNumber.trim()
        ? Number(raw.episodeNumber)
        : NaN;
  base.episodeNumber =
    Number.isFinite(parsedEpisodeNumber) && parsedEpisodeNumber > 0
      ? Math.round(parsedEpisodeNumber)
      : undefined;
  base.goldenThreadPass = typeof raw.goldenThreadPass === 'boolean' ? raw.goldenThreadPass : null;
  if (raw.assessmentScores && typeof raw.assessmentScores === 'object') {
    const scores = raw.assessmentScores as Record<string, unknown>;
    // Migrate legacy flat shape: { mission, platform, ... } → { full: { mission, platform, ... } }
    if (!scores.full && typeof scores.mission === 'number') {
      scores.full = {
        mission: scores.mission,
        platform: scores.platform,
        engagement: scores.engagement,
        voice: scores.voice,
        pillar: scores.pillar,
      };
      delete scores.mission;
      delete scores.platform;
      delete scores.engagement;
      delete scores.voice;
      delete scores.pillar;
    }
    base.assessmentScores = scores as Entry['assessmentScores'];
  } else {
    base.assessmentScores = null;
  }

  return base;
};

// Idea sanitizer
export const sanitizeIdea = (raw: unknown): Idea | null => {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const ideaType =
    typeof data.type === 'string' && isInArray(IDEA_TYPES, data.type) ? data.type : IDEA_TYPES[0];
  const links = ensureLinksArray(data.links);
  const attachments = ensureAttachments(data.attachments);
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const notes = typeof data.notes === 'string' ? data.notes : '';
  const createdBy = typeof data.createdBy === 'string' ? data.createdBy : '';
  const createdAt = typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString();
  const targetDate = data.targetDate && typeof data.targetDate === 'string' ? data.targetDate : '';
  const monthKey = (iso: string) => (iso ? iso.slice(0, 7) : '');
  const targetMonth =
    data.targetMonth && typeof data.targetMonth === 'string'
      ? data.targetMonth
      : targetDate
        ? monthKey(targetDate)
        : '';

  return {
    id: typeof data.id === 'string' ? data.id : uuid(),
    type: ideaType,
    title,
    notes,
    links,
    attachments,
    inspiration: typeof data.inspiration === 'string' ? data.inspiration : '',
    createdBy,
    createdAt,
    targetDate,
    targetMonth,
    convertedToEntryId:
      typeof data.convertedToEntryId === 'string' ? data.convertedToEntryId : undefined,
    convertedAt: typeof data.convertedAt === 'string' ? data.convertedAt : undefined,
  };
};

// Compute status detail based on checklist completion
export const computeStatusDetail = (entry: Partial<Entry> | null | undefined): string => {
  if (!entry) return WORKFLOW_STAGES[0];
  const checklist = ensureChecklist(entry.checklist);
  const relevantItems = getChecklistItemsForEntry(entry.platforms ?? [], entry.assetType ?? '');
  const total = relevantItems.length || 1;
  const completed = relevantItems.filter(({ key }) => checklist[key]).length;

  if (entry.status === 'Approved') {
    return completed === total ? 'Internals approved' : 'Ready for review';
  }

  if (completed === 0) return 'Briefing';
  if (completed < Math.ceil(total / 3)) return 'Production';
  if (completed < total) return 'Ready for review';
  if (completed >= total) return 'Scheduled';

  return entry.statusDetail || WORKFLOW_STAGES[0];
};

// Get platform-specific caption
export const getPlatformCaption = (
  baseCaption: string,
  platformCaptions: PlatformCaptions | null | undefined,
  platform: string,
): string => {
  if (!platform || platform === 'Main') return baseCaption;
  const custom =
    platformCaptions && typeof platformCaptions === 'object' ? platformCaptions[platform] : null;
  return custom && custom.trim().length ? custom : baseCaption;
};

// Check if URL is an image
export const isImageMedia = (url: unknown): boolean => {
  if (!url) return false;
  if (typeof url !== 'string') return false;
  if (url.startsWith('data:image')) return true;
  const cleaned = url.split('?')[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(cleaned);
};

// Entry signature for change detection
export const entrySignature = (entry: Partial<Entry> | null | undefined): string => {
  if (!entry) return '';
  try {
    return [
      entry.id,
      entry.updatedAt,
      entry.status,
      entry.priorityTier,
      entry.campaign,
      entry.contentPillar,
      entry.caption,
      entry.previewUrl,
      entry.altTextStatus,
      entry.subtitlesStatus,
      entry.utmStatus,
      entry.sourceVerified,
      entry.seoPrimaryQuery,
      entry.linkPlacement,
      entry.ctaType,
      (entry.platforms || []).join('|'),
      JSON.stringify(ensureChecklist(entry.checklist)),
      (entry.comments || []).length,
    ].join('::');
  } catch (error) {
    console.warn('Failed to compute entry signature', error);
    return String(entry.id || 'unknown');
  }
};

// Determine workflow status params
type DetermineWorkflowParams = Partial<
  Pick<
    Entry,
    | 'approvers'
    | 'assetType'
    | 'previewUrl'
    | 'platforms'
    | 'url'
    | 'firstComment'
    | 'altTextStatus'
    | 'subtitlesStatus'
    | 'utmStatus'
    | 'sourceVerified'
    | 'seoPrimaryQuery'
    | 'linkPlacement'
    | 'ctaType'
  >
>;

export interface WorkflowRequirement {
  key: string;
  label: string;
  detail: string;
  required: boolean;
  complete: boolean;
}

const hasExternalLinkContent = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  return /https?:\/\/|www\./i.test(value);
};

export const getExecutionRequirements = (
  entry: Partial<Entry> | null | undefined,
): WorkflowRequirement[] => {
  if (!entry) return [];
  const platforms = Array.isArray(entry.platforms) ? entry.platforms : [];
  const assetType = typeof entry.assetType === 'string' ? entry.assetType : 'No asset';
  const hasExternalLink =
    hasExternalLinkContent(entry.url) ||
    hasExternalLinkContent(entry.firstComment) ||
    (typeof entry.linkPlacement === 'string' && entry.linkPlacement !== 'No external link');
  const requiresAltText = assetType === 'Design' || assetType === 'Carousel';
  const requiresSubtitles = assetType === 'Video';
  const requiresSeoQuery = platforms.some(
    (platform) => platform === 'LinkedIn' || platform === 'YouTube',
  );
  const requiresUtm = hasExternalLink && entry.linkPlacement !== 'No external link';

  return [
    {
      key: 'sourceVerified',
      label: 'Source verified',
      detail: 'Verify the evidence, source ownership, and facts before review.',
      required: true,
      complete: entry.sourceVerified === true,
    },
    {
      key: 'ctaType',
      label: 'CTA defined',
      detail: 'Select the intended call to action before requesting review.',
      required: true,
      complete: typeof entry.ctaType === 'string' && entry.ctaType.trim().length > 0,
    },
    {
      key: 'linkPlacement',
      label: 'Link placement set',
      detail: 'Decide how the external link will be delivered for the post.',
      required: hasExternalLink,
      complete: typeof entry.linkPlacement === 'string' && entry.linkPlacement.trim().length > 0,
    },
    {
      key: 'utmStatus',
      label: 'UTM plan ready',
      detail: 'Mark link tracking as ready before review when the post includes an external link.',
      required: requiresUtm,
      complete: entry.utmStatus === 'Ready',
    },
    {
      key: 'seoPrimaryQuery',
      label: 'SEO query set',
      detail: 'Add the primary search phrase for LinkedIn or YouTube discovery.',
      required: requiresSeoQuery,
      complete:
        typeof entry.seoPrimaryQuery === 'string' && entry.seoPrimaryQuery.trim().length > 0,
    },
    {
      key: 'altTextStatus',
      label: 'Alt text ready',
      detail: 'Alt text is required for image and carousel content.',
      required: requiresAltText,
      complete: entry.altTextStatus === 'Ready',
    },
    {
      key: 'subtitlesStatus',
      label: 'Subtitles/transcript ready',
      detail: 'Video content needs subtitles or a transcript before review.',
      required: requiresSubtitles,
      complete: entry.subtitlesStatus === 'Ready',
    },
  ];
};

export const getWorkflowBlockers = (
  entry: Partial<Entry> | null | undefined,
): WorkflowRequirement[] => {
  if (!entry) return [];
  const requirements = getExecutionRequirements(entry).filter(
    (item) => item.required && !item.complete,
  );
  const needsVisual =
    entry.assetType &&
    entry.assetType !== 'No asset' &&
    !(entry.previewUrl && String(entry.previewUrl).trim());
  if (needsVisual) {
    requirements.unshift({
      key: 'previewUrl',
      label: 'Asset preview uploaded',
      detail: 'Upload or attach the visual asset before sending this for review.',
      required: true,
      complete: false,
    });
  }
  return requirements;
};

// Determine workflow status
export const determineWorkflowStatus = ({
  approvers = [],
  ...entry
}: DetermineWorkflowParams): string => {
  const hasApprovers = Array.isArray(approvers) && approvers.length > 0;
  if (!hasApprovers) return 'Draft';
  if (getWorkflowBlockers({ approvers, ...entry }).length) return 'Draft';
  return 'Ready for Review';
};

// Fields that trigger approver re-notification when changed
export const APPROVER_ALERT_FIELDS: readonly string[] = [
  'date',
  'platforms',
  'assetType',
  'caption',
  'platformCaptions',
  'firstComment',
  'approvalDeadline',
  'campaign',
  'contentPillar',
  'contentCategory',
  'responseMode',
  'signOffRoute',
  'contentPeak',
  'seriesName',
  'episodeNumber',
  'originContentId',
  'partnerOrg',
  'altTextStatus',
  'subtitlesStatus',
  'utmStatus',
  'sourceVerified',
  'seoPrimaryQuery',
  'linkPlacement',
  'ctaType',
  'priorityTier',
  'previewUrl',
  'checklist',
  'analytics',
  'testingFrameworkId',
  'testingFrameworkName',
  'workflowStatus',
  'statusDetail',
  'carouselSlides',
  'designCopy',
  'script',
] as const;

/**
 * Checks if entry changes are relevant to approvers (require re-notification)
 */
export const hasApproverRelevantChanges = (
  previousEntry: Partial<Entry> | null | undefined,
  nextEntry: Partial<Entry> | null | undefined,
): boolean => {
  if (!nextEntry) return false;
  if (!previousEntry) return true;
  return APPROVER_ALERT_FIELDS.some((field) => {
    const prevValue = (previousEntry as Record<string, unknown>)[field];
    const nextValue = (nextEntry as Record<string, unknown>)[field];
    return serializeForComparison(prevValue) !== serializeForComparison(nextValue);
  });
};
