/**
 * API request/response types for PM Dashboard frontend
 * Used for type-safe API calls
 *
 * Note: GET endpoints return raw arrays/objects, not wrapped.
 * POST/PUT/DELETE return { ok: true } or the created/updated item.
 */

import type { Entry, Idea, User, Guidelines, Approver } from './models';

// ============================================================================
// Generic API Response Types
// ============================================================================

export interface ApiError {
  error: string;
}

export interface ApiOk {
  ok: true;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  ok: true;
  user: User;
}

export interface AcceptInviteRequest {
  token: string;
  password: string;
  name?: string;
}

export interface ChangePasswordRequest {
  currentPassword?: string;
  newPassword: string;
}

// ============================================================================
// Entry Types
// ============================================================================

export interface CreateEntryRequest {
  id?: string;
  date: string;
  platforms?: string[];
  assetType?: string;
  caption?: string;
  platformCaptions?: Record<string, string>;
  firstComment?: string;
  status?: string;
  priorityTier?: 'Low' | 'Medium' | 'High' | 'Urgent';
  approvers?: string[];
  author?: string;
  user?: string;
  campaign?: string;
  contentPillar?: string;
  previewUrl?: string;
  checklist?: Record<string, boolean>;
  analytics?: Record<string, unknown>;
  workflowStatus?: string;
  statusDetail?: string;
  aiFlags?: string[];
  aiScore?: Record<string, number>;
  testingFrameworkId?: string;
  testingFrameworkName?: string;
}

export interface UpdateEntryRequest extends Partial<CreateEntryRequest> {
  approvedAt?: string | null;
}

// GET /api/entries returns Entry[] directly (not wrapped)
export type EntriesResponse = Entry[];

// POST /api/entries returns the created entry
export type EntryResponse = Entry;

// ============================================================================
// Idea Types
// ============================================================================

export interface CreateIdeaRequest {
  id?: string;
  type?: string;
  title: string;
  notes?: string;
  links?: string[];
  attachments?: string[];
  inspiration?: string;
  createdBy?: string;
  targetDate?: string;
  targetMonth?: string;
}

// GET /api/ideas returns Idea[] directly
export type IdeasResponse = Idea[];

// ============================================================================
// User Types
// ============================================================================

export interface CreateUserRequest {
  name: string;
  email: string;
  features?: string[];
  isAdmin?: boolean;
  isApprover?: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  features?: string[];
  isAdmin?: boolean;
  isApprover?: boolean;
  status?: string;
  resendInvite?: boolean;
}

// GET /api/users returns User[] directly
export type UsersResponse = User[];

// GET /api/user returns User directly
export type UserResponse = User;

// GET /api/approvers returns Approver[] directly
export type ApproversResponse = Approver[];

// ============================================================================
// Guidelines Types
// ============================================================================

export interface UpdateGuidelinesRequest {
  charLimits?: Record<string, number>;
  bannedWords?: string[];
  requiredPhrases?: string[];
  languageGuide?: string;
  hashtagTips?: string;
}

// GET /api/guidelines returns Guidelines directly
export type GuidelinesResponse = Guidelines;

// ============================================================================
// Copy Check Types
// ============================================================================

export interface CopyCheckRequest {
  text: string;
  platform: string;
  assetType: string;
  constraints: {
    maxChars: number;
    maxHashtags?: number;
  };
  brand?: {
    bannedWords?: string[];
    requiredPhrases?: string[];
  };
  readingLevelTarget?: string;
}

export interface CopyCheckScore {
  clarity: number;
  brevity: number;
  hook: number;
  fit: number;
  readingLevel: string;
}

export interface CopyCheckVariant {
  label: string;
  text: string;
}

export interface CopyCheckResponse {
  score: CopyCheckScore;
  flags: string[];
  suggestion: { text: string };
  variants: CopyCheckVariant[];
  explanations: string[];
  fallback?: boolean;
}

// ============================================================================
// Notification Types
// ============================================================================

export interface NotifyRequest {
  teamsWebhookUrl?: string;
  message?: string;
  to?: string[];
  approvers?: string[];
  subject?: string;
  text?: string;
  html?: string;
}

export interface NotifyResponse {
  teams?: string;
  email?: string;
}

// ============================================================================
// Audit Types
// ============================================================================

export interface CreateAuditRequest {
  user?: string;
  entryId?: string;
  action?: string;
  meta?: Record<string, unknown>;
}
