import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudienceSim } from '../useAudienceSim';
import type { AudienceSim } from '../types';

const { createSimMock, getSimMock, listSimsMock, initSupabaseMock, getSupabaseMock, invokeMock } =
  vi.hoisted(() => ({
    createSimMock: vi.fn(),
    getSimMock: vi.fn(),
    listSimsMock: vi.fn(),
    initSupabaseMock: vi.fn(),
    getSupabaseMock: vi.fn(),
    invokeMock: vi.fn(),
  }));

vi.mock('../lib', () => ({
  createSim: createSimMock,
  getSim: getSimMock,
  listSims: listSimsMock,
}));

vi.mock('../../../lib/supabase', () => ({
  initSupabase: initSupabaseMock,
  getSupabase: getSupabaseMock,
}));

const makeSim = (overrides: Partial<AudienceSim> = {}): AudienceSim => ({
  id: 'sim-1',
  entry_id: 'entry-1',
  idea_id: null,
  content_text: 'Base content',
  content_type: 'social_caption',
  segments: ['guardians'],
  status: 'pending',
  error_message: null,
  results: null,
  iteration_original: null,
  iteration_revised: null,
  iteration_diff: null,
  iteration_status: null,
  iteration_error: null,
  run_by: 'dan@example.com',
  run_by_name: 'Dan',
  created_at: '2026-03-21T10:00:00.000Z',
  completed_at: null,
  ...overrides,
});

describe('useAudienceSim', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    initSupabaseMock.mockResolvedValue(null);
    getSupabaseMock.mockReturnValue({
      functions: {
        invoke: invokeMock,
      },
    });
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a sim and polls until completion', async () => {
    createSimMock.mockResolvedValue(makeSim());
    getSimMock.mockResolvedValueOnce(makeSim({ status: 'running' })).mockResolvedValueOnce(
      makeSim({
        status: 'complete',
        results: {
          overall_summary: 'Overall positive.',
          segment_results: [],
        },
        completed_at: '2026-03-21T10:05:00.000Z',
      }),
    );
    listSimsMock.mockResolvedValue([makeSim({ status: 'complete' })]);

    const { result } = renderHook(() => useAudienceSim());

    const runPromise = act(async () => {
      const promise = result.current.runSim({
        contentText: 'Base content',
        contentType: 'social_caption',
        entryId: 'entry-1',
        segments: ['guardians'],
        user: { email: 'dan@example.com', name: 'Dan' },
      });

      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(3000);
      await promise;
    });

    await runPromise;

    expect(createSimMock).toHaveBeenCalledWith(
      expect.objectContaining({
        entry_id: 'entry-1',
        content_text: 'Base content',
        segments: ['guardians'],
      }),
    );
    expect(invokeMock).toHaveBeenCalledWith(
      'simulate-audience',
      expect.objectContaining({
        body: expect.objectContaining({
          sim_id: 'sim-1',
          content_text: 'Base content',
        }),
      }),
    );
    expect(getSimMock).toHaveBeenCalledTimes(2);
    expect(result.current.sim?.status).toBe('complete');
    expect(result.current.history).toHaveLength(1);
  });
});
