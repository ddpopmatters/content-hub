import type { Guidelines, Idea } from './models';

declare global {
  interface WindowApi {
    enabled?: boolean;
    listEntries?: () => Promise<Record<string, unknown>[]>;
    listIdeas?: () => Promise<Idea[]>;
    getGuidelines?: () => Promise<Guidelines | null>;
    listUsers?: () => Promise<Record<string, unknown>[]>;
    updateEntry?: (
      entryId: string,
      patch: Record<string, unknown>,
    ) => Promise<Record<string, unknown> | null>;
    logout?: () => Promise<void>;
    listAudit?: (options?: Record<string, unknown>) => Promise<unknown>;
    listApprovers?: () => Promise<unknown>;
    notify?: (payload: Record<string, unknown>) => Promise<unknown>;
  }

  interface Window {
    api?: WindowApi;
    supabase?: { createClient: typeof import('@supabase/supabase-js').createClient };
    supabaseReady?: Promise<void>;
    __currentUserEmail?: string | null;
    __currentUserName?: string | null;
  }
}

export {};
