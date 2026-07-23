import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { useEntries } from '../useEntries';
import type { DurablePublicationJob } from '../../../types/models';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const {
  mockFetchEntries,
  mockGetWorkflowBlockers,
  mockSanitizeEntry,
  mockSaveEntry,
  mockCanPublish,
  mockCanRetryFailedPlatform,
  mockGetSession,
  mockFetchLatestPublicationJob,
  mockHasApproverRelevantChanges,
  mockHasPublicationRelevantChanges,
  mockLoadEntries,
} = vi.hoisted(() => ({
  mockFetchEntries: vi.fn(() => Promise.resolve([])),
  mockGetWorkflowBlockers: vi.fn<
    () => Array<{
      key: string;
      label: string;
      detail: string;
      required: boolean;
      complete: boolean;
    }>
  >(() => []),
  mockSanitizeEntry: vi.fn((e: Record<string, unknown>) => ({
    ...e,
    _sanitized: true,
  })),
  mockSaveEntry: vi.fn(() => Promise.resolve({ id: 'saved-entry' })),
  mockCanPublish: vi.fn(() => false),
  mockCanRetryFailedPlatform: vi.fn(() => false),
  mockGetSession: vi.fn<() => Promise<{ access_token: string } | null>>(() =>
    Promise.resolve({ access_token: 'test-jwt-token' }),
  ),
  mockFetchLatestPublicationJob: vi.fn<() => Promise<DurablePublicationJob | null>>(() =>
    Promise.resolve(null),
  ),
  mockHasApproverRelevantChanges: vi.fn(() => false),
  mockHasPublicationRelevantChanges: vi.fn(() => false),
  mockLoadEntries: vi.fn<() => Array<Record<string, unknown>>>(() => []),
}));

// Mock all external dependencies
vi.mock('../../../lib/utils', () => ({
  uuid: () => 'test-uuid-' + Math.random().toString(36).slice(2, 8),
  ensurePeopleArray: (val: unknown) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      return val
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    return [];
  },
}));

vi.mock('../../../lib/sanitizers', () => ({
  sanitizeEntry: mockSanitizeEntry,
  computeStatusDetail: () => 'ok',
  createEmptyChecklist: () => ({ items: [] }),
  entrySignature: () => 'sig',
  getWorkflowBlockers: mockGetWorkflowBlockers,
  hasApproverRelevantChanges: mockHasApproverRelevantChanges,
  hasPublicationRelevantChanges: mockHasPublicationRelevantChanges,
}));

vi.mock('../../../lib/email', () => ({
  buildEntryEmailPayload: () => ({ subject: 'test', body: 'test' }),
}));

vi.mock('../../../lib/audit', () => ({
  appendAudit: vi.fn(),
}));

vi.mock('../../../lib/storage', () => ({
  loadEntries: mockLoadEntries,
  saveEntries: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  isDurablePublicationJob: (value: unknown) =>
    Boolean(
      value &&
        typeof value === 'object' &&
        typeof (value as Record<string, unknown>).id === 'string' &&
        Array.isArray((value as Record<string, unknown>).results),
    ),
  SUPABASE_API: {
    fetchEntries: mockFetchEntries,
    subscribeToEntries: vi.fn(() => ({ unsubscribe: vi.fn() })),
    saveEntry: mockSaveEntry,
    deleteEntry: vi.fn(() => Promise.resolve(true)),
    restoreEntry: vi.fn(() => Promise.resolve(true)),
    hardDeleteEntry: vi.fn(() => Promise.resolve(true)),
    getSession: mockGetSession,
    fetchLatestPublicationJob: mockFetchLatestPublicationJob,
  },
}));

vi.mock('../../../features/publishing', () => ({
  initializePublishStatus: vi.fn((platforms: string[]) =>
    Object.fromEntries(platforms.map((p) => [p, { status: 'publishing', url: null, error: null }])),
  ),
  canPublish: mockCanPublish,
  canRetryFailedPlatform: mockCanRetryFailedPlatform,
  getPublishRequestError: (status: number) =>
    status === 503
      ? 'Publishing is temporarily unavailable.'
      : 'Publishing failed. No confirmed result was recorded.',
}));

vi.mock('../../../lib/config', () => ({
  APP_CONFIG: {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ENABLED: true,
    SUPABASE_ANON_KEY: 'test-anon-key',
  },
  Logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../constants', () => ({
  KANBAN_STATUSES: ['Draft', 'Ready for Review', 'Approved', 'Published'],
}));

function mockDeps(overrides: Partial<Parameters<typeof useEntries>[0]> = {}) {
  return {
    runSyncTask: vi.fn().mockResolvedValue(true),
    pushSyncToast: vi.fn(),
    currentUser: 'Dan Smith',
    currentUserEmail: 'dan@example.com',
    currentUserIsAdmin: false,
    viewerIsAuthor: vi.fn(() => true),
    viewerIsApprover: vi.fn(() => false),
    addNotifications: vi.fn(),
    buildApprovalNotifications: vi.fn(() => []),
    notifyApproversAboutChange: vi.fn(),
    notifyViaServer: vi.fn(),
    markNotificationsAsReadForEntry: vi.fn(),
    guidelines: null,
    authStatus: 'ready',
    ...overrides,
  };
}

