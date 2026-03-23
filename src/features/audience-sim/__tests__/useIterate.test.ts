import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIterate } from '../useIterate';

const { initSupabaseMock, getSupabaseMock, invokeMock, eqMock, updateMock, fromMock } = vi.hoisted(
  () => ({
    initSupabaseMock: vi.fn(),
    getSupabaseMock: vi.fn(),
    invokeMock: vi.fn(),
    eqMock: vi.fn(),
    updateMock: vi.fn(),
    fromMock: vi.fn(),
  }),
);

vi.mock('../../../lib/supabase', () => ({
  initSupabase: initSupabaseMock,
  getSupabase: getSupabaseMock,
}));

describe('useIterate', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    eqMock.mockResolvedValue({ error: null });
    updateMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ update: updateMock });
    invokeMock.mockResolvedValue({
      data: {
        diff: [
          { type: 'keep', text: 'Base ' },
          { type: 'add', text: 'revised', reason: 'Clarifies rights framing' },
        ],
        revised: 'Base revised',
      },
      error: null,
    });

    initSupabaseMock.mockResolvedValue(null);
    getSupabaseMock.mockReturnValue({
      functions: { invoke: invokeMock },
      from: fromMock,
    });
  });

  it('stores diff state and supports accept and reject', async () => {
    const { result } = renderHook(() => useIterate());

    await act(async () => {
      await result.current.iterate('sim-1', 'Base', [
        {
          persona_id: 'guardians',
          label: 'The Guardians',
          sentiment: 'positive',
          score: 80,
          key_reactions: ['Clear and humane'],
          concerns: [],
          suggested_improvements: [],
        },
      ]);
    });

    expect(invokeMock).toHaveBeenCalledWith(
      'iterate-content',
      expect.objectContaining({
        body: expect.objectContaining({ sim_id: 'sim-1', content: 'Base' }),
      }),
    );
    expect(result.current.diff).toHaveLength(2);
    expect(result.current.revised).toBe('Base revised');

    await act(async () => {
      const accepted = await result.current.accept();
      expect(accepted).toBe('Base revised');
    });

    expect(fromMock).toHaveBeenCalledWith('audience_simulations');
    expect(updateMock).toHaveBeenCalledWith({ iteration_status: 'complete' });
    expect(eqMock).toHaveBeenCalledWith('id', 'sim-1');

    act(() => {
      result.current.reject();
    });

    expect(result.current.diff).toBeNull();
    expect(result.current.revised).toBeNull();
  });
});
