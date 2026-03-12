import { useState, useCallback, useMemo, useEffect } from 'react';
import { uuid, ensurePeopleArray, escapeHtml } from '../../lib/utils';
import { notificationKey, loadNotifications, saveNotifications } from '../../lib/notifications';
import { entryDescriptor, entryReviewLink } from '../../lib/email';
import { SUPABASE_API } from '../../lib/supabase';

interface UseNotificationsDeps {
  currentUser: string;
  runSyncTask: (
    label: string,
    action: () => Promise<unknown>,
    opts?: Record<string, unknown>,
  ) => Promise<boolean>;
  apiPost: (url: string, body: unknown) => Promise<unknown>;
}

interface NotificationItem {
  id?: string;
  key?: string;
  entryId?: string;
  user?: string;
  type?: string;
  message?: string;
  createdAt?: string;
  read?: boolean;
  meta?: Record<string, unknown>;
}

interface EntryLike {
  id: string;
  caption?: string;
  assetType?: string;
  date?: string;
  approvers?: string[];
  author?: string;
  [key: string]: unknown;
}

interface CommentLike {
  id?: string;
  body?: string;
  author?: string;
  createdAt?: string;
}

export function useNotifications({ currentUser, runSyncTask, apiPost }: UseNotificationsDeps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => loadNotifications());

  // Persist to localStorage
  useEffect(() => {
    saveNotifications(notifications);
  }, [notifications]);

  const notifyViaServer = useCallback(
    (payload: Record<string, unknown>, label = 'Send notification') => {
      if (typeof window === 'undefined' || !payload) return;
      const action = async () => {
        if (
          window.api &&
          (window.api as Record<string, unknown>).enabled &&
          (window.api as Record<string, unknown>).notify
        ) {
          return (window.api as Record<string, (...args: unknown[]) => Promise<unknown>>).notify(
            payload,
          );
        }
        return SUPABASE_API.sendNotification(payload);
      };
      runSyncTask(label, action, { requiresApi: false });
    },
    [runSyncTask],
  );

  const addNotifications = useCallback((items: NotificationItem[] = []) => {
    if (!items || !items.length) return;
    const resolveNotificationKey = (item: NotificationItem) => {
      if (typeof item.key === 'string' && item.key.length > 0) return item.key;
      if (!item.type || !item.entryId || !item.user) return undefined;
      return notificationKey(item.type, item.entryId, item.user, item.meta);
    };
    setNotifications((prev) => {
      const existing = new Set(prev.map((item) => resolveNotificationKey(item)).filter(Boolean));
      const additions = items
        .map((item) => {
          const key = resolveNotificationKey(item);
          return {
            id: uuid(),
            entryId: item.entryId,
            user: item.user,
            type: item.type,
            message: item.message,
            createdAt: item.createdAt || new Date().toISOString(),
            read: false,
            meta: item.meta || {},
            key,
          };
        })
        .filter(
          (item) =>
            item.entryId &&
            item.user &&
            item.type &&
            item.message &&
            typeof item.key === 'string' &&
            !existing.has(item.key),
        );
      if (!additions.length) return prev;
      return [...additions, ...prev];
    });
  }, []);

  const markNotificationsAsReadForEntry = useCallback(
    (entryId: string, user = currentUser) => {
      if (!entryId || !user) return;
      setNotifications((prev) =>
        prev.map((item) =>
          item.entryId === entryId && item.user === user && !item.read
            ? { ...item, read: true }
            : item,
        ),
      );
    },
    [currentUser],
  );

  const buildApprovalNotifications = useCallback((entry: EntryLike, names?: string[]) => {
    const approvers = names ? names : ensurePeopleArray(entry.approvers);
    if (!approvers.length) return [];
    const descriptor =
      entry.caption && entry.caption.trim().length
        ? entry.caption.trim()
        : `${entry.assetType} on ${new Date(entry.date || '').toLocaleDateString()}`;
    const timestamp = new Date().toISOString();
    return approvers.map((user: string) => ({
      entryId: entry.id,
      user,
      type: 'approval-assigned',
      message: `${descriptor} is awaiting your approval.`,
      createdAt: timestamp,
      meta: { source: 'approval' },
      key: notificationKey('approval-assigned', entry.id, user),
    }));
  }, []);

  const buildMentionNotifications = useCallback(
    (entry: EntryLike, comment: CommentLike, mentionNames: string[]) => {
      if (!mentionNames || !mentionNames.length) return [];
      const descriptor =
        entry.caption && entry.caption.trim().length
          ? entry.caption.trim()
          : `${entry.assetType} on ${new Date(entry.date || '').toLocaleDateString()}`;
      const author = comment.author || 'A teammate';
      const timestamp = comment.createdAt || new Date().toISOString();
      return mentionNames
        .filter(
          (user: string) => user && user.trim() && user.trim() !== (comment.author || '').trim(),
        )
        .map((user: string) => ({
          entryId: entry.id,
          user,
          type: 'mention',
          message: `${author} mentioned you on "${descriptor}".`,
          createdAt: timestamp,
          meta: { commentId: comment.id },
          key: notificationKey('mention', entry.id, user, { commentId: comment.id }),
        }));
    },
    [],
  );

  const handleMentionNotifications = useCallback(
    ({
      entry,
      comment,
      mentionNames,
    }: {
      entry: EntryLike;
      comment: CommentLike;
      mentionNames: string[];
    }) => {
      if (!entry || !comment) return;
      const payload = buildMentionNotifications(entry, comment, mentionNames);
      if (payload.length) addNotifications(payload);
    },
    [buildMentionNotifications, addNotifications],
  );

  const handleCommentActivity = useCallback(
    ({ entry, comment }: { entry: EntryLike; comment: CommentLike }) => {
      if (!entry || !comment) return;
      const approvers = ensurePeopleArray(entry.approvers);
      const authorNames = ensurePeopleArray(entry.author);
      const actorName = comment.author || currentUser || 'Unknown';
      const normalizedActor = actorName ? actorName.trim().toLowerCase() : '';
      const recipients = new Set<string>();
      const addRecipientsFrom = (list: string[]) => {
        list.forEach((name: string) => {
          const trimmed = (name || '').trim();
          if (!trimmed) return;
          if (normalizedActor && trimmed.toLowerCase() === normalizedActor) return;
          recipients.add(trimmed);
        });
      };
      const actorIsApprover = approvers.some(
        (name: string) => (name || '').trim().toLowerCase() === normalizedActor,
      );
      const actorIsAuthor = authorNames.some(
        (name: string) => (name || '').trim().toLowerCase() === normalizedActor,
      );
      if (actorIsApprover) {
        addRecipientsFrom(authorNames.length ? authorNames : approvers);
      } else if (actorIsAuthor) {
        addRecipientsFrom(approvers);
      } else {
        addRecipientsFrom([...authorNames, ...approvers]);
      }
      if (!recipients.size) return;
      const descriptor = entryDescriptor(entry);
      const timestamp = new Date().toISOString();
      addNotifications(
        Array.from(recipients).map((user) => ({
          entryId: entry.id,
          user,
          type: 'comment',
          message: `${actorName} commented on ${descriptor}.`,
          createdAt: timestamp,
          meta: { commentId: comment.id, source: 'comment' },
          key: notificationKey('comment', entry.id, user, { commentId: comment.id }),
        })),
      );
      try {
        const link = entryReviewLink(entry);
        const rawSnippet = comment.body || '';
        const snippet = rawSnippet.length > 600 ? `${rawSnippet.slice(0, 600)}…` : rawSnippet;
        const textParts = [
          `${actorName} commented on "${descriptor}".`,
          snippet ? snippet : '',
          link ? `Review: ${link}` : '',
        ].filter(Boolean);
        const text = textParts.join('\n\n');
        const htmlSnippet = snippet ? escapeHtml(snippet).replace(/\n/g, '<br />') : '';
        const html = `
          <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; color:#0f172a;">
            <p><strong>${escapeHtml(actorName)}</strong> commented on <strong>${escapeHtml(
              descriptor,
            )}</strong>.</p>
            ${
              htmlSnippet
                ? `<blockquote style="margin:12px 0; padding:12px; background:#f1f5f9; border-left:3px solid #0A66C2;">${htmlSnippet}</blockquote>`
                : ''
            }
            ${
              link
                ? `<p style="margin:0;"><a href="${escapeHtml(
                    link,
                  )}" style="color:#0A66C2; text-decoration:none;">Review this entry</a></p>`
                : ''
            }
          </div>
        `.trim();
        notifyViaServer(
          {
            approvers: Array.from(recipients),
            to: Array.from(recipients),
            subject: `[PM Dashboard] New comment on ${descriptor}`,
            text,
            html,
          },
          `Send comment alert (${entry.id})`,
        );
      } catch {
        /* email notification is best-effort */
      }
    },
    [currentUser, addNotifications, notifyViaServer],
  );

  const notifyApproversAboutChange = useCallback(
    (entry: EntryLike) => {
      if (!entry) return;
      const approvers = ensurePeopleArray(entry.approvers);
      if (!approvers.length) return;
      const actorName = currentUser || 'A teammate';
      const normalizedActor = actorName.trim().toLowerCase();
      const recipients = approvers
        .map((name: string) => (name || '').trim())
        .filter((name: string) => name && name.toLowerCase() !== normalizedActor);
      if (!recipients.length) return;
      const descriptor = entryDescriptor(entry);
      const timestamp = new Date().toISOString();
      addNotifications(
        recipients.map((user: string) => ({
          entryId: entry.id,
          user,
          type: 'approval-update',
          message: `${actorName} updated ${descriptor}.`,
          createdAt: timestamp,
          meta: { source: 'entry-update' },
          key: notificationKey('approval-update', entry.id, user),
        })),
      );
      try {
        const link = entryReviewLink(entry);
        const textLines = [
          `${actorName} updated "${descriptor}".`,
          link ? `Review: ${link}` : '',
        ].filter(Boolean);
        const text = textLines.join('\n\n');
        const html = `
          <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; color:#0f172a;">
            <p><strong>${escapeHtml(actorName)}</strong> updated <strong>${escapeHtml(
              descriptor,
            )}</strong>.</p>
            ${
              link
                ? `<p style="margin:0;"><a href="${escapeHtml(
                    link,
                  )}" style="color:#0A66C2; text-decoration:none;">Review this entry</a></p>`
                : ''
            }
          </div>
        `.trim();
        notifyViaServer(
          {
            approvers: recipients,
            to: recipients,
            subject: `[PM Dashboard] ${actorName} updated ${descriptor}`,
            text,
            html,
          },
          `Send approval update (${entry.id})`,
        );
      } catch {
        /* email notification is best-effort */
      }
    },
    [currentUser, addNotifications, notifyViaServer],
  );

  // Derived state
  const userNotifications = useMemo(() => {
    if (!currentUser) return [];
    return notifications
      .filter((item) => item.user === currentUser)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [notifications, currentUser]);

  const unreadNotifications = useMemo(
    () => userNotifications.filter((item) => !item.read),
    [userNotifications],
  );

  const unreadMentionsCount = useMemo(
    () => unreadNotifications.filter((item) => item.type === 'mention').length,
    [unreadNotifications],
  );

  const reset = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    setNotifications,
    addNotifications,
    markNotificationsAsReadForEntry,
    buildApprovalNotifications,
    buildMentionNotifications,
    handleMentionNotifications,
    handleCommentActivity,
    notifyApproversAboutChange,
    notifyViaServer,
    userNotifications,
    unreadNotifications,
    unreadMentionsCount,
    reset,
  };
}
