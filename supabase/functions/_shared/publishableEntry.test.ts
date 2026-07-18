import {
  type EntryLookup,
  type PublishableEntryRow,
  requirePublishableEntry,
} from './publishableEntry.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

async function captureResponse(operation: () => Promise<unknown>): Promise<Response> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  throw new Error('Expected operation to throw a Response');
}

const approvedEntry = (overrides: Partial<PublishableEntryRow> = {}): PublishableEntryRow => ({
  id: 'entry-1',
  platforms: ['BlueSky'],
  asset_type: 'Design',
  caption: 'Authoritative caption',
  platform_captions: { BlueSky: 'Authoritative platform caption' },
  first_comment: '',
  asset_previews: ['https://cdn.example.org/image.jpg'],
  preview_url: 'https://cdn.example.org/preview.jpg',
  workflow_status: 'Approved',
  approved_at: '2026-07-17T09:00:00.000Z',
  content_revision: 3,
  approved_revision: 3,
  deleted_at: null,
  ...overrides,
});

const lookupReturning =
  (data: PublishableEntryRow | null): EntryLookup =>
  () =>
    Promise.resolve({ data, error: null });

Deno.test('requirePublishableEntry rejects a missing entry ID before database access', async () => {
  let lookupCalled = false;
  const response = await captureResponse(() =>
    requirePublishableEntry('  ', () => {
      lookupCalled = true;
      return Promise.resolve({ data: null, error: null });
    }),
  );

  assertEquals(response.status, 400);
  assertEquals(lookupCalled, false);
});

Deno.test('requirePublishableEntry hides database lookup failures', async () => {
  const response = await captureResponse(() =>
    requirePublishableEntry('entry-1', () =>
      Promise.resolve({
        data: null,
        error: new Error('sensitive database detail'),
      }),
    ),
  );

  assertEquals(response.status, 500);
  assertEquals(await response.json(), {
    success: false,
    error: 'Unable to load the entry.',
  });
});

Deno.test('requirePublishableEntry rejects missing and soft-deleted entries', async () => {
  const missingResponse = await captureResponse(() =>
    requirePublishableEntry('entry-1', lookupReturning(null)),
  );
  const deletedResponse = await captureResponse(() =>
    requirePublishableEntry(
      'entry-1',
      lookupReturning(approvedEntry({ deleted_at: '2026-07-16T09:00:00Z' })),
    ),
  );

  assertEquals(missingResponse.status, 404);
  assertEquals(deletedResponse.status, 404);
});

Deno.test(
  'requirePublishableEntry rejects an entry whose current state is not approved',
  async () => {
    const response = await captureResponse(() =>
      requirePublishableEntry(
        'entry-1',
        lookupReturning(approvedEntry({ workflow_status: 'Ready for Review' })),
      ),
    );

    assertEquals(response.status, 409);
  },
);

Deno.test('requirePublishableEntry requires an exact approval revision', async () => {
  const missingResponse = await captureResponse(() =>
    requirePublishableEntry('entry-1', lookupReturning(approvedEntry({ approved_at: null }))),
  );
  const invalidResponse = await captureResponse(() =>
    requirePublishableEntry('entry-1', lookupReturning(approvedEntry({ approved_revision: null }))),
  );

  assertEquals(missingResponse.status, 409);
  assertEquals(invalidResponse.status, 409);
  assertEquals(await missingResponse.json(), {
    success: false,
    error: 'This entry must be approved again before publishing.',
  });
});

Deno.test('requirePublishableEntry rejects a content revision newer than approval', async () => {
  const response = await captureResponse(() =>
    requirePublishableEntry(
      'entry-1',
      lookupReturning(
        approvedEntry({
          content_revision: 4,
          approved_revision: 3,
        }),
      ),
    ),
  );

  assertEquals(response.status, 409);
  assertEquals(await response.json(), {
    success: false,
    error: 'This entry changed after approval. Approve the latest version before publishing.',
  });
});

