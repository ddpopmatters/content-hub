import React from 'react';
import { Card, CardContent, Button } from '../../../components/ui';
import {
  PlusIcon,
  CalendarIcon,
  CheckCircleIcon,
  SvgIcon,
  type IconProps,
} from '../../../components/common';

// BookIcon is not in the common icons, so we define it inline
function BookIcon({ className }: IconProps): React.ReactElement {
  return (
    <SvgIcon className={className}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="2" fill="none" />
      <path
        d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </SvgIcon>
  );
}

interface QuickActionsWidgetProps {
  onCreateContent: () => void;
  onViewCalendar: () => void;
  onViewRequests: () => void;
  onViewReporting: () => void;
  onViewApprovals: () => void;
  onOpenGuidelines: () => void;
  pendingCount?: number;
}

export function QuickActionsWidget({
  onCreateContent,
  onViewCalendar,
  onViewRequests,
  onViewReporting,
  onViewApprovals,
  onOpenGuidelines,
  pendingCount = 0,
}: QuickActionsWidgetProps): React.ReactElement {
  return (
    <Card className="shadow-md">
      <CardContent className="py-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <Button
            variant="default"
            className="flex items-center justify-center gap-2 py-3"
            onClick={onCreateContent}
          >
            <PlusIcon className="h-4 w-4" />
            Create
          </Button>
          <Button
            variant="outline"
            className="flex items-center justify-center gap-2 py-3"
            onClick={onViewCalendar}
          >
            <CalendarIcon className="h-4 w-4" />
            Calendar
          </Button>
          <Button
            variant="outline"
            className="flex items-center justify-center gap-2 py-3"
            onClick={onViewRequests}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="5" y="4" width="14" height="18" rx="2" strokeWidth="2" />
              <path d="M9 4.5h6v3H9z" strokeWidth="2" />
              <line x1="8" y1="12" x2="16" y2="12" strokeWidth="2" />
              <line x1="8" y1="16" x2="16" y2="16" strokeWidth="2" />
            </svg>
            Requests
          </Button>
          <Button
            variant="outline"
            className="flex items-center justify-center gap-2 py-3"
            onClick={onViewReporting}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2" />
              <line x1="8" y1="9" x2="16" y2="9" strokeWidth="2" />
              <line x1="8" y1="13" x2="16" y2="13" strokeWidth="2" />
              <line x1="8" y1="17" x2="12" y2="17" strokeWidth="2" />
            </svg>
            Reporting
          </Button>
          <Button
            variant="outline"
            className="relative flex items-center justify-center gap-2 py-3"
            onClick={onViewApprovals}
          >
            <CheckCircleIcon className="h-4 w-4" />
            Approvals
            {pendingCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            className="flex items-center justify-center gap-2 py-3"
            onClick={onOpenGuidelines}
          >
            <BookIcon className="h-4 w-4" />
            Guidelines
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
