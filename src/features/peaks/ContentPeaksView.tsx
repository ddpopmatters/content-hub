import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  MultiSelect,
  Textarea,
} from '../../components/ui';
import { cx } from '../../lib/utils';
import { selectBaseClasses } from '../../lib/styles';
import {
  ALL_PLATFORMS,
  CAMPAIGNS,
  CONTENT_PILLARS,
  PRIORITY_TIERS,
  RESPONSE_MODES,
} from '../../constants';
import { buildContentPeakSnapshot } from '../../lib/contentPeaks';
import type { ContentPeak, Entry } from '../../types/models';

export interface ContentPeaksViewProps {
  contentPeaks: ContentPeak[];
  entries: Entry[];
  currentUser: string;
  ownerOptions: string[];
  onAddContentPeak: (peak: Omit<ContentPeak, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateContentPeak: (id: string, updates: Partial<ContentPeak>) => void;
  onDeleteContentPeak: (id: string) => void;
  onOpenEntry: (id: string) => void;
  onCreateEntryFromPeak: (peak: ContentPeak) => void;
}

const EMPTY_FORM = {
  title: '',
  startDate: '',
  endDate: '',
  priorityTier: 'High',
  owner: '',
  campaign: '',
  contentPillar: '',
  responseMode: 'Planned',
  requiredPlatforms: [] as string[],
  requiredAssetTypes: [] as string[],
  linkedEntryIds: [] as string[],
  description: '',
  notes: '',
};

export function ContentPeaksView({
  contentPeaks,
  entries,
  currentUser,
  ownerOptions,
  onAddContentPeak,
  onUpdateContentPeak,
  onDeleteContentPeak,
  onOpenEntry,
  onCreateEntryFromPeak,
}: ContentPeaksViewProps): React.ReactElement {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    owner: currentUser,
  });

  const entryOptions = useMemo(
    () =>
      entries
        .filter((entry) => !entry.deletedAt)
        .map((entry) => ({
          value: entry.id,
          label: `${entry.date} · ${(entry.caption || 'Untitled').slice(0, 48)}`,
        })),
    [entries],
  );

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, owner: currentUser });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      ...form,
      priorityTier: form.priorityTier as ContentPeak['priorityTier'],
      owner: form.owner || currentUser,
      campaign: form.campaign || undefined,
      contentPillar: form.contentPillar || undefined,
      responseMode: form.responseMode || undefined,
      description: form.description || undefined,
      notes: form.notes || undefined,
    };
    if (!payload.title || !payload.startDate || !payload.endDate) return;
    if (editingId) {
      onUpdateContentPeak(editingId, payload);
    } else {
      onAddContentPeak(payload);
    }
    resetForm();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,1fr)_minmax(0,1.7fr)]">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-ocean-900">
            {editingId ? 'Edit content peak' : 'Create content peak'}
          </CardTitle>
          <p className="text-sm text-graystone-500">
            Manage strategic moments as objects with owners, windows, required formats, and linked
            entries.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="peak-title">Title</Label>
              <Input
                id="peak-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="World Population Day, COP, budget moment..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="peak-start">Start date</Label>
                <Input
                  id="peak-start"
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, startDate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peak-end">End date</Label>
                <Input
                  id="peak-end"
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, endDate: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <select
                  value={form.priorityTier}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, priorityTier: event.target.value }))
                  }
                  className={cx(selectBaseClasses, 'w-full')}
                >
                  {PRIORITY_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Owner</Label>
                <select
                  value={form.owner}
                  onChange={(event) => setForm((prev) => ({ ...prev, owner: event.target.value }))}
                  className={cx(selectBaseClasses, 'w-full')}
                >
                  {[currentUser, ...ownerOptions]
                    .filter(Boolean)
                    .filter((value, index, array) => array.indexOf(value) === index)
                    .map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Campaign</Label>
                <select
                  value={form.campaign}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, campaign: event.target.value }))
                  }
                  className={cx(selectBaseClasses, 'w-full')}
                >
                  <option value="">No campaign</option>
                  {CAMPAIGNS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Content pillar</Label>
                <select
                  value={form.contentPillar}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, contentPillar: event.target.value }))
                  }
                  className={cx(selectBaseClasses, 'w-full')}
                >
                  <option value="">Not tagged</option>
                  {CONTENT_PILLARS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Response mode</Label>
              <select
                value={form.responseMode}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, responseMode: event.target.value }))
                }
                className={cx(selectBaseClasses, 'w-full')}
              >
                {RESPONSE_MODES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Required platforms</Label>
              <MultiSelect
                placeholder="Select platforms"
                value={form.requiredPlatforms}
                onChange={(value) => setForm((prev) => ({ ...prev, requiredPlatforms: value }))}
                options={ALL_PLATFORMS.map((platform) => ({ value: platform, label: platform }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Required asset types</Label>
              <MultiSelect
                placeholder="Select formats"
                value={form.requiredAssetTypes}
                onChange={(value) => setForm((prev) => ({ ...prev, requiredAssetTypes: value }))}
                options={['Video', 'Design', 'Carousel'].map((asset) => ({
                  value: asset,
                  label: asset,
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Linked entries</Label>
              <MultiSelect
                placeholder="Link existing entries"
                value={form.linkedEntryIds}
                onChange={(value) => setForm((prev) => ({ ...prev, linkedEntryIds: value }))}
                options={entryOptions}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={3}
                placeholder="What is the moment, why does it matter, and what narrative should it carry?"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
                placeholder="Dependencies, stakeholders, risks, reactive triggers..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">{editingId ? 'Save peak' : 'Add peak'}</Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {contentPeaks.map((peak) => {
          const snapshot = buildContentPeakSnapshot(peak, entries);
          return (
            <Card key={peak.id} className="shadow-lg">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg text-ocean-900">{peak.title}</CardTitle>
                    <p className="mt-1 text-sm text-graystone-500">
                      {peak.startDate} to {peak.endDate} · Owner: {peak.owner || 'Unassigned'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{peak.priorityTier}</Badge>
                    <Badge variant="outline">{snapshot.state}</Badge>
                    <Badge
                      className={cx(
                        snapshot.readinessScore >= 70
                          ? 'bg-emerald-100 text-emerald-700'
                          : snapshot.readinessScore >= 40
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700',
                      )}
                    >
                      {snapshot.readinessScore}% ready
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  {peak.campaign ? <Badge variant="outline">{peak.campaign}</Badge> : null}
                  {peak.contentPillar ? (
                    <Badge variant="outline">{peak.contentPillar}</Badge>
                  ) : null}
                  {peak.responseMode ? <Badge variant="outline">{peak.responseMode}</Badge> : null}
                  {peak.requiredPlatforms.map((platform) => (
                    <Badge key={platform} variant="outline">
                      {platform}
                    </Badge>
                  ))}
                </div>

                {peak.description ? (
                  <p className="text-sm text-graystone-700">{peak.description}</p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div className="rounded-xl bg-graystone-50 px-3 py-3">
                    <div className="text-xs text-graystone-500">Linked entries</div>
                    <div className="mt-1 font-semibold text-ocean-800">
                      {snapshot.linkedEntries.length}
                    </div>
                  </div>
                  <div className="rounded-xl bg-graystone-50 px-3 py-3">
                    <div className="text-xs text-graystone-500">Approved / published</div>
                    <div className="mt-1 font-semibold text-ocean-800">
                      {snapshot.approvedEntries.length}
                    </div>
                  </div>
                  <div className="rounded-xl bg-graystone-50 px-3 py-3">
                    <div className="text-xs text-graystone-500">Platform coverage</div>
                    <div className="mt-1 font-semibold text-ocean-800">
                      {snapshot.requiredPlatformCoverage.toFixed(0)}%
                    </div>
                  </div>
                </div>

                {snapshot.linkedEntries.length ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-graystone-800">Linked entries</div>
                    <div className="space-y-2">
                      {snapshot.linkedEntries.slice(0, 4).map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => onOpenEntry(entry.id)}
                          className="w-full rounded-xl border border-graystone-200 px-3 py-2 text-left text-sm text-graystone-700 hover:border-ocean-300 hover:bg-ocean-50"
                        >
                          <div className="font-medium text-ocean-800">
                            {entry.caption || 'Untitled entry'}
                          </div>
                          <div className="text-xs text-graystone-500">
                            {entry.date} · {entry.platforms.join(', ') || 'No platforms'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-graystone-200 px-4 py-4 text-sm text-graystone-500">
                    No linked entries yet. Create one from this peak or tag an entry with the same
                    content peak name.
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => onCreateEntryFromPeak(peak)}>
                    Create entry from peak
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingId(peak.id);
                      setForm({
                        title: peak.title,
                        startDate: peak.startDate,
                        endDate: peak.endDate,
                        priorityTier: peak.priorityTier,
                        owner: peak.owner || currentUser,
                        campaign: peak.campaign || '',
                        contentPillar: peak.contentPillar || '',
                        responseMode: peak.responseMode || 'Planned',
                        requiredPlatforms: peak.requiredPlatforms || [],
                        requiredAssetTypes: peak.requiredAssetTypes || [],
                        linkedEntryIds: peak.linkedEntryIds || [],
                        description: peak.description || '',
                        notes: peak.notes || '',
                      });
                    }}
                  >
                    Edit peak
                  </Button>
                  <Button variant="ghost" onClick={() => onDeleteContentPeak(peak.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default ContentPeaksView;
