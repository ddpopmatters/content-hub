export const CONTENT_REVIEW_URL_PLACEHOLDER = '{{CONTENT_REVIEW_URL}}';

const normaliseAppUrl = (rawUrl: string): string => {
  const url = new URL(rawUrl);
  const localDevelopment =
    url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if ((url.protocol !== 'https:' && !localDevelopment) || url.username || url.password) {
    throw new Error('invalid app URL');
  }
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
};

export interface RecipientNotificationLinks {
  text: string;
  html?: string;
  approveUrl: string;
}

export function injectRecipientNotificationLinks(
  text: string,
  html: string | undefined,
  appUrl: string,
  token: string,
): RecipientNotificationLinks {
  if (!text.includes(CONTENT_REVIEW_URL_PLACEHOLDER)) {
    throw new Error('review URL placeholder missing');
  }
  if (html && !html.includes(CONTENT_REVIEW_URL_PLACEHOLDER)) {
    throw new Error('review URL placeholder missing');
  }

  const baseUrl = normaliseAppUrl(appUrl);
  const encodedToken = encodeURIComponent(token);
  const reviewUrl = `${baseUrl}/review.html?token=${encodedToken}`;
  const approveUrl = `${baseUrl}/approve.html?token=${encodedToken}`;
  return {
    text: text.replaceAll(CONTENT_REVIEW_URL_PLACEHOLDER, reviewUrl),
    html: html?.replaceAll(CONTENT_REVIEW_URL_PLACEHOLDER, reviewUrl),
    approveUrl,
  };
}
