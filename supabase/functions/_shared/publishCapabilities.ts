export const PUBLISH_ASSET_TYPES = ['No asset', 'Design', 'Carousel', 'Video'] as const;
export type PublishAssetType = (typeof PUBLISH_ASSET_TYPES)[number];

export const PUBLISH_CAPABILITIES = {
  BlueSky: {
    assetTypes: ['No asset', 'Design', 'Carousel'],
    carouselImages: { min: 2, max: 4 },
    maxCaptionLength: 300,
  },
  Instagram: {
    assetTypes: ['Design', 'Carousel'],
    carouselImages: { min: 2, max: 10 },
    maxCaptionLength: 2200,
  },
  Facebook: {
    assetTypes: ['No asset', 'Design', 'Carousel'],
    carouselImages: { min: 2, max: 20 },
    maxCaptionLength: 63206,
  },
  LinkedIn: {
    assetTypes: ['No asset', 'Design'],
    carouselImages: null,
    maxCaptionLength: 3000,
  },
} as const satisfies Record<
  string,
  {
    assetTypes: readonly PublishAssetType[];
    carouselImages: { min: number; max: number } | null;
    maxCaptionLength: number;
  }
>;

export type PublishPlatform = keyof typeof PUBLISH_CAPABILITIES;

export interface PublishCapabilityInput {
  assetType: unknown;
  platforms: unknown;
  mediaUrls?: unknown;
  previewUrl?: unknown;
  caption?: unknown;
  platformCaptions?: unknown;
  firstComment?: unknown;
}

export interface PublishCapabilityIssue {
  code:
    | 'missing_platform'
    | 'unsupported_asset_type'
    | 'unsupported_platform'
    | 'unsupported_combination'
    | 'missing_image'
    | 'missing_carousel_images'
    | 'too_many_carousel_images'
    | 'invalid_media_url'
    | 'caption_too_long'
    | 'first_comment_unsupported';
  message: string;
  platform?: string;
}

const isAssetType = (value: string): value is PublishAssetType =>
  PUBLISH_ASSET_TYPES.some((assetType) => assetType === value);

const isPublishPlatform = (value: string): value is PublishPlatform =>
  Object.prototype.hasOwnProperty.call(PUBLISH_CAPABILITIES, value);

const normaliseStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      )
    : [];

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Fail-closed publication capability contract shared by the UI and Edge boundary.
 * It describes only adapters that are implemented without format downgrades.
 */
export function getPublishCapabilityIssue({
  assetType: assetTypeValue,
  platforms: platformValue,
  mediaUrls: mediaUrlValue,
  previewUrl: previewUrlValue,
  caption: captionValue,
  platformCaptions: platformCaptionValue,
  firstComment: firstCommentValue,
}: PublishCapabilityInput): PublishCapabilityIssue | null {
  const assetType = typeof assetTypeValue === 'string' ? assetTypeValue.trim() : '';
  if (!isAssetType(assetType)) {
    return {
      code: 'unsupported_asset_type',
      message: 'This asset type is not available for direct publishing.',
    };
  }

  if (assetType === 'Video') {
    return {
      code: 'unsupported_asset_type',
      message: 'Video publishing is not available. Upload this content directly on the platform.',
    };
  }

  const platforms = normaliseStrings(platformValue);
  if (platforms.length === 0) {
    return {
      code: 'missing_platform',
      message: 'Select at least one publishing platform.',
    };
  }

  for (const platform of platforms) {
    if (!isPublishPlatform(platform)) {
      return {
        code: 'unsupported_platform',
        message: `${platform} is not available for direct publishing.`,
        platform,
      };
    }

    const supportedAssetTypes: readonly PublishAssetType[] =
      PUBLISH_CAPABILITIES[platform].assetTypes;
    if (!supportedAssetTypes.includes(assetType)) {
      return {
        code: 'unsupported_combination',
        message: `${assetType} publishing is not available for ${platform}.`,
        platform,
      };
    }

    const platformCaptions =
      platformCaptionValue &&
      typeof platformCaptionValue === 'object' &&
      !Array.isArray(platformCaptionValue)
        ? (platformCaptionValue as Record<string, unknown>)
        : {};
    const platformCaption = platformCaptions[platform];
    const effectiveCaption =
      typeof platformCaption === 'string' && platformCaption.trim()
        ? platformCaption
        : typeof captionValue === 'string'
          ? captionValue
          : '';
    const maxCaptionLength = PUBLISH_CAPABILITIES[platform].maxCaptionLength;
    if (Array.from(effectiveCaption).length > maxCaptionLength) {
      return {
        code: 'caption_too_long',
        message: `${platform} captions can contain up to ${maxCaptionLength.toLocaleString(
          'en-GB',
        )} characters.`,
        platform,
      };
    }
  }

  if (typeof firstCommentValue === 'string' && firstCommentValue.trim()) {
    return {
      code: 'first_comment_unsupported',
      message:
        'First comments are not available for direct publishing. Add the comment on the platform after publication.',
    };
  }

  if (assetType === 'Design') {
    const previewUrl = typeof previewUrlValue === 'string' ? previewUrlValue.trim() : '';
    if (!previewUrl) {
      return {
        code: 'missing_image',
        message: 'Add a published image before publishing.',
      };
    }
    if (!isHttpsUrl(previewUrl)) {
      return {
        code: 'invalid_media_url',
        message: 'The publication image must use a valid HTTPS URL.',
      };
    }
  }

  if (assetType === 'Carousel') {
    const mediaUrls = normaliseStrings(mediaUrlValue);
    if (mediaUrls.some((url) => !isHttpsUrl(url))) {
      return {
        code: 'invalid_media_url',
        message: 'Every carousel image must use a valid HTTPS URL.',
      };
    }

    for (const platform of platforms) {
      if (!isPublishPlatform(platform)) continue;
      const limits = PUBLISH_CAPABILITIES[platform].carouselImages;
      if (!limits) continue;
      if (mediaUrls.length < limits.min) {
        return {
          code: 'missing_carousel_images',
          message: `Add at least ${limits.min} published carousel images before publishing to ${platform}.`,
          platform,
        };
      }
      if (mediaUrls.length > limits.max) {
        return {
          code: 'too_many_carousel_images',
          message: `${platform} supports up to ${limits.max} carousel images.`,
          platform,
        };
      }
    }
  }

  return null;
}
