const LINKEDIN_UPLOAD_PATHS: Readonly<Record<string, string>> = {
  'api.linkedin.com': '/mediaUpload/',
  'api.linkedin-ei.com': '/mediaUpload/',
  'www.linkedin.com': '/dms-uploads/',
};

/** Accept only the exact upload locations returned by LinkedIn's Images API. */
export const getTrustedLinkedInUploadUrl = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    const pathPrefix = LINKEDIN_UPLOAD_PATHS[url.hostname];
    if (
      url.protocol !== 'https:' ||
      !pathPrefix ||
      !url.pathname.startsWith(pathPrefix) ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
};
