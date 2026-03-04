import React from 'react';
import { createRoot } from 'react-dom/client';
import { LoginScreen } from './components/auth/LoginScreen';
import { Sidebar } from './components/layout';
import { CalendarView } from './features/calendar/CalendarView';
import { ApprovalsView } from './features/approvals';
import { KanbanView } from './features/kanban';
import { AnalyticsView } from './features/analytics/AnalyticsView';
import { DashboardView } from './features/dashboard';
import { EngagementView } from './features/engagement/EngagementView';
import { PublishSettingsPanel, PlatformConnectionsView } from './features/publishing';
import { useApi } from './hooks/useApi';
import { KANBAN_STATUSES, PLAN_TAB_FEATURES, PLAN_TAB_ORDER, DEFAULT_MANAGERS } from './constants';
import { SUPABASE_API } from './lib/supabase';
import { buildManagersFromProfiles } from './lib/managers';
import { cx, uuid, monthStartISO, monthEndISO, storageAvailable } from './lib/utils';
import { createEmptyChecklist, sanitizeEntry, computeStatusDetail } from './lib/sanitizers';
import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  Badge,
} from './components/ui';
import {
  NotificationBell,
  CalendarIcon,
  TrashIcon,
  RotateCcwIcon,
  PlusIcon,
} from './components/common';
import { ChangePasswordModal } from './components/auth';
import { PerformanceImportModal } from './features/performance';
import { GuidelinesModal } from './features/guidelines';
import { IdeasBoard, IdeaForm } from './features/ideas';
import { OpportunitiesView } from './features/opportunities';
import { ContentRequestsView } from './features/requests';
import { MiniCalendar, NarrativeView, MonthlyGlance } from './features/calendar';
import { AddUserForm, AccessModal } from './features/admin';
import { EntryForm, EntryModal, EntryPreviewModal } from './features/entry';
import { normalizeGuidelines, saveGuidelines } from './lib/guidelines';
import { appendAudit } from './lib/audit';
import { loadIdeas } from './lib/storage';
import { InfluencersView, InfluencerModal } from './features/influencers';
import { DEFAULT_USER_RECORDS, DEFAULT_FEATURES } from './lib/users';
import { mergePerformanceData } from './lib/performance';
import {
  useSyncQueue,
  usePublishing,
  useGuidelines,
  useEngagement,
  useAuth,
  useNotifications,
  useIdeas,
  useOpportunities,
  useContentRequests,
  useApprovals,
  useAdmin,
  useInfluencers,
  useEntries,
} from './hooks/domain';

const { useState, useMemo, useEffect, useCallback } = React;

