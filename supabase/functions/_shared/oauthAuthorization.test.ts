import {
  buildOAuthAuthorizationUrl,
  buildOAuthSuccessUrl,
  OAuthConfigurationError,
  type OAuthPublicConfiguration,
} from './oauthAuthorization.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const config: OAuthPublicConfiguration = {
  metaAppId: 'meta-app-id',
  metaConfigId: 'meta-config-id',
  linkedInClientId: 'linkedin-client-id',
  linkedInOrgClientId: 'linkedin-org-client-id',
};

Deno.test('Meta authorisation URL uses only server-provided state and callback values', () => {
  const result = new URL(
    buildOAuthAuthorizationUrl({
      platform: 'Instagram',
      callbackUrl: 'https://project.supabase.co/functions/v1/oauth-callback',
      state: 'opaque-state',
      config,
    }),
  );

  assertEquals(result.origin, 'https://www.facebook.com');
  assertEquals(result.searchParams.get('client_id'), 'meta-app-id');
  assertEquals(result.searchParams.get('config_id'), 'meta-config-id');
  assertEquals(result.searchParams.get('state'), 'opaque-state');
  assertEquals(
    result.searchParams.get('redirect_uri'),
    'https://project.supabase.co/functions/v1/oauth-callback',
  );
});

Deno.test('LinkedIn organisation authorisation uses the organisation client and scope', () => {
  const result = new URL(
    buildOAuthAuthorizationUrl({
      platform: 'LinkedIn Org',
      callbackUrl: 'https://project.supabase.co/functions/v1/oauth-callback',
      state: 'opaque-state',
      config,
    }),
  );

  assertEquals(result.origin, 'https://www.linkedin.com');
  assertEquals(result.searchParams.get('client_id'), 'linkedin-org-client-id');
  assertEquals(result.searchParams.get('scope'), 'w_organization_social r_organization_social');
});

Deno.test('OAuth URLs fail closed without HTTPS or required public configuration', () => {
  let insecureRejected = false;
  let missingConfigRejected = false;
  let missingMetaConfigRejected = false;
  try {
    buildOAuthAuthorizationUrl({
      platform: 'LinkedIn',
      callbackUrl: 'http://project.example/functions/v1/oauth-callback',
      state: 'opaque-state',
      config,
    });
  } catch (error) {
    insecureRejected = error instanceof OAuthConfigurationError;
  }
  try {
    buildOAuthAuthorizationUrl({
      platform: 'LinkedIn',
      callbackUrl: 'https://project.example/functions/v1/oauth-callback',
      state: 'opaque-state',
      config: { ...config, linkedInClientId: '' },
    });
  } catch (error) {
    missingConfigRejected = error instanceof OAuthConfigurationError;
  }
  try {
    buildOAuthAuthorizationUrl({
      platform: 'Instagram',
      callbackUrl: 'https://project.example/functions/v1/oauth-callback',
      state: 'opaque-state',
      config: { ...config, metaConfigId: '' },
    });
  } catch (error) {
    missingMetaConfigRejected = error instanceof OAuthConfigurationError;
  }

  assertEquals(insecureRejected, true);
  assertEquals(missingConfigRejected, true);
  assertEquals(missingMetaConfigRejected, true);
});

Deno.test('OAuth success redirect is fixed beneath the configured application base', () => {
  const result = new URL(
    buildOAuthSuccessUrl('https://ddpopmatters.github.io/content-hub', 'Facebook'),
  );

  assertEquals(result.origin, 'https://ddpopmatters.github.io');
  assertEquals(result.pathname, '/content-hub/oauth-success.html');
  assertEquals(result.searchParams.get('oauth_success'), 'Facebook');
  assertEquals(result.searchParams.has('account_name'), false);
});
