import { isOAuthPlatform, type OAuthPlatform } from './oauthState.ts';

export interface OAuthPublicConfiguration {
  metaAppId: string;
  metaConfigId: string;
  linkedInClientId: string;
  linkedInOrgClientId: string;
}

export class OAuthConfigurationError extends Error {
  constructor() {
    super('OAuth is not configured for this platform.');
    this.name = 'OAuthConfigurationError';
  }
}

const requireHttpsUrl = (value: string): URL => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new OAuthConfigurationError();
  }
  if (url.protocol !== 'https:') throw new OAuthConfigurationError();
  return url;
};

export function buildOAuthAuthorizationUrl({
  platform,
  callbackUrl,
  state,
  config,
}: {
  platform: OAuthPlatform;
  callbackUrl: string;
  state: string;
  config: OAuthPublicConfiguration;
}): string {
  const redirectUri = requireHttpsUrl(callbackUrl).toString();

  if (platform === 'Instagram' || platform === 'Facebook') {
    if (!config.metaAppId || !config.metaConfigId) throw new OAuthConfigurationError();
    const url = new URL('https://www.facebook.com/dialog/oauth');
    url.search = new URLSearchParams({
      client_id: config.metaAppId,
      config_id: config.metaConfigId,
      response_type: 'code',
      override_default_response_type: 'true',
      redirect_uri: redirectUri,
      state,
    }).toString();
    return url.toString();
  }

  const clientId = platform === 'LinkedIn' ? config.linkedInClientId : config.linkedInOrgClientId;
  if (!clientId) throw new OAuthConfigurationError();

  const scope =
    platform === 'LinkedIn'
      ? 'openid profile email w_member_social'
      : 'w_organization_social r_organization_social';
  const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
  }).toString();
  return url.toString();
}

export function buildOAuthSuccessUrl(appBaseUrl: string, platform: unknown): string {
  if (!isOAuthPlatform(platform)) throw new OAuthConfigurationError();

  const base = requireHttpsUrl(appBaseUrl);
  base.hash = '';
  base.search = '';
  if (!base.pathname.endsWith('/')) base.pathname = `${base.pathname}/`;

  const successUrl = new URL('oauth-success.html', base);
  successUrl.searchParams.set('oauth_success', platform);
  return successUrl.toString();
}
