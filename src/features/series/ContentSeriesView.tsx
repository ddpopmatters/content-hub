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
import { CAMPAIGNS, CONTENT_PILLARS, RESPONSE_MODES } from '../../constants';
import { selectBaseClasses } from '../../lib/styles';
import { buildContentSeriesSnapshot } from '../../lib/contentSeries';
import { cx } from '../../lib/utils';
import type { ContentSeries, Entry } from '../../types/models';

export interface ContentSeriesViewProps {
  contentSeries: ContentSeries[];
  entries: Entry[];
  currentUser: string;
  ownerOptions: string[];
  onAddContentSeries: (series: Omit<ContentSeries, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateContentSeries: (id: string, updates: Partial<ContentSeries>) => void;
  onDeleteContentSeries: (id: string) => void;
  onOpenEntry: (id: string) => void;
  onCreateEntryFromSeries: (series: ContentSeries, nextEpisodeNumber: number) => void;
}

const EMPTY_FORM = {
  title: '',
  owner: '',
  status: 'Active',
  targetPlatforms: [] as string[],
  targetEpisodeCount: '',
  reviewCheckpoint: '8',
  campaign: '',
  contentPillar: '',
  responseMode: 'Planned',
  linkedEntryIds: [] as string[],
  description: '',
  notes: '',
};

export function ContentSeriesView({
  contentSeries,
  entries,
  currentUser,
  ownerOptions,
  onAddContentSeries,
  onUpdateContentSeries,
  onDeleteContentSeries,
  onOpenEntry,
  onCreateEntryFromSeries,
}: ContentSeriesViewProps): React.ReactElement {
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
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      owner: form.owner || currentUser,
      status: form.status as ContentSeries['status'],
      targetPlatforms: form.targetPlatforms,
      targetEpisodeCount: form.targetEpisodeCount ? Number(form.targetEpisodeCount) : undefined,
      reviewCheckpoint: form.reviewCheckpoint ? Number(form.reviewCheckpoint) : 8,
      campaign: form.campaign || undefined,
      contentPillar: form.contentPillar || undefined,
      responseMode: form.responseMode || undefined,
      linkedEntryIds: form.linkedEntryIds,
      description: form.description || undefined,
      notes: form.notes || undefined,
    };
    if (editingId) {
      onUpdateContentSeries(editingId, payload);
    } else {
      onAddContentSeries(payload);
    }
    resetForm();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,1fr)_minmax(0,1.7fr)]">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-ocean-900">
            {editingId ? 'Edit series' : 'Create series'}
          </CardTitle>
          <p className="text-sm text-graystone-500">
            Manage recurring formats as tracked series with episode goals, checkpoints, and linked
            content.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="series-title">Series title</Label>
              <Input
                id="series-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Myth vs Reality, Data in Focus..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                  className={cx(selectBaseClasses, 'w-full')}
                >
                  {['Active', 'Paused', 'Completed'].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="series-target-count">Target episodes</Label>
                <Input
                  id="series-target-count"
                  type="number"
                  min="1"
                  value={form.targetEpisodeCount}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, targetEpisodeCount: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="series-review-checkpoint">Review checkpoint</Label>
                <Input
                  id="series-review-checkpoint"
                  type="number"
                  min="1"
                  value={form.reviewCheckpoint}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, reviewCheckpoint: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Target platforms</Label>
              <MultiSelect
                placeholder="Select platforms"
                value={form.targetPlatforms}
                onChange={(value) => setForm((prev) => ({ ...prev, targetPlatforms: value }))}
                options={['Instagram', 'LinkedIn', 'YouTube', 'Facebook', 'BlueSky'].map(
                  (platform) => ({ value: platform, label: platform }),
                )}
              />
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
              <Label>Linked episodes</Label>
              <MultiSelect
                placeholder="Link existing content"
                value={form.linkedEntryIds}
                onChange={(value) => setForm((prev) => ({ ...prev, linkedEntryIds: value }))}
                options={entryOptions}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="series-description">Description</Label>
              <Textarea
                id="series-description"
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="series-notes">Notes</Label>
              <Textarea
                id="series-notes"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit">{editingId ? 'Update series' : 'Add series'}</Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {contentSeries.map((series) => {
          const snapshot = buildContentSeriesSnapshot(series, entries);
          const nextEpisodeNumber = (snapshot.latestEpisodeNumber || 0) + 1;
          return (
            <Card key={series.id} className="shadow-md">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <CardTitle className="text-lg text-ocean-900">{series.title}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{series.status}</Badge>
                      <Badge variant={snapshot.reviewDue ? 'warning' : 'info'}>
                        {snapshot.reviewDue ? 'Review due' : 'On track'}
                      </Badge>
                      {series.contentPillar && (
                        <Badge variant="outline">{series.contentPillar}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-graystone-500">
                    <div>Owner: {series.owner || 'Unassigned'}</div>
                    <div>Next episode: {nextEpisodeNumber}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {series.description && (
                  <p className="text-sm text-graystone-600">{series.description}</p>
                )}

                <div className="grid gap-2 text-xs md:grid-cols-4">
                  <div className="rounded-xl bg-graystone-50 px-3 py-2">
                    <div className="text-graystone-500">Episodes</div>
                    <div className="mt-1 font-semibold text-ocean-800">
                      {snapshot.linkedEntries.length}
                      {series.targetEpisodeCount ? ` / ${series.targetEpisodeCount}` : ''}
                    </div>
                  </div>
                  <div className="rounded-xl bg-graystone-50 px-3 py-2">
                    <div className="text-graystone-500">Published</div>
                    <div className="mt-1 font-semibold text-ocean-800">
                      {snapshot.publishedEntries.length}
                    </div>
                  </div>
                  <div className="rounded-xl bg-graystone-50 px-3 py-2">
                    <div className="text-graystone-500">Progress</div>
                    <div className="mt-1 font-semibold text-ocean-800">
                      {snapshot.progressPercent}%
                    </div>
                  </div>
                  <div className="rounded-xl bg-graystone-50 px-3 py-2">
                    <div className="text-graystone-500">Platform coverage</div>
                    <div className="mt-1 font-semibold text-ocean-800">
                      {snapshot.platformCoveragePercent}%
                    </div>
                  </div>
                </div>

                {snapshot.linkedEntries.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-graystone-500">
                      Episodes
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {snapshot.linkedEntries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => onOpenEntry(entry.id)}
                          className="rounded-full border border-graystone-200 px-3 py-1 text-xs text-ocean-700 transition hover:border-ocean-300 hover:bg-ocean-50"
                        >
                          {entry.episodeNumber ? `Ep ${entry.episodeNumber}` : 'Episode'} ·{' '}
                          {entry.date}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => onCreateEntryFromSeries(series, nextEpisodeNumber)}>
                    Create next episode
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingId(series.id);
                      setForm({
                        title: series.title,
                        owner: series.owner,
                        status: series.status,
                        targetPlatforms: series.targetPlatforms,
                        targetEpisodeCount: series.targetEpisodeCount
                          ? String(series.targetEpisodeCount)
                          : '',
                        reviewCheckpoint: String(series.reviewCheckpoint),
                        campaign: series.campaign || '',
                        contentPillar: series.contentPillar || '',
                        responseMode: series.responseMode || 'Planned',
                        linkedEntryIds: series.linkedEntryIds,
                        description: series.description || '',
                        notes: series.notes || '',
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => onDeleteContentSeries(series.id)}>
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
