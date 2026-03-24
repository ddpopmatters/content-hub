import React from 'react';
import { cx, ensureArray } from '../../lib/utils';
import { selectBaseClasses, fileInputClasses } from '../../lib/styles';
import { determineWorkflowStatus, getWorkflowBlockers } from '../../lib/sanitizers';
import { FALLBACK_GUIDELINES } from '../../lib/guidelines';
import type {
  ContentCategory,
  CtaType,
  Entry,
  ExecutionStatus,
  Guidelines,
  Influencer,
  LinkPlacement,
  PriorityTier,
  ResponseMode,
  SignOffRoute,
} from '../../types/models';
import {
  ALL_PLATFORMS,
  CONTENT_CATEGORIES,
  CTA_TYPES,
  CONTENT_PILLARS,
  DEFAULT_APPROVERS,
  EXECUTION_STATUSES,
  LINK_PLACEMENTS,
  PRIORITY_TIERS,
  recommendApproversForRoute,
  recommendSignOffRoute,
  SIGN_OFF_ROUTES,
} from '../../constants';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  Label,
  Input,
  Textarea,
  Button,
  Toggle,
} from '../../components/ui';
import { PlatformIcon, PlusIcon } from '../../components/common';
import { ApproverMulti } from './ApproverMulti';
import { InfluencerPicker } from '../influencers';
import { QuickAssessment, GoldenThreadCheck } from '../assessment';
import { AudienceSelector } from './AudienceSelector';
import { PlatformGuidancePanel } from './PlatformGuidancePanel';
import { TerminologyAlert } from './TerminologyAlert';
import { useCategories } from '../../hooks/domain/useCategories';
import { SUPABASE_API } from '../../lib/supabase';
import { buildUtmUrl, normalizeContentApproach } from './formUtils';
import { checkTerminology } from '../../lib/terminology';

const { useState, useMemo, useEffect, useRef } = React;

interface EntryFormProps {
  onSubmit: (data: Partial<Entry>) => void;
  existingEntries?: Entry[];
  onPreviewAssetType?: (assetType: string | null) => void;
  guidelines?: Guidelines;
  currentUser?: string;
  currentUserEmail?: string;
  approverOptions?: readonly string[];
  influencers?: Influencer[];
  onInfluencerChange?: (influencerId: string | undefined) => void;
  teamsWebhookUrl?: string;
  pushSyncToast?: (message: string, type?: 'success' | 'warning' | 'error') => void;
  initialValues?: Partial<Entry> | null;
}

interface EntryValidationError {
  field: string;
  message: string;
}

type EntryFormInitialValues = Partial<Entry> & {
  sourceRequestId?: string;
  sourceRequestTitle?: string;
};

const FIELD_ERROR_MESSAGES = {
  platforms: 'At least one platform is required.',
  caption: 'A caption is required.',
  script: 'Video script is required.',
  designCopy: 'Design copy is required.',
  carouselSlides: 'At least one carousel slide needs copy.',
} as const;

const normalizeDateInput = (value: string | null | undefined): string => {
  if (!value || typeof value !== 'string') return '';
  if (value.includes('T')) return value.slice(0, 10);
  return value;
};

