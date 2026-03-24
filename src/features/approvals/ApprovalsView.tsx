import React from 'react';
import { Card, CardHeader, CardContent, CardTitle, Badge, Button } from '../../components/ui';
import { CheckCircleIcon, LoaderIcon } from '../../components/common';
import { cx } from '../../lib/utils';
import { getChecklistItemsForEntry } from '../../constants';
import { getWorkflowBlockers } from '../../lib/sanitizers';
import type { Entry } from '../../types/models';

interface ApprovalEntryCardProps {
  entry: Entry;
  onApprove?: (id: string) => void;
  onOpenEntry?: (id: string) => void;
}

/**
 * ApprovalEntryCard - Displays a single approval entry with actions
 */
const ApprovalEntryCard: React.FC<ApprovalEntryCardProps> = ({ entry, onApprove, onOpenEntry }) => {
  const workflowBlockers = getWorkflowBlockers(entry);
  return (
    <div
      key={entry.id}
      className="rounded-xl border border-graystone-200 bg-white px-4 py-4 shadow-sm transition hover:border-aqua-400"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{entry.assetType}</Badge>
            <span className="text-sm font-semibold text-graystone-800">
              {new Date(entry.date).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                weekday: 'short',
              })}
            </span>
            <span className="max-w-[140px] truncate rounded-full bg-aqua-100 px-2 py-1 text-xs font-medium text-ocean-700">
              {entry.statusDetail}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-graystone-500">
            <span>Requested by {entry.author || 'Unknown'}</span>
            {entry.approvers?.length ? <span>Approvers: {entry.approvers.join(', ')}</span> : null}
          </div>
          {entry.caption && (
            <p className="line-clamp-3 text-sm text-graystone-700">{entry.caption}</p>
          )}
          {(entry.campaign ||
            entry.contentPillar ||
            entry.contentCategory ||
            entry.responseMode ||
            entry.testingFrameworkName) && (
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-graystone-500">
              {entry.campaign ? (
                <span className="max-w-[140px] truncate rounded-full bg-aqua-100 px-2 py-0.5 text-ocean-700">
                  {entry.campaign}
                </span>
              ) : null}
              {entry.contentPillar ? (
                <span className="rounded-full bg-graystone-100 px-2 py-0.5 text-graystone-700">
                  {entry.contentPillar}
                </span>
              ) : null}
              {entry.contentCategory ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                  {entry.contentCategory}
                </span>
              ) : null}
              {entry.responseMode ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                  {entry.responseMode}
                </span>
              ) : null}
              {entry.testingFrameworkName ? (
                <span className="max-w-[160px] truncate rounded-full bg-ocean-500/10 px-2 py-0.5 text-ocean-700">
                  Test: {entry.testingFrameworkName}
                </span>
              ) : null}
            </div>
          )}
          {entry.checklist && (
            <div className="flex flex-wrap gap-2 text-xs text-graystone-500">
              {getChecklistItemsForEntry(entry.platforms, entry.assetType).map(({ key, label }) => {
                const value = (entry.checklist as Record<string, boolean>)[key];
                return (
                  <span
                    key={key}
                    className={cx(
                      'inline-flex items-center gap-1 rounded-full px-2 py-1',
                      value
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-graystone-100 text-graystone-500',
                    )}
                  >
                    {value ? (
                      <CheckCircleIcon className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <LoaderIcon className="h-3 w-3 animate-none text-graystone-400" />
                    )}
                    {label}
                  </span>
                );
              })}
            </div>
          )}
          {workflowBlockers.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <div className="font-medium">Heads up before approving</div>
              <div className="mt-1">{workflowBlockers.map((item) => item.label).join(', ')}</div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onApprove?.(entry.id)}
            className="gap-2"
          >
            <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
            Mark approved
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenEntry?.(entry.id)}
            className="gap-2"
          >
            Open detail
          </Button>
        </div>
      </div>
    </div>
  );
};

export interface ApprovalsViewProps {
  /** Array of entries pending approval for the current user */
  approvals: Entry[];
  /** Number of outstanding approvals */
  outstandingCount: number;
  /** Number of unread mentions */
  unreadMentionsCount: number;
  /** Whether the user can access the calendar */
  canUseCalendar: boolean;
  /** Callback when approving an entry (receives entry id) */
  onApprove: (id: string) => void;
  /** Callback when opening an entry detail (receives entry id) */
  onOpenEntry: (id: string) => void;
  /** Callback to navigate back to menu */
  onBackToMenu: () => void;
  /** Callback to navigate to calendar */
  onGoToCalendar: () => void;
  /** Callback to navigate to create content form */
  onCreateContent: () => void;
  /** Callback to switch user/sign out */
  onSwitchUser: () => void;
}

/**
 * ApprovalsView - Displays the approvals queue for the current user
 */
export function ApprovalsView({
  approvals = [],
  outstandingCount = 0,
  unreadMentionsCount = 0,
  canUseCalendar = true,
  onApprove,
  onOpenEntry,
  onBackToMenu,
  onGoToCalendar,
  onCreateContent,
  onSwitchUser,
}: ApprovalsViewProps): React.ReactElement {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBackToMenu}>
          ← Back
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {outstandingCount} waiting
          </Badge>
          {unreadMentionsCount > 0 && (
            <Badge variant="outline" className="bg-ocean-500/10 text-xs text-ocean-700">
              {unreadMentionsCount} mentions
            </Badge>
          )}
        </div>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg text-ocean-900">Your Approvals</CardTitle>
          <p className="mt-2 text-sm text-graystone-500">
            Items assigned to you that still need approval. Click an item to review, comment, or
            approve.
          </p>
        </CardHeader>
        <CardContent>
          {approvals.length === 0 ? (
            <p className="text-sm text-graystone-500">
              Everything looks good. Nothing needs your approval right now.
            </p>
          ) : (
            <div className="space-y-4">
              {approvals.map((entry) => (
                <ApprovalEntryCard
                  key={entry.id}
                  entry={entry}
                  onApprove={onApprove}
                  onOpenEntry={onOpenEntry}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ApprovalsView;
