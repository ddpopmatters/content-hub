import React, { useState, useCallback } from 'react';
import { Button } from '../../components/ui';
import { PlatformIcon } from '../../components/common';
import { getPlatformCaption, FALLBACK_GUIDELINES } from '../../lib';
import { type Platform } from '../../constants';
import type { Guidelines } from '../../types/models';
import {
  normalizeCopyCheckResult,
  type CopyCheckPayload,
  type CopyCheckResult,
} from '../../lib/copyCheck';
import { useCopyCheck } from '../../hooks/useCopyCheck';

export interface CopyCheckSectionProps {
  /** Main caption text to check */
  caption: string;
  /** Platform-specific caption overrides */
  platformCaptions: Partial<Record<Platform, string>>;
  /** List of platforms to check */
  platforms: Platform[];
  /** Asset type for context */
  assetType: string;
  /** Brand guidelines configuration */
  guidelines: Guidelines | null;
  /** Callback when a suggestion is applied */
  onApply: (platform: Platform, text: string, guidelines: Guidelines) => void;
}

export function CopyCheckSection({
  caption,
  platformCaptions,
  platforms,
  assetType,
  guidelines,
  onApply,
}: CopyCheckSectionProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Record<Platform, CopyCheckResult>>(
    {} as Record<Platform, CopyCheckResult>,
  );
  const runCopyCheck = useCopyCheck();

  const safeGuidelines: Guidelines =
    guidelines && typeof guidelines === 'object' ? guidelines : FALLBACK_GUIDELINES;
  const selectedPlatforms: Platform[] = platforms && platforms.length ? platforms : ['LinkedIn'];

  const runChecks = useCallback(async () => {
    setLoading(true);
    setError('');
    // Clear stale results for platforms being checked to prevent applying outdated suggestions
    setResults((prev) => {
      const next = { ...prev };
      selectedPlatforms.forEach((p) => delete next[p]);
      return next;
    });
    try {
      const tasks = selectedPlatforms.map(async (platform) => {
        const maxChars = safeGuidelines.charLimits?.[platform] ?? 280;
        const effectiveAssetType = assetType === 'No asset' ? 'Design' : assetType;
        const payload: CopyCheckPayload = {
          text: getPlatformCaption(caption, platformCaptions, platform),
          platform,
          assetType: effectiveAssetType,
          readingLevelTarget: 'Grade 7',
          constraints: { maxChars, maxHashtags: 10, requireCTA: true },
          brand: {
            bannedWords: safeGuidelines.bannedWords || [],
            requiredPhrases: safeGuidelines.requiredPhrases || [],
            tone: { confident: 0.8, compassionate: 0.7, evidenceLed: 1.0 },
          },
        };
        return { platform, data: normalizeCopyCheckResult(await runCopyCheck(payload)) };
      });
      const settled = await Promise.allSettled(tasks);
      const successes: Record<Platform, CopyCheckResult> = {} as Record<Platform, CopyCheckResult>;
      const failures: unknown[] = [];
      settled.forEach((result) => {
        if (result.status === 'fulfilled') {
          successes[result.value.platform] = result.value.data;
        } else {
          failures.push(result.reason);
        }
      });
      if (Object.keys(successes).length) {
        setResults((prev) => ({ ...prev, ...successes }));
      }
      if (failures.length) {
        setError(
          `Copy check failed for ${failures.length} platform${failures.length > 1 ? 's' : ''}.`,
        );
      } else {
        setError('');
      }
    } catch (e) {
      setError((e as Error)?.message || 'Copy check failed');
    } finally {
      setLoading(false);
    }
  }, [selectedPlatforms, safeGuidelines, assetType, caption, platformCaptions, runCopyCheck]);

  const handleApply = useCallback(
    (platform: Platform, text: string) => {
      onApply(platform, text, safeGuidelines);
    },
    [onApply, safeGuidelines],
  );

  const handleReject = useCallback((platform: Platform) => {
    setResults((prev) => {
      const next = { ...prev };
      delete next[platform];
      return next;
    });
  }, []);

  const handleApplyAll = useCallback(() => {
    selectedPlatforms.forEach((p) => {
      const text = results[p]?.suggestion?.text;
      if (text) onApply(p, text, safeGuidelines);
    });
  }, [selectedPlatforms, results, onApply, safeGuidelines]);

  return (
    <div className="rounded-2xl border border-aqua-200 bg-aqua-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-ocean-700">AI Copy Checker</div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setOpen(true);
              runChecks();
            }}
            disabled={loading}
          >
            {loading ? 'Checking…' : 'Copy check'}
          </Button>
          {open ? (
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Hide
            </Button>
          ) : null}
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {selectedPlatforms.map((platform) => {
            const r = results[platform];
            return (
              <div
                key={platform}
                className="rounded-xl border border-graystone-200 bg-white p-3 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ocean-700">
                    <PlatformIcon platform={platform} />
                    {platform}
                  </div>
                  {r?.score ? (
                    <div className="flex items-center gap-2 text-[11px] text-graystone-600">
                      <span>RL: {r.score.readingLevel}</span>
                      <span>Clarity {(r.score.clarity * 100) | 0}%</span>
                      <span>Brevity {(r.score.brevity * 100) | 0}%</span>
                    </div>
                  ) : null}
                </div>
                <textarea
                  className="w-full rounded-2xl border border-graystone-200 px-3 py-2 text-sm shadow-sm focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-aqua-200"
                  rows={3}
                  readOnly
                  value={r?.suggestion?.text || ''}
                  placeholder={loading ? 'Generating suggestion…' : 'No suggestion yet'}
                />
                {r?.flags && r.flags.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.flags.map((f, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApply(platform, r?.suggestion?.text || '')}
                    disabled={!r || !r.suggestion?.text}
                  >
                    Apply
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleReject(platform)}>
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
          {Object.keys(results).length > 1 ? (
            <div className="flex items-center justify-end">
              <Button size="sm" onClick={handleApplyAll}>
                Apply all
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default CopyCheckSection;
