import React from 'react';
import { cx, ensureArray } from '../../lib/utils';
import { selectBaseClasses, fileInputClasses } from '../../lib/styles';
import { getPlatformCaption, isImageMedia, determineWorkflowStatus } from '../../lib/sanitizers';
import { appendAudit } from '../../lib/audit';
import { FALLBACK_GUIDELINES } from '../../lib/guidelines';
import { ALL_PLATFORMS, CAMPAIGNS, CONTENT_PILLARS, DEFAULT_APPROVERS } from '../../constants';
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
import { CopyCheckSection } from '../copy-check';
import { InfluencerPicker } from '../influencers';
import { QuickAssessment, GoldenThreadCheck } from '../assessment';
import { AudienceSelector } from './AudienceSelector';
import { PlatformGuidancePanel } from './PlatformGuidancePanel';
import { TerminologyAlert } from './TerminologyAlert';
import { checkTerminology } from '../../lib/terminology';

const { useState, useMemo, useEffect } = React;

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
  const [slidesCount, setSlidesCount] = useState(3);
  const [carouselSlides, setCarouselSlides] = useState(['', '', '']);
  const [firstComment, setFirstComment] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [overrideConflict, setOverrideConflict] = useState(false);
  const [platformCaptions, setPlatformCaptions] = useState({});
  const [activeCaptionTab, setActiveCaptionTab] = useState('Main');
  const [activePreviewPlatform, setActivePreviewPlatform] = useState('Main');
  const [campaign, setCampaign] = useState('');
  const [contentPillar, setContentPillar] = useState('');
  const [influencerId, setInfluencerId] = useState('');
  const [partnerOrg, setPartnerOrg] = useState('');
  const [partnerIndividualName, setPartnerIndividualName] = useState('');
  const [partnerConsentStatus, setPartnerConsentStatus] = useState('');
  const [partnerCaptureContext, setPartnerCaptureContext] = useState('');
  const [audienceSegments, setAudienceSegments] = useState([]);
  const [quickAssessment, setQuickAssessment] = useState({});
  const [goldenThread, setGoldenThread] = useState({});
  const [entryFormErrors, setEntryFormErrors] = useState([]);

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
    () => (existingEntries || []).filter((entry) => !entry.deletedAt && entry.date === date),
    [existingEntries, date],
  );
  const hasConflict = conflicts.length > 0;

  useEffect(() => {
    setOverrideConflict(false);
  }, [date]);

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
    setSlidesCount(3);
    setCarouselSlides(['', '', '']);
    setFirstComment('');
    setOverrideConflict(false);
    setPlatformCaptions({});
    setActiveCaptionTab('Main');
    setActivePreviewPlatform('Main');
    setCampaign('');
    setContentPillar('');
    setInfluencerId('');
    setPartnerOrg('');
    setPartnerIndividualName('');
    setPartnerConsentStatus('');
    setPartnerCaptureContext('');
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
    if (Object.values(goldenThread).some((v) => v === true))
      errors.push('Golden Thread check has failures — revise flagged items before submitting.');
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
      platformCaptions: cleanedCaptions,
      campaign: campaign || undefined,
      contentPillar: contentPillar || undefined,
      influencerId: influencerId || undefined,
      partnerOrg: partnerOrg || undefined,
      partnerIndividualName: partnerIndividualName || undefined,
      partnerConsentStatus: partnerConsentStatus || undefined,
      partnerCaptureContext: partnerCaptureContext || undefined,
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
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const errors = validateEntry();
    if (errors.length) {
      setEntryFormErrors(errors);
      return;
    }
    if (hasConflict && !overrideConflict) {
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
                <Label htmlFor="partnerOrg">Partner organisation</Label>
                <Input
                  id="partnerOrg"
                  value={partnerOrg}
                  onChange={(event) => setPartnerOrg(event.target.value)}
                  placeholder="Partner, coalition, or programme lead"
                />
                {partnerOrg && (
                  <>
                    <Label htmlFor="partnerIndividualName">Named individual</Label>
                    <Input
                      id="partnerIndividualName"
                      value={partnerIndividualName}
                      onChange={(e) => setPartnerIndividualName(e.target.value)}
                      placeholder="e.g. Amina Bello, community health worker, Kaduna"
                    />

                    <Label htmlFor="partnerConsentStatus">Consent status</Label>
                    <select
                      id="partnerConsentStatus"
                      value={partnerConsentStatus}
                      onChange={(e) => setPartnerConsentStatus(e.target.value)}
                      className={cx(selectBaseClasses, 'w-full')}
                    >
                      <option value="">— select —</option>
                      <option value="confirmed">Consent confirmed</option>
                      <option value="pending">Consent pending</option>
                      <option value="not-required">Not required</option>
                    </select>

                    <Label htmlFor="partnerCaptureContext">Capture context</Label>
                    <Input
                      id="partnerCaptureContext"
                      value={partnerCaptureContext}
                      onChange={(e) => setPartnerCaptureContext(e.target.value)}
                      placeholder="e.g. Photographed by E2P team, Kaduna, Feb 2026"
                    />
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label>Approvers</Label>
                <ApproverMulti
                  value={approvers}
                  onChange={setApprovers}
                  options={approverOptions}
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
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  <div className="font-semibold">
                    Heads up: {conflicts.length} post{conflicts.length === 1 ? '' : 's'} already
                    scheduled on this date.
                  </div>
                  <p className="mt-1 text-xs text-amber-700">
                    You can continue, but consider spacing things out.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={handleSubmitAnyway}>
                      Submit anyway
                    </Button>
                    <div className="flex items-center gap-2 text-xs text-amber-700">
                      <span>Try a different date:</span>
                      <Input
                        type="date"
                        value={date}
                        onChange={(event) => {
                          setOverrideConflict(false);
                          setDate(event.target.value);
                        }}
                        className="px-3 py-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label>Captions</Label>
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
                <CopyCheckSection
                  caption={caption}
                  platformCaptions={platformCaptions}
                  platforms={platforms}
                  assetType={assetType}
                  guidelines={guidelines}
                  currentUser={currentUser}
                  onApply={(platform, text, activeGuidelines) => {
                    if (platform === 'Main') {
                      setCaption(text);
                    } else {
                      setPlatformCaptions((prev) => ({ ...prev, [platform]: text }));
                    }
                    appendAudit({
                      user: currentUser,
                      action: 'copy-check-apply',
                      meta: { scope: 'form', platform, assetType },
                    });
                    if (window.api && window.api.enabled && teamsWebhookUrl) {
                      window.api
                        .notify({
                          teamsWebhookUrl,
                          message: `Copy check applied (${platform}) by ${currentUser}`,
                        })
                        .catch((error) => console.warn('Copy check notification failed', error));
                    }
                  }}
                />
                {terminologyMatches.length > 0 && <TerminologyAlert matches={terminologyMatches} />}
                <QuickAssessment values={quickAssessment} onChange={setQuickAssessment} />
                <GoldenThreadCheck values={goldenThread} onChange={setGoldenThread} />
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
                <Label htmlFor="previewUrl">Preview asset</Label>
                <Input
                  id="previewUrl"
                  type="url"
                  value={previewUrl}
                  onChange={(event) => setPreviewUrl(event.target.value)}
                  placeholder="https://cdn.example.com/assets/post.png"
                />
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
                      Clear preview
                    </Button>
                  )}
                </div>
                <p className="text-xs text-graystone-500">
                  Supports inline image previews in the modal.
                </p>
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
                      {Array.from({ length: 10 }, (_, index) => (
                        <option key={index + 1} value={index + 1}>
                          {index + 1}
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
            </div>

            <PlatformGuidancePanel platforms={platforms} contentPillar={contentPillar} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="gap-2" disabled={hasConflict && !overrideConflict}>
              <PlusIcon className="h-4 w-4" />
              Submit to plan
            </Button>
            <Button type="button" variant="outline" onClick={reset}>
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default EntryForm;
