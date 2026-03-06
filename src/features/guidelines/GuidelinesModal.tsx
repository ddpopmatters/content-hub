import React, { useState, useEffect } from 'react';
import { Modal, Button, Label } from '../../components/ui';
import {
  ALL_PLATFORMS,
  PLATFORM_DEFAULT_LIMITS,
  PLATFORM_TIPS,
  TERMINOLOGY_MAP,
} from '../../constants';
import type { Guidelines } from '../../types/models';

type Tab = 'terminology' | 'voice' | 'platforms' | 'brand';

const TABS: { key: Tab; label: string }[] = [
  { key: 'terminology', label: 'Terminology' },
  { key: 'voice', label: 'Voice & Tone' },
  { key: 'platforms', label: 'Platform Tips' },
  { key: 'brand', label: 'Brand' },
];

interface GuidelinesDraft {
  bannedWordsText: string;
  requiredPhrasesText: string;
  languageGuide: string;
  hashtagTips: string;
  charLimits: Record<string, number>;
}

export interface GuidelinesModalProps {
  open: boolean;
  guidelines: Guidelines | null;
  onClose: () => void;
  onSave: (guidelines: Guidelines) => void;
  isAdmin?: boolean;
  teamsWebhookUrl?: string;
  onSaveWebhookUrl?: (url: string) => void;
}

const buildDraft = (source: Guidelines | null): GuidelinesDraft => ({
  bannedWordsText: (source?.bannedWords || []).join(', '),
  requiredPhrasesText: (source?.requiredPhrases || []).join(', '),
  languageGuide: source?.languageGuide || '',
  hashtagTips: source?.hashtagTips || '',
  charLimits: { ...(source?.charLimits || {}) },
});

const splitList = (value: string): string[] =>
  String(value || '')
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

const VOICE_PRINCIPLES = [
  {
    title: 'Bold & confident',
    description:
      'We speak with authority on population-environment interlinkages. We are not apologetic about our position.',
  },
  {
    title: 'Evidence-based',
    description:
      'Every claim is backed by data. We cite sources and use statistics to build credibility, not emotion alone.',
  },
  {
    title: 'Rights-forward',
    description:
      'Reproductive rights and bodily autonomy are central to everything we say. Women and girls are empowered protagonists, not variables.',
  },
  {
    title: 'Warm & human',
    description:
      'We tell human stories. We avoid clinical or academic language. We connect policy to people.',
  },
  {
    title: 'Inclusive & respectful',
    description:
      'We never blame specific populations. We frame population pressures around systemic access, not individual behaviour.',
  },
];

const PLATFORM_REGISTER: Record<string, string> = {
  Instagram:
    'Visual-first, conversational, emoji-light. Reels captions punchy and front-loaded. Carousel text scannable.',
  LinkedIn:
    'Professional but not corporate. Thought leadership tone. Longer narrative OK. Data-rich.',
  YouTube:
    'Conversational, accessible. Scripts written for speaking aloud. Hook in first 5 seconds.',
  Facebook: 'Warm, community-oriented. Slightly more formal than Instagram. Encourage discussion.',
  BlueSky: 'Concise, witty, topical. Thread-friendly. Link to longer content where possible.',
};

