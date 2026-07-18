import { getPublicationMediaIssue } from './publicationMedia.ts';
import type { PublishPayload } from './types.ts';

const SUPABASE_URL = 'https://project.supabase.co';
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const assertEquals = (actual: unknown, expected: unknown): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
};

const designPayload = (previewUrl: string): PublishPayload => ({
  entryId: 'entry-1',
  platforms: ['Facebook'],
  caption: 'Approved caption',
  platformCaptions: {},
  assetType: 'Design',
  mediaUrls: [],
  previewUrl,
  firstComment: '',
});

const responseBody = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const mediaResponse = ({
  bytes = PNG_BYTES,
  contentType = 'image/png',
  contentRange = 'bytes 0-15/1024',
  status = 206,
}: {
  bytes?: Uint8Array;
  contentType?: string;
  contentRange?: string | null;
  status?: number;
} = {}): Response =>
  new Response(responseBody(bytes), {
    status,
    headers: {
      'content-type': contentType,
      ...(contentRange ? { 'content-range': contentRange } : {}),
    },
  });

Deno.test('publication media accepts canonical public Storage images', async () => {
  let requestInit: RequestInit | undefined;
  const result = await getPublicationMediaIssue(
    designPayload(
      'https://project.supabase.co/storage/v1/object/public/content-media/entries/image.png',
    ),
    {
      supabaseUrl: SUPABASE_URL,
      fetcher: (_input, init) => {
        requestInit = init;
        return Promise.resolve(mediaResponse());
      },
    },
  );

  assertEquals(result, null);
  assertEquals(requestInit?.method, 'GET');
  assertEquals(requestInit?.redirect, 'manual');
  assertEquals((requestInit?.headers as Record<string, string>).Range, 'bytes=0-15');
});

Deno.test(
  'publication media rejects external, signed and malformed Storage URLs before fetch',
  async () => {
    let fetchCount = 0;
    const fetcher = (): Promise<Response> => {
      fetchCount += 1;
      return Promise.resolve(mediaResponse());
    };

    for (const url of [
      'https://cdn.example.org/image.png',
      'https://project.supabase.co/storage/v1/object/public/content-media/entries/image.png?token=secret',
      'https://project.supabase.co/storage/v1/object/public/content-media/%2e%2e/private.png',
    ]) {
      assertEquals(
        (
          await getPublicationMediaIssue(designPayload(url), {
            supabaseUrl: SUPABASE_URL,
            fetcher,
          })
        )?.code,
        'invalid_storage_url',
      );
    }

    assertEquals(fetchCount, 0);
  },
);

Deno.test(
  'publication media rejects redirects, unverifiable sizes and oversized objects',
  async () => {
    const url =
      'https://project.supabase.co/storage/v1/object/public/content-media/entries/image.png';

    assertEquals(
      (
        await getPublicationMediaIssue(designPayload(url), {
          supabaseUrl: SUPABASE_URL,
          fetcher: () => Promise.resolve(mediaResponse({ status: 302 })),
        })
      )?.code,
      'media_unavailable',
    );

    assertEquals(
      (
        await getPublicationMediaIssue(designPayload(url), {
          supabaseUrl: SUPABASE_URL,
          fetcher: () => Promise.resolve(mediaResponse({ contentRange: null })),
        })
      )?.code,
      'media_unavailable',
    );

    assertEquals(
      (
        await getPublicationMediaIssue(designPayload(url), {
          supabaseUrl: SUPABASE_URL,
          maxBytes: 100,
          fetcher: () => Promise.resolve(mediaResponse()),
        })
      )?.code,
      'media_too_large',
    );
  },
);

Deno.test('publication media verifies declared image type and magic bytes', async () => {
  const url =
    'https://project.supabase.co/storage/v1/object/public/content-media/entries/image.png';

  assertEquals(
    (
      await getPublicationMediaIssue(designPayload(url), {
        supabaseUrl: SUPABASE_URL,
        fetcher: () => Promise.resolve(mediaResponse({ contentType: 'text/html' })),
      })
    )?.code,
    'unsupported_media_type',
  );

  assertEquals(
    (
      await getPublicationMediaIssue(designPayload(url), {
        supabaseUrl: SUPABASE_URL,
        fetcher: () =>
          Promise.resolve(mediaResponse({ bytes: new TextEncoder().encode('<html>') })),
      })
    )?.code,
    'invalid_media_content',
  );
});

Deno.test('publication media times out fail closed', async () => {
  const url =
    'https://project.supabase.co/storage/v1/object/public/content-media/entries/image.png';
  const result = await getPublicationMediaIssue(designPayload(url), {
    supabaseUrl: SUPABASE_URL,
    timeoutMs: 5,
    fetcher: (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
  });

  assertEquals(result?.code, 'media_unavailable');
});

Deno.test('publication media deduplicates carousel objects', async () => {
  let fetchCount = 0;
  const url =
    'https://project.supabase.co/storage/v1/object/public/content-media/entries/image.png';
  const payload: PublishPayload = {
    ...designPayload(''),
    assetType: 'Carousel',
    previewUrl: null,
    mediaUrls: [url, url],
  };

  assertEquals(
    await getPublicationMediaIssue(payload, {
      supabaseUrl: SUPABASE_URL,
      fetcher: () => {
        fetchCount += 1;
        return Promise.resolve(mediaResponse());
      },
    }),
    null,
  );
  assertEquals(fetchCount, 1);
});
