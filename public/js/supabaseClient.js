// Supabase API client — provides window.api interface
// TODO: Consolidate with src/lib/supabase.ts and read credentials from build-time env
// (see .env.example and tools/build.mjs for the bundled config pattern)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configuration
const SUPABASE_URL = 'https://oepehanwmfelowfumkes.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lcGVoYW53bWZlbG93ZnVta2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDE2NTksImV4cCI6MjA4ODExNzY1OX0.VaBVUk4fZSPF17ude4w9x5qcOCniLM8KGXKN8YOTL04';
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const DEBUG_MODE = window.location.protocol === 'file:' || window.location.hostname === 'localhost';

// Logger
const Logger = {
  debug: (...args) => DEBUG_MODE && console.log('[DEBUG]', ...args),
  error: (error, context = '') => console.error('[ERROR]', context, error?.message || error),
};

// Supabase client
let supabaseClient = null;
let apiDisabledForSession = !SUPABASE_ENABLED;

function isNetworkLikeError(error) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : typeof error?.message === 'string'
          ? error.message
          : '';

  return [
    'Failed to fetch',
    'Load failed',
    'NetworkError',
    'ERR_NAME_NOT_RESOLVED',
    'ERR_FAILED',
    'fetch failed',
  ].some((pattern) => message.includes(pattern));
}

function disableApiForSession() {
  apiDisabledForSession = true;
  try {
    supabaseClient?.auth?.stopAutoRefresh?.();
  } catch {}
}

async function verifySupabaseConnection() {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      cache: 'no-store',
    });
    return true;
  } catch (error) {
    if (isNetworkLikeError(error)) {
      disableApiForSession();
      return false;
    }
    Logger.error(error, 'verifySupabaseConnection');
    return false;
  }
}

async function initSupabase() {
  if (apiDisabledForSession) return null;
  if (supabaseClient) return supabaseClient;

  try {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });

    const reachable = await verifySupabaseConnection();
    if (!reachable) {
      supabaseClient = null;
      return null;
    }

    Logger.debug('Supabase client initialized');
    return supabaseClient;
  } catch (error) {
    if (isNetworkLikeError(error)) {
      disableApiForSession();
      return null;
    }
    Logger.error(error, 'Failed to initialize Supabase');
    return null;
  }
}

// Get current user email
async function getCurrentUserEmail() {
  await initSupabase();
  if (!supabaseClient) return null;
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  return user?.email || window.__currentUserEmail || null;
}

// ============================================
// ENTRIES
// ============================================

async function listEntries(params = {}) {
  await initSupabase();
  if (!supabaseClient) return [];

  try {
    let query = supabaseClient
      .from('entries')
      .select('*')
      .is('deleted_at', null)
      .order('date', { ascending: true });

    if (params.month) {
      const startDate = `${params.month}-01`;
      const endDate = `${params.month}-31`;
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(mapEntryToApp);
  } catch (error) {
    Logger.error(error, 'listEntries');
    return [];
  }
}

async function createEntry(entry) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const userEmail = await getCurrentUserEmail();
    const dbEntry = mapEntryToDb(entry, userEmail);

    const { data, error } = await supabaseClient.from('entries').insert(dbEntry).select().single();

    if (error) throw error;

    await logActivity('create', 'entry', data.id, entry.caption?.substring(0, 50));
    return { id: data.id, ok: true };
  } catch (error) {
    Logger.error(error, 'createEntry');
    throw error;
  }
}

