// Supabase client and API wrapper - matching PM-Productivity-Tool pattern
import type { SupabaseClient, Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { APP_CONFIG, Logger } from './config';
import type { User as AppUser } from '../types/models';
import { PRIORITY_TIERS } from '../constants';
import {
  dateOrNull,
  getMonthEndDate,
  mapContentCategoryFromDb,
  mapContentRequestStatusFromDb,
  mapContentRequestStatusToDb,
  mapCtaTypeFromDb,
  mapExecutionStatusFromDb,
  mapLinkPlacementFromDb,
  mapOpportunityStatusFromDb,
  mapOpportunityStatusToDb,
  mapOpportunityUrgencyFromDb,
  mapOpportunityUrgencyToDb,
  mapPriorityTierFromDb,
  mapPriorityTierToDb,
  mapResponseModeFromDb,
  mapSignOffRouteFromDb,
  mapTestingStatusFromDb,
  mapTestingStatusToDb,
  mapWorkflowStatusFromDb,
  mapWorkflowStatusToDb,
} from './supabaseMappers';

/**
 * Map DB testing framework row to app model.
 */
const mapTestingFrameworkToApp = (row: {
  id: string;
  name: string;
  hypothesis: string;
  audience: string;
  metric: string;
  duration: string;
  status: string;
  notes: string;
  created_at: string;
}): {
  id: string;
  name: string;
  hypothesis: string;
  audience: string;
  metric: string;
  duration: string;
  status: string;
  notes: string;
  createdAt: string;
} => ({
  id: row.id,
  name: row.name || '',
  hypothesis: row.hypothesis || '',
  audience: row.audience || '',
  metric: row.metric || '',
  duration: row.duration || '',
  status: mapTestingStatusFromDb(row.status),
  notes: row.notes || '',
  createdAt: row.created_at || '',
});

/**
 * Map app testing framework to DB row format.
 */
const mapTestingFrameworkToDb = (framework: {
  id?: string;
  name?: string;
  hypothesis?: string;
  audience?: string;
  metric?: string;
  duration?: string;
  status?: string;
  notes?: string;
  createdAt?: string;
}): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  if (framework.id !== undefined) row.id = framework.id;
  if (framework.name !== undefined) row.name = framework.name;
  if (framework.hypothesis !== undefined) row.hypothesis = framework.hypothesis;
  if (framework.audience !== undefined) row.audience = framework.audience;
  if (framework.metric !== undefined) row.metric = framework.metric;
  if (framework.duration !== undefined) row.duration = framework.duration;
  if (framework.status !== undefined) row.status = mapTestingStatusToDb(framework.status);
  if (framework.notes !== undefined) row.notes = framework.notes;
  if (framework.createdAt !== undefined) row.created_at = framework.createdAt;
  return row;
};

import type {
  Attachment,
  ContentPeak,
  ContentRequest,
  ContentSeries,
  Entry,
  Idea,
  Opportunity,
  PlanningCampaign,
  RapidResponse,
  Guidelines,
  Influencer,
  PlatformProfile,
  ReportingPeriod,
  MonthlyReport,
  QualitativeInsights,
  OrgEvent,
  DraftPost,
} from '../types/models';

// Local type aliases for types used only in this file
type LinkedInSubmission = {
  id: string;
  submissionType: string;
  status: string;
  title: string;
  postCopy: string;
  comments: string;
  owner: string;
  submitter: string;
  links: string[];
  attachments: Attachment[];
  targetDate: string;
  createdAt: string;
  updatedAt: string;
};

type TestingFramework = {
  id: string;
  name: string;
  hypothesis: string;
  audience: string;
  metric: string;
  duration: string;
  status: string;
  notes: string;
  createdAt: string;
};

// Database row types (snake_case as stored in Supabase)
interface EntryRow {
  id: string;
  date: string;
  platforms: string[];
  asset_type: string;
  caption: string;
  platform_captions: Record<string, string>;
  first_comment: string;
  approval_deadline: string;
  first_check_date: string | null;
  second_check_date: string | null;
  asset_production_date: string | null;
  final_check_date: string | null;
  asset_previews: string[] | null;
  status: string;
  priority_tier: string;
  approvers: string[];
  author: string;
  author_email: string | null;
  campaign: string;
  content_pillar: string;
  content_category: string | null;
  response_mode: string | null;
  sign_off_route: string | null;
  content_peak: string | null;
  series_name: string | null;
  episode_number: number | null;
  origin_content_id: string | null;
  partner_org: string | null;
  partner_individual_name: string | null;
  partner_consent_status: string | null;
  partner_capture_context: string | null;
  alt_text_status: string | null;
  subtitles_status: string | null;
  utm_status: string | null;
  source_verified: boolean | null;
  seo_primary_query: string | null;
  link_placement: string | null;
  cta_type: string | null;
  preview_url: string;
  checklist: Record<string, boolean>;
  analytics: Record<string, unknown>;
  workflow_status: string;
  status_detail: string;
  ai_flags: string[];
  ai_score: Record<string, number>;
  testing_framework_id: string;
  testing_framework_name: string;
  audience_segments: string[];
  golden_thread_pass: boolean | null;
  assessment_scores: Record<string, unknown> | null;
  influencer_id: string | null;
  evergreen: boolean;
  url: string | null;
  script: string | null;
  design_copy: string | null;
  carousel_slides: string[];
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  deleted_at: string | null;
  comments: string | null;
}

