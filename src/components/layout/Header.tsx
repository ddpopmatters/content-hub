/**
 * Header - Profile menu and top-right actions
 *
 * Contains the profile dropdown button, profile editing form,
 * and notification bell. Used across all authenticated views.
 *
 * Note: This is a typed shell for Phase 1. The full extraction
 * from app.jsx will happen in Phase 2.
 */
import type { ReactNode, RefObject } from 'react';

export interface ProfileMenuProps {
  currentUser: string;
  currentUserEmail: string;
  currentUserAvatar: string;
  profileInitials: string;
  isOpen: boolean;
  onToggle: () => void;
  menuRef: RefObject<HTMLDivElement>;
  children?: ReactNode;
}

export interface HeaderProps {
  currentUser: string;
  currentUserEmail: string;
  currentUserAvatar: string;
  profileMenuOpen: boolean;
  onProfileMenuToggle: () => void;
  profileMenuRef: RefObject<HTMLDivElement>;
  onSignOut: () => void;
  onChangePassword: () => void;
  notificationBell?: ReactNode;
  children?: ReactNode;
}

/**
 * Computes profile initials from user name or email
 *
 * Logic matches app.jsx profileInitials useMemo:
 * - Uses name (trimmed) or email or 'U' as base
 * - Splits on whitespace to get parts
 * - For 2+ parts: first char of first + first char of last
 * - For 1 part: first char + second char
 * - Fallback: first 2 chars of base
 */
export function getProfileInitials(name: string, email: string): string {
  const base = (name && name.trim()) || email || 'U';
  const parts = base.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return base.slice(0, 2).toUpperCase();
  }
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1] || '';
  return (first + last).toUpperCase();
}

/**
 * Header component - typed shell
 *
 * This component provides the type definitions and structure.
 * The actual implementation remains in app.jsx until Phase 2.
 */
export function Header({
  currentUser,
  currentUserEmail,
  currentUserAvatar,
  profileMenuOpen,
  onProfileMenuToggle,
  profileMenuRef,
  onSignOut: _onSignOut,
  onChangePassword: _onChangePassword,
  notificationBell,
  children,
}: HeaderProps) {
  const profileInitials = getProfileInitials(currentUser, currentUserEmail);

  return (
    <div className="mb-6 flex justify-end">
      <div className="relative">
        <button
          type="button"
          onClick={onProfileMenuToggle}
          className="flex items-center gap-2 rounded-full border border-graystone-200 bg-white px-3 py-1.5 text-sm font-semibold text-graystone-700 shadow-sm transition hover:border-ocean-200"
        >
          {currentUserAvatar ? (
            <img
              src={currentUserAvatar}
              alt={currentUser || currentUserEmail || 'Profile'}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ocean-600 text-xs font-semibold text-white">
              {profileInitials}
            </span>
          )}
          <span className="hidden sm:inline">{currentUser || currentUserEmail}</span>
          <svg
            className="h-4 w-4 text-graystone-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        {profileMenuOpen && (
          <div
            ref={profileMenuRef}
            className="absolute right-0 z-50 mt-3 w-72 max-w-xs rounded-3xl border border-graystone-200 bg-white p-4 shadow-2xl"
          >
            {children}
          </div>
        )}
      </div>
      {notificationBell}
    </div>
  );
}

export default Header;
