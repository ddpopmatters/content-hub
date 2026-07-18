import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { APP_CONFIG } from '../../lib/config';
import { getSupabase, initSupabase } from '../../lib/supabase';
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

const DIRECT_PUBLISH_PLATFORMS = ALL_PLATFORMS.filter(
  (platform) => platform !== 'YouTube',
) as Array<Exclude<Platform, 'YouTube'>>;

// ─── OAuth navigation guard ──────────────────────────────────────────────────

type OAuthPlatform = Exclude<Platform, 'BlueSky' | 'YouTube'> | 'LinkedIn Org';

const OAUTH_PROVIDER_ENDPOINTS: Record<OAuthPlatform, { origin: string; pathname: string }> = {
  Instagram: { origin: 'https://www.facebook.com', pathname: '/dialog/oauth' },
  Facebook: { origin: 'https://www.facebook.com', pathname: '/dialog/oauth' },
  LinkedIn: { origin: 'https://www.linkedin.com', pathname: '/oauth/v2/authorization' },
  'LinkedIn Org': {
    origin: 'https://www.linkedin.com',
    pathname: '/oauth/v2/authorization',
  },
};

const isOAuthPlatform = (value: unknown): value is OAuthPlatform =>
  typeof value === 'string' &&
  Object.prototype.hasOwnProperty.call(OAUTH_PROVIDER_ENDPOINTS, value);