async function updateEntry(id, patch) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const dbPatch = {};

    // Map camelCase to snake_case for each field
    if (patch.date !== undefined) dbPatch.date = dateOrNull(patch.date);
    if (patch.platforms !== undefined) dbPatch.platforms = patch.platforms;
    if (patch.assetType !== undefined) dbPatch.asset_type = patch.assetType;
    if (patch.caption !== undefined) dbPatch.caption = patch.caption;
    if (patch.platformCaptions !== undefined) dbPatch.platform_captions = patch.platformCaptions;
    if (patch.firstComment !== undefined) dbPatch.first_comment = patch.firstComment;
    if (patch.approvalDeadline !== undefined)
      dbPatch.approval_deadline = dateOrNull(patch.approvalDeadline);
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.approvers !== undefined) dbPatch.approvers = patch.approvers;
    if (patch.author !== undefined) dbPatch.author = patch.author;
    if (patch.campaign !== undefined) dbPatch.campaign = patch.campaign;
    if (patch.contentPillar !== undefined) dbPatch.content_pillar = patch.contentPillar;
    if (patch.previewUrl !== undefined) dbPatch.preview_url = patch.previewUrl;
    if (patch.checklist !== undefined) dbPatch.checklist = patch.checklist;
    if (patch.analytics !== undefined) dbPatch.analytics = patch.analytics;
    if (patch.workflowStatus !== undefined) dbPatch.workflow_status = patch.workflowStatus;
    if (patch.statusDetail !== undefined) dbPatch.status_detail = patch.statusDetail;
    if (patch.aiFlags !== undefined) dbPatch.ai_flags = patch.aiFlags;
    if (patch.aiScore !== undefined) dbPatch.ai_score = patch.aiScore;
    if (patch.testingFrameworkId !== undefined)
      dbPatch.testing_framework_id = patch.testingFrameworkId;
    if (patch.testingFrameworkName !== undefined)
      dbPatch.testing_framework_name = patch.testingFrameworkName;
    if (patch.approvedAt !== undefined) dbPatch.approved_at = patch.approvedAt;
    if (patch.deletedAt !== undefined) dbPatch.deleted_at = patch.deletedAt;

    const { data, error } = await supabaseClient
      .from('entries')
      .update(dbPatch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logActivity('update', 'entry', id, '');
    return { ok: true };
  } catch (error) {
    Logger.error(error, 'updateEntry');
    throw error;
  }
}

async function deleteEntry(id, options = {}) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    if (options.hard) {
      const { error } = await supabaseClient.from('entries').delete().eq('id', id);
      if (error) throw error;
    } else {
      // Soft delete
      const { error } = await supabaseClient
        .from('entries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    }

    await logActivity('delete', 'entry', id, '');
    return { ok: true };
  } catch (error) {
    Logger.error(error, 'deleteEntry');
    throw error;
  }
}

// ============================================
// IDEAS
// ============================================

async function listIdeas(params = {}) {
  await initSupabase();
  if (!supabaseClient) return [];

  try {
    let query = supabaseClient.from('ideas').select('*').order('created_at', { ascending: false });

    if (params.month) {
      query = query.eq('target_month', params.month);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(mapIdeaToApp);
  } catch (error) {
    Logger.error(error, 'listIdeas');
    return [];
  }
}

async function createIdea(idea) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const userEmail = await getCurrentUserEmail();
    const dbIdea = mapIdeaToDb(idea, userEmail);

    const { data, error } = await supabaseClient.from('ideas').insert(dbIdea).select().single();

    if (error) throw error;
    return { id: data.id, ok: true };
  } catch (error) {
    Logger.error(error, 'createIdea');
    throw error;
  }
}

async function updateIdea(id, patch) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const dbPatch = {};
    if (patch.type !== undefined) dbPatch.type = patch.type;
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes;
    if (patch.links !== undefined) dbPatch.links = patch.links;
    if (patch.attachments !== undefined) dbPatch.attachments = patch.attachments;
    if (patch.inspiration !== undefined) dbPatch.inspiration = patch.inspiration;
    if (patch.targetDate !== undefined) dbPatch.target_date = patch.targetDate;
    if (patch.targetMonth !== undefined) dbPatch.target_month = patch.targetMonth;
    if (patch.convertedToEntryId !== undefined)
      dbPatch.converted_to_entry_id = patch.convertedToEntryId;
    if (patch.convertedAt !== undefined) dbPatch.converted_at = patch.convertedAt;

    const { error } = await supabaseClient.from('ideas').update(dbPatch).eq('id', id);
    if (error) throw error;

    return { ok: true };
  } catch (error) {
    Logger.error(error, 'updateIdea');
    throw error;
  }
}

async function deleteIdea(id) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const { error } = await supabaseClient.from('ideas').delete().eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    Logger.error(error, 'deleteIdea');
    throw error;
  }
}

// ============================================
// LINKEDIN SUBMISSIONS
// ============================================

