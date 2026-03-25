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

  it('falls back to legacy URL when META_FLOB_CONFIG_ID is empty', () => {
    vi.stubEnv('META_FLOB_CONFIG_ID', '');
    vi.stubEnv('META_APP_ID', 'app-123');
    const url = buildOAuthUrl('Instagram', 'user@example.com');
    expect(url).toContain('v19.0/dialog/oauth');
    expect(url).toContain('instagram_content_publish');
  });
});
