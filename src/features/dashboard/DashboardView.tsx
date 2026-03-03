import React from 'react';
import { ContentPipelineWidget } from './widgets/ContentPipelineWidget';
import { WeeklyStatsWidget } from './widgets/WeeklyStatsWidget';
import { ApprovalQueueWidget } from './widgets/ApprovalQueueWidget';
import { AssetMixWidget } from './widgets/AssetMixWidget';
import { EngagementProgressWidget } from './widgets/EngagementProgressWidget';
import { QuickActionsWidget } from './widgets/QuickActionsWidget';
import { PillarBalanceWidget } from './widgets/PillarBalanceWidget';
import { PlatformCoverageWidget } from './widgets/PlatformCoverageWidget';
import { AudienceSegmentWidget } from './widgets/AudienceSegmentWidget';
import { UrgentOpportunitiesWidget } from './widgets/UrgentOpportunitiesWidget';
import { UpcomingDeadlines } from '../calendar/UpcomingDeadlines';
import type { Entry, EngagementActivity, EngagementGoals } from '../../types/models';

export interface DashboardViewProps {
  entries: Entry[];
  currentUser: string;
  assetGoals: Record<string, number>;
  engagementActivities: EngagementActivity[];
  engagementGoals: EngagementGoals;
  pendingApprovalCount: number;
  urgentOpportunityCount?: number;
  onOpenEntry: (id: string) => void;
  onNavigate: (view: string, tab?: string) => void;
  onOpenGuidelines: () => void;
  onOpenApprovals: () => void;
  onOpenOpportunities?: () => void;
}

export function DashboardView({
  entries,
  currentUser,
  assetGoals,
  engagementActivities,
  engagementGoals,
  pendingApprovalCount,
  urgentOpportunityCount = 0,
  onOpenEntry,
  onNavigate,
  onOpenGuidelines,
  onOpenApprovals,
  onOpenOpportunities,
}: DashboardViewProps): React.ReactElement {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Dashboard Header */}
      <div className="gradient-header mb-6 rounded-2xl p-6 text-white shadow-xl">
        <h1 className="heading-font text-2xl font-bold">Dashboard</h1>
        <p className="text-ocean-100 text-sm">Your content at a glance</p>
      </div>

      {/* Quick Actions - Full width on mobile */}
      <div className="mb-6">
        <QuickActionsWidget
          onCreateContent={() => onNavigate('form')}
          onViewCalendar={() => onNavigate('plan', 'plan')}
          onViewApprovals={onOpenApprovals}
          onOpenGuidelines={onOpenGuidelines}
          pendingCount={pendingApprovalCount}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6">
          <WeeklyStatsWidget entries={entries} />
          <ContentPipelineWidget entries={entries} onNavigate={onNavigate} />
        </div>

        {/* Middle Column */}
        <div className="space-y-6">
          <UrgentOpportunitiesWidget
            urgentOpenCount={urgentOpportunityCount}
            onOpenOpportunities={onOpenOpportunities || (() => onNavigate('opportunities'))}
          />
          <ApprovalQueueWidget
            entries={entries}
            currentUser={currentUser}
            onOpenEntry={onOpenEntry}
            onViewAll={onOpenApprovals}
          />
          <UpcomingDeadlines entries={entries} onOpenEntry={onOpenEntry} daysAhead={7} />
        </div>

        {/* Right Column */}
        <div className="space-y-6 lg:col-span-2 xl:col-span-1">
          <PillarBalanceWidget entries={entries} />
          <PlatformCoverageWidget entries={entries} />
          <AudienceSegmentWidget entries={entries} />
          <AssetMixWidget entries={entries} assetGoals={assetGoals} />
          <EngagementProgressWidget
            activities={engagementActivities}
            goals={engagementGoals}
            onNavigate={() => onNavigate('engagement')}
          />
        </div>
      </div>
    </div>
  );
}

export default DashboardView;