async function listLinkedIn(params = {}) {
  await initSupabase();
  if (!supabaseClient) return [];

  try {
    let query = supabaseClient
      .from('linkedin_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (params.month) {
      const startDate = `${params.month}-01`;
      const endDate = `${params.month}-31`;
      query = query.gte('target_date', startDate).lte('target_date', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(mapLinkedInToApp);
  } catch (error) {
    Logger.error(error, 'listLinkedIn');
    return [];
  }
}

async function createLinkedIn(submission) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const userEmail = await getCurrentUserEmail();
    const dbSubmission = mapLinkedInToDb(submission, userEmail);

    const { data, error } = await supabaseClient
      .from('linkedin_submissions')
      .insert(dbSubmission)
      .select()
      .single();

    if (error) throw error;
    return { id: data.id, ok: true };
  } catch (error) {
    Logger.error(error, 'createLinkedIn');
    throw error;
  }
}

async function updateLinkedIn(id, patch) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const dbPatch = {};
    if (patch.submissionType !== undefined) dbPatch.submission_type = patch.submissionType;
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.postCopy !== undefined) dbPatch.post_copy = patch.postCopy;
    if (patch.comments !== undefined) dbPatch.comments = patch.comments;
    if (patch.owner !== undefined) dbPatch.owner = patch.owner;
    if (patch.submitter !== undefined) dbPatch.submitter = patch.submitter;
    if (patch.links !== undefined) dbPatch.links = patch.links;
    if (patch.attachments !== undefined) dbPatch.attachments = patch.attachments;
    if (patch.targetDate !== undefined) dbPatch.target_date = patch.targetDate;

    const { error } = await supabaseClient
      .from('linkedin_submissions')
      .update(dbPatch)
      .eq('id', id);
    if (error) throw error;

    return { ok: true };
  } catch (error) {
    Logger.error(error, 'updateLinkedIn');
    throw error;
  }
}

async function deleteLinkedIn(id) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const { error } = await supabaseClient.from('linkedin_submissions').delete().eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    Logger.error(error, 'deleteLinkedIn');
    throw error;
  }
}

// ============================================
// TESTING FRAMEWORKS
// ============================================

async function listTestingFrameworks() {
  await initSupabase();
  if (!supabaseClient) return [];

  try {
    const { data, error } = await supabaseClient
      .from('testing_frameworks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    Logger.error(error, 'listTestingFrameworks');
    return [];
  }
}

async function createTestingFramework(framework) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const { data, error } = await supabaseClient
      .from('testing_frameworks')
      .insert(framework)
      .select()
      .single();

    if (error) throw error;
    return { id: data.id, ok: true };
  } catch (error) {
    Logger.error(error, 'createTestingFramework');
    throw error;
  }
}

async function updateTestingFramework(id, patch) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const { error } = await supabaseClient.from('testing_frameworks').update(patch).eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    Logger.error(error, 'updateTestingFramework');
    throw error;
  }
}

async function deleteTestingFramework(id) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const { error } = await supabaseClient.from('testing_frameworks').delete().eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    Logger.error(error, 'deleteTestingFramework');
    throw error;
  }
}

// ============================================
// GUIDELINES
// ============================================

async function getGuidelines() {
  await initSupabase();
  if (!supabaseClient) return null;

  try {
    const { data, error } = await supabaseClient
      .from('guidelines')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (error) throw error;
    return data ? mapGuidelinesToApp(data) : null;
  } catch (error) {
    Logger.error(error, 'getGuidelines');
    return null;
  }
}

async function saveGuidelines(guidelines) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const dbGuidelines = mapGuidelinesToDb(guidelines);
    const { error } = await supabaseClient.from('guidelines').upsert(dbGuidelines);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    Logger.error(error, 'saveGuidelines');
    throw error;
  }
}

// ============================================
// USERS
// ============================================

async function listUsers() {
  await initSupabase();
  if (!supabaseClient) return [];

  try {
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      features: row.features || [],
      status: row.status,
      isAdmin: row.is_admin,
      isApprover: row.is_approver,
      avatarUrl: row.avatar_url,
      managerEmail: row.manager_email || null,
    }));
  } catch (error) {
    Logger.error(error, 'listUsers');
    return [];
  }
}

