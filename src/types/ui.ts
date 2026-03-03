/**
 * UI component prop types for PM Dashboard
 */

import type {
  ReactNode,
  MouseEvent,
  ChangeEvent,
  KeyboardEvent,
  FormEvent,
  RefObject,
} from 'react';

// ============================================================================
// Common UI Types
// ============================================================================

// Button variants match app.jsx Button component
export type ButtonVariant = 'solid' | 'outline' | 'ghost' | 'destructive' | 'cta';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export interface InputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?:
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'date'
    | 'url'
    | 'datetime-local'
    | 'file'
    | 'month'
    | 'time';
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  autoFocus?: boolean;
}

export interface TextareaProps {
  value?: string;
  defaultValue?: string;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
}

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onClose?: () => void;
}

// Badge variants match app.jsx Badge component
export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'solid';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

// ============================================================================
// Layout Types
// ============================================================================

// ViewType matches currentView state values in app.jsx
export type ViewType =
  | 'menu'
  | 'form'
  | 'plan'
  | 'admin'
  | 'dashboard'
  | 'analytics'
  | 'engagement'
  | 'opportunities'
  | 'requests';

export type PlanTab = 'plan' | 'trash' | 'kanban' | 'approvals' | 'ideas' | 'narrative';

export interface AppShellProps {
  children: ReactNode;
  className?: string;
}

export interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

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

// ============================================================================
// Form Types
// ============================================================================

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export interface FormProps {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
  className?: string;
}

// ============================================================================
// Card Types
// ============================================================================

export interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

// ============================================================================
// Filter Types
// ============================================================================

export type FilterStatus = 'All' | 'draft' | 'in_review' | 'approved' | 'published';
export type FilterWorkflow = 'All' | 'pending' | 'approved' | 'rejected';

export interface EntryFilters {
  type: string;
  status: FilterStatus;
  platforms: string[];
  workflow: FilterWorkflow;
  query: string;
  overdue: boolean;
}

// ============================================================================
// Event Handler Types
// ============================================================================

export type ClickHandler = (e: MouseEvent<HTMLElement>) => void;
export type ChangeHandler<T = HTMLInputElement> = (e: ChangeEvent<T>) => void;
export type SubmitHandler = (e: FormEvent<HTMLFormElement>) => void;
export type KeyHandler<T = HTMLInputElement> = (e: KeyboardEvent<T>) => void;