export function EntryForm({
  onSubmit,
  existingEntries = [],
  onPreviewAssetType,
  guidelines: _guidelines = FALLBACK_GUIDELINES,
  currentUser = '',
  currentUserEmail = '',
  approverOptions = DEFAULT_APPROVERS,
  influencers = [],
  onInfluencerChange,
  teamsWebhookUrl: _teamsWebhookUrl = '',
  pushSyncToast,
  initialValues = null,
}: EntryFormProps): React.ReactElement {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [approvers, setApprovers] = useState<string[]>([]);
  const currentAuthorName = useMemo(() => {
    if (currentUser && currentUser.trim().length) return currentUser.trim();
    if (currentUserEmail && currentUserEmail.trim().length) return currentUserEmail.trim();
    return '';
  }, [currentUser, currentUserEmail]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [allPlatforms, setAllPlatforms] = useState<boolean>(false);
  const [caption, setCaption] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [approvalDeadline, setApprovalDeadline] = useState<string>('');
  const [firstCheckDate, setFirstCheckDate] = useState<string>('');
  const [secondCheckDate, setSecondCheckDate] = useState<string>('');
  const [assetProductionDate, setAssetProductionDate] = useState<string>('');
  const [finalCheckDate, setFinalCheckDate] = useState<string>('');
  const [assetType, setAssetType] = useState<string>('No asset');
  const [script, setScript] = useState<string>('');
  const [designCopy, setDesignCopy] = useState<string>('');
  const [carouselSlides, setCarouselSlides] = useState<string[]>(['']);
  const [firstComment, setFirstComment] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [assetPreviews, setAssetPreviews] = useState<string[]>([]);
  const [overrideConflict, setOverrideConflict] = useState<boolean>(false);
  const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({});
  const [activeCaptionTab, setActiveCaptionTab] = useState<string>('Main');
  const [, setActivePreviewPlatform] = useState<string>('Main');
  const [campaign, setCampaign] = useState<string>('');
  const [contentPillar, setContentPillar] = useState<string>('');
  const [contentCategory, setContentCategory] = useState<string>('');
  const [responseMode, setResponseMode] = useState<string>('Planned');
  const [signOffRoute, setSignOffRoute] = useState<string>('');
  const [contentPeak, setContentPeak] = useState<string>('');
  const [seriesName, setSeriesName] = useState<string>('');
  const [episodeNumber, setEpisodeNumber] = useState<string>('');
  const [originContentId, setOriginContentId] = useState<string>('');
  const [partnerOrg, setPartnerOrg] = useState<string>('');
  const [partnerIndividualName, setPartnerIndividualName] = useState<string>('');
  const [partnerConsentStatus, setPartnerConsentStatus] = useState<
    'confirmed' | 'pending' | 'not-required' | ''
  >('');
  const [partnerCaptureContext, setPartnerCaptureContext] = useState<string>('');
  const [altTextStatus, setAltTextStatus] = useState<string>('Pending');
  const [subtitlesStatus, setSubtitlesStatus] = useState<string>('Pending');
  const [utmStatus, setUtmStatus] = useState<string>('Pending');
  const [sourceVerified, setSourceVerified] = useState<boolean>(false);
  const [seoPrimaryQuery, setSeoPrimaryQuery] = useState<string>('');
  const [linkPlacement, setLinkPlacement] = useState<string>('');
  const [ctaType, setCtaType] = useState<string>('');
  const [priorityTier, setPriorityTier] = useState<string>('Medium');
  const [influencerId, setInfluencerId] = useState<string | undefined>('');
  const [showNewInfluencerModal, setShowNewInfluencerModal] = useState(false);
  const [newInfluencerName, setNewInfluencerName] = useState('');
  const [newInfluencerPlatform, setNewInfluencerPlatform] = useState('');
  const [localInfluencers, setLocalInfluencers] = useState<Influencer[]>([]);
  const [audienceSegments, setAudienceSegments] = useState<string[]>([]);
  const [quickAssessment, setQuickAssessment] = useState<Record<string, boolean>>({});
  const [goldenThread, setGoldenThread] = useState<Record<string, boolean>>({});
  const [entryFormErrors, setEntryFormErrors] = useState<string[]>([]);
  const [entryFormErrorFields, setEntryFormErrorFields] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showUtm, setShowUtm] = useState<boolean>(false);
  const [utmSource, setUtmSource] = useState<string>('');
  const [utmMedium, setUtmMedium] = useState<string>('');
  const [utmCampaign, setUtmCampaign] = useState<string>('');
  const [utmContent, setUtmContent] = useState<string>('');
  const [utmTerm, setUtmTerm] = useState<string>('');
  const [autoSignOffRoute, setAutoSignOffRoute] = useState<boolean>(true);
  const [autoApprovers, setAutoApprovers] = useState<boolean>(true);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const conflictWarningRef = useRef<HTMLDivElement>(null);
  const categories = useCategories();

  useEffect(() => {
    if (!initialValues) return;

    const sourceInitialValues = initialValues as EntryFormInitialValues;
    const today = new Date().toISOString().slice(0, 10);
    const nextPlatforms = ensureArray(initialValues.platforms).filter((platform) =>
      ALL_PLATFORMS.includes(platform as (typeof ALL_PLATFORMS)[number]),
    );
    const nextAssetType = initialValues.assetType || 'No asset';
    const nextSlides = ensureArray(initialValues.carouselSlides).filter(
      (slide) => typeof slide === 'string',
    );
    const nextPlatformCaptions: Record<string, string> =
      sourceInitialValues.platformCaptions &&
      typeof sourceInitialValues.platformCaptions === 'object'
        ? sourceInitialValues.platformCaptions
        : {};

    setDate(initialValues.date || today);
    setApprovers(ensureArray(initialValues.approvers));
    setPlatforms(nextPlatforms);
    setAllPlatforms(
      nextPlatforms.length === ALL_PLATFORMS.length &&
        ALL_PLATFORMS.every((platform) => nextPlatforms.includes(platform)),
    );
    setCaption(initialValues.caption || '');
    setUrl(initialValues.url || '');
    setApprovalDeadline(normalizeDateInput(initialValues.approvalDeadline));
    setFirstCheckDate(normalizeDateInput(initialValues.firstCheckDate));
    setSecondCheckDate(normalizeDateInput(initialValues.secondCheckDate));
    setAssetProductionDate(normalizeDateInput(initialValues.assetProductionDate));
    setFinalCheckDate(normalizeDateInput(initialValues.finalCheckDate));
    setAssetType(nextAssetType);
    setScript(initialValues.script || '');
    setDesignCopy(initialValues.designCopy || '');
    if (nextSlides.length > 0) {
      setCarouselSlides(nextSlides);
    } else {
      setCarouselSlides(['']);
    }
    setFirstComment(initialValues.firstComment || '');
    setPreviewUrl(initialValues.previewUrl || '');
    setAssetPreviews(Array.isArray(initialValues.assetPreviews) ? initialValues.assetPreviews : []);
    setOverrideConflict(false);
    setPlatformCaptions(nextPlatformCaptions);
    setActiveCaptionTab('Main');
    setActivePreviewPlatform(nextPlatforms[0] || 'Main');
    setCampaign(initialValues.campaign || '');
    setContentPillar(initialValues.contentPillar || '');
    setContentCategory(initialValues.contentCategory || '');
    setResponseMode(initialValues.responseMode || 'Planned');
    setSignOffRoute(initialValues.signOffRoute || '');
    setContentPeak(initialValues.contentPeak || '');
    setSeriesName(initialValues.seriesName || '');
    setEpisodeNumber(
      initialValues.episodeNumber !== undefined && initialValues.episodeNumber !== null
        ? String(initialValues.episodeNumber)
        : '',
    );
    setOriginContentId(initialValues.originContentId || '');
    setPartnerOrg(initialValues.partnerOrg || '');
    setPartnerIndividualName(initialValues.partnerIndividualName || '');
    setPartnerConsentStatus(initialValues.partnerConsentStatus || '');
    setPartnerCaptureContext(initialValues.partnerCaptureContext || '');
    setAltTextStatus(initialValues.altTextStatus || 'Pending');
    setSubtitlesStatus(initialValues.subtitlesStatus || 'Pending');
    setUtmStatus(initialValues.utmStatus || 'Pending');
    setSourceVerified(initialValues.sourceVerified === true);
    setSeoPrimaryQuery(initialValues.seoPrimaryQuery || '');
    setLinkPlacement(initialValues.linkPlacement || '');
    setCtaType(initialValues.ctaType || '');
    setPriorityTier(initialValues.priorityTier || 'Medium');
    setInfluencerId(initialValues.influencerId || '');
    setAudienceSegments(ensureArray(initialValues.audienceSegments));
    setQuickAssessment((initialValues.assessmentScores?.quick ?? {}) as Record<string, boolean>);
    setGoldenThread(
      (initialValues.assessmentScores?.goldenThread ?? {}) as Record<string, boolean>,
    );
    setEntryFormErrors([]);
    setEntryFormErrorFields([]);
    const hasAdvancedValues = !!(
      initialValues.contentCategory ||
      initialValues.signOffRoute ||
      initialValues.contentPeak ||
      initialValues.seriesName ||
      initialValues.episodeNumber ||
      initialValues.originContentId ||
      initialValues.partnerOrg ||
      (initialValues.altTextStatus && initialValues.altTextStatus !== 'Pending') ||
      (initialValues.subtitlesStatus && initialValues.subtitlesStatus !== 'Pending') ||
      (initialValues.utmStatus && initialValues.utmStatus !== 'Pending') ||
      initialValues.sourceVerified ||
      initialValues.seoPrimaryQuery ||
      initialValues.linkPlacement ||
      initialValues.ctaType ||
      (initialValues.priorityTier && initialValues.priorityTier !== 'Medium') ||
      ensureArray(initialValues.audienceSegments).length > 0 ||
      initialValues.influencerId ||
      initialValues.url ||
      initialValues.previewUrl ||
      ensureArray(initialValues.assetPreviews).length > 0 ||
      Object.keys(initialValues.assessmentScores?.quick ?? {}).length > 0 ||
      Object.keys(initialValues.assessmentScores?.goldenThread ?? {}).length > 0
    );
    setShowAdvanced(hasAdvancedValues);
    setShowUtm(false);
    setUtmSource('');
    setUtmMedium('');
    setUtmCampaign('');
    setUtmContent('');
    setUtmTerm('');
    setAutoSignOffRoute(!initialValues.signOffRoute);
    setAutoApprovers(false);
  }, [initialValues]);

  const contentApproach = normalizeContentApproach(responseMode);
  const recommendedSignOffRoute = useMemo(
    () =>
      recommendSignOffRoute({
        campaign,
        contentCategory,
        partnerOrg,
        responseMode: contentApproach,
      }),
    [campaign, contentApproach, contentCategory, partnerOrg],
  );
  const recommendedApprovers = useMemo(
    () => recommendApproversForRoute(signOffRoute || recommendedSignOffRoute, approverOptions),
    [approverOptions, recommendedSignOffRoute, signOffRoute],
  );

  useEffect(() => {
    if (!autoSignOffRoute) return;
    setSignOffRoute(recommendedSignOffRoute);
  }, [autoSignOffRoute, recommendedSignOffRoute]);

  useEffect(() => {
    return;
  }, [autoApprovers, recommendedApprovers]);

  useEffect(() => {
    if (allPlatforms) {
      setPlatforms((prev) => {
        const alreadyAll =
          prev.length === ALL_PLATFORMS.length && ALL_PLATFORMS.every((p) => prev.includes(p));
        return alreadyAll ? prev : [...ALL_PLATFORMS];
      });
    }
  }, [allPlatforms]);

  useEffect(() => {
    onPreviewAssetType?.(assetType === 'No asset' ? null : assetType);
  }, [assetType, onPreviewAssetType]);

  const conflicts = useMemo(
    () =>
      (existingEntries || []).filter(
        (entry) =>
          !entry.deletedAt &&
          entry.date === date &&
          entry.id !== initialValues?.id &&
          platforms.length > 0 &&
          ensureArray(entry.platforms).some((p) => platforms.includes(p)),
      ),
    [existingEntries, date, platforms, initialValues],
  );
  const hasConflict = conflicts.length > 0;

  useEffect(() => {
    setOverrideConflict(false);
    setEntryFormErrors((prev) => prev.filter((e) => !e.startsWith('Scheduling conflict')));
  }, [date, platforms]);

  useEffect(() => {
    if (!entryFormErrors.length || !errorSummaryRef.current) return;
    if (entryFormErrors.every((error) => error.startsWith('Scheduling conflict'))) return;
    errorSummaryRef.current.focus();
  }, [entryFormErrors]);

  useEffect(() => {
    setActiveCaptionTab((prevTab) =>
      prevTab === 'Main' || platforms.includes(prevTab) ? prevTab : 'Main',
    );
    setPlatformCaptions((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((key) => {
        if (!platforms.includes(key)) delete updated[key];
      });
      return updated;
    });
    setActivePreviewPlatform((prev) =>
      prev === 'Main' || platforms.includes(prev) ? prev : platforms[0] || 'Main',
    );
  }, [platforms]);

  const reset = () => {
    setApprovers([]);
    setPlatforms([]);
    setAllPlatforms(false);
    setCaption('');
    setUrl('');
    setApprovalDeadline('');
    setFirstCheckDate('');
    setSecondCheckDate('');
    setAssetProductionDate('');
    setFinalCheckDate('');
    setPreviewUrl('');
    setAssetPreviews([]);
    setAssetType('No asset');
    setScript('');
    setDesignCopy('');
    setCarouselSlides(['']);
    setFirstComment('');
    setOverrideConflict(false);
    setPlatformCaptions({});
    setActiveCaptionTab('Main');
    setActivePreviewPlatform('Main');
    setCampaign('');
    setContentPillar('');
    setContentCategory('');
    setResponseMode('Planned');
    setSignOffRoute('');
    setContentPeak('');
    setSeriesName('');
    setEpisodeNumber('');
    setOriginContentId('');
    setPartnerOrg('');
    setPartnerIndividualName('');
    setPartnerConsentStatus('');
    setPartnerCaptureContext('');
    setAltTextStatus('Pending');
    setSubtitlesStatus('Pending');
    setUtmStatus('Pending');
    setSourceVerified(false);
    setSeoPrimaryQuery('');
    setLinkPlacement('');
    setCtaType('');
    setPriorityTier('Medium');
    setInfluencerId('');
    setAudienceSegments([]);
    setQuickAssessment({});
    setGoldenThread({});
    setEntryFormErrors([]);
    setEntryFormErrorFields([]);
    setShowUtm(false);
    setUtmSource('');
    setUtmMedium('');
    setUtmCampaign('');
    setUtmContent('');
    setUtmTerm('');
    setAutoSignOffRoute(true);
    setAutoApprovers(false);
    onPreviewAssetType?.(null);
  };

  const validateEntry = (): EntryValidationError[] => {
    const errors: EntryValidationError[] = [];
    const resolvedPlatforms = allPlatforms ? [...ALL_PLATFORMS] : platforms;
    if (!resolvedPlatforms.length)
      errors.push({ field: 'platforms', message: FIELD_ERROR_MESSAGES.platforms });
    if (!caption.trim()) errors.push({ field: 'caption', message: FIELD_ERROR_MESSAGES.caption });
    if (assetType === 'Video' && !script.trim())
      errors.push({ field: 'script', message: FIELD_ERROR_MESSAGES.script });
    if (assetType === 'Design' && !designCopy.trim())
      errors.push({ field: 'designCopy', message: FIELD_ERROR_MESSAGES.designCopy });
    if (
      assetType === 'Carousel' &&
      !carouselSlides.some((slide) => typeof slide === 'string' && slide.trim())
    )
      errors.push({
        field: 'carouselSlides',
        message: FIELD_ERROR_MESSAGES.carouselSlides,
      });
    return errors;
  };

  const derivedAuthor = currentAuthorName || currentUserEmail || '';
  const resolvedPlatforms = allPlatforms ? [...ALL_PLATFORMS] : platforms;

  const handleCreateInfluencer = async () => {
    if (!newInfluencerName.trim() || !newInfluencerPlatform.trim()) return;
    const created = await SUPABASE_API.saveInfluencer({
      id: '',
      createdAt: new Date().toISOString(),
      createdBy: currentUserEmail || '',
      name: newInfluencerName.trim(),
      handle: '',
      profileUrl: '',
      platform: newInfluencerPlatform.trim(),
      followerCount: 0,
      contactEmail: '',
      niche: '',
      notes: '',
      status: 'Collaborate',
    } as Influencer);
    if (created) {
      setLocalInfluencers((prev) => [...prev, created]);
      setInfluencerId(created.id);
      onInfluencerChange?.(created.id);
    }
    setShowNewInfluencerModal(false);
  };

  const submitEntry = () => {
    const requestInitialValues = initialValues as EntryFormInitialValues | null;
    const scheduledDate = date;
    const cleanedCaptions: Record<string, string> = {};
    resolvedPlatforms.forEach((platform) => {
      const value = platformCaptions[platform];
      if (value && value.trim()) cleanedCaptions[platform] = value;
    });
    const payload: Partial<Entry> & {
      sourceRequestId?: string;
      sourceRequestTitle?: string;
    } = {
      date,
      approvers,
      sourceRequestId: requestInitialValues?.sourceRequestId || undefined,
      sourceRequestTitle: requestInitialValues?.sourceRequestTitle || undefined,
      author: derivedAuthor || undefined,
      platforms: ensureArray(resolvedPlatforms),
      caption,
      url: url || undefined,
      approvalDeadline: approvalDeadline || undefined,
      firstCheckDate: firstCheckDate || undefined,
      secondCheckDate: secondCheckDate || undefined,
      assetProductionDate: assetProductionDate || undefined,
      finalCheckDate: finalCheckDate || undefined,
      previewUrl: previewUrl || undefined,
      assetPreviews,
      assetType,
      script: assetType === 'Video' ? script : undefined,
      designCopy: assetType === 'Design' ? designCopy : undefined,
      carouselSlides: assetType === 'Carousel' ? carouselSlides : undefined,
      firstComment,
      priorityTier: priorityTier as PriorityTier,
      platformCaptions: cleanedCaptions,
      campaign: campaign || undefined,
      contentPillar: contentPillar || undefined,
      contentCategory: contentCategory ? (contentCategory as ContentCategory) : undefined,
      responseMode: contentApproach as ResponseMode,
      signOffRoute: signOffRoute ? (signOffRoute as SignOffRoute) : undefined,
      contentPeak: contentPeak || undefined,
      seriesName: seriesName || undefined,
      episodeNumber: episodeNumber ? Number(episodeNumber) : undefined,
      originContentId: originContentId || undefined,
      partnerOrg: partnerOrg || undefined,
      partnerIndividualName: partnerIndividualName || undefined,
      partnerConsentStatus: partnerConsentStatus || undefined,
      partnerCaptureContext: partnerCaptureContext || undefined,
      altTextStatus: altTextStatus ? (altTextStatus as ExecutionStatus) : undefined,
      subtitlesStatus: subtitlesStatus ? (subtitlesStatus as ExecutionStatus) : undefined,
      utmStatus: utmStatus ? (utmStatus as ExecutionStatus) : undefined,
      sourceVerified,
      seoPrimaryQuery: seoPrimaryQuery || undefined,
      linkPlacement: linkPlacement ? (linkPlacement as LinkPlacement) : undefined,
      ctaType: ctaType ? (ctaType as CtaType) : undefined,
      influencerId: influencerId || undefined,
      audienceSegments: audienceSegments.length > 0 ? audienceSegments : undefined,
      assessmentScores:
        Object.keys(quickAssessment).length > 0 || Object.keys(goldenThread).length > 0
          ? { quick: quickAssessment, goldenThread }
          : undefined,
      goldenThreadPass:
        Object.keys(goldenThread).length === 4
          ? Object.values(goldenThread).every((v) => v === false)
          : undefined,
      workflowStatus: determineWorkflowStatus({
        approvers,
        assetType,
        previewUrl,
        platforms: resolvedPlatforms,
        url,
        firstComment,
        altTextStatus: altTextStatus as ExecutionStatus,
        subtitlesStatus: subtitlesStatus as ExecutionStatus,
        utmStatus: utmStatus as ExecutionStatus,
        sourceVerified,
        seoPrimaryQuery,
        linkPlacement: (linkPlacement || undefined) as LinkPlacement | undefined,
        ctaType: (ctaType || undefined) as CtaType | undefined,
      }),
    };
    onSubmit(payload);
    reset();
    pushSyncToast?.(`Scheduled for ${new Date(scheduledDate).toLocaleDateString()}`, 'success');
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateEntry();
    if (errors.length) {
      setEntryFormErrors(errors.map((error) => error.message));
      setEntryFormErrorFields(errors.map((error) => error.field));
      return;
    }
    if (hasConflict && !overrideConflict) {
      setEntryFormErrors([
        'Scheduling conflict on this date — use "Submit anyway" below, or pick a different date.',
      ]);
      setEntryFormErrorFields([]);
      conflictWarningRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      conflictWarningRef.current?.focus();
      return;
    }
    setEntryFormErrors([]);
    setEntryFormErrorFields([]);
    submitEntry();
  };

  const handleSubmitAnyway = () => {
    const errors = validateEntry();
    if (errors.length) {
      setEntryFormErrors(errors.map((error) => error.message));
      setEntryFormErrorFields(errors.map((error) => error.field));
      return;
    }
    setOverrideConflict(true);
    setEntryFormErrors([]);
    setEntryFormErrorFields([]);
    submitEntry();
  };

  const terminologyMatches = useMemo(() => (caption ? checkTerminology(caption) : []), [caption]);
  const captionTabs = useMemo(() => ['Main', ...platforms], [platforms]);
  const currentCaptionValue =
    activeCaptionTab === 'Main' ? caption : (platformCaptions[activeCaptionTab] ?? caption);
  const hasDateError = entryFormErrorFields.includes('date');
  const hasPlatformError = entryFormErrorFields.includes('platforms');
  const hasAssetTypeError = entryFormErrorFields.includes('assetType');
  const hasScriptError = entryFormErrorFields.includes('script');
  const hasDesignCopyError = entryFormErrorFields.includes('designCopy');
  const hasCarouselSlidesError = entryFormErrorFields.includes('carouselSlides');
  const generatedUtmUrl = buildUtmUrl(url, utmSource, utmMedium, utmCampaign, utmContent, utmTerm);
  const advancedFilledCount = [
    contentCategory,
    signOffRoute,
    contentPeak,
    seriesName,
    episodeNumber,
    originContentId,
    partnerOrg,
    altTextStatus !== 'Pending',
    subtitlesStatus !== 'Pending',
    utmStatus !== 'Pending',
    sourceVerified,
    seoPrimaryQuery,
    linkPlacement,
    ctaType,
    priorityTier !== 'Medium',
    audienceSegments.length > 0,
    influencerId,
    !!url,
    !!previewUrl,
    assetPreviews.length > 0,
    Object.keys(quickAssessment).length > 0,
    Object.keys(goldenThread).length > 0,
  ].filter(Boolean).length;
  const workflowBlockers = useMemo(
    () =>
      getWorkflowBlockers({
        approvers,
        assetType,
        previewUrl,
        platforms: resolvedPlatforms,
        url,
        firstComment,
        altTextStatus: altTextStatus as ExecutionStatus,
        subtitlesStatus: subtitlesStatus as ExecutionStatus,
        utmStatus: utmStatus as ExecutionStatus,
        sourceVerified,
        seoPrimaryQuery,
        linkPlacement: (linkPlacement || undefined) as LinkPlacement | undefined,
        ctaType: (ctaType || undefined) as CtaType | undefined,
      }),
    [
      approvers,
      assetType,
      previewUrl,
      resolvedPlatforms,
      url,
      firstComment,
      altTextStatus,
      subtitlesStatus,
      utmStatus,
      sourceVerified,
      seoPrimaryQuery,
      linkPlacement,
      ctaType,
    ],
  );

  const handleCaptionChange = (value: string) => {
    if (activeCaptionTab === 'Main') {
      setCaption(value);
    } else {
      setPlatformCaptions((prev) => ({
        ...prev,
        [activeCaptionTab]: value,
      }));
    }
  };

  const handlePlatformToggle = (platform: string, checked: boolean) => {
    setPlatforms((prev) => {
      const next = checked
        ? prev.includes(platform)
          ? prev
          : [...prev, platform]
        : prev.filter((p) => p !== platform);
      setPlatformCaptions((prevCaptions) => {
        const updated = { ...prevCaptions };
        Object.keys(updated).forEach((key) => {
          if (!next.includes(key)) delete updated[key];
        });
        return updated;
      });
      setActiveCaptionTab((prevTab) =>
        prevTab === 'Main' || next.includes(prevTab) ? prevTab : 'Main',
      );
      setActivePreviewPlatform((prev) =>
        prev === 'Main' || next.includes(prev) ? prev : next[0] || 'Main',
      );
      return next;
    });
  };

  const handleAddSlide = () => {
    setCarouselSlides((prev) => (prev.length >= 10 ? prev : [...prev, '']));
  };

  const handleRemoveSlide = (indexToRemove: number) => {
    setCarouselSlides((prev) => {
      if (prev.length === 1) return [''];
      return prev.filter((_, index) => index !== indexToRemove);
    });
  };

  const handleSlideChange = (indexToUpdate: number, value: string) => {
    setCarouselSlides((prev) =>
      prev.map((slide, index) => (index === indexToUpdate ? value : slide)),
    );
  };

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl text-ocean-900">Create Content</CardTitle>
      </CardHeader>
      <CardContent>
        {entryFormErrors.length ? (
          <div
            ref={errorSummaryRef}
            tabIndex={-1}
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-rose-600">
              Please fix before saving
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {entryFormErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div
            className={cx('grid gap-6', resolvedPlatforms.length > 0 && 'lg:grid-cols-[2fr,1fr]')}
          >
            <div className="space-y-6">
              {/* ── Core fields ─────────────────────────────────────────── */}

              <fieldset
                className="space-y-2"
                aria-invalid={hasPlatformError}
                aria-describedby={hasPlatformError ? 'platforms-error' : undefined}
              >
                <legend className="block text-sm font-medium text-graystone-700">Platforms</legend>
                <div className="flex items-center gap-3">
                  <Toggle
                    id="all-platforms"
                    checked={allPlatforms}
                    onChange={setAllPlatforms}
                    ariaLabel="Select all platforms"
                  />
                  <span className="text-sm text-graystone-600">Select all platforms</span>
                </div>
                {!allPlatforms && (
                  <div className="flex flex-wrap gap-2">
                    {ALL_PLATFORMS.map((platform) => {
                      const selected = platforms.includes(platform);
                      return (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => handlePlatformToggle(platform, !selected)}
                          className={cx(
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                            selected
                              ? 'border-ocean-400 bg-ocean-600 text-white'
                              : 'border-graystone-200 bg-white text-graystone-600 hover:border-ocean-300 hover:text-ocean-700',
                          )}
                        >
                          <PlatformIcon platform={platform} />
                          {platform}
                        </button>
                      );
                    })}
                  </div>
                )}
                {hasPlatformError ? (
                  <p id="platforms-error" className="text-xs text-rose-600">
                    {FIELD_ERROR_MESSAGES.platforms}
                  </p>
                ) : null}
              </fieldset>

              <div className="space-y-3">
                <Label htmlFor="caption-input">Captions</Label>
                {captionTabs.length > 1 && (
                  <div className="flex flex-wrap gap-2" role="tablist" aria-label="Caption tabs">
                    {captionTabs.map((tab) => (
                      <Button
                        key={tab}
                        id={`caption-tab-${tab}`}
                        type="button"
                        size="sm"
                        variant={activeCaptionTab === tab ? 'default' : 'outline'}
                        onClick={() => setActiveCaptionTab(tab)}
                        role="tab"
                        aria-selected={activeCaptionTab === tab}
                        aria-controls="caption-panel"
                        tabIndex={activeCaptionTab === tab ? 0 : -1}
                      >
                        {tab === 'Main' ? 'Main caption' : tab}
                      </Button>
                    ))}
                  </div>
                )}
                <div
                  id="caption-panel"
                  role="tabpanel"
                  aria-labelledby={`caption-tab-${activeCaptionTab}`}
                >
                  <Textarea
                    id="caption-input"
                    value={currentCaptionValue}
                    onChange={(event) => handleCaptionChange(event.target.value)}
                    rows={4}
                    placeholder="Primary post caption"
                  />
                </div>
                <p className="text-xs text-graystone-500">
                  {activeCaptionTab === 'Main'
                    ? 'Changes here apply to every platform unless you customise a specific tab.'
                    : `${activeCaptionTab} caption overrides the main copy for that platform.`}
                </p>
                {terminologyMatches.length > 0 && <TerminologyAlert matches={terminologyMatches} />}
              </div>

              <div className="space-y-2">
                <Label htmlFor="asset-type">Asset type</Label>
                <select
                  id="asset-type"
                  value={assetType}
                  onChange={(event) => setAssetType(event.target.value)}
                  aria-invalid={hasAssetTypeError}
                  aria-describedby={hasAssetTypeError ? 'asset-type-error' : undefined}
                  className={cx(selectBaseClasses, 'w-full')}
                >
                  <option value="No asset">No asset</option>
                  <option value="Video">Video</option>
                  <option value="Design">Design</option>
                  <option value="Carousel">Carousel</option>
                </select>
                {hasAssetTypeError ? (
                  <p id="asset-type-error" className="text-xs text-rose-600">
                    {'Select an asset type'}
                  </p>
                ) : null}
              </div>

              {assetType === 'Video' && (
                <div className="space-y-2">
                  <Label htmlFor="script">Script</Label>
                  <Textarea
                    id="script"
                    value={script}
                    onChange={(event) => setScript(event.target.value)}
                    rows={4}
                    aria-invalid={hasScriptError}
                    aria-describedby={hasScriptError ? 'script-error' : undefined}
                  />
                  {hasScriptError ? (
                    <p id="script-error" className="text-xs text-rose-600">
                      {FIELD_ERROR_MESSAGES.script}
                    </p>
                  ) : null}
                </div>
              )}

              {assetType === 'Design' && (
                <div className="space-y-2">
                  <Label htmlFor="designCopy">Design copy</Label>
                  <Textarea
                    id="designCopy"
                    value={designCopy}
                    onChange={(event) => setDesignCopy(event.target.value)}
                    rows={4}
                    aria-invalid={hasDesignCopyError}
                    aria-describedby={hasDesignCopyError ? 'design-copy-error' : undefined}
                  />
                  {hasDesignCopyError ? (
                    <p id="design-copy-error" className="text-xs text-rose-600">
                      {FIELD_ERROR_MESSAGES.designCopy}
                    </p>
                  ) : null}
                </div>
              )}

              {assetType === 'Carousel' && (
                <div
                  className="space-y-3"
                  aria-invalid={hasCarouselSlidesError}
                  aria-describedby={hasCarouselSlidesError ? 'carousel-slides-error' : undefined}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Label htmlFor="carousel-slide-0">Carousel slides</Label>
                      <p className="text-xs text-graystone-500">
                        Add up to 10 slides and remove any you do not need.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddSlide}
                      disabled={carouselSlides.length >= 10}
                    >
                      Add slide
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {carouselSlides.map((val, idx) => (
                      <div
                        key={idx}
                        className="space-y-2 rounded-2xl border border-graystone-200 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Label>Slide {idx + 1} copy</Label>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveSlide(idx)}
                          >
                            Remove
                          </Button>
                        </div>
                        <Textarea
                          id={`carousel-slide-${idx}`}
                          value={val}
                          onChange={(event) => handleSlideChange(idx, event.target.value)}
                          placeholder={`Copy for slide ${idx + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                  {hasCarouselSlidesError ? (
                    <p id="carousel-slides-error" className="text-xs text-rose-600">
                      {FIELD_ERROR_MESSAGES.carouselSlides}
                    </p>
                  ) : null}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="entry-date">Date</Label>
                <Input
                  id="entry-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  aria-invalid={hasDateError}
                  aria-describedby={hasDateError ? 'entry-date-error' : undefined}
                />
                {hasDateError ? (
                  <p id="entry-date-error" className="text-xs text-rose-600">
                    {'Date is required.'}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Content approach</Label>
                <div className="flex gap-2">
                  {(['Planned', 'Reactive'] as const).map((mode) => {
                    const label = mode === 'Planned' ? 'Proactive' : 'Reactive';
                    const active = contentApproach === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setResponseMode(mode)}
                        className={cx(
                          'flex-1 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'border-ocean-400 bg-ocean-600 text-white'
                            : 'border-graystone-200 bg-white text-graystone-600 hover:border-ocean-300 hover:text-ocean-700',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Workflow dates</Label>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      {
                        label: 'First check',
                        id: 'firstCheckDate',
                        value: firstCheckDate,
                        setter: setFirstCheckDate,
                      },
                      {
                        label: 'Second check',
                        id: 'secondCheckDate',
                        value: secondCheckDate,
                        setter: setSecondCheckDate,
                      },
                      {
                        label: 'Asset production',
                        id: 'assetProductionDate',
                        value: assetProductionDate,
                        setter: setAssetProductionDate,
                      },
                      {
                        label: 'Final check',
                        id: 'finalCheckDate',
                        value: finalCheckDate,
                        setter: setFinalCheckDate,
                      },
                      {
                        label: 'Approval deadline',
                        id: 'approvalDeadline',
                        value: approvalDeadline,
                        setter: (value: string) => setApprovalDeadline(value),
                      },
                    ] as const
                  ).map(({ label, id, value, setter }) => (
                    <div key={id} className="space-y-1">
                      <div className="text-xs text-graystone-500">{label}</div>
                      <Input
                        id={id}
                        type="date"
                        value={value}
                        onChange={(event) => setter(event.target.value)}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <input
                    id="category"
                    list="category-options"
                    value={campaign}
                    onChange={(event) => setCampaign(event.target.value)}
                    placeholder="Type or choose a category"
                    className={cx(selectBaseClasses, 'w-full')}
                  />
                  <datalist id="category-options">
                    {categories.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content-pillar">Content pillar</Label>
                  <select
                    id="content-pillar"
                    value={contentPillar}
                    onChange={(event) => setContentPillar(event.target.value)}
                    className={cx(selectBaseClasses, 'w-full')}
                  >
                    <option value="">Not tagged</option>
                    {CONTENT_PILLARS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label id="entry-approvers-label" htmlFor="entry-approvers">
                  Approvers
                </Label>
                <ApproverMulti
                  value={approvers}
                  onChange={(value) => {
                    setAutoApprovers(false);
                    setApprovers(value);
                  }}
                  options={approverOptions}
                  buttonId="entry-approvers"
                  labelledBy="entry-approvers-label"
                />
                <div className="flex items-center justify-between gap-3 text-xs text-graystone-500">
                  <span>
                    Recommended for this route:{' '}
                    {recommendedApprovers.length
                      ? recommendedApprovers.join(', ')
                      : 'No approvers suggested'}
                  </span>
                  {JSON.stringify(approvers) !== JSON.stringify(recommendedApprovers) ? (
                    <button
                      type="button"
                      className="font-medium text-ocean-700 underline-offset-2 hover:underline"
                      onClick={() => {
                        setAutoApprovers(true);
                        setApprovers(recommendedApprovers);
                      }}
                    >
                      Use template
                    </button>
                  ) : null}
                </div>
              </div>

              {/* ── Advanced options ─────────────────────────────────────── */}

              <div className="rounded-xl border border-graystone-200">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className={cx(
                    'flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-graystone-700 rounded-xl',
                    'hover:bg-graystone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aqua-400 focus-visible:ring-inset',
                  )}
                >
                  <span className="flex items-center gap-2">
                    Advanced
                    {advancedFilledCount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-ocean-100 px-2 py-0.5 text-xs font-semibold text-ocean-700">
                        {advancedFilledCount} set
                      </span>
                    )}
                  </span>
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={cx(
                      'transition-transform duration-200',
                      showAdvanced ? 'rotate-180' : '',
                    )}
                  >
                    <polyline points="4 6 8 10 12 6" />
                  </svg>
                </button>

                {showAdvanced && (
                  <div className="space-y-5 border-t border-graystone-100 px-4 pb-5 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="url">URL (optional)</Label>
                      <Input
                        id="url"
                        type="url"
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://example.org/article"
                      />
                    </div>

                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowUtm((value) => !value)}
                        className="flex items-center gap-1.5 text-xs font-medium text-ocean-700 hover:underline"
                      >
                        <span>{showUtm ? '▾' : '▸'}</span>
                        UTM parameters
                      </button>
                      {showUtm && (
                        <div className="space-y-3 rounded-xl border border-graystone-200 bg-graystone-50 p-3">
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              {
                                label: 'Source *',
                                placeholder: 'e.g. twitter',
                                value: utmSource,
                                setter: setUtmSource,
                              },
                              {
                                label: 'Medium *',
                                placeholder: 'e.g. social',
                                value: utmMedium,
                                setter: setUtmMedium,
                              },
                              {
                                label: 'Campaign *',
                                placeholder: 'e.g. awareness-week',
                                value: utmCampaign,
                                setter: setUtmCampaign,
                              },
                              {
                                label: 'Content',
                                placeholder: 'e.g. top-link',
                                value: utmContent,
                                setter: setUtmContent,
                              },
                              {
                                label: 'Term',
                                placeholder: 'keyword',
                                value: utmTerm,
                                setter: setUtmTerm,
                              },
                            ].map(({ label, placeholder, value, setter }) => (
                              <div key={label} className="space-y-1">
                                <div className="text-xs text-graystone-500">{label}</div>
                                <Input
                                  type="text"
                                  value={value}
                                  onChange={(event) => setter(event.target.value)}
                                  placeholder={placeholder}
                                  className="text-xs"
                                />
                              </div>
                            ))}
                          </div>
                          {generatedUtmUrl && (
                            <div className="space-y-1">
                              <div className="text-xs text-graystone-500">Generated URL</div>
                              <div className="break-all rounded-lg border border-graystone-200 bg-white px-3 py-2 text-xs text-graystone-700">
                                {generatedUtmUrl}
                              </div>
                              <button
                                type="button"
                                onClick={() => setUrl(generatedUtmUrl)}
                                className="text-xs font-medium text-ocean-700 hover:underline"
                              >
                                Use this URL
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="preview-file">Preview asset</Label>
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          id="preview-file"
                          type="file"
                          accept="image/*,application/pdf"
                          multiple
                          onChange={(event) => {
                            const files = Array.from(event.target.files || []) as File[];
                            files.forEach((file) => {
                              if (file.size > 512 * 1024) {
                                pushSyncToast?.(
                                  'Each preview file must be under 500 KB.',
                                  'warning',
                                );
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = () => {
                                if (typeof reader.result === 'string') {
                                  setAssetPreviews((prev) => {
                                    const next = [...prev, reader.result as string];
                                    if (!previewUrl) setPreviewUrl(next[0]);
                                    return next;
                                  });
                                }
                              };
                              reader.readAsDataURL(file);
                            });
                            event.target.value = '';
                          }}
                          className={cx(fileInputClasses, 'text-xs')}
                        />
                      </div>
                      {assetPreviews.length > 0 && (
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {assetPreviews.map((url, idx) => (
                            <div key={idx} className="group relative">
                              {url.startsWith('data:image/') ? (
                                <img
                                  src={url}
                                  alt={`Preview ${idx + 1}`}
                                  className="h-20 w-full rounded-lg border border-graystone-200 object-cover"
                                />
                              ) : (
                                <div className="flex h-20 w-full items-center justify-center rounded-lg border border-graystone-200 bg-graystone-50 text-xs text-graystone-500">
                                  {url.startsWith('data:application/pdf') ? 'PDF' : 'File'}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setAssetPreviews((prev) => {
                                    const next = prev.filter((_, i) => i !== idx);
                                    if (previewUrl === url) setPreviewUrl(next[0] || '');
                                    return next;
                                  });
                                }}
                                className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-white/90 text-graystone-600 shadow hover:text-rose-600 group-hover:flex"
                                aria-label={`Remove preview ${idx + 1}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <Input
                        id="previewUrl"
                        type="url"
                        value={previewUrl}
                        onChange={(event) => setPreviewUrl(event.target.value)}
                        placeholder="Or paste a preview URL"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label id="audience-segments-label">Audience segments</Label>
                      <AudienceSelector
                        value={audienceSegments}
                        onChange={setAudienceSegments}
                        labelledBy="audience-segments-label"
                      />
                    </div>

                    {(influencers.length > 0 || localInfluencers.length > 0) && (
                      <InfluencerPicker
                        influencers={[...influencers, ...localInfluencers]}
                        value={influencerId}
                        onChange={(id) => {
                          setInfluencerId(id);
                          onInfluencerChange?.(id);
                        }}
                        onCreateNew={() => {
                          setNewInfluencerName('');
                          setNewInfluencerPlatform('');
                          setShowNewInfluencerModal(true);
                        }}
                        showOnlyActive={false}
                        label="Influencer collaboration"
                      />
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="content-category">Content category</Label>
                      <select
                        id="content-category"
                        value={contentCategory}
                        onChange={(event) => setContentCategory(event.target.value)}
                        className={cx(selectBaseClasses, 'w-full')}
                      >
                        <option value="">Not tagged</option>
                        {CONTENT_CATEGORIES.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="contentPeak">Content peak / moment</Label>
                        <Input
                          id="contentPeak"
                          value={contentPeak}
                          onChange={(event) => setContentPeak(event.target.value)}
                          placeholder="World Population Day, COP, budget, research launch..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="partnerOrg">Partner organisation</Label>
                        <Input
                          id="partnerOrg"
                          value={partnerOrg}
                          onChange={(event) => setPartnerOrg(event.target.value)}
                          placeholder="Partner, coalition, or programme lead"
                        />
                      </div>
                      {partnerOrg && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="partnerIndividualName">Individual name</Label>
                            <Input
                              id="partnerIndividualName"
                              value={partnerIndividualName}
                              onChange={(e) => setPartnerIndividualName(e.target.value)}
                              placeholder="Name of the person featured or credited"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="partnerConsentStatus">Consent status</Label>
                            <select
                              id="partnerConsentStatus"
                              value={partnerConsentStatus}
                              onChange={(e) =>
                                setPartnerConsentStatus(
                                  e.target.value as 'confirmed' | 'pending' | 'not-required' | '',
                                )
                              }
                              className="w-full rounded-lg border border-graystone-300 px-3 py-2 text-sm"
                            >
                              <option value="">Select status</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="pending">Pending</option>
                              <option value="not-required">Not required</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="partnerCaptureContext">Capture context</Label>
                            <Input
                              id="partnerCaptureContext"
                              value={partnerCaptureContext}
                              onChange={(e) => setPartnerCaptureContext(e.target.value)}
                              placeholder="Where and how this image/content was captured"
                            />
                          </div>
                        </>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="seriesName">Series</Label>
                        <Input
                          id="seriesName"
                          value={seriesName}
                          onChange={(event) => setSeriesName(event.target.value)}
                          placeholder="Rights in practice, Myth-bust Monday..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="episodeNumber">Episode number</Label>
                        <Input
                          id="episodeNumber"
                          type="number"
                          min="1"
                          value={episodeNumber}
                          onChange={(event) => setEpisodeNumber(event.target.value)}
                          placeholder="1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="originContentId">Origin content ID</Label>
                      <Input
                        id="originContentId"
                        value={originContentId}
                        onChange={(event) => setOriginContentId(event.target.value)}
                        placeholder="Use when adapting an existing hub-and-spoke entry"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="priority-tier">Priority</Label>
                      <select
                        id="priority-tier"
                        value={priorityTier}
                        onChange={(event) => setPriorityTier(event.target.value)}
                        className={cx(selectBaseClasses, 'w-full sm:w-auto sm:min-w-[180px]')}
                      >
                        {PRIORITY_TIERS.map((tier) => (
                          <option key={tier} value={tier}>
                            {tier}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-4 rounded-2xl border border-graystone-200 bg-graystone-50 p-4">
                      <div>
                        <div className="text-sm font-semibold text-ocean-900">
                          Execution quality
                        </div>
                        <p className="mt-1 text-xs text-graystone-500">
                          These fields drive review readiness for links, accessibility, source
                          checking, and search intent.
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="alt-text-status">Alt text</Label>
                          <select
                            id="alt-text-status"
                            value={altTextStatus}
                            onChange={(event) => setAltTextStatus(event.target.value)}
                            className={cx(selectBaseClasses, 'w-full')}
                          >
                            {EXECUTION_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="subtitles-status">Subtitles / transcript</Label>
                          <select
                            id="subtitles-status"
                            value={subtitlesStatus}
                            onChange={(event) => setSubtitlesStatus(event.target.value)}
                            className={cx(selectBaseClasses, 'w-full')}
                          >
                            {EXECUTION_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="utm-status">UTM plan</Label>
                          <select
                            id="utm-status"
                            value={utmStatus}
                            onChange={(event) => setUtmStatus(event.target.value)}
                            className={cx(selectBaseClasses, 'w-full')}
                          >
                            {EXECUTION_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="link-placement">Link placement</Label>
                          <select
                            id="link-placement"
                            value={linkPlacement}
                            onChange={(event) => setLinkPlacement(event.target.value)}
                            className={cx(selectBaseClasses, 'w-full')}
                          >
                            <option value="">Not set</option>
                            {LINK_PLACEMENTS.map((placement) => (
                              <option key={placement} value={placement}>
                                {placement}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cta-type">CTA type</Label>
                          <select
                            id="cta-type"
                            value={ctaType}
                            onChange={(event) => setCtaType(event.target.value)}
                            className={cx(selectBaseClasses, 'w-full')}
                          >
                            <option value="">Select CTA</option>
                            {CTA_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="seoPrimaryQuery">SEO primary query</Label>
                          <Input
                            id="seoPrimaryQuery"
                            value={seoPrimaryQuery}
                            onChange={(event) => setSeoPrimaryQuery(event.target.value)}
                            placeholder="e.g. population decline myth, reproductive rights UK"
                          />
                        </div>
                      </div>

                      <label className="flex items-start gap-3 rounded-xl border border-graystone-200 bg-white px-3 py-3 text-sm text-graystone-700">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-graystone-300 text-ocean-600 focus:ring-ocean-500"
                          checked={sourceVerified}
                          onChange={(event) => setSourceVerified(event.target.checked)}
                        />
                        <span>
                          Source verified
                          <span className="block text-xs text-graystone-500">
                            Confirms facts, evidence source, and usage rights have been checked.
                          </span>
                        </span>
                      </label>
                    </div>

                    <div className="space-y-4">
                      <QuickAssessment values={quickAssessment} onChange={setQuickAssessment} />
                      <GoldenThreadCheck values={goldenThread} onChange={setGoldenThread} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {resolvedPlatforms.length > 0 ? (
              <PlatformGuidancePanel platforms={resolvedPlatforms} contentPillar={contentPillar} />
            ) : null}
          </div>

          {hasConflict && !overrideConflict ? (
            <div
              id="conflict-warning"
              ref={conflictWarningRef}
              tabIndex={-1}
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              <div className="font-semibold">
                Heads up: {conflicts.length} post{conflicts.length === 1 ? '' : 's'} already
                scheduled on this date.
              </div>
              <p className="mt-1 text-xs text-amber-700">
                Change the date above, or use the conflict override to keep this slot.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {hasConflict && !overrideConflict ? (
              <Button type="button" className="gap-2" onClick={handleSubmitAnyway}>
                <PlusIcon className="h-4 w-4" />
                Submit anyway
              </Button>
            ) : (
              <Button type="submit" className="gap-2">
                <PlusIcon className="h-4 w-4" />
                Submit to plan
              </Button>
            )}
            <Button type="button" variant="outline" onClick={reset}>
              Reset
            </Button>
          </div>
          {hasConflict && !overrideConflict && (
            <p className="text-xs text-amber-700">
              The main submit action is now the explicit conflict override for this entry.
            </p>
          )}
          {approvers.length > 0 && workflowBlockers.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="font-medium">Review blockers</div>
              <p className="mt-1 text-xs text-amber-700">
                This entry can be saved, but it will stay in Draft until these are completed.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                {workflowBlockers.map((item) => (
                  <li key={item.key}>{item.label}</li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </CardContent>

      {/* Quick-create influencer modal */}
      {showNewInfluencerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-base font-semibold text-graystone-900">New influencer</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-influencer-name">Name</Label>
                <Input
                  id="new-influencer-name"
                  value={newInfluencerName}
                  onChange={(e) => setNewInfluencerName(e.target.value)}
                  placeholder="Influencer name"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-influencer-platform">Platform</Label>
                <Input
                  id="new-influencer-platform"
                  value={newInfluencerPlatform}
                  onChange={(e) => setNewInfluencerPlatform(e.target.value)}
                  placeholder="Instagram, TikTok, YouTube..."
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewInfluencerModal(false)}
                className="rounded-xl px-4 py-2 text-sm text-graystone-600 hover:bg-graystone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateInfluencer}
                disabled={!newInfluencerName.trim() || !newInfluencerPlatform.trim()}
                className="rounded-xl bg-ocean-600 px-4 py-2 text-sm font-medium text-white hover:bg-ocean-500 disabled:opacity-40"
              >
                Add influencer
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default EntryForm;
