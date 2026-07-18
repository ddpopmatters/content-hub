import type { PublishPayload } from './types.ts';

const CONTENT_MEDIA_PATH_PREFIX = '/storage/v1/object/public/content-media/';
const DEFAULT_MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 5_000;
const PREFIX_BYTES = 16;

const ALLOWED_IMAGE_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp']);

export interface PublicationMediaIssue {
  code:
    | 'invalid_storage_url'
    | 'media_unavailable'
    | 'media_too_large'
    | 'unsupported_media_type'
    | 'invalid_media_content';
  message: string;
}

interface PublicationMediaOptions {
  supabaseUrl: string;
  fetcher?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  maxBytes?: number;
  timeoutMs?: number;
}

const issue = (code: PublicationMediaIssue['code'], message: string): PublicationMediaIssue => ({
  code,
  message,
});

const publicationMediaUrls = (payload: PublishPayload): string[] => {
  const values =
    payload.assetType === 'Design'
      ? payload.previewUrl
        ? [payload.previewUrl]
        : []
      : payload.assetType === 'Carousel'
        ? payload.mediaUrls
        : [];

  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
};

const canonicalContentMediaUrl = (value: string, supabaseUrl: string): URL | null => {
  try {
    const storageOrigin = new URL(supabaseUrl);
    const mediaUrl = new URL(value);
    const secureStorageOrigin =
      storageOrigin.protocol === 'https:' ||
      (storageOrigin.protocol === 'http:' &&
        ['127.0.0.1', '::1', 'localhost'].includes(storageOrigin.hostname));
    if (
      !secureStorageOrigin ||
      storageOrigin.username ||
      storageOrigin.password ||
      mediaUrl.origin !== storageOrigin.origin ||
      mediaUrl.username ||
      mediaUrl.password ||
      mediaUrl.search ||
      mediaUrl.hash ||
      !mediaUrl.pathname.startsWith(CONTENT_MEDIA_PATH_PREFIX)
    ) {
      return null;
    }

    const encodedObjectPath = mediaUrl.pathname.slice(CONTENT_MEDIA_PATH_PREFIX.length);
    const objectPath = decodeURIComponent(encodedObjectPath);
    if (
      !objectPath ||
      objectPath.includes('\\') ||
      objectPath.includes('\u0000') ||
      objectPath.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    ) {
      return null;
    }

    return mediaUrl;
  } catch {
    return null;
  }
};

const mediaSize = (response: Response): number | null => {
  const contentRange = response.headers.get('content-range');
  const rangeMatch = contentRange?.match(/\/(\d+)$/);
  if (rangeMatch) return Number(rangeMatch[1]);

  const contentLength = response.headers.get('content-length');
  if (!contentLength || !/^\d+$/.test(contentLength)) return null;
  return Number(contentLength);
};

const readPrefix = async (response: Response): Promise<Uint8Array | null> => {
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: number[] = [];
  try {
    while (chunks.length < PREFIX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const byte of value) {
        chunks.push(byte);
        if (chunks.length === PREFIX_BYTES) break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return chunks.length > 0 ? new Uint8Array(chunks) : null;
};

const startsWith = (bytes: Uint8Array, prefix: number[]): boolean =>
  bytes.length >= prefix.length && prefix.every((byte, index) => bytes[index] === byte);

const hasValidMagicBytes = (contentType: string, bytes: Uint8Array): boolean => {
  switch (contentType) {
    case 'image/jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/webp':
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        bytes.length >= 12 &&
        startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
      );
    case 'image/gif':
      return (
        startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
      );
    default:
      return false;
  }
};

const fetchMediaPrefix = async (
  url: URL,
  { fetcher = fetch, maxBytes = DEFAULT_MAX_MEDIA_BYTES, timeoutMs = DEFAULT_TIMEOUT_MS },
): Promise<PublicationMediaIssue | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetcher(url, {
      method: 'GET',
      headers: { Range: `bytes=0-${PREFIX_BYTES - 1}` },
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch {
    return issue(
      'media_unavailable',
      'The approved media could not be fetched safely. Upload it again before publishing.',
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status !== 200 && response.status !== 206) {
    await response.body?.cancel().catch(() => undefined);
    return issue(
      'media_unavailable',
      'The approved media is not publicly available. Upload it again before publishing.',
    );
  }

  const size = mediaSize(response);
  if (!Number.isSafeInteger(size) || !size || size > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    return issue(
      size && size > maxBytes ? 'media_too_large' : 'media_unavailable',
      size && size > maxBytes
        ? 'The approved media is too large for direct publishing.'
        : 'The approved media size could not be verified safely.',
    );
  }

  const contentType =
    response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    await response.body?.cancel().catch(() => undefined);
    return issue(
      'unsupported_media_type',
      'Direct publishing supports JPEG, PNG, WebP or GIF images only.',
    );
  }

  const prefix = await readPrefix(response);
  if (!prefix || !hasValidMagicBytes(contentType, prefix)) {
    return issue(
      'invalid_media_content',
      'The approved media does not match its declared image type. Upload it again.',
    );
  }

  return null;
};

export function getPublicationMediaLocationIssue(
  payload: PublishPayload,
  supabaseUrl: string,
): PublicationMediaIssue | null {
  for (const value of publicationMediaUrls(payload)) {
    if (!canonicalContentMediaUrl(value, supabaseUrl)) {
      return issue(
        'invalid_storage_url',
        'Upload publication media to Content Hub storage before publishing.',
      );
    }
  }
  return null;
}

/**
 * Validate and preflight every approved media object before a provider or
 * credential is accessed. Exact Storage-origin matching prevents SSRF and
 * disallowing query strings excludes expiring signed URLs from durable jobs.
 */
export async function getPublicationMediaIssue(
  payload: PublishPayload,
  options: PublicationMediaOptions,
): Promise<PublicationMediaIssue | null> {
  const urls = publicationMediaUrls(payload);
  const locationIssue = getPublicationMediaLocationIssue(payload, options.supabaseUrl);
  if (locationIssue) return locationIssue;

  for (const value of urls) {
    const url = canonicalContentMediaUrl(value, options.supabaseUrl)!;

    const preflightIssue = await fetchMediaPrefix(url, options);
    if (preflightIssue) return preflightIssue;
  }

  return null;
}