async function getCurrentUser() {
  await initSupabase();
  if (!supabaseClient) return null;

  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (error) {
      Logger.error(error, 'getCurrentUser');
      return null;
    }

    // No profile exists yet - this is OK, ensureUserProfile will create one
    if (!data) {
      Logger.debug('No user profile found for auth user', user.id);
      return null;
    }

    window.__currentUserEmail = data.email;
    window.__currentUserName = data.name;

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      features: data.features || [],
      status: data.status,
      isAdmin: data.is_admin,
      isApprover: data.is_approver,
      avatarUrl: data.avatar_url,
    };
  } catch (error) {
    Logger.error(error, 'getCurrentUser');
    return null;
  }
}

async function createUser(userData) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .insert({
        email: userData.email,
        name: userData.name,
        features: userData.features || [],
        status: 'pending',
        is_admin: false,
        is_approver: userData.isApprover || false,
      })
      .select()
      .single();

    if (error) throw error;
    return { id: data.id, ok: true };
  } catch (error) {
    Logger.error(error, 'createUser');
    throw error;
  }
}

async function updateUser(id, patch) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const dbPatch = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.features !== undefined) dbPatch.features = patch.features;
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.isAdmin !== undefined) dbPatch.is_admin = patch.isAdmin;
    if (patch.isApprover !== undefined) dbPatch.is_approver = patch.isApprover;
    if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl;

    const { data, error } = await supabaseClient
      .from('user_profiles')
      .update(dbPatch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      features: data.features || [],
      isApprover: data.is_approver,
      ok: true,
    };
  } catch (error) {
    Logger.error(error, 'updateUser');
    throw error;
  }
}

async function deleteUser(id) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const { error } = await supabaseClient.from('user_profiles').delete().eq('id', id);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    Logger.error(error, 'deleteUser');
    throw error;
  }
}

async function updateProfile(patch) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const dbPatch = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl;

    const { data, error } = await supabaseClient
      .from('user_profiles')
      .update(dbPatch)
      .eq('auth_user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return { ok: true, name: data.name, avatarUrl: data.avatar_url };
  } catch (error) {
    Logger.error(error, 'updateProfile');
    throw error;
  }
}

async function listApprovers() {
  await initSupabase();
  if (!supabaseClient) return [];

  try {
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .select('email, name')
      .eq('is_approver', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    Logger.error(error, 'listApprovers');
    return [];
  }
}

// ============================================
// AUTHENTICATION
// ============================================

// Sign up with email and password
async function signUp({ email, password, name }) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { name: name || email.split('@')[0] },
      },
    });
    if (error) throw error;

    // Check if email confirmation is required
    if (data.user && !data.session) {
      return {
        ok: true,
        needsVerification: true,
        message: 'Check your email for verification link',
      };
    }

    window.__currentUserEmail = data.user?.email;

    // Create or fetch user profile
    if (data.user) {
      await ensureUserProfile(data.user, name);
    }

    return { ok: true, user: data.user };
  } catch (error) {
    Logger.error(error, 'signUp');
    return { ok: false, error: error.message };
  }
}

// Sign in with email and password
async function login({ email, password }) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    window.__currentUserEmail = data.user?.email;

    // Fetch or create user profile
    const profile = await getCurrentUser();

    return { ok: true, user: profile };
  } catch (error) {
    Logger.error(error, 'login');
    return { ok: false, error: error.message };
  }
}

// Sign in with magic link (passwordless)
async function signInWithMagicLink({ email }) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) throw error;

    return { ok: true, message: 'Check your email for the sign-in link' };
  } catch (error) {
    Logger.error(error, 'signInWithMagicLink');
    return { ok: false, error: error.message };
  }
}

// Get current session
async function getSession() {
  await initSupabase();
  if (!supabaseClient) return null;

  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    return session;
  } catch (error) {
    Logger.error(error, 'getSession');
    return null;
  }
}

// Listen for auth state changes
function onAuthStateChange(callback) {
  if (!supabaseClient) {
    initSupabase().then(() => {
      if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
          window.__currentUserEmail = session?.user?.email || null;
          callback(event, session);
        });
      }
    });
    return () => {};
  }

  const {
    data: { subscription },
  } = supabaseClient.auth.onAuthStateChange((event, session) => {
    window.__currentUserEmail = session?.user?.email || null;
    callback(event, session);
  });

  return () => subscription?.unsubscribe();
}

