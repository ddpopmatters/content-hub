import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensurePeopleArray, uuid } from '../../lib/utils';
import {
  computeStatusDetail,
  createEmptyChecklist,
  entrySignature,
  getWorkflowBlockers,
  hasApproverRelevantChanges,
  hasPublicationRelevantChanges,
  sanitizeEntry,
} from '../../lib/sanitizers';
import { buildEntryEmailPayload } from '../../lib/email';
import { appendAudit } from '../../lib/audit';
import { loadEntries, saveEntries } from '../../lib/storage';
import { isDurablePublicationJob, SUPABASE_API } from '../../lib/supabase';
import { APP_CONFIG } from '../../lib/config';
import {
  canPublish,
  canRetryFailedPlatform,
  getPublishRequestError,
  initializePublishStatus,
} from '../../features/publishing';
import { KANBAN_STATUSES } from '../../constants';
import type { DurablePublicationJob, Entry } from '../../types/models';
import {
  applyDurablePublicationJob,
  getDurablePublishStatus,
} from '../../features/publishing/durablePublication';

interface UseEntriesDeps {
  runSyncTask: (
    label: string,
    fn: () => Promise<unknown>,
    options?: { requiresApi?: boolean },
  ) => Promise<unknown>;
  pushSyncToast: (message: string, variant?: string) => void;
  currentUser: string;
  currentUserEmail: string;
  currentUserIsAdmin: boolean;
  viewerIsAuthor: (entry: Record<string, unknown>) => boolean;
  viewerIsApprover: (entry: Record<string, unknown>) => boolean;
  addNotifications: (notifs: Record<string, unknown>[]) => void;
  buildApprovalNotifications: (
    entry: Record<string, unknown>,
    subset?: string[],
  ) => Record<string, unknown>[];
  notifyApproversAboutChange: (entry: Record<string, unknown>) => void;
  notifyViaServer: (payload: Record<string, unknown>, label: string) => void;
  markNotificationsAsReadForEntry: (entryId: string, user: string) => void;
  guidelines: Record<string, unknown> | null;
  authStatus: string;
  onEntryCreated?: (entry: Record<string, unknown>) => void;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createPublicationRequestKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    const requestKey = crypto.randomUUID();
    if (UUID_PATTERN.test(requestKey)) return requestKey;
  }

  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure publication request keys are unavailable.');
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
};

const getPublicationRequestKey = (entry: Entry): string => {
  const storageKey = `content-hub:publication-intent:${entry.id}:${entry.contentRevision}`;
  if (typeof window === 'undefined') return createPublicationRequestKey();

  try {
    const existing = window.localStorage.getItem(storageKey)?.trim() ?? '';
    if (UUID_PATTERN.test(existing)) return existing;
    const requestKey = createPublicationRequestKey();
    window.localStorage.setItem(storageKey, requestKey);
    return requestKey;
  } catch {
    return createPublicationRequestKey();
  }
};

const clearPublicationRequestKey = (entry: Entry): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(
      `content-hub:publication-intent:${entry.id}:${entry.contentRevision}`,
    );
  } catch {
    // In-memory request-key reuse still protects this browser session.
  }
};

