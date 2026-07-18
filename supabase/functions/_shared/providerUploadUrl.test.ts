import { getTrustedLinkedInUploadUrl } from './providerUploadUrl.ts';

const assertEquals = (actual: unknown, expected: unknown): void => {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
};

Deno.test('LinkedIn upload URLs accept only documented exact hosts and paths', () => {
  const urls = [
    'https://api.linkedin.com/mediaUpload/asset/0?signature=one',
    'https://api.linkedin-ei.com/mediaUpload/sp/sync/asset/0?signature=two',
    'https://www.linkedin.com/dms-uploads/asset/feedshare-uploadedImage/0?signature=three',
  ];

  for (const url of urls) assertEquals(getTrustedLinkedInUploadUrl(url), url);
});

Deno.test('LinkedIn upload URLs reject spoofed or unsafe locations', () => {
  const urls = [
    'http://api.linkedin.com/mediaUpload/asset',
    'https://api.linkedin.com.evil.example/mediaUpload/asset',
    'https://user:password@api.linkedin.com/mediaUpload/asset',
    'https://api.linkedin.com:8443/mediaUpload/asset',
    'https://api.linkedin.com/not-an-upload/asset',
    'https://www.linkedin.com/mediaUpload/asset',
    'https://www.linkedin.com/dms-uploads/asset#fragment',
  ];

  for (const url of urls) assertEquals(getTrustedLinkedInUploadUrl(url), null);
});
