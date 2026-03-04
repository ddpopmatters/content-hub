import React from 'react';
import { cx, ensureArray } from '../../lib/utils';
import { selectBaseClasses, fileInputClasses } from '../../lib/styles';
import { getPlatformCaption, isImageMedia, determineWorkflowStatus } from '../../lib/sanitizers';
import { FALLBACK_GUIDELINES } from '../../lib/guidelines';
import {
  ALL_PLATFORMS,
  CAMPAIGNS,
  CONTENT_PILLARS,
  DEFAULT_APPROVERS,
  PRIORITY_TIERS,
  PRIORITY_TIER_BADGE_CLASSES,
} from '../../constants';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  Badge,
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
import { checkTerminology } from '../../lib/terminology';

const { useState, useMemo, useEffect } = React;

const normalizeDateTimeLocal = (value) => {
  if (!value || typeof value !== 'string') return '';
  if (value.includes('T')) return value.slice(0, 16);
  return `${value}T17:00`;
};

export function EntryForm({
  onSubmit,
  existingEntries = [],
  onPreviewAssetType,
  guidelines = FALLBACK_GUIDELINES,
  currentUser = '',
  currentUserEmail = '',
  approverOptions = DEFAULT_APPROVERS,
  influencers = [],
  onInfluencerChange,
  teamsWebhookUrl = '',
  initialValues = null,
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [approvers, setApprovers] = useState([]);
  const currentAuthorName = useMemo(() => {
    if (currentUser && currentUser.trim().length) return currentUser.trim();
    if (currentUserEmail && currentUserEmail.trim().length) return currentUserEmail.trim();
    return '';
  }, [currentUser, currentUserEmail]);
  const [platforms, setPlatforms] = useState([]);
  const [allPlatforms, setAllPlatforms] = useState(false);
  const [caption, setCaption] = useState('');
  const [url, setUrl] = useState('');
  const [approvalDeadline, setApprovalDeadline] = useState('');
  const [assetType, setAssetType] = useState('No asset');
  const [script, setScript] = useState('');
  const [designCopy, setDesignCopy] = useState('');
  const [slidesCount, setSlidesCount] = useState(2);
  const [carouselSlides, setCarouselSlides] = useState(['', '']);
  const [firstComment, setFirstComment] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [overrideConflict, setOverrideConflict] = useState(false);
  const [platformCaptions, setPlatformCaptions] = useState({});
  const [activeCaptionTab, setActiveCaptionTab] = useState('Main');
  const [activePreviewPlatform, setActivePreviewPlatform] = useState('Main');
  const [campaign, setCampaign] = useState('');
  const [contentPillar, setContentPillar] = useState('');
  const [priorityTier, setPriorityTier] = useState('Medium');
  const [influencerId, setInfluencerId] = useState('');
  const [audienceSegments, setAudienceSegments] = useState([]);
  const [quickAssessment, setQuickAssessment] = useState({});
  const [goldenThread, setGoldenThread] = useState({});
  const [entryFormErrors, setEntryFormErrors] = useState([]);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!initialValues) return;

    const today = new Date().toISOString().slice(0, 10);
    const nextPlatforms = ensureArray(initialValues.platforms).filter((platform) =>
      ALL_PLATFORMS.includes(platform),
    );
    const nextAssetType = initialValues.assetType || 'No asset';
    const nextSlides = ensureArray(initialValues.carouselSlides).filter(
      (slide) => typeof slide === 'string',
    );
    const nextPlatformCaptions =
      initialValues.platformCaptions && typeof initialValues.platformCaptions === 'object'
        ? initialValues.platformCaptions
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
    setApprovalDeadline(normalizeDateTimeLocal(initialValues.approvalDeadline));
    setAssetType(nextAssetType);
    setScript(initialValues.script || '');
    setDesignCopy(initialValues.designCopy || '');
    if (nextSlides.length > 0) {
      setSlidesCount(nextSlides.length);
      setCarouselSlides(nextSlides);
    } else {
      setSlidesCount(3);
      setCarouselSlides(['', '', '']);
    }
    setFirstComment(initialValues.firstComment || '');
    setPreviewUrl(initialValues.previewUrl || '');
    setOverrideConflict(false);
    setPlatformCaptions(nextPlatformCaptions);
    setActiveCaptionTab('Main');
    setActivePreviewPlatform(nextPlatforms[0] || 'Main');
    setCampaign(initialValues.campaign || '');
    setContentPillar(initialValues.contentPillar || '');
    setPriorityTier(initialValues.priorityTier || 'Medium');
    setInfluencerId(initialValues.influencerId || '');
    setAudienceSegments(ensureArray(initialValues.audienceSegments));
    setQuickAssessment(initialValues.assessmentScores?.quick ?? {});
    setGoldenThread(initialValues.assessmentScores?.goldenThread ?? {});
    setEntryFormErrors([]);
    const hasAdvancedValues = !!(
      initialValues.campaign ||
      initialValues.contentPillar ||
      (initialValues.priorityTier && initialValues.priorityTier !== 'Medium') ||
      ensureArray(initialValues.audienceSegments).length > 0 ||
      initialValues.influencerId ||
      ensureArray(initialValues.approvers).length > 0 ||
      initialValues.approvalDeadline
    );
    setShowAdvanced(hasAdvancedValues);
  }, [initialValues]);

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

  useEffect(() => {
    setCarouselSlides((prev) => {
      if (slidesCount > prev.length) {
        return [...prev, ...Array(slidesCount - prev.length).fill('')];
      }
      if (slidesCount < prev.length) {
        return prev.slice(0, slidesCount);
      }
      return prev;
    });
  }, [slidesCount]);

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
    setPreviewUrl('');
    setAssetType('No asset');
    setScript('');
    setDesignCopy('');
    setSlidesCount(2);
    setCarouselSlides(['', '']);
    setFirstComment('');
    setOverrideConflict(false);
    setPlatformCaptions({});
    setActiveCaptionTab('Main');
    setActivePreviewPlatform('Main');
    setCampaign('');
    setContentPillar('');
    setPriorityTier('Medium');
    setInfluencerId('');
    setAudienceSegments([]);
    setQuickAssessment({});
    setGoldenThread({});
    setEntryFormErrors([]);
    onPreviewAssetType?.(null);
  };

  const validateEntry = () => {
    const errors = [];
    if (!date) errors.push('Date is required.');
    const resolvedPlatforms = allPlatforms ? [...ALL_PLATFORMS] : platforms;
    if (!resolvedPlatforms.length) errors.push('At least one platform is required.');
    if (!assetType) errors.push('Asset type is required.');
    if (assetType === 'Video' && !script.trim()) errors.push('Video script is required.');
    if (assetType === 'Design' && !designCopy.trim()) errors.push('Design copy is required.');
    if (
      assetType === 'Carousel' &&
      !carouselSlides.some((slide) => typeof slide === 'string' && slide.trim())
    )
      errors.push('At least one carousel slide needs copy.');
    return errors;
  };

  const derivedAuthor = currentAuthorName || currentUserEmail || '';

  const submitEntry = () => {
    const cleanedCaptions = {};
    platforms.forEach((platform) => {
      const value = platformCaptions[platform];
      if (value && value.trim()) cleanedCaptions[platform] = value;
    });
    onSubmit({
      date,
      approvers,
      author: derivedAuthor || undefined,
      platforms: ensureArray(allPlatforms ? [...ALL_PLATFORMS] : platforms),
      caption,
      url: url || undefined,
      approvalDeadline: approvalDeadline || undefined,
      previewUrl: previewUrl || undefined,
      assetType,
      script: assetType === 'Video' ? script : undefined,
      designCopy: assetType === 'Design' ? designCopy : undefined,
      carouselSlides: assetType === 'Carousel' ? carouselSlides : undefined,
      firstComment,
      priorityTier,
      platformCaptions: cleanedCaptions,
      campaign: campaign || undefined,
      contentPillar: contentPillar || undefined,
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
      workflowStatus: determineWorkflowStatus({ approvers, assetType, previewUrl }),
    });
    reset();
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 2500);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const errors = validateEntry();
    if (errors.length) {
      setEntryFormErrors(errors);
      return;
    }
    if (hasConflict && !overrideConflict) {
      setEntryFormErrors([
        'Scheduling conflict on this date — use "Submit anyway" in the warning below, or pick a different date.',
      ]);
      document
        .getElementById('conflict-warning')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setEntryFormErrors([]);
    submitEntry();
  };

  const handleSubmitAnyway = () => {
    const errors = validateEntry();
    if (errors.length) {
      setEntryFormErrors(errors);
      return;
    }
    setOverrideConflict(true);
    setEntryFormErrors([]);
    submitEntry();
  };

  const terminologyMatches = useMemo(() => (caption ? checkTerminology(caption) : []), [caption]);
  const captionTabs = useMemo(() => ['Main', ...platforms], [platforms]);
  const currentCaptionValue =
    activeCaptionTab === 'Main' ? caption : (platformCaptions[activeCaptionTab] ?? caption);
  const previewPlatforms = platforms.length ? platforms : ['Main'];
  const effectivePreviewPlatform = previewPlatforms.includes(activePreviewPlatform)
    ? activePreviewPlatform
    : previewPlatforms[0] || 'Main';
  const previewCaption = getPlatformCaption(caption, platformCaptions, effectivePreviewPlatform);
  const previewIsImage = isImageMedia(previewUrl);
  const previewIsVideo = previewUrl && /\.(mp4|webm|ogg)$/i.test(previewUrl);

  const advancedFilledCount = [
    campaign,
    contentPillar,
    priorityTier !== 'Medium',
    audienceSegments.length > 0,
    influencerId,
    approvers.length > 0,
    !!approvalDeadline,
  ].filter(Boolean).length;

  const handleCaptionChange = (value) => {
    if (activeCaptionTab === 'Main') {
      setCaption(value);
    } else {
      setPlatformCaptions((prev) => ({
        ...prev,
        [activeCaptionTab]: value,
      }));
    }
  };

  const handlePlatformToggle = (platform, checked) => {
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

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-xl text-ocean-900">Create Content</CardTitle>
      </CardHeader>
      <CardContent>
        {entryFormErrors.length ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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
          <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-6">
              {/* ── Core fields ─────────────────────────────────────────── */}

              <div className="space-y-2">
                <Label htmlFor="entry-date">Date</Label>
                <Input
                  id="entry-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Platforms</Label>
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
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-2">
                    {ALL_PLATFORMS.map((platform) => (
                      <label
                        key={platform}
                        className="flex items-center gap-2 rounded-xl border border-graystone-200 bg-white px-3 py-2 text-sm text-graystone-700 shadow-sm hover:border-graystone-300"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-graystone-300"
                          checked={platforms.includes(platform)}
                          onChange={(event) => handlePlatformToggle(platform, event.target.checked)}
                        />
                        <PlatformIcon platform={platform} />
                        <span>{platform}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {hasConflict && (
                <div
                  id="conflict-warning"
                  className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800"
                >
                  <div className="font-semibold">
                    Heads up: {conflicts.length} post{conflicts.length === 1 ? '' : 's'} already
                    scheduled on this date.
                  </div>
                  <p className="mt-1 text-xs text-amber-700">
                    You can continue, or pick a different date above.
                  </p>
                  <div className="mt-3">
                    <Button size="sm" onClick={handleSubmitAnyway}>
                      Submit anyway
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label>Captions</Label>
                {captionTabs.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {captionTabs.map((tab) => (
                      <Button
                        key={tab}
                        type="button"
                        size="sm"
                        variant={activeCaptionTab === tab ? 'solid' : 'outline'}
                        onClick={() => setActiveCaptionTab(tab)}
                      >
                        {tab === 'Main' ? 'Main caption' : tab}
                      </Button>
                    ))}
                  </div>
                )}
                <Textarea
                  value={currentCaptionValue}
                  onChange={(event) => handleCaptionChange(event.target.value)}
                  rows={4}
                  placeholder="Primary post caption"
                />
                <p className="text-xs text-graystone-500">
                  {activeCaptionTab === 'Main'
                    ? 'Changes here apply to every platform unless you customise a specific tab.'
                    : `${activeCaptionTab} caption overrides the main copy for that platform.`}
                </p>
                {terminologyMatches.length > 0 && <TerminologyAlert matches={terminologyMatches} />}
              </div>

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

              <div className="space-y-3">
                <Label>Preview asset</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files && event.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          setPreviewUrl(reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                    className={cx(fileInputClasses, 'text-xs')}
                  />
                  {previewUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewUrl('')}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <Input
                  id="previewUrl"
                  type="url"
                  value={previewUrl}
                  onChange={(event) => setPreviewUrl(event.target.value)}
                  placeholder="Or paste an image URL"
                />
              </div>

              <div className="space-y-2">
                <Label>Asset type</Label>
                <select
                  value={assetType}
                  onChange={(event) => setAssetType(event.target.value)}
                  className={cx(selectBaseClasses, 'w-full')}
                >
                  <option value="No asset">No asset</option>
                  <option value="Video">Video</option>
                  <option value="Design">Design</option>
                  <option value="Carousel">Carousel</option>
                </select>
              </div>

              {assetType === 'Video' && (
                <div className="space-y-2">
                  <Label htmlFor="script">Script</Label>
                  <Textarea
                    id="script"
                    value={script}
                    onChange={(event) => setScript(event.target.value)}
                    rows={4}
                  />
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
                  />
                </div>
              )}

              {assetType === 'Carousel' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Number of slides</Label>
                    <select
                      value={String(slidesCount)}
                      onChange={(event) => setSlidesCount(Number(event.target.value))}
                      className={cx(selectBaseClasses, 'w-full')}
                    >
                      {Array.from({ length: 9 }, (_, index) => (
                        <option key={index + 2} value={index + 2}>
                          {index + 2}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    {carouselSlides.map((val, idx) => (
                      <div key={idx} className="space-y-2">
                        <Label>Slide {idx + 1} copy</Label>
                        <Textarea
                          value={val}
                          onChange={(event) =>
                            setCarouselSlides((prev) =>
                              prev.map((slide, slideIndex) =>
                                slideIndex === idx ? event.target.value : slide,
                              ),
                            )
                          }
                          placeholder={`Copy for slide ${idx + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="firstComment">First comment</Label>
                <Textarea
                  id="firstComment"
                  value={firstComment}
                  onChange={(event) => setFirstComment(event.target.value)}
                  placeholder="Hashtags, context, extra links"
                  rows={3}
                />
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
                    Advanced options
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
                      <Label>Campaign</Label>
                      <select
                        value={campaign}
                        onChange={(event) => setCampaign(event.target.value)}
                        className={cx(selectBaseClasses, 'w-full')}
                      >
                        <option value="">No campaign</option>
                        {CAMPAIGNS.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Content pillar</Label>
                      <select
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

                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <select
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

                    <div className="space-y-2">
                      <Label>Audience segments</Label>
                      <AudienceSelector value={audienceSegments} onChange={setAudienceSegments} />
                    </div>

                    {influencers.length > 0 && (
                      <InfluencerPicker
                        influencers={influencers}
                        value={influencerId}
                        onChange={(id) => {
                          setInfluencerId(id);
                          onInfluencerChange?.(id);
                        }}
                        showOnlyActive={true}
                        label="Influencer collaboration"
                      />
                    )}

                    <div className="space-y-2">
                      <Label>Approvers</Label>
                      <ApproverMulti
                        value={approvers}
                        onChange={setApprovers}
                        options={approverOptions}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="approvalDeadline">Approval deadline</Label>
                      <Input
                        id="approvalDeadline"
                        type="datetime-local"
                        value={approvalDeadline}
                        onChange={(event) => setApprovalDeadline(event.target.value)}
                        className="w-full"
                      />
                      <p className="text-xs text-graystone-500">
                        Let approvers know when you need a decision by (optional).
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <PlatformGuidancePanel platforms={platforms} contentPillar={contentPillar} />
          </div>

          <div className="space-y-4">
            <QuickAssessment values={quickAssessment} onChange={setQuickAssessment} />
            <GoldenThreadCheck values={goldenThread} onChange={setGoldenThread} />
          </div>

          {submitSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              Post added to the plan
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="gap-2">
              <PlusIcon className="h-4 w-4" />
              Submit to plan
            </Button>
            <Button type="button" variant="outline" onClick={reset}>
              Reset
            </Button>
          </div>
          {hasConflict && !overrideConflict && (
            <p className="text-xs text-amber-700">
              Resolve the scheduling conflict above before submitting.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export default EntryForm;
