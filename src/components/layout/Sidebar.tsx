import React from 'react';
import { APP_CONFIG } from '../../lib/config';
import { cx } from '../../lib/utils';

export interface SidebarProps {
  currentView: string;
  planTab: string;
  onNavigate: (view: string) => void;
  currentUser: string;
  currentUserEmail: string;
  currentUserAvatar: string;
  profileInitials: string;
  onProfileClick: () => void;
  onSignOut: () => void;
  canUseCalendar: boolean;
  canUseKanban: boolean;
  canUseApprovals: boolean;
  canUseIdeas: boolean;
  canUseRequests: boolean;
  canUseInfluencers: boolean;
  currentUserIsAdmin: boolean;
  outstandingCount: number;
  className?: string;
  onClose?: () => void;
  showCloseButton?: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
  'layout-dashboard': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2" />
    </svg>
  ),
  'bar-chart': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="12" width="4" height="9" rx="1" strokeWidth="2" />
      <rect x="10" y="7" width="4" height="14" rx="1" strokeWidth="2" />
      <rect x="17" y="3" width="4" height="18" rx="1" strokeWidth="2" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7" r="4" strokeWidth="2" />
      <path
        d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
      <line x1="16" y1="2" x2="16" y2="6" strokeWidth="2" />
      <line x1="8" y1="2" x2="8" y2="6" strokeWidth="2" />
      <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2" />
    </svg>
  ),
  columns: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="5" height="18" rx="1" strokeWidth="2" />
      <rect x="10" y="3" width="5" height="18" rx="1" strokeWidth="2" />
      <rect x="17" y="3" width="5" height="18" rx="1" strokeWidth="2" />
    </svg>
  ),
  'check-circle': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lightbulb: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M9 18h6M10 22h4M12 2v1M4.22 4.22l.707.707M1 12h1M4.22 19.78l.707-.707M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  megaphone: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 1 0 0-6M5.436 13.683A4.001 4.001 0 0 1 7 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 0 1-1.564-.317"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  radar: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" strokeWidth="2" />
      <circle cx="12" cy="12" r="1" fill="currentColor" strokeWidth="1" />
      <path d="M12 12l6-6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  clipboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="5" y="4" width="14" height="18" rx="2" strokeWidth="2" />
      <path d="M9 4.5h6v3H9z" strokeWidth="2" />
      <line x1="8" y1="12" x2="16" y2="12" strokeWidth="2" />
      <line x1="8" y1="16" x2="16" y2="16" strokeWidth="2" />
    </svg>
  ),
  linkedin: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6ZM2 9h4v12H2ZM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  flask: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M9 3h6M10 3v5.5l-4 6v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4l-4-6V3"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" strokeWidth="2" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        strokeWidth="2"
      />
    </svg>
  ),
  plus: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <line x1="12" y1="5" x2="12" y2="19" strokeWidth="2" strokeLinecap="round" />
      <line x1="5" y1="12" x2="19" y2="12" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

export function Sidebar({
  currentView,
  planTab: _planTab,
  onNavigate,
  currentUser,
  currentUserEmail,
  currentUserAvatar,
  profileInitials,
  onProfileClick,
  onSignOut,
  canUseCalendar,
  canUseIdeas,
  canUseRequests,
  canUseInfluencers,
  currentUserIsAdmin,
  outstandingCount,
  className = '',
  onClose,
  showCloseButton = false,
}: SidebarProps): React.ReactElement {
  // Determine which sidebar item is active based on currentView and planTab
  const getActiveItem = () => {
    if (currentView === 'dashboard' || currentView === 'menu') return 'dashboard';
    if (currentView === 'insights') return 'insights';
    if (currentView === 'reporting') return 'reporting';
    if (currentView === 'admin') return 'admin';
    if (currentView === 'influencers') return 'influencers';
    if (currentView === 'form') return 'content';
    if (currentView === 'plan') return 'content';
    return 'dashboard';
  };

  const activeItem = getActiveItem();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', enabled: true },
    {
      id: 'content',
      label: 'Content',
      icon: 'calendar',
      enabled: canUseCalendar || canUseIdeas || canUseRequests,
      badge: outstandingCount,
    },
    { id: 'insights', label: 'Insights', icon: 'bar-chart', enabled: true },
    { id: 'reporting', label: 'Reporting', icon: 'clipboard', enabled: true },
    { id: 'influencers', label: 'Influencers', icon: 'megaphone', enabled: canUseInfluencers },
    { id: 'admin', label: 'Admin', icon: 'settings', enabled: currentUserIsAdmin },
  ].filter((item) => item.enabled);

  return (
    <aside
      className={cx(
        'flex h-full min-h-screen w-64 flex-col border-r border-ocean-700 bg-ocean-900 text-white shadow-2xl',
        className,
      )}
      aria-label="Primary navigation"
    >
      {/* Logo/Header */}
      <div className="border-b border-ocean-700 bg-white/95 p-6 text-ocean-900 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={APP_CONFIG.LOGO_URL}
              alt={APP_CONFIG.ORG_NAME}
              className="h-11 w-11 rounded-2xl border border-aqua-200 bg-white p-2 object-contain shadow-sm"
            />
            <div>
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-ocean-500">
                Internal tool
              </div>
              <h1 className="heading-font text-lg text-ocean-950">Content Hub</h1>
              <p className="mt-1 text-xs text-graystone-600">Plan, review and publish content.</p>
            </div>
          </div>
          {showCloseButton ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-aqua-200 text-ocean-700 transition hover:border-ocean-300 hover:bg-aqua-50 hover:text-ocean-900 md:hidden"
              aria-label="Close navigation"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cx(
              'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
              activeItem === item.id
                ? 'rounded-2xl bg-white text-ocean-900 shadow-lg shadow-ocean-950/15'
                : 'rounded-2xl text-ocean-100 hover:bg-ocean-800 hover:text-white',
            )}
          >
            <span className="shrink-0">{iconMap[item.icon]}</span>
            <span className="text-sm font-medium">{item.label}</span>
            {item.badge && item.badge > 0 && (
              <span className="ml-auto rounded-full bg-ocean-500 px-2 py-0.5 text-xs font-semibold text-white">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Add New Item - Special Button */}
      {canUseCalendar && (
        <div className="border-t border-ocean-700 p-4">
          <button
            onClick={() => onNavigate('form')}
            className={cx(
              'flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-left font-semibold transition-all',
              currentView === 'form'
                ? 'bg-white text-ocean-800 shadow-lg'
                : 'bg-ocean-500 text-white shadow-md hover:bg-ocean-400',
            )}
          >
            {iconMap.plus}
            <span className="font-heading text-sm tracking-wide">Add Content</span>
          </button>
        </div>
      )}

      {/* User Profile Section */}
      <div className="border-t border-ocean-700 p-4">
        <button
          onClick={onProfileClick}
          className="flex w-full items-center gap-3 rounded-2xl border border-ocean-700 bg-ocean-800/80 p-3 text-left transition-colors hover:bg-ocean-700"
        >
          {currentUserAvatar ? (
            <img
              src={currentUserAvatar}
              alt={currentUser || currentUserEmail || 'Profile'}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ocean-500 text-sm font-bold text-white">
              {profileInitials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">
              {currentUser || currentUserEmail}
            </div>
            <div className="text-xs text-ocean-300">View profile</div>
          </div>
        </button>
        <button
          onClick={onSignOut}
          className="mt-2 w-full text-xs text-ocean-300 transition-colors hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
