// Application configuration
// Supabase credentials injected at build time via .env → esbuild define
// See .env.example for setup

export interface FeatureFlags {
  CALENDAR: boolean;
  KANBAN: boolean;
  APPROVALS: boolean;
  IDEAS: boolean;
  LINKEDIN: boolean;
  TESTING: boolean;
  COPY_CHECK: boolean;
  ACTIVITY_LOG: boolean;
}

export interface AppConfig {
  // Supabase configuration
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_ENABLED: boolean;

  // Authentication
  AUTH_ENABLED: boolean;

  // Organisation branding
  ORG_NAME: string;
  ORG_DOMAIN: string;
  LOGO_URL: string;

  // Environment
  IS_PRODUCTION: boolean;
  DEBUG_MODE: boolean;

  // Feature flags
  FEATURES: FeatureFlags;
}

const supabaseUrl = import.meta.env.SUPABASE_URL || 'https://dvhjvtxtkmtsqlnurhfg.supabase.co';
const supabaseAnonKey =
  import.meta.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2aGp2dHh0a210c3FsbnVyaGZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5OTI0OTYsImV4cCI6MjA4MzU2ODQ5Nn0.c4yIpOZXqU8Doci2IN6uNKA_rWwrrMzbMDkMx9HCjcc';

// Public OAuth identifiers — safe in frontend bundle (same pattern as client_id in OAuth)
export const META_FLOB_CONFIG_ID = import.meta.env.META_FLOB_CONFIG_ID || '1823163038321738';
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const APP_CONFIG: AppConfig = {
  // Supabase configuration — injected by esbuild from .env at build time
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabaseAnonKey,
  SUPABASE_ENABLED: hasSupabaseConfig,

  // Authentication
  AUTH_ENABLED: hasSupabaseConfig,

  // Organisation branding
  ORG_NAME: 'Population Matters',
  ORG_DOMAIN: 'populationmatters.org',
  LOGO_URL: 'https://populationmatters.org/wp-content/uploads/2022/03/PM-logo.png',

  // Environment
  IS_PRODUCTION: window.location.protocol !== 'file:',
  DEBUG_MODE: window.location.protocol === 'file:' || window.location.hostname === 'localhost',

  // Feature flags
  FEATURES: {
    CALENDAR: true,
    KANBAN: true,
    APPROVALS: true,
    IDEAS: true,
    LINKEDIN: true,
    TESTING: true,
    COPY_CHECK: true,
    ACTIVITY_LOG: true,
  },
};

export interface LoggerInterface {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (error: unknown, context?: string) => void;
}

// Logger utility respecting DEBUG_MODE
export const Logger: LoggerInterface = {
  debug: (...args: unknown[]) => {
    if (APP_CONFIG.DEBUG_MODE) console.log('[DEBUG]', ...args);
  },
  info: (...args: unknown[]) => {
    if (APP_CONFIG.DEBUG_MODE) console.info('[INFO]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (APP_CONFIG.DEBUG_MODE) console.warn('[WARN]', ...args);
  },
  error: (error: unknown, context = '') => {
    // Always log errors, but with more detail in debug mode
    if (APP_CONFIG.DEBUG_MODE) {
      console.error('[ERROR]', context, error);
    } else {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[ERROR]', context, message);
    }
  },
};

export interface KeyboardShortcut {
  action: string;
  description: string;
}

export type KeyboardShortcuts = Record<string, KeyboardShortcut>;

// Keyboard shortcuts configuration
export const KEYBOARD_SHORTCUTS: KeyboardShortcuts = {
  '?': { action: 'showHelp', description: 'Show keyboard shortcuts' },
  Escape: { action: 'closeModal', description: 'Close modal/panel' },
  n: { action: 'newEntry', description: 'New content entry' },
  i: { action: 'newIdea', description: 'New idea' },
  '/': { action: 'focusSearch', description: 'Focus search' },
  c: { action: 'calendarView', description: 'Calendar view' },
  k: { action: 'kanbanView', description: 'Kanban view' },
  a: { action: 'approvalsView', description: 'Approvals view' },
  d: { action: 'ideasView', description: 'Ideas view' },
  b: { action: 'toggleNotifications', description: 'Toggle notifications' },
};
