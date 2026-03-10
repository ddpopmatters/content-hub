import React from 'react';
import { useApi } from '../../hooks/useApi';
import {
  uuid,
  cx,
  ensureArray,
  ensurePeopleArray,
  extractMentions,
  storageAvailable,
  STORAGE_KEYS,
} from '../../lib/utils';
import { selectBaseClasses, fileInputClasses, checklistCheckboxClass } from '../../lib/styles';
import {
  sanitizeEntry,
  ensureChecklist,
  ensureComments,
  ensureAnalytics,
  ensurePlatformCaptions,
  computeStatusDetail,
  getWorkflowBlockers,
  getPlatformCaption,
  isImageMedia,
  determineWorkflowStatus,
  entrySignature,
} from '../../lib/sanitizers';
import { resolveMentionCandidate, computeMentionState } from '../../lib/mentions';
import {
  ALL_PLATFORMS,
  CAMPAIGNS,
  CONTENT_CATEGORIES,
  CTA_TYPES,
  CONTENT_PILLARS,
  DEFAULT_APPROVERS,
  DEFAULT_USERS,
  EXECUTION_STATUSES,
  GOLDEN_THREAD_QUESTIONS,
  getChecklistItemsForEntry,
  KANBAN_STATUSES,
  LINK_PLACEMENTS,
  PRIORITY_TIERS,
  PRIORITY_TIER_BADGE_CLASSES,
  recommendApproversForRoute,
  recommendSignOffRoute,
  RESPONSE_MODES,
  SIGN_OFF_ROUTES,
} from '../../constants';
import {
  Modal,
  Button,
  Input,
  Textarea,
  Toggle,
  Separator,
  FieldRow,
  Badge,
} from '../../components/ui';
import {
  PlatformIcon,
  MentionSuggestionList,
  CopyIcon,
  ArrowUpIcon,
  ArrowPathIcon,
  TrashIcon,
} from '../../components/common';
import { SocialPreview } from '../social';
import { ApproverMulti } from './ApproverMulti';
import { canPublish, canPostAgain } from '../publishing';
import { QuickAssessment, FullAssessment, GoldenThreadCheck } from '../assessment';
import { TerminologyAlert } from './TerminologyAlert';
import { PlatformGuidancePanel } from './PlatformGuidancePanel';
import { checkTerminology } from '../../lib/terminology';

const { useState, useMemo, useEffect, useCallback, useRef } = React;

// Storage key for draft entry auto-save
const DRAFT_ENTRY_STORAGE_KEY = STORAGE_KEYS.DRAFT_ENTRY;
// Auto-save interval in milliseconds (30 seconds)
const DRAFT_AUTO_SAVE_INTERVAL = 30000;

