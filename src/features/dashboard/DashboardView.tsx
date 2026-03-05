import React, { useState, useCallback, useEffect } from 'react';
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
import { MiniCalendar } from '../calendar/MiniCalendar';
import type { Entry, EngagementActivity, EngagementGoals } from '../../types/models';

const WIDGET_DEFS = [
  { id: 'quickActions', label: 'Quick Actions' },
  { id: 'weeklyStats', label: 'Weekly Stats' },
  { id: 'contentPipeline', label: 'Content Pipeline' },
  { id: 'urgentOpportunities', label: 'Urgent Opportunities' },
  { id: 'approvalQueue', label: 'Approval Queue' },
  { id: 'upcomingDeadlines', label: 'Upcoming Deadlines' },
  { id: 'pillarBalance', label: 'Pillar Balance' },
  { id: 'platformCoverage', label: 'Platform Coverage' },
  { id: 'audienceSegment', label: 'Audience Segment' },
  { id: 'assetMix', label: 'Asset Mix' },
  { id: 'engagementProgress', label: 'Engagement Progress' },
  { id: 'calendarGlance', label: 'Calendar at a Glance' },
] as const;

type WidgetId = (typeof WIDGET_DEFS)[number]['id'];

const ALL_ON: Record<WidgetId, boolean> = Object.fromEntries(
  WIDGET_DEFS.map((w) => [w.id, true]),
) as Record<WidgetId, boolean>;

function storageKey(user: string) {
  return `dashboard-widgets:${user}`;
}

function loadPrefs(user: string): Record<WidgetId, boolean> {
  try {
    const raw = localStorage.getItem(storageKey(user));
    if (!raw) return { ...ALL_ON };
    return { ...ALL_ON, ...JSON.parse(raw) };
  } catch {
    return { ...ALL_ON };
  }
}

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
  const [visible, setVisible] = useState<Record<WidgetId, boolean>>(() => loadPrefs(currentUser));
  const [customising, setCustomising] = useState(false);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(currentUser), JSON.stringify(visible));
    } catch {
      /* storage unavailable */
    }
  }, [visible, currentUser]);

  const toggle = useCallback((id: WidgetId) => {
    setVisible((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const show = (id: WidgetId) => visible[id];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Dashboard Header */}
      <div className="gradient-header mb-6 rounded-2xl p-6 text-white shadow-xl flex items-start justify-between">
        <div>
          <h1 className="heading-font text-2xl font-bold">Dashboard</h1>
          <p className="text-ocean-100 text-sm">Your content at a glance</p>
        </div>
        <button
          onClick={() => setCustomising((v) => !v)}
          className="mt-1 flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" strokeWidth="2" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
              strokeWidth="2"
            />
          </svg>
          {customising ? 'Done' : 'Customise'}
        </button>
      </div>

      {/* Customise panel */}
      {customising && (
        <div className="mb-6 rounded-2xl border border-graystone-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-ocean-800">Show / hide widgets</p>
          <div className="flex flex-wrap gap-2">
            {WIDGET_DEFS.map((w) => (
              <button
                key={w.id}
                onClick={() => toggle(w.id)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  visible[w.id]
                    ? 'border-ocean-300 bg-ocean-50 text-ocean-700'
                    : 'border-graystone-200 bg-graystone-50 text-graystone-400'
                }`}
              >
                {visible[w.id] ? '✓ ' : ''}
                {w.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-graystone-400">
            Your layout is saved automatically and private to you.
          </p>
        </div>
      )}

      {/* Quick Actions - Full width */}
      {show('quickActions') && (
        <div className="mb-6">
          <QuickActionsWidget
            onCreateContent={() => onNavigate('form')}
            onViewCalendar={() => onNavigate('plan', 'plan')}
            onViewApprovals={onOpenApprovals}
            onOpenGuidelines={onOpenGuidelines}
            pendingCount={pendingApprovalCount}
          />
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6">
          {show('weeklyStats') && <WeeklyStatsWidget entries={entries} />}
          {show('contentPipeline') && (
            <ContentPipelineWidget entries={entries} onNavigate={onNavigate} />
          )}
        </div>

        {/* Middle Column */}
        <div className="space-y-6">
          {show('urgentOpportunities') && (
            <UrgentOpportunitiesWidget
              urgentOpenCount={urgentOpportunityCount}
              onOpenOpportunities={onOpenOpportunities || (() => onNavigate('opportunities'))}
            />
          )}
          {show('approvalQueue') && (
            <ApprovalQueueWidget
              entries={entries}
              currentUser={currentUser}
              onOpenEntry={onOpenEntry}
              onViewAll={onOpenApprovals}
            />
          )}
          {show('upcomingDeadlines') && (
            <UpcomingDeadlines entries={entries} onOpenEntry={onOpenEntry} daysAhead={7} />
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6 lg:col-span-2 xl:col-span-1">
          {show('pillarBalance') && <PillarBalanceWidget entries={entries} />}
          {show('platformCoverage') && <PlatformCoverageWidget entries={entries} />}
          {show('audienceSegment') && <AudienceSegmentWidget entries={entries} />}
          {show('assetMix') && <AssetMixWidget entries={entries} assetGoals={assetGoals} />}
          {show('engagementProgress') && (
            <EngagementProgressWidget
              activities={engagementActivities}
              goals={engagementGoals}
              onNavigate={() => onNavigate('engagement')}
            />
          )}
        </div>
      </div>

      {/* Calendar at a Glance — full width */}
      {show('calendarGlance') && (
        <div className="mt-6">
          <MiniCalendar
            monthCursor={new Date()}
            entries={entries}
            onPreviewEntry={(entry) => onOpenEntry(entry.id)}
          />
        </div>
      )}
    </div>
  );
}

export default DashboardView;