interface MonthlyReportRow {
  id: string;
  report_type: string | null;
  period_month: number | null;
  period_quarter: number | null;
  period_year: number;
  campaign_name: string | null;
  date_from: string | null;
  date_to: string | null;
  platform_metrics: Record<string, Record<string, number>> | null;
  qualitative: Partial<QualitativeInsights> | null;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

interface IdeaRow {
  id: string;
  type: string;
  title: string;
  notes: string;
  links: string[];
  attachments: Attachment[];
  inspiration: string;
  created_by: string;
  target_date: string;
  target_month: string;
  created_at: string;
}

interface CampaignRow {
  id: string;
  name: string;
  type: string;
  start_date: string;
  end_date: string;
  colour: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

interface OpportunityRow {
  id: string;
  date: string;
  description: string;
  angle: string;
  urgency: string;
  status: string;
  created_by: string;
  created_by_email: string;
  linked_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ContentRequestRow {
  id: string;
  title: string;
  key_messages: string;
  assets_needed: string;
  audience_segments: string[];
  approvers: string[];
  deadline: string | null;
  notes: string;
  generated_brief: string;
  status: string;
  created_by: string;
  created_by_email: string;
  converted_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ContentPeakRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  priority_tier: string | null;
  owner: string | null;
  campaign: string | null;
  content_pillar: string | null;
  response_mode: string | null;
  required_platforms: string[];
  required_asset_types: string[];
  linked_entry_ids: string[];
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ContentSeriesRow {
  id: string;
  title: string;
  owner: string | null;
  status: string | null;
  target_platforms: string[];
  target_episode_count: number | null;
  review_checkpoint: number | null;
  campaign: string | null;
  content_pillar: string | null;
  response_mode: string | null;
  linked_entry_ids: string[];
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface RapidResponseRow {
  id: string;
  title: string;
  owner: string | null;
  status: string | null;
  response_mode: string | null;
  trigger_date: string | null;
  due_at: string | null;
  sign_off_route: string | null;
  source_opportunity_id: string | null;
  linked_entry_id: string | null;
  campaign: string | null;
  content_pillar: string | null;
  target_platforms: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ReportingPeriodRow {
  id: string;
  cadence: string;
  label: string;
  start_date: string;
  end_date: string;
  status: string;
  owner: string;
  metrics: Record<string, unknown>;
  narrative: Record<string, unknown>;
  qualitative: Record<string, unknown>;
  completeness: Record<string, unknown>;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface LinkedInRow {
  id: string;
  submission_type: string;
  status: string;
  title: string;
  post_copy: string;
  comments: string;
  owner: string;
  submitter: string;
  links: string[];
  attachments: Attachment[];
  target_date: string;
  created_at: string;
  updated_at: string;
}

interface GuidelinesRow {
  id: string;
  char_limits: Record<string, number>;
  banned_words: string[];
  required_phrases: string[];
  language_guide: string;
  hashtag_tips: string;
  approver_directory: { name: string; email: string }[];
}

interface UserProfileRow {
  id: string;
  auth_user_id: string | null;
  email: string;
  name: string;
  avatar_url: string | null;
  is_admin: boolean;
  is_approver: boolean;
  features: string[];
  status: string;
  created_at: string;
  last_login_at?: string | null;
  manager_email: string | null;
}

interface AdminUserUpsertPayload {
  name?: string;
  email?: string;
  features?: string[];
  isApprover?: boolean;
  status?: string;
}

interface AdminUserFunctionResponse {
  user?: UserProfileRow | null;
  users?: UserProfileRow[];
  ok?: boolean;
  inviteSent?: boolean;
}

interface InviteAdminUserResult {
  user: (AppUser & { managerEmail?: string | null }) | null;
  inviteSent: boolean;
}

interface ActivityLogRow {
  id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  target_title: string;
  actor_email: string;
  actor_name: string;
  details: Record<string, unknown>;
  related_users: string[];
  created_at: string;
}

interface NotificationRow {
  id: string;
  user_email: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface TestingFrameworkRow {
  id: string;
  name: string;
  hypothesis: string;
  audience: string;
  metric: string;
  duration: string;
  status: string;
  notes: string;
  created_at: string;
}

interface PlatformProfileRow {
  platform: string;
  handle: string;
  profile_url: string;
}

const getCurrentUserEmail = (): string | null => {
  if (typeof window === 'undefined') return null;
  const email = window.__currentUserEmail?.trim();
  return email ? email : null;
};

const normalizeProfileEmail = (email: string | null | undefined): string => {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

const getAuthRedirectUrl = (): string | undefined => {
  if (typeof window === 'undefined') return undefined;

  try {
    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';

    if (url.hostname === 'ddpopmatters.github.io') {
      url.pathname = '/content-hub/';
      return url.toString();
    }

    if (!url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/[^/]*$/, '');
    }

    return url.toString();
  } catch {
    return window.location.origin;
  }
};

const fetchUserProfileByAuthUserId = async (authUserId: string): Promise<UserProfileRow | null> => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) {
    Logger.error(error, 'fetchUserProfileByAuthUserId');
    return null;
  }

  return (data as UserProfileRow | null) ?? null;
};

const fetchUserProfileByEmail = async (email: string): Promise<UserProfileRow | null> => {
  if (!supabase) return null;

  const normalizedEmail = normalizeProfileEmail(email);
  if (!normalizedEmail) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    Logger.error(error, 'fetchUserProfileByEmail');
    return null;
  }

  return (data as UserProfileRow | null) ?? null;
};

const relinkUserProfileAuthUser = async (
  profile: UserProfileRow,
  user: User,
): Promise<UserProfileRow | null> => {
  if (!supabase) return profile;

  const normalizedEmail = normalizeProfileEmail(user.email ?? profile.email);
  if (!normalizedEmail) return profile;

  const { data, error } = await supabase
    .from('user_profiles')
    .update({
      auth_user_id: user.id,
      last_login_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
    .eq('email', normalizedEmail)
    .select('*')
    .maybeSingle();

  if (error) {
    Logger.error(error, 'relinkUserProfileAuthUser');
    return profile;
  }

  return (data as UserProfileRow | null) ?? profile;
};

const resolveCurrentUserProfile = async (user: User): Promise<UserProfileRow | null> => {
  const profileByAuthUserId = await fetchUserProfileByAuthUserId(user.id);
  if (profileByAuthUserId) return profileByAuthUserId;

  const normalizedEmail = normalizeProfileEmail(user.email);
  if (!normalizedEmail) return null;

  const profileByEmail = await fetchUserProfileByEmail(normalizedEmail);
  if (!profileByEmail) return null;

  if (profileByEmail.auth_user_id === user.id) {
    return profileByEmail;
  }

  return relinkUserProfileAuthUser(profileByEmail, user);
};

interface InfluencerRow {
  id: string;
  created_at: string;
  created_by: string;
  name: string;
  handle: string;
  profile_url: string;
  platform: string;
  platform_profiles: PlatformProfileRow[] | null;
  follower_count: number;
  engagement_rate: number | null;
  contact_email: string;
  niche: string;
  estimated_rate: number | null;
  notes: string;
  status: string;
}

// Activity log input
interface ActivityInput {
  actionType: string;
  targetType: string;
  targetId: string;
  targetTitle: string;
  details?: Record<string, unknown>;
  relatedUsers?: string[];
}

// Fetch options
interface FetchEntriesOptions {
  month?: string;
}

interface FetchIdeasOptions {
  month?: string;
}

interface FetchLinkedInOptions {
  month?: string;
}

// Auth result types
interface AuthResult {
  data?: { user: User | null; session: Session | null };
  error?: string;
}

// Supabase client instance
let supabase: SupabaseClient | null = null;
// In-flight init promise — prevents multiple concurrent createClient calls
let initPromise: Promise<SupabaseClient | null> | null = null;
let supabaseDisabledForSession = !APP_CONFIG.SUPABASE_ENABLED;
const unsupportedEntryColumns = new Set<string>();

const isNetworkLikeError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : typeof error === 'object' &&
            error !== null &&
            typeof (error as { message?: unknown }).message === 'string'
          ? String((error as { message: string }).message)
          : '';

  return [
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    'ERR_NAME_NOT_RESOLVED',
    'ERR_FAILED',
    'fetch failed',
  ].some((pattern) => message.includes(pattern));
};

const disableSupabaseForSession = () => {
  supabaseDisabledForSession = true;
  initPromise = null;
  try {
    supabase?.auth.stopAutoRefresh?.();
  } catch {
    // Ignore stopAutoRefresh availability differences across SDK builds.
  }
};

const verifySupabaseConnection = async (): Promise<boolean> => {
  try {
    await fetch(`${APP_CONFIG.SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: APP_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${APP_CONFIG.SUPABASE_ANON_KEY}`,
      },
      cache: 'no-store',
    });
    return true;
  } catch (error) {
    if (isNetworkLikeError(error)) {
      disableSupabaseForSession();
      return false;
    }
    Logger.error(error, 'verifySupabaseConnection');
    return false;
  }
};

const getMissingSchemaColumn = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') return null;
  const code =
    typeof (error as { code?: unknown }).code === 'string' ? (error as { code: string }).code : '';
  const message =
    typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : '';

  if (code !== 'PGRST204' || !message) return null;
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
};

const stripUnsupportedEntryColumns = (row: Record<string, unknown>): Record<string, unknown> => {
  if (!unsupportedEntryColumns.size) return row;
  const sanitized = { ...row };
  unsupportedEntryColumns.forEach((column) => {
    delete sanitized[column];
  });
  return sanitized;
};

const resolveEntryActorEmail = (userEmail: string | undefined): string | null => {
  const trimmed = typeof userEmail === 'string' ? userEmail.trim() : '';
  if (trimmed.includes('@')) return trimmed;
  return getCurrentUserEmail() ?? (trimmed || null);
};

const mapUserProfileToAppUser = (
  row: UserProfileRow,
): AppUser & { managerEmail?: string | null } => ({
  id: row.id,
  email: row.email,
  name: row.name,
  status: row.status,
  isAdmin: Boolean(row.is_admin),
  isApprover: Boolean(row.is_approver),
  managerEmail: row.manager_email ?? null,
  avatarUrl: row.avatar_url ?? null,
  features: Array.isArray(row.features) ? row.features : [],
  invitePending: row.status === 'pending',
  lastLoginAt: row.last_login_at ?? null,
  createdAt: row.created_at ?? null,
});

const invokeAdminUsers = async (
  payload: Record<string, unknown>,
): Promise<AdminUserFunctionResponse> => {
  await initSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${APP_CONFIG.SUPABASE_URL}/functions/v1/admin-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: APP_CONFIG.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data: AdminUserFunctionResponse & { error?: string } = {};
  if (text) {
    try {
      data = JSON.parse(text) as AdminUserFunctionResponse & { error?: string };
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    const message =
      typeof data.error === 'string' && data.error.trim()
        ? data.error
        : `Admin user request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
};

const upsertEntryWithSchemaFallback = async (
  row: Record<string, unknown>,
): Promise<{ data: EntryRow | null; error: unknown | null }> => {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not initialized') };
  }

  let dbRow = stripUnsupportedEntryColumns(row);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase.from('entries').upsert(dbRow).select().single();
    if (!error) {
      return { data: (data as EntryRow) ?? null, error: null };
    }

    const missingColumn = getMissingSchemaColumn(error);
    if (!missingColumn) {
      return { data: null, error };
    }

    unsupportedEntryColumns.add(missingColumn);
    dbRow = stripUnsupportedEntryColumns(dbRow);
  }

  return { data: null, error: new Error('Entries schema is missing too many expected columns') };
};

const updateEntryWithSchemaFallback = async (
  id: string,
  row: Record<string, unknown>,
): Promise<{ data: EntryRow | null; error: unknown | null }> => {
  if (!supabase) {
    return { data: null, error: new Error('Supabase not initialized') };
  }

  let dbRow = stripUnsupportedEntryColumns(row);
  delete dbRow.id;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from('entries')
      .update(dbRow)
      .eq('id', id)
      .select()
      .single();
    if (!error) {
      return { data: (data as EntryRow) ?? null, error: null };
    }

    const missingColumn = getMissingSchemaColumn(error);
    if (!missingColumn) {
      return { data: null, error };
    }

    unsupportedEntryColumns.add(missingColumn);
    dbRow = stripUnsupportedEntryColumns(dbRow);
    delete dbRow.id;
  }

  return { data: null, error: new Error('Entries schema is missing too many expected columns') };
};

// Initialise Supabase client
export const initSupabase = async (): Promise<SupabaseClient | null> => {
  if (supabaseDisabledForSession) return null;
  if (supabase) return supabase;
  if (initPromise) return initPromise;

  if (!APP_CONFIG.SUPABASE_ENABLED) {
    disableSupabaseForSession();
    return null;
  }

  initPromise = (async () => {
    try {
      // Wait for Supabase SDK to load (if using CDN)
      if (window.supabaseReady) {
        await window.supabaseReady;
      }

      const { createClient } = window.supabase || (await import('@supabase/supabase-js'));

      supabase = createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });

      const reachable = await verifySupabaseConnection();
      if (!reachable) {
        supabase = null;
        return null;
      }

      Logger.debug('Supabase client initialized');
      return supabase;
    } catch (error) {
      Logger.error(error, 'Failed to initialize Supabase');
      if (isNetworkLikeError(error)) {
        disableSupabaseForSession();
      }
      initPromise = null; // allow retry on failure
      return null;
    }
  })();

  return initPromise;
};

// Get current Supabase client
export const getSupabase = (): SupabaseClient | null => supabase;

// ============================================
// SUPABASE API WRAPPER
// Matching PM-Productivity-Tool patterns
// ============================================

export const SUPABASE_API = {
  // ==========================================
  // ENTRIES (Content Calendar)
  // ==========================================

  fetchDistinctCategories: async (): Promise<string[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('entries')
        .select('campaign')
        .not('campaign', 'is', null)
        .neq('campaign', '');

      if (error || !data) {
        if (error) Logger.error(error, 'fetchDistinctCategories');
        return [];
      }

      return [
        ...new Set(
          data
            .map((row: { campaign: string | null }) => row.campaign)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort();
    } catch (error) {
      Logger.error(error, 'fetchDistinctCategories');
      return [];
    }
  },

  fetchEntries: async (options: FetchEntriesOptions = {}): Promise<Entry[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      let query = supabase
        .from('entries')
        .select('*')
        .is('deleted_at', null)
        .order('date', { ascending: true });

      if (options.month) {
        const startDate = `${options.month}-01`;
        const endDate = getMonthEndDate(options.month);
        query = query.gte('date', startDate).lte('date', endDate);
      }

      const { data, error } = await query;

      if (error) {
        Logger.error(error, 'fetchEntries');
        return [];
      }

      return ((data as EntryRow[]) || []).map(SUPABASE_API.mapEntryToApp);
    } catch (error) {
      Logger.error(error, 'fetchEntries');
      return [];
    }
  },

  fetchEntryById: async (id: string): Promise<Entry | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase.from('entries').select('*').eq('id', id).single();

      if (error) {
        Logger.error(error, 'fetchEntryById');
        return null;
      }

      return data ? SUPABASE_API.mapEntryToApp(data as EntryRow) : null;
    } catch (error) {
      Logger.error(error, 'fetchEntryById');
      return null;
    }
  },

  saveEntry: async (entry: Partial<Entry>, userEmail: string): Promise<Entry | null> => {
    await initSupabase();
    if (!supabase) {
      throw new Error('Supabase not initialized');
    }

    try {
      let existingRow: EntryRow | null = null;
      if (entry.id) {
        const { data, error } = await supabase
          .from('entries')
          .select('*')
          .eq('id', entry.id)
          .maybeSingle();
        if (error) {
          Logger.error(error, 'saveEntry');
          throw error;
        }
        existingRow = (data as EntryRow | null) ?? null;
      }

      const mergedEntry = existingRow
        ? { ...SUPABASE_API.mapEntryToApp(existingRow), ...entry }
        : entry;
      const dbEntry = SUPABASE_API.mapEntryToDb(
        mergedEntry,
        existingRow?.author_email ?? resolveEntryActorEmail(userEmail) ?? '',
      ) as Record<string, unknown>;
      const { data, error } = existingRow
        ? await updateEntryWithSchemaFallback(existingRow.id, dbEntry)
        : await upsertEntryWithSchemaFallback(dbEntry);

      if (error || !data) {
        const saveError = error ?? new Error('Entry save returned no data');
        Logger.error(saveError, 'saveEntry');
        throw saveError;
      }

      // Log activity
      await SUPABASE_API.logActivity({
        actionType: entry.id ? 'update' : 'create',
        targetType: 'entry',
        targetId: (data as EntryRow).id,
        targetTitle: entry.caption?.substring(0, 50) || 'Untitled',
        details: { date: entry.date, status: entry.status },
      });

      return data ? SUPABASE_API.mapEntryToApp(data as EntryRow) : null;
    } catch (error) {
      Logger.error(error, 'saveEntry');
      throw error;
    }
  },

  deleteEntry: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      // Soft delete
      const { error } = await supabase
        .from('entries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        Logger.error(error, 'deleteEntry');
        return false;
      }

      await SUPABASE_API.logActivity({
        actionType: 'delete',
        targetType: 'entry',
        targetId: id,
        targetTitle: '',
      });

      return true;
    } catch (error) {
      Logger.error(error, 'deleteEntry');
      return false;
    }
  },

  restoreEntry: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('entries').update({ deleted_at: null }).eq('id', id);
      if (error) {
        Logger.error(error, 'restoreEntry');
        return false;
      }
      return true;
    } catch (error) {
      Logger.error(error, 'restoreEntry');
      return false;
    }
  },

  hardDeleteEntry: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('entries').delete().eq('id', id);
      if (error) {
        Logger.error(error, 'hardDeleteEntry');
        return false;
      }
      return true;
    } catch (error) {
      Logger.error(error, 'hardDeleteEntry');
      return false;
    }
  },

  // ==========================================
  // MONTHLY REPORTS
  // ==========================================

  getMonthlyReports: async (): Promise<MonthlyReport[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('monthly_reports')
        .select('*')
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

      if (error) {
        Logger.error(error, 'getMonthlyReports');
        return [];
      }

      return ((data as MonthlyReportRow[]) || []).map(SUPABASE_API.mapMonthlyReportToApp);
    } catch (error) {
      Logger.error(error, 'getMonthlyReports');
      return [];
    }
  },

  getMonthlyReport: async (year: number, month: number): Promise<MonthlyReport | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('monthly_reports')
        .select('*')
        .eq('period_year', year)
        .eq('period_month', month)
        .single();

      if (error && error.code !== 'PGRST116') {
        Logger.error(error, 'getMonthlyReport');
        return null;
      }

      return data ? SUPABASE_API.mapMonthlyReportToApp(data as MonthlyReportRow) : null;
    } catch (error) {
      Logger.error(error, 'getMonthlyReport');
      return null;
    }
  },

  saveMonthlyReport: async (
    report: Omit<MonthlyReport, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string,
  ): Promise<MonthlyReport> => {
    await initSupabase();
    if (!supabase) {
      throw new Error('Supabase is unavailable');
    }

    try {
      const dbReport = SUPABASE_API.mapMonthlyReportToDb(report, existingId);

      const { data, error } = await supabase
        .from('monthly_reports')
        .upsert(dbReport, {
          onConflict: 'report_type,period_year,period_month,period_quarter,campaign_name',
        })
        .select()
        .single();

      if (error || !data) {
        Logger.error(error, 'saveMonthlyReport');
        throw new Error('Failed to save monthly report');
      }

      return SUPABASE_API.mapMonthlyReportToApp(data as MonthlyReportRow);
    } catch (error) {
      Logger.error(error, 'saveMonthlyReport');
      throw error instanceof Error ? error : new Error('Failed to save monthly report');
    }
  },

  sendNotification: async (payload: Record<string, unknown>): Promise<void> => {
    await initSupabase();
    if (!supabase) {
      throw new Error('Supabase is unavailable');
    }
    const { data, error } = await supabase.functions.invoke('send-notification', { body: payload });
    if (error) {
      Logger.error(error, 'sendNotification');
      throw new Error(error.message || 'Failed to send notification');
    }
    const response = data as {
      ok?: boolean;
      sent?: number;
      failed?: number;
      error?: string;
    } | null;
    if (!response) {
      throw new Error('Notification service returned no data');
    }
    if (response.error) {
      throw new Error(response.error);
    }
    if (response.ok === false || (response.failed ?? 0) > 0) {
      throw new Error(
        `Notification delivery incomplete (${response.sent ?? 0} sent, ${response.failed ?? 0} failed).`,
      );
    }
  },

  // ==========================================
  // IDEAS
  // ==========================================

  fetchIdeas: async (options: FetchIdeasOptions = {}): Promise<Idea[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      let query = supabase.from('ideas').select('*').order('created_at', { ascending: false });

      if (options.month) {
        query = query.eq('target_month', options.month);
      }

      const { data, error } = await query;

      if (error) {
        Logger.error(error, 'fetchIdeas');
        return [];
      }

      return ((data as IdeaRow[]) || []).map(SUPABASE_API.mapIdeaToApp);
    } catch (error) {
      Logger.error(error, 'fetchIdeas');
      return [];
    }
  },

  saveIdea: async (idea: Partial<Idea>, userEmail: string): Promise<Idea | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const dbIdea = SUPABASE_API.mapIdeaToDb(idea, userEmail);

      const { data, error } = await supabase.from('ideas').upsert(dbIdea).select().single();

      if (error) {
        Logger.error(error, 'saveIdea');
        return null;
      }

      return data ? SUPABASE_API.mapIdeaToApp(data as IdeaRow) : null;
    } catch (error) {
      Logger.error(error, 'saveIdea');
      return null;
    }
  },

  deleteIdea: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('ideas').delete().eq('id', id);

      if (error) {
        Logger.error(error, 'deleteIdea');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(error, 'deleteIdea');
      return false;
    }
  },

  // ==========================================
  // CAMPAIGNS
  // ==========================================

  fetchCampaigns: async (): Promise<PlanningCampaign[]> => {
    await initSupabase();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('start_date', { ascending: true });
      if (error) {
        Logger.error(error, 'fetchCampaigns');
        return [];
      }
      return ((data as CampaignRow[]) || []).map(SUPABASE_API.mapCampaignToApp);
    } catch (error) {
      Logger.error(error, 'fetchCampaigns');
      return [];
    }
  },

  saveCampaign: async (
    campaign: Partial<PlanningCampaign>,
    userEmail: string,
  ): Promise<PlanningCampaign | null> => {
    await initSupabase();
    if (!supabase) return null;
    try {
      const dbCampaign = SUPABASE_API.mapCampaignToDb(campaign, userEmail);
      const { data, error } = await supabase.from('campaigns').upsert(dbCampaign).select().single();
      if (error) {
        Logger.error(error, 'saveCampaign');
        return null;
      }
      return data ? SUPABASE_API.mapCampaignToApp(data as CampaignRow) : null;
    } catch (error) {
      Logger.error(error, 'saveCampaign');
      return null;
    }
  },

  deleteCampaign: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) {
        Logger.error(error, 'deleteCampaign');
        return false;
      }
      return true;
    } catch (error) {
      Logger.error(error, 'deleteCampaign');
      return false;
    }
  },

  // ==========================================
  // OPPORTUNITIES
  // ==========================================

  fetchOpportunities: async (): Promise<Opportunity[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        Logger.error(error, 'fetchOpportunities');
        return [];
      }

      return ((data as OpportunityRow[]) || []).map(SUPABASE_API.mapOpportunityToApp);
    } catch (error) {
      Logger.error(error, 'fetchOpportunities');
      return [];
    }
  },

  createOpportunity: async (
    opportunity: Partial<Opportunity>,
    userEmail: string,
  ): Promise<Opportunity | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const dbOpportunity = SUPABASE_API.mapOpportunityToDb(opportunity, userEmail);

      const { data, error } = await supabase
        .from('opportunities')
        .insert(dbOpportunity)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'createOpportunity');
        return null;
      }

      return data ? SUPABASE_API.mapOpportunityToApp(data as OpportunityRow) : null;
    } catch (error) {
      Logger.error(error, 'createOpportunity');
      return null;
    }
  },

  updateOpportunityStatus: async (
    id: string,
    status: Opportunity['status'],
  ): Promise<Opportunity | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('opportunities')
        .update({ status: mapOpportunityStatusToDb(status) })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'updateOpportunityStatus');
        return null;
      }

      return data ? SUPABASE_API.mapOpportunityToApp(data as OpportunityRow) : null;
    } catch (error) {
      Logger.error(error, 'updateOpportunityStatus');
      return null;
    }
  },

  // ==========================================
  // CONTENT REQUESTS
  // ==========================================

  fetchContentRequests: async (): Promise<ContentRequest[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('content_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        Logger.error(error, 'fetchContentRequests');
        return [];
      }

      return ((data as ContentRequestRow[]) || []).map(SUPABASE_API.mapContentRequestToApp);
    } catch (error) {
      Logger.error(error, 'fetchContentRequests');
      return [];
    }
  },

  createContentRequest: async (
    request: Partial<ContentRequest>,
    userEmail: string,
  ): Promise<ContentRequest | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const dbRequest = SUPABASE_API.mapContentRequestToDb(request, userEmail);

      const { data, error } = await supabase
        .from('content_requests')
        .insert(dbRequest)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'createContentRequest');
        return null;
      }

      return data ? SUPABASE_API.mapContentRequestToApp(data as ContentRequestRow) : null;
    } catch (error) {
      Logger.error(error, 'createContentRequest');
      return null;
    }
  },

  updateContentRequest: async (
    id: string,
    updates: Partial<ContentRequest>,
  ): Promise<ContentRequest | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const patch = SUPABASE_API.mapContentRequestPatchToDb(updates);
      if (Object.keys(patch).length === 0) return null;

      const { data, error } = await supabase
        .from('content_requests')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'updateContentRequest');
        return null;
      }

      return data ? SUPABASE_API.mapContentRequestToApp(data as ContentRequestRow) : null;
    } catch (error) {
      Logger.error(error, 'updateContentRequest');
      return null;
    }
  },

  // ==========================================
  // CONTENT PEAKS
  // ==========================================

  fetchContentPeaks: async (): Promise<ContentPeak[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('content_peaks')
        .select('*')
        .order('start_date', { ascending: true });

      if (error) {
        Logger.error(error, 'fetchContentPeaks');
        return [];
      }

      return ((data as ContentPeakRow[]) || []).map(SUPABASE_API.mapContentPeakToApp);
    } catch (error) {
      Logger.error(error, 'fetchContentPeaks');
      return [];
    }
  },

  createContentPeak: async (
    peak: Omit<ContentPeak, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ContentPeak | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const dbPeak = {
        ...SUPABASE_API.mapContentPeakToDb(peak),
        priority_tier: peak.priorityTier || 'High',
        owner: peak.owner || getCurrentUserEmail() || '',
      };

      const { data, error } = await supabase.from('content_peaks').insert(dbPeak).select().single();

      if (error) {
        Logger.error(error, 'createContentPeak');
        return null;
      }

      return data ? SUPABASE_API.mapContentPeakToApp(data as ContentPeakRow) : null;
    } catch (error) {
      Logger.error(error, 'createContentPeak');
      return null;
    }
  },

  updateContentPeak: async (
    id: string,
    updates: Partial<ContentPeak>,
  ): Promise<ContentPeak | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const patch = SUPABASE_API.mapContentPeakToDb(updates);
      if (Object.keys(patch).length === 0) return null;

      const { data, error } = await supabase
        .from('content_peaks')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'updateContentPeak');
        return null;
      }

      return data ? SUPABASE_API.mapContentPeakToApp(data as ContentPeakRow) : null;
    } catch (error) {
      Logger.error(error, 'updateContentPeak');
      return null;
    }
  },

  deleteContentPeak: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('content_peaks').delete().eq('id', id);

      if (error) {
        Logger.error(error, 'deleteContentPeak');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(error, 'deleteContentPeak');
      return false;
    }
  },

  // ==========================================
  // CONTENT SERIES
  // ==========================================

  fetchContentSeries: async (): Promise<ContentSeries[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('content_series')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        Logger.error(error, 'fetchContentSeries');
        return [];
      }

      return ((data as ContentSeriesRow[]) || []).map(SUPABASE_API.mapContentSeriesToApp);
    } catch (error) {
      Logger.error(error, 'fetchContentSeries');
      return [];
    }
  },

  createContentSeries: async (
    series: Omit<ContentSeries, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ContentSeries | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const dbSeries = {
        ...SUPABASE_API.mapContentSeriesToDb(series),
        owner: series.owner || getCurrentUserEmail() || '',
        status: series.status || 'Active',
        review_checkpoint: series.reviewCheckpoint ?? 3,
      };

      const { data, error } = await supabase
        .from('content_series')
        .insert(dbSeries)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'createContentSeries');
        return null;
      }

      return data ? SUPABASE_API.mapContentSeriesToApp(data as ContentSeriesRow) : null;
    } catch (error) {
      Logger.error(error, 'createContentSeries');
      return null;
    }
  },

  updateContentSeries: async (
    id: string,
    updates: Partial<ContentSeries>,
  ): Promise<ContentSeries | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const patch = SUPABASE_API.mapContentSeriesToDb(updates);
      if (Object.keys(patch).length === 0) return null;

      const { data, error } = await supabase
        .from('content_series')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'updateContentSeries');
        return null;
      }

      return data ? SUPABASE_API.mapContentSeriesToApp(data as ContentSeriesRow) : null;
    } catch (error) {
      Logger.error(error, 'updateContentSeries');
      return null;
    }
  },

  deleteContentSeries: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('content_series').delete().eq('id', id);

      if (error) {
        Logger.error(error, 'deleteContentSeries');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(error, 'deleteContentSeries');
      return false;
    }
  },

  // ==========================================
  // RAPID RESPONSES
  // ==========================================

  fetchRapidResponses: async (): Promise<RapidResponse[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('rapid_responses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        Logger.error(error, 'fetchRapidResponses');
        return [];
      }

      return ((data as RapidResponseRow[]) || []).map(SUPABASE_API.mapRapidResponseToApp);
    } catch (error) {
      Logger.error(error, 'fetchRapidResponses');
      return [];
    }
  },

  createRapidResponse: async (
    response: Omit<RapidResponse, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<RapidResponse | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const dbResponse = {
        ...SUPABASE_API.mapRapidResponseToDb(response),
        owner: response.owner || getCurrentUserEmail() || '',
        status: response.status || 'New',
        response_mode: response.responseMode || 'Reactive',
      };

      const { data, error } = await supabase
        .from('rapid_responses')
        .insert(dbResponse)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'createRapidResponse');
        return null;
      }

      return data ? SUPABASE_API.mapRapidResponseToApp(data as RapidResponseRow) : null;
    } catch (error) {
      Logger.error(error, 'createRapidResponse');
      return null;
    }
  },

  updateRapidResponse: async (
    id: string,
    updates: Partial<RapidResponse>,
  ): Promise<RapidResponse | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const patch = SUPABASE_API.mapRapidResponseToDb(updates);
      if (Object.keys(patch).length === 0) return null;

      const { data, error } = await supabase
        .from('rapid_responses')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'updateRapidResponse');
        return null;
      }

      return data ? SUPABASE_API.mapRapidResponseToApp(data as RapidResponseRow) : null;
    } catch (error) {
      Logger.error(error, 'updateRapidResponse');
      return null;
    }
  },

  deleteRapidResponse: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('rapid_responses').delete().eq('id', id);

      if (error) {
        Logger.error(error, 'deleteRapidResponse');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(error, 'deleteRapidResponse');
      return false;
    }
  },

  // ==========================================
  // REPORTING PERIODS
  // ==========================================

  fetchReportingPeriods: async (): Promise<ReportingPeriod[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('reporting_periods')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) {
        Logger.error(error, 'fetchReportingPeriods');
        return [];
      }

      return ((data as ReportingPeriodRow[]) || []).map(SUPABASE_API.mapReportingPeriodToApp);
    } catch (error) {
      Logger.error(error, 'fetchReportingPeriods');
      return [];
    }
  },

  createReportingPeriod: async (
    report: Partial<ReportingPeriod>,
  ): Promise<ReportingPeriod | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const dbReport = SUPABASE_API.mapReportingPeriodToDb(report);
      const { data, error } = await supabase
        .from('reporting_periods')
        .insert(dbReport)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'createReportingPeriod');
        return null;
      }

      return data ? SUPABASE_API.mapReportingPeriodToApp(data as ReportingPeriodRow) : null;
    } catch (error) {
      Logger.error(error, 'createReportingPeriod');
      return null;
    }
  },

  updateReportingPeriod: async (
    id: string,
    updates: Partial<ReportingPeriod>,
  ): Promise<ReportingPeriod | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const patch = SUPABASE_API.mapReportingPeriodPatchToDb(updates);
      if (Object.keys(patch).length === 0) return null;

      const { data, error } = await supabase
        .from('reporting_periods')
        .update(patch)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'updateReportingPeriod');
        return null;
      }

      return data ? SUPABASE_API.mapReportingPeriodToApp(data as ReportingPeriodRow) : null;
    } catch (error) {
      Logger.error(error, 'updateReportingPeriod');
      return null;
    }
  },

  deleteReportingPeriod: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('reporting_periods').delete().eq('id', id);
      if (error) {
        Logger.error(error, 'deleteReportingPeriod');
        return false;
      }
      return true;
    } catch (error) {
      Logger.error(error, 'deleteReportingPeriod');
      return false;
    }
  },

  // ==========================================
  // LINKEDIN SUBMISSIONS
  // ==========================================

  fetchLinkedInSubmissions: async (
    options: FetchLinkedInOptions = {},
  ): Promise<LinkedInSubmission[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      let query = supabase
        .from('linkedin_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (options.month) {
        const startDate = `${options.month}-01`;
        const endDate = getMonthEndDate(options.month);
        query = query.gte('target_date', startDate).lte('target_date', endDate);
      }

      const { data, error } = await query;

      if (error) {
        Logger.error(error, 'fetchLinkedInSubmissions');
        return [];
      }

      return ((data as LinkedInRow[]) || []).map(SUPABASE_API.mapLinkedInToApp);
    } catch (error) {
      Logger.error(error, 'fetchLinkedInSubmissions');
      return [];
    }
  },

  saveLinkedInSubmission: async (
    submission: Partial<LinkedInSubmission>,
    userEmail: string,
  ): Promise<LinkedInSubmission | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const dbSubmission = SUPABASE_API.mapLinkedInToDb(submission, userEmail);

      const { data, error } = await supabase
        .from('linkedin_submissions')
        .upsert(dbSubmission)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'saveLinkedInSubmission');
        return null;
      }

      return data ? SUPABASE_API.mapLinkedInToApp(data as LinkedInRow) : null;
    } catch (error) {
      Logger.error(error, 'saveLinkedInSubmission');
      return null;
    }
  },

  deleteLinkedInSubmission: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('linkedin_submissions').delete().eq('id', id);

      if (error) {
        Logger.error(error, 'deleteLinkedInSubmission');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(error, 'deleteLinkedInSubmission');
      return false;
    }
  },

  // ==========================================
  // TESTING FRAMEWORKS
  // ==========================================

  fetchTestingFrameworks: async (): Promise<TestingFramework[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('testing_frameworks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        Logger.error(error, 'fetchTestingFrameworks');
        return [];
      }

      return (data as TestingFrameworkRow[])?.map(mapTestingFrameworkToApp) || [];
    } catch (error) {
      Logger.error(error, 'fetchTestingFrameworks');
      return [];
    }
  },

  saveTestingFramework: async (
    framework: Partial<TestingFramework>,
  ): Promise<TestingFramework | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const dbRow = mapTestingFrameworkToDb(framework);
      const { data, error } = await supabase
        .from('testing_frameworks')
        .upsert(dbRow)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'saveTestingFramework');
        return null;
      }

      return mapTestingFrameworkToApp(data as TestingFrameworkRow);
    } catch (error) {
      Logger.error(error, 'saveTestingFramework');
      return null;
    }
  },

  deleteTestingFramework: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('testing_frameworks').delete().eq('id', id);

      if (error) {
        Logger.error(error, 'deleteTestingFramework');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(error, 'deleteTestingFramework');
      return false;
    }
  },

  // ==========================================
  // INFLUENCERS
  // ==========================================

  fetchInfluencers: async (): Promise<Influencer[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('influencers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        Logger.error(error, 'fetchInfluencers');
        return [];
      }

      return ((data as InfluencerRow[]) || []).map(SUPABASE_API.mapInfluencerToApp);
    } catch (error) {
      Logger.error(error, 'fetchInfluencers');
      return [];
    }
  },

  saveInfluencer: async (influencer: Influencer): Promise<Influencer | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const dbInfluencer = SUPABASE_API.mapInfluencerToDb(influencer);

      const { data, error } = await supabase
        .from('influencers')
        .upsert(dbInfluencer)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'saveInfluencer');
        return null;
      }

      return data ? SUPABASE_API.mapInfluencerToApp(data as InfluencerRow) : null;
    } catch (error) {
      Logger.error(error, 'saveInfluencer');
      return null;
    }
  },

  deleteInfluencer: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('influencers').delete().eq('id', id);

      if (error) {
        Logger.error(error, 'deleteInfluencer');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(error, 'deleteInfluencer');
      return false;
    }
  },

  // ==========================================
  // GUIDELINES
  // ==========================================

  fetchGuidelines: async (): Promise<Guidelines | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('guidelines')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();

      if (error) {
        Logger.error(error, 'fetchGuidelines');
        return null;
      }

      return data ? SUPABASE_API.mapGuidelinesToApp(data as GuidelinesRow) : null;
    } catch (error) {
      Logger.error(error, 'fetchGuidelines');
      return null;
    }
  },

  saveGuidelines: async (guidelines: Partial<Guidelines>): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const dbGuidelines = SUPABASE_API.mapGuidelinesToDb(guidelines);

      const { error } = await supabase.from('guidelines').upsert(dbGuidelines);

      if (error) {
        Logger.error(error, 'saveGuidelines');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(error, 'saveGuidelines');
      return false;
    }
  },

  // ==========================================
  // SECRETS (admin-only)
  // ==========================================

  fetchTeamsWebhookUrl: async (): Promise<string | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('app_secrets')
        .select('value')
        .eq('key', 'teams_webhook_url')
        .single();

      if (error) {
        // RLS will block non-admins with a permission error — that's expected
        if (error.code === 'PGRST116' || error.code === '42501') return null;
        Logger.error(error, 'fetchTeamsWebhookUrl');
        return null;
      }

      return data?.value || null;
    } catch (error) {
      Logger.error(error, 'fetchTeamsWebhookUrl');
      return null;
    }
  },

  saveTeamsWebhookUrl: async (url: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('app_secrets').upsert({
        key: 'teams_webhook_url',
        value: url,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        Logger.error(error, 'saveTeamsWebhookUrl');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(error, 'saveTeamsWebhookUrl');
      return false;
    }
  },

  // ==========================================
  // USER PROFILES
  // ==========================================

  fetchUserProfiles: async (): Promise<UserProfileRow[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        Logger.error(error, 'fetchUserProfiles');
        return [];
      }

      return (data as UserProfileRow[]) || [];
    } catch (error) {
      Logger.error(error, 'fetchUserProfiles');
      return [];
    }
  },

  fetchAdminUsers: async (): Promise<(AppUser & { managerEmail?: string | null })[]> => {
    try {
      const { users } = await invokeAdminUsers({ action: 'list' });
      return Array.isArray(users) ? users.map(mapUserProfileToAppUser) : [];
    } catch (error) {
      Logger.error(error, 'fetchAdminUsers');
      const profiles = await SUPABASE_API.fetchUserProfiles();
      return profiles.map(mapUserProfileToAppUser);
    }
  },

  fetchCurrentUserProfile: async (): Promise<UserProfileRow | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      return resolveCurrentUserProfile(user);
    } catch (error) {
      Logger.error(error, 'fetchCurrentUserProfile');
      return null;
    }
  },

  inviteAdminUser: async (
    userData: Required<Pick<AdminUserUpsertPayload, 'name' | 'email'>> &
      Pick<AdminUserUpsertPayload, 'features' | 'isApprover'>,
  ): Promise<InviteAdminUserResult> => {
    try {
      const { user, inviteSent } = await invokeAdminUsers({
        action: 'create',
        ...userData,
      });
      return {
        user: user ? mapUserProfileToAppUser(user) : null,
        inviteSent: inviteSent !== false,
      };
    } catch (error) {
      Logger.error(error, 'inviteAdminUser');
      throw error instanceof Error ? error : new Error('Unable to invite user');
    }
  },

  updateUserProfile: async (
    profileData: Partial<UserProfileRow>,
  ): Promise<UserProfileRow | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const profile = await resolveCurrentUserProfile(user);
      if (!profile) return null;

      const { data, error } = await supabase
        .from('user_profiles')
        .update(profileData)
        .eq('id', profile.id)
        .eq('email', profile.email)
        .select()
        .single();

      if (error) {
        Logger.error(error, 'updateUserProfile');
        return null;
      }

      return data as UserProfileRow;
    } catch (error) {
      Logger.error(error, 'updateUserProfile');
      return null;
    }
  },

  updateAdminUser: async (
    id: string,
    patch: AdminUserUpsertPayload,
  ): Promise<(AppUser & { managerEmail?: string | null }) | null> => {
    try {
      const { user } = await invokeAdminUsers({ action: 'update', id, patch });
      return user ? mapUserProfileToAppUser(user) : null;
    } catch (error) {
      Logger.error(error, 'updateAdminUser');
      throw error instanceof Error ? error : new Error('Unable to update user');
    }
  },

  deleteAdminUser: async (id: string): Promise<boolean> => {
    try {
      const { ok } = await invokeAdminUsers({ action: 'delete', id });
      return Boolean(ok);
    } catch (error) {
      Logger.error(error, 'deleteAdminUser');
      throw error instanceof Error ? error : new Error('Unable to delete user');
    }
  },

  updateUserManager: async (userEmail: string, managerEmail: string | null): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ manager_email: managerEmail })
        .eq('email', userEmail);

      if (error) {
        Logger.error(error, 'updateUserManager');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(error, 'updateUserManager');
      return false;
    }
  },

  // ==========================================
  // ACTIVITY LOG
  // ==========================================

  logActivity: async (activity: ActivityInput): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from('activity_log').insert({
        action_type: activity.actionType,
        target_type: activity.targetType,
        target_id: activity.targetId,
        target_title: activity.targetTitle,
        actor_email: user?.email || window.__currentUserEmail || 'unknown',
        actor_name: window.__currentUserName || 'Unknown',
        details: activity.details || {},
        related_users: activity.relatedUsers || [],
      });

      if (error) {
        Logger.error(error, 'logActivity');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(error, 'logActivity');
      return false;
    }
  },

  fetchRecentActivity: async (limit = 50): Promise<ActivityLogRow[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        Logger.error(error, 'fetchRecentActivity');
        return [];
      }

      return (data as ActivityLogRow[]) || [];
    } catch (error) {
      Logger.error(error, 'fetchRecentActivity');
      return [];
    }
  },

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  fetchNotifications: async (limit = 30): Promise<NotificationRow[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_email', user.email)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        Logger.error(error, 'fetchNotifications');
        return [];
      }

      return (data as NotificationRow[]) || [];
    } catch (error) {
      Logger.error(error, 'fetchNotifications');
      return [];
    }
  },

  markNotificationRead: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);

      if (error) {
        Logger.error(error, 'markNotificationRead');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(error, 'markNotificationRead');
      return false;
    }
  },

  // ==========================================
  // CUSTOM NICHES (Influencer feature)
  // ==========================================

  fetchCustomNiches: async (): Promise<string[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('custom_niches')
        .select('niches')
        .eq('id', 'default')
        .maybeSingle();

      if (error) {
        Logger.error(error, 'fetchCustomNiches');
        return [];
      }

      return (data?.niches as string[]) || [];
    } catch (error) {
      Logger.error(error, 'fetchCustomNiches');
      return [];
    }
  },

  saveCustomNiches: async (niches: string[]): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('custom_niches').upsert({
        id: 'default',
        niches: niches,
      });

      if (error) {
        Logger.error(error, 'saveCustomNiches');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(error, 'saveCustomNiches');
      return false;
    }
  },

  // ==========================================
  // REAL-TIME SUBSCRIPTIONS
  // ==========================================

  subscribeToEntries: (callback: (payload: unknown) => void) => {
    if (!supabase) return null;

    // Supabase realtime postgres_changes requires runtime event type
    // that TypeScript SDK doesn't fully type.
    return (supabase.channel('entries-changes') as any)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, callback)
      .subscribe();
  },

  // ==========================================
  // DATA MAPPING FUNCTIONS
  // ==========================================

  mapEntryToApp: (row: EntryRow): Entry => ({
    id: row.id,
    date: row.date,
    platforms: row.platforms || [],
    assetType: row.asset_type,
    caption: row.caption,
    platformCaptions: row.platform_captions || {},
    firstComment: row.first_comment,
    approvalDeadline: row.approval_deadline,
    firstCheckDate: row.first_check_date || '',
    secondCheckDate: row.second_check_date || '',
    assetProductionDate: row.asset_production_date || '',
    finalCheckDate: row.final_check_date || '',
    assetPreviews: Array.isArray(row.asset_previews) ? row.asset_previews : [],
    status: row.status,
    priorityTier: mapPriorityTierFromDb(row.priority_tier),
    approvers: row.approvers || [],
    author: row.author,
    campaign: row.campaign,
    contentPillar: row.content_pillar,
    contentCategory: mapContentCategoryFromDb(row.content_category),
    responseMode: mapResponseModeFromDb(row.response_mode),
    signOffRoute: mapSignOffRouteFromDb(row.sign_off_route),
    contentPeak: row.content_peak || undefined,
    seriesName: row.series_name || undefined,
    episodeNumber: row.episode_number ?? undefined,
    originContentId: row.origin_content_id || undefined,
    partnerOrg: row.partner_org || undefined,
    partnerIndividualName: row.partner_individual_name ?? undefined,
    partnerConsentStatus:
      (row.partner_consent_status as 'confirmed' | 'pending' | 'not-required' | undefined) ??
      undefined,
    partnerCaptureContext: row.partner_capture_context ?? undefined,
    altTextStatus: mapExecutionStatusFromDb(row.alt_text_status),
    subtitlesStatus: mapExecutionStatusFromDb(row.subtitles_status),
    utmStatus: mapExecutionStatusFromDb(row.utm_status),
    sourceVerified: typeof row.source_verified === 'boolean' ? row.source_verified : undefined,
    seoPrimaryQuery: row.seo_primary_query || undefined,
    linkPlacement: mapLinkPlacementFromDb(row.link_placement),
    ctaType: mapCtaTypeFromDb(row.cta_type),
    previewUrl: row.preview_url,
    checklist: row.checklist || {},
    analytics: row.analytics || {},
    workflowStatus: mapWorkflowStatusFromDb(row.workflow_status),
    statusDetail: row.status_detail,
    aiFlags: row.ai_flags || [],
    aiScore: row.ai_score || {},
    testingFrameworkId: row.testing_framework_id,
    testingFrameworkName: row.testing_framework_name,
    audienceSegments: row.audience_segments || [],
    goldenThreadPass: row.golden_thread_pass ?? null,
    assessmentScores: row.assessment_scores || null,
    influencerId: row.influencer_id || undefined,
    evergreen: row.evergreen || false,
    url: row.url || undefined,
    script: row.script || undefined,
    designCopy: row.design_copy || undefined,
    carouselSlides: row.carousel_slides || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
    deletedAt: row.deleted_at,
    comments: (() => {
      if (!row.comments) return [];
      try {
        return JSON.parse(row.comments);
      } catch {
        return [];
      }
    })(),
  }),

  mapEntryToDb: (entry: Partial<Entry>, userEmail: string) => ({
    id: entry.id || undefined,
    date: dateOrNull(entry.date),
    platforms: entry.platforms || [],
    asset_type: entry.assetType || 'Design',
    caption: entry.caption,
    platform_captions: entry.platformCaptions || {},
    first_comment: entry.firstComment,
    approval_deadline: dateOrNull(entry.approvalDeadline),
    first_check_date: dateOrNull(entry.firstCheckDate),
    second_check_date: dateOrNull(entry.secondCheckDate),
    asset_production_date: dateOrNull(entry.assetProductionDate),
    final_check_date: dateOrNull(entry.finalCheckDate),
    asset_previews: entry.assetPreviews ?? [],
    status: entry.status || 'Pending',
    priority_tier: mapPriorityTierToDb(entry.priorityTier),
    approvers: entry.approvers || [],
    author: entry.author,
    author_email: userEmail,
    campaign: entry.campaign,
    content_pillar: entry.contentPillar,
    content_category: entry.contentCategory || null,
    response_mode: entry.responseMode || null,
    sign_off_route: entry.signOffRoute || null,
    content_peak: entry.contentPeak || null,
    series_name: entry.seriesName || null,
    episode_number: entry.episodeNumber ?? null,
    origin_content_id: entry.originContentId || null,
    partner_org: entry.partnerOrg || null,
    partner_individual_name: entry.partnerIndividualName ?? null,
    partner_consent_status: entry.partnerConsentStatus ?? null,
    partner_capture_context: entry.partnerCaptureContext ?? null,
    alt_text_status: entry.altTextStatus || null,
    subtitles_status: entry.subtitlesStatus || null,
    utm_status: entry.utmStatus || null,
    source_verified: typeof entry.sourceVerified === 'boolean' ? entry.sourceVerified : null,
    seo_primary_query: entry.seoPrimaryQuery || null,
    link_placement: entry.linkPlacement || null,
    cta_type: entry.ctaType || null,
    preview_url: entry.previewUrl,
    checklist: entry.checklist || {},
    analytics: entry.analytics || {},
    workflow_status: mapWorkflowStatusToDb(entry.workflowStatus),
    status_detail: entry.statusDetail,
    ai_flags: entry.aiFlags || [],
    ai_score: entry.aiScore || {},
    testing_framework_id: entry.testingFrameworkId || null,
    testing_framework_name: entry.testingFrameworkName,
    audience_segments: entry.audienceSegments || [],
    golden_thread_pass: entry.goldenThreadPass ?? null,
    assessment_scores: entry.assessmentScores || null,
    influencer_id: entry.influencerId || null,
    evergreen: entry.evergreen || false,
    url: entry.url || null,
    script: entry.script || null,
    design_copy: entry.designCopy || null,
    carousel_slides: entry.carouselSlides || [],
    approved_at: entry.approvedAt ?? null,
    comments: entry.comments && entry.comments.length ? JSON.stringify(entry.comments) : null,
  }),

  mapMonthlyReportToApp: (row: MonthlyReportRow): MonthlyReport => ({
    id: row.id,
    reportType: (row.report_type as MonthlyReport['reportType']) || 'monthly',
    periodMonth: row.period_month ?? undefined,
    periodQuarter: row.period_quarter ?? undefined,
    periodYear: row.period_year,
    campaignName: row.campaign_name ?? undefined,
    dateFrom: row.date_from ?? undefined,
    dateTo: row.date_to ?? undefined,
    platformMetrics: row.platform_metrics || {},
    qualitative: {
      whatWorked: row.qualitative?.whatWorked || '',
      whatDidnt: row.qualitative?.whatDidnt || '',
      themes: row.qualitative?.themes || '',
      nextPeriodFocus: row.qualitative?.nextPeriodFocus || '',
      highlights: row.qualitative?.highlights || '',
      audienceQuality: row.qualitative?.audienceQuality,
      coalitionSignals: row.qualitative?.coalitionSignals,
      narrativeUptake: row.qualitative?.narrativeUptake,
      pillarPerformance: row.qualitative?.pillarPerformance,
      platformTierReview: row.qualitative?.platformTierReview,
    },
    createdBy: row.created_by || '',
    createdByEmail: row.created_by_email || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),

  mapMonthlyReportToDb: (
    report: Omit<MonthlyReport, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string,
  ) => ({
    id: existingId || undefined,
    report_type: report.reportType || 'monthly',
    period_month: report.periodMonth ?? null,
    period_quarter: report.periodQuarter ?? null,
    period_year: report.periodYear,
    campaign_name: report.campaignName ?? null,
    date_from: report.dateFrom ?? null,
    date_to: report.dateTo ?? null,
    platform_metrics: report.platformMetrics || {},
    qualitative: {
      whatWorked: report.qualitative.whatWorked || '',
      whatDidnt: report.qualitative.whatDidnt || '',
      themes: report.qualitative.themes || '',
      nextPeriodFocus: report.qualitative.nextPeriodFocus || '',
      highlights: report.qualitative.highlights || '',
      audienceQuality: report.qualitative.audienceQuality || '',
      coalitionSignals: report.qualitative.coalitionSignals || '',
      narrativeUptake: report.qualitative.narrativeUptake || '',
      pillarPerformance: report.qualitative.pillarPerformance || '',
      platformTierReview: report.qualitative.platformTierReview || '',
    },
    created_by: report.createdBy || '',
    created_by_email: report.createdByEmail || '',
  }),

  mapIdeaToApp: (row: IdeaRow): Idea => ({
    id: row.id,
    type: row.type,
    title: row.title,
    notes: row.notes,
    links: row.links || [],
    attachments: row.attachments || [],
    inspiration: row.inspiration,
    createdBy: row.created_by,
    targetDate: row.target_date,
    targetMonth: row.target_month,
    createdAt: row.created_at,
  }),

  mapIdeaToDb: (idea: Partial<Idea>, userEmail: string) => ({
    id: idea.id || undefined,
    type: idea.type || 'Other',
    title: idea.title,
    notes: idea.notes,
    links: idea.links || [],
    attachments: idea.attachments || [],
    inspiration: idea.inspiration,
    created_by: idea.createdBy,
    created_by_email: userEmail,
    target_date: dateOrNull(idea.targetDate),
    target_month: idea.targetMonth || (idea.targetDate ? idea.targetDate.substring(0, 7) : null),
  }),

  mapCampaignToApp: (row: CampaignRow): PlanningCampaign => ({
    id: row.id,
    name: row.name,
    type: (row.type as PlanningCampaign['type']) || 'campaign',
    startDate: row.start_date,
    endDate: row.end_date,
    colour: row.colour,
    notes: row.notes ?? undefined,
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
  }),

  mapCampaignToDb: (campaign: Partial<PlanningCampaign>, userEmail: string) => ({
    id: campaign.id || undefined,
    name: campaign.name,
    type: campaign.type || 'campaign',
    start_date: campaign.startDate,
    end_date: campaign.endDate,
    colour: campaign.colour || '#6366f1',
    notes: campaign.notes || null,
    created_by: campaign.createdBy || userEmail || null,
  }),

  mapOpportunityToApp: (row: OpportunityRow): Opportunity => ({
    id: row.id,
    date: row.date,
    description: row.description || '',
    angle: row.angle || '',
    urgency: mapOpportunityUrgencyFromDb(row.urgency),
    status: mapOpportunityStatusFromDb(row.status),
    createdBy: row.created_by || '',
    linkedEntryId: row.linked_entry_id || undefined,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || row.created_at || '',
  }),

  mapOpportunityToDb: (opportunity: Partial<Opportunity>, userEmail: string) => ({
    id: opportunity.id || undefined,
    date: dateOrNull(opportunity.date),
    description: opportunity.description || '',
    angle: opportunity.angle || '',
    urgency: mapOpportunityUrgencyToDb(opportunity.urgency),
    status: mapOpportunityStatusToDb(opportunity.status),
    created_by: opportunity.createdBy || '',
    created_by_email: userEmail,
    linked_entry_id: opportunity.linkedEntryId || null,
  }),

  mapContentRequestToApp: (row: ContentRequestRow): ContentRequest => ({
    id: row.id,
    title: row.title || '',
    keyMessages: row.key_messages || '',
    assetsNeeded: row.assets_needed || '',
    audienceSegments: row.audience_segments || [],
    approvers: row.approvers || [],
    deadline: row.deadline || undefined,
    notes: row.notes || '',
    generatedBrief: row.generated_brief || '',
    status: mapContentRequestStatusFromDb(row.status),
    createdBy: row.created_by || '',
    convertedEntryId: row.converted_entry_id || undefined,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || row.created_at || '',
  }),

  mapContentRequestToDb: (request: Partial<ContentRequest>, userEmail: string) => ({
    id: request.id || undefined,
    title: request.title || '',
    key_messages: request.keyMessages || '',
    assets_needed: request.assetsNeeded || '',
    audience_segments: request.audienceSegments || [],
    approvers: request.approvers || [],
    deadline: dateOrNull(request.deadline),
    notes: request.notes || '',
    generated_brief: request.generatedBrief || '',
    status: mapContentRequestStatusToDb(request.status),
    created_by: request.createdBy || '',
    created_by_email: userEmail,
    converted_entry_id: request.convertedEntryId || null,
  }),

  mapContentRequestPatchToDb: (request: Partial<ContentRequest>) => {
    const patch: Record<string, unknown> = {};
    if (request.title !== undefined) patch.title = request.title;
    if (request.keyMessages !== undefined) patch.key_messages = request.keyMessages;
    if (request.assetsNeeded !== undefined) patch.assets_needed = request.assetsNeeded;
    if (request.audienceSegments !== undefined) patch.audience_segments = request.audienceSegments;
    if (request.approvers !== undefined) patch.approvers = request.approvers;
    if (request.deadline !== undefined) patch.deadline = dateOrNull(request.deadline);
    if (request.notes !== undefined) patch.notes = request.notes;
    if (request.generatedBrief !== undefined) patch.generated_brief = request.generatedBrief;
    if (request.status !== undefined) patch.status = mapContentRequestStatusToDb(request.status);
    if (request.createdBy !== undefined) patch.created_by = request.createdBy;
    if (request.convertedEntryId !== undefined) {
      patch.converted_entry_id = request.convertedEntryId || null;
    }
    return patch;
  },

  mapContentPeakToApp: (row: ContentPeakRow): ContentPeak => ({
    id: row.id,
    title: row.title || '',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    priorityTier:
      PRIORITY_TIERS.find((tier) => tier === row.priority_tier) ??
      ('High' as ContentPeak['priorityTier']),
    owner: row.owner || '',
    campaign: row.campaign || undefined,
    contentPillar: row.content_pillar || undefined,
    responseMode: mapResponseModeFromDb(row.response_mode),
    requiredPlatforms: row.required_platforms || [],
    requiredAssetTypes: row.required_asset_types || [],
    linkedEntryIds: row.linked_entry_ids || [],
    description: row.description || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || row.created_at || '',
  }),

  mapContentPeakToDb: (peak: Partial<ContentPeak>): Record<string, unknown> => {
    const row: Record<string, unknown> = {};
    if (peak.id !== undefined) row.id = peak.id;
    if (peak.title !== undefined) row.title = peak.title;
    if (peak.startDate !== undefined) row.start_date = dateOrNull(peak.startDate);
    if (peak.endDate !== undefined) row.end_date = dateOrNull(peak.endDate);
    if (peak.priorityTier !== undefined) row.priority_tier = mapPriorityTierToDb(peak.priorityTier);
    if (peak.owner !== undefined) row.owner = peak.owner || null;
    if (peak.campaign !== undefined) row.campaign = peak.campaign || null;
    if (peak.contentPillar !== undefined) row.content_pillar = peak.contentPillar || null;
    if (peak.responseMode !== undefined) row.response_mode = peak.responseMode || null;
    if (peak.requiredPlatforms !== undefined) row.required_platforms = peak.requiredPlatforms;
    if (peak.requiredAssetTypes !== undefined) row.required_asset_types = peak.requiredAssetTypes;
    if (peak.linkedEntryIds !== undefined) row.linked_entry_ids = peak.linkedEntryIds;
    if (peak.description !== undefined) row.description = peak.description || null;
    if (peak.notes !== undefined) row.notes = peak.notes || null;
    if (peak.createdAt !== undefined) row.created_at = peak.createdAt;
    if (peak.updatedAt !== undefined) row.updated_at = peak.updatedAt;
    return row;
  },

  mapContentSeriesToApp: (row: ContentSeriesRow): ContentSeries => ({
    id: row.id,
    title: row.title || '',
    owner: row.owner || '',
    status: (row.status as ContentSeries['status']) || 'Active',
    targetPlatforms: row.target_platforms || [],
    targetEpisodeCount: row.target_episode_count ?? undefined,
    reviewCheckpoint: row.review_checkpoint ?? 3,
    campaign: row.campaign || undefined,
    contentPillar: row.content_pillar || undefined,
    responseMode: mapResponseModeFromDb(row.response_mode),
    linkedEntryIds: row.linked_entry_ids || [],
    description: row.description || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || row.created_at || '',
  }),

  mapContentSeriesToDb: (series: Partial<ContentSeries>): Record<string, unknown> => {
    const row: Record<string, unknown> = {};
    if (series.id !== undefined) row.id = series.id;
    if (series.title !== undefined) row.title = series.title;
    if (series.owner !== undefined) row.owner = series.owner || null;
    if (series.status !== undefined) row.status = series.status;
    if (series.targetPlatforms !== undefined) row.target_platforms = series.targetPlatforms;
    if (series.targetEpisodeCount !== undefined) {
      row.target_episode_count = series.targetEpisodeCount ?? null;
    }
    if (series.reviewCheckpoint !== undefined) row.review_checkpoint = series.reviewCheckpoint;
    if (series.campaign !== undefined) row.campaign = series.campaign || null;
    if (series.contentPillar !== undefined) row.content_pillar = series.contentPillar || null;
    if (series.responseMode !== undefined) row.response_mode = series.responseMode || null;
    if (series.linkedEntryIds !== undefined) row.linked_entry_ids = series.linkedEntryIds;
    if (series.description !== undefined) row.description = series.description || null;
    if (series.notes !== undefined) row.notes = series.notes || null;
    if (series.createdAt !== undefined) row.created_at = series.createdAt;
    if (series.updatedAt !== undefined) row.updated_at = series.updatedAt;
    return row;
  },

  mapRapidResponseToApp: (row: RapidResponseRow): RapidResponse => ({
    id: row.id,
    title: row.title || '',
    owner: row.owner || '',
    status: (row.status as RapidResponse['status']) || 'New',
    responseMode:
      (mapResponseModeFromDb(row.response_mode) as RapidResponse['responseMode'] | undefined) ??
      'Reactive',
    triggerDate: row.trigger_date || '',
    dueAt: row.due_at || '',
    signOffRoute: mapSignOffRouteFromDb(row.sign_off_route),
    sourceOpportunityId: row.source_opportunity_id || undefined,
    linkedEntryId: row.linked_entry_id || undefined,
    campaign: row.campaign || undefined,
    contentPillar: row.content_pillar || undefined,
    targetPlatforms: row.target_platforms || [],
    notes: row.notes || undefined,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || row.created_at || '',
  }),

  mapRapidResponseToDb: (response: Partial<RapidResponse>): Record<string, unknown> => {
    const row: Record<string, unknown> = {};
    if (response.id !== undefined) row.id = response.id;
    if (response.title !== undefined) row.title = response.title;
    if (response.owner !== undefined) row.owner = response.owner || null;
    if (response.status !== undefined) row.status = response.status;
    if (response.responseMode !== undefined) row.response_mode = response.responseMode;
    if (response.triggerDate !== undefined) row.trigger_date = dateOrNull(response.triggerDate);
    if (response.dueAt !== undefined) row.due_at = response.dueAt || null;
    if (response.signOffRoute !== undefined) row.sign_off_route = response.signOffRoute || null;
    if (response.sourceOpportunityId !== undefined) {
      row.source_opportunity_id = response.sourceOpportunityId || null;
    }
    if (response.linkedEntryId !== undefined) row.linked_entry_id = response.linkedEntryId || null;
    if (response.campaign !== undefined) row.campaign = response.campaign || null;
    if (response.contentPillar !== undefined) row.content_pillar = response.contentPillar || null;
    if (response.targetPlatforms !== undefined) row.target_platforms = response.targetPlatforms;
    if (response.notes !== undefined) row.notes = response.notes || null;
    if (response.createdAt !== undefined) row.created_at = response.createdAt;
    if (response.updatedAt !== undefined) row.updated_at = response.updatedAt;
    return row;
  },

  mapReportingPeriodToApp: (row: ReportingPeriodRow): ReportingPeriod => ({
    id: row.id,
    cadence: (row.cadence as ReportingPeriod['cadence']) || 'Monthly',
    label: row.label || '',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    status: (row.status as ReportingPeriod['status']) || 'Draft',
    owner: row.owner || '',
    metrics: (row.metrics as ReportingPeriod['metrics']) || {
      tier1: {},
      tier2: {},
      tier3: {},
      platforms: {},
      contentPillars: {},
      audienceSegments: {},
      derivedTotals: {},
    },
    narrative: (row.narrative as unknown as ReportingPeriod['narrative']) || {
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
    qualitative: (row.qualitative as unknown as ReportingPeriod['qualitative']) || {
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
    completeness: (row.completeness as unknown as ReportingPeriod['completeness']) || {
      complete: false,
      completionRatio: 0,
      missingMetricIds: [],
      missingNarrativeIds: [],
      missingQualitativeIds: [],
      lastCheckedAt: '',
    },
    publishedAt: row.published_at,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || row.created_at || '',
  }),

  mapReportingPeriodToDb: (report: Partial<ReportingPeriod>) => ({
    id: report.id || undefined,
    cadence: report.cadence || 'Monthly',
    label: report.label || '',
    start_date: dateOrNull(report.startDate),
    end_date: dateOrNull(report.endDate),
    status: report.status || 'Draft',
    owner: report.owner || '',
    metrics: report.metrics || {},
    narrative: report.narrative || {},
    qualitative: report.qualitative || {},
    completeness: report.completeness || {},
    published_at: report.publishedAt || null,
  }),

  mapReportingPeriodPatchToDb: (report: Partial<ReportingPeriod>) => {
    const patch: Record<string, unknown> = {};
    if (report.cadence !== undefined) patch.cadence = report.cadence;
    if (report.label !== undefined) patch.label = report.label;
    if (report.startDate !== undefined) patch.start_date = dateOrNull(report.startDate);
    if (report.endDate !== undefined) patch.end_date = dateOrNull(report.endDate);
    if (report.status !== undefined) patch.status = report.status;
    if (report.owner !== undefined) patch.owner = report.owner;
    if (report.metrics !== undefined) patch.metrics = report.metrics;
    if (report.narrative !== undefined) patch.narrative = report.narrative;
    if (report.qualitative !== undefined) patch.qualitative = report.qualitative;
    if (report.completeness !== undefined) patch.completeness = report.completeness;
    if (report.publishedAt !== undefined) patch.published_at = report.publishedAt || null;
    return patch;
  },

  mapLinkedInToApp: (row: LinkedInRow): LinkedInSubmission => ({
    id: row.id,
    submissionType: row.submission_type,
    status: row.status,
    title: row.title,
    postCopy: row.post_copy,
    comments: row.comments,
    owner: row.owner,
    submitter: row.submitter,
    links: row.links || [],
    attachments: row.attachments || [],
    targetDate: row.target_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),

  mapLinkedInToDb: (submission: Partial<LinkedInSubmission>, userEmail: string) => ({
    id: submission.id || undefined,
    submission_type: submission.submissionType || 'My own account',
    status: submission.status || 'Draft',
    title: submission.title,
    post_copy: submission.postCopy,
    comments: submission.comments,
    owner: submission.owner,
    owner_email: userEmail,
    submitter: submission.submitter,
    submitter_email: userEmail,
    links: submission.links || [],
    attachments: submission.attachments || [],
    target_date: dateOrNull(submission.targetDate),
  }),

  mapGuidelinesToApp: (row: GuidelinesRow): Guidelines => ({
    charLimits: row.char_limits || {},
    bannedWords: row.banned_words || [],
    requiredPhrases: row.required_phrases || [],
    languageGuide: row.language_guide,
    hashtagTips: row.hashtag_tips,
    approverDirectory: row.approver_directory || [],
  }),

  mapGuidelinesToDb: (guidelines: Partial<Guidelines>) => ({
    id: 'default',
    char_limits: guidelines.charLimits || {},
    banned_words: guidelines.bannedWords || [],
    required_phrases: guidelines.requiredPhrases || [],
    language_guide: guidelines.languageGuide,
    hashtag_tips: guidelines.hashtagTips,
    approver_directory: guidelines.approverDirectory || [],
  }),

  mapInfluencerToApp: (row: InfluencerRow): Influencer => {
    // Map platform profiles from DB format
    const platformProfiles: PlatformProfile[] | undefined = row.platform_profiles
      ? row.platform_profiles.map((p) => ({
          platform: p.platform || '',
          handle: p.handle || '',
          profileUrl: p.profile_url || '',
        }))
      : undefined;

    return {
      id: row.id,
      createdAt: row.created_at,
      createdBy: row.created_by,
      name: row.name,
      handle: row.handle || '',
      profileUrl: row.profile_url || '',
      platform: row.platform || '',
      platformProfiles,
      followerCount: row.follower_count || 0,
      engagementRate: row.engagement_rate ?? undefined,
      contactEmail: row.contact_email || '',
      niche: row.niche || '',
      estimatedRate: row.estimated_rate ?? undefined,
      notes: row.notes || '',
      status: row.status as Influencer['status'],
    };
  },

  mapInfluencerToDb: (influencer: Influencer) => {
    // Map platform profiles to DB format
    const platformProfiles = influencer.platformProfiles
      ? influencer.platformProfiles.map((p) => ({
          platform: p.platform || '',
          handle: p.handle || '',
          profile_url: p.profileUrl || '',
        }))
      : null;

    return {
      id: influencer.id,
      created_at: influencer.createdAt,
      created_by: influencer.createdBy,
      name: influencer.name,
      handle: influencer.handle || '',
      profile_url: influencer.profileUrl || '',
      platform: influencer.platform || '',
      platform_profiles: platformProfiles,
      follower_count: influencer.followerCount || 0,
      engagement_rate: influencer.engagementRate ?? null,
      contact_email: influencer.contactEmail || '',
      niche: influencer.niche || '',
      estimated_rate: influencer.estimatedRate ?? null,
      notes: influencer.notes || '',
      status: influencer.status,
    };
  },

  // ==========================================
  // PLANNING NOTES
  // ==========================================

  fetchPlanningNotes: async (): Promise<Record<string, string>> => {
    await initSupabase();
    if (!supabase) return {};

    try {
      const { data, error } = await supabase.from('planning_notes').select('date, content');

      if (error) {
        Logger.error(error, 'fetchPlanningNotes');
        return {};
      }

      return Object.fromEntries(
        (data ?? []).map((row) => [row.date as string, row.content as string]),
      );
    } catch (error) {
      Logger.error(error, 'fetchPlanningNotes');
      return {};
    }
  },

  savePlanningNote: async (date: string, content: string, updatedBy: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase
        .from('planning_notes')
        .upsert(
          { date, content, updated_by: updatedBy, updated_at: new Date().toISOString() },
          { onConflict: 'date' },
        );

      if (error) {
        Logger.error(error, 'savePlanningNote');
        return false;
      }

      return true;
    } catch (error) {
      Logger.error(error, 'savePlanningNote');
      return false;
    }
  },

  // ==========================================
  // ORG EVENTS
  // ==========================================

  fetchOrgEvents: async (year: number): Promise<OrgEvent[]> => {
    await initSupabase();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('org_events')
        .select('id, name, type, start_date, end_date, colour, notes, created_by, created_at')
        .lte('start_date', `${year}-12-31`)
        .gte('end_date', `${year}-01-01`)
        .order('start_date', { ascending: true });

      if (error) {
        Logger.error(error, 'fetchOrgEvents');
        return [];
      }

      return (data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        type: row.type as OrgEvent['type'],
        startDate: row.start_date as string,
        endDate: row.end_date as string,
        colour: row.colour as string,
        notes: row.notes as string,
        createdBy: row.created_by as string | null,
        createdAt: row.created_at as string,
      }));
    } catch (error) {
      Logger.error(error, 'fetchOrgEvents');
      return [];
    }
  },

  saveOrgEvent: async (
    event: Omit<OrgEvent, 'id' | 'createdAt'> & { id?: string },
    createdBy: string,
  ): Promise<OrgEvent | null> => {
    await initSupabase();
    if (!supabase) return null;

    const row = {
      name: event.name,
      type: event.type,
      start_date: event.startDate,
      end_date: event.endDate,
      colour: event.colour,
      notes: event.notes,
      created_by: createdBy,
    };

    try {
      if (event.id) {
        const { data, error } = await supabase
          .from('org_events')
          .update(row)
          .eq('id', event.id)
          .select()
          .single();
        if (error) {
          Logger.error(error, 'saveOrgEvent/update');
          return null;
        }
        return data
          ? {
              id: data.id,
              name: data.name,
              type: data.type,
              startDate: data.start_date,
              endDate: data.end_date,
              colour: data.colour,
              notes: data.notes,
              createdBy: data.created_by,
              createdAt: data.created_at,
            }
          : null;
      } else {
        const { data, error } = await supabase.from('org_events').insert(row).select().single();
        if (error) {
          Logger.error(error, 'saveOrgEvent/insert');
          return null;
        }
        return data
          ? {
              id: data.id,
              name: data.name,
              type: data.type,
              startDate: data.start_date,
              endDate: data.end_date,
              colour: data.colour,
              notes: data.notes,
              createdBy: data.created_by,
              createdAt: data.created_at,
            }
          : null;
      }
    } catch (error) {
      Logger.error(error, 'saveOrgEvent');
      return null;
    }
  },

  deleteOrgEvent: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('org_events').delete().eq('id', id);
      if (error) {
        Logger.error(error, 'deleteOrgEvent');
        return false;
      }
      return true;
    } catch (error) {
      Logger.error(error, 'deleteOrgEvent');
      return false;
    }
  },

  // ==========================================
  // PLANNING DRAFT POSTS
  // ==========================================

  fetchDraftPosts: async (year: number, month: number): Promise<DraftPost[]> => {
    await initSupabase();
    if (!supabase) return [];

    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    try {
      const { data, error } = await supabase
        .from('planning_draft_posts')
        .select('id, date, platform, topic, asset_type, notes, created_by, created_at')
        .gte('date', from)
        .lte('date', to)
        .order('created_at', { ascending: true });

      if (error) {
        Logger.error(error, 'fetchDraftPosts');
        return [];
      }

      return (data ?? []).map((row) => ({
        id: row.id as string,
        date: row.date as string,
        platform: row.platform as string,
        topic: row.topic as string,
        assetType: row.asset_type as string,
        notes: row.notes as string,
        createdBy: row.created_by as string | null,
        createdAt: row.created_at as string,
      }));
    } catch (error) {
      Logger.error(error, 'fetchDraftPosts');
      return [];
    }
  },

  saveDraftPost: async (
    post: Omit<DraftPost, 'id' | 'createdAt'> & { id?: string },
  ): Promise<DraftPost | null> => {
    await initSupabase();
    if (!supabase) return null;

    const row = {
      date: post.date,
      platform: post.platform,
      topic: post.topic,
      asset_type: post.assetType,
      notes: post.notes,
      created_by: post.createdBy ?? null,
    };

    try {
      if (post.id) {
        const { data, error } = await supabase
          .from('planning_draft_posts')
          .update(row)
          .eq('id', post.id)
          .select()
          .single();

        if (error) {
          Logger.error(error, 'saveDraftPost/update');
          return null;
        }
        return data
          ? {
              id: data.id,
              date: data.date,
              platform: data.platform,
              topic: data.topic,
              assetType: data.asset_type,
              notes: data.notes,
              createdBy: data.created_by,
              createdAt: data.created_at,
            }
          : null;
      } else {
        const { data, error } = await supabase
          .from('planning_draft_posts')
          .insert(row)
          .select()
          .single();

        if (error) {
          Logger.error(error, 'saveDraftPost/insert');
          return null;
        }
        return data
          ? {
              id: data.id,
              date: data.date,
              platform: data.platform,
              topic: data.topic,
              assetType: data.asset_type,
              notes: data.notes,
              createdBy: data.created_by,
              createdAt: data.created_at,
            }
          : null;
      }
    } catch (error) {
      Logger.error(error, 'saveDraftPost');
      return null;
    }
  },

  deleteDraftPost: async (id: string): Promise<boolean> => {
    await initSupabase();
    if (!supabase) return false;

    try {
      const { error } = await supabase.from('planning_draft_posts').delete().eq('id', id);
      if (error) {
        Logger.error(error, 'deleteDraftPost');
        return false;
      }
      return true;
    } catch (error) {
      Logger.error(error, 'deleteDraftPost');
      return false;
    }
  },
}; // ============================================

export const AUTH = {
  signIn: async (email: string, password: string): Promise<AuthResult> => {
    await initSupabase();
    if (!supabase) return { error: 'Supabase not initialized' };

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        Logger.error(error, 'signIn');
        return { error: error.message };
      }

      // Set global user info for logging
      window.__currentUserEmail = data.user?.email;

      return { data };
    } catch (error) {
      Logger.error(error, 'signIn');
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  signUp: async (email: string, password: string, name: string): Promise<AuthResult> => {
    await initSupabase();
    if (!supabase) return { error: 'Supabase not initialized' };

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
        },
      });

      if (error) {
        Logger.error(error, 'signUp');
        return { error: error.message };
      }

      return { data };
    } catch (error) {
      Logger.error(error, 'signUp');
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  signOut: async (): Promise<void> => {
    await initSupabase();
    if (!supabase) return;

    try {
      await supabase.auth.signOut();
      window.__currentUserEmail = null;
      window.__currentUserName = null;
    } catch (error) {
      Logger.error(error, 'signOut');
    }
  },

  getSession: async (): Promise<Session | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session;
    } catch (error) {
      Logger.error(error, 'getSession');
      return null;
    }
  },

  getUser: async (): Promise<User | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    } catch (error) {
      Logger.error(error, 'getUser');
      return null;
    }
  },

  signInWithMagicLink: async (email: string): Promise<{ error?: string }> => {
    await initSupabase();
    if (!supabase) return { error: 'Supabase not initialized' };
    try {
      const emailRedirectTo = getAuthRedirectUrl();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      });
      if (error) return { error: error.message };
      return {};
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
    if (!supabase) return null;

    return supabase.auth.onAuthStateChange((event, session) => {
      Logger.debug('Auth state change:', event);
      if (session?.user) {
        window.__currentUserEmail = session.user.email;
      }
      callback(event, session);
    });
  },
};

// Export types for use in other modules
export type {
  EntryRow,
  IdeaRow,
  OpportunityRow,
  ContentRequestRow,
  ReportingPeriodRow,
  LinkedInRow,
  GuidelinesRow,
  UserProfileRow,
  ActivityLogRow,
};
