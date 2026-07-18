import { describe, expect, it, vi } from 'vitest';
import {
  PUBLICATION_CONTRACT_VERSION,
  PRODUCTION_SUPABASE_URL,
  resolvePublicationBackendConfiguration,
  verifyPublicationBackend,
} from '../../tools/check-publication-backend.mjs';

const configuration = {
  supabaseUrl: 'https://content-hub.example.supabase.co',
  publishableKey: 'publishable-test-key',
};

describe('publication backend rollout check', () => {
  it('checks the same resolved shared project that the production build will ship', () => {
    const resolved = resolvePublicationBackendConfiguration((key) =>
      key === 'SUPABASE_URL' ? 'https://dvhjvtxtkmtsqlnurhfg.supabase.co' : '',
    );

    expect(resolved.supabaseUrl).toBe(PRODUCTION_SUPABASE_URL);
    expect(resolved.publishableKey).toBeTruthy();
  });

  it('rejects a production build which resolves to an unapproved project', () => {
    expect(() =>
      resolvePublicationBackendConfiguration((key) =>
        key === 'SUPABASE_URL' ? 'https://unexpected-project.supabase.co' : '',
      ),
    ).toThrow('not the approved shared project');
  });

  it('accepts only the exact durable publication contract', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ready: true,
        contractVersion: PUBLICATION_CONTRACT_VERSION,
      }),
    });

    await expect(verifyPublicationBackend({ ...configuration, fetchImpl })).resolves.toEqual({
      contractVersion: PUBLICATION_CONTRACT_VERSION,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL('https://content-hub.example.supabase.co/functions/v1/publish-entry'),
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
        headers: {
          Authorization: 'Bearer publishable-test-key',
          apikey: 'publishable-test-key',
        },
      }),
    );
  });

  it('blocks a legacy or mismatched contract', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ready: true, contractVersion: 'legacy-v13' }),
    });

    await expect(verifyPublicationBackend({ ...configuration, fetchImpl })).rejects.toThrow(
      'does not match',
    );

    fetchImpl.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ready: true,
        contractVersion: PUBLICATION_CONTRACT_VERSION,
        unexpected: true,
      }),
    });
    await expect(verifyPublicationBackend({ ...configuration, fetchImpl })).rejects.toThrow(
      'does not match',
    );
  });

  it('blocks an unavailable backend without reading its response body', async () => {
    const readBody = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: readBody,
    });

    await expect(verifyPublicationBackend({ ...configuration, fetchImpl })).rejects.toThrow(
      'Deployment is blocked',
    );
    expect(readBody).not.toHaveBeenCalled();
  });

  it('rejects missing configuration and non-HTTPS targets before fetching', async () => {
    const fetchImpl = vi.fn();

    await expect(
      verifyPublicationBackend({ ...configuration, supabaseUrl: '', fetchImpl }),
    ).rejects.toThrow('Supabase URL is required');
    await expect(
      verifyPublicationBackend({
        ...configuration,
        supabaseUrl: 'http://localhost:54321',
        fetchImpl,
      }),
    ).rejects.toThrow('requires an HTTPS');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
