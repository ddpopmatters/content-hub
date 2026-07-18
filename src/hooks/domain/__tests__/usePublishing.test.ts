import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePublishing } from '../usePublishing';

describe('usePublishing', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('removes retired browser-side webhook settings', async () => {
    window.localStorage.setItem(
      'pm-publish-settings',
      JSON.stringify({ webhookUrl: 'https://hooks.example.org', webhookSecret: 'retired-secret' }),
    );

    const { result } = renderHook(() => usePublishing());

    await waitFor(() => expect(window.localStorage.getItem('pm-publish-settings')).toBeFalsy());
    expect(result.current).not.toHaveProperty('publishSettings');
  });
});
