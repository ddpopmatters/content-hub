import React from 'react';

const { useState, useMemo, useEffect } = React;

import { uuid, extractMentions } from '../../lib/utils';
import {
  sanitizeEntry,
  ensureComments,
  isImageMedia,
  getPlatformCaption,
} from '../../lib/sanitizers';
import { resolveMentionCandidate, computeMentionState } from '../../lib/mentions';
import { Button, Badge, Modal, Textarea } from '../../components/ui';
import { MentionSuggestionList, PlatformIcon } from '../../components/common';
import { SocialPreview } from '../social';

export function EntryPreviewModal({
  open,
  entry,
  onClose,
  onEdit,
  currentUser = '',
  currentUserEmail = '',
  reviewMode = false,
  canApprove = false,
  onApprove,
  onUpdate,
  onNotifyMentions,
  onCommentAdded,
  approverOptions = [],
  users = [],
}) {
  const sanitized = useMemo(() => (entry ? sanitizeEntry(entry) : null), [entry]);
  const [commentDraft, setCommentDraft] = useState('');
  const [mentionState, setMentionState] = useState(null);
  useEffect(() => {
    if (!open) {
      setCommentDraft('');
      setMentionState(null);
    }
  }, [open, entry?.id]);
  if (!open || !sanitized) return null;
  const plannedPlatforms = sanitized.platforms.length ? sanitized.platforms : ['Main'];
  const defaultPreviewPlatformCandidate =
    plannedPlatforms.find((name) => name && name !== 'Main') || null;
  const defaultPreviewPlatform =
    defaultPreviewPlatformCandidate ||
    (plannedPlatforms[0] && plannedPlatforms[0] !== 'Main' ? plannedPlatforms[0] : 'LinkedIn');
  const previewUrl = sanitized.previewUrl ? sanitized.previewUrl.trim() : '';
  const previewIsImage = isImageMedia(previewUrl);
  const previewIsVideo = previewUrl && /\.(mp4|webm|ogg)$/i.test(previewUrl);
  const friendlyDate = sanitized.date
    ? new Date(sanitized.date).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'No planned date';
  const normalizedCurrent = (currentUser || currentUserEmail || '').trim().toLowerCase();
  const normalizedAuthor = (sanitized.author || '').trim().toLowerCase();
  const canEdit = normalizedAuthor && normalizedCurrent && normalizedAuthor === normalizedCurrent;
  const mentionDirectory = useMemo(() => {
    if (!sanitized) return [];
    const normalizedUserNames = Array.isArray(users)
      ? users
          .map((user) => {
            if (!user) return '';
            if (typeof user === 'string') return user;
            if (user.name && String(user.name).trim().length) return String(user.name).trim();
            if (user.email && String(user.email).trim().length) return String(user.email).trim();
            return '';
          })
          .filter(Boolean)
      : [];
    return Array.from(
      new Set([
        ...approverOptions,
        ...normalizedUserNames,
        ...(sanitized.approvers || []),
        sanitized.author || '',
      ]),
    ).filter(Boolean);
  }, [approverOptions, users, sanitized]);
  const handleCommentChange = (event) => {
    const { value, selectionStart } = event.target;
    setCommentDraft(value);
    const nextState = computeMentionState(value, selectionStart, mentionDirectory);
    setMentionState(nextState);
  };
  const handleMentionSelect = (name) => {
    if (!mentionState || mentionState.start == null || mentionState.end == null) return;
    const before = commentDraft.slice(0, mentionState.start);
    const after = commentDraft.slice(mentionState.end);
    const needsSpace = after && !after.startsWith(' ') ? ' ' : '';
    const nextValue = `${before}@${name}${needsSpace}${after}`;
    setCommentDraft(nextValue);
    setMentionState(null);
  };
  const handleCommentSubmit = (event) => {
    event.preventDefault();
    if (!sanitized || !onUpdate) return;
    const body = commentDraft.trim();
    if (!body) return;
    const rawMentions = extractMentions(body);
    let finalBody = body;
    const resolvedHandles = new Set();
    const mentionNames = new Set();
    rawMentions.forEach((raw) => {
      const candidate = raw.replace(/^@/, '').trim();
      const match = resolveMentionCandidate(candidate, mentionDirectory);
      if (match) {
        const canonical = `@${match}`;
        resolvedHandles.add(canonical);
        mentionNames.add(match);
        finalBody = finalBody.replace(raw, canonical);
      }
    });
    const comment = {
      id: uuid(),
      author: currentUser || 'Unknown',
      body: finalBody,
      createdAt: new Date().toISOString(),
      mentions: Array.from(resolvedHandles),
    };
    const next = sanitizeEntry({
      ...sanitized,
      comments: [...ensureComments(sanitized.comments), comment],
    });
    onUpdate(next);
    setCommentDraft('');
    setMentionState(null);
    if (mentionNames.size && onNotifyMentions) {
      onNotifyMentions({ entry: next, comment, mentionNames: Array.from(mentionNames) });
    }
    if (onCommentAdded) {
      onCommentAdded({ entry: next, comment });
    }
  };
  const mentionSuggestions = mentionState?.suggestions || [];
  const reviewEnabled = Boolean(reviewMode);
  const allowApproveAction = reviewEnabled && canApprove;
  const allowCommenting = reviewEnabled && canApprove && Boolean(onUpdate);
  const platformIcons = Array.from(
    new Set(
      plannedPlatforms
        .map((platform) => (platform === 'Main' ? defaultPreviewPlatform : platform))
        .filter(Boolean),
    ),
  );
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex h-full max-h-[80vh] flex-col bg-white">
        <div className="flex items-center justify-between border-b border-graystone-200 px-6 py-4">
          <div className="heading-font text-lg font-semibold text-ocean-900">
            Content planned by {sanitized.author || 'Unknown'} for {friendlyDate}
          </div>
          <Badge variant={sanitized.status === 'Approved' ? 'solid' : 'outline'}>
            {sanitized.status}
          </Badge>
        </div>
        <div className="border-b border-graystone-100 px-6 py-3">
          <div className="text-xs uppercase tracking-wide text-graystone-500">Platforms</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {platformIcons.map((platform) => (
              <span
                key={`${sanitized.id}-${platform}`}
                className="inline-flex items-center gap-2 rounded-full border border-graystone-200 bg-graystone-50 px-3 py-1 text-sm font-semibold text-graystone-700"
              >
                <PlatformIcon platform={platform} />
                {platform}
              </span>
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            {plannedPlatforms.map((platform) => {
              const previewPlatformName = platform === 'Main' ? defaultPreviewPlatform : platform;
              const captionForPlatform = getPlatformCaption(
                sanitized.caption,
                sanitized.platformCaptions,
                platform,
              );
              return (
                <div
                  key={platform}
                  className="rounded-3xl border border-graystone-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ocean-700">
                    <PlatformIcon platform={previewPlatformName} />
                    {platform === 'Main' ? previewPlatformName : platform}
                  </div>
                  <SocialPreview
                    platform={previewPlatformName}
                    caption={captionForPlatform}
                    mediaUrl={previewUrl}
                    isImage={previewIsImage}
                    isVideo={previewIsVideo}
                  />
                </div>
              );
            })}
          </div>
          {allowCommenting ? (
            <div className="space-y-2 rounded-3xl border border-aqua-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-ocean-800">Leave a comment</div>
              <form onSubmit={handleCommentSubmit} className="space-y-2">
                <Textarea
                  value={commentDraft}
                  onChange={handleCommentChange}
                  rows={3}
                  placeholder="Share feedback or @mention an approver"
                />
                <div className="relative">
                  <MentionSuggestionList
                    suggestions={mentionSuggestions}
                    onSelect={handleMentionSelect}
                  />
                </div>
                <div className="flex items-center justify-end">
                  <Button type="submit" disabled={!commentDraft.trim()}>
                    Add comment
                  </Button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-graystone-200 bg-graystone-50 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {allowApproveAction ? (
              <Button variant="outline" onClick={() => onApprove?.(sanitized.id)}>
                {sanitized.status === 'Approved' ? 'Mark as pending' : 'Mark as approved'}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {canEdit ? <Button onClick={() => onEdit?.(sanitized.id)}>Edit entry</Button> : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}