function ContentDashboard() {
  // Destructure stable method references to avoid re-renders when loading/error state changes
  const { get: apiGet, post: apiPost, put: apiPut, del: apiDel } = useApi();
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  // Domain hooks — Layer 1: needs API
  const auth = useAuth({ apiGet, apiPost, apiPut });
  const {
    currentUser,
    currentUserEmail,
    currentUserAvatar,
    currentUserIsAdmin,
    currentUserHasPassword,
    authStatus,
    setAuthStatus,
    setInviteToken,
    invitePassword,
    setInvitePassword,
    invitePasswordConfirm,
    setInvitePasswordConfirm,
    inviteError,
    submitInvite,
    clearInviteParam,
    viewerIsAuthor,
    viewerIsApprover,
    hasFeature,
    canUseCalendar,
    canUseKanban,
    canUseApprovals,
    canUseIdeas,
    profileMenuRef,
    profileMenuOpen,
    setProfileMenuOpen,
    profileFormName,
    setProfileFormName,
    setProfileAvatarDraft,
    profileStatus,
    profileError,
    profileSaving,
    profileInitials,
    avatarPreview,
    handleProfileMenuToggle,
    handleAvatarFileChange,
    handleProfileSave,
    handleAuthChange,
    handleChangePassword,
  } = auth;

  const [currentView, setCurrentView] = useState('dashboard');
  const [planTab, setPlanTab] = useState('plan');
  const [entryFormPrefill, setEntryFormPrefill] = useState(null);

  // Domain hooks — Layer 0: standalone
  const sync = useSyncQueue();

  // Domain hooks — Layer 2: needs auth + sync
  const notifs = useNotifications({ currentUser, runSyncTask: sync.runSyncTask, apiPost });
  const {
    addNotifications,
    markNotificationsAsReadForEntry,
    buildApprovalNotifications,
    handleMentionNotifications,
    handleCommentActivity,
    notifyApproversAboutChange,
    notifyViaServer,
    userNotifications,
    unreadNotifications,
    unreadMentionsCount,
  } = notifs;

  const { syncQueue, syncToast, pushSyncToast, runSyncTask, retryAllSync } = sync;
  const publishing = usePublishing();
  const {
    publishSettings,
    setPublishSettings,
    dailyPostTarget,
    handleDailyPostTargetChange,
    assetGoals,
    setAssetGoals,
  } = publishing;
  const guidelinesHook = useGuidelines({ runSyncTask });
  const { guidelines, setGuidelines, guidelinesOpen, setGuidelinesOpen, handleGuidelinesSave } =
    guidelinesHook;

  // Domain hooks — Layer 3: needs multiple hooks
  const entriesHook = useEntries({
    runSyncTask,
    pushSyncToast,
    currentUser,
    currentUserIsAdmin,
    viewerIsAuthor,
    viewerIsApprover,
    addNotifications,
    buildApprovalNotifications,
    notifyApproversAboutChange,
    notifyViaServer,
    markNotificationsAsReadForEntry,
    guidelines,
    publishSettings,
    authStatus,
  });
  const {
    entries,
    setEntries,
    setViewingId,
    viewingSnapshot,
    setViewingSnapshot,
    setPreviewEntryId,
    setPreviewEntryContext,
    previewEntry,
    previewIsReviewMode,
    previewCanApprove,
    hydrateFromLocal,
    refreshEntries,
    openEntry,
    closeEntry,
    closePreview,
    handlePreviewEdit,
    addEntry,
    cloneEntry,
    upsert,
    toggleApprove,
    handlePublishEntry,
    handlePostAgain,
    handleToggleEvergreen,
    handleEntryDateChange,
    handleBulkDateShift,
    updateWorkflowStatus,
    softDelete,
    restore,
    hardDelete,
    trashed,
  } = entriesHook;

  const ideasHook = useIdeas({
    currentUser,
    runSyncTask: sync.runSyncTask,
    pushSyncToast: sync.pushSyncToast,
  });
  const { ideas, setIdeas, addIdea, deleteIdea, refreshIdeas } = ideasHook;

  const opportunitiesHook = useOpportunities({
    currentUser,
    currentUserEmail,
    runSyncTask: sync.runSyncTask,
    pushSyncToast: sync.pushSyncToast,
  });
  const {
    openOpportunities,
    urgentOpenCount,
    addOpportunity,
    markOpportunityAsActed,
    dismissOpportunity,
  } = opportunitiesHook;

  const contentRequestsHook = useContentRequests({
    currentUser,
    currentUserEmail,
    runSyncTask: sync.runSyncTask,
    pushSyncToast: sync.pushSyncToast,
  });
  const {
    contentRequests,
    addContentRequest,
    updateContentRequestStatus,
    markContentRequestConverted,
  } = contentRequestsHook;

  const approvals = useApprovals({ apiGet, entries, currentUser });
  const { approverDirectory, refreshApprovers, outstandingApprovals } = approvals;

  const admin = useAdmin({
    currentUserIsAdmin,
    authStatus,
    pushSyncToast: sync.pushSyncToast,
    refreshApprovers,
  });
  const {
    userList,
    setUserList,
    adminAudits,
    setAdminAudits,
    accessModalUser,
    setAccessModalUser,
    userAdminError,
    userAdminSuccess,
    addUser,
    removeUser,
    toggleApproverRole,
    handleAccessSave,
  } = admin;

  const influencersHook = useInfluencers({ currentUser, setEntries });
  const {
    influencers,
    influencerModalOpen,
    setInfluencerModalOpen,
    editingInfluencerId,
    setEditingInfluencerId,
    customNiches,
    handleAddCustomNiche,
    handleAddInfluencer,
    handleUpdateInfluencer,
    handleDeleteInfluencer,
    handleOpenInfluencerDetail,
    handleLinkEntryToInfluencer,
    handleUnlinkEntryFromInfluencer,
  } = influencersHook;
  const engagement = useEngagement();
  const {
    engagementActivities,
    setEngagementActivities,
    engagementAccounts,
    setEngagementAccounts,
    engagementGoals,
    setEngagementGoals,
  } = engagement;

  const [_managers, setManagers] = useState(() => DEFAULT_MANAGERS); // consumed when ManagerHub is extracted
  const refreshManagers = useCallback(() => {
    SUPABASE_API.fetchUserProfiles()
      .then((profiles) => {
        const built = buildManagersFromProfiles(profiles);
        setManagers(built.length ? built : DEFAULT_MANAGERS);
      })
      .catch(() => {});
  }, []);
  const [performanceImportOpen, setPerformanceImportOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const canUseInfluencers = true; // Show to everyone
  const approverOptions = useMemo(() => {
    const derived = userList
      .filter((user) => user.isApprover && user.status !== 'disabled')
      .map((user) => {
        if (user.name && String(user.name).trim().length) return String(user.name).trim();
        if (user.email && String(user.email).trim().length) return String(user.email).trim();
        return '';
      })
      .filter(Boolean);
    if (derived.length) {
      return Array.from(new Set(derived));
    }
    return approverDirectory;
  }, [userList, approverDirectory]);
  const mentionUsers = useMemo(
    () => (userList.length ? userList : DEFAULT_USER_RECORDS),
    [userList],
  );
  const managerCandidates = useMemo(
    () => userList.filter((u) => u.isAdmin || u.isApprover),
    [userList],
  );
  const handleManagerChange = useCallback(
    async (user, managerEmail) => {
      if (managerEmail === user.email) return; // block self-assignment
      const value = managerEmail || null;
      const previousManager = user.managerEmail || null;
      const ok = await SUPABASE_API.updateUserManager(user.email, value);
      if (ok) {
        SUPABASE_API.logActivity({
          actionType: 'manager_changed',
          targetType: 'user',
          targetId: user.email,
          targetTitle: user.name,
          details: { from: previousManager, to: value },
        }).catch(() => {});
        refreshManagers();
      }
    },
    [refreshManagers],
  );
  useEffect(() => {
    const required = PLAN_TAB_FEATURES[planTab];
    if (required && !hasFeature(required)) {
      for (const tab of PLAN_TAB_ORDER) {
        const needed = PLAN_TAB_FEATURES[tab];
        if (!needed || hasFeature(needed)) {
          setPlanTab(tab);
          return;
        }
      }
    }
  }, [planTab, hasFeature]);

  useEffect(() => {
    if (currentView === 'form' && !canUseCalendar) {
      setCurrentView('dashboard');
    } else if (currentView === 'admin' && !currentUserIsAdmin) {
      setCurrentView('dashboard');
    } else if (currentView === 'plan') {
      const canUsePlan = PLAN_TAB_ORDER.some((tab) => {
        const needed = PLAN_TAB_FEATURES[tab];
        return !needed || hasFeature(needed);
      });
      if (!canUsePlan) {
        setCurrentView('dashboard');
      }
    }
  }, [currentView, hasFeature, currentUserIsAdmin, canUseCalendar]);

  useEffect(() => {
    hydrateFromLocal();
    setIdeas(loadIdeas());
  }, []);

  // If server is available, hydrate from API once authenticated; fall back to local on failure
  useEffect(() => {
    if (authStatus !== 'ready') return;
    let cancelled = false;
    (async () => {
      try {
        if (window.api && window.api.enabled) {
          const wantsIdeas = canUseIdeas;
          const wantsUsers = currentUserIsAdmin;
          const [serverEntries, serverIdeas, serverGuidelines, serverUsers] = await Promise.all([
            window.api.listEntries().catch(() => []),
            wantsIdeas ? window.api.listIdeas().catch(() => []) : Promise.resolve([]),
            window.api.getGuidelines
              ? window.api.getGuidelines().catch(() => null)
              : Promise.resolve(null),
            wantsUsers && window.api.listUsers
              ? window.api.listUsers().catch(() => [])
              : Promise.resolve([]),
          ]);
          if (cancelled) return;
          if (Array.isArray(serverEntries)) setEntries(serverEntries);
          if (wantsIdeas) {
            if (Array.isArray(serverIdeas)) setIdeas(serverIdeas);
          } else {
            setIdeas([]);
          }
          if (serverGuidelines) {
            const normalized = normalizeGuidelines(serverGuidelines);
            setGuidelines(normalized);
            saveGuidelines(normalized);
          }
          if (wantsUsers) {
            if (Array.isArray(serverUsers)) setUserList(serverUsers);
          } else {
            setUserList([]);
          }
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus, canUseIdeas, currentUserIsAdmin]);

  // Build managers from DB profiles when authenticated
  useEffect(() => {
    if (authStatus !== 'ready') return;
    let cancelled = false;
    SUPABASE_API.fetchUserProfiles()
      .then((profiles) => {
        if (cancelled) return;
        const built = buildManagersFromProfiles(profiles);
        setManagers(built.length ? built : DEFAULT_MANAGERS);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  // Also hydrate when the api client announces readiness
  useEffect(() => {
    const onReady = (e) => {
      if (e?.detail?.enabled && syncQueue.length) {
        retryAllSync();
      }
      if (e?.detail?.enabled && authStatus === 'ready') {
        const wantsIdeas = canUseIdeas;
        const wantsUsers = currentUserIsAdmin;
        Promise.all([
          window.api.listEntries().catch(() => []),
          wantsIdeas ? window.api.listIdeas().catch(() => []) : Promise.resolve([]),
          window.api.getGuidelines
            ? window.api.getGuidelines().catch(() => null)
            : Promise.resolve(null),
          wantsUsers && window.api.listUsers
            ? window.api.listUsers().catch(() => [])
            : Promise.resolve([]),
        ])
          .then(([serverEntries, serverIdeas, serverGuidelines, serverUsers]) => {
            if (Array.isArray(serverEntries)) setEntries(serverEntries);
            if (wantsIdeas) {
              if (Array.isArray(serverIdeas)) setIdeas(serverIdeas);
            } else {
              setIdeas([]);
            }
            if (serverGuidelines) {
              const normalized = normalizeGuidelines(serverGuidelines);
              setGuidelines(normalized);
              saveGuidelines(normalized);
            }
            if (wantsUsers) {
              if (Array.isArray(serverUsers)) setUserList(serverUsers);
            } else {
              setUserList([]);
            }
          })
          .catch(() => {});
      }
    };
    window.addEventListener('pm-api-ready', onReady);
    return () => window.removeEventListener('pm-api-ready', onReady);
  }, [authStatus, canUseIdeas, currentUserIsAdmin, retryAllSync, syncQueue.length]);

  // Fallback navigation via URL hash so CTAs work even if React handler is blocked.
  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash === '#create') {
        setEntryFormPrefill(null);
        setCurrentView('form');
        setPlanTab('plan');
        closeEntry();
      }
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  useEffect(() => {
    if (currentView !== 'form') {
      setEntryFormPrefill(null);
    }
  }, [currentView]);

  useEffect(() => {
    if (!currentUserIsAdmin) {
      setAccessModalUser(null);
    }
  }, [currentUserIsAdmin]);

  const importPerformanceDataset = (dataset) => {
    let summary = {
      totalRows: Array.isArray(dataset?.records) ? dataset.records.length : 0,
      matched: 0,
      updatedEntries: [],
      updatedEntryCount: 0,
      missing: [],
      ambiguous: [],
      errors: [],
    };
    let updatedEntriesSnapshot = [];
    setEntries((prev) => {
      const { nextEntries, summary: computed } = mergePerformanceData(prev, dataset);
      summary = computed;
      updatedEntriesSnapshot = nextEntries;
      return nextEntries;
    });
    const shouldPersist = Array.isArray(summary.updatedEntries) && summary.updatedEntries.length;
    if (shouldPersist) {
      try {
        const entryMap = new Map((updatedEntriesSnapshot || []).map((entry) => [entry.id, entry]));
        const updates = summary.updatedEntries
          .map((entryId) => {
            const latest = entryMap.get(entryId);
            if (!latest) return null;
            return runSyncTask(`Update analytics (${entryId})`, () =>
              window.api.updateEntry(entryId, {
                analytics: latest.analytics,
                analyticsUpdatedAt: latest.analyticsUpdatedAt,
              }),
            );
          })
          .filter(Boolean);
        if (updates.length) {
          Promise.all(updates)
            .then(() => refreshEntries())
            .catch(() => pushSyncToast('Unable to refresh entries after import.', 'warning'));
        }
      } catch {}
    }
    return summary;
  };

  const monthLabel = monthCursor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const startISO = monthStartISO(monthCursor);
  const endISO = monthEndISO(monthCursor);
  const monthEntries = useMemo(
    () =>
      entries
        .filter((entry) => !entry.deletedAt && entry.date >= startISO && entry.date <= endISO)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [entries, startISO, endISO],
  );

  const outstandingCount = outstandingApprovals.length;

  const createEntryFromIdea = (idea) => {
    if (!idea) return;
    const timestamp = new Date().toISOString();
    const newId = uuid();

    // Create entry from idea data
    const entryData = {
      id: newId,
      date: idea.targetDate || '', // Use target date if set, otherwise empty
      platforms: [], // User will select
      assetType: '',
      caption: idea.title || '', // Use idea title as starting caption
      platformCaptions: {},
      firstComment: '',
      priorityTier: 'Medium',
      script: '',
      designCopy: '',
      carouselSlides: [],
      previewUrl: '',
      campaign: '',
      contentPillar: '',
      testingFrameworkId: '',
      testingFrameworkName: '',
      status: 'Pending',
      workflowStatus: KANBAN_STATUSES[0], // Draft
      author: currentUser || 'Unknown',
      approvers: [],
      approvalDeadline: '',
      approvedAt: undefined,
      checklist: createEmptyChecklist(),
      comments: [],
      analytics: {},
      analyticsUpdatedAt: '',
      aiFlags: [],
      aiScore: {},
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
      // Carry over links and attachments from idea
      links: idea.links || [],
      attachments: idea.attachments || [],
    };

    const sanitized = sanitizeEntry(entryData);
    const entryWithStatus = {
      ...sanitized,
      statusDetail: computeStatusDetail(sanitized),
      _isNew: true, // Flag to indicate this needs to be created, not updated
      _sourceIdeaId: idea.id, // Track source idea for conversion persistence
    };

    setEntries((prev) => [entryWithStatus, ...prev]);

    // Mark the idea as converted (local state)
    setIdeas((prev) =>
      prev.map((i) =>
        i.id === idea.id ? { ...i, convertedToEntryId: newId, convertedAt: timestamp } : i,
      ),
    );

    // Persist idea conversion to server
    if (window.api?.updateIdea) {
      try {
        runSyncTask(`Update idea conversion (${idea.id})`, () =>
          window.api.updateIdea(idea.id, {
            convertedToEntryId: newId,
            convertedAt: timestamp,
          }),
        ).then((ok) => {
          if (ok) refreshIdeas();
        });
      } catch {}
    }

    // Open the new entry for editing
    setViewingId(newId);
    setViewingSnapshot(entryWithStatus);

    // Show toast notification
    pushSyncToast('Entry created from idea - complete the details', 'success');

    appendAudit({
      user: currentUser,
      entryId: newId,
      action: 'entry-create-from-idea',
      meta: {
        ideaId: idea.id,
        ideaTitle: idea.title,
      },
    });
  };

  const buildEntryPrefillFromRequest = useCallback((request) => {
    const today = new Date().toISOString().slice(0, 10);
    const captionParts = [request?.title, request?.keyMessages]
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean);
    const firstCommentSections = [];
    if (request?.assetsNeeded && request.assetsNeeded.trim()) {
      firstCommentSections.push(`Assets needed:\\n${request.assetsNeeded.trim()}`);
    }
    if (request?.notes && request.notes.trim()) {
      firstCommentSections.push(`Notes:\\n${request.notes.trim()}`);
    }

    return {
      sourceRequestId: request?.id || '',
      sourceRequestTitle: request?.title || 'Request',
      date: request?.deadline || today,
      approvalDeadline: request?.deadline ? `${request.deadline}T17:00` : '',
      approvers: Array.isArray(request?.approvers) ? request.approvers : [],
      audienceSegments: Array.isArray(request?.audienceSegments) ? request.audienceSegments : [],
      assetType: 'No asset',
      caption: captionParts.join('\\n\\n'),
      firstComment: firstCommentSections.join('\\n\\n'),
    };
  }, []);

  const handleConvertRequestToEntry = useCallback(
    (request) => {
      if (!request) return;
      setEntryFormPrefill(buildEntryPrefillFromRequest(request));
      if (request.status === 'Pending') {
        updateContentRequestStatus(request.id, 'In Progress');
      }
      setCurrentView('form');
      setPlanTab('plan');
      closeEntry();
      pushSyncToast('Request loaded into Create Content form.', 'success');
    },
    [buildEntryPrefillFromRequest, closeEntry, pushSyncToast, updateContentRequestStatus],
  );

  const handleEntryFormSubmit = useCallback(
    (payload) => {
      const createdEntry = addEntry(payload);
      if (entryFormPrefill?.sourceRequestId) {
        markContentRequestConverted(entryFormPrefill.sourceRequestId, createdEntry?.id);
        pushSyncToast('Content request marked as converted.', 'success');
        setEntryFormPrefill(null);
      }
      return createdEntry;
    },
    [addEntry, entryFormPrefill, markContentRequestConverted, pushSyncToast],
  );

  const handleSignOut = () => {
    (async () => {
      try {
        if (window.api && typeof window.api.logout === 'function') {
          await window.api.logout();
        } else {
          await apiDel('/api/auth');
        }
      } catch {}
      auth.reset();
      notifs.reset();
      sync.reset();
      entriesHook.reset();
      admin.reset();
      approvals.reset();
      influencersHook.reset();
      ideasHook.reset();
      opportunitiesHook.reset();
      contentRequestsHook.reset();
      setCurrentView('dashboard');
      setChangePasswordOpen(false);
    })();
  };

  // Handle sidebar navigation - must be defined before conditional returns
  const handleSidebarNavigate = useCallback(
    (view) => {
      closeEntry();

      // Map sidebar items to view/tab combinations
      const viewMap = {
        dashboard: { view: 'dashboard', tab: 'plan' },
        analytics: { view: 'analytics', tab: 'plan' },
        engagement: { view: 'engagement', tab: 'plan' },
        opportunities: { view: 'opportunities', tab: 'plan' },
        requests: { view: 'requests', tab: 'plan' },
        content: { view: 'plan', tab: 'plan' },
        ideas: { view: 'plan', tab: 'ideas' },
        influencers: { view: 'influencers', tab: 'plan' },
        admin: { view: 'admin', tab: 'plan' },
        form: { view: 'form', tab: 'plan' },
      };

      const mapping = viewMap[view] || { view: 'dashboard', tab: 'plan' };
      setCurrentView(mapping.view);
      setPlanTab(mapping.tab);

      try {
        window.location.hash = `#${view}`;
      } catch {}
    },
    [closeEntry],
  );

  if (authStatus === 'invite') {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16 text-ocean-900">
        <div className="rounded-3xl border border-aqua-200 bg-white p-8 shadow-2xl">
          <h1 className="heading-font text-3xl font-semibold text-ocean-600">
            Welcome to PM Dashboard
          </h1>
          <p className="mt-2 text-sm text-graystone-600">
            Set your password to finish activating your account.
          </p>
          {inviteError ? (
            <div className="mt-3 rounded-2xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
              {inviteError}
            </div>
          ) : null}
          <form className="mt-6 space-y-4" onSubmit={submitInvite}>
            <div className="space-y-2">
              <Label className="text-sm text-graystone-600" htmlFor="invite-password">
                Password
              </Label>
              <Input
                id="invite-password"
                type="password"
                autoComplete="new-password"
                value={invitePassword}
                onChange={(event) => setInvitePassword(event.target.value)}
                className="w-full rounded-2xl border border-graystone-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-2 focus:ring-aqua-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-graystone-600" htmlFor="invite-password-confirm">
                Confirm password
              </Label>
              <Input
                id="invite-password-confirm"
                type="password"
                autoComplete="new-password"
                value={invitePasswordConfirm}
                onChange={(event) => setInvitePasswordConfirm(event.target.value)}
                className="w-full rounded-2xl border border-graystone-200 px-4 py-3 text-sm focus:border-ocean-500 focus:ring-2 focus:ring-aqua-200"
              />
            </div>
            <Button type="submit" className="w-full">
              Set password & enter
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 text-xs text-ocean-600 underline"
            onClick={() => {
              setInviteToken('');
              setAuthStatus('login');
              clearInviteParam();
            }}
          >
            Have an account already? Sign in instead
          </button>
        </div>
      </div>
    );
  }

  if (authStatus === 'login') {
    return <LoginScreen onAuthChange={handleAuthChange} />;
  }

  if (authStatus === 'loading') {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16 text-ocean-900">
        <div className="rounded-3xl border border-aqua-200 bg-white p-8 text-center shadow-2xl">
          <div className="heading-font text-3xl font-semibold text-ocean-600">Checking access…</div>
          <p className="mt-4 text-sm text-graystone-600">
            Verifying your Cloudflare Access session so we can load the dashboard.
          </p>
          <div className="mt-6 animate-pulse rounded-2xl bg-aqua-100 px-4 py-3 text-sm text-ocean-700">
            Hang tight—this only takes a moment.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-aqua-100">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        planTab={planTab}
        onNavigate={handleSidebarNavigate}
        currentUser={currentUser}
        currentUserEmail={currentUserEmail}
        currentUserAvatar={currentUserAvatar}
        profileInitials={profileInitials}
        onProfileClick={handleProfileMenuToggle}
        onSignOut={handleSignOut}
        canUseCalendar={canUseCalendar}
        canUseKanban={canUseKanban}
        canUseApprovals={canUseApprovals}
        canUseIdeas={canUseIdeas}
        canUseInfluencers={canUseInfluencers}
        currentUserIsAdmin={currentUserIsAdmin}
        outstandingCount={outstandingCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto ml-64 bg-aqua-100">
        <div className="container mx-auto p-8 max-w-7xl">
          {/* Sync Queue Toast */}
          {syncQueue.length ? (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-semibold">Sync pending.</span> {syncQueue.length} update
                  {syncQueue.length === 1 ? '' : 's'} waiting to send.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={retryAllSync}>
                    Retry all
                  </Button>
                  <Button size="sm" variant="ghost" onClick={sync.reset}>
                    Dismiss
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-amber-800">
                {syncQueue.slice(0, 3).map((item) => (
                  <span key={item.id} className="rounded-full bg-amber-100 px-3 py-1">
                    {item.label}
                    {item.attempts > 1 ? ` (x${item.attempts})` : ''}
                  </span>
                ))}
                {syncQueue.length > 3 ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1">
                    +{syncQueue.length - 3} more
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Profile Modal */}
          {profileMenuOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div
                ref={profileMenuRef}
                className="w-80 max-w-sm rounded-3xl border border-graystone-200 bg-white p-6 shadow-2xl"
              >
                <form className="space-y-4" onSubmit={handleProfileSave}>
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-full border border-graystone-200 bg-aqua-50">
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Avatar preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-ocean-700">
                          {profileInitials}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-base font-semibold text-ocean-800">
                        {currentUser || 'Your profile'}
                      </div>
                      <div className="text-xs text-graystone-500">
                        {currentUserEmail || 'No email'}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-graystone-600" htmlFor="profile-name">
                      Display name
                    </Label>
                    <Input
                      id="profile-name"
                      value={profileFormName}
                      onChange={(event) => setProfileFormName(event.target.value)}
                      className="w-full rounded-xl border border-graystone-200 px-3 py-2 text-sm focus:border-ocean-500 focus:ring-2 focus:ring-aqua-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-graystone-600">Profile photo</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer rounded-full border border-graystone-200 px-3 py-1 text-xs font-semibold text-ocean-700 shadow-sm transition hover:border-ocean-300">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarFileChange}
                        />
                        Upload photo
                      </label>
                      {avatarPreview ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setProfileAvatarDraft('')}
                        >
                          Remove photo
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {profileError ? (
                    <div className="rounded-xl bg-rose-50 px-4 py-2 text-xs text-rose-700">
                      {profileError}
                    </div>
                  ) : null}
                  {profileStatus ? (
                    <div className="rounded-xl bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
                      {profileStatus}
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2 pt-2">
                    <Button type="submit" disabled={profileSaving}>
                      {profileSaving ? 'Saving...' : 'Save profile'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setChangePasswordOpen(true);
                      }}
                    >
                      Change password
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setProfileMenuOpen(false)}>
                      Close
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Dashboard View */}
          {currentView === 'dashboard' && (
            <DashboardView
              entries={entries}
              currentUser={currentUser}
              assetGoals={assetGoals}
              engagementActivities={engagementActivities}
              engagementGoals={engagementGoals}
              pendingApprovalCount={outstandingCount}
              urgentOpportunityCount={urgentOpenCount}
              onOpenEntry={openEntry}
              onNavigate={(view, tab) => {
                setCurrentView(view);
                if (tab) setPlanTab(tab);
                closeEntry();
              }}
              onOpenGuidelines={() => setGuidelinesOpen(true)}
              onOpenApprovals={() => {
                setCurrentView('plan');
                setPlanTab('approvals');
                closeEntry();
              }}
              onOpenOpportunities={() => {
                setCurrentView('opportunities');
                setPlanTab('plan');
                closeEntry();
              }}
            />
          )}

          {currentView === 'form' && canUseCalendar && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCurrentView('dashboard');
                      setPlanTab('plan');
                      closeEntry();
                    }}
                    className="self-start"
                  >
                    Dashboard
                  </Button>
                  <h2 className="text-2xl font-semibold text-ocean-700">Create Content</h2>
                  <p className="text-sm text-graystone-600">
                    {entryFormPrefill?.sourceRequestId
                      ? `Converting request: ${entryFormPrefill.sourceRequestTitle}`
                      : 'Submit a brief and it will appear on the calendar instantly.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {entryFormPrefill?.sourceRequestId ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCurrentView('requests');
                        setPlanTab('plan');
                        closeEntry();
                      }}
                    >
                      Back to requests
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentView('plan');
                      setPlanTab('plan');
                      closeEntry();
                    }}
                  >
                    View calendar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleSignOut}
                    className="heading-font text-sm normal-case"
                  >
                    Switch user
                  </Button>
                  <NotificationBell
                    notifications={userNotifications}
                    unreadCount={unreadNotifications.length}
                    onOpenItem={(note) => {
                      if (note.entryId) {
                        openEntry(note.entryId);
                      }
                      markNotificationsAsReadForEntry(note.entryId, currentUser);
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(260px,1fr)]">
                <div className="w-full">
                  <EntryForm
                    onSubmit={handleEntryFormSubmit}
                    existingEntries={entries.filter((entry) => !entry.deletedAt)}
                    guidelines={guidelines}
                    currentUser={currentUser}
                    currentUserEmail={currentUserEmail}
                    approverOptions={approverOptions}
                    initialValues={entryFormPrefill}
                  />
                </div>
                <div className="flex w-full flex-col gap-6">
                  <div className="rounded-3xl border border-aqua-200 bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-black px-4 py-2 text-sm font-semibold text-graystone-800">
                        <CalendarIcon className="h-4 w-4 text-ocean-600" />
                        {monthLabel}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setMonthCursor(
                              new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1),
                            )
                          }
                        >
                          Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setMonthCursor(
                              new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1),
                            )
                          }
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-graystone-500">
                      This selector only updates the Month at a glance calendar.
                    </p>
                  </div>
                  <MiniCalendar
                    monthCursor={monthCursor}
                    entries={monthEntries}
                    onPreviewEntry={(entry) => {
                      setPreviewEntryId(entry?.id || '');
                      setPreviewEntryContext(entry?.id ? 'form' : 'default');
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {currentView === 'plan' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCurrentView('dashboard');
                      setPlanTab('plan');
                      closeEntry();
                    }}
                  >
                    Dashboard
                  </Button>
                  <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-aqua-200 bg-aqua-50 p-1 text-ocean-600">
                    {canUseCalendar && (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() => setPlanTab('plan')}
                          className={cx(
                            'rounded-2xl px-4 py-2 text-sm transition',
                            planTab === 'plan'
                              ? 'bg-ocean-500 text-white hover:bg-ocean-600'
                              : 'text-ocean-600 hover:bg-aqua-100',
                          )}
                        >
                          Calendar
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setPlanTab('trash')}
                          className={cx(
                            'rounded-2xl px-4 py-2 text-sm transition',
                            planTab === 'trash'
                              ? 'bg-ocean-500 text-white hover:bg-ocean-600'
                              : 'text-ocean-600 hover:bg-aqua-100',
                          )}
                        >
                          Trash
                        </Button>
                      </>
                    )}
                    {canUseKanban && (
                      <Button
                        variant="ghost"
                        onClick={() => setPlanTab('kanban')}
                        className={cx(
                          'rounded-2xl px-4 py-2 text-sm transition',
                          planTab === 'kanban'
                            ? 'bg-ocean-500 text-white hover:bg-ocean-600'
                            : 'text-ocean-600 hover:bg-aqua-100',
                        )}
                      >
                        Board
                      </Button>
                    )}
                    {canUseApprovals && (
                      <Button
                        variant="ghost"
                        onClick={() => setPlanTab('approvals')}
                        className={cx(
                          'rounded-2xl px-4 py-2 text-sm transition',
                          planTab === 'approvals'
                            ? 'bg-ocean-500 text-white hover:bg-ocean-600'
                            : 'text-ocean-600 hover:bg-aqua-100',
                        )}
                      >
                        Approvals
                      </Button>
                    )}
                    {canUseIdeas && (
                      <Button
                        variant="ghost"
                        onClick={() => setPlanTab('ideas')}
                        className={cx(
                          'rounded-2xl px-4 py-2 text-sm transition',
                          planTab === 'ideas'
                            ? 'bg-ocean-500 text-white hover:bg-ocean-600'
                            : 'text-ocean-600 hover:bg-aqua-100',
                        )}
                      >
                        Ideas
                      </Button>
                    )}
                    {canUseCalendar && (
                      <Button
                        variant="ghost"
                        onClick={() => setPlanTab('narrative')}
                        className={cx(
                          'rounded-2xl px-4 py-2 text-sm transition',
                          planTab === 'narrative'
                            ? 'bg-ocean-500 text-white hover:bg-ocean-600'
                            : 'text-ocean-600 hover:bg-aqua-100',
                        )}
                      >
                        Narrative
                      </Button>
                    )}
                    {canUseCalendar && (
                      <Button
                        variant="ghost"
                        onClick={() => setPlanTab('glance')}
                        className={cx(
                          'rounded-2xl px-4 py-2 text-sm transition',
                          planTab === 'glance'
                            ? 'bg-ocean-500 text-white hover:bg-ocean-600'
                            : 'text-ocean-600 hover:bg-aqua-100',
                        )}
                      >
                        Glance
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      if (!canUseCalendar) return;
                      setCurrentView('form');
                      setPlanTab('plan');
                      closeEntry();
                      try {
                        window.location.hash = '#create';
                      } catch {}
                    }}
                    className="gap-2"
                    disabled={!canUseCalendar}
                  >
                    <PlusIcon className="h-4 w-4 text-white" />
                    Create content
                  </Button>
                </div>
              </div>

              {(() => {
                switch (planTab) {
                  case 'plan':
                    if (!canUseCalendar) return null;
                    return (
                      <CalendarView
                        entries={entries}
                        monthCursor={monthCursor}
                        onMonthChange={setMonthCursor}
                        onApprove={toggleApprove}
                        onDelete={softDelete}
                        onOpenEntry={openEntry}
                        onImportPerformance={() => setPerformanceImportOpen(true)}
                        assetGoals={assetGoals}
                        onGoalsChange={setAssetGoals}
                        onEntryDateChange={handleEntryDateChange}
                        dailyPostTarget={dailyPostTarget}
                        onDailyPostTargetChange={handleDailyPostTargetChange}
                        onBulkDateShift={handleBulkDateShift}
                      />
                    );
                  case 'trash':
                    if (!canUseCalendar) return null;
                    return (
                      <Card className="shadow-xl">
                        <CardHeader>
                          <CardTitle className="text-lg text-ocean-900">
                            Trash (30-day retention)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {trashed.length === 0 ? (
                            <p className="text-sm text-graystone-500">Nothing in the trash.</p>
                          ) : (
                            <div className="space-y-3">
                              {trashed.map((entry) => (
                                <div
                                  key={entry.id}
                                  className="rounded-xl border border-graystone-200 bg-white px-4 py-3 shadow-sm"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge variant="outline">{entry.assetType}</Badge>
                                      <span className="text-sm font-medium text-graystone-700">
                                        {new Date(entry.date).toLocaleDateString()}
                                      </span>
                                      <span className="text-xs text-graystone-500">
                                        Deleted{' '}
                                        {entry.deletedAt
                                          ? new Date(entry.deletedAt).toLocaleString()
                                          : ''}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => restore(entry.id)}
                                      >
                                        <RotateCcwIcon className="h-4 w-4 text-graystone-600" />
                                        Restore
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => hardDelete(entry.id)}
                                      >
                                        <TrashIcon className="h-4 w-4 text-white" />
                                        Delete forever
                                      </Button>
                                    </div>
                                  </div>
                                  {entry.caption && (
                                    <p className="mt-2 line-clamp-2 text-sm text-graystone-600">
                                      {entry.caption}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  case 'kanban':
                    if (!canUseKanban) return null;
                    return (
                      <KanbanView
                        entries={entries}
                        onOpenEntry={openEntry}
                        onUpdateStatus={updateWorkflowStatus}
                      />
                    );
                  case 'approvals':
                    if (!canUseApprovals) return null;
                    return (
                      <ApprovalsView
                        approvals={outstandingApprovals}
                        outstandingCount={outstandingCount}
                        unreadMentionsCount={unreadMentionsCount}
                        canUseCalendar={canUseCalendar}
                        onApprove={toggleApprove}
                        onOpenEntry={openEntry}
                        onBackToMenu={() => setPlanTab('plan')}
                        onGoToCalendar={() => setPlanTab('plan')}
                        onCreateContent={() => {
                          setCurrentView('form');
                          setPlanTab('plan');
                          closeEntry();
                          try {
                            window.location.hash = '#create';
                          } catch {}
                        }}
                        onSwitchUser={handleSignOut}
                      />
                    );
                  case 'ideas':
                    if (!canUseIdeas) return null;
                    return (
                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <IdeaForm onSubmit={addIdea} currentUser={currentUser} />
                        <IdeasBoard
                          ideas={ideas}
                          onDelete={deleteIdea}
                          onCreateEntry={createEntryFromIdea}
                        />
                      </div>
                    );
                  case 'narrative':
                    if (!canUseCalendar) return null;
                    return (
                      <NarrativeView
                        entries={entries}
                        monthCursor={monthCursor}
                        onPrevMonth={() =>
                          setMonthCursor(
                            new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1),
                          )
                        }
                        onNextMonth={() =>
                          setMonthCursor(
                            new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1),
                          )
                        }
                        onOpenEntry={openEntry}
                      />
                    );
                  case 'glance':
                    if (!canUseCalendar) return null;
                    return (
                      <MonthlyGlance
                        entries={entries}
                        monthCursor={monthCursor}
                        onPrevMonth={() =>
                          setMonthCursor(
                            new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1),
                          )
                        }
                        onNextMonth={() =>
                          setMonthCursor(
                            new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1),
                          )
                        }
                        onOpenEntry={openEntry}
                        onUpdate={upsert}
                      />
                    );
                  default:
                    return null;
                }
              })()}
            </div>
          )}

          {currentView === 'analytics' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <AnalyticsView
                entries={entries}
                onUpdateEntry={(id, updates) => upsert({ id, ...updates })}
              />
            </div>
          )}

          {currentView === 'engagement' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <EngagementView
                activities={engagementActivities}
                accounts={engagementAccounts}
                goals={engagementGoals}
                currentUser={currentUser}
                onAddActivity={(activity) => {
                  const newActivity = {
                    ...activity,
                    id: uuid(),
                    createdAt: new Date().toISOString(),
                    createdBy: currentUser,
                  };
                  setEngagementActivities((prev) => [newActivity, ...prev]);
                }}
                onDeleteActivity={(id) => {
                  setEngagementActivities((prev) => prev.filter((a) => a.id !== id));
                }}
                onAddAccount={(account) => {
                  const newAccount = {
                    ...account,
                    id: uuid(),
                    createdAt: new Date().toISOString(),
                    createdBy: currentUser,
                  };
                  setEngagementAccounts((prev) => [newAccount, ...prev]);
                }}
                onDeleteAccount={(id) => {
                  setEngagementAccounts((prev) => prev.filter((a) => a.id !== id));
                }}
                onUpdateAccount={(id, updates) => {
                  setEngagementAccounts((prev) =>
                    prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
                  );
                }}
                onUpdateGoals={(goals) => setEngagementGoals(goals)}
              />
            </div>
          )}

          {currentView === 'opportunities' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <OpportunitiesView
                opportunities={openOpportunities}
                entries={entries}
                currentUser={currentUser}
                onAddOpportunity={addOpportunity}
                onMarkActed={markOpportunityAsActed}
                onDismiss={dismissOpportunity}
                onOpenEntry={openEntry}
              />
            </div>
          )}

          {currentView === 'requests' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ContentRequestsView
                contentRequests={contentRequests}
                currentUser={currentUser}
                approverOptions={approverOptions}
                onAddContentRequest={addContentRequest}
                onUpdateStatus={updateContentRequestStatus}
                onConvertToEntry={handleConvertRequestToEntry}
              />
            </div>
          )}

          {currentView === 'influencers' && canUseInfluencers && (
            <InfluencersView
              influencers={influencers}
              entries={entries}
              currentUser={currentUser}
              onAdd={handleAddInfluencer}
              onUpdate={handleUpdateInfluencer}
              onDelete={handleDeleteInfluencer}
              onOpenDetail={handleOpenInfluencerDetail}
            />
          )}

          {currentView === 'admin' && currentUserIsAdmin && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentView('dashboard')}
                    className="self-start"
                  >
                    Dashboard
                  </Button>
                  <h2 className="text-2xl font-semibold text-ocean-700">Admin tools</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (window.api && window.api.enabled) {
                        apiGet('/api/health').catch(() => {});
                      }
                    }}
                  >
                    Ping server
                  </Button>
                  <Button
                    onClick={() => {
                      (async () => {
                        try {
                          if (window.api && window.api.enabled) {
                            const json = await apiGet('/api/audit?limit=200');
                            setAdminAudits(Array.isArray(json) ? json : []);
                          } else {
                            const raw = storageAvailable
                              ? window.localStorage.getItem('pm-content-audit-log')
                              : '[]';
                            const local = raw ? JSON.parse(raw) : [];
                            setAdminAudits(Array.isArray(local) ? local : []);
                          }
                        } catch {}
                      })();
                    }}
                  >
                    Refresh audits
                  </Button>
                </div>
              </div>

              <Card className="shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg text-ocean-900">Recent audit events</CardTitle>
                  <p className="mt-2 text-sm text-graystone-500">
                    Pulled from the server when connected; local fallback otherwise.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {adminAudits.length === 0 ? (
                      <p className="text-sm text-graystone-600">No audit events.</p>
                    ) : (
                      adminAudits.slice(0, 200).map((row) => (
                        <div
                          key={row.id}
                          className="flex items-center justify-between rounded-xl border border-graystone-200 bg-white px-3 py-2 text-sm"
                        >
                          <div className="flex flex-col">
                            <div className="font-medium text-ocean-800">
                              {row.action || 'event'}
                            </div>
                            <div className="text-[11px] text-graystone-600">
                              {row.user || 'Unknown'} · {row.entryId || '—'}
                            </div>
                          </div>
                          <div className="text-[11px] text-graystone-500">
                            {row.ts ? new Date(row.ts).toLocaleString() : ''}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg text-ocean-900">Approver directory</CardTitle>
                  <p className="mt-2 text-sm text-graystone-500">
                    Approvers are managed via the user roster. Enable the role on a teammate to list
                    them here.
                  </p>
                </CardHeader>
                <CardContent>
                  {approverOptions.length ? (
                    <div className="flex flex-wrap gap-2">
                      {approverOptions.map((name) => (
                        <span
                          key={name}
                          className="rounded-full bg-aqua-100 px-3 py-1 text-xs font-semibold text-ocean-700"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-graystone-500">
                      No approvers configured yet. Mark a user as an approver to add them.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-xl">
                <CardHeader>
                  <CardTitle className="text-lg text-ocean-900">User roster</CardTitle>
                  <p className="mt-2 text-sm text-graystone-500">
                    Add new users (first + last + email); they’ll be emailed when created.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {userList.length ? (
                      userList.map((user) => (
                        <div
                          key={user.id || user.email || user.name}
                          className="rounded-xl border border-graystone-200 bg-white px-3 py-3 text-sm text-graystone-700"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="font-medium text-graystone-900">{user.name}</div>
                              <div className="text-[11px] text-graystone-500">
                                {user.email || 'No email'} ·{' '}
                                {user.status === 'disabled'
                                  ? 'Disabled'
                                  : user.invitePending || user.status === 'pending'
                                    ? 'Invite pending'
                                    : 'Active'}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-semibold uppercase text-graystone-500">
                                {user.isAdmin ? (
                                  <span className="rounded-full bg-ocean-50 px-2 py-0.5 text-ocean-700">
                                    Admin
                                  </span>
                                ) : null}
                                {user.isApprover ? (
                                  <span className="rounded-full bg-aqua-50 px-2 py-0.5 text-ocean-700">
                                    Approver
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                className="rounded-lg border border-graystone-300 bg-white px-2 py-1 text-xs text-graystone-700 focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-aqua-200"
                                value={user.managerEmail || ''}
                                onChange={(e) => handleManagerChange(user, e.target.value)}
                              >
                                <option value="">No manager</option>
                                {managerCandidates
                                  .filter((c) => c.email !== user.email)
                                  .map((c) => (
                                    <option key={c.email} value={c.email}>
                                      {c.name}
                                    </option>
                                  ))}
                              </select>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleApproverRole(user)}
                              >
                                {user.isApprover ? 'Remove approver' : 'Make approver'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setAccessModalUser(user)}
                              >
                                Access
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => removeUser(user)}>
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-graystone-500">No users configured yet.</p>
                    )}
                  </div>
                  <AddUserForm
                    defaultFeatures={DEFAULT_FEATURES}
                    onSubmit={addUser}
                    error={userAdminError}
                    success={userAdminSuccess}
                  />
                </CardContent>
              </Card>

              {/* Publishing Settings */}
              <PublishSettingsPanel settings={publishSettings} onUpdate={setPublishSettings} />

              {/* Platform Connections */}
              <PlatformConnectionsView currentUser={currentUser} />
            </div>
          )}
          <EntryPreviewModal
            open={Boolean(previewEntry)}
            entry={previewEntry}
            onClose={closePreview}
            onEdit={handlePreviewEdit}
            currentUser={currentUser}
            currentUserEmail={currentUserEmail}
            reviewMode={previewIsReviewMode}
            canApprove={previewCanApprove}
            onApprove={toggleApprove}
            onUpdate={upsert}
            onNotifyMentions={handleMentionNotifications}
            onCommentAdded={handleCommentActivity}
            approverOptions={approverOptions}
            users={mentionUsers}
          />
          {viewingSnapshot ? (
            <EntryModal
              entry={viewingSnapshot}
              currentUser={currentUser}
              currentUserEmail={currentUserEmail}
              onClose={closeEntry}
              onApprove={toggleApprove}
              onDelete={softDelete}
              onClone={cloneEntry}
              onUpdate={upsert}
              onNotifyMentions={handleMentionNotifications}
              onCommentAdded={handleCommentActivity}
              onPublish={handlePublishEntry}
              onPostAgain={handlePostAgain}
              onToggleEvergreen={handleToggleEvergreen}
              approverOptions={approverOptions}
              users={mentionUsers}
            />
          ) : null}
          {currentUserIsAdmin && (
            <AccessModal
              open={Boolean(accessModalUser)}
              user={accessModalUser}
              features={accessModalUser?.features || DEFAULT_FEATURES}
              onClose={() => setAccessModalUser(null)}
              onSave={handleAccessSave}
            />
          )}
          <ChangePasswordModal
            open={changePasswordOpen}
            requiresCurrent={currentUserHasPassword}
            onClose={() => setChangePasswordOpen(false)}
            onSubmit={handleChangePassword}
          />
          {syncToast ? (
            <div className="fixed bottom-6 right-6 z-50 max-w-xs">
              <div
                className={cx(
                  'rounded-2xl border px-4 py-3 text-sm shadow-xl',
                  syncToast.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900',
                )}
              >
                {syncToast.message}
              </div>
            </div>
          ) : null}
          <GuidelinesModal
            open={guidelinesOpen}
            guidelines={guidelines}
            onClose={() => setGuidelinesOpen(false)}
            onSave={handleGuidelinesSave}
          />
          <PerformanceImportModal
            open={performanceImportOpen}
            onClose={() => setPerformanceImportOpen(false)}
            onImport={importPerformanceDataset}
          />
          <InfluencerModal
            open={influencerModalOpen}
            influencer={
              editingInfluencerId
                ? influencers.find((i) => i.id === editingInfluencerId) || null
                : null
            }
            entries={entries}
            currentUser={currentUser}
            allNiches={customNiches}
            onClose={() => {
              setInfluencerModalOpen(false);
              setEditingInfluencerId(null);
            }}
            onSave={(inf) => {
              if (editingInfluencerId) {
                handleUpdateInfluencer(inf);
              } else {
                handleAddInfluencer(inf);
              }
            }}
            onDelete={handleDeleteInfluencer}
            onLinkEntry={handleLinkEntryToInfluencer}
            onUnlinkEntry={handleUnlinkEntryFromInfluencer}
            onAddNiche={handleAddCustomNiche}
          />
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<ContentDashboard />);
}
