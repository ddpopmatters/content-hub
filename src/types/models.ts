/**
 * Domain model types for PM Dashboard frontend
 */
import type { PriorityTier } from '../constants';
export type { PriorityTier };

/**
 * Attachment model - file attachments with metadata
 */
export interface Attachment {
  id: string;
  name: string;
  dataUrl: string;
  /** Optional URL for externally-hosted attachments */
  url?: string;
  type: string;
  size: number;
}

/**
 * User model - represents a user in the system
 */
export interface User {
  id: string;
  email: string;
  name: string;
  status: string;
  isAdmin: boolean;
  isApprover: boolean;
  avatarUrl: string | null;
  features: string[];
  hasPassword?: boolean;
  invitePending?: boolean;
  inviteExpiresAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
}

/**
 * Entry status - uses capitalised values as per app convention
 */
export type EntryStatus = 'Pending' | 'Approved' | 'Draft' | 'Published';

/**
 * Workflow/Kanban status
 */
// Streamlined 4-status workflow
export type WorkflowStatus = 'Draft' | 'Ready for Review' | 'Approved' | 'Published';

/**
 * Platform publish status - tracks publishing state per platform
 */
export type PublishStatusState = 'pending' | 'publishing' | 'published' | 'failed';

export interface PlatformPublishStatus {
  status: PublishStatusState;
  url: string | null;
  error: string | null;
  timestamp: string | null;
}

/**
 * Publish settings - Zapier webhook configuration
 */
export interface PublishSettings {
  webhookUrl: string;
  webhookSecret: string;
  perPlatformWebhooks?: Record<string, string>;
  autoPublishOnApproval: boolean;
}

/**
 * Entry model - represents a content calendar entry
 * Includes both database fields and UI-computed fields
 */
/** Approver entry with approval status */
export interface ApproverEntry {
  name: string;
  approved: boolean;
  approvedAt?: string;
}

export interface Entry {
  id: string;
  date: string;
  platforms: string[];
  assetType: string;
  caption: string;
  platformCaptions: Record<string, string>;
  firstComment: string;
  status: string;
  priorityTier: PriorityTier;
  approvers: string[];
  author: string;
  campaign: string;
  contentPillar: string;
  previewUrl: string;
  checklist: Record<string, boolean>;
  analytics: Record<string, unknown>;
  workflowStatus: string;
  statusDetail: string;
  aiFlags: string[];
  aiScore: Record<string, number>;
  testingFrameworkId: string;
  testingFrameworkName: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  deletedAt: string | null;
  // Publishing fields
  evergreen?: boolean;
  publishStatus?: Record<string, PlatformPublishStatus>;
  publishedAt?: string | null;
  variantOfId?: string;
  variantIds?: string[];
  relatedEntryIds?: string[];
  // Strategy alignment fields
  audienceSegments?: string[];
  goldenThreadPass?: boolean | null;
  assessmentScores?: {
    full?: {
      mission?: number;
      platform?: number;
      engagement?: number;
      voice?: number;
      pillar?: number;
    };
    quick?: {
      goldenThread?: boolean;
      hook?: boolean;
      platformFit?: boolean;
      shareWorthy?: boolean;
      pmVoice?: boolean;
    };
    goldenThread?: {
      coercion?: boolean;
      blame?: boolean;
      instrumentalisation?: boolean;
      cooption?: boolean;
    };
  } | null;
  // Influencer attribution
  influencerId?: string;
  // Content production fields
  url?: string;
  script?: string;
  designCopy?: string;
  carouselSlides?: string[];
  // Derived/transient fields (not persisted)
  approvalDeadline?: string;
  analyticsUpdatedAt?: string;
  comments?: Comment[];
  links?: string[];
  attachments?: Attachment[];
}

/**
 * Idea model - represents an idea in the ideas bank
 */
export interface Idea {
  id: string;
  type: string;
  title: string;
  notes: string;
  links: string[];
  attachments: Attachment[];
  inspiration: string;
  createdBy: string;
  createdAt: string;
  targetDate: string;
  targetMonth: string;
  /** Entry ID if this idea was converted to an entry */
  convertedToEntryId?: string;
  /** Timestamp when this idea was converted to an entry */
  convertedAt?: string;
}

