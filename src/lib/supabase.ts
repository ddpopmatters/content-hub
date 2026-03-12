// Supabase client and API wrapper - matching PM-Productivity-Tool pattern
import type { SupabaseClient, Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { APP_CONFIG, Logger } from './config';
import { daysInMonth } from './utils';

/**
 * Compute the last day of a month from a YYYY-MM string.
 * Returns YYYY-MM-DD format.
 */
const getMonthEndDate = (monthKey: string): string => {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const lastDay = daysInMonth(year, month);
  return `${monthKey}-${String(lastDay).padStart(2, '0')}`;
};

/**
 * Map app workflow status to DB-allowed values.
 * DB constraint: ('Draft', 'In Review', 'Approved', 'Scheduled', 'Published')
 */
const mapWorkflowStatusToDb = (status: string | undefined): string => {
  if (!status) return 'Draft';
  switch (status) {
    case 'Draft':
    case 'Approved':
    case 'Published':
      return status;
    // New streamlined status maps to In Review
    case 'Ready for Review':
      return 'In Review';
    // Legacy statuses for backward compatibility
    case 'In Review':
    case 'Approval required':
    case 'Awaiting brand approval':
    case 'Awaiting SME approval':
    case 'Awaiting visual':
      return 'In Review';
    case 'Scheduled':
      return 'Approved'; // Scheduled is now part of Approved
    default:
      return 'Draft';
  }
};

/**
 * Map DB workflow status back to app values (streamlined 4-status system).
 */
const mapWorkflowStatusFromDb = (status: string | undefined): string => {
  if (!status) return 'Draft';
  switch (status) {
    case 'Draft':
      return 'Draft';
    case 'In Review':
      return 'Ready for Review';
    case 'Approved':
    case 'Scheduled':
      return 'Approved';
    case 'Published':
      return 'Published';
    default:
      return 'Draft';
  }
};

/**
 * Map app testing framework status to DB-allowed values.
 * DB constraint: ('Planned', 'Running', 'Completed', 'Cancelled')
 */
const mapTestingStatusToDb = (status: string | undefined): string => {
  if (!status) return 'Planned';
  switch (status) {
    case 'Planned':
    case 'Completed':
      return status;
    case 'In flight':
      return 'Running';
    case 'Archived':
      return 'Cancelled';
    case 'Running':
    case 'Cancelled':
      return status;
    default:
      return 'Planned';
  }
};

/**
 * Map DB testing framework status back to app values.
 */
const mapTestingStatusFromDb = (status: string | undefined): string => {
  if (!status) return 'Planned';
  switch (status) {
    case 'Planned':
    case 'Completed':
      return status;
    case 'Running':
      return 'In flight';
    case 'Cancelled':
      return 'Archived';
    default:
      return status;
  }
};

/**
 * Convert empty string to null for DATE columns.
 */
const dateOrNull = (value: string | undefined): string | null => {
  if (!value || value.trim() === '') return null;
  return value;
};

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
  Entry,
  Idea,
  Guidelines,
  Influencer,
  MonthlyReport,
  PlatformProfile,
  QualitativeInsights,
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

// Extend Window interface for custom properties
declare global {
  interface Window {
    supabase?: { createClient: typeof import('@supabase/supabase-js').createClient };
    supabaseReady?: Promise<void>;
    __currentUserEmail?: string | null;
    __currentUserName?: string | null;
  }
}

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
  status: string;
  approvers: string[];
  author: string;
  campaign: string;
  content_pillar: string;
  preview_url: string;
  checklist: Record<string, boolean>;
  analytics: Record<string, unknown>;
  workflow_status: string;
  status_detail: string;
  ai_flags: string[];
  ai_score: Record<string, number>;
  testing_framework_id: string;
  testing_framework_name: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  deleted_at: string | null;
  partner_individual_name: string | null;
  partner_consent_status: string | null;
  partner_capture_context: string | null;
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

interface MonthlyReportRow {
  id: string;
  period_month: number;
  period_year: number;
  platform_metrics: Record<string, Record<string, number>> | null;
  qualitative: Partial<QualitativeInsights> | null;
  created_by: string | null;
  created_by_email: string | null;
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
}

interface UserProfileRow {
  id: string;
  auth_user_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_admin: boolean;
  is_approver: boolean;
  features: string[];
  status: string;
  created_at: string;
  manager_email: string | null;
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

// Initialize Supabase client
export const initSupabase = async (): Promise<SupabaseClient | null> => {
  if (supabase) return supabase;

  if (!APP_CONFIG.SUPABASE_ENABLED) {
    Logger.warn('Supabase is disabled in config');
    return null;
  }

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

    Logger.debug('Supabase client initialized');
    return supabase;
  } catch (error) {
    Logger.error(error, 'Failed to initialize Supabase');
    return null;
  }
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
    if (!supabase) return null;

    try {
      const dbEntry = SUPABASE_API.mapEntryToDb(entry, userEmail);

      const { data, error } = await supabase.from('entries').upsert(dbEntry).select().single();

      if (error) {
        Logger.error(error, 'saveEntry');
        return null;
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
      return null;
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
        .upsert(dbReport, { onConflict: 'period_year,period_month' })
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
        .single();

      if (error && error.code !== 'PGRST116') {
        // Not found is ok
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

  fetchCurrentUserProfile: async (): Promise<UserProfileRow | null> => {
    await initSupabase();
    if (!supabase) return null;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();

      if (error) {
        Logger.error(error, 'fetchCurrentUserProfile');
        return null;
      }

      return data as UserProfileRow;
    } catch (error) {
      Logger.error(error, 'fetchCurrentUserProfile');
      return null;
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

      const { data, error } = await supabase
        .from('user_profiles')
        .update(profileData)
        .eq('auth_user_id', user.id)
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
        .single();

      if (error && error.code !== 'PGRST116') {
        // Not found is ok
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
    status: row.status,
    approvers: row.approvers || [],
    author: row.author,
    campaign: row.campaign,
    contentPillar: row.content_pillar,
    previewUrl: row.preview_url,
    checklist: row.checklist || {},
    analytics: row.analytics || {},
    workflowStatus: mapWorkflowStatusFromDb(row.workflow_status),
    statusDetail: row.status_detail,
    aiFlags: row.ai_flags || [],
    aiScore: row.ai_score || {},
    testingFrameworkId: row.testing_framework_id,
    testingFrameworkName: row.testing_framework_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at,
    deletedAt: row.deleted_at,
    partnerIndividualName: row.partner_individual_name ?? undefined,
    partnerConsentStatus:
      (row.partner_consent_status as 'confirmed' | 'pending' | 'not-required' | undefined) ??
      undefined,
    partnerCaptureContext: row.partner_capture_context ?? undefined,
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
    status: entry.status || 'Pending',
    approvers: entry.approvers || [],
    author: entry.author,
    author_email: userEmail,
    campaign: entry.campaign,
    content_pillar: entry.contentPillar,
    preview_url: entry.previewUrl,
    checklist: entry.checklist || {},
    analytics: entry.analytics || {},
    workflow_status: mapWorkflowStatusToDb(entry.workflowStatus),
    status_detail: entry.statusDetail,
    ai_flags: entry.aiFlags || [],
    ai_score: entry.aiScore || {},
    testing_framework_id: entry.testingFrameworkId,
    testing_framework_name: entry.testingFrameworkName,
    partner_individual_name: entry.partnerIndividualName ?? null,
    partner_consent_status: entry.partnerConsentStatus ?? null,
    partner_capture_context: entry.partnerCaptureContext ?? null,
  }),

  mapMonthlyReportToApp: (row: MonthlyReportRow): MonthlyReport => ({
    id: row.id,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    platformMetrics: row.platform_metrics || {},
    qualitative: {
      whatWorked: row.qualitative?.whatWorked || '',
      whatDidnt: row.qualitative?.whatDidnt || '',
      themes: row.qualitative?.themes || '',
      nextMonthFocus: row.qualitative?.nextMonthFocus || '',
      highlights: row.qualitative?.highlights || '',
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
    period_month: report.periodMonth,
    period_year: report.periodYear,
    platform_metrics: report.platformMetrics || {},
    qualitative: {
      whatWorked: report.qualitative.whatWorked || '',
      whatDidnt: report.qualitative.whatDidnt || '',
      themes: report.qualitative.themes || '',
      nextMonthFocus: report.qualitative.nextMonthFocus || '',
      highlights: report.qualitative.highlights || '',
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
  }),

  mapGuidelinesToDb: (guidelines: Partial<Guidelines>) => ({
    id: 'default',
    char_limits: guidelines.charLimits || {},
    banned_words: guidelines.bannedWords || [],
    required_phrases: guidelines.requiredPhrases || [],
    language_guide: guidelines.languageGuide,
    hashtag_tips: guidelines.hashtagTips,
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
};

// ============================================
// AUTHENTICATION
// ============================================

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
export type { EntryRow, IdeaRow, LinkedInRow, GuidelinesRow, UserProfileRow, ActivityLogRow };