// Ensure user profile exists in user_profiles table
async function ensureUserProfile(authUser, name) {
  await initSupabase();
  if (!supabaseClient || !authUser) return null;

  try {
    // Check if profile exists
    const { data: existing, error: selectError } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .maybeSingle();

    if (selectError) {
      Logger.error(selectError, 'ensureUserProfile - checking existing');
    }

    if (existing) return existing;

    // Create new profile
    const { data: newProfile, error } = await supabaseClient
      .from('user_profiles')
      .insert({
        auth_user_id: authUser.id,
        email: authUser.email,
        name: name || authUser.user_metadata?.name || authUser.email.split('@')[0],
        status: 'active',
        features: ['calendar', 'kanban', 'approvals', 'ideas', 'linkedin', 'testing'],
      })
      .select()
      .single();

    if (error) {
      Logger.error(error, 'ensureUserProfile');
      return null;
    }

    return newProfile;
  } catch (error) {
    Logger.error(error, 'ensureUserProfile');
    return null;
  }
}

async function logout() {
  await initSupabase();
  if (!supabaseClient) return;

  try {
    await supabaseClient.auth.signOut();
    window.__currentUserEmail = null;
    window.__currentUserName = null;
    return { ok: true };
  } catch (error) {
    Logger.error(error, 'logout');
    throw error;
  }
}

async function acceptInvite({ token, password }) {
  // For Supabase, this would be handled via magic link or password reset
  // This is a placeholder for compatibility
  Logger.debug('acceptInvite called - use Supabase Auth flow instead');
  return { ok: false, error: 'Use Supabase Auth for invitations' };
}

async function changePassword({ currentPassword, newPassword }) {
  await initSupabase();
  if (!supabaseClient) throw new Error('Supabase not initialized');

  try {
    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    Logger.error(error, 'changePassword');
    return { ok: false, error: error.message };
  }
}

// ============================================
// ACTIVITY LOG / AUDIT
// ============================================

async function logActivity(actionType, targetType, targetId, targetTitle) {
  await initSupabase();
  if (!supabaseClient) return;

  try {
    const userEmail = await getCurrentUserEmail();

    await supabaseClient.from('activity_log').insert({
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      target_title: targetTitle || '',
      actor_email: userEmail || 'unknown',
      actor_name: window.__currentUserName || 'Unknown',
    });
  } catch (error) {
    Logger.error(error, 'logActivity');
  }
}

async function logAudit(event) {
  return logActivity(
    event.action || 'unknown',
    event.type || 'entry',
    event.entryId || event.id,
    event.title || '',
  );
}

async function listAudit(params = {}) {
  await initSupabase();
  if (!supabaseClient) return [];

  try {
    let query = supabaseClient
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(params.limit || 100);

    if (params.entryId) {
      query = query.eq('target_id', params.entryId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      ts: row.created_at,
      user: row.actor_name || row.actor_email,
      entryId: row.target_id,
      action: row.action_type,
      meta: row.details,
    }));
  } catch (error) {
    Logger.error(error, 'listAudit');
    return [];
  }
}

// ============================================
// NOTIFICATIONS
// ============================================

// Validate Teams webhook URL for security
function isValidTeamsWebhook(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    // Only allow Microsoft domains for Teams webhooks
    return (
      host.endsWith('.office.com') ||
      host.endsWith('.office365.com') ||
      host.endsWith('.webhook.office.com') ||
      host === 'outlook.office.com'
    );
  } catch {
    return false;
  }
}

async function notify(payload) {
  const results = {};

  // Teams webhook notification
  if (payload.teamsWebhookUrl && typeof payload.teamsWebhookUrl === 'string') {
    if (!isValidTeamsWebhook(payload.teamsWebhookUrl)) {
      Logger.error('Invalid Teams webhook URL', 'notify');
      results.teams = 'rejected';
    } else {
      try {
        const response = await fetch(payload.teamsWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            '@type': 'MessageCard',
            '@context': 'http://schema.org/extensions',
            summary: payload.subject || 'PM Dashboard Notification',
            themeColor: '11607d',
            title: payload.subject || 'PM Dashboard',
            text: payload.message || 'Notification',
          }),
        });
        results.teams = response.ok ? 'sent' : `http_${response.status}`;
        Logger.debug('Teams notification sent:', results.teams);
      } catch (error) {
        Logger.error(error, 'notify - Teams webhook');
        results.teams = 'error';
      }
    }
  }

  // Email notifications require a backend (Supabase Edge Function)
  // This is not implemented for static hosting
  if (payload.to || payload.approvers) {
    Logger.debug('Email notifications require Edge Function setup');
    results.email = 'not_configured';
  }

  return { ok: true, results };
}

