import React, { useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, Badge, Button } from '../../components/ui';
import { CheckCircleIcon, XIcon } from '../../components/common';
import { PRIORITY_TIER_BADGE_CLASSES } from '../../constants';
import type { Entry, Opportunity, OpportunityUrgency } from '../../types/models';
import { OpportunityForm, type OpportunityPayload } from './OpportunityForm';

const URGENCY_BADGE_CLASSES: Record<OpportunityUrgency, string> = {
  High: PRIORITY_TIER_BADGE_CLASSES.Urgent,
  Medium: PRIORITY_TIER_BADGE_CLASSES.High,
  Low: PRIORITY_TIER_BADGE_CLASSES.Low,
};

export interface OpportunitiesViewProps {
  opportunities: Opportunity[];
  entries: Entry[];
  currentUser: string | null;
  onAddOpportunity: (payload: OpportunityPayload) => void;
  onMarkActed: (id: string) => void;
  onDismiss: (id: string) => void;
  onOpenEntry: (id: string) => void;
}

export function OpportunitiesView({
  opportunities,
  entries,
  currentUser,
  onAddOpportunity,
  onMarkActed,
  onDismiss,
  onOpenEntry,
}: OpportunitiesViewProps): React.ReactElement {
  const entriesById = useMemo(() => {
    return new Map(entries.map((entry) => [entry.id, entry]));
  }, [entries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ocean-700">Opportunity Radar</h2>
          <p className="text-sm text-graystone-600">
            A shared inbox for reactive moments that could become content.
          </p>
        </div>
        <Badge variant="outline">{opportunities.length} open</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <OpportunityForm onSubmit={onAddOpportunity} currentUser={currentUser} entries={entries} />

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-ocean-900">Open Opportunities</CardTitle>
            <p className="text-sm text-graystone-500">
              Sorted by urgency first, then most recent date.
            </p>
          </CardHeader>
          <CardContent>
            {opportunities.length === 0 ? (
              <p className="text-sm text-graystone-500">No open opportunities logged yet.</p>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opportunity) => {
                  const linkedEntry = opportunity.linkedEntryId
                    ? entriesById.get(opportunity.linkedEntryId)
                    : null;

                  return (
                    <div
                      key={opportunity.id}
                      className="rounded-2xl border border-graystone-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={URGENCY_BADGE_CLASSES[opportunity.urgency]}>
                              {opportunity.urgency}
                            </Badge>
                            <Badge variant="outline">
                              {new Date(opportunity.date).toLocaleDateString()}
                            </Badge>
                            {opportunity.createdBy ? (
                              <span className="text-xs text-graystone-500">
                                logged by {opportunity.createdBy}
                              </span>
                            ) : null}
                          </div>

                          <p className="whitespace-pre-wrap break-words text-sm text-graystone-800">
                            {opportunity.description}
                          </p>

                          {opportunity.angle ? (
                            <div className="rounded-xl bg-aqua-50 p-3 text-xs text-ocean-700">
                              <span className="font-semibold">PM angle:</span> {opportunity.angle}
                            </div>
                          ) : null}

                          {linkedEntry ? (
                            <div className="text-xs text-graystone-600">
                              Linked entry:{' '}
                              <button
                                type="button"
                                className="font-semibold text-ocean-700 hover:underline"
                                onClick={() => onOpenEntry(linkedEntry.id)}
                              >
                                {linkedEntry.date} - {linkedEntry.caption || linkedEntry.assetType}
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => onMarkActed(opportunity.id)}
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            Mark acted
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1"
                            onClick={() => onDismiss(opportunity.id)}
                          >
                            <XIcon className="h-4 w-4 text-graystone-500" />
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default OpportunitiesView;