// Default user records for mention directory
const normalizeUserValue = (value) => {
  const base = typeof value === 'string' ? { name: value, email: '' } : value || {};
  const rawName = typeof base.name === 'string' && base.name.trim() ? base.name.trim() : '';
  const rawEmail = typeof base.email === 'string' && base.email.trim() ? base.email.trim() : '';
  const name = rawName || rawEmail || 'Unknown user';
  const id =
    typeof base.id === 'string' && base.id.trim()
      ? base.id.trim()
      : `${name || rawEmail}-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    name,
    email: rawEmail,
    status: base.status || 'active',
  };
};
const DEFAULT_USER_RECORDS = DEFAULT_USERS.map(normalizeUserValue);

export function EntryModal({
  entry,
  currentUser,
  currentUserEmail,
  onClose,
  onApprove,
  onDelete,
  onClone,
  onSave,
  onUpdate,
  onNotifyMentions,
  onCommentAdded,
  onPublish,
  onPostAgain,
  onToggleEvergreen,
  approverOptions = DEFAULT_APPROVERS,
  users = DEFAULT_USER_RECORDS,
}) {
  const sanitizedEntry = useMemo(() => sanitizeEntry(entry), [entry]);
  const [draft, setDraft] = useState(sanitizedEntry);
  const [allPlatforms, setAllPlatforms] = useState(
    sanitizedEntry ? sanitizedEntry.platforms.length === ALL_PLATFORMS.length : false,
  );
  const [commentDraft, setCommentDraft] = useState('');
  const [mentionState, setMentionState] = useState(null);
  const [activeCaptionTab, setActiveCaptionTab] = useState('Main');
  const [activePreviewPlatform, setActivePreviewPlatform] = useState('Main');
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineEntries, setTimelineEntries] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState('');
  const [showDraftRecovery, setShowDraftRecovery] = useState(false);
  const [savedDraftInfo, setSavedDraftInfo] = useState(null);
  const { get: apiGet } = useApi();

  useEffect(() => {
    if (!sanitizedEntry) {
      setDraft(null);
      setAllPlatforms(false);
      setCommentDraft('');
      return;
    }
    setDraft(sanitizedEntry);
    setAllPlatforms(sanitizedEntry.platforms.length === ALL_PLATFORMS.length);
    setCommentDraft('');
    setMentionState(null);
  }, [sanitizedEntry]);

  const terminologyMatches = useMemo(
    () => (draft?.caption ? checkTerminology(draft.caption) : []),
    [draft?.caption],
  );
  const recommendedSignOffRoute = useMemo(
    () =>
      recommendSignOffRoute({
        campaign: draft?.campaign,
        contentCategory: draft?.contentCategory,
        partnerOrg: draft?.partnerOrg,
        responseMode: draft?.responseMode,
      }),
    [draft?.campaign, draft?.contentCategory, draft?.partnerOrg, draft?.responseMode],
  );
  const recommendedApprovers = useMemo(
    () =>
      recommendApproversForRoute(draft?.signOffRoute || recommendedSignOffRoute, approverOptions),
    [approverOptions, draft?.signOffRoute, recommendedSignOffRoute],
  );
  const draftPlatforms = Array.isArray(draft?.platforms) ? draft.platforms : [];
  const draftPlatformsKey = draftPlatforms.join('|');
  const sanitizedSignature = entrySignature(sanitizedEntry);
  const modalReady = Boolean(sanitizedEntry && draft);
  const normalizedViewer = useMemo(() => {
    if (currentUser && currentUser.trim()) return currentUser.trim().toLowerCase();
    if (currentUserEmail && currentUserEmail.trim()) return currentUserEmail.trim().toLowerCase();
    return '';
  }, [currentUser, currentUserEmail]);
  const isApproverView = useMemo(() => {
    if (!normalizedViewer) return false;
    const approvers = ensurePeopleArray(sanitizedEntry?.approvers);
    return approvers.some((name) => (name || '').trim().toLowerCase() === normalizedViewer);
  }, [sanitizedEntry, normalizedViewer]);
  const isAuthorView = useMemo(() => {
    if (!normalizedViewer) return false;
    const normalizedAuthor = (sanitizedEntry?.author || '').trim().toLowerCase();
    if (!normalizedAuthor) return false;
    return normalizedAuthor === normalizedViewer;
  }, [sanitizedEntry, normalizedViewer]);
  const showApproverContent = !isAuthorView || isApproverView;

  useEffect(() => {
    if (!sanitizedEntry) return;
    setActiveCaptionTab('Main');
    setActivePreviewPlatform(sanitizedEntry.platforms[0] || 'Main');
  }, [sanitizedSignature]);

  useEffect(() => {
    if (!draft) return;
    if ((draft.approvers || []).length > 0) return;
    if (!recommendedApprovers.length) return;
    setDraft((prev) => {
      if (!prev || (prev.approvers || []).length > 0) return prev;
      return normalizeEntry({ ...prev, approvers: recommendedApprovers });
    });
  }, [draft, recommendedApprovers]);

  useEffect(() => {
    if (!sanitizedEntry) return;
    setActiveCaptionTab((prevTab) =>
      prevTab === 'Main' || draftPlatforms.includes(prevTab) ? prevTab : 'Main',
    );
    setActivePreviewPlatform((prevPlatform) =>
      draftPlatforms.includes(prevPlatform) ? prevPlatform : draftPlatforms[0] || 'Main',
    );
    setAllPlatforms(draftPlatforms.length === ALL_PLATFORMS.length);
  }, [sanitizedSignature, draftPlatformsKey]);

  useEffect(() => {
    if (!modalReady && timelineOpen) {
      setTimelineOpen(false);
    }
  }, [modalReady, timelineOpen]);

  // Check for saved draft on modal open
  useEffect(() => {
    if (!sanitizedEntry?.id || !storageAvailable) return;
    try {
      const stored = window.localStorage.getItem(DRAFT_ENTRY_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      // Only prompt if draft is for this entry and has meaningful changes
      if (parsed?.entryId === sanitizedEntry.id && parsed?.draft && parsed?.savedAt) {
        setSavedDraftInfo(parsed);
        setShowDraftRecovery(true);
      }
    } catch {
      // Ignore parse errors
    }
  }, [sanitizedEntry?.id]);

  // Ref to hold latest draft for stable auto-save interval
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Auto-save draft to localStorage every 30 seconds (stable interval)
  useEffect(() => {
    if (!sanitizedEntry?.id || !storageAvailable) return;
    const interval = setInterval(() => {
      const currentDraft = draftRef.current;
      if (!currentDraft?.id) return;
      try {
        const draftData = {
          entryId: currentDraft.id,
          draft: currentDraft,
          savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(DRAFT_ENTRY_STORAGE_KEY, JSON.stringify(draftData));
      } catch {
        // Ignore storage errors
      }
    }, DRAFT_AUTO_SAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [sanitizedEntry?.id]); // Only restart interval when entry changes

  // Helper to clear saved draft
  const clearSavedDraft = useCallback(() => {
    if (!storageAvailable) return;
    try {
      window.localStorage.removeItem(DRAFT_ENTRY_STORAGE_KEY);
    } catch {
      // Ignore errors
    }
    setShowDraftRecovery(false);
    setSavedDraftInfo(null);
  }, []);

  // Restore draft from localStorage
  const restoreSavedDraft = useCallback(() => {
    if (savedDraftInfo?.draft) {
      setDraft(savedDraftInfo.draft);
    }
    setShowDraftRecovery(false);
  }, [savedDraftInfo]);

  if (!modalReady) return null;

  const update = (key, value) => {
    setDraft((prev) => {
      if (!prev) return prev;
      if (key === 'platforms') {
        const nextPlatforms = ensureArray(value);
        const allow = new Set(nextPlatforms);
        const nextCaptions = ensurePlatformCaptions(prev.platformCaptions);
        Object.keys(nextCaptions).forEach((platform) => {
          if (!allow.has(platform)) delete nextCaptions[platform];
        });
        const nextAnalytics = ensureAnalytics(prev.analytics);
        Object.keys(nextAnalytics).forEach((platform) => {
          if (!allow.has(platform)) delete nextAnalytics[platform];
        });
        return normalizeEntry({
          ...prev,
          platforms: nextPlatforms,
          platformCaptions: nextCaptions,
          analytics: nextAnalytics,
        });
      }
      return normalizeEntry({ ...prev, [key]: value });
    });
  };

  const normalizeEntry = (raw) => {
    const normalized = {
      ...raw,
      checklist: ensureChecklist(raw.checklist),
      comments: ensureComments(raw.comments),
      previewUrl: raw.previewUrl || '',
      platformCaptions: ensurePlatformCaptions(raw.platformCaptions),
      platforms: ensureArray(Array.isArray(raw.platforms) ? raw.platforms : []),
      analytics: ensureAnalytics(raw.analytics),
      analyticsUpdatedAt:
        typeof raw.analyticsUpdatedAt === 'string'
          ? raw.analyticsUpdatedAt
          : draft && typeof draft.analyticsUpdatedAt === 'string'
            ? draft.analyticsUpdatedAt
            : '',
      priorityTier: PRIORITY_TIERS.includes(raw.priorityTier)
        ? raw.priorityTier
        : PRIORITY_TIERS.includes(draft.priorityTier)
          ? draft.priorityTier
          : 'Medium',
      workflowStatus: KANBAN_STATUSES.includes(raw.workflowStatus)
        ? raw.workflowStatus
        : KANBAN_STATUSES.includes(draft.workflowStatus)
          ? draft.workflowStatus
          : KANBAN_STATUSES[0],
    };
    return {
      ...normalized,
      statusDetail: computeStatusDetail(normalized),
    };
  };

  const handleSave = () => {
    let next = normalizeEntry(draft);
    const computedStatus = determineWorkflowStatus({
      approvers: next.approvers,
      assetType: next.assetType,
      previewUrl: next.previewUrl,
      platforms: next.platforms,
      url: next.url,
      firstComment: next.firstComment,
      altTextStatus: next.altTextStatus,
      subtitlesStatus: next.subtitlesStatus,
      utmStatus: next.utmStatus,
      sourceVerified: next.sourceVerified,
      seoPrimaryQuery: next.seoPrimaryQuery,
      linkPlacement: next.linkPlacement,
      ctaType: next.ctaType,
    });
    next = { ...next, workflowStatus: computedStatus };
    if (next.status === 'Approved') {
      next = normalizeEntry({ ...next, status: 'Pending', approvedAt: undefined });
    }
    clearSavedDraft();
    onSave(next);
    onClose();
  };

  const handleDelete = () => {
    const confirmDelete = window.confirm(
      'Move this item to the trash? You can restore it within 30 days.',
    );
    if (confirmDelete) {
      onDelete(draft.id);
      onClose();
    }
  };

  const handleClone = () => {
    if (!onClone || !draft) return;
    onClone(draft);
    onClose();
  };

  const handleAssetTypeChange = (nextType) => {
    setDraft((prev) => {
      const next = { ...prev, assetType: nextType };
      if (nextType !== 'Video') next.script = undefined;
      if (nextType !== 'Design') next.designCopy = undefined;
      if (nextType !== 'Carousel') {
        next.carouselSlides = undefined;
      } else {
        next.carouselSlides =
          prev.carouselSlides && prev.carouselSlides.length
            ? [...prev.carouselSlides]
            : ['', '', ''];
      }
      return normalizeEntry(next);
    });
  };

  const handleCarouselSlides = (desiredLength) => {
    setDraft((prev) => {
      const current = prev.carouselSlides || [];
      let nextSlides = [...current];
      if (desiredLength > current.length) {
        nextSlides = [...current, ...Array(desiredLength - current.length).fill('')];
      } else if (desiredLength < current.length) {
        nextSlides = current.slice(0, desiredLength);
      }
      return normalizeEntry({ ...prev, carouselSlides: nextSlides });
    });
  };

  const toggleChecklistItem = (key) => {
    setDraft((prev) => {
      const checklist = { ...ensureChecklist(prev.checklist) };
      checklist[key] = !checklist[key];
      const next = normalizeEntry({ ...prev, checklist });
      if (onUpdate) onUpdate(next);
      return next;
    });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      setDraft((prev) => {
        const next = normalizeEntry({ ...prev, previewUrl: url });
        if (onUpdate) onUpdate(next);
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleClearPreview = () => {
    setDraft((prev) => {
      const next = normalizeEntry({ ...prev, previewUrl: '' });
      if (onUpdate) onUpdate(next);
      return next;
    });
  };

  const mentionDirectory = useMemo(() => {
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
        ...(draft?.approvers || []),
        draft?.author || '',
      ]),
    ).filter(Boolean);
  }, [approverOptions, users, draft]);

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
    const body = commentDraft.trim();
    if (!body) return;

    const rawMentions = extractMentions(body);
    let finalBody = body;
    const resolvedHandles = new Set();
    const mentionNames = new Set();

    rawMentions.forEach((raw) => {
      const candidate = raw.replace(/^@/, '').trim();
      if (!candidate) return;
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
    const next = normalizeEntry({
      ...draft,
      comments: [...(draft.comments || []), comment],
    });
    setDraft(next);
    setCommentDraft('');
    setMentionState(null);
    if (onUpdate) onUpdate(next);
    if (onNotifyMentions && mentionNames.size) {
      onNotifyMentions({
        entry: next,
        comment,
        mentionNames: Array.from(mentionNames),
      });
    }
    if (onCommentAdded) {
      onCommentAdded({ entry: next, comment });
    }
  };

  const loadTimeline = useCallback(
    async (entryId) => {
      if (!entryId) return;
      setTimelineLoading(true);
      setTimelineError('');
      try {
        let payload = null;
        if (window.api && typeof window.api.listAudit === 'function') {
          payload = await window.api.listAudit({ entryId, limit: 200 });
        } else {
          payload = await apiGet(`/api/audit?entryId=${encodeURIComponent(entryId)}&limit=200`);
        }
        setTimelineEntries(Array.isArray(payload) ? payload : []);
      } catch (error) {
        console.warn('Failed to load timeline', error);
        setTimelineEntries([]);
        setTimelineError('Unable to load timeline right now.');
      } finally {
        setTimelineLoading(false);
      }
    },
    [apiGet],
  );

  const handleOpenTimeline = () => {
    if (!sanitizedEntry?.id) return;
    setTimelineOpen(true);
    loadTimeline(sanitizedEntry.id);
  };

  const closeTimeline = () => setTimelineOpen(false);

  const formatTimelineAction = (action) => {
    if (!action) return 'Updated entry';
    return action.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const parseTimelineMeta = (meta) => {
    if (!meta) return {};
    if (typeof meta === 'object') return meta;
    try {
      const parsed = JSON.parse(meta);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const highlightMentions = (text) => {
    if (!text) return [text];
    return text.split(/(@[\w\s.&'-]+)/g).map((part, index) => {
      if (!part) return null;
      if (part.startsWith('@')) {
        return (
          <span key={index} className="font-semibold text-ocean-600">
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const previewUrl = draft.previewUrl ? draft.previewUrl.trim() : '';
  const previewIsImage = isImageMedia(previewUrl);
  const previewIsVideo = previewUrl && /\.(mp4|webm|ogg)$/i.test(previewUrl);
  const previewPlatforms = draftPlatforms.length ? draftPlatforms : ['Main'];
  const effectivePreviewPlatform = previewPlatforms.includes(activePreviewPlatform)
    ? activePreviewPlatform
    : previewPlatforms[0] || 'Main';
  const previewCaption = getPlatformCaption(
    draft.caption,
    draft.platformCaptions,
    effectivePreviewPlatform,
  );
  const currentPriorityTier = PRIORITY_TIERS.includes(draft.priorityTier)
    ? draft.priorityTier
    : 'Medium';
  const analyticsByPlatform = ensureAnalytics(draft.analytics);
  const analyticsPlatforms = Object.keys(analyticsByPlatform);
  const formatMetricValue = (value) => {
    if (typeof value === 'number') return value.toLocaleString();
    if (value === null || value === undefined) return '—';
    return String(value);
  };

  const entryChecklistItems = getChecklistItemsForEntry(draft.platforms, draft.assetType);
  const checklistCompleted = entryChecklistItems.filter(
    ({ key }) => ensureChecklist(draft.checklist)[key],
  ).length;
  const checklistTotal = entryChecklistItems.length;
  const workflowBlockers = getWorkflowBlockers(draft);
  const goldenThreadValues = draft.assessmentScores?.goldenThread || {};
  const allGoldenThreadAnswered = GOLDEN_THREAD_QUESTIONS.every(
    (question) => goldenThreadValues[question.key] !== undefined,
  );
  const goldenThreadPassed = GOLDEN_THREAD_QUESTIONS.every(
    (question) => goldenThreadValues[question.key] === false,
  );
  const approvalBlockers = [
    ...workflowBlockers,
    ...(!allGoldenThreadAnswered
      ? [
          {
            key: 'goldenThreadIncomplete',
            label: 'Golden Thread completed',
            detail: 'Answer all four Golden Thread questions before approving this entry.',
          },
        ]
      : goldenThreadPassed
        ? []
        : [
            {
              key: 'goldenThreadFailed',
              label: 'Golden Thread passed',
              detail: 'Revise the flagged Golden Thread issues before approving this entry.',
            },
          ]),
  ];
  const canApproveReadiness = approvalBlockers.length === 0;
  const formatFriendlyDate = (value) => {
    if (!value) return 'Not set';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  const plannedPlatforms = draftPlatforms.length ? draftPlatforms : ['Main'];
  const defaultPreviewPlatformCandidate =
    plannedPlatforms.find((name) => name && name !== 'Main') || null;
  const defaultPreviewPlatform =
    defaultPreviewPlatformCandidate ||
    (plannedPlatforms[0] && plannedPlatforms[0] !== 'Main' ? plannedPlatforms[0] : 'LinkedIn');
  const renderAssetNotes = () => {
    const notes = [];
    if (draft.assetType === 'Video' && typeof draft.script === 'string' && draft.script.trim()) {
      notes.push(
        <div
          key="script"
          className="space-y-2 rounded-2xl border border-graystone-200 bg-white p-4 shadow-sm"
        >
          <div className="text-sm font-semibold text-ocean-800">Script</div>
          <p className="whitespace-pre-wrap text-sm text-graystone-700">{draft.script.trim()}</p>
        </div>,
      );
    }
    if (
      draft.assetType === 'Design' &&
      typeof draft.designCopy === 'string' &&
      draft.designCopy.trim()
    ) {
      notes.push(
        <div
          key="design"
          className="space-y-2 rounded-2xl border border-graystone-200 bg-white p-4 shadow-sm"
        >
          <div className="text-sm font-semibold text-ocean-800">Design copy</div>
          <p className="whitespace-pre-wrap text-sm text-graystone-700">
            {draft.designCopy.trim()}
          </p>
        </div>,
      );
    }
    if (draft.assetType === 'Carousel') {
      const slides = Array.isArray(draft.carouselSlides)
        ? draft.carouselSlides.filter((slide) => slide && slide.trim())
        : [];
      if (slides.length) {
        notes.push(
          <div
            key="carousel"
            className="space-y-2 rounded-2xl border border-graystone-200 bg-white p-4 shadow-sm"
          >
            <div className="text-sm font-semibold text-ocean-800">Carousel copy</div>
            <div className="space-y-2">
              {slides.map((slide, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-graystone-100 bg-graystone-50 px-3 py-2 text-sm text-graystone-700"
                >
                  <div className="text-[11px] uppercase tracking-wide text-graystone-500">
                    Slide {index + 1}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{slide.trim()}</p>
                </div>
              ))}
            </div>
          </div>,
        );
      }
    }
    if (!notes.length) return null;
    return (
      <div className="space-y-3">
        <div className="text-sm font-semibold text-graystone-800">Asset copy</div>
        <div className="space-y-3">{notes}</div>
      </div>
    );
  };

  const mentionSuggestions = mentionState?.suggestions || [];

  const renderApproverContent = () => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-graystone-200 bg-graystone-50 px-4 py-4">
          <div className="text-[11px] uppercase tracking-wide text-graystone-500">Scheduled</div>
          <div className="text-lg font-semibold text-ocean-800">
            {formatFriendlyDate(draft.date)}
          </div>
        </div>
        <div className="rounded-2xl border border-graystone-200 bg-graystone-50 px-4 py-4">
          <div className="text-[11px] uppercase tracking-wide text-graystone-500">
            Approval deadline
          </div>
          <div className="text-lg font-semibold text-ocean-800">
            {draft.approvalDeadline ? formatFriendlyDate(draft.approvalDeadline) : 'Not set'}
          </div>
        </div>
      </div>
      {(draft.contentCategory ||
        draft.responseMode ||
        draft.contentPeak ||
        draft.partnerOrg ||
        draft.seriesName ||
        draft.signOffRoute) && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-graystone-800">Strategy context</div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-graystone-200 bg-graystone-50 px-4 py-4">
              <div className="flex flex-wrap gap-2">
                {draft.contentCategory ? (
                  <Badge variant="outline">{draft.contentCategory}</Badge>
                ) : null}
                {draft.responseMode ? <Badge variant="outline">{draft.responseMode}</Badge> : null}
                {draft.contentPillar ? (
                  <Badge variant="outline">{draft.contentPillar}</Badge>
                ) : null}
                {draft.campaign ? <Badge variant="outline">{draft.campaign}</Badge> : null}
              </div>
              {(draft.seriesName || draft.episodeNumber) && (
                <div className="mt-3 text-sm text-graystone-700">
                  Series: {draft.seriesName || 'Untitled'}{' '}
                  {draft.episodeNumber ? `· Episode ${draft.episodeNumber}` : ''}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-graystone-200 bg-graystone-50 px-4 py-4 text-sm text-graystone-700">
              <div>
                <span className="font-semibold text-graystone-800">Peak:</span>{' '}
                {draft.contentPeak || 'Not set'}
              </div>
              <div className="mt-2">
                <span className="font-semibold text-graystone-800">Partner:</span>{' '}
                {draft.partnerOrg || 'Not set'}
              </div>
              <div className="mt-2">
                <span className="font-semibold text-graystone-800">Sign-off route:</span>{' '}
                {draft.signOffRoute || 'Manual approvers'}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-3">
        <div className="text-sm font-semibold text-graystone-800">Execution readiness</div>
        <div className="rounded-2xl border border-graystone-200 bg-white p-4 shadow-sm">
          {approvalBlockers.length === 0 ? (
            <p className="text-sm text-emerald-700">This entry is ready for review and approval.</p>
          ) : (
            <>
              <p className="text-sm text-amber-700">
                Approval is blocked until the following items are complete.
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-graystone-700">
                {approvalBlockers.map((item) => (
                  <li key={item.key}>
                    <span className="font-medium text-graystone-800">{item.label}:</span>{' '}
                    {item.detail}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-sm font-semibold text-graystone-800">Planned platforms</div>
        <div className="grid gap-4 lg:grid-cols-2">
          {plannedPlatforms.map((platform) => {
            const previewPlatformName = platform === 'Main' ? defaultPreviewPlatform : platform;
            const captionForPlatform = getPlatformCaption(
              draft.caption,
              draft.platformCaptions,
              platform,
            );
            return (
              <div
                key={platform}
                className="space-y-3 rounded-2xl border border-graystone-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between text-sm font-semibold text-ocean-700">
                  <span className="inline-flex items-center gap-2">
                    <PlatformIcon platform={previewPlatformName} />
                    {platform === 'Main' ? 'Main copy' : platform}
                  </span>
                  <span className="text-xs text-graystone-500">
                    {(captionForPlatform || '').length} chars
                  </span>
                </div>
                <SocialPreview
                  platform={previewPlatformName}
                  caption={captionForPlatform}
                  mediaUrl={previewUrl}
                  isImage={previewIsImage}
                  isVideo={previewIsVideo}
                />
                <div className="rounded-2xl bg-graystone-50 px-3 py-2 text-sm text-graystone-700 whitespace-pre-wrap">
                  {captionForPlatform && captionForPlatform.trim().length
                    ? captionForPlatform
                    : 'No caption provided.'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {renderAssetNotes()}
    </div>
  );

  const renderCommentsSection = () => (
    <div className="space-y-3">
      <div className="text-sm font-medium text-graystone-800">Comments</div>
      {draft.comments && draft.comments.length > 0 ? (
        <div className="space-y-3">
          {draft.comments
            .slice()
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .map((comment) => (
              <div
                key={comment.id}
                className="rounded-xl border border-aqua-200 bg-aqua-50 p-3 text-sm text-graystone-800"
              >
                <div className="flex items-center justify-between text-xs text-graystone-500">
                  <span className="font-medium text-graystone-700">{comment.author}</span>
                  <span>{new Date(comment.createdAt).toLocaleString()}</span>
                </div>
                <div className="mt-2 leading-relaxed">{highlightMentions(comment.body)}</div>
              </div>
            ))}
        </div>
      ) : (
        <p className="text-xs text-graystone-500">No comments yet. Use @ to mention teammates.</p>
      )}
      <form onSubmit={handleCommentSubmit} className="space-y-2">
        <Textarea
          value={commentDraft}
          onChange={handleCommentChange}
          rows={3}
          placeholder="Share feedback or mention someone with @"
        />
        <div className="relative">
          <MentionSuggestionList suggestions={mentionSuggestions} onSelect={handleMentionSelect} />
        </div>
        <div className="flex items-center justify-end">
          <Button type="submit" disabled={!commentDraft.trim()}>
            Add comment
          </Button>
        </div>
      </form>
    </div>
  );

  const canEdit = isAuthorView;
  const timelineList = Array.isArray(timelineEntries) ? timelineEntries : [];

  return (
    <>
      <Modal open={modalReady} onClose={onClose}>
        <div className="bg-white">
          <div className="flex items-center justify-between border-b border-aqua-200 bg-ocean-500 px-6 py-4 text-white">
            <div>
              <div className="text-lg font-semibold">
                {showApproverContent ? 'Review content' : 'Edit content'}
              </div>
              <div className="text-xs text-aqua-100">
                Created {new Date(draft.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenTimeline}
                className="heading-font text-xs normal-case"
              >
                View timeline
              </Button>
              <Badge className={PRIORITY_TIER_BADGE_CLASSES[currentPriorityTier]}>
                {currentPriorityTier}
              </Badge>
              <span
                className={cx(
                  'rounded-full px-3 py-1 text-xs font-semibold text-ocean-900',
                  draft.status === 'Approved' ? 'bg-aqua-100' : 'bg-amber-100',
                )}
              >
                {draft.status}
              </span>
            </div>
          </div>

          <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6">
            {showDraftRecovery && savedDraftInfo && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="text-sm text-amber-800">
                  <span className="font-semibold">Unsaved draft found</span>
                  <span className="mx-1">·</span>
                  <span>Last saved {new Date(savedDraftInfo.savedAt).toLocaleString()}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearSavedDraft} className="text-xs">
                    Discard
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={restoreSavedDraft}
                    className="bg-amber-600 text-xs hover:bg-amber-700"
                  >
                    Restore draft
                  </Button>
                </div>
              </div>
            )}
            {showApproverContent ? (
              renderApproverContent()
            ) : (
              <>
                <FieldRow label="Date">
                  <Input
                    type="date"
                    value={draft.date}
                    onChange={(event) => update('date', event.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Approvers">
                  <div className="space-y-2">
                    <ApproverMulti
                      value={draft.approvers || []}
                      onChange={(value) => update('approvers', value)}
                      options={approverOptions}
                    />
                    <div className="flex items-center justify-between gap-3 text-xs text-graystone-500">
                      <span>
                        Recommended for this route:{' '}
                        {recommendedApprovers.length
                          ? recommendedApprovers.join(', ')
                          : 'No approvers suggested'}
                      </span>
                      {JSON.stringify(draft.approvers || []) !==
                      JSON.stringify(recommendedApprovers) ? (
                        <button
                          type="button"
                          className="font-medium text-ocean-700 underline-offset-2 hover:underline"
                          onClick={() => update('approvers', recommendedApprovers)}
                        >
                          Use template
                        </button>
                      ) : null}
                    </div>
                  </div>
                </FieldRow>

                <FieldRow label="Campaign">
                  <select
                    value={draft.campaign || ''}
                    onChange={(event) => update('campaign', event.target.value || '')}
                    className={cx(selectBaseClasses, 'w-full')}
                  >
                    <option value="">No campaign</option>
                    {CAMPAIGNS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Content pillar">
                  <select
                    value={draft.contentPillar || ''}
                    onChange={(event) => update('contentPillar', event.target.value || '')}
                    className={cx(selectBaseClasses, 'w-full')}
                  >
                    <option value="">Not tagged</option>
                    {CONTENT_PILLARS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Content category">
                  <select
                    value={draft.contentCategory || ''}
                    onChange={(event) => update('contentCategory', event.target.value || undefined)}
                    className={cx(selectBaseClasses, 'w-full')}
                  >
                    <option value="">Not tagged</option>
                    {CONTENT_CATEGORIES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Response mode">
                  <select
                    value={draft.responseMode || 'Planned'}
                    onChange={(event) => update('responseMode', event.target.value || undefined)}
                    className={cx(selectBaseClasses, 'w-full')}
                  >
                    {RESPONSE_MODES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Sign-off route">
                  <div className="space-y-2">
                    <select
                      value={draft.signOffRoute || ''}
                      onChange={(event) => update('signOffRoute', event.target.value || undefined)}
                      className={cx(selectBaseClasses, 'w-full')}
                    >
                      <option value="">Use manual approvers only</option>
                      {SIGN_OFF_ROUTES.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center justify-between gap-3 text-xs text-graystone-500">
                      <span>
                        Recommended from strategy metadata: {recommendedSignOffRoute || 'None'}
                      </span>
                      {draft.signOffRoute !== recommendedSignOffRoute ? (
                        <button
                          type="button"
                          className="font-medium text-ocean-700 underline-offset-2 hover:underline"
                          onClick={() =>
                            update('signOffRoute', recommendedSignOffRoute || undefined)
                          }
                        >
                          Use recommendation
                        </button>
                      ) : null}
                    </div>
                  </div>
                </FieldRow>

                <FieldRow label="Content peak / moment">
                  <Input
                    value={draft.contentPeak || ''}
                    onChange={(event) => update('contentPeak', event.target.value || undefined)}
                    placeholder="World Population Day, COP, budget, research launch..."
                  />
                </FieldRow>

                <FieldRow label="Partner organisation">
                  <Input
                    value={draft.partnerOrg || ''}
                    onChange={(event) => update('partnerOrg', event.target.value || undefined)}
                    placeholder="Partner, coalition, or programme lead"
                  />
                </FieldRow>

                <FieldRow label="Series">
                  <Input
                    value={draft.seriesName || ''}
                    onChange={(event) => update('seriesName', event.target.value || undefined)}
                    placeholder="Rights in practice, Myth-bust Monday..."
                  />
                </FieldRow>

                <FieldRow label="Episode number">
                  <Input
                    type="number"
                    min="1"
                    value={draft.episodeNumber ?? ''}
                    onChange={(event) =>
                      update(
                        'episodeNumber',
                        event.target.value ? Number(event.target.value) : undefined,
                      )
                    }
                    placeholder="1"
                  />
                </FieldRow>

                <FieldRow label="Origin content ID">
                  <Input
                    value={draft.originContentId || ''}
                    onChange={(event) => update('originContentId', event.target.value || undefined)}
                    placeholder="Reference the origin entry for repurposed content"
                  />
                </FieldRow>

                <FieldRow label="Execution readiness">
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Alt text</Label>
                        <select
                          value={draft.altTextStatus || 'Pending'}
                          onChange={(event) =>
                            update('altTextStatus', event.target.value || undefined)
                          }
                          className={cx(selectBaseClasses, 'w-full')}
                        >
                          {EXECUTION_STATUSES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>Subtitles / transcript</Label>
                        <select
                          value={draft.subtitlesStatus || 'Pending'}
                          onChange={(event) =>
                            update('subtitlesStatus', event.target.value || undefined)
                          }
                          className={cx(selectBaseClasses, 'w-full')}
                        >
                          {EXECUTION_STATUSES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>UTM plan</Label>
                        <select
                          value={draft.utmStatus || 'Pending'}
                          onChange={(event) => update('utmStatus', event.target.value || undefined)}
                          className={cx(selectBaseClasses, 'w-full')}
                        >
                          {EXECUTION_STATUSES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>Link placement</Label>
                        <select
                          value={draft.linkPlacement || ''}
                          onChange={(event) =>
                            update('linkPlacement', event.target.value || undefined)
                          }
                          className={cx(selectBaseClasses, 'w-full')}
                        >
                          <option value="">Not set</option>
                          {LINK_PLACEMENTS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>CTA type</Label>
                        <select
                          value={draft.ctaType || ''}
                          onChange={(event) => update('ctaType', event.target.value || undefined)}
                          className={cx(selectBaseClasses, 'w-full')}
                        >
                          <option value="">Select CTA</option>
                          {CTA_TYPES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label>SEO primary query</Label>
                        <Input
                          value={draft.seoPrimaryQuery || ''}
                          onChange={(event) =>
                            update('seoPrimaryQuery', event.target.value || undefined)
                          }
                          placeholder="Primary search phrase for discovery"
                        />
                      </div>
                    </div>

                    <label className="flex items-start gap-3 rounded-xl border border-graystone-200 bg-graystone-50 px-3 py-3 text-sm text-graystone-700">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-graystone-300"
                        checked={draft.sourceVerified === true}
                        onChange={(event) => update('sourceVerified', event.target.checked)}
                      />
                      <span>
                        Source verified
                        <span className="block text-xs text-graystone-500">
                          Confirms facts, evidence sources, and rights checks are complete.
                        </span>
                      </span>
                    </label>

                    {approvalBlockers.length > 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                        <div className="font-medium">Still blocking review</div>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                          {approvalBlockers.map((item) => (
                            <li key={item.key}>{item.label}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                        Ready for review.
                      </div>
                    )}
                  </div>
                </FieldRow>

                <FieldRow label="Priority">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={currentPriorityTier}
                      onChange={(event) => update('priorityTier', event.target.value)}
                      className={cx(selectBaseClasses, 'w-full sm:w-auto sm:min-w-[180px]')}
                    >
                      {PRIORITY_TIERS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <Badge className={PRIORITY_TIER_BADGE_CLASSES[currentPriorityTier]}>
                      {currentPriorityTier}
                    </Badge>
                  </div>
                </FieldRow>

                <FieldRow label="Evergreen content">
                  <div className="flex items-center gap-3">
                    <Toggle
                      id="modal-evergreen"
                      ariaLabel="Mark as evergreen content"
                      checked={draft.evergreen || false}
                      onChange={(checked) => {
                        update('evergreen', checked);
                        if (onToggleEvergreen) {
                          onToggleEvergreen(draft.id);
                        }
                      }}
                    />
                    <span className="text-sm text-graystone-600">
                      Reusable content that can be re-posted
                    </span>
                  </div>
                </FieldRow>

                <FieldRow label="Platforms">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Toggle
                        id="modal-all-platforms"
                        ariaLabel="Select all platforms"
                        checked={allPlatforms}
                        onChange={(checked) => {
                          setAllPlatforms(checked);
                          if (checked) {
                            update('platforms', [...ALL_PLATFORMS]);
                          }
                        }}
                      />
                      <span className="text-sm text-graystone-600">Select all platforms</span>
                    </div>
                    {!allPlatforms && (
                      <div className="grid grid-cols-2 gap-2">
                        {ALL_PLATFORMS.map((platform) => (
                          <label
                            key={platform}
                            className="flex items-center gap-2 rounded-xl border border-aqua-200 bg-aqua-50 px-3 py-2 text-sm text-graystone-700 hover:border-aqua-300"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-graystone-300"
                              checked={draftPlatforms.includes(platform)}
                              onChange={(event) => {
                                const checked = event.target.checked;
                                const exists = draftPlatforms.includes(platform);
                                let nextPlatforms = draftPlatforms;
                                if (checked && !exists) {
                                  nextPlatforms = [...draftPlatforms, platform];
                                }
                                if (!checked && exists) {
                                  nextPlatforms = draftPlatforms.filter(
                                    (item) => item !== platform,
                                  );
                                }
                                update('platforms', nextPlatforms);
                              }}
                            />
                            <PlatformIcon platform={platform} />
                            <span className="text-graystone-700">{platform}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </FieldRow>

                <FieldRow label="Author">
                  <div className="rounded-2xl border border-graystone-200 bg-graystone-50 px-3 py-2 text-sm text-graystone-700">
                    {draft.author || 'Unknown'}
                  </div>
                </FieldRow>

                <FieldRow label="Caption">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {['Main', ...draftPlatforms].map((tab) => (
                        <Button
                          key={tab}
                          type="button"
                          size="sm"
                          variant={activeCaptionTab === tab ? 'solid' : 'outline'}
                          onClick={() => setActiveCaptionTab(tab)}
                        >
                          {tab === 'Main' ? 'Main' : tab}
                        </Button>
                      ))}
                    </div>
                    <Textarea
                      value={
                        activeCaptionTab === 'Main'
                          ? draft.caption
                          : (draft.platformCaptions?.[activeCaptionTab] ?? draft.caption)
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        if (activeCaptionTab === 'Main') {
                          setDraft((prev) => ({ ...prev, caption: value }));
                        } else {
                          setDraft((prev) => ({
                            ...prev,
                            platformCaptions: {
                              ...ensurePlatformCaptions(prev.platformCaptions),
                              [activeCaptionTab]: value,
                            },
                          }));
                        }
                      }}
                      rows={4}
                    />
                    <p className="text-xs text-graystone-500">
                      {activeCaptionTab === 'Main'
                        ? 'Updates here flow to every platform unless a custom version is set.'
                        : `${activeCaptionTab} caption overrides the main copy for that platform.`}
                    </p>
                  </div>
                </FieldRow>

                {terminologyMatches.length > 0 && <TerminologyAlert matches={terminologyMatches} />}

                <FieldRow label="URL">
                  <Input
                    type="url"
                    value={draft.url || ''}
                    onChange={(event) => update('url', event.target.value || undefined)}
                  />
                </FieldRow>

                <FieldRow label="Preview">
                  <div className="space-y-4">
                    <Input
                      type="url"
                      value={draft.previewUrl || ''}
                      onChange={(event) => update('previewUrl', event.target.value)}
                      placeholder="https://cdn.example.com/assets/post.png"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className={cx(fileInputClasses, 'text-xs')}
                      />
                      {draft.previewUrl && (
                        <Button variant="ghost" size="sm" onClick={handleClearPreview}>
                          Clear preview
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {previewPlatforms.length > 1 && (
                        <div className="flex flex-wrap gap-2">
                          {previewPlatforms.map((platform) => (
                            <Button
                              key={platform}
                              type="button"
                              size="sm"
                              variant={activePreviewPlatform === platform ? 'solid' : 'outline'}
                              onClick={() => setActivePreviewPlatform(platform)}
                            >
                              {platform}
                            </Button>
                          ))}
                        </div>
                      )}
                      <SocialPreview
                        platform={effectivePreviewPlatform}
                        caption={previewCaption}
                        mediaUrl={previewUrl}
                        isImage={previewIsImage}
                        isVideo={previewIsVideo}
                      />
                      <p className="text-xs text-graystone-500">
                        Preview simulates the selected platform using the current caption and asset.
                      </p>
                    </div>
                  </div>
                </FieldRow>

                {analyticsPlatforms.length > 0 && (
                  <FieldRow label="Performance">
                    <div className="space-y-3">
                      {analyticsPlatforms.map((platform) => {
                        const metrics = analyticsByPlatform[platform] || {};
                        const { lastImportedAt, ...rest } = metrics;
                        const metricEntries = Object.entries(rest);
                        return (
                          <div
                            key={platform}
                            className="rounded-2xl border border-aqua-200 bg-aqua-50 px-3 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ocean-700">
                              <span className="inline-flex items-center gap-1">
                                <PlatformIcon platform={platform} />
                                {platform}
                              </span>
                              {lastImportedAt ? (
                                <span className="text-xs font-normal text-graystone-500">
                                  Updated {new Date(lastImportedAt).toLocaleString()}
                                </span>
                              ) : null}
                            </div>
                            {metricEntries.length ? (
                              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {metricEntries.map(([metricKey, metricValue]) => (
                                  <div
                                    key={`${platform}-${metricKey}`}
                                    className="rounded-xl bg-white px-3 py-2 shadow-sm"
                                  >
                                    <div className="text-[11px] uppercase tracking-wide text-graystone-500">
                                      {metricKey}
                                    </div>
                                    <div className="text-sm font-semibold text-ocean-700">
                                      {formatMetricValue(metricValue)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-graystone-500">
                                No metrics captured yet.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </FieldRow>
                )}

                <Separator />

                <FieldRow label="Asset type">
                  <select
                    value={draft.assetType}
                    onChange={(event) => handleAssetTypeChange(event.target.value)}
                    className={cx(selectBaseClasses, 'w-full')}
                  >
                    <option value="No asset">No asset</option>
                    <option value="Video">Video</option>
                    <option value="Design">Design</option>
                    <option value="Carousel">Carousel</option>
                  </select>
                </FieldRow>

                {draft.assetType === 'Video' && (
                  <FieldRow label="Script">
                    <Textarea
                      value={draft.script || ''}
                      onChange={(event) => update('script', event.target.value)}
                      rows={4}
                    />
                  </FieldRow>
                )}

                {draft.assetType === 'Design' && (
                  <FieldRow label="Design copy">
                    <Textarea
                      value={draft.designCopy || ''}
                      onChange={(event) => update('designCopy', event.target.value)}
                      rows={4}
                    />
                  </FieldRow>
                )}

                {draft.assetType === 'Carousel' && (
                  <div className="space-y-4">
                    <FieldRow label="Slides">
                      <select
                        value={String(draft.carouselSlides?.length || 0)}
                        onChange={(event) => handleCarouselSlides(Number(event.target.value))}
                        className={cx(selectBaseClasses, 'w-full')}
                      >
                        {Array.from({ length: 10 }, (_, index) => (
                          <option key={index + 1} value={index + 1}>
                            {index + 1}
                          </option>
                        ))}
                      </select>
                    </FieldRow>
                    <div className="space-y-3">
                      {(draft.carouselSlides || []).map((slideText, idx) => (
                        <FieldRow key={idx} label={`Slide ${idx + 1}`}>
                          <Textarea
                            value={slideText}
                            onChange={(event) => {
                              const value = event.target.value;
                              setDraft((prev) => {
                                const currentSlides = prev.carouselSlides || [];
                                const nextSlides = currentSlides.map((slide, slideIndex) =>
                                  slideIndex === idx ? value : slide,
                                );
                                return { ...prev, carouselSlides: nextSlides };
                              });
                            }}
                            rows={3}
                          />
                        </FieldRow>
                      ))}
                    </div>
                  </div>
                )}

                <FieldRow label="First comment">
                  <Textarea
                    value={draft.firstComment || ''}
                    onChange={(event) => update('firstComment', event.target.value)}
                    rows={3}
                  />
                </FieldRow>

                <FieldRow label={`Checklist (${checklistCompleted}/${checklistTotal})`}>
                  <div className="flex flex-wrap gap-2">
                    {entryChecklistItems.map((item) => (
                      <label
                        key={item.key}
                        className="heading-font inline-flex items-center gap-3 rounded-full border border-black bg-white px-4 py-2 text-xs font-semibold text-black shadow-[0_0_20px_rgba(15,157,222,0.2)] transition hover:bg-black hover:text-white"
                      >
                        <input
                          type="checkbox"
                          className={checklistCheckboxClass}
                          checked={ensureChecklist(draft.checklist)[item.key]}
                          onChange={() => toggleChecklistItem(item.key)}
                        />
                        <span className="normal-case">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </FieldRow>

                {draftPlatforms.length > 0 && (
                  <FieldRow label="Platform guidance">
                    <PlatformGuidancePanel
                      platforms={draftPlatforms}
                      contentPillar={draft.contentPillar || ''}
                    />
                  </FieldRow>
                )}

                <FieldRow label="Quick assessment">
                  <QuickAssessment
                    values={draft.assessmentScores?.quick || {}}
                    onChange={(quick) =>
                      update('assessmentScores', {
                        ...(draft.assessmentScores || {}),
                        quick,
                      })
                    }
                  />
                </FieldRow>

                <FieldRow label="Golden Thread">
                  <GoldenThreadCheck
                    values={draft.assessmentScores?.goldenThread || {}}
                    onChange={(gtValues) => {
                      const allPassed = Object.values(gtValues).every((v) => v === false);
                      const allAnswered = Object.values(gtValues).every((v) => v !== undefined);
                      setDraft((prev) => {
                        if (!prev) return prev;
                        const next = {
                          ...prev,
                          assessmentScores: {
                            ...(prev.assessmentScores || {}),
                            goldenThread: gtValues,
                          },
                        };
                        if (allAnswered) {
                          next.goldenThreadPass = allPassed;
                        }
                        return normalizeEntry(next);
                      });
                    }}
                  />
                </FieldRow>

                <FieldRow label="Full assessment">
                  <FullAssessment
                    scores={draft.assessmentScores?.full || {}}
                    onChange={(full) =>
                      update('assessmentScores', {
                        ...(draft.assessmentScores || {}),
                        full,
                      })
                    }
                  />
                </FieldRow>
              </>
            )}
            <Separator />
            {renderCommentsSection()}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-aqua-200 bg-aqua-50 px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              {isApproverView && draft.status !== 'Approved' ? (
                <Button
                  variant="outline"
                  onClick={() => onApprove(draft.id)}
                  className="gap-2"
                  disabled={!canApproveReadiness}
                >
                  Mark as approved
                </Button>
              ) : null}
              {onClone && (
                <Button variant="outline" onClick={handleClone} className="gap-2 text-ocean-700">
                  <CopyIcon className="h-4 w-4 text-ocean-700" />
                  Clone entry
                </Button>
              )}
              {onPublish && canPublish(sanitizedEntry) && (
                <Button
                  variant="outline"
                  onClick={() => onPublish(sanitizedEntry.id)}
                  className="gap-2 text-emerald-700"
                >
                  <ArrowUpIcon className="h-4 w-4 text-emerald-700" />
                  Publish now
                </Button>
              )}
              {onPostAgain && canPostAgain(sanitizedEntry) && (
                <Button
                  variant="outline"
                  onClick={() => onPostAgain(sanitizedEntry.id)}
                  className="gap-2 text-ocean-700"
                >
                  <ArrowPathIcon className="h-4 w-4 text-ocean-700" />
                  Post again
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={handleDelete}
                  className="gap-2 text-graystone-700"
                >
                  <TrashIcon className="h-4 w-4 text-graystone-700" />
                  Move to trash
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {!canApproveReadiness && isApproverView && draft.status !== 'Approved' ? (
                <span className="text-xs text-amber-700">
                  Approval blocked until review readiness is complete.
                </span>
              ) : null}
              <Button variant="ghost" onClick={onClose}>
                {showApproverContent ? 'Close' : 'Cancel'}
              </Button>
              {canEdit && <Button onClick={handleSave}>Save changes</Button>}
            </div>
          </div>
        </div>
      </Modal>
      {timelineOpen ? (
        <Modal open={timelineOpen} onClose={closeTimeline}>
          <div className="flex h-full max-h-[80vh] flex-col bg-white">
            <div className="flex items-center justify-between border-b border-graystone-200 px-6 py-4">
              <div>
                <div className="heading-font text-lg font-semibold text-ocean-900">
                  Content timeline
                </div>
                <p className="text-xs text-graystone-500">Logged activity for this entry</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => sanitizedEntry?.id && loadTimeline(sanitizedEntry.id)}
                  className="heading-font text-xs normal-case"
                >
                  Refresh
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closeTimeline}
                  className="heading-font text-xs normal-case"
                >
                  Close
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {timelineError ? (
                <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {timelineError}
                </div>
              ) : null}
              {timelineLoading ? (
                <p className="text-sm text-graystone-500">Loading timeline…</p>
              ) : timelineList.length ? (
                <div className="space-y-3">
                  {timelineList.map((item) => {
                    const meta = parseTimelineMeta(item.meta);
                    const metaKeys = Object.keys(meta || {});
                    const ts = item.ts ? new Date(item.ts).toLocaleString() : '';
                    return (
                      <div
                        key={item.id || `${item.ts}-${item.action}`}
                        className="rounded-2xl border border-graystone-200 bg-graystone-50 px-4 py-3 text-sm text-graystone-700"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-ocean-800">
                            {formatTimelineAction(item.action)}
                          </div>
                          <div className="text-xs text-graystone-500">{ts}</div>
                        </div>
                        <div className="text-xs text-graystone-500">{item.user || 'System'}</div>
                        {metaKeys.length ? (
                          <div className="mt-2 rounded-xl bg-white px-3 py-2 text-xs text-graystone-600">
                            {metaKeys.map((key) => (
                              <div
                                key={key}
                                className="flex items-center justify-between gap-3 border-b border-graystone-100 py-1 last:border-b-0"
                              >
                                <span className="font-semibold text-graystone-700">{key}</span>
                                <span className="text-graystone-500">
                                  {typeof meta[key] === 'object'
                                    ? JSON.stringify(meta[key])
                                    : String(meta[key])}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-graystone-500">No timeline activity recorded yet.</p>
              )}
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

export default EntryModal;
