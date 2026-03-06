import React, { useState, useMemo, useEffect } from 'react';
import { Modal, Button, Input, Label, Textarea, Badge } from '../../components/ui';
import { TrashIcon, PlatformIcon } from '../../components/common';
import { cx, uuid } from '../../lib/utils';
import { selectBaseClasses } from '../../lib/styles';
import {
  ALL_PLATFORMS,
  INFLUENCER_STATUSES,
  INFLUENCER_NICHES,
  INFLUENCER_STATUS_COLORS,
} from '../../constants';
import type { Influencer, Entry, InfluencerStatus, PlatformProfile } from '../../types/models';

export interface InfluencerModalProps {
  open: boolean;
  influencer: Influencer | null;
  entries: Entry[];
  currentUser: string;
  allNiches?: string[];
  onClose: () => void;
  onSave: (influencer: Influencer) => void;
  onDelete: (id: string) => void;
  onLinkEntry: (influencerId: string, entryId: string) => void;
  onUnlinkEntry: (entryId: string) => void;
  onAddNiche?: (niche: string) => void;
}

const emptyPlatformProfile = (): PlatformProfile => ({
  platform: 'Instagram',
  handle: '',
  profileUrl: '',
});

const emptyInfluencer = (): Omit<Influencer, 'id' | 'createdAt' | 'createdBy'> => ({
  name: '',
  handle: '',
  profileUrl: '',
  platform: 'Instagram',
  platformProfiles: [emptyPlatformProfile()],
  followerCount: 0,
  engagementRate: undefined,
  contactEmail: '',
  niche: '',
  estimatedRate: undefined,
  notes: '',
  status: 'Follow & Observe',
});