// ============================================
// DATA MAPPING FUNCTIONS
// ============================================

function mapEntryToApp(row) {
  return {
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
    workflowStatus: row.workflow_status,
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
  };
}

function dateOrNull(value) {
  if (!value || String(value).trim() === '') return null;
  return value;
}

function mapEntryToDb(entry, userEmail) {
  return {
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
    workflow_status: entry.workflowStatus || 'Draft',
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
  };
}

function mapIdeaToApp(row) {
  return {
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
    convertedToEntryId: row.converted_to_entry_id || undefined,
    convertedAt: row.converted_at || undefined,
  };
}

function mapIdeaToDb(idea, userEmail) {
  return {
    id: idea.id || undefined,
    type: idea.type || 'Other',
    title: idea.title,
    notes: idea.notes,
    links: idea.links || [],
    attachments: idea.attachments || [],
    inspiration: idea.inspiration,
    created_by: idea.createdBy,
    created_by_email: userEmail,
    target_date: idea.targetDate,
    target_month: idea.targetMonth || (idea.targetDate ? idea.targetDate.substring(0, 7) : null),
  };
}

function mapLinkedInToApp(row) {
  return {
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
  };
}

function mapLinkedInToDb(submission, userEmail) {
  return {
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
    target_date: submission.targetDate,
  };
}

function mapGuidelinesToApp(row) {
  return {
    id: row.id,
    charLimits: row.char_limits || {},
    bannedWords: row.banned_words || [],
    requiredPhrases: row.required_phrases || [],
    languageGuide: row.language_guide,
    hashtagTips: row.hashtag_tips,
    teamsWebhookUrl: row.teams_webhook_url,
  };
}

function mapGuidelinesToDb(guidelines) {
  return {
    id: 'default',
    char_limits: guidelines.charLimits || {},
    banned_words: guidelines.bannedWords || [],
    required_phrases: guidelines.requiredPhrases || [],
    language_guide: guidelines.languageGuide,
    hashtag_tips: guidelines.hashtagTips,
    teams_webhook_url: guidelines.teamsWebhookUrl,
  };
}

// ============================================
// INITIALISE AND EXPOSE API
// ============================================

(async () => {
  try {
    await initSupabase();
    const api = {
      // Entries
      listEntries,
      createEntry,
      updateEntry,
      deleteEntry,
      // Ideas
      listIdeas,
      createIdea,
      updateIdea,
      deleteIdea,
      // LinkedIn
      listLinkedIn,
      createLinkedIn,
      updateLinkedIn,
      deleteLinkedIn,
      // Testing Frameworks
      listTestingFrameworks,
      createTestingFramework,
      updateTestingFramework,
      deleteTestingFramework,
      // Guidelines
      getGuidelines,
      saveGuidelines,
      // Users
      listUsers,
      getCurrentUser,
      createUser,
      updateUser,
      deleteUser,
      updateProfile,
      listApprovers,
      // Auth
      signUp,
      login,
      signInWithMagicLink,
      logout,
      getSession,
      onAuthStateChange,
      ensureUserProfile,
      acceptInvite,
      changePassword,
      // Audit
      logAudit,
      listAudit,
      // Notifications
      notify,
    };
    Object.defineProperty(api, 'enabled', {
      enumerable: true,
      get() {
        return !apiDisabledForSession && supabaseClient !== null;
      },
    });

    if (typeof window !== 'undefined') {
      window.api = Object.freeze(api);

      // Despatch ready event
      try {
        window.dispatchEvent(
          new CustomEvent('pm-api-ready', { detail: { enabled: window.api.enabled } }),
        );
      } catch {}

      Logger.debug('Supabase API client ready, enabled:', window.api.enabled);
    }
  } catch (error) {
    Logger.error(error, 'API initialization failed');
  }
})();