describe('useEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ access_token: 'test-jwt-token' });
    mockHasApproverRelevantChanges.mockReturnValue(false);
    mockHasPublicationRelevantChanges.mockReturnValue(false);
    mockCanRetryFailedPlatform.mockReturnValue(false);
    mockGetWorkflowBlockers.mockReturnValue([]);
    mockFetchEntries.mockResolvedValue([]);
    mockFetchLatestPublicationJob.mockResolvedValue(null);
    mockSaveEntry.mockResolvedValue({ id: 'saved-entry' });
    mockLoadEntries.mockReturnValue([]);
  });

  it('keeps local entry publication unavailable until server hydration', () => {
    mockLoadEntries.mockReturnValue([
      {
        id: 'local-entry',
        workflowStatus: 'Approved',
        publicationStateAvailable: true,
      },
    ]);
    const { result } = renderHook(() => useEntries(mockDeps()));

    act(() => result.current.hydrateFromLocal());

    expect(result.current.entries[0]).toMatchObject({
      id: 'local-entry',
      publicationStateAvailable: false,
    });
  });

  describe('addEntry', () => {
    it('adds a new entry with generated id and timestamps', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-15',
          assetType: 'Social Post',
          platforms: ['Twitter'],
          caption: 'Test post',
          author: 'Dan Smith',
        });
      });

      expect(result.current.entries).toHaveLength(1);
      const entry = result.current.entries[0];
      expect(entry.id).toBeTruthy();
      expect(entry.date).toBe('2026-03-15');
      expect(entry.assetType).toBe('Social Post');
      expect(entry.caption).toBe('Test post');
      expect(entry.createdAt).toBeTruthy();
      expect(entry.updatedAt).toBeTruthy();
      expect(entry.author).toBe('Dan Smith');
    });

    it('sanitizes the entry via sanitizeEntry', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({ date: '2026-03-15', assetType: 'Blog' });
      });

      // Our mock sets _sanitized: true
      expect(result.current.entries[0]._sanitized).toBe(true);
    });

    it('sets default status to Pending', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({ date: '2026-03-15' });
      });

      expect(result.current.entries[0].status).toBe('Pending');
    });

    it('calls runSyncTask for server sync', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({ date: '2026-03-15', assetType: 'Blog' });
      });

      expect(deps.runSyncTask).toHaveBeenCalled();
    });

    it('fires onEntryCreated only after create sync succeeds', async () => {
      const onEntryCreated = vi.fn();
      const deps = mockDeps({ onEntryCreated });
      const { result } = renderHook(() => useEntries(deps));

      await act(async () => {
        result.current.addEntry({
          date: '2026-03-15',
          assetType: 'Blog',
          caption: 'Synced entry',
          sourceRequestId: 'request-123',
        });
        await Promise.resolve();
      });

      expect(onEntryCreated).toHaveBeenCalledTimes(1);
      expect(onEntryCreated.mock.calls[0][0]).toMatchObject({
        caption: 'Synced entry',
        sourceRequestId: 'request-123',
      });
    });

    it('sends approval requests only after the entry is persisted', async () => {
      let releaseSave: (() => void) | undefined;
      const saveGate = new Promise<void>((resolve) => {
        releaseSave = resolve;
      });
      const notifyViaServer = vi.fn();
      const runSyncTask = vi.fn(
        async (_label: string, action: () => Promise<unknown>): Promise<boolean> => {
          await saveGate;
          await action();
          return true;
        },
      );
      const deps = mockDeps({ notifyViaServer, runSyncTask });
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-15',
          assetType: 'Blog',
          caption: 'Approval ordering',
          approvers: ['Jane Doe'],
        });
      });

      expect(mockSaveEntry).not.toHaveBeenCalled();
      expect(notifyViaServer).not.toHaveBeenCalled();

      await act(async () => {
        releaseSave?.();
        await saveGate;
        await Promise.resolve();
      });

      expect(mockSaveEntry).toHaveBeenCalledTimes(1);
      expect(notifyViaServer).toHaveBeenCalledWith(
        expect.objectContaining({
          approvers: ['Jane Doe'],
          approvalRequested: true,
        }),
        expect.stringContaining('Send approval request'),
      );
      expect(mockSaveEntry.mock.invocationCallOrder[0]).toBeLessThan(
        notifyViaServer.mock.invocationCallOrder[0],
      );
    });
  });

  describe('upsert', () => {
    it('revokes and persists approval when publishing content changes', async () => {
      mockHasPublicationRelevantChanges.mockReturnValue(true);
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-07-17',
          assetType: 'Design',
          platforms: ['BlueSky'],
          caption: 'Approved caption',
          workflowStatus: 'Approved',
          status: 'Approved',
          approvedAt: '2026-07-17T09:00:00.000Z',
          contentRevision: 4,
          approvedRevision: 4,
        });
      });
      const id = result.current.entries[0].id as string;

      act(() => {
        result.current.upsert({ id, caption: 'Edited caption' });
      });

      expect(result.current.entries[0]).toMatchObject({
        id,
        caption: 'Edited caption',
        workflowStatus: 'Ready for Review',
        status: 'Pending',
        approvedAt: null,
        contentRevision: 5,
        approvedRevision: null,
      });
      expect(deps.pushSyncToast).toHaveBeenCalledWith(
        'Approval cleared because publishing content changed.',
        'warning',
      );

      const updateCall = (deps.runSyncTask as Mock).mock.calls.find(([label]) =>
        String(label).includes('Update entry'),
      );
      const action = updateCall?.[1] as (() => Promise<unknown>) | undefined;
      expect(action).toBeTypeOf('function');

      await act(async () => {
        await action?.();
      });

      expect(mockSaveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          id,
          caption: 'Edited caption',
          workflowStatus: 'Ready for Review',
          status: 'Pending',
          approvedAt: null,
        }),
        'dan@example.com',
      );
    });

    it('keeps rapid successive partial edits in local state', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-07-17',
          assetType: 'Design',
          caption: 'Original caption',
          firstComment: 'Original first comment',
        });
      });
      const id = result.current.entries[0].id as string;

      act(() => {
        result.current.upsert({ id, caption: 'Edited caption' });
        result.current.upsert({ id, firstComment: 'Edited first comment' });
      });

      expect(result.current.entries[0]).toMatchObject({
        caption: 'Edited caption',
        firstComment: 'Edited first comment',
      });
    });

    it('notifies a newly assigned approver only after the update is persisted', async () => {
      mockLoadEntries.mockReturnValue([
        {
          id: 'entry-approver-ordering',
          date: '2026-07-17',
          assetType: 'Design',
          caption: 'Approver assignment',
          approvers: [],
        },
      ]);
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.hydrateFromLocal();
      });
      const id = result.current.entries[0].id as string;

      let releaseSave: (() => void) | undefined;
      const saveGate = new Promise<void>((resolve) => {
        releaseSave = resolve;
      });
      (deps.runSyncTask as Mock).mockImplementationOnce(
        async (_label: string, action: () => Promise<unknown>): Promise<boolean> => {
          await saveGate;
          await action();
          return true;
        },
      );
      mockSaveEntry.mockClear();
      (deps.notifyViaServer as Mock).mockClear();

      act(() => {
        result.current.upsert({ id, approvers: ['Jane Doe'] });
      });

      expect(mockSaveEntry).not.toHaveBeenCalled();
      expect(deps.notifyViaServer).not.toHaveBeenCalled();

      await act(async () => {
        releaseSave?.();
        await saveGate;
        await Promise.resolve();
      });

      expect(mockSaveEntry).toHaveBeenCalledTimes(1);
      expect(deps.notifyViaServer).toHaveBeenCalledWith(
        expect.objectContaining({
          approvers: ['Jane Doe'],
          approvalRequested: true,
        }),
        expect.stringContaining('Send approval request'),
      );
      expect(mockSaveEntry.mock.invocationCallOrder[0]).toBeLessThan(
        (deps.notifyViaServer as Mock).mock.invocationCallOrder[0],
      );
    });

    it('notifies approvers about changed content only after the update is persisted', async () => {
      mockLoadEntries.mockReturnValue([
        {
          id: 'entry-review-change-ordering',
          date: '2026-07-17',
          assetType: 'Design',
          caption: 'Original content',
          approvers: ['Jane Doe'],
        },
      ]);
      mockHasApproverRelevantChanges.mockReturnValue(true);
      let releaseSave: (() => void) | undefined;
      const saveGate = new Promise<void>((resolve) => {
        releaseSave = resolve;
      });
      const runSyncTask = vi.fn(
        async (_label: string, action: () => Promise<unknown>): Promise<boolean> => {
          await saveGate;
          await action();
          return true;
        },
      );
      const notifyApproversAboutChange = vi.fn();
      const deps = mockDeps({ notifyApproversAboutChange, runSyncTask });
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.hydrateFromLocal();
      });
      act(() => {
        result.current.upsert({
          id: 'entry-review-change-ordering',
          caption: 'Persisted content',
        });
      });

      expect(mockSaveEntry).not.toHaveBeenCalled();
      expect(notifyApproversAboutChange).not.toHaveBeenCalled();

      await act(async () => {
        releaseSave?.();
        await saveGate;
        await Promise.resolve();
      });

      expect(mockSaveEntry).toHaveBeenCalledTimes(1);
      expect(notifyApproversAboutChange).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'entry-review-change-ordering',
          caption: 'Persisted content',
        }),
      );
      expect(mockSaveEntry.mock.invocationCallOrder[0]).toBeLessThan(
        notifyApproversAboutChange.mock.invocationCallOrder[0],
      );
    });
  });

  describe('softDelete', () => {
    it('sets deletedAt on the entry', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({ date: '2026-03-15', assetType: 'Blog' });
      });
      const id = result.current.entries[0].id as string;

      act(() => {
        result.current.softDelete(id);
      });

      const entry = result.current.entries.find((e) => e.id === id);
      expect(entry?.deletedAt).toBeTruthy();
    });

    it('adds entry to trashed memo', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({ date: '2026-03-15', assetType: 'Blog' });
      });
      const id = result.current.entries[0].id as string;

      act(() => {
        result.current.softDelete(id);
      });

      expect(result.current.trashed).toHaveLength(1);
      expect(result.current.trashed[0].id).toBe(id);
    });
  });

  describe('restore', () => {
    it('clears deletedAt from a soft-deleted entry', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({ date: '2026-03-15', assetType: 'Blog' });
      });
      const id = result.current.entries[0].id as string;

      act(() => {
        result.current.softDelete(id);
      });
      expect(result.current.trashed).toHaveLength(1);

      act(() => {
        result.current.restore(id);
      });

      const entry = result.current.entries.find((e) => e.id === id);
      expect(entry?.deletedAt).toBeFalsy();
      expect(result.current.trashed).toHaveLength(0);
    });
  });

  describe('trashed memo', () => {
    it('returns only soft-deleted entries', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({ date: '2026-03-15', assetType: 'Blog' });
        result.current.addEntry({
          date: '2026-03-16',
          assetType: 'Social Post',
        });
      });

      const firstId = result.current.entries[0].id as string;

      act(() => {
        result.current.softDelete(firstId);
      });

      expect(result.current.entries).toHaveLength(2);
      expect(result.current.trashed).toHaveLength(1);
      expect(result.current.trashed[0].id).toBe(firstId);
    });

    it('sorts trashed entries by deletedAt descending', () => {
      vi.useFakeTimers();
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({ date: '2026-03-15', assetType: 'Blog' });
        result.current.addEntry({
          date: '2026-03-16',
          assetType: 'Social Post',
        });
      });

      const [first, second] = result.current.entries;

      // Delete first, advance time, then delete second
      act(() => {
        result.current.softDelete(first.id as string);
      });
      vi.advanceTimersByTime(1000);
      act(() => {
        result.current.softDelete(second.id as string);
      });

      expect(result.current.trashed).toHaveLength(2);
      // Second deleted later → should be first in trashed (descending)
      expect(result.current.trashed[0].id).toBe(second.id);
      vi.useRealTimers();
    });
  });

  describe('toggleApprove', () => {
    it('toggles entry status from Pending to Approved', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-15',
          assetType: 'Blog',
          approvers: ['Jane Doe'],
          contentRevision: 3,
          approvedRevision: null,
        });
      });
      const id = result.current.entries[0].id as string;

      act(() => {
        result.current.toggleApprove(id);
      });

      const entry = result.current.entries.find((e) => e.id === id);
      expect(entry?.status).toBe('Approved');
      expect(entry?.approvedAt).toBeTruthy();
      expect(entry?.approvedRevision).toBe(3);
    });

    it('toggles entry status from Approved back to Pending', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-15',
          assetType: 'Blog',
          approvers: ['Jane Doe'],
        });
      });
      const id = result.current.entries[0].id as string;

      // Approve first
      act(() => {
        result.current.toggleApprove(id);
      });
      expect(result.current.entries.find((e) => e.id === id)?.status).toBe('Approved');

      // Unapprove
      act(() => {
        result.current.toggleApprove(id);
      });

      const entry = result.current.entries.find((e) => e.id === id);
      expect(entry?.status).toBe('Pending');
      expect(entry?.approvedAt).toBeFalsy();
      expect(entry?.approvedRevision).toBeNull();
    });

    it('passes new workflowStatus to sanitizeEntry so status derives correctly', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-15',
          assetType: 'Blog',
          approvers: ['Jane Doe'],
          workflowStatus: 'Ready for Review',
        });
      });
      const id = result.current.entries[0].id as string;

      mockSanitizeEntry.mockClear();

      act(() => {
        result.current.toggleApprove(id);
      });

      // sanitizeEntry must be called with workflowStatus: 'Approved' so that it
      // can derive status: 'Approved' — without this, status remains 'Pending'
      const callForEntry = mockSanitizeEntry.mock.calls.find(
        ([e]) => (e as Record<string, unknown>).id === id,
      );
      expect(callForEntry?.[0]).toMatchObject({ workflowStatus: 'Approved' });
    });

    it('approves despite workflow blockers, showing an advisory toast', () => {
      mockGetWorkflowBlockers.mockReturnValue([
        {
          key: 'sourceVerified',
          label: 'Source verified',
          detail: 'Verify sources',
          required: true,
          complete: false,
        },
      ]);
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-15',
          assetType: 'Blog',
          approvers: ['Jane Doe'],
        });
      });
      const id = result.current.entries[0].id as string;

      act(() => {
        result.current.toggleApprove(id);
      });

      // approval proceeds — status flips to Approved
      expect(result.current.entries.find((e) => e.id === id)?.status).toBe('Approved');
      // advisory toast shown, not a hard block
      expect(deps.pushSyncToast).toHaveBeenCalledWith('Heads up: Source verified', 'warning');
    });

    it('calls runSyncTask to persist the approval to the database', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-15',
          assetType: 'Blog',
          approvers: ['Jane Doe'],
        });
      });
      const id = result.current.entries[0].id as string;

      act(() => {
        result.current.toggleApprove(id);
      });

      // runSyncTask must have been called with the approval label
      expect(deps.runSyncTask).toHaveBeenCalledWith(
        expect.stringContaining('Update approval'),
        expect.any(Function),
        expect.objectContaining({ requiresApi: false }),
      );
    });

    it('passes currentUserEmail into the approval save action', async () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-15',
          assetType: 'Blog',
          approvers: ['Jane Doe'],
        });
      });
      const id = result.current.entries[0].id as string;

      act(() => {
        result.current.toggleApprove(id);
      });

      const runSyncTaskMock = deps.runSyncTask as Mock;
      const approvalCall = runSyncTaskMock.mock.calls.find(([label]) =>
        String(label).includes('Update approval'),
      );
      const action = approvalCall?.[1] as (() => Promise<unknown>) | undefined;

      expect(action).toBeTypeOf('function');

      await act(async () => {
        await action?.();
      });

      expect(mockSaveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          id,
          status: 'Approved',
          workflowStatus: 'Approved',
        }),
        'dan@example.com',
      );
    });

    it('shows an explicit approval error toast when persistence fails', async () => {
      const deps = mockDeps({
        runSyncTask: vi.fn().mockResolvedValue(false),
      });
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-15',
          assetType: 'Blog',
          approvers: ['Jane Doe'],
        });
      });
      const id = result.current.entries[0].id as string;

      await act(async () => {
        result.current.toggleApprove(id);
        await Promise.resolve();
      });

      expect(deps.pushSyncToast).toHaveBeenCalledWith(
        'Approval change failed to save. Reloaded server state.',
        'warning',
      );
      expect(mockFetchEntries).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('clears all entries and viewing state', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({ date: '2026-03-15', assetType: 'Blog' });
        result.current.addEntry({
          date: '2026-03-16',
          assetType: 'Social Post',
        });
      });
      expect(result.current.entries).toHaveLength(2);

      act(() => {
        result.current.reset();
      });

      expect(result.current.entries).toHaveLength(0);
      expect(result.current.trashed).toHaveLength(0);
    });
  });

  describe('handlePublishEntry', () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetch);
      mockCanPublish.mockReturnValue(true);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      mockCanPublish.mockReturnValue(false);
    });

    it('calls the Supabase Edge Function URL, not a Zapier webhook', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          results: {
            Bluesky: {
              status: 'published',
              url: 'https://bsky.app/profile/test/post/abc',
              error: null,
              timestamp: new Date().toISOString(),
            },
          },
        }),
      });

      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-24',
          assetType: 'Social Post',
          platforms: ['Bluesky'],
          caption: 'Test post',
          workflowStatus: 'Approved',
          contentRevision: 1,
        });
      });
      const id = result.current.entries[0].id as string;

      await act(async () => {
        await result.current.handlePublishEntry(id);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('functions/v1/publish-entry'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-jwt-token',
            apikey: 'test-anon-key',
          }),
          body: expect.stringContaining(`"entryId":"${id}"`),
        }),
      );

      const lastFetchCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const requestBody = JSON.parse((lastFetchCall[1] as RequestInit).body as string) as Record<
        string,
        unknown
      >;
      expect(requestBody.requestKey).toEqual(expect.stringMatching(UUID_PATTERN));
    });

    it('reuses the same publication intent key for a repeated browser request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          results: {
            BlueSky: {
              status: 'failed',
              url: null,
              error: 'BlueSky did not confirm publication.',
              timestamp: new Date().toISOString(),
            },
          },
        }),
      });

      const { result } = renderHook(() => useEntries(mockDeps()));
      act(() => {
        result.current.addEntry({
          date: '2026-03-24',
          assetType: 'Social Post',
          platforms: ['BlueSky'],
          caption: 'Test post',
          workflowStatus: 'Approved',
        });
      });
      const id = result.current.entries[0].id as string;

      await act(async () => {
        await result.current.handlePublishEntry(id);
        await result.current.handlePublishEntry(id);
      });

      const requestKeys = mockFetch.mock.calls.map((call) => {
        const body = JSON.parse((call[1] as RequestInit).body as string) as {
          requestKey: string;
        };
        return body.requestKey;
      });
      expect(requestKeys).toHaveLength(2);
      expect(requestKeys[0]).toBe(requestKeys[1]);
    });

    it('does not call the publishing function without an authenticated session', async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-24',
          assetType: 'Social Post',
          platforms: ['Bluesky'],
          caption: 'Test post',
          workflowStatus: 'Approved',
        });
      });
      const id = result.current.entries[0].id as string;

      await act(async () => {
        await result.current.handlePublishEntry(id);
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockSaveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          publishStatus: expect.objectContaining({
            Bluesky: expect.objectContaining({
              status: 'failed',
              error: 'Sign in again before publishing.',
            }),
          }),
        }),
        expect.any(String),
      );
    });

    it('persists per-platform publish status and URL from Edge Function results', async () => {
      const publishedUrl = 'https://bsky.app/profile/test/post/abc123';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          results: {
            Bluesky: {
              status: 'published',
              url: publishedUrl,
              error: null,
              timestamp: new Date().toISOString(),
            },
          },
        }),
      });

      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-24',
          assetType: 'Social Post',
          platforms: ['Bluesky'],
          caption: 'Test post',
          workflowStatus: 'Approved',
        });
      });
      const id = result.current.entries[0].id as string;

      await act(async () => {
        await result.current.handlePublishEntry(id);
      });

      // saveEntry receives the per-platform result including the real published URL
      expect(mockSaveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          publishStatus: expect.objectContaining({
            Bluesky: expect.objectContaining({
              status: 'published',
              url: publishedUrl,
            }),
          }),
        }),
        expect.any(String),
      );
    });
    it('does not persist workflowStatus Published when all platforms return skipped', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          results: {
            Instagram: {
              status: 'skipped',
              url: null,
              error: 'Instagram coming in Phase 3',
              timestamp: new Date().toISOString(),
            },
          },
        }),
      });

      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-24',
          assetType: 'Social Post',
          platforms: ['Instagram'],
          caption: 'Test post',
          workflowStatus: 'Approved',
        });
      });
      const id = result.current.entries[0].id as string;

      await act(async () => {
        await result.current.handlePublishEntry(id);
      });

      // saveEntry must NOT be called with workflowStatus: 'Published'
      const saveCall = (
        mockSaveEntry.mock.calls as unknown as Array<[Record<string, unknown>, string]>
      ).find(([entry]) => entry.id === id);
      expect(saveCall).toBeDefined();
      expect(saveCall![0].workflowStatus).not.toBe('Published');
    });

    it('does not persist raw Edge response bodies when publication fails', async () => {
      const readResponseBody = vi
        .fn()
        .mockResolvedValue(
          'access_token=secret-token&code=secret-code&signed_url=https://private.example',
        );
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: readResponseBody,
      });

      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-24',
          assetType: 'Social Post',
          platforms: ['BlueSky'],
          caption: 'Test post',
          workflowStatus: 'Approved',
        });
      });
      const id = result.current.entries[0].id as string;

      await act(async () => {
        await result.current.handlePublishEntry(id);
      });

      expect(readResponseBody).not.toHaveBeenCalled();
      expect(mockSaveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          publishStatus: expect.objectContaining({
            BlueSky: expect.objectContaining({
              error: 'Publishing failed. No confirmed result was recorded.',
            }),
          }),
        }),
        expect.any(String),
      );
    });

    it('fails closed to Unknown when the dispatched request loses its response', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('network response lost'));
      mockFetchLatestPublicationJob.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useEntries(mockDeps()));
      act(() => {
        result.current.addEntry({
          date: '2026-07-17',
          assetType: 'Social Post',
          platforms: ['BlueSky'],
          caption: 'Possibly dispatched post',
          workflowStatus: 'Approved',
          contentRevision: 1,
        });
      });
      const id = result.current.entries[0].id as string;

      await act(async () => {
        await result.current.handlePublishEntry(id);
      });

      expect(mockFetchLatestPublicationJob).toHaveBeenCalledWith(id);
      expect(mockSaveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          publishStatus: expect.objectContaining({
            BlueSky: expect.objectContaining({ status: 'unknown' }),
          }),
        }),
        expect.any(String),
      );
    });

    it('fails closed to Unknown when a successful response is malformed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new SyntaxError('malformed JSON');
        },
      });
      mockFetchLatestPublicationJob.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useEntries(mockDeps()));
      act(() => {
        result.current.addEntry({
          date: '2026-07-17',
          assetType: 'Social Post',
          platforms: ['BlueSky'],
          caption: 'Possibly published post',
          workflowStatus: 'Approved',
          contentRevision: 1,
        });
      });
      const id = result.current.entries[0].id as string;

      await act(async () => {
        await result.current.handlePublishEntry(id);
      });

      expect(mockFetchLatestPublicationJob).toHaveBeenCalledWith(id);
      expect(mockSaveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          publishStatus: expect.objectContaining({
            BlueSky: expect.objectContaining({ status: 'unknown' }),
          }),
        }),
        expect.any(String),
      );
    });

    it('loads durable unknown state after a non-success Edge response', async () => {
      const completedAt = '2026-07-17T20:31:00.000Z';
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
      mockFetchLatestPublicationJob.mockResolvedValueOnce({
        id: '40000000-0000-4000-8000-000000000001',
        entryId: 'placeholder',
        entryRevision: 1,
        triggerType: 'manual',
        requestKey: '30000000-0000-4000-8000-000000000001',
        status: 'unknown',
        claimedAt: completedAt,
        completedAt,
        createdAt: completedAt,
        updatedAt: completedAt,
        results: [
          {
            id: '50000000-0000-4000-8000-000000000001',
            platform: 'BlueSky',
            status: 'unknown',
            url: null,
            error: 'BlueSky may have received the post. Check the platform before retrying.',
            attemptCount: 1,
            claimedAt: completedAt,
            completedAt,
            createdAt: completedAt,
            updatedAt: completedAt,
          },
        ],
      });

      const { result } = renderHook(() => useEntries(mockDeps()));
      act(() => {
        result.current.addEntry({
          date: '2026-03-24',
          assetType: 'Social Post',
          platforms: ['BlueSky'],
          caption: 'Test post',
          workflowStatus: 'Approved',
          contentRevision: 1,
        });
      });
      const id = result.current.entries[0].id as string;
      const durableJob = await mockFetchLatestPublicationJob();
      if (!durableJob) throw new Error('Expected durable test job');
      mockFetchLatestPublicationJob.mockResolvedValueOnce({
        ...durableJob,
        entryId: id,
      });

      await act(async () => {
        await result.current.handlePublishEntry(id);
      });

      expect(mockSaveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          publishStatus: expect.objectContaining({
            BlueSky: expect.objectContaining({ status: 'unknown' }),
          }),
          publicationJob: expect.objectContaining({ status: 'unknown' }),
        }),
        expect.any(String),
      );
    });

    it('keeps the workflow approved when only some platforms publish', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          results: {
            Facebook: {
              status: 'published',
              url: 'https://www.facebook.com/123',
              error: null,
              timestamp: new Date().toISOString(),
            },
            LinkedIn: {
              status: 'failed',
              url: null,
              error: 'LinkedIn did not confirm publication.',
              timestamp: new Date().toISOString(),
            },
          },
        }),
      });

      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-24',
          assetType: 'Social Post',
          platforms: ['Facebook', 'LinkedIn'],
          caption: 'Test post',
          workflowStatus: 'Approved',
        });
      });
      const id = result.current.entries[0].id as string;

      await act(async () => {
        await result.current.handlePublishEntry(id);
      });

      const saveCall = (
        mockSaveEntry.mock.calls as unknown as Array<[Record<string, unknown>, string]>
      ).find(([entry]) => entry.id === id);
      expect(saveCall).toBeDefined();
      expect(saveCall![0].workflowStatus).not.toBe('Published');
      expect(saveCall![0].publishedAt).toBeUndefined();
      expect(saveCall![0].publishStatus).toEqual(
        expect.objectContaining({
          Facebook: expect.objectContaining({ status: 'published' }),
          LinkedIn: expect.objectContaining({ status: 'failed' }),
        }),
      );
    });
  });

  describe('handleRetryPublicationPlatform', () => {
    const mockFetch = vi.fn();
    const completedAt = '2026-07-17T20:31:00.000Z';
    const entryId = '10000000-0000-4000-8000-000000000001';
    const jobId = '40000000-0000-4000-8000-000000000001';
    const partialJob: DurablePublicationJob = {
      id: jobId,
      entryId,
      entryRevision: 3,
      triggerType: 'manual',
      requestKey: '30000000-0000-4000-8000-000000000001',
      status: 'partial',
      claimedAt: completedAt,
      completedAt,
      createdAt: completedAt,
      updatedAt: completedAt,
      results: [
        {
          id: '50000000-0000-4000-8000-000000000001',
          platform: 'Facebook',
          status: 'published',
          url: 'https://www.facebook.com/123',
          error: null,
          attemptCount: 1,
          claimedAt: completedAt,
          completedAt,
          createdAt: completedAt,
          updatedAt: completedAt,
        },
        {
          id: '50000000-0000-4000-8000-000000000002',
          platform: 'LinkedIn',
          status: 'failed',
          url: null,
          error: 'LinkedIn did not confirm publication.',
          attemptCount: 1,
          claimedAt: completedAt,
          completedAt,
          createdAt: completedAt,
          updatedAt: completedAt,
        },
      ],
    };
    const partialEntry = {
      id: entryId,
      workflowStatus: 'Approved',
      platforms: ['Facebook', 'LinkedIn'],
      contentRevision: 3,
      approvedRevision: 3,
      publicationStateAvailable: true,
      publicationJob: partialJob,
      publishStatus: {
        Facebook: {
          status: 'published',
          url: 'https://www.facebook.com/123',
          error: null,
          timestamp: completedAt,
        },
        LinkedIn: {
          status: 'failed',
          url: null,
          error: 'LinkedIn did not confirm publication.',
          timestamp: completedAt,
        },
      },
    };

    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetch);
      mockCanRetryFailedPlatform.mockReturnValue(true);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      mockCanRetryFailedPlatform.mockReturnValue(false);
    });

    it('requests only the failed platform and preserves the confirmed sibling', async () => {
      const publishedJob: DurablePublicationJob = {
        ...partialJob,
        status: 'published',
        results: partialJob.results.map((publicationResult) =>
          publicationResult.platform === 'LinkedIn'
            ? {
                ...publicationResult,
                status: 'published',
                url: 'https://www.linkedin.com/feed/update/456',
                error: null,
                attemptCount: 2,
              }
            : publicationResult,
        ),
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, job: publishedJob }),
      });
      const { result } = renderHook(() => useEntries(mockDeps()));
      act(() => result.current.setEntries([partialEntry]));

      await act(async () => {
        await result.current.handleRetryPublicationPlatform(entryId, 'LinkedIn');
      });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as Record<
        string,
        unknown
      >;
      expect(body).toEqual({
        action: 'retry_failed',
        entryId,
        jobId,
        retryRequestKey: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
        platform: 'LinkedIn',
      });
      expect(result.current.entries[0]).toMatchObject({
        workflowStatus: 'Published',
        publishStatus: {
          Facebook: { status: 'published', url: 'https://www.facebook.com/123' },
          LinkedIn: {
            status: 'published',
            url: 'https://www.linkedin.com/feed/update/456',
          },
        },
      });
    });

    it('marks only the retried platform Unknown when dispatched state cannot be reloaded', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('response lost'));
      mockFetchLatestPublicationJob.mockResolvedValueOnce(null);
      const { result } = renderHook(() => useEntries(mockDeps()));
      act(() => result.current.setEntries([partialEntry]));

      await act(async () => {
        await expect(
          result.current.handleRetryPublicationPlatform(entryId, 'LinkedIn'),
        ).rejects.toThrow('Publishing state could not be verified');
      });

      expect(result.current.entries[0]).toMatchObject({
        publicationStateAvailable: false,
        publishStatus: {
          Facebook: { status: 'published', url: 'https://www.facebook.com/123' },
          LinkedIn: { status: 'unknown', url: null },
        },
      });
    });

    it('does not overwrite a concurrent local content edit when retry state returns', async () => {
      const publishedJob: DurablePublicationJob = {
        ...partialJob,
        status: 'published',
        results: partialJob.results.map((publicationResult) =>
          publicationResult.platform === 'LinkedIn'
            ? {
                ...publicationResult,
                status: 'published',
                url: 'https://www.linkedin.com/feed/update/456',
                error: null,
                attemptCount: 2,
              }
            : publicationResult,
        ),
      };
      let resolveFetch!: (response: { ok: boolean; json: () => Promise<unknown> }) => void;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );
      const { result } = renderHook(() => useEntries(mockDeps()));
      act(() => result.current.setEntries([partialEntry]));

      let retryPromise!: Promise<void>;
      await act(async () => {
        retryPromise = result.current.handleRetryPublicationPlatform(entryId, 'LinkedIn');
        await Promise.resolve();
      });
      act(() =>
        result.current.setEntries([
          {
            ...partialEntry,
            caption: 'Edited while the retry was in flight',
            contentRevision: 4,
            approvedRevision: null,
            workflowStatus: 'Ready for Review',
          },
        ]),
      );
      resolveFetch({
        ok: true,
        json: async () => ({ success: true, job: publishedJob }),
      });
      await act(async () => {
        await retryPromise;
      });

      expect(result.current.entries[0]).toMatchObject({
        caption: 'Edited while the retry was in flight',
        contentRevision: 4,
        approvedRevision: null,
        workflowStatus: 'Ready for Review',
      });
    });

    it('does not read a failed retry response body before durable reconciliation', async () => {
      const readResponseBody = vi.fn().mockResolvedValue({
        error: 'access_token=secret-token',
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: readResponseBody,
      });
      mockFetchLatestPublicationJob.mockResolvedValueOnce(partialJob);
      const { result } = renderHook(() => useEntries(mockDeps()));
      act(() => result.current.setEntries([partialEntry]));

      await act(async () => {
        await expect(
          result.current.handleRetryPublicationPlatform(entryId, 'LinkedIn'),
        ).rejects.toThrow('not available for a safe retry');
      });

      expect(readResponseBody).not.toHaveBeenCalled();
      expect(result.current.entries[0]).toMatchObject({
        publishStatus: {
          Facebook: { status: 'published', url: 'https://www.facebook.com/123' },
          LinkedIn: { status: 'failed' },
        },
      });
    });
  });

  describe('cloneEntry', () => {
    it('creates a copy with new id and Pending status', () => {
      const deps = mockDeps();
      const { result } = renderHook(() => useEntries(deps));

      act(() => {
        result.current.addEntry({
          date: '2026-03-15',
          assetType: 'Blog',
          caption: 'Original',
          status: 'Approved',
        });
      });
      const original = result.current.entries[0];

      act(() => {
        // cloneEntry takes the full entry object, not an ID
        result.current.cloneEntry(original);
      });

      expect(result.current.entries).toHaveLength(2);
      const clone = result.current.entries.find((e) => e.id !== original.id);
      expect(clone).toBeTruthy();
      expect(clone!.id).not.toBe(original.id);
      expect(clone!.caption).toBe('Original');
      expect(clone!.status).toBe('Pending');
    });
  });
});
