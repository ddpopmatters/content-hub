import { afterEach, describe, expect, it } from 'vitest';
import { entryReviewLink } from './email';

const originalLocation = window.location;

const setWindowLocation = (href: string) => {
  const url = new URL(href);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...originalLocation,
      href: url.toString(),
      origin: url.origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      hostname: url.hostname,
    },
  });
};

describe('entryReviewLink', () => {
  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    window.history.replaceState({}, '', '/');
  });

  it('preserves the GitHub Pages base path for review links', () => {
    setWindowLocation('https://ddpopmatters.github.io/content-hub/#admin');

    const link = entryReviewLink({ id: 'entry-123' });

    expect(link).toBe('https://ddpopmatters.github.io/content-hub/review.html?id=entry-123');
  });
});