export function getSafeOAuthAuthorizationUrl(
  value: unknown,
  platform: OAuthPlatform,
): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const expected = OAUTH_PROVIDER_ENDPOINTS[platform];
    return url.origin === expected.origin &&
      url.pathname === expected.pathname &&
      !url.username &&
      !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function isTrustedOAuthSuccessMessage(
  event: Pick<MessageEvent, 'data' | 'origin' | 'source'>,
  expectedSource: Window | null,
  expectedOrigin: string,
): boolean {
  if (!expectedSource || event.origin !== expectedOrigin || event.source !== expectedSource) {
    return false;
  }
  const data: unknown = event.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const message = data as Record<string, unknown>;
  return message.type === 'oauth_success' && isOAuthPlatform(message.platform);
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

export const PlatformConnectionsView: React.FC = () => {
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bskyForms, setBskyForms] = useState<Record<string, BlueSkyForm>>({
    BlueSky: { handle: '', appPassword: '' },
  });
  const [bskySaving, setBskySaving] = useState(false);
  const [bskyError, setBskyError] = useState('');
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const oauthPopupRef = useRef<Window | null>(null);

  const callPlatformConnectionsApi = useCallback(async (payload: Record<string, unknown>) => {
    await initSupabase();
    const supabase = getSupabase();
    const {
      data: { session },
    } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    const accessToken = session?.access_token;
    if (!accessToken) throw new Error('You must be signed in to manage platform connections.');

    const response = await fetch(`${APP_CONFIG.SUPABASE_URL}/functions/v1/platform-connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: APP_CONFIG.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const parsed = text.trim().length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {};

    if (!response.ok) {
      throw new Error(
        typeof parsed.error === 'string' ? parsed.error : 'Platform connections request failed.',
      );
    }

    return parsed;
  }, []);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await callPlatformConnectionsApi({ action: 'list' });
      setConnections((payload.connections as PlatformConnection[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections.');
    } finally {
      setLoading(false);
    }
  }, [callPlatformConnectionsApi]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Listen for OAuth popup success via postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!isTrustedOAuthSuccessMessage(e, oauthPopupRef.current, window.location.origin)) return;

      oauthPopupRef.current = null;
      fetchConnections();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [fetchConnections]);

  const connFor = (platform: string) => connections.find((c) => c.platform === platform) ?? null;
  const youtubeConn = connFor('YouTube');

  // ── BlueSky connect ──────────────────────────────────────────────────────
  const handleBskyConnect = async () => {
    const { handle, appPassword } = bskyForms.BlueSky;
    if (!handle.trim() || !appPassword.trim()) {
      setBskyError('Handle and app password are required.');
      return;
    }
    setBskySaving(true);
    setBskyError('');
    try {
      await callPlatformConnectionsApi({
        action: 'connect-bluesky',
        handle: handle.trim(),
        appPassword: appPassword.trim(),
      });
      setBskyForms((prev) => ({ ...prev, BlueSky: { handle: '', appPassword: '' } }));
      await fetchConnections();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to connect';
      setBskyError(msg);
    }
    setBskySaving(false);
  };

  // ── OAuth connect (popup) ────────────────────────────────────────────────
  const handleOAuthConnect = async (platform: OAuthPlatform) => {
    setError('');
    const popup = window.open(
      'about:blank',
      `connect-${platform}`,
      'width=600,height=700,left=200,top=100',
    );
    if (!popup) {
      alert('Popup blocked — please allow popups for this site and try again.');
      return;
    }

    oauthPopupRef.current = popup;
    try {
      const payload = await callPlatformConnectionsApi({ action: 'begin-oauth', platform });
      const authorizationUrl = getSafeOAuthAuthorizationUrl(payload.authorizationUrl, platform);
      if (!authorizationUrl) throw new Error('The OAuth provider URL was invalid.');
      popup.location.href = authorizationUrl;
    } catch (err) {
      popup.close();
      oauthPopupRef.current = null;
      setError(err instanceof Error ? err.message : 'Unable to start the OAuth connection.');
    }
  };

  // ── Disconnect ───────────────────────────────────────────────────────────
  const handleDisconnect = async (conn: PlatformConnection) => {
    setDisconnecting(conn.id);
    try {
      await callPlatformConnectionsApi({ action: 'disconnect', id: conn.id });
      await fetchConnections();
    } finally {
      setDisconnecting(null);
    }
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
            {DIRECT_PUBLISH_PLATFORMS.map((platform) => {
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
                          onClick={() => handleOAuthConnect(platform as OAuthPlatform)}
                        >
                          Connect
                        </Button>
                      )}
                      {/* Re-connect for expired OAuth tokens */}
                      {conn && expired && platform !== 'BlueSky' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOAuthConnect(platform as OAuthPlatform)}
                        >
                          Reconnect
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* LinkedIn org page sub-row */}
                  {platform === 'LinkedIn' &&
                    (() => {
                      const orgConn = connFor('LinkedIn Org');
                      const orgExpired = orgConn ? isExpired(orgConn) : false;
                      return (
                        <div className="mt-3 flex items-center justify-between border-t border-graystone-100 pt-3">
                          <div className="text-xs text-graystone-500">
                            <span className="font-medium text-graystone-700">
                              Organisation page
                            </span>
                            {orgConn ? (
                              <span className="ml-2">
                                {orgConn.account_name}
                                {orgExpired && (
                                  <span className="ml-1 text-amber-600">· expired</span>
                                )}
                              </span>
                            ) : (
                              <span className="ml-2 text-graystone-400">Not connected</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {orgConn ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDisconnect(orgConn)}
                                  disabled={disconnecting === orgConn.id}
                                  className="text-graystone-500 hover:text-red-600"
                                >
                                  {disconnecting === orgConn.id ? 'Disconnecting…' : 'Disconnect'}
                                </Button>
                                {orgExpired && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOAuthConnect('LinkedIn Org')}
                                  >
                                    Reconnect
                                  </Button>
                                )}
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOAuthConnect('LinkedIn Org')}
                              >
                                Connect org page
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

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

            <div className="rounded-xl border border-graystone-200 bg-graystone-50 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <PlatformIcon platform="YouTube" size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-graystone-900">YouTube</span>
                      <span className="rounded-full bg-graystone-200 px-2 py-0.5 text-xs text-graystone-700">
                        Manual upload only
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-graystone-500">
                      Content Hub does not publish to YouTube directly. Use YouTube Studio for
                      uploads and scheduling.
                    </div>
                    {youtubeConn && (
                      <div className="mt-1 text-xs text-graystone-500">
                        Legacy connected channel: {youtubeConn.account_name}
                      </div>
                    )}
                  </div>
                </div>

                {youtubeConn && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDisconnect(youtubeConn)}
                    disabled={disconnecting === youtubeConn.id}
                    className="text-graystone-500 hover:text-red-600"
                  >
                    {disconnecting === youtubeConn.id ? 'Disconnecting…' : 'Disconnect legacy link'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PlatformConnectionsView;
