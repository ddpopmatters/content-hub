import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '../../components/ui';
import { PlatformIcon, CheckCircleIcon } from '../../components/common';
import { PLATFORM_METRICS } from '../../constants';
import type { Entry } from '../../types/models';

interface AnalyticsInputWizardProps {
  entries: Entry[];
  onSave: (entryId: string, analytics: Record<string, Record<string, number>>) => void;
  onClose: () => void;
}

// Step -1 = entry selection, 0..n-1 = platform steps, n = review
type WizardStep = 'select' | number | 'review';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function captionSnippet(entry: Entry): string {
  const text = entry.caption || entry.firstComment || '';
  return text.length > 80 ? text.slice(0, 77) + '…' : text;
}

export const AnalyticsInputWizard: React.FC<AnalyticsInputWizardProps> = ({
  entries,
  onSave,
  onClose,
}) => {
  const [step, setStep] = useState<WizardStep>('select');
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [search, setSearch] = useState('');
  // draft: { platform: { metricKey: value } }
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({});
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Approved entries with at least one platform, sorted newest first
  const candidateEntries = useMemo(
    () =>
      entries
        .filter((e) => e.status === 'Approved' && e.platforms?.length > 0)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return candidateEntries;
    return candidateEntries.filter(
      (e) =>
        (e.caption || '').toLowerCase().includes(q) ||
        (e.date || '').includes(q) ||
        e.platforms.some((p) => p.toLowerCase().includes(q)),
    );
  }, [candidateEntries, search]);

  // Platforms for the selected entry that have PLATFORM_METRICS defined
  const platforms = useMemo(
    () =>
      (selectedEntry?.platforms ?? []).filter(
        (p) => p in PLATFORM_METRICS,
      ) as (keyof typeof PLATFORM_METRICS)[],
    [selectedEntry],
  );

  // Pre-populate draft from existing entry analytics
  const selectEntry = (entry: Entry) => {
    setSelectedEntry(entry);
    const initial: Record<string, Record<string, string>> = {};
    (entry.platforms ?? []).forEach((p) => {
      const existing = (entry.analytics?.[p] ?? {}) as Record<string, number>;
      initial[p] = {};
      (PLATFORM_METRICS[p as keyof typeof PLATFORM_METRICS] ?? []).forEach(({ key }) => {
        initial[p][key] = existing[key] != null ? String(existing[key]) : '';
      });
    });
    setDraft(initial);
    setStep(0);
  };

  // Focus first input when step changes
  useEffect(() => {
    if (step !== 'select' && step !== 'review') {
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [step]);

  // Keyboard: Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const currentPlatformIndex = typeof step === 'number' ? step : 0;
  const currentPlatform = platforms[currentPlatformIndex];

  const advance = () => {
    if (typeof step === 'number') {
      if (step < platforms.length - 1) setStep(step + 1);
      else setStep('review');
    }
  };

  const back = () => {
    if (step === 'review') setStep(platforms.length - 1);
    else if (typeof step === 'number' && step > 0) setStep(step - 1);
    else setStep('select');
  };

  const setMetric = (platform: string, key: string, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [key]: value },
    }));
  };

  const handleSave = () => {
    if (!selectedEntry) return;
    // Merge draft into existing analytics (so we don't wipe unrelated platforms)
    const merged: Record<string, Record<string, number>> = {
      ...(selectedEntry.analytics as Record<string, Record<string, number>>),
    };
    const draftEntries = Object.entries(draft) as Array<[string, Record<string, string>]>;
    draftEntries.forEach(([platform, metrics]) => {
      const nums: Record<string, number> = { ...(merged[platform] ?? {}) };
      Object.entries(metrics).forEach(([key, val]) => {
        const n = parseFloat(val);
        if (!isNaN(n)) nums[key] = n;
      });
      merged[platform] = nums;
    });
    onSave(selectedEntry.id, merged);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
          e.preventDefault();
          onClose();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-graystone-100 px-6 py-4">
          <div>
            <h2 className="heading-font text-lg font-semibold text-ocean-900">Log metrics</h2>
            {selectedEntry && step !== 'select' && (
              <p className="mt-0.5 text-xs text-graystone-500">
                {formatDate(selectedEntry.date)} &mdash;{' '}
                {captionSnippet(selectedEntry) || selectedEntry.assetType}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-graystone-400 hover:bg-graystone-100 hover:text-graystone-700"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* ── ENTRY SELECTION ── */}
          {step === 'select' && (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Search by caption, date, or platform…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-graystone-200 px-3 py-2 text-sm focus:border-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-200"
              />
              {filteredEntries.length === 0 && (
                <p className="text-sm text-graystone-500">No approved entries found.</p>
              )}
              <ul className="space-y-2">
                {filteredEntries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      onClick={() => selectEntry(entry)}
                      className="w-full rounded-xl border border-graystone-200 px-4 py-3 text-left transition hover:border-ocean-400 hover:bg-ocean-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-ocean-700">
                          {formatDate(entry.date)}
                        </span>
                        <div className="flex gap-1">
                          {entry.platforms.map((p) => (
                            <React.Fragment key={p}>
                              <PlatformIcon platform={p} size="xs" />
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-graystone-700">
                        {captionSnippet(entry) || entry.assetType}
                      </p>
                      {entry.analyticsUpdatedAt && (
                        <p className="mt-1 text-[11px] text-graystone-400">
                          Last updated {formatDate(entry.analyticsUpdatedAt)}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── PLATFORM METRIC INPUT ── */}
          {typeof step === 'number' && currentPlatform && (
            <div className="space-y-4">
              {/* Progress */}
              <div className="flex items-center gap-2">
                {platforms.map((p, i) => (
                  <React.Fragment key={p}>
                    <div
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        i === currentPlatformIndex
                          ? 'bg-ocean-500 text-white'
                          : i < currentPlatformIndex
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-graystone-100 text-graystone-400'
                      }`}
                    >
                      {i < currentPlatformIndex && <CheckCircleIcon className="h-3 w-3" />}
                      <PlatformIcon platform={p} size="xs" />
                      {p}
                    </div>
                  </React.Fragment>
                ))}
              </div>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-3">
                {(PLATFORM_METRICS[currentPlatform] ?? []).map(({ key, label, hint }, i) => (
                  <div key={key} className="space-y-1">
                    <label className="block text-xs font-medium text-graystone-700">{label}</label>
                    {hint && <p className="text-[10px] text-graystone-400">{hint}</p>}
                    <input
                      ref={i === 0 ? firstInputRef : undefined}
                      type="number"
                      min="0"
                      placeholder="—"
                      value={draft[currentPlatform]?.[key] ?? ''}
                      onChange={(e) => setMetric(currentPlatform, key, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && advance()}
                      className="w-full rounded-lg border border-graystone-200 px-3 py-2 text-sm focus:border-ocean-400 focus:outline-none focus:ring-2 focus:ring-ocean-200"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-graystone-400">
                Press Enter to advance · leave blank to skip a metric
              </p>
            </div>
          )}

          {/* ── REVIEW ── */}
          {step === 'review' && (
            <div className="space-y-4">
              <p className="text-sm text-graystone-600">
                Review before saving. Empty fields will not overwrite existing data.
              </p>
              {platforms.map((platform) => {
                const fields = PLATFORM_METRICS[platform] ?? [];
                const platformDraft = draft[platform] ?? {};
                const hasAny = fields.some(({ key }) => platformDraft[key]);
                return (
                  <div key={platform}>
                    <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ocean-900">
                      <PlatformIcon platform={platform} size="xs" />
                      {platform}
                      {!hasAny && (
                        <span className="text-xs font-normal text-graystone-400">(no data)</span>
                      )}
                    </div>
                    {hasAny && (
                      <div className="grid grid-cols-3 gap-x-4 gap-y-1 rounded-lg bg-graystone-50 px-3 py-2">
                        {fields.map(({ key, label }) => {
                          const val = platformDraft[key];
                          if (!val) return null;
                          return (
                            <div key={key}>
                              <div className="text-[10px] text-graystone-400">{label}</div>
                              <div className="text-sm font-medium text-graystone-800">
                                {Number(val).toLocaleString()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'select' && (
          <div className="flex items-center justify-between border-t border-graystone-100 px-6 py-4">
            <Button variant="ghost" onClick={back}>
              Back
            </Button>
            {step === 'review' ? (
              <Button onClick={handleSave}>Save metrics</Button>
            ) : (
              <Button onClick={advance}>
                {typeof step === 'number' && step < platforms.length - 1
                  ? 'Next platform'
                  : 'Review'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsInputWizard;
