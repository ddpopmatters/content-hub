import React, { useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, Badge, Button } from '../../../components/ui';
import { PlatformIcon } from '../../../components/common';
import { PRIORITY_TIERS, PRIORITY_TIER_BADGE_CLASSES } from '../../../constants';
import type { Entry } from '../../../types/models';

interface ApprovalQueueWidgetProps {
  entries: Entry[];
  currentUser: string;
  onOpenEntry: (id: string) => void;
  onViewAll?: () => void;
}

export function ApprovalQueueWidget({
  entries,
  currentUser,
  onOpenEntry,
  onViewAll,
}: ApprovalQueueWidgetProps): React.ReactElement {
  const pendingApprovals = useMemo(() => {
    return entries
      .filter((e) => {
        if (e.deletedAt) return false;
        if (e.status !== 'Pending') return false;
        // Check if current user is an approver
        return e.approvers?.includes(currentUser);
      })
      .slice(0, 5); // Show max 5
  }, [entries, currentUser]);

  const totalPending = entries.filter(
    (e) => !e.deletedAt && e.status === 'Pending' && e.approvers?.includes(currentUser),
  ).length;

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b border-graystone-200 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-ocean-900">Your Approval Queue</CardTitle>
          {totalPending > 0 && <Badge variant="warning">{totalPending} pending</Badge>}
        </div>
      </CardHeader>
      <CardContent className="py-3">
        {pendingApprovals.length === 0 ? (
          <p className="py-4 text-center text-sm text-graystone-500">
            No items awaiting your approval.
          </p>
        ) : (
          <div className="space-y-2">
            {pendingApprovals.map((entry) => {
              const priorityTier = PRIORITY_TIERS.includes(entry.priorityTier)
                ? entry.priorityTier
                : 'Medium';
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onOpenEntry(entry.id)}
                  className="w-full rounded-lg border border-graystone-200 bg-white px-3 py-2 text-left transition hover:border-ocean-300 hover:bg-ocean-50"
                >
                  <div className="flex items-center gap-2">
                    {entry.platforms?.slice(0, 2).map((platform) => (
                      <span key={platform}>
                        <PlatformIcon platform={platform} size="xs" />
                      </span>
                    ))}
                    <span className="flex-1 truncate text-xs text-graystone-700">
                      {entry.caption || entry.assetType || 'Untitled'}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {entry.assetType}
                    </Badge>
                    <Badge className={PRIORITY_TIER_BADGE_CLASSES[priorityTier]}>
                      {priorityTier}
                    </Badge>
                  </div>
                </button>
              );
            })}
            {totalPending > 5 && (
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onViewAll}>
                View all {totalPending} items
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
