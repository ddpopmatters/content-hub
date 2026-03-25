import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  Button,
  Input,
  Label,
} from '../../components/ui';
import { PlatformIcon, CheckCircleIcon, LoaderIcon } from '../../components/common';
import { cx } from '../../lib/utils';
import { getSupabase } from '../../lib/supabase';
import { ALL_PLATFORMS } from '../../constants';
import type { Platform } from '../../constants';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlatformConnection {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  expires_at: string | null;
  last_used_at: string | null;
  last_error: string | null;
  is_active: boolean;
  created_by: string;
}

interface BlueSkyForm {
  handle: string;
  appPassword: string;
}

// ─── OAuth URL builders ───────────────────────────────────────────────────────

const FUNCTION_BASE = `${import.meta.env.SUPABASE_URL ?? ''}/functions/v1`;

export function buildOAuthUrl(platform: Platform, currentUser: string): string {
  const appBase = window.location.href.split('#')[0].replace(/[^/]*$/, '');
  const state = btoa(
    JSON.stringify({
      platform,
      createdBy: currentUser,
      redirectTo: `${appBase}oauth-success.html`,
    }),
  );
  const redirectUri = `${FUNCTION_BASE}/oauth-callback`;

  switch (platform) {
    case 'Instagram':
    case 'Facebook': {
      const configId = import.meta.env.META_FLOB_CONFIG_ID || '1823163038321738';
      const appId = import.meta.env.META_APP_ID ?? '';
      if (configId) {
        return (
          `https://www.facebook.com/dialog/oauth?client_id=${appId}&config_id=${configId}` +
          `&response_type=code&override_default_response_type=true` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
        );
      }
      const scopes =
        platform === 'Instagram'
          ? 'instagram_basic,instagram_content_publish'
          : 'pages_manage_posts,pages_read_engagement';
      return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}&response_type=code`;
    }
    case 'LinkedIn': {
      const clientId = import.meta.env.LINKEDIN_CLIENT_ID ?? '';
      return `https://www.linkedin.com/oauth/v2/authorisation?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('openid profile w_organization_social')}&state=${state}`;
    }
    case 'YouTube': {
      const clientId = import.meta.env.GOOGLE_CLIENT_ID ?? '';
      return `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly')}&access_type=offline&prompt=consent&state=${state}`;
    }
    default:
      return '';
  }
}

// ─── Connection status helpers ────────────────────────────────────────────────

function isExpired(conn: PlatformConnection): boolean {
  if (!conn.expires_at) return false;
  return new Date(conn.expires_at) < new Date();
}

