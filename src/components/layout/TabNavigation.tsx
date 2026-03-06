/**
 * TabNavigation - Plan view tab navigation
 *
 * Renders the tab buttons for switching between different views
 * within the plan section (calendar, kanban, ideas, linkedin, testing).
 */
import type { PlanTab } from '../../types';

export interface TabConfig {
  key: PlanTab;
  label: string;
  enabled: boolean;
}

export interface TabNavigationProps {
  activeTab: PlanTab;
  onTabChange: (tab: PlanTab) => void;
  tabs: TabConfig[];
  className?: string;
}

/**
 * Helper to generate tab button classes
 */
function getTabClasses(isActive: boolean): string {
  const base = 'rounded-2xl px-4 py-2 text-sm transition';
  if (isActive) {
    return `${base} bg-ocean-500 text-white hover:bg-ocean-600`;
  }
  return `${base} text-ocean-600 hover:bg-aqua-100`;
}

/**
 * TabNavigation component
 *
 * Renders a pill-style tab bar for the plan view.
 * Tabs are conditionally shown based on user permissions.
 */
export function TabNavigation({
  activeTab,
  onTabChange,
  tabs,
  className = '',
}: TabNavigationProps) {
  const enabledTabs = tabs.filter((tab) => tab.enabled);

  if (enabledTabs.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-3xl border border-aqua-200 bg-aqua-50 p-1 text-ocean-600 ${className}`.trim()}
    >
      {enabledTabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
          className={getTabClasses(activeTab === tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Default tab configuration for Content view
 *
 * @example
 * const tabs = getDefaultTabs({
 *   canUseCalendar: true,
 *   canUseKanban: true,
 *   canUseApprovals: true,
 * });
 */
export function getDefaultTabs(permissions: {
  canUseCalendar: boolean;
  canUseIdeas: boolean;
}): TabConfig[] {
  return [
    { key: 'plan', label: 'Calendar', enabled: permissions.canUseCalendar },
    { key: 'ideas', label: 'Ideas', enabled: permissions.canUseIdeas },
  ];
}

export default TabNavigation;
