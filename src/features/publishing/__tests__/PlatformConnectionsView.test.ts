import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildOAuthUrl } from '../PlatformConnectionsView';

describe('buildOAuthUrl', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('META_FLOB_CONFIG_ID', 'test-config-123');
    vi.stubEnv('META_APP_ID', '');
  });

  it('uses FLoB config_id URL for Instagram when META_FLOB_CONFIG_ID is set', () => {
    const url = buildOAuthUrl('Instagram', 'user@example.com');
    expect(url).toContain('facebook.com/dialog/oauth');
    expect(url).toContain('config_id=test-config-123');
    expect(url).not.toContain('scope=');
  });

  it('uses FLoB config_id URL for Facebook when META_FLOB_CONFIG_ID is set', () => {
    const url = buildOAuthUrl('Facebook', 'user@example.com');
    expect(url).toContain('facebook.com/dialog/oauth');
    expect(url).toContain('config_id=test-config-123');
    expect(url).not.toContain('scope=');
  });

  it('uses hardcoded config_id fallback when META_FLOB_CONFIG_ID env var is not set', () => {
    vi.stubEnv('META_FLOB_CONFIG_ID', '');
    vi.stubEnv('META_APP_ID', '');
    const url = buildOAuthUrl('Instagram', 'user@example.com');
    expect(url).toContain('config_id=1823163038321738');
    expect(url).not.toContain('scope=');
  });

  it('includes client_id (app ID) in FLoB URL', () => {
    vi.stubEnv('META_APP_ID', '3341090329381439');
    const url = buildOAuthUrl('Instagram', 'user@example.com');
    expect(url).toContain('client_id=3341090329381439');
    expect(url).toContain('config_id=test-config-123');
  });

  it('state redirectTo includes full pathname, not just origin', () => {
    // Simulate being served from a subpath e.g. /content-hub/
    Object.defineProperty(window, 'location', {
      value: {
        origin: 'https://ddpopmatters.github.io',
        pathname: '/content-hub/',
        href: 'https://ddpopmatters.github.io/content-hub/#admin',
      },
      writable: true,
    });
    const url = buildOAuthUrl('Instagram', 'user@example.com');
    const stateParam = new URL(url).searchParams.get('state')!;
    const state = JSON.parse(atob(stateParam));
    expect(state.createdByEmail).toBe('user@example.com');
    expect(state.redirectTo).toBe('https://ddpopmatters.github.io/content-hub/oauth-success.html');
  });
});