Deno.test('requirePublishableEntry accepts the exact approved content revision', async () => {
  const publishableEntry = await requirePublishableEntry(
    'entry-1',
    lookupReturning(
      approvedEntry({
        approved_at: '2026-07-17T09:00:00.000Z',
        content_revision: 7,
        approved_revision: 7,
      }),
    ),
  );

  assertEquals(publishableEntry.payload.entryId, 'entry-1');
  assertEquals(publishableEntry.entryRevision, 7);
});

Deno.test('requirePublishableEntry rejects an approved entry without valid platforms', async () => {
  const response = await captureResponse(() =>
    requirePublishableEntry('entry-1', lookupReturning(approvedEntry({ platforms: [] }))),
  );

  assertEquals(response.status, 422);
});

Deno.test('requirePublishableEntry rejects unsupported publication capabilities', async () => {
  const videoResponse = await captureResponse(() =>
    requirePublishableEntry('entry-1', lookupReturning(approvedEntry({ asset_type: 'Video' }))),
  );
  const youtubeResponse = await captureResponse(() =>
    requirePublishableEntry('entry-1', lookupReturning(approvedEntry({ platforms: ['YouTube'] }))),
  );
  const linkedInCarouselResponse = await captureResponse(() =>
    requirePublishableEntry(
      'entry-1',
      lookupReturning(
        approvedEntry({
          platforms: ['LinkedIn'],
          asset_type: 'Carousel',
          asset_previews: ['https://cdn.example.org/one.jpg', 'https://cdn.example.org/two.jpg'],
        }),
      ),
    ),
  );

  assertEquals(videoResponse.status, 422);
  assertEquals(youtubeResponse.status, 422);
  assertEquals(linkedInCarouselResponse.status, 422);
});

Deno.test('requirePublishableEntry rejects approved content that would be omitted', async () => {
  const longCaptionResponse = await captureResponse(() =>
    requirePublishableEntry(
      'entry-1',
      lookupReturning(
        approvedEntry({
          caption: 'a'.repeat(301),
          platform_captions: {},
        }),
      ),
    ),
  );
  const firstCommentResponse = await captureResponse(() =>
    requirePublishableEntry(
      'entry-1',
      lookupReturning(approvedEntry({ first_comment: 'Approved comment' })),
    ),
  );

  assertEquals(longCaptionResponse.status, 422);
  assertEquals(firstCommentResponse.status, 422);
});

Deno.test(
  'requirePublishableEntry maps only authoritative carousel fields and omits callbacks',
  async () => {
    let requestedId = '';
    const publishableEntry = await requirePublishableEntry(' entry-1 ', (entryId) => {
      requestedId = entryId;
      return Promise.resolve({
        data: approvedEntry({
          asset_type: 'Carousel',
          platforms: [' BlueSky ', 'BlueSky', 123],
          platform_captions: {
            BlueSky: ' Platform caption ',
            Instagram: 123,
          },
          asset_previews: [
            'https://cdn.example.org/one.jpg',
            'https://cdn.example.org/two.jpg',
            'https://cdn.example.org/one.jpg',
          ],
          preview_url: ' https://cdn.example.org/unused-preview.jpg ',
        }),
        error: null,
      });
    });

    assertEquals(requestedId, 'entry-1');
    assertEquals(publishableEntry, {
      payload: {
        entryId: 'entry-1',
        platforms: ['BlueSky'],
        caption: 'Authoritative caption',
        platformCaptions: { BlueSky: 'Platform caption' },
        assetType: 'Carousel',
        mediaUrls: ['https://cdn.example.org/one.jpg', 'https://cdn.example.org/two.jpg'],
        previewUrl: null,
        firstComment: '',
      },
      entryRevision: 3,
    });
    assertEquals(Object.hasOwn(publishableEntry.payload, 'callbackUrl'), false);
  },
);