export const InfluencerModal: React.FC<InfluencerModalProps> = ({
  open,
  influencer,
  entries,
  currentUser,
  allNiches,
  onClose,
  onSave,
  onDelete,
  onLinkEntry,
  onUnlinkEntry,
  onAddNiche,
}) => {
  const [nicheInput, setNicheInput] = useState('');
  const [showNicheDropdown, setShowNicheDropdown] = useState(false);

  // Combine default niches with custom ones
  const niches = useMemo(() => {
    const combined = new Set([...INFLUENCER_NICHES, ...(allNiches || [])]);
    return Array.from(combined).sort();
  }, [allNiches]);

  // Filter niches based on input
  const filteredNiches = useMemo(() => {
    if (!nicheInput) return niches;
    const lower = nicheInput.toLowerCase();
    return niches.filter((n) => n.toLowerCase().includes(lower));
  }, [niches, nicheInput]);

  const handleNicheSelect = (niche: string) => {
    handleFieldChange('niche', niche);
    setNicheInput('');
    setShowNicheDropdown(false);
  };

  const handleCreateNiche = () => {
    const trimmed = nicheInput.trim();
    if (trimmed && !niches.includes(trimmed)) {
      onAddNiche?.(trimmed);
    }
    handleFieldChange('niche', trimmed);
    setNicheInput('');
    setShowNicheDropdown(false);
  };
  const isNew = !influencer;
  const [draft, setDraft] =
    useState<Omit<Influencer, 'id' | 'createdAt' | 'createdBy'>>(emptyInfluencer());
  const [showLinkPicker, setShowLinkPicker] = useState(false);

  useEffect(() => {
    if (open) {
      if (influencer) {
        const { id: _id, createdAt: _createdAt, createdBy: _createdBy, ...rest } = influencer;
        // Migrate old single platform fields to platformProfiles if needed
        if (!rest.platformProfiles || rest.platformProfiles.length === 0) {
          rest.platformProfiles = [
            {
              platform: rest.platform || 'Instagram',
              handle: rest.handle || '',
              profileUrl: rest.profileUrl || '',
            },
          ];
        }
        setDraft(rest);
      } else {
        setDraft(emptyInfluencer());
      }
      setShowLinkPicker(false);
      setNicheInput('');
      setShowNicheDropdown(false);
    }
  }, [open, influencer]);

  const linkedEntries = useMemo(
    () => (influencer ? entries.filter((e) => e.influencerId === influencer.id) : []),
    [entries, influencer],
  );

  const availableEntries = useMemo(
    () => entries.filter((e) => !e.influencerId && !e.deletedAt),
    [entries],
  );

  const handleFieldChange = (field: keyof typeof draft, value: unknown) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handlePlatformProfileChange = (
    index: number,
    field: keyof PlatformProfile,
    value: string,
  ) => {
    setDraft((prev) => {
      const profiles = [...(prev.platformProfiles || [])];
      profiles[index] = { ...profiles[index], [field]: value };
      return { ...prev, platformProfiles: profiles };
    });
  };

  const handleAddPlatformProfile = () => {
    setDraft((prev) => ({
      ...prev,
      platformProfiles: [...(prev.platformProfiles || []), emptyPlatformProfile()],
    }));
  };

  const handleRemovePlatformProfile = (index: number) => {
    setDraft((prev) => {
      const profiles = [...(prev.platformProfiles || [])];
      profiles.splice(index, 1);
      return { ...prev, platformProfiles: profiles };
    });
  };

  const handleSave = () => {
    if (!draft.name.trim()) return;

    // Sync first platform profile to legacy fields for backwards compatibility
    const firstProfile = draft.platformProfiles?.[0];
    const finalDraft = {
      ...draft,
      platform: firstProfile?.platform || draft.platform,
      handle: firstProfile?.handle || draft.handle,
      profileUrl: firstProfile?.profileUrl || draft.profileUrl,
    };

    const saved: Influencer = influencer
      ? { ...influencer, ...finalDraft }
      : {
          id: uuid(),
          createdAt: new Date().toISOString(),
          createdBy: currentUser,
          ...finalDraft,
        };
    onSave(saved);
    onClose();
  };

  const handleDelete = () => {
    if (influencer && window.confirm('Delete this influencer? This cannot be undone.')) {
      onDelete(influencer.id);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} aria-labelledby="influencer-modal-title">
      <div className="flex h-full max-h-[85vh] flex-col bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-graystone-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              id="influencer-modal-title"
              className="heading-font text-lg font-semibold text-ocean-900"
            >
              {isNew ? 'Add Influencer' : draft.name || 'Edit Influencer'}
            </div>
            {!isNew && (
              <Badge className={INFLUENCER_STATUS_COLORS[draft.status as InfluencerStatus]}>
                {draft.status}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="ghost" size="sm" onClick={handleDelete}>
                <TrashIcon className="h-4 w-4 text-red-500" />
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!draft.name.trim()}>
              {isNew ? 'Add' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left column - Basic info */}
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="Influencer name"
                />
              </div>

              {/* Platform Profiles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Platform Profiles</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddPlatformProfile}
                    className="text-ocean-600"
                  >
                    + Add Platform
                  </Button>
                </div>
                {(draft.platformProfiles || []).map((profile, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-graystone-200 bg-graystone-50 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-graystone-500">
                        Platform {index + 1}
                      </span>
                      {(draft.platformProfiles?.length || 0) > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePlatformProfile(index)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={profile.platform}
                        onChange={(e) =>
                          handlePlatformProfileChange(index, 'platform', e.target.value)
                        }
                        className={cx(selectBaseClasses, 'w-full px-2 py-1.5 text-sm')}
                      >
                        {ALL_PLATFORMS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <Input
                        value={profile.handle}
                        onChange={(e) =>
                          handlePlatformProfileChange(index, 'handle', e.target.value)
                        }
                        placeholder="@username"
                        className="text-sm"
                      />
                    </div>
                    <Input
                      value={profile.profileUrl}
                      onChange={(e) =>
                        handlePlatformProfileChange(index, 'profileUrl', e.target.value)
                      }
                      placeholder="https://..."
                      className="mt-2 text-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Followers</Label>
                  <Input
                    type="number"
                    value={draft.followerCount || ''}
                    onChange={(e) =>
                      handleFieldChange('followerCount', parseInt(e.target.value) || 0)
                    }
                    placeholder="10000"
                  />
                </div>
                <div>
                  <Label>Engagement Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={draft.engagementRate ?? ''}
                    onChange={(e) =>
                      handleFieldChange(
                        'engagementRate',
                        e.target.value ? parseFloat(e.target.value) : undefined,
                      )
                    }
                    placeholder="3.5"
                  />
                </div>
              </div>
            </div>

            {/* Right column - Business info */}
            <div className="space-y-4">
              <div>
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={draft.contactEmail}
                  onChange={(e) => handleFieldChange('contactEmail', e.target.value)}
                  placeholder="email@example.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Label>Niche</Label>
                  <div className="relative">
                    <Input
                      value={nicheInput || draft.niche}
                      onChange={(e) => {
                        setNicheInput(e.target.value);
                        setShowNicheDropdown(true);
                      }}
                      onFocus={() => setShowNicheDropdown(true)}
                      onBlur={() => {
                        // Delay to allow click on dropdown item
                        setTimeout(() => setShowNicheDropdown(false), 150);
                      }}
                      placeholder="Type or select niche"
                    />
                    {showNicheDropdown && (
                      <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-graystone-200 bg-white py-1 shadow-lg">
                        {filteredNiches.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleNicheSelect(n)}
                            className={cx(
                              'w-full px-3 py-2 text-left text-sm hover:bg-ocean-50',
                              draft.niche === n && 'bg-ocean-100 font-medium',
                            )}
                          >
                            {n}
                          </button>
                        ))}
                        {nicheInput &&
                          !niches.some((n) => n.toLowerCase() === nicheInput.toLowerCase()) && (
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={handleCreateNiche}
                              className="w-full border-t border-graystone-100 px-3 py-2 text-left text-sm text-ocean-600 hover:bg-ocean-50"
                            >
                              + Create "{nicheInput}"
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Est. Rate (£)</Label>
                  <Input
                    type="number"
                    value={draft.estimatedRate ?? ''}
                    onChange={(e) =>
                      handleFieldChange(
                        'estimatedRate',
                        e.target.value ? parseInt(e.target.value) : undefined,
                      )
                    }
                    placeholder="500"
                  />
                </div>
              </div>

              <div>
                <Label>Status</Label>
                <select
                  value={draft.status}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  className={cx(selectBaseClasses, 'w-full px-3 py-2')}
                >
                  {INFLUENCER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={draft.notes}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  rows={3}
                  placeholder="Additional notes about this influencer..."
                />
              </div>
            </div>
          </div>

          {/* Linked Entries Section (only for existing influencers) */}
          {!isNew && influencer && (
            <div className="mt-6 border-t border-graystone-200 pt-6">
              <div className="mb-3 flex items-center justify-between">
                <Label className="text-base">Linked Content ({linkedEntries.length})</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLinkPicker(!showLinkPicker)}
                >
                  {showLinkPicker ? 'Cancel' : 'Link Entry'}
                </Button>
              </div>

              {showLinkPicker && (
                <div className="mb-4 rounded-xl border border-aqua-200 bg-aqua-50 p-3">
                  <Label className="mb-2 block text-sm">Select entry to link:</Label>
                  <select
                    className={cx(selectBaseClasses, 'w-full px-3 py-2')}
                    onChange={(e) => {
                      if (e.target.value) {
                        onLinkEntry(influencer.id, e.target.value);
                        setShowLinkPicker(false);
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="">Choose an entry...</option>
                    {availableEntries.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.date} - {entry.caption?.slice(0, 50) || 'No caption'}...
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {linkedEntries.length > 0 ? (
                <div className="space-y-2">
                  {linkedEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-xl border border-graystone-200 bg-white p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {entry.platforms.map((p) => (
                            <span key={p}>
                              <PlatformIcon platform={p} size="sm" />
                            </span>
                          ))}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{entry.date}</div>
                          <div className="text-xs text-graystone-500">
                            {entry.caption?.slice(0, 60) || 'No caption'}...
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => onUnlinkEntry(entry.id)}>
                        Unlink
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-graystone-500">
                  No content linked yet. Link entries to track influencer performance.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