export function useEntries({
  runSyncTask,
  pushSyncToast,
  currentUser,
  currentUserEmail,
  currentUserIsAdmin,
  viewerIsAuthor,
  viewerIsApprover,
  addNotifications,
  buildApprovalNotifications,
  notifyApproversAboutChange,
  notifyViaServer,
  markNotificationsAsReadForEntry,
  guidelines,
  authStatus,
  onEntryCreated,
}: UseEntriesDeps) {
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingSnapshot, setViewingSnapshot] = useState<Record<string, unknown> | null>(null);
  const refreshRequestIdRef = useRef(0);
  const publicationRequestKeysRef = useRef(new Map<string, string>());
  const [previewEntryId, setPreviewEntryId] = useState('');
  const [previewEntryContext, setPreviewEntryContext] = useState('default');
  const [deepLinkEntryId, setDeepLinkEntryId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get('entry') || '';
    } catch {
      return '';
    }
  });

  // Persist entries to localStorage when server is not available
  useEffect(() => {
    if (
      !(
        (window as unknown as Record<string, unknown>).api &&
        ((window as unknown as Record<string, unknown>).api as Record<string, unknown>).enabled
      )
    ) {
      saveEntries(entries);
    }
  }, [entries]);

  // Load entries from localStorage on mount
  const hydrateFromLocal = useCallback(() => {
    // Local projections cannot prove that no durable Partial, Published or
    // Unknown intent exists. Keep direct publishing disabled until the
    // authenticated server hydration explicitly confirms publication state.
    setEntries(
      loadEntries().map((entry) => ({
        ...entry,
        publicationStateAvailable: false,
      })),
    );
  }, []);

  const refreshEntries = useCallback(async () => {
    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;

    try {
      const payload = await SUPABASE_API.fetchEntries();
      if (requestId !== refreshRequestIdRef.current) return false;
      if (Array.isArray(payload)) {
        setEntries(payload);
        return true;
      }
      return false;
    } catch {
      if (requestId === refreshRequestIdRef.current) {
        pushSyncToast('Unable to refresh entries from the server.', 'warning');
      }
      return false;
    }
  }, [pushSyncToast]);

  // Subscribe to realtime changes so all team members see each other's entries live
  useEffect(() => {
    if (authStatus !== 'ready') return;
    const channel = SUPABASE_API.subscribeToEntries(() => {
      refreshEntries();
    });
    return () => {
      channel?.unsubscribe();
    };
  }, [authStatus, refreshEntries]);

  const closeEntry = useCallback(() => {
    setViewingId(null);
    setViewingSnapshot(null);
    setPreviewEntryId('');
    setPreviewEntryContext('default');
  }, []);

  const openEntry = useCallback(
    (id: string) => {
      if (!id) {
        closeEntry();
        return;
      }
      const found = entries.find((entry) => entry.id === id);
      if (!found) {
        closeEntry();
        return;
      }
      const sanitized = sanitizeEntry(found);
      const canEdit =
        currentUserIsAdmin || viewerIsAuthor(sanitized as unknown as Record<string, unknown>);
      if (canEdit) {
        setPreviewEntryId('');
        setPreviewEntryContext('default');
        setViewingId(id);
        setViewingSnapshot(sanitized);
      } else {
        setViewingId(null);
        setViewingSnapshot(null);
        setPreviewEntryId(id);
        setPreviewEntryContext('calendar');
      }
      markNotificationsAsReadForEntry(String(found.id), currentUser);
    },
    [
      entries,
      currentUserIsAdmin,
      viewerIsAuthor,
      markNotificationsAsReadForEntry,
      currentUser,
      closeEntry,
    ],
  );

  const closePreview = useCallback(() => {
    setPreviewEntryId('');
    setPreviewEntryContext('default');
  }, []);

  const handlePreviewEdit = useCallback(
    (id: string) => {
      if (!id) return;
      closePreview();
      openEntry(id);
    },
    [closePreview, openEntry],
  );

  // Keep viewingSnapshot in sync with entries
  useEffect(() => {
    if (!viewingId) {
      setViewingSnapshot(null);
      return;
    }
    const latest = entries.find((entry) => entry.id === viewingId);
    if (!latest) {
      closeEntry();
      return;
    }
    const sanitized = sanitizeEntry(latest);
    setViewingSnapshot((prev) => {
      if (prev && entrySignature(prev) === entrySignature(sanitized)) {
        return prev;
      }
      return sanitized;
    });
    markNotificationsAsReadForEntry(String(latest.id), currentUser);
  }, [entries, viewingId, currentUser, closeEntry, markNotificationsAsReadForEntry]);

  // Deep link resolution
  const clearEntryQueryParam = () => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('entry')) return;
      url.searchParams.delete('entry');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* URL parsing edge case */
    }
  };

  useEffect(() => {
    if (!deepLinkEntryId) return;
    if (authStatus !== 'ready') return;
    const existing = entries.find((entry) => entry.id === deepLinkEntryId);
    if (existing) {
      openEntry(deepLinkEntryId);
      clearEntryQueryParam();
      setDeepLinkEntryId('');
    }
  }, [deepLinkEntryId, entries, authStatus, openEntry]);

  const addEntry = useCallback(
    (data: Record<string, unknown>) => {
      const timestamp = new Date().toISOString();
      let createdEntry: Record<string, unknown> | null = null;
      setEntries((prev) => {
        const rawEntry = {
          id: uuid(),
          status: 'Pending',
          createdAt: timestamp,
          updatedAt: timestamp,
          checklist: data.checklist,
          comments: data.comments || [],
          workflowStatus:
            data.workflowStatus &&
            (KANBAN_STATUSES as readonly string[]).includes(data.workflowStatus as string)
              ? data.workflowStatus
              : KANBAN_STATUSES[0],
          ...data,
        };
        const sanitized = sanitizeEntry(rawEntry);
        const entryWithStatus = {
          ...sanitized,
          statusDetail: computeStatusDetail(sanitized),
        };
        createdEntry = entryWithStatus;
        return [entryWithStatus, ...prev];
      });
      if (createdEntry) {
        const entry = createdEntry as Record<string, unknown>;
        const descriptor =
          entry.caption && String(entry.caption).trim().length
            ? String(entry.caption).trim()
            : `${entry.assetType || 'Asset'} on ${new Date(
                entry.date as string,
              ).toLocaleDateString()}`;
        addNotifications(buildApprovalNotifications(entry));
        const entryApprovers = ensurePeopleArray(entry.approvers);
        const shouldEmailApprovers =
          entryApprovers.length || (guidelines as Record<string, unknown>)?.teamsWebhookUrl;
        if (shouldEmailApprovers) {
          try {
            const requesterName = currentUser || entry.author || 'A teammate';
            const emailPayload = buildEntryEmailPayload(entry);
            const fallbackSubject = `[PM Dashboard] Approval requested: ${descriptor}`;
            const fallbackText = `${requesterName} requested your approval for ${descriptor}, planned for ${new Date(
              entry.date as string,
            ).toLocaleDateString()}.`;
            notifyViaServer(
              {
                teamsWebhookUrl: (guidelines as Record<string, unknown>)?.teamsWebhookUrl,
                message: `${requesterName} requested approval for entry ${entry.id}`,
                approvers: entryApprovers,
                entryId: entry.id,
                subject:
                  (emailPayload as unknown as Record<string, unknown>)?.subject || fallbackSubject,
                text: (emailPayload as unknown as Record<string, unknown>)?.text || fallbackText,
                html: (emailPayload as unknown as Record<string, unknown>)?.html,
              },
              `Send approval request (${entry.id})`,
            );
          } catch {
            /* notification failure is non-critical */
          }
        }
        try {
          runSyncTask(
            `Create entry (${entry.id})`,
            () =>
              SUPABASE_API.saveEntry(
                entry as Partial<Entry>,
                currentUserEmail || currentUser || '',
              ),
            { requiresApi: false },
          ).then((ok: unknown) => {
            if (ok) {
              onEntryCreated?.(entry);
              refreshEntries();
            }
          });
        } catch {
          /* sync failure handled by queue */
        }
        appendAudit({
          user: currentUser,
          entryId: entry.id as string,
          action: 'entry-create',
          meta: {
            date: entry.date,
            assetType: entry.assetType,
            platforms: entry.platforms,
          },
        });
      }
      return createdEntry;
    },
    [
      currentUser,
      currentUserEmail,
      addNotifications,
      buildApprovalNotifications,
      notifyViaServer,
      guidelines,
      runSyncTask,
      refreshEntries,
    ],
  );

  const cloneEntry = useCallback(
    (sourceEntry: Record<string, unknown>) => {
      if (!sourceEntry) return;
      const timestamp = new Date().toISOString();
      const newId = uuid();

      const clonedData = {
        platforms: sourceEntry.platforms || [],
        assetType: sourceEntry.assetType || '',
        caption: sourceEntry.caption || '',
        platformCaptions: sourceEntry.platformCaptions || {},
        firstComment: sourceEntry.firstComment || '',
        script: sourceEntry.script || '',
        designCopy: sourceEntry.designCopy || '',
        carouselSlides: sourceEntry.carouselSlides || [],
        previewUrl: sourceEntry.previewUrl || '',
        priorityTier: sourceEntry.priorityTier || 'Medium',
        campaign: sourceEntry.campaign || '',
        contentPillar: sourceEntry.contentPillar || '',
        testingFrameworkId: sourceEntry.testingFrameworkId || '',
        testingFrameworkName: sourceEntry.testingFrameworkName || '',
        id: newId,
        date: '',
        status: 'Pending',
        workflowStatus: KANBAN_STATUSES[0],
        author: currentUser || 'Unknown',
        approvers: sourceEntry.approvers || [],
        approvalDeadline: '',
        approvedAt: undefined,
        contentRevision: 1,
        approvedRevision: null,
        checklist: createEmptyChecklist(),
        comments: [],
        analytics: {},
        analyticsUpdatedAt: '',
        aiFlags: [],
        aiScore: {},
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };

      const sanitized = sanitizeEntry(clonedData);
      const entryWithStatus = {
        ...sanitized,
        statusDetail: computeStatusDetail(sanitized),
        _isNew: true,
      };

      setEntries((prev) => [entryWithStatus, ...prev]);
      setViewingId(newId);
      setViewingSnapshot(entryWithStatus);
      pushSyncToast('Entry cloned — choose a planned date', 'success');

      appendAudit({
        user: currentUser,
        entryId: newId,
        action: 'entry-clone',
        meta: {
          sourceEntryId: sourceEntry.id,
          assetType: clonedData.assetType,
          platforms: clonedData.platforms,
        },
      });
    },
    [currentUser, pushSyncToast],
  );

  const upsert = useCallback(
    (updated: Record<string, unknown>) => {
      const timestamp = new Date().toISOString();
      const existingEntry = entries.find((entry) => entry.id === updated.id);
      const sanitizedForPersistence = sanitizeEntry({
        ...(existingEntry ?? {}),
        ...updated,
        updatedAt: timestamp,
      });
      const publicationContentChangedForPersistence = Boolean(
        existingEntry &&
          sanitizedForPersistence &&
          hasPublicationRelevantChanges(existingEntry as Partial<Entry>, sanitizedForPersistence),
      );
      const approvalRevokedForPersistence = Boolean(
        publicationContentChangedForPersistence &&
          existingEntry &&
          (existingEntry.workflowStatus === 'Approved' ||
            existingEntry.workflowStatus === 'Published' ||
            existingEntry.status === 'Approved'),
      );
      const updateForPersistence = approvalRevokedForPersistence
        ? {
            ...updated,
            status: 'Pending',
            workflowStatus: 'Ready for Review',
            approvedAt: null,
            updatedAt: timestamp,
          }
        : updated;

      let approvalNotifications: Record<string, unknown>[] = [];
      const pendingApproverAlerts: Record<string, unknown>[] = [];
      let newApproverEntryForNotify: Record<string, unknown> | null = null;
      let newApproversForNotify: string[] = [];
      const normalizedActor = (currentUser || '').trim().toLowerCase();
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === updated.id
            ? (() => {
                const merged = {
                  ...entry,
                  ...updated,
                  updatedAt: timestamp,
                };
                const sanitized = sanitizeEntry(merged);
                if (!sanitized) return entry;
                const publicationContentChanged = hasPublicationRelevantChanges(
                  entry as Partial<Entry>,
                  sanitized,
                );
                const approvalRevoked =
                  publicationContentChanged &&
                  (entry.workflowStatus === 'Approved' ||
                    entry.workflowStatus === 'Published' ||
                    entry.status === 'Approved');
                const currentRevision =
                  typeof entry.contentRevision === 'number' &&
                  Number.isSafeInteger(entry.contentRevision) &&
                  entry.contentRevision > 0
                    ? entry.contentRevision
                    : 1;
                const approvalSafeEntry = sanitizeEntry({
                  ...sanitized,
                  ...(publicationContentChanged
                    ? {
                        contentRevision: currentRevision + 1,
                        approvedRevision: null,
                      }
                    : {}),
                  ...(approvalRevoked
                    ? {
                        status: 'Pending',
                        workflowStatus: 'Ready for Review',
                        approvedAt: null,
                      }
                    : {}),
                  updatedAt: timestamp,
                });
                if (!approvalSafeEntry) return entry;

                const previousApprovers = ensurePeopleArray(entry.approvers);
                const nextApprovers = ensurePeopleArray(approvalSafeEntry.approvers);
                const newApprovers = nextApprovers.filter(
                  (name: string) => name && !previousApprovers.includes(name),
                );
                if (newApprovers.length) {
                  approvalNotifications = approvalNotifications.concat(
                    buildApprovalNotifications(
                      approvalSafeEntry as unknown as Record<string, unknown>,
                      newApprovers,
                    ),
                  );
                  newApproverEntryForNotify = approvalSafeEntry as unknown as Record<
                    string,
                    unknown
                  >;
                  newApproversForNotify = newApprovers;
                }
                const actorIsApprover = normalizedActor
                  ? nextApprovers.some(
                      (name: string) => (name || '').trim().toLowerCase() === normalizedActor,
                    )
                  : false;
                if (
                  hasApproverRelevantChanges(entry as Partial<Entry>, approvalSafeEntry) &&
                  nextApprovers.length &&
                  !actorIsApprover
                ) {
                  pendingApproverAlerts.push(
                    approvalSafeEntry as unknown as Record<string, unknown>,
                  );
                }
                return {
                  ...approvalSafeEntry,
                  statusDetail: computeStatusDetail(approvalSafeEntry),
                };
              })()
            : entry,
        ),
      );
      if (approvalNotifications.length) {
        addNotifications(approvalNotifications);
      }
      // CFA cannot trace assignments made inside the setEntries callback.
      const entryForNotify = newApproverEntryForNotify as Record<string, unknown> | null;
      const approversForNotify = newApproversForNotify;
      if (entryForNotify && approversForNotify.length) {
        try {
          const emailPayload = buildEntryEmailPayload(entryForNotify);
          const requesterName = currentUser || String(entryForNotify.author || '') || 'A teammate';
          notifyViaServer(
            {
              approvers: approversForNotify,
              to: approversForNotify,
              teamsWebhookUrl: (guidelines as Record<string, unknown> | null)?.teamsWebhookUrl,
              entryId: String(entryForNotify.id ?? ''),
              subject: emailPayload?.subject ?? `[PM Dashboard] Approval requested`,
              text: emailPayload?.text ?? `${requesterName} assigned you as an approver.`,
              html: emailPayload?.html,
            },
            `Send approval request (${entryForNotify.id})`,
          );
        } catch {
          /* best-effort — notification failure must not block the save */
        }
      }
      if (pendingApproverAlerts.length) {
        pendingApproverAlerts.forEach((entry) => notifyApproversAboutChange(entry));
      }
      if (approvalRevokedForPersistence) {
        pushSyncToast('Approval cleared because publishing content changed.', 'warning');
      }

      if (updated?.id) {
        const isNewEntry = existingEntry?._isNew;

        try {
          if (isNewEntry) {
            runSyncTask(
              `Create entry (${updated.id})`,
              () =>
                SUPABASE_API.saveEntry(
                  updateForPersistence as unknown as Partial<Entry>,
                  currentUserEmail || currentUser || '',
                ),
              { requiresApi: false },
            ).then((ok: unknown) => {
              if (ok) {
                setEntries((prev) =>
                  prev.map((e) => (e.id === updated.id ? { ...e, _isNew: undefined } : e)),
                );
                onEntryCreated?.({
                  ...(existingEntry as Record<string, unknown>),
                  ...updateForPersistence,
                  _isNew: undefined,
                });
                refreshEntries();
              }
            });
          } else {
            runSyncTask(
              `Update entry (${updated.id})`,
              () =>
                SUPABASE_API.saveEntry(
                  updateForPersistence as unknown as Partial<Entry>,
                  currentUserEmail || currentUser || '',
                ),
              { requiresApi: false },
            ).then((ok: unknown) => {
              if (ok) refreshEntries();
            });
          }
        } catch {
          /* sync failure handled by queue */
        }
      }
      appendAudit({
        user: currentUser,
        entryId: updated?.id as string,
        action: existingEntry?._isNew ? 'entry-create' : 'entry-update',
      });
    },
    [
      currentUser,
      currentUserEmail,
      entries,
      addNotifications,
      buildApprovalNotifications,
      notifyApproversAboutChange,
      notifyViaServer,
      guidelines,
      pushSyncToast,
      runSyncTask,
      refreshEntries,
      onEntryCreated,
    ],
  );

  const toggleApprove = useCallback(
    (id: string) => {
      const entryRecord = entries.find((entry) => entry.id === id) || null;
      if (!entryRecord) return;
      const approving = entryRecord?.status !== 'Approved';
      const blockers = approving ? getWorkflowBlockers(entryRecord as Partial<Entry>) : [];
      if (approving && blockers.length) {
        pushSyncToast(
          `Heads up: ${blockers
            .map((item) => item.label)
            .slice(0, 3)
            .join(', ')}`,
          'warning',
        );
      }
      const timestamp = new Date().toISOString();
      // Pre-compute before setEntries — derived from entryRecord, no side effects in updater
      const nextStatus = approving ? 'Approved' : 'Pending';
      const nextWorkflowStatus = nextStatus === 'Approved' ? 'Approved' : 'Ready for Review';
      setEntries((prev) =>
        prev.map((entry) => {
          if (entry.id !== id) return entry;
          const updatedEntry = sanitizeEntry({
            ...entry,
            status: nextStatus,
            workflowStatus: nextWorkflowStatus,
            approvedAt: nextStatus === 'Approved' ? timestamp : undefined,
            approvedRevision: nextStatus === 'Approved' ? entry.contentRevision || 1 : null,
            updatedAt: timestamp,
          });
          const normalized = {
            ...updatedEntry,
            workflowStatus: nextWorkflowStatus,
          };
          return {
            ...normalized,
            statusDetail: computeStatusDetail(normalized),
          };
        }),
      );
      try {
        runSyncTask(
          `Update approval (${id})`,
          () =>
            SUPABASE_API.saveEntry(
              {
                ...entryRecord,
                id,
                status: nextStatus,
                workflowStatus: nextWorkflowStatus,
                approvedAt: nextStatus === 'Approved' ? timestamp : undefined,
              },
              currentUserEmail || currentUser || '',
            ),
          { requiresApi: false },
        ).then((ok: unknown) => {
          if (ok) {
            refreshEntries();
            return;
          }
          pushSyncToast('Approval change failed to save. Reloaded server state.', 'warning');
          refreshEntries();
        });
      } catch {
        /* sync failure handled by queue */
      }
      appendAudit({
        user: currentUser,
        entryId: id,
        action: nextStatus === 'Approved' ? 'entry-approve' : 'entry-unapprove',
      });
      const entryApprovers = ensurePeopleArray(entryRecord?.approvers);
      const descriptor =
        entryRecord && entryRecord.caption && String(entryRecord.caption).trim().length
          ? String(entryRecord.caption).trim()
          : entryRecord
            ? `${entryRecord.assetType || 'Asset'} on ${new Date(
                entryRecord.date as string,
              ).toLocaleDateString()}`
            : `Entry ${id}`;
      const shouldNotify =
        (guidelines as Record<string, unknown>)?.teamsWebhookUrl || entryApprovers.length;
      if (shouldNotify) {
        try {
          const statusMsg = nextStatus === 'Approved' ? 'approved' : 'unapproved';
          const subjectLabel =
            (entryRecord?.campaign as string) ||
            (entryRecord?.contentPillar as string) ||
            (entryRecord?.assetType as string) ||
            `Entry ${id}`;
          const subject = `[PM Dashboard] ${subjectLabel} ${statusMsg}`;
          const summaryParts = [
            `${currentUser} ${statusMsg} entry ${entryRecord?.id || id}`,
            entryRecord?.date
              ? `planned for ${new Date(entryRecord.date as string).toLocaleDateString()}`
              : '',
          ].filter(Boolean);
          const emailPayload = buildEntryEmailPayload(entryRecord as Record<string, unknown>, {
            subjectOverride: `${subjectLabel} ${statusMsg}`,
          });
          notifyViaServer(
            {
              teamsWebhookUrl: (guidelines as Record<string, unknown>)?.teamsWebhookUrl,
              message: `Entry ${id} ${statusMsg} by ${currentUser}`,
              approvers: entryApprovers,
              entryId: id,
              subject: (emailPayload as unknown as Record<string, unknown>)?.subject || subject,
              text:
                (emailPayload as unknown as Record<string, unknown>)?.text ||
                summaryParts.join(' - '),
              html: (emailPayload as unknown as Record<string, unknown>)?.html,
            },
            `Send approval status (${id})`,
          );
        } catch {
          /* notification failure is non-critical */
        }
      }
      const requestorNames = ensurePeopleArray(entryRecord?.author);
      if (nextStatus === 'Approved' && requestorNames.length) {
        try {
          const subjectApproved = `[PM Dashboard] Approved: ${descriptor}`;
          const textApproved = `${currentUser} approved ${descriptor}.`;
          notifyViaServer(
            {
              to: requestorNames,
              subject: subjectApproved,
              text: textApproved,
            },
            `Notify requester (${id})`,
          );
        } catch {
          /* notification failure is non-critical */
        }
      }
    },
    [
      entries,
      currentUser,
      currentUserEmail,
      guidelines,
      runSyncTask,
      refreshEntries,
      notifyViaServer,
      pushSyncToast,
    ],
  );

  const handlePublishEntry = useCallback(
    async (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry || !canPublish(entry)) return;

      const newPublishStatus = initializePublishStatus(entry.platforms as string[]);
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, publishStatus: newPublishStatus } : e)),
      );

      const timestamp = new Date().toISOString();

      type PlatformResult = {
        status: string;
        url: string | null;
        error: string | null;
        timestamp: string;
      };
      type EdgeResult = {
        success: boolean;
        results?: Record<string, PlatformResult>;
        job?: DurablePublicationJob;
        error?: string;
      };

      const unknownEdgeResult = (): EdgeResult => ({
        success: false,
        results: Object.fromEntries(
          entry.platforms.map((platform) => [
            platform,
            {
              status: 'unknown',
              url: null,
              error: 'Publishing state could not be verified. Check the platform before retrying.',
              timestamp,
            },
          ]),
        ),
        error: 'Publishing state could not be verified safely.',
      });

      const resultFromDurableJob = (
        durableJob: DurablePublicationJob,
        error?: string,
      ): EdgeResult => {
        const durableStatus = getDurablePublishStatus(durableJob);
        return {
          success: durableJob.results.some((result) => result.status === 'published'),
          job: durableJob,
          results: Object.fromEntries(
            Object.entries(durableStatus).map(([platform, status]) => [
              platform,
              { ...status, timestamp: status.timestamp ?? timestamp },
            ]),
          ),
          ...(error ? { error } : {}),
        };
      };

      const loadDurableResult = async (
        error: string,
        unknownWhenMissing: boolean,
      ): Promise<EdgeResult> => {
        try {
          const durableJob = await SUPABASE_API.fetchLatestPublicationJob(entry.id);
          if (
            durableJob &&
            durableJob.entryId === entry.id &&
            durableJob.entryRevision === entry.contentRevision
          ) {
            return resultFromDurableJob(durableJob, error);
          }
          return unknownWhenMissing ? unknownEdgeResult() : { success: false, error };
        } catch {
          return unknownEdgeResult();
        }
      };

      let edgeResult: EdgeResult = { success: false, error: 'Unknown error' };
      let requestDispatched = false;
      try {
        const requestIdentity = `${entry.id}:${entry.contentRevision}`;
        const requestKey =
          publicationRequestKeysRef.current.get(requestIdentity) ?? getPublicationRequestKey(entry);
        publicationRequestKeysRef.current.set(requestIdentity, requestKey);
        const session = await SUPABASE_API.getSession();
        if (!session?.access_token) {
          edgeResult = {
            success: false,
            error: 'Sign in again before publishing.',
          };
        } else {
          const functionUrl = `${APP_CONFIG.SUPABASE_URL}/functions/v1/publish-entry`;
          requestDispatched = true;
          const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
              apikey: APP_CONFIG.SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ entryId: entry.id, requestKey }),
          });
          if (!response.ok) {
            edgeResult = await loadDurableResult(getPublishRequestError(response.status), false);
          } else {
            const responseResult = (await response.json()) as EdgeResult;
            if (
              responseResult.job &&
              (responseResult.job.entryId !== entry.id ||
                responseResult.job.entryRevision !== entry.contentRevision)
            ) {
              throw new Error('Publication response identity mismatch');
            }
            edgeResult = responseResult.job
              ? resultFromDurableJob(responseResult.job, responseResult.error)
              : responseResult;
          }
        }
      } catch {
        edgeResult = requestDispatched
          ? await loadDurableResult('Publishing state required verification.', true)
          : {
              success: false,
              error: 'Publishing failed before the request was sent.',
            };
      }

      if (edgeResult.job?.status === 'failed') {
        publicationRequestKeysRef.current.delete(`${entry.id}:${entry.contentRevision}`);
        clearPublicationRequestKey(entry);
      }

      const platforms = entry.platforms as string[];

      if (edgeResult.success && edgeResult.results) {
        const publishedStatus: Record<string, unknown> = {};
        const allPublished = platforms.every(
          (platform) => edgeResult.results![platform]?.status === 'published',
        );
        platforms.forEach((platform) => {
          const r = edgeResult.results![platform];
          publishedStatus[platform] = {
            status: r?.status || 'failed',
            url: r?.url || null,
            error: r?.error || null,
            timestamp: r?.timestamp || timestamp,
          };
        });

        const updates = {
          publishStatus: publishedStatus,
          ...(edgeResult.job ? { publicationJob: edgeResult.job } : {}),
          ...(allPublished ? { workflowStatus: 'Published', publishedAt: timestamp } : {}),
        };

        setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
        setViewingSnapshot((previous) =>
          previous?.id === id ? { ...previous, ...updates } : previous,
        );

        try {
          await SUPABASE_API.saveEntry(
            { ...entry, ...updates } as Partial<Entry>,
            currentUserEmail || currentUser || '',
          );
        } catch (err) {
          console.error('Failed to persist publish status:', err);
        }
      } else {
        const failedStatus: Record<string, unknown> = {};
        platforms.forEach((platform) => {
          const r = edgeResult.results?.[platform];
          const status = r?.status || (edgeResult.job ? 'unknown' : 'failed');
          failedStatus[platform] = {
            status,
            url: null,
            error:
              r?.error ||
              (status === 'pending' || status === 'publishing'
                ? null
                : edgeResult.error || 'Failed to publish'),
            timestamp,
          };
        });

        setEntries((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  publishStatus: failedStatus,
                  ...(edgeResult.job ? { publicationJob: edgeResult.job } : {}),
                }
              : e,
          ),
        );
        setViewingSnapshot((previous) =>
          previous?.id === id
            ? {
                ...previous,
                publishStatus: failedStatus,
                ...(edgeResult.job ? { publicationJob: edgeResult.job } : {}),
              }
            : previous,
        );

        try {
          await SUPABASE_API.saveEntry(
            {
              ...entry,
              publishStatus: failedStatus,
              ...(edgeResult.job ? { publicationJob: edgeResult.job } : {}),
            } as Partial<Entry>,
            currentUserEmail || currentUser || '',
          );
        } catch (err) {
          console.error('Failed to persist publish failure:', err);
        }
      }

      appendAudit({
        user: currentUser,
        entryId: id,
        action: 'entry-publish-trigger',
      });
    },
    [entries, currentUser, currentUserEmail],
  );

  const handleRetryPublicationPlatform = useCallback(
    async (id: string, platform: string) => {
      const entry = entries.find((candidate) => candidate.id === id) as Entry | undefined;
      if (!entry || !canRetryFailedPlatform(entry, platform) || !entry.publicationJob) {
        throw new Error('This platform result is not available for a safe retry.');
      }

      const originalJob = entry.publicationJob;
      const retryRequestKey = createPublicationRequestKey();
      const timestamp = new Date().toISOString();
      const applyProjection = (project: (current: Entry) => Entry): void => {
        setEntries((previous) =>
          previous.map((candidate) =>
            candidate.id === id
              ? (project(candidate as Entry) as unknown as Record<string, unknown>)
              : candidate,
          ),
        );
        setViewingSnapshot((previous) =>
          previous?.id === id
            ? (project(previous as unknown as Entry) as unknown as Record<string, unknown>)
            : previous,
        );
      };

      applyProjection((current) => ({
        ...current,
        publishStatus: {
          ...current.publishStatus,
          [platform]: {
            ...current.publishStatus?.[platform],
            status: 'publishing',
            url: current.publishStatus?.[platform]?.url ?? null,
            error: null,
            timestamp,
          },
        },
      }));

      let requestDispatched = false;
      let failureMessage = 'The platform could not be retried safely.';
      try {
        const session = await SUPABASE_API.getSession();
        if (!session?.access_token) {
          applyProjection((current) => ({
            ...current,
            publicationStateAvailable: entry.publicationStateAvailable,
            publicationJob: entry.publicationJob,
            publishStatus: entry.publishStatus,
          }));
          throw new Error('Sign in again before retrying publication.');
        }

        const functionUrl = `${APP_CONFIG.SUPABASE_URL}/functions/v1/publish-entry`;
        requestDispatched = true;
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: APP_CONFIG.SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            action: 'retry_failed',
            entryId: entry.id,
            jobId: originalJob.id,
            retryRequestKey,
            platform,
          }),
        });
        if (!response.ok) {
          failureMessage =
            response.status === 401
              ? 'Sign in again before retrying publication.'
              : response.status === 409
                ? 'This platform result is not available for a safe retry.'
                : response.status === 422
                  ? 'The approved media could not be verified for publication.'
                  : response.status === 503
                    ? 'Publishing is temporarily unavailable.'
                    : 'The platform could not be retried safely.';
          throw new Error(failureMessage);
        }
        const responseBody = (await response.json()) as unknown;
        const responseRecord =
          responseBody && typeof responseBody === 'object' && !Array.isArray(responseBody)
            ? (responseBody as Record<string, unknown>)
            : {};
        if (typeof responseRecord.error === 'string' && responseRecord.error.trim()) {
          failureMessage = responseRecord.error;
        }

        const job = isDurablePublicationJob(responseRecord.job) ? responseRecord.job : undefined;
        if (
          !job ||
          job.id !== originalJob.id ||
          job.entryId !== entry.id ||
          job.entryRevision !== entry.contentRevision ||
          !job.results.some((result) => result.platform === platform)
        ) {
          throw new Error('Publication retry response identity mismatch.');
        }

        applyProjection((current) =>
          applyDurablePublicationJob({ ...current, publicationStateAvailable: true }, job),
        );
        appendAudit({
          user: currentUser,
          entryId: id,
          action: 'entry-publication-platform-retry',
          meta: { jobId: originalJob.id, platform },
        });
        return;
      } catch (error) {
        if (!requestDispatched) throw error;

        let durableJob: DurablePublicationJob | null = null;
        try {
          const latestJob = await SUPABASE_API.fetchLatestPublicationJob(entry.id);
          if (
            latestJob?.id === originalJob.id &&
            latestJob.entryId === entry.id &&
            latestJob.entryRevision === entry.contentRevision
          ) {
            durableJob = latestJob;
          }
        } catch {
          // The fail-closed projection below prevents another browser retry.
        }

        if (durableJob) {
          applyProjection((current) =>
            applyDurablePublicationJob({ ...current, publicationStateAvailable: true }, durableJob),
          );
          const selectedResult = durableJob.results.find((result) => result.platform === platform);
          if (
            selectedResult?.status === 'published' ||
            selectedResult?.status === 'pending' ||
            selectedResult?.status === 'publishing'
          ) {
            return;
          }
          failureMessage =
            selectedResult?.status === 'unknown'
              ? 'The provider may have received this post. Check the platform before taking any further action.'
              : failureMessage;
        } else {
          applyProjection((current) => ({
            ...current,
            publicationStateAvailable: false,
            publishStatus: {
              ...current.publishStatus,
              [platform]: {
                status: 'unknown',
                url: null,
                error:
                  'Publishing state could not be verified. Check the platform before taking any further action.',
                timestamp,
              },
            },
          }));
          failureMessage =
            'Publishing state could not be verified. Check the platform before taking any further action.';
        }

        appendAudit({
          user: currentUser,
          entryId: id,
          action: 'entry-publication-platform-retry',
          meta: { jobId: originalJob.id, platform, outcome: 'unconfirmed' },
        });
        throw new Error(failureMessage);
      }
    },
    [entries, currentUser],
  );

  const handlePostAgain = useCallback(
    (id: string) => {
      const original = entries.find((e) => e.id === id);
      if (!original) return;

      const newId = uuid();
      const today = new Date().toISOString().split('T')[0];
      const cloned = {
        ...sanitizeEntry(original),
        id: newId,
        date: today,
        status: 'Pending',
        workflowStatus: 'Draft',
        approvedAt: null,
        contentRevision: 1,
        approvedRevision: null,
        publishStatus: {},
        publishedAt: null,
        variantOfId: original.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _isNew: true,
      };
      (cloned as Record<string, unknown>).statusDetail = computeStatusDetail(cloned);
      setEntries((prev) => [...prev, cloned]);
      setViewingId(newId);
      setViewingSnapshot(cloned);

      appendAudit({
        user: currentUser,
        entryId: newId,
        action: 'entry-post-again',
        meta: { originalEntryId: original.id },
      });
    },
    [entries, currentUser],
  );

  const handleToggleEvergreen = useCallback(
    (id: string) => {
      const timestamp = new Date().toISOString();
      setEntries((prev) =>
        prev.map((entry) => {
          if (entry.id !== id) return entry;
          return {
            ...entry,
            evergreen: !entry.evergreen,
            updatedAt: timestamp,
          };
        }),
      );

      const entry = entries.find((e) => e.id === id);
      if (entry) {
        runSyncTask(
          `Toggle evergreen (${id})`,
          () =>
            SUPABASE_API.saveEntry(
              { ...entry, evergreen: !entry.evergreen },
              currentUserEmail || currentUser || '',
            ),
          { requiresApi: false },
        );
      }
    },
    [entries, currentUser, currentUserEmail, runSyncTask],
  );

  const handleEntryDateChange = useCallback(
    (id: string, newDate: string) => {
      const timestamp = new Date().toISOString();
      setEntries((prev) =>
        prev.map((entry) => {
          if (entry.id !== id) return entry;
          return { ...entry, date: newDate, updatedAt: timestamp };
        }),
      );

      {
        const dateEntry = entries.find((e) => e.id === id);
        runSyncTask(
          `Change date (${id})`,
          () =>
            SUPABASE_API.saveEntry(
              { ...dateEntry, id, date: newDate },
              currentUserEmail || currentUser || '',
            ),
          { requiresApi: false },
        );
      }

      appendAudit({
        user: currentUser,
        entryId: id,
        action: 'entry-date-changed',
        meta: { newDate },
      });
    },
    [entries, currentUser, currentUserEmail, runSyncTask],
  );

  const handleBulkDateShift = useCallback(
    (entryIds: string[], daysDelta: number) => {
      const timestamp = new Date().toISOString();
      const shiftDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const d = new Date(year, month - 1, day);
        d.setDate(d.getDate() + daysDelta);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
      };

      const entryIdSet = new Set(entryIds);

      const originalDates = new Map<string, string>();
      entries.forEach((e) => {
        if (entryIdSet.has(e.id as string)) {
          originalDates.set(e.id as string, e.date as string);
        }
      });

      setEntries((prev) =>
        prev.map((entry) => {
          if (!entryIdSet.has(entry.id as string)) return entry;
          return {
            ...entry,
            date: shiftDate(entry.date as string),
            updatedAt: timestamp,
          };
        }),
      );

      {
        originalDates.forEach((originalDate, entryId) => {
          const shiftEntry = entries.find((e) => e.id === entryId);
          runSyncTask(
            `Shift date (${entryId})`,
            () =>
              SUPABASE_API.saveEntry(
                { ...shiftEntry, id: entryId, date: shiftDate(originalDate) },
                currentUserEmail || currentUser || '',
              ),
            { requiresApi: false },
          );
        });
      }

      appendAudit({
        user: currentUser,
        action: 'bulk-date-shift',
        meta: { entryIds, daysDelta },
      });
    },
    [entries, currentUser, currentUserEmail, runSyncTask],
  );

  const updateWorkflowStatus = useCallback(
    (id: string, nextStatus: string) => {
      if (!(KANBAN_STATUSES as readonly string[]).includes(nextStatus)) return;
      const timestamp = new Date().toISOString();
      const syncedStatus =
        nextStatus === 'Approved' || nextStatus === 'Published' ? 'Approved' : 'Pending';
      setEntries((prev) =>
        prev.map((entry) => {
          if (entry.id !== id) return entry;
          const sanitized = sanitizeEntry({
            ...entry,
            workflowStatus: nextStatus,
            status: syncedStatus,
            approvedAt:
              syncedStatus === 'Approved' && !entry.approvedAt ? timestamp : entry.approvedAt,
            approvedRevision:
              nextStatus === 'Approved'
                ? entry.contentRevision || 1
                : nextStatus === 'Published'
                  ? entry.approvedRevision
                  : null,
            updatedAt: timestamp,
          });
          return {
            ...sanitized,
            statusDetail: computeStatusDetail(sanitized),
          };
        }),
      );
      const workflowEntry = entries.find((e) => e.id === id);
      try {
        runSyncTask(
          `Update workflow (${id})`,
          () =>
            SUPABASE_API.saveEntry(
              {
                ...workflowEntry,
                id,
                workflowStatus: nextStatus,
                status: syncedStatus,
                approvedAt: syncedStatus === 'Approved' ? timestamp : workflowEntry?.approvedAt,
              },
              currentUserEmail || currentUser || '',
            ),
          { requiresApi: false },
        ).then((ok: unknown) => {
          if (ok) refreshEntries();
        });
      } catch {
        /* sync failure handled by queue */
      }
      appendAudit({
        user: currentUser,
        entryId: id,
        action: 'entry-workflow',
        meta: { to: nextStatus },
      });
    },
    [currentUser, currentUserEmail, runSyncTask, refreshEntries],
  );

  const softDelete = useCallback(
    (id: string) => {
      const timestamp = new Date().toISOString();
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === id ? { ...entry, deletedAt: timestamp, updatedAt: timestamp } : entry,
        ),
      );
      if (viewingId === id) closeEntry();
      try {
        runSyncTask(`Delete entry (${id})`, () => SUPABASE_API.deleteEntry(id), {
          requiresApi: false,
        }).then((ok: unknown) => {
          if (ok) refreshEntries();
        });
      } catch {
        /* sync failure handled by queue */
      }
      appendAudit({
        user: currentUser,
        entryId: id,
        action: 'entry-delete-soft',
      });
    },
    [currentUser, viewingId, closeEntry, runSyncTask, refreshEntries],
  );

  const restore = useCallback(
    (id: string) => {
      const timestamp = new Date().toISOString();
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === id ? { ...entry, deletedAt: undefined, updatedAt: timestamp } : entry,
        ),
      );
      try {
        runSyncTask(`Restore entry (${id})`, () => SUPABASE_API.restoreEntry(id), {
          requiresApi: false,
        }).then((ok: unknown) => {
          if (ok) refreshEntries();
        });
      } catch {
        /* sync failure handled by queue */
      }
      appendAudit({ user: currentUser, entryId: id, action: 'entry-restore' });
    },
    [currentUser, runSyncTask, refreshEntries],
  );

  const hardDelete = useCallback(
    (id: string) => {
      const confirmed = window.confirm('Delete this item permanently? This cannot be undone.');
      if (!confirmed) return;
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      if (viewingId === id) closeEntry();
      try {
        runSyncTask(`Delete entry permanently (${id})`, () => SUPABASE_API.hardDeleteEntry(id), {
          requiresApi: false,
        }).then((ok: unknown) => {
          if (ok) refreshEntries();
        });
      } catch {
        /* sync failure handled by queue */
      }
      appendAudit({
        user: currentUser,
        entryId: id,
        action: 'entry-delete-hard',
      });
    },
    [currentUser, viewingId, closeEntry, runSyncTask, refreshEntries],
  );

  const trashed = useMemo(
    () =>
      entries
        .filter((entry) => entry.deletedAt)
        .sort((a, b) =>
          ((b.deletedAt as string) || '').localeCompare((a.deletedAt as string) || ''),
        ),
    [entries],
  );

  const previewEntry = useMemo(
    () => entries.find((entry) => entry.id === previewEntryId) || null,
    [entries, previewEntryId],
  );
  const previewIsReviewMode = Boolean(previewEntry && previewEntryContext === 'calendar');
  const previewCanApprove =
    previewIsReviewMode && previewEntry ? viewerIsApprover(previewEntry) : false;

  const reset = useCallback(() => {
    setEntries([]);
    setViewingId(null);
    setViewingSnapshot(null);
    setPreviewEntryId('');
    setPreviewEntryContext('default');
    setDeepLinkEntryId('');
  }, []);

  return {
    entries,
    setEntries,
    viewingId,
    setViewingId,
    viewingSnapshot,
    setViewingSnapshot,
    previewEntryId,
    setPreviewEntryId,
    previewEntryContext,
    setPreviewEntryContext,
    previewEntry,
    previewIsReviewMode,
    previewCanApprove,
    deepLinkEntryId,
    setDeepLinkEntryId,
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
    handleRetryPublicationPlatform,
    handlePostAgain,
    handleToggleEvergreen,
    handleEntryDateChange,
    handleBulkDateShift,
    updateWorkflowStatus,
    softDelete,
    restore,
    hardDelete,
    trashed,
    reset,
  };
}
