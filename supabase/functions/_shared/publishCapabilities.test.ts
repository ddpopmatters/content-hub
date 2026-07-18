import {
  getPublishCapabilityIssue,
  PUBLISH_CAPABILITIES,
  type PublishAssetType,
} from './publishCapabilities.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const validInput = (platform: string, assetType: PublishAssetType) => ({
  assetType,
  platforms: [platform],
  caption: 'Approved caption',
  platformCaptions: {},
  firstComment: '',
  previewUrl: assetType === 'Design' ? 'https://cdn.example.org/image.jpg' : null,
  mediaUrls:
    assetType === 'Carousel'
      ? ['https://cdn.example.org/one.jpg', 'https://cdn.example.org/two.jpg']
      : [],
});

Deno.test('capability matrix accepts every explicitly supported combination', () => {
  for (const [platform, capability] of Object.entries(PUBLISH_CAPABILITIES)) {
    for (const assetType of capability.assetTypes) {
      assertEquals(getPublishCapabilityIssue(validInput(platform, assetType)), null);
    }
  }
});

Deno.test('capability contract blocks video and YouTube publishing', () => {
  assertEquals(
    getPublishCapabilityIssue(validInput('BlueSky', 'Video'))?.code,
    'unsupported_asset_type',
  );
  assertEquals(
    getPublishCapabilityIssue(validInput('YouTube', 'Design'))?.code,
    'unsupported_platform',
  );
});

Deno.test('capability contract blocks format downgrades', () => {
  assertEquals(
    getPublishCapabilityIssue(validInput('Instagram', 'No asset'))?.code,
    'unsupported_combination',
  );
  assertEquals(
    getPublishCapabilityIssue(validInput('LinkedIn', 'Carousel'))?.code,
    'unsupported_combination',
  );
});

Deno.test('capability contract requires complete media', () => {
  assertEquals(
    getPublishCapabilityIssue({
      assetType: 'Design',
      platforms: ['Facebook'],
      previewUrl: '',
    })?.code,
    'missing_image',
  );
  assertEquals(
    getPublishCapabilityIssue({
      assetType: 'Carousel',
      platforms: ['BlueSky'],
      mediaUrls: ['https://cdn.example.org/one.jpg'],
    })?.code,
    'missing_carousel_images',
  );
});

Deno.test('capability contract rejects platform-specific carousel truncation', () => {
  assertEquals(
    getPublishCapabilityIssue({
      assetType: 'Carousel',
      platforms: ['BlueSky', 'Instagram'],
      mediaUrls: Array.from(
        { length: 5 },
        (_, index) => `https://cdn.example.org/${index + 1}.jpg`,
      ),
    })?.code,
    'too_many_carousel_images',
  );
});

Deno.test('capability contract rejects non-HTTPS publication media', () => {
  assertEquals(
    getPublishCapabilityIssue({
      assetType: 'Design',
      platforms: ['Facebook'],
      previewUrl: 'http://internal.example.org/image.jpg',
    })?.code,
    'invalid_media_url',
  );
  assertEquals(
    getPublishCapabilityIssue({
      assetType: 'Carousel',
      platforms: ['Instagram'],
      mediaUrls: ['https://cdn.example.org/one.jpg', 'data:image/png;base64,unsafe'],
    })?.code,
    'invalid_media_url',
  );
});

Deno.test('capability contract rejects silent caption truncation', () => {
  assertEquals(
    getPublishCapabilityIssue({
      ...validInput('BlueSky', 'No asset'),
      caption: 'a'.repeat(301),
    })?.code,
    'caption_too_long',
  );
  assertEquals(
    getPublishCapabilityIssue({
      ...validInput('BlueSky', 'No asset'),
      caption: 'a'.repeat(301),
      platformCaptions: { BlueSky: 'Within the platform limit' },
    }),
    null,
  );
});

Deno.test('capability contract rejects untracked first-comment mutations', () => {
  assertEquals(
    getPublishCapabilityIssue({
      ...validInput('LinkedIn', 'No asset'),
      firstComment: 'Approved follow-up comment',
    })?.code,
    'first_comment_unsupported',
  );
});