function TerminologyTab({ termFilter }: { termFilter: string }): React.ReactElement {
  const lowerFilter = termFilter.toLowerCase();
  const filtered = TERMINOLOGY_MAP.filter(
    (t) =>
      !termFilter ||
      t.neverUse.toLowerCase().includes(lowerFilter) ||
      t.useInstead.toLowerCase().includes(lowerFilter),
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-graystone-500">
        These terms must never appear in external-facing content. Use the suggested alternatives.
      </p>
      <div className="space-y-2">
        {filtered.map((t) => (
          <div
            key={t.neverUse}
            className="flex items-start gap-3 rounded-xl border border-graystone-100 bg-graystone-50 px-3 py-2"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">
                  Never use
                </span>
                <span className="text-xs font-medium text-graystone-800">{t.neverUse}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Use instead
                </span>
                <span className="text-xs text-graystone-600">{t.useInstead}</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-4 text-center text-xs text-graystone-400">No matches</p>
        )}
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        <span className="font-semibold">Core principle:</span> The problem is never people — it is
        lack of access to rights, education, and healthcare. Women and girls are empowered
        protagonists, not variables in a population equation.
      </div>
    </div>
  );
}

function VoiceToneTab(): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="heading-font text-xs font-semibold text-graystone-800">Voice principles</h3>
        {VOICE_PRINCIPLES.map((v) => (
          <div
            key={v.title}
            className="rounded-xl border border-graystone-100 bg-graystone-50 px-3 py-2"
          >
            <div className="text-xs font-semibold text-graystone-800">{v.title}</div>
            <div className="mt-0.5 text-xs text-graystone-600">{v.description}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <h3 className="heading-font text-xs font-semibold text-graystone-800">Platform register</h3>
        <p className="text-xs text-graystone-500">Same voice, different register per platform.</p>
        {ALL_PLATFORMS.map((p) => (
          <div key={p} className="rounded-xl border border-graystone-100 bg-graystone-50 px-3 py-2">
            <div className="text-xs font-semibold text-ocean-700">{p}</div>
            <div className="mt-0.5 text-xs text-graystone-600">
              {PLATFORM_REGISTER[p] || 'No register defined.'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformTipsTab(): React.ReactElement {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <p className="text-xs text-graystone-500">
        Content Creation Guide tips per platform. Click to expand.
      </p>
      {ALL_PLATFORMS.map((p) => {
        const tips = PLATFORM_TIPS[p] || [];
        const isOpen = expanded === p;
        return (
          <div key={p} className="rounded-xl border border-graystone-100 bg-graystone-50">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left"
              onClick={() => setExpanded(isOpen ? null : p)}
            >
              <span className="text-xs font-semibold text-graystone-800">{p}</span>
              <span className="text-xs text-graystone-400">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && (
              <ul className="space-y-1 border-t border-graystone-100 px-3 py-2">
                {tips.map((tip, i) => (
                  <li key={i} className="text-xs text-graystone-600">
                    <span className="mr-1 text-ocean-500">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BrandTab({
  draft,
  setDraft,
  isAdmin,
  webhookDraft,
  setWebhookDraft,
  teamsWebhookUrlProp: _teamsWebhookUrlProp,
}: {
  draft: GuidelinesDraft;
  setDraft: React.Dispatch<React.SetStateAction<GuidelinesDraft>>;
  isAdmin?: boolean;
  webhookDraft: string;
  setWebhookDraft: React.Dispatch<React.SetStateAction<string>>;
  teamsWebhookUrlProp?: string;
}): React.ReactElement {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Banned words (comma or line separated)</Label>
        <textarea
          className="w-full rounded-2xl border border-graystone-200 px-3 py-2 text-sm shadow-sm focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-aqua-200"
          rows={3}
          value={draft.bannedWordsText}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, bannedWordsText: event.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Required phrases (comma or line separated)</Label>
        <textarea
          className="w-full rounded-2xl border border-graystone-200 px-3 py-2 text-sm shadow-sm focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-aqua-200"
          rows={3}
          value={draft.requiredPhrasesText}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, requiredPhrasesText: event.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Language guide</Label>
        <textarea
          className="w-full rounded-2xl border border-graystone-200 px-3 py-2 text-sm shadow-sm focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-aqua-200"
          rows={4}
          value={draft.languageGuide}
          onChange={(event) => setDraft((prev) => ({ ...prev, languageGuide: event.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label>Hashtag recommendations</Label>
        <textarea
          className="w-full rounded-2xl border border-graystone-200 px-3 py-2 text-sm shadow-sm focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-aqua-200"
          rows={3}
          value={draft.hashtagTips}
          onChange={(event) => setDraft((prev) => ({ ...prev, hashtagTips: event.target.value }))}
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Character limit best practices</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                charLimits: { ...PLATFORM_DEFAULT_LIMITS },
              }))
            }
          >
            Reset defaults
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-3">
          {ALL_PLATFORMS.map((platform) => (
            <label
              key={platform}
              className="flex flex-col gap-1 rounded-2xl border border-graystone-200 bg-white px-3 py-2 shadow-sm"
            >
              <span className="font-semibold text-graystone-600">{platform}</span>
              <input
                type="number"
                min={1}
                className="dropdown-font w-full rounded-full border border-black px-3 py-1 text-xs"
                value={draft.charLimits?.[platform] ?? PLATFORM_DEFAULT_LIMITS[platform] ?? ''}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    charLimits: {
                      ...prev.charLimits,
                      [platform]: Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
          ))}
        </div>
      </div>
      {isAdmin && (
        <div className="space-y-2">
          <Label>Microsoft Teams webhook URL (optional)</Label>
          <input
            type="url"
            placeholder="https://outlook.office.com/webhook/..."
            className="dropdown-font w-full rounded-full border border-black px-4 py-2 text-sm"
            value={webhookDraft}
            onChange={(e) => setWebhookDraft(e.target.value)}
          />
          <p className="text-xs text-graystone-500">
            If set, approvals/AI applies can post a brief activity summary to Teams.
          </p>
        </div>
      )}
    </div>
  );
}

export const GuidelinesModal: React.FC<GuidelinesModalProps> = ({
  open,
  guidelines,
  onClose,
  onSave,
  isAdmin,
  teamsWebhookUrl: teamsWebhookUrlProp,
  onSaveWebhookUrl,
}) => {
  const [draft, setDraft] = useState<GuidelinesDraft>(buildDraft(guidelines));
  const [webhookDraft, setWebhookDraft] = useState(teamsWebhookUrlProp || '');
  const [activeTab, setActiveTab] = useState<Tab>('terminology');
  const [termFilter, setTermFilter] = useState('');

  useEffect(() => {
    setDraft(buildDraft(guidelines));
  }, [guidelines]);

  useEffect(() => {
    setWebhookDraft(teamsWebhookUrlProp || '');
  }, [teamsWebhookUrlProp]);

  if (!open) return null;

  const handleSave = () => {
    onSave({
      bannedWords: splitList(draft.bannedWordsText),
      requiredPhrases: splitList(draft.requiredPhrasesText),
      languageGuide: draft.languageGuide,
      hashtagTips: draft.hashtagTips,
      charLimits: { ...draft.charLimits },
    });
    if (isAdmin && onSaveWebhookUrl && webhookDraft !== (teamsWebhookUrlProp || '')) {
      onSaveWebhookUrl(webhookDraft);
    }
  };

  return (
    <Modal open={open} onClose={onClose} aria-labelledby="guidelines-title">
      <div className="bg-white">
        <div className="border-b border-graystone-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div id="guidelines-title" className="heading-font text-lg text-black">
                Content standards
              </div>
              <p className="text-xs text-graystone-500">
                Strategy reference, terminology, and platform guidance.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
          <div className="mt-3 flex gap-1">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === key
                    ? 'bg-ocean-500 text-white'
                    : 'text-graystone-600 hover:bg-graystone-100'
                }`}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {activeTab === 'terminology' && (
            <input
              type="text"
              placeholder="Search terminology..."
              className="mt-2 w-full rounded-lg border border-graystone-200 px-3 py-1.5 text-xs focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-aqua-200"
              value={termFilter}
              onChange={(e) => setTermFilter(e.target.value)}
            />
          )}
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-6 text-sm text-graystone-700">
          {activeTab === 'terminology' && <TerminologyTab termFilter={termFilter} />}
          {activeTab === 'voice' && <VoiceToneTab />}
          {activeTab === 'platforms' && <PlatformTipsTab />}
          {activeTab === 'brand' && (
            <BrandTab
              draft={draft}
              setDraft={setDraft}
              isAdmin={isAdmin}
              webhookDraft={webhookDraft}
              setWebhookDraft={setWebhookDraft}
              teamsWebhookUrlProp={teamsWebhookUrlProp}
            />
          )}
        </div>
        {activeTab === 'brand' && (
          <div className="flex items-center justify-between border-t border-graystone-200 bg-graystone-50 px-6 py-4">
            <p className="text-xs text-graystone-500">
              Changes sync to the server when connected, with local fallback if offline.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save guidelines</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default GuidelinesModal;
