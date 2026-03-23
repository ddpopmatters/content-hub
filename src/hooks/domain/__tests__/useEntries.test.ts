import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { useEntries } from '../useEntries';

const { mockFetchEntries, mockGetWorkflowBlockers, mockSanitizeEntry, mockSaveEntry } = vi.hoisted(
  () => ({
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
    mockSanitizeEntry: vi.fn((e: Record<string, unknown>) => ({ ...e, _sanitized: true })),
    mockSaveEntry: vi.fn(() => Promise.resolve({ id: 'saved-entry' })),
  }),
);

// Mock all external dependencies
vi.mock('../../../lib/utils', () => ({
  uuid: () => 'test-uuid-' + Math.random().toString(36).slice(2, 8),
  ensurePeopleArray: (val: unknown) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string')
      return val
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    return [];
  },
}));

vi.mock('../../../lib/sanitizers', () => ({
  sanitizeEntry: mockSanitizeEntry,
  computeStatusDetail: () => 'ok',
  createEmptyChecklist: () => ({ items: [] }),
  entrySignature: () => 'sig',
  getWorkflowBlockers: mockGetWorkflowBlockers,
  hasApproverRelevantChanges: () => false,
}));

vi.mock('../../../lib/email', () => ({
  buildEntryEmailPayload: () => ({ subject: 'test', body: 'test' }),
}));

vi.mock('../../../lib/audit', () => ({
  appendAudit: vi.fn(),
}));

vi.mock('../../../lib/storage', () => ({
  loadEntries: vi.fn(() => []),
  saveEntries: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  SUPABASE_API: {
    fetchEntries: mockFetchEntries,
    subscribeToEntries: vi.fn(() => ({ unsubscribe: vi.fn() })),
    saveEntry: mockSaveEntry,
    deleteEntry: vi.fn(() => Promise.resolve(true)),
    restoreEntry: vi.fn(() => Promise.resolve(true)),
    hardDeleteEntry: vi.fn(() => Promise.resolve(true)),
  },
}));

vi.mock('../../../features/publishing', () => ({
  triggerPublish: vi.fn(),
  initializePublishStatus: (e: Record<string, unknown>) => e,
  canPublish: () => false,
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
    publishSettings: {},
    authStatus: 'ready',
    ...overrides,
  };
}

describe('useEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWorkflowBlockers.mockReturnValue([]);
    mockFetchEntries.mockResolvedValue([]);
    mockSaveEntry.mockResolvedValue({ id: 'saved-entry' });
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
        result.current.addEntry({ date: '2026-03-16', assetType: 'Social Post' });
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
        result.current.addEntry({ date: '2026-03-16', assetType: 'Social Post' });
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
        });
      });
      const id = result.current.entries[0].id as string;

      act(() => {
        result.current.toggleApprove(id);
      });

      const entry = result.current.entries.find((e) => e.id === id);
      expect(entry?.status).toBe('Approved');
      expect(entry?.approvedAt).toBeTruthy();
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
        result.current.addEntry({ date: '2026-03-16', assetType: 'Social Post' });
      });
      expect(result.current.entries).toHaveLength(2);

      act(() => {
        result.current.reset();
      });

      expect(result.current.entries).toHaveLength(0);
      expect(result.current.trashed).toHaveLength(0);
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