function expiresLabel(conn: PlatformConnection): string {
  if (!conn.expires_at) return 'No expiry';
  const days = Math.round((new Date(conn.expires_at).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  return `Expires in ${days}d`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PlatformConnectionsViewProps {
  currentUser: string;
}

export const PlatformConnectionsView: React.FC<PlatformConnectionsViewProps> = ({
  currentUser,
}) => {
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bskyForms, setBskyForms] = useState<Record<string, BlueSkyForm>>({
    BlueSky: { handle: '', appPassword: '' },
  });
  const [bskySaving, setBskySaving] = useState(false);
  const [bskyError, setBskyError] = useState('');
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    setError('');
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    const { data, error: err } = await sb
      .from('platform_connections')
      .select('*')
      .eq('is_active', true)
      .order('platform');
    if (err) setError(err.message);
    else setConnections((data as PlatformConnection[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Listen for OAuth popup success via postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'oauth_success') {
        fetchConnections();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [fetchConnections]);

  // Also check URL params (in case redirect came back to this page)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth_success')) {
      fetchConnections();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchConnections]);

  const connFor = (platform: string) => connections.find((c) => c.platform === platform) ?? null;

  // ── BlueSky connect ──────────────────────────────────────────────────────
  const handleBskyConnect = async () => {
    const { handle, appPassword } = bskyForms.BlueSky;
    if (!handle.trim() || !appPassword.trim()) {
      setBskyError('Handle and app password are required.');
      return;
    }
    setBskySaving(true);
    setBskyError('');

    // Verify credentials by creating a session
    try {
      const sessionRes = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: handle.trim(), password: appPassword.trim() }),
      });
      if (!sessionRes.ok) {
        const err = (await sessionRes.json()) as { message?: string };
        setBskyError(err.message ?? 'Invalid credentials. Check your handle and app password.');
        setBskySaving(false);
        return;
      }
      const session = (await sessionRes.json()) as { did: string; handle: string };

      // Save to platform_connections
      const sb = getSupabase();
      if (!sb) throw new Error('No Supabase client');
      const { error: upsertErr } = await sb.from('platform_connections').upsert(
        {
          platform: 'BlueSky',
          account_id: session.handle,
          account_name: `@${session.handle}`,
          access_token: null,
          refresh_token: null,
          token_secret: appPassword.trim(),
          expires_at: null,
          created_by: currentUser,
          is_active: true,
          last_error: null,
        },
        { onConflict: 'platform,account_id' },
      );

      if (upsertErr) throw upsertErr;
      setBskyForms((prev) => ({ ...prev, BlueSky: { handle: '', appPassword: '' } }));
      fetchConnections();
    } catch (err) {
      setBskyError(err instanceof Error ? err.message : 'Failed to connect');
    }
    setBskySaving(false);
  };

  // ── OAuth connect (popup) ────────────────────────────────────────────────
  const handleOAuthConnect = (platform: Platform) => {
    const oauthUrl = buildOAuthUrl(platform, currentUser);
    if (!oauthUrl) return;
    const popup = window.open(
      oauthUrl,
      `connect-${platform}`,
      'width=600,height=700,left=200,top=100',
    );
    if (!popup) {
      alert('Popup blocked — please allow popups for this site and try again.');
    }
  };

  // ── Disconnect ───────────────────────────────────────────────────────────
  const handleDisconnect = async (conn: PlatformConnection) => {
    setDisconnecting(conn.id);
    const sb = getSupabase();
    if (sb) {
      await sb.from('platform_connections').update({ is_active: false }).eq('id', conn.id);
      fetchConnections();
    }
    setDisconnecting(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-lg text-ocean-900">Platform Connections</CardTitle>
        <p className="mt-1 text-sm text-graystone-500">
          Connect your social media accounts to publish directly from Content Hub.
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-graystone-500">
            <LoaderIcon className="h-4 w-4 animate-spin" /> Loading connections…
          </div>
        ) : (
          <div className="space-y-4">
            {ALL_PLATFORMS.map((platform) => {
              const conn = connFor(platform);
              const expired = conn ? isExpired(conn) : false;

              return (
                <div
                  key={platform}
                  className={cx(
                    'rounded-xl border px-4 py-4 transition',
                    conn && !expired
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-graystone-200 bg-white',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {/* Left: platform info */}
                    <div className="flex items-center gap-3">
                      <PlatformIcon platform={platform} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-graystone-900">{platform}</span>
                          {conn && !expired && (
                            <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                          )}
                          {expired && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                              Token expired
                            </span>
                          )}
                        </div>
                        {conn ? (
                          <div className="mt-0.5 text-xs text-graystone-500">
                            {conn.account_name}
                            {conn.expires_at && (
                              <span
                                className={cx(
                                  'ml-2',
                                  expired ? 'text-amber-600' : 'text-graystone-400',
                                )}
                              >
                                · {expiresLabel(conn)}
                              </span>
                            )}
                            {conn.last_error && (
                              <span className="ml-2 text-red-500">· {conn.last_error}</span>
                            )}
                          </div>
                        ) : (
                          <div className="mt-0.5 text-xs text-graystone-400">Not connected</div>
                        )}
                      </div>
                    </div>

                    {/* Right: action */}
                    <div className="flex items-center gap-2">
                      {conn ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDisconnect(conn)}
                          disabled={disconnecting === conn.id}
                          className="text-graystone-500 hover:text-red-600"
                        >
                          {disconnecting === conn.id ? 'Disconnecting…' : 'Disconnect'}
                        </Button>
                      ) : platform === 'BlueSky' ? null : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOAuthConnect(platform as Platform)}
                        >
                          Connect
                        </Button>
                      )}
                      {/* Re-connect for expired OAuth tokens */}
                      {conn && expired && platform !== 'BlueSky' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOAuthConnect(platform as Platform)}
                        >
                          Reconnect
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* BlueSky credential form (shown when not connected) */}
                  {platform === 'BlueSky' && !conn && (
                    <div className="mt-4 space-y-3 border-t border-graystone-100 pt-4">
                      <p className="text-xs text-graystone-500">
                        Use an{' '}
                        <a
                          href="https://bsky.app/settings/app-passwords"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ocean-600 underline"
                        >
                          app password
                        </a>{' '}
                        — not your main BlueSky password.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Handle</Label>
                          <Input
                            placeholder="you.bsky.social"
                            value={bskyForms.BlueSky.handle}
                            onChange={(e) =>
                              setBskyForms((prev) => ({
                                ...prev,
                                BlueSky: { ...prev.BlueSky, handle: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">App password</Label>
                          <Input
                            type="password"
                            placeholder="xxxx-xxxx-xxxx-xxxx"
                            value={bskyForms.BlueSky.appPassword}
                            onChange={(e) =>
                              setBskyForms((prev) => ({
                                ...prev,
                                BlueSky: { ...prev.BlueSky, appPassword: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                      {bskyError && <p className="text-xs text-red-600">{bskyError}</p>}
                      <Button size="sm" onClick={handleBskyConnect} disabled={bskySaving}>
                        {bskySaving ? 'Verifying…' : 'Connect BlueSky'}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PlatformConnectionsView;
