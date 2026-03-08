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
import { CONTENT_PILLARS, RESPONSE_MODES, SIGN_OFF_ROUTES } from '../../constants';
import { buildRapidResponseSnapshot } from '../../lib/rapidResponses';
import { selectBaseClasses } from '../../lib/styles';
import { cx } from '../../lib/utils';
import type { Entry, Opportunity, RapidResponse } from '../../types/models';

export interface RapidResponsesViewProps {
  rapidResponses: RapidResponse[];
  opportunities: Opportunity[];
  entries: Entry[];
  currentUser: string;
  ownerOptions: string[];
  onAddRapidResponse: (response: Omit<RapidResponse, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateRapidResponse: (id: string, updates: Partial<RapidResponse>) => void;
  onDeleteRapidResponse: (id: string) => void;
  onOpenEntry: (id: string) => void;
  onCreateEntryFromResponse: (response: RapidResponse) => void;
}

const EMPTY_FORM = {
  title: '',
  owner: '',
  status: 'New',
  responseMode: 'Rapid response',
  triggerDate: new Date().toISOString().slice(0, 10),
  dueAt: '',
  signOffRoute: '',
  sourceOpportunityId: '',
  linkedEntryId: '',
  campaign: '',
  contentPillar: '',
  targetPlatforms: [] as string[],
  notes: '',
};

export function RapidResponsesView({
  rapidResponses,
  opportunities,
  entries,
  currentUser,
  ownerOptions,
  onAddRapidResponse,
  onUpdateRapidResponse,
  onDeleteRapidResponse,
  onOpenEntry,
  onCreateEntryFromResponse,
}: RapidResponsesViewProps): React.ReactElement {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, owner: currentUser });

  const opportunityOptions = useMemo(
    () =>
      opportunities.map((opportunity) => ({
        value: opportunity.id,
        label: `${opportunity.date} · ${opportunity.description.slice(0, 56)}`,
      })),
    [opportunities],
  );

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
    if (!form.title.trim() || !form.dueAt) return;
    const payload = {
      title: form.title.trim(),
      owner: form.owner || currentUser,
      status: form.status as RapidResponse['status'],
      responseMode: form.responseMode as RapidResponse['responseMode'],
      triggerDate: form.triggerDate,
      dueAt: form.dueAt,
      signOffRoute: form.signOffRoute || undefined,
      sourceOpportunityId: form.sourceOpportunityId || undefined,
      linkedEntryId: form.linkedEntryId || undefined,
      campaign: form.campaign || undefined,
      contentPillar: form.contentPillar || undefined,
      targetPlatforms: form.targetPlatforms,
      notes: form.notes || undefined,
    };
    if (editingId) onUpdateRapidResponse(editingId, payload);
    else onAddRapidResponse(payload);
    resetForm();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,1fr)_minmax(0,1.7fr)]">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-ocean-900">
            {editingId ? 'Edit rapid response' : 'Create rapid response'}
          </CardTitle>
          <p className="text-sm text-graystone-500">
            Turn reactive signals into owned response work with deadlines and a clear content
            handoff.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rapid-response-title">Response title</Label>
              <Input
                id="rapid-response-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
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
                  {['New', 'Drafting', 'In Review', 'Ready to Publish', 'Closed'].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Response mode</Label>
                <select
                  value={form.responseMode}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, responseMode: event.target.value }))
                  }
                  className={cx(selectBaseClasses, 'w-full')}
                >
                  {RESPONSE_MODES.filter((mode) => mode !== 'Planned').map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Trigger date</Label>
                <Input
                  type="date"
                  value={form.triggerDate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, triggerDate: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Due at</Label>
                <Input
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, dueAt: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Sign-off route</Label>
                <select
                  value={form.signOffRoute}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, signOffRoute: event.target.value }))
                  }
                  className={cx(selectBaseClasses, 'w-full')}
                >
                  <option value="">No route</option>
                  {SIGN_OFF_ROUTES.map((route) => (
                    <option key={route} value={route}>
                      {route}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Source opportunity</Label>
              <MultiSelect
                placeholder="Link source opportunity"
                value={form.sourceOpportunityId ? [form.sourceOpportunityId] : []}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, sourceOpportunityId: value[0] || '' }))
                }
                options={opportunityOptions}
              />
            </div>

            <div className="space-y-2">
              <Label>Linked entry</Label>
              <MultiSelect
                placeholder="Link an existing response entry"
                value={form.linkedEntryId ? [form.linkedEntryId] : []}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, linkedEntryId: value[0] || '' }))
                }
                options={entryOptions}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="rapid-response-notes">Notes</Label>
              <Textarea
                id="rapid-response-notes"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={4}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit">{editingId ? 'Update response' : 'Add response'}</Button>
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {rapidResponses.map((response) => {
          const snapshot = buildRapidResponseSnapshot(response);
          return (
            <Card key={response.id} className="shadow-md">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <CardTitle className="text-lg text-ocean-900">{response.title}</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{response.status}</Badge>
                      <Badge
                        variant={
                          snapshot.overdue ? 'danger' : snapshot.dueSoon ? 'warning' : 'info'
                        }
                      >
                        {snapshot.overdue ? 'Overdue' : snapshot.dueSoon ? 'Due soon' : 'On track'}
                      </Badge>
                      <Badge variant="outline">{response.responseMode}</Badge>
                    </div>
                  </div>
                  <div className="text-right text-xs text-graystone-500">
                    <div>Owner: {response.owner || 'Unassigned'}</div>
                    <div>Due: {new Date(response.dueAt).toLocaleString()}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {response.notes ? (
                  <p className="text-sm text-graystone-600">{response.notes}</p>
                ) : null}
                {response.linkedEntryId ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-ocean-700 hover:underline"
                    onClick={() => onOpenEntry(response.linkedEntryId!)}
                  >
                    Open linked entry
                  </button>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => onCreateEntryFromResponse(response)}>
                    Create response content
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingId(response.id);
                      setForm({
                        title: response.title,
                        owner: response.owner,
                        status: response.status,
                        responseMode: response.responseMode,
                        triggerDate: response.triggerDate,
                        dueAt: response.dueAt.slice(0, 16),
                        signOffRoute: response.signOffRoute || '',
                        sourceOpportunityId: response.sourceOpportunityId || '',
                        linkedEntryId: response.linkedEntryId || '',
                        campaign: response.campaign || '',
                        contentPillar: response.contentPillar || '',
                        targetPlatforms: response.targetPlatforms,
                        notes: response.notes || '',
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => onDeleteRapidResponse(response.id)}>
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
