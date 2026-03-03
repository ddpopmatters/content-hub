import { useState, useCallback, useMemo, useEffect } from 'react';
import { uuid } from '../../lib/utils';
import { appendAudit } from '../../lib/audit';
import { SUPABASE_API } from '../../lib/supabase';
import type { ContentRequest, ContentRequestStatus } from '../../types/models';

interface UseContentRequestsDeps {
  currentUser: string;
  currentUserEmail: string;
  runSyncTask: (
    label: string,
    action: () => Promise<unknown>,
    options?: { requiresApi?: boolean },
  ) => Promise<boolean>;
  pushSyncToast: (message: string, variant?: string) => void;
}

export interface ContentRequestPayload {
  title: string;
  keyMessages: string;
  assetsNeeded: string;
  audienceSegments: string[];
  approvers: string[];
  deadline?: string;
  notes: string;
}

const REVIEWABLE_STATUSES: ContentRequestStatus[] = ['Pending', 'In Progress'];

const STATUS_SORT_ORDER: Record<ContentRequestStatus, number> = {
  Pending: 0,
  'In Progress': 1,
  Converted: 2,
  Declined: 3,
};

const formatListSection = (items: string[]): string => {
  if (!items.length) return '- None specified';
  return items.map((item) => `- ${item}`).join('\n');
};

export const buildGeneratedBrief = (payload: ContentRequestPayload): string => {
  const title = payload.title.trim() || 'Untitled request';
  const keyMessages = payload.keyMessages.trim() || 'No key messages provided.';
  const assetsNeeded = payload.assetsNeeded.trim() || 'No assets specified.';
  const notes = payload.notes.trim() || 'No additional notes.';
  const deadline = payload.deadline?.trim() || 'No deadline specified.';

  return [
    '## Request Title',
    title,
    '',
    '### Key Messages',
    keyMessages,
    '',
    '### Target Audiences',
    formatListSection(payload.audienceSegments),
    '',
    '### Assets Needed',
    assetsNeeded,
    '',
    '### Approvers',
    formatListSection(payload.approvers),
    '',
    '### Deadline',
    deadline,
    '',
    '### Notes',
    notes,
  ].join('\n');
};

export function useContentRequests({
  currentUser,
  currentUserEmail,
  runSyncTask,
  pushSyncToast,
}: UseContentRequestsDeps) {
  const [contentRequests, setContentRequests] = useState<ContentRequest[]>([]);

  const refreshContentRequests = useCallback(() => {
    SUPABASE_API.fetchContentRequests()
      .then((items) => setContentRequests(items))
      .catch(() => pushSyncToast('Unable to refresh content requests.', 'warning'));
  }, [pushSyncToast]);

  useEffect(() => {
    refreshContentRequests();
  }, [refreshContentRequests]);

  const addContentRequest = useCallback(
    (payload: ContentRequestPayload) => {
      const timestamp = new Date().toISOString();
      const createdRequest: ContentRequest = {
        id: uuid(),
        title: payload.title.trim(),
        keyMessages: payload.keyMessages.trim(),
        assetsNeeded: payload.assetsNeeded.trim(),
        audienceSegments: payload.audienceSegments || [],
        approvers: payload.approvers || [],
        deadline: payload.deadline || undefined,
        notes: payload.notes.trim(),
        generatedBrief: buildGeneratedBrief(payload),
        status: 'Pending',
        createdBy: currentUser || 'Unknown',
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      setContentRequests((prev) => [createdRequest, ...prev]);

      runSyncTask(
        `Create content request (${createdRequest.id})`,
        async () => {
          const saved = await SUPABASE_API.createContentRequest(createdRequest, currentUserEmail);
          if (!saved) {
            throw new Error('Unable to create content request');
          }
        },
        { requiresApi: false },
      ).then((ok) => {
        if (ok) refreshContentRequests();
      });

      appendAudit({
        user: currentUser,
        action: 'content-request-create',
        meta: {
          id: createdRequest.id,
          title: createdRequest.title,
        },
      });
    },
    [currentUser, currentUserEmail, refreshContentRequests, runSyncTask],
  );

  const updateContentRequest = useCallback(
    (id: string, updates: Partial<ContentRequest>) => {
      const updatedAt = new Date().toISOString();
      setContentRequests((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates, updatedAt } : item)),
      );

      runSyncTask(
        `Update content request (${id})`,
        async () => {
          const saved = await SUPABASE_API.updateContentRequest(id, updates);
          if (!saved) {
            throw new Error('Unable to update content request');
          }
        },
        { requiresApi: false },
      ).then((ok) => {
        if (ok) refreshContentRequests();
      });
    },
    [refreshContentRequests, runSyncTask],
  );

  const updateContentRequestStatus = useCallback(
    (id: string, status: ContentRequestStatus) => {
      updateContentRequest(id, { status });
      appendAudit({
        user: currentUser,
        action: 'content-request-status-update',
        meta: { id, status },
      });
    },
    [currentUser, updateContentRequest],
  );

  const markContentRequestConverted = useCallback(
    (id: string, convertedEntryId?: string) => {
      updateContentRequest(id, {
        status: 'Converted',
        convertedEntryId: convertedEntryId || undefined,
      });
      appendAudit({
        user: currentUser,
        action: 'content-request-converted',
        meta: { id, convertedEntryId: convertedEntryId || null },
      });
    },
    [currentUser, updateContentRequest],
  );

  const pendingRequests = useMemo(() => {
    return contentRequests
      .filter((request) => REVIEWABLE_STATUSES.includes(request.status))
      .slice()
      .sort((a, b) => {
        const statusDiff = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
        if (statusDiff !== 0) return statusDiff;
        if (!a.deadline && !b.deadline) return b.createdAt.localeCompare(a.createdAt);
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      });
  }, [contentRequests]);

  const reset = useCallback(() => {
    setContentRequests([]);
  }, []);

  return {
    contentRequests,
    setContentRequests,
    pendingRequests,
    addContentRequest,
    updateContentRequest,
    updateContentRequestStatus,
    markContentRequestConverted,
    refreshContentRequests,
    reset,
  };
}
