import { useState, useCallback, useMemo, useEffect } from 'react';
import { uuid, ensurePeopleArray } from '../../lib/utils';
import {
  sanitizeEntry,
  computeStatusDetail,
  createEmptyChecklist,
  entrySignature,
  getWorkflowBlockers,
  hasApproverRelevantChanges,
} from '../../lib/sanitizers';
import { buildEntryEmailPayload } from '../../lib/email';
import { appendAudit } from '../../lib/audit';
import { loadEntries, saveEntries } from '../../lib/storage';
import { SUPABASE_API } from '../../lib/supabase';
import { triggerPublish, initializePublishStatus, canPublish } from '../../features/publishing';
import { KANBAN_STATUSES } from '../../constants';
import type { Entry } from '../../types/models';

interface UseEntriesDeps {
  runSyncTask: (label: string, fn: () => Promise<unknown>) => Promise<unknown>;
  pushSyncToast: (message: string, variant?: string) => void;
  currentUser: string;
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
  publishSettings: Record<string, unknown>;
  authStatus: string;
  onEntryCreated?: (entry: Record<string, unknown>) => void;
}

export function useEntries({
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
  onEntryCreated,
}: UseEntriesDeps) {
  const [entries, setEntries] = useState<Record<string, unknown>[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingSnapshot, setViewingSnapshot] = useState<Record<string, unknown> | null>(null);
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
    setEntries(loadEntries());
  }, []);

  const refreshEntries = useCallback(() => {
    SUPABASE_API.fetchEntries()
      .then((payload: unknown) => Array.isArray(payload) && setEntries(payload))
      .catch(() => pushSyncToast('Unable to refresh entries from the server.', 'warning'));
  }, [pushSyncToast]);

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
            : `${entry.assetType || 'Asset'} on ${new Date(entry.date as string).toLocaleDateString()}`;
        addNotifications(buildApprovalNotifications(entry));
        const entryApprovers = ensurePeopleArray(entry.approvers);
        const shouldEmailApprovers =
          entryApprovers.length || (guidelines as Record<string, unknown>)?.teamsWebhookUrl;
        if (shouldEmailApprovers) {
          try {
            const requesterName = currentUser || entry.author || 'A teammate';
            const emailPayload = buildEntryEmailPayload(entry);
            const fallbackSubject = `[PM Dashboard] Approval requested: ${descriptor}`;
            const fallbackText = `${requesterName} requested your approval for ${descriptor} scheduled ${new Date(
              entry.date as string,
            ).toLocaleDateString()}.`;
            notifyViaServer(
              {
                teamsWebhookUrl: (guidelines as Record<string, unknown>)?.teamsWebhookUrl,
                message: `${requesterName} requested approval for entry ${entry.id}`,
                approvers: entryApprovers,
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
          const payload = {
            id: entry.id,
            date: entry.date,
            platforms: entry.platforms,
            assetType: entry.assetType,
            caption: entry.caption,
            platformCaptions: entry.platformCaptions,
            firstComment: entry.firstComment,
            audienceSegments: entry.audienceSegments,
            goldenThreadPass: entry.goldenThreadPass,
            assessmentScores: entry.assessmentScores,
            influencerId: entry.influencerId,
            status: entry.status,
            priorityTier: entry.priorityTier,
            approvers: entry.approvers,
            author: entry.author || currentUser || 'Unknown',
            campaign: entry.campaign,
            contentPillar: entry.contentPillar,
            previewUrl: entry.previewUrl,
            script: entry.script,
            designCopy: entry.designCopy,
            carouselSlides: entry.carouselSlides,
            url: entry.url,
            approvalDeadline: entry.approvalDeadline,
            checklist: entry.checklist,
            analytics: entry.analytics,
            workflowStatus: entry.workflowStatus,
            statusDetail: entry.statusDetail,
            aiFlags: entry.aiFlags,
            aiScore: entry.aiScore,
            testingFrameworkId: entry.testingFrameworkId,
            testingFrameworkName: entry.testingFrameworkName,
            user: currentUser,
          };
          runSyncTask(`Create entry (${entry.id})`, () =>
            SUPABASE_API.saveEntry(entry as Partial<Entry>, currentUser || ''),
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
      pushSyncToast('Entry cloned - select a date to schedule', 'success');

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
      let approvalNotifications: Record<string, unknown>[] = [];
      const pendingApproverAlerts: Record<string, unknown>[] = [];
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
                const previousApprovers = ensurePeopleArray(entry.approvers);
                const nextApprovers = ensurePeopleArray(sanitized.approvers);
                const newApprovers = nextApprovers.filter(
                  (name: string) => name && !previousApprovers.includes(name),
                );
                if (newApprovers.length) {
                  approvalNotifications = approvalNotifications.concat(
                    buildApprovalNotifications(
                      sanitized as unknown as Record<string, unknown>,
                      newApprovers,
                    ),
                  );
                }
                const actorIsApprover = normalizedActor
                  ? nextApprovers.some(
                      (name: string) => (name || '').trim().toLowerCase() === normalizedActor,
                    )
                  : false;
                if (
                  hasApproverRelevantChanges(entry, sanitized) &&
                  nextApprovers.length &&
                  !actorIsApprover
                ) {
                  pendingApproverAlerts.push(sanitized as unknown as Record<string, unknown>);
                }
                return {
                  ...sanitized,
                  statusDetail: computeStatusDetail(sanitized),
                };
              })()
            : entry,
        ),
      );
      if (approvalNotifications.length) {
        addNotifications(approvalNotifications);
      }
      if (pendingApproverAlerts.length) {
        pendingApproverAlerts.forEach((entry) => notifyApproversAboutChange(entry));
      }
      if (updated?.id) {
        const existingEntry = entries.find((e) => e.id === updated.id);
        const isNewEntry = existingEntry?._isNew;

        try {
          const payload = { ...updated } as Record<string, unknown>;
          delete payload.id;
          delete payload._isNew;
          delete payload._sourceIdeaId;

          if (isNewEntry) {
            runSyncTask(`Create entry (${updated.id})`, () =>
              SUPABASE_API.saveEntry(updated as Partial<Entry>, currentUser || ''),
            ).then((ok: unknown) => {
              if (ok) {
                setEntries((prev) =>
                  prev.map((e) => (e.id === updated.id ? { ...e, _isNew: undefined } : e)),
                );
                onEntryCreated?.({
                  ...(existingEntry as Record<string, unknown>),
                  ...updated,
                  _isNew: undefined,
                });
                refreshEntries();
              }
            });
          } else {
            runSyncTask(`Update entry (${updated.id})`, () =>
              SUPABASE_API.saveEntry(updated as Partial<Entry>, currentUser || ''),
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
        action: updated?._isNew ? 'entry-create' : 'entry-update',
      });
    },
    [
      currentUser,
      entries,
      addNotifications,
      buildApprovalNotifications,
      notifyApproversAboutChange,
      runSyncTask,
      refreshEntries,
      onEntryCreated,
    ],
  );

  const toggleApprove = useCallback(
    (id: string) => {
      const entryRecord = entries.find((entry) => entry.id === id) || null;
      const approving = entryRecord?.status !== 'Approved';
      const blockers = approving ? getWorkflowBlockers(entryRecord as Partial<Entry>) : [];
      if (approving && blockers.length) {
        pushSyncToast(
          `Approval blocked: ${blockers
            .map((item) => item.label)
            .slice(0, 3)
            .join(', ')}`,
          'warning',
        );
        return;
      }
      const timestamp = new Date().toISOString();
      let nextStatusForServer: string | null = null;
      let nextWorkflowStatusForServer: string | null = null;
      setEntries((prev) =>
        prev.map((entry) => {
          if (entry.id !== id) return entry;
          const toggled = entry.status === 'Approved' ? 'Pending' : 'Approved';
          nextStatusForServer = toggled;
          const updatedEntry = sanitizeEntry({
            ...entry,
            status: toggled,
            approvedAt: toggled === 'Approved' ? timestamp : undefined,
            updatedAt: timestamp,
          });
          const workflowStatus = toggled === 'Approved' ? 'Approved' : 'Ready for Review';
          nextWorkflowStatusForServer = workflowStatus;
          const normalized = {
            ...updatedEntry,
            workflowStatus,
          };
          return {
            ...normalized,
            statusDetail: computeStatusDetail(normalized),
          };
        }),
      );
      if (nextStatusForServer) {
        try {
          runSyncTask(`Update approval (${id})`, () =>
            SUPABASE_API.saveEntry(
              {
                ...entryRecord,
                id,
                status: nextStatusForServer as string,
                workflowStatus: (nextWorkflowStatusForServer ?? undefined) as string | undefined,
                approvedAt: nextStatusForServer === 'Approved' ? timestamp : undefined,
              },
              currentUser || '',
            ),
          ).then((ok: unknown) => {
            if (ok) refreshEntries();
          });
        } catch {
          /* sync failure handled by queue */
        }
      }
      appendAudit({
        user: currentUser,
        entryId: id,
        action: nextStatusForServer === 'Approved' ? 'entry-approve' : 'entry-unapprove',
      });
      const entryApprovers = ensurePeopleArray(entryRecord?.approvers);
      const descriptor =
        entryRecord && entryRecord.caption && String(entryRecord.caption).trim().length
          ? String(entryRecord.caption).trim()
          : entryRecord
            ? `${entryRecord.assetType || 'Asset'} on ${new Date(entryRecord.date as string).toLocaleDateString()}`
            : `Entry ${id}`;
      const shouldNotify =
        (guidelines as Record<string, unknown>)?.teamsWebhookUrl || entryApprovers.length;
      if (shouldNotify) {
        try {
          const statusMsg = nextStatusForServer === 'Approved' ? 'approved' : 'unapproved';
          const subjectLabel =
            (entryRecord?.campaign as string) ||
            (entryRecord?.contentPillar as string) ||
            (entryRecord?.assetType as string) ||
            `Entry ${id}`;
          const subject = `[PM Dashboard] ${subjectLabel} ${statusMsg}`;
          const summaryParts = [
            `${currentUser} ${statusMsg} entry ${entryRecord?.id || id}`,
            entryRecord?.date
              ? `scheduled for ${new Date(entryRecord.date as string).toLocaleDateString()}`
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
      if (nextStatusForServer === 'Approved' && requestorNames.length) {
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
    [entries, currentUser, guidelines, runSyncTask, refreshEntries, notifyViaServer],
  );

  const handlePublishEntry = useCallback(
    async (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry || !canPublish(entry)) return;

      const newPublishStatus = initializePublishStatus(entry.platforms as string[]);
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, publishStatus: newPublishStatus } : e)),
      );

      const result = await triggerPublish(
        entry,
        publishSettings as unknown as Parameters<typeof triggerPublish>[1],
      );
      const timestamp = new Date().toISOString();

      if ((result as Record<string, unknown>).success) {
        const publishedStatus: Record<string, unknown> = {};
        (entry.platforms as string[]).forEach((platform: string) => {
          publishedStatus[platform] = {
            status: 'published',
            url: null,
            error: null,
            timestamp,
          };
        });

        const updates = {
          publishStatus: publishedStatus,
          workflowStatus: 'Published',
          publishedAt: timestamp,
        };

        setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));

        try {
          await SUPABASE_API.saveEntry({ id, ...updates } as Partial<Entry>, currentUser || '');
        } catch (err) {
          console.error('Failed to persist publish status:', err);
        }
      } else {
        const failedStatus: Record<string, unknown> = {};
        (entry.platforms as string[]).forEach((platform: string) => {
          failedStatus[platform] = {
            status: 'failed',
            url: null,
            error: (result as Record<string, unknown>).error || 'Failed to publish',
            timestamp,
          };
        });

        setEntries((prev) =>
          prev.map((e) => (e.id === id ? { ...e, publishStatus: failedStatus } : e)),
        );

        try {
          await SUPABASE_API.saveEntry(
            { id, publishStatus: failedStatus } as Partial<Entry>,
            currentUser || '',
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
    [entries, publishSettings, currentUser],
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
          return { ...entry, evergreen: !entry.evergreen, updatedAt: timestamp };
        }),
      );

      const entry = entries.find((e) => e.id === id);
      if (entry) {
        runSyncTask(`Toggle evergreen (${id})`, () =>
          SUPABASE_API.saveEntry({ ...entry, evergreen: !entry.evergreen }, currentUser || ''),
        );
      }
    },
    [entries, runSyncTask],
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
        runSyncTask(`Change date (${id})`, () =>
          SUPABASE_API.saveEntry({ ...dateEntry, id, date: newDate }, currentUser || ''),
        );
      }

      appendAudit({
        user: currentUser,
        entryId: id,
        action: 'entry-date-changed',
        meta: { newDate },
      });
    },
    [currentUser, runSyncTask],
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
          return { ...entry, date: shiftDate(entry.date as string), updatedAt: timestamp };
        }),
      );

      {
        originalDates.forEach((originalDate, entryId) => {
          const shiftEntry = entries.find((e) => e.id === entryId);
          runSyncTask(`Shift date (${entryId})`, () =>
            SUPABASE_API.saveEntry(
              { ...shiftEntry, id: entryId, date: shiftDate(originalDate) },
              currentUser || '',
            ),
          );
        });
      }

      appendAudit({
        user: currentUser,
        action: 'bulk-date-shift',
        meta: { entryIds, daysDelta },
      });
    },
    [entries, currentUser, runSyncTask],
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
        runSyncTask(`Update workflow (${id})`, () =>
          SUPABASE_API.saveEntry(
            {
              ...workflowEntry,
              id,
              workflowStatus: nextStatus,
              status: syncedStatus,
              approvedAt: syncedStatus === 'Approved' ? timestamp : workflowEntry?.approvedAt,
            },
            currentUser || '',
          ),
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
    [currentUser, runSyncTask, refreshEntries],
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
        runSyncTask(`Delete entry (${id})`, () => SUPABASE_API.deleteEntry(id)).then(
          (ok: unknown) => {
            if (ok) refreshEntries();
          },
        );
      } catch {
        /* sync failure handled by queue */
      }
      appendAudit({ user: currentUser, entryId: id, action: 'entry-delete-soft' });
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
        runSyncTask(`Restore entry (${id})`, () => SUPABASE_API.restoreEntry(id)).then(
          (ok: unknown) => {
            if (ok) refreshEntries();
          },
        );
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
        runSyncTask(`Delete entry permanently (${id})`, () =>
          SUPABASE_API.hardDeleteEntry(id),
        ).then((ok: unknown) => {
          if (ok) refreshEntries();
        });
      } catch {
        /* sync failure handled by queue */
      }
      appendAudit({ user: currentUser, entryId: id, action: 'entry-delete-hard' });
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
