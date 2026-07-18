import { describe, it, expect } from 'vitest';
import {
  getSafeOAuthAuthorizationUrl,
  isTrustedOAuthSuccessMessage,
} from '../PlatformConnectionsView';

describe('OAuth navigation guard', () => {
  it('accepts only the expected HTTPS provider origin for each platform', () => {
    expect(
      getSafeOAuthAuthorizationUrl(
        'https://www.facebook.com/dialog/oauth?state=opaque',
        'Instagram',
      ),
    ).toBe('https://www.facebook.com/dialog/oauth?state=opaque');
    expect(
      getSafeOAuthAuthorizationUrl(
        'https://www.linkedin.com/oauth/v2/authorization?state=opaque',
        'LinkedIn',
      ),
    ).toBe('https://www.linkedin.com/oauth/v2/authorization?state=opaque');
  });

  it('rejects HTTP, lookalike hosts and the wrong provider', () => {
    expect(
      getSafeOAuthAuthorizationUrl('http://www.facebook.com/dialog/oauth', 'Facebook'),
    ).toBeNull();
    expect(
      getSafeOAuthAuthorizationUrl('https://www.facebook.com.evil.test/oauth', 'Facebook'),
    ).toBeNull();
    expect(
      getSafeOAuthAuthorizationUrl('https://www.facebook.com/dialog/oauth', 'LinkedIn'),
    ).toBeNull();
    expect(
      getSafeOAuthAuthorizationUrl(
        'https://www.facebook.com/l.php?u=https://evil.test',
        'Facebook',
      ),
    ).toBeNull();
  });
});

describe('OAuth success message guard', () => {
  const popup = {} as Window;
  const validEvent = {
    origin: 'https://app.example',
    source: popup,
    data: { type: 'oauth_success', platform: 'Instagram' },
  };

  it('accepts only the expected same-origin popup and message shape', () => {
    expect(isTrustedOAuthSuccessMessage(validEvent, popup, 'https://app.example')).toBe(true);
    expect(
      isTrustedOAuthSuccessMessage(
        { ...validEvent, origin: 'https://evil.example' },
        popup,
        'https://app.example',
      ),
    ).toBe(false);
    expect(
      isTrustedOAuthSuccessMessage(
        { ...validEvent, source: {} as Window },
        popup,
        'https://app.example',
      ),
    ).toBe(false);
    expect(
      isTrustedOAuthSuccessMessage(
        { ...validEvent, data: { type: 'oauth_success', platform: 'YouTube' } },
        popup,
        'https://app.example',
      ),
    ).toBe(false);
  });
});