export type OpportunityUrgency = 'High' | 'Medium' | 'Low';
export type OpportunityStatus = 'Open' | 'Acted' | 'Dismissed';

export interface Opportunity {
  id: string;
  date: string;
  description: string;
  angle: string;
  urgency: OpportunityUrgency;
  status: OpportunityStatus;
  createdBy: string;
  linkedEntryId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ContentRequestStatus = 'Pending' | 'In Progress' | 'Converted' | 'Declined';

export interface ContentRequest {
  id: string;
  title: string;
  keyMessages: string;
  assetsNeeded: string;
  audienceSegments: string[];
  approvers: string[];
  deadline?: string;
  notes: string;
  generatedBrief: string;
  status: ContentRequestStatus;
  createdBy: string;
  convertedEntryId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Notification model
 * Matches the structure created by buildApprovalNotifications/buildMentionNotifications
 */
export interface Notification {
  id?: string;
  key: string;
  type: string;
  entryId: string;
  user: string;
  message: string;
  read?: boolean;
  createdAt: string;
  meta?: Record<string, unknown>;
}

/**
 * Guidelines model - brand/copy guidelines
 */
export interface Guidelines {
  charLimits: Record<string, number>;
  bannedWords: string[];
  requiredPhrases: string[];
  languageGuide: string;
  hashtagTips: string;
}

/**
 * Approver info - minimal user info for approver lists
 */
export interface Approver {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

/**
 * Comment model - entry comments/timeline
 * Uses 'body' field as per app convention (not 'text')
 */
export interface Comment {
  id: string;
  author: string;
  authorName?: string;
  authorAvatar?: string;
  body: string;
  createdAt: string;
  mentions?: string[];
  type?: 'comment' | 'status_change' | 'approval';
}

/**
 * Audit log entry
 */
export interface AuditEntry {
  id: string;
  ts: string;
  user: string;
  entryId: string;
  action: string;
  meta: Record<string, unknown>;
}

/**
 * Engagement activity types
 */
export type EngagementActionType = 'comment' | 'share' | 'reply' | 'like' | 'follow' | 'dm';

/**
 * Engagement activity - tracks proactive engagement with other accounts
 */
export interface EngagementActivity {
  id: string;
  platform: string;
  accountHandle: string;
  accountId?: string;
  actionType: EngagementActionType;
  note?: string;
  createdAt: string;
  createdBy: string;
}

/**
 * Account types for engagement directory
 */
export type EngagementAccountType =
  | 'Ally'
  | 'Media'
  | 'Supporter'
  | 'Prospect'
  | 'Influencer'
  | 'Partner'
  | 'Other';

/**
 * Engagement account - accounts in the engagement directory
 */
export interface EngagementAccount {
  id: string;
  handle: string;
  platform: string;
  displayName?: string;
  accountType: EngagementAccountType;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

/**
 * Engagement goals - weekly engagement targets
 */
export interface EngagementGoals {
  weeklyComments: number;
  weeklyShares: number;
  weeklyReplies: number;
  weeklyLikes: number;
  weeklyFollows: number;
  weeklyDms: number;
  weekStartDay: 'monday' | 'sunday';
}

/**
 * Influencer pipeline status
 */
export type InfluencerStatus =
  | 'Follow & Observe'
  | 'Engage Publicly'
  | 'Build Relationship'
  | 'Direct Outreach'
  | 'Collaborate';

/**
 * Platform profile - a single platform presence for an influencer
 */
export interface PlatformProfile {
  platform: string;
  handle: string;
  profileUrl: string;
}

/**
 * Influencer record - tracks partnership opportunities
 */
export interface Influencer {
  id: string;
  createdAt: string;
  createdBy: string;

  // Profile info
  name: string;
  /** @deprecated Use platformProfiles instead. Kept for backwards compatibility. */
  handle: string;
  /** @deprecated Use platformProfiles instead. Kept for backwards compatibility. */
  profileUrl: string;
  /** @deprecated Use platformProfiles instead. Kept for backwards compatibility. */
  platform: string;
  /** Multiple platform profiles */
  platformProfiles?: PlatformProfile[];
  followerCount: number;
  engagementRate?: number;

  // Contact & business
  contactEmail: string;
  niche: string;
  estimatedRate?: number;
  notes: string;

  // Pipeline
  status: InfluencerStatus;
}
