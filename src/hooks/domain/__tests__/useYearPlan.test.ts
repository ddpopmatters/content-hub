import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useYearPlan } from '../useYearPlan';

// Mock SUPABASE_API
vi.mock('../../../lib/supabase', () => ({
  SUPABASE_API: {
    fetchCampaigns: vi.fn().mockResolvedValue([]),
    saveCampaign: vi.fn().mockResolvedValue({
      id: 'c1',
      name: 'Test',
      type: 'campaign',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      colour: '#6366f1',
      createdBy: 'dan@example.org',
      createdAt: new Date().toISOString(),
    }),
    deleteCampaign: vi.fn().mockResolvedValue(true),
  },
}));

// Mock storage
vi.mock('../../../lib/storage', () => ({
  loadCampaigns: vi.fn().mockReturnValue([]),
  saveCampaigns: vi.fn(),
}));

const deps = {
  currentUser: 'dan@example.org',
  runSyncTask: vi
    .fn()
    .mockImplementation((_label: string, action: () => Promise<unknown>) =>
      action().then(() => true),
    ),
  pushSyncToast: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useYearPlan', () => {
  it('initialises with empty campaigns from localStorage', () => {
    const { result } = renderHook(() => useYearPlan(deps));
    expect(result.current.campaigns).toEqual([]);
  });

  it('addCampaign adds item optimistically', () => {
    const { result } = renderHook(() => useYearPlan(deps));
    const newCampaign = {
      name: 'World Pop Day',
      type: 'campaign' as const,
      startDate: '2026-06-01',
      endDate: '2026-07-15',
      colour: '#0ea5e9',
    };
    act(() => {
      result.current.addCampaign(newCampaign);
    });
    expect(result.current.campaigns).toHaveLength(1);
    expect(result.current.campaigns[0].name).toBe('World Pop Day');
  });

  it('addCampaign sets correct createdBy from currentUser', () => {
    const { result } = renderHook(() => useYearPlan(deps));
    act(() => {
      result.current.addCampaign({
        name: 'Attribution Test',
        type: 'campaign',
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        colour: '#6366f1',
      });
    });
    expect(result.current.campaigns[0].createdBy).toBe('dan@example.org');
  });

  it('deleteCampaign removes item optimistically', () => {
    const { result } = renderHook(() => useYearPlan(deps));
    act(() => {
      result.current.addCampaign({
        name: 'Test',
        type: 'campaign',
        startDate: '2026-01-01',
        endDate: '2026-02-28',
        colour: '#6366f1',
      });
    });
    const id = result.current.campaigns[0].id;
    act(() => {
      result.current.deleteCampaign(id);
    });
    expect(result.current.campaigns).toHaveLength(0);
  });

  it('updateCampaign updates item in state', () => {
    const { result } = renderHook(() => useYearPlan(deps));
    act(() => {
      result.current.addCampaign({
        name: 'Original',
        type: 'theme',
        startDate: '2026-03-01',
        endDate: '2026-05-31',
        colour: '#ec4899',
      });
    });
    const id = result.current.campaigns[0].id;
    act(() => {
      result.current.updateCampaign(id, { name: 'Updated' });
    });
    expect(result.current.campaigns[0].name).toBe('Updated');
  });

  it('refreshCampaigns calls fetchCampaigns and updates state', async () => {
    const { SUPABASE_API } = await import('../../../lib/supabase');
    vi.mocked(SUPABASE_API.fetchCampaigns).mockResolvedValueOnce([
      {
        id: 'server-1',
        name: 'From server',
        type: 'campaign',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        colour: '#22c55e',
        createdBy: 'dan@example.org',
        createdAt: new Date().toISOString(),
      },
    ]);
    const { result } = renderHook(() => useYearPlan(deps));
    act(() => {
      result.current.refreshCampaigns();
    });
    await waitFor(() => {
      expect(result.current.campaigns[0].name).toBe('From server');
    });
  });

  it('reset reloads campaigns from localStorage', async () => {
    const { loadCampaigns } = await import('../../../lib/storage');
    const stored = [
      {
        id: 'stored-1',
        name: 'Stored Campaign',
        type: 'campaign' as const,
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        colour: '#f59e0b',
        createdBy: 'dan@example.org',
        createdAt: new Date().toISOString(),
      },
    ];
    // First call: hook init returns empty; second call (reset): returns stored data
    vi.mocked(loadCampaigns).mockReturnValueOnce([]).mockReturnValueOnce(stored);
    const { result } = renderHook(() => useYearPlan(deps));
    expect(result.current.campaigns).toHaveLength(0);
    act(() => {
      result.current.reset();
    });
    expect(result.current.campaigns).toEqual(stored);
  });

  it('refreshCampaigns is NOT called after addCampaign when runSyncTask returns false', async () => {
    const { SUPABASE_API } = await import('../../../lib/supabase');
    const failingDeps = {
      ...deps,
      runSyncTask: vi.fn().mockResolvedValue(false),
    };
    const { result } = renderHook(() => useYearPlan(failingDeps));
    await act(async () => {
      result.current.addCampaign({
        name: 'Will Not Refresh',
        type: 'campaign',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        colour: '#0ea5e9',
      });
    });
    expect(vi.mocked(SUPABASE_API.fetchCampaigns)).not.toHaveBeenCalled();
  });

  it('pushSyncToast is called when fetchCampaigns rejects', async () => {
    const { SUPABASE_API } = await import('../../../lib/supabase');
    vi.mocked(SUPABASE_API.fetchCampaigns).mockRejectedValueOnce(new Error('network error'));
    const { result } = renderHook(() => useYearPlan(deps));
    await act(async () => {
      result.current.refreshCampaigns();
    });
    expect(deps.pushSyncToast).toHaveBeenCalledWith(
      'Unable to refresh campaigns from the server.',
      'warning',
    );
  });
});
