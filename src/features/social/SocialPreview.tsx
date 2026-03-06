import React from 'react';
import { cx } from '../../lib/utils';
import { PLATFORM_PREVIEW_META, PM_PROFILE_IMAGE } from '../../constants';

export interface SocialPreviewProps {
  /** Platform to render preview for */
  platform: string;
  /** Caption text */
  caption: string;
  /** Media URL (image or video) */
  mediaUrl?: string;
  /** Whether the media is an image */
  isImage?: boolean;
  /** Whether the media is a video */
  isVideo?: boolean;
}

interface HeaderLinkProps {
  children: React.ReactNode;
  className?: string;
  profileLinkProps: {
    href: string;
    target: string;
    rel: string;
    title: string;
  } | null;
}

const HeaderLink: React.FC<HeaderLinkProps> = ({ children, className, profileLinkProps }) =>
  profileLinkProps ? (
    <a {...profileLinkProps} className={className}>
      {children}
    </a>
  ) : (
    <span className={className}>{children}</span>
  );

/**
 * SocialPreview - Renders a platform-specific social media post preview
 */
export const SocialPreview: React.FC<SocialPreviewProps> = ({
  platform,
  caption,
  mediaUrl,
  isImage: _isImage,
  isVideo,
}) => {
  const resolvedPlatform = (() => {
    if (platform === 'Main') return 'LinkedIn';
    if (platform === 'X/Twitter') return 'BlueSky';
    return platform;
  })();

  const meta = PLATFORM_PREVIEW_META[resolvedPlatform] || PLATFORM_PREVIEW_META.LinkedIn;
  const prettyCaption =
    caption && caption.trim().length ? caption : 'Your caption will appear here.';
  const displayPlatformLabel = platform === 'Main' ? 'All platforms' : resolvedPlatform;

  const profileLinkProps = meta.profileUrl
    ? {
        href: meta.profileUrl,
        target: '_blank',
        rel: 'noreferrer noopener',
        title: `Open ${meta.name} on ${resolvedPlatform}`,
      }
    : null;

  interface HeaderOptions {
    wrapperClassName?: string;
    avatarClassName?: string;
    nameClassName?: string;
    handleClassName?: string;
    rightContent?: React.ReactNode;
  }

  const renderHeader = (opts: HeaderOptions = {}) => (
    <div className={cx('flex items-center gap-3 px-4 py-3', opts.wrapperClassName)}>
      <HeaderLink
        profileLinkProps={profileLinkProps}
        className={cx(
          'h-10 w-10 overflow-hidden rounded-full border border-white bg-white shadow',
          opts.avatarClassName,
        )}
      >
        <img
          src={meta.avatar || PM_PROFILE_IMAGE}
          alt={`${meta.name} avatar`}
          className="h-full w-full object-contain p-1"
          loading="lazy"
        />
      </HeaderLink>
      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderLink
          profileLinkProps={profileLinkProps}
          className={cx('text-sm font-semibold text-ocean-900 hover:underline', opts.nameClassName)}
        >
          {meta.name}
        </HeaderLink>
        <HeaderLink
          profileLinkProps={profileLinkProps}
          className={cx('text-xs text-graystone-500 hover:underline', opts.handleClassName)}
        >
          {meta.handle}
        </HeaderLink>
      </div>
      {opts.rightContent || (
        <span className="text-[11px] uppercase tracking-wide text-graystone-400">
          {displayPlatformLabel}
        </span>
      )}
    </div>
  );

  interface MediaOptions {
    placeholderHeight?: string;
    roundedClass?: string;
    borderClass?: string;
    wrapperClassName?: string;
  }

  const renderMedia = (options: MediaOptions = {}) => {
    const {
      placeholderHeight = 'h-48',
      roundedClass = 'rounded-2xl',
      borderClass = 'border border-graystone-200',
      wrapperClassName = '',
    } = options;

    if (!mediaUrl) {
      return (
        <div
          className={cx(
            'flex w-full items-center justify-center bg-graystone-50 text-xs text-graystone-500',
            roundedClass,
            borderClass,
            placeholderHeight,
            wrapperClassName,
          )}
        >
          Asset preview will appear here.
        </div>
      );
    }

    if (isVideo) {
      return (
        <div
          className={cx('overflow-hidden bg-black', roundedClass, borderClass, wrapperClassName)}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- preview player, no captions available */}
          <video src={mediaUrl} controls playsInline className="h-full w-full" preload="metadata" />
        </div>
      );
    }

    return (
      <img
        src={mediaUrl}
        alt={`${resolvedPlatform} preview`}
        className={cx('w-full object-cover', roundedClass, borderClass, wrapperClassName)}
        loading="lazy"
      />
    );
  };

  const renderLinkedIn = () => (
    <div className="overflow-hidden rounded-2xl border border-graystone-200 bg-white shadow-sm">
      {renderHeader({
        wrapperClassName: 'bg-[#eef3f8]',
        handleClassName: 'text-xs text-graystone-600',
        rightContent: (
          <button
            type="button"
            className="rounded-full border border-[#0a66c2] px-3 py-1 text-xs font-semibold text-[#0a66c2] hover:bg-[#0a66c2] hover:text-white"
          >
            Follow
          </button>
        ),
      })}
      <div className="space-y-3 px-4 pb-4 pt-3">
        <p className="whitespace-pre-wrap text-sm text-graystone-800">{prettyCaption}</p>
        {renderMedia()}
      </div>
      <div className="flex items-center justify-between border-t border-graystone-100 px-4 py-2 text-xs text-graystone-500">
        <span className="inline-flex items-center gap-1">👍 Like</span>
        <span className="inline-flex items-center gap-1">💬 Comment</span>
        <span className="inline-flex items-center gap-1">↗️ Share</span>
      </div>
    </div>
  );

  const renderInstagram = () => (
    <div className="overflow-hidden rounded-2xl border border-graystone-200 bg-white shadow-sm">
      {renderHeader({
        rightContent: <span className="text-xl text-graystone-400">•••</span>,
      })}
      {renderMedia({ placeholderHeight: 'h-80' })}
      <div className="space-y-2 px-4 py-3">
        <div className="flex items-center gap-4 text-xl text-graystone-800">
          <span>❤</span>
          <span>💬</span>
          <span>↗️</span>
        </div>
        <p className="whitespace-pre-wrap text-sm text-graystone-900">{prettyCaption}</p>
      </div>
    </div>
  );

  interface TwitterOptions {
    customClassName?: string;
    wrapperClassName?: string;
    borderClass?: string;
    placeholderHeight?: string;
  }

  const renderTwitter = (options: TwitterOptions = {}) => (
    <div
      className={cx(
        'overflow-hidden rounded-2xl border shadow-sm',
        options.customClassName ?? 'border-[#2f3336] bg-black text-white',
      )}
    >
      {renderHeader({
        wrapperClassName: options.wrapperClassName ?? 'border-b border-[#2f3336] bg-black',
        nameClassName: 'text-white',
        handleClassName: 'text-gray-400',
        avatarClassName: 'border-[#2f3336]',
        rightContent: <span className="text-sm text-gray-400">•••</span>,
      })}
      <div className="space-y-3 px-4 py-3 text-sm">
        <p className="whitespace-pre-wrap">{prettyCaption}</p>
        {renderMedia({
          borderClass: options.borderClass ?? 'border-[#2f3336]',
          placeholderHeight: options.placeholderHeight ?? 'h-64',
        })}
      </div>
      <div className="flex items-center justify-between border-t border-[#2f3336] px-4 py-2 text-xs text-gray-400">
        <span>💬 12</span>
        <span>🔁 34</span>
        <span>❤️ 210</span>
        <span>📥 5</span>
      </div>
    </div>
  );

  const renderFacebook = () => (
    <div className="overflow-hidden rounded-2xl border border-graystone-200 bg-white shadow-sm">
      {renderHeader({
        rightContent: <span className="text-xs font-semibold text-[#1877f2]">Follow</span>,
      })}
      <div className="space-y-3 px-4 pb-4 pt-2">
        <p className="whitespace-pre-wrap text-sm text-graystone-800">{prettyCaption}</p>
        {renderMedia()}
        <div className="flex items-center justify-between border-t border-graystone-100 pt-2 text-xs text-graystone-500">
          <span>👍 Like</span>
          <span>💬 Comment</span>
          <span>↗️ Share</span>
        </div>
      </div>
    </div>
  );

  const renderYouTube = () => (
    <div className="overflow-hidden rounded-2xl border border-graystone-200 bg-white shadow-sm">
      {renderHeader({
        rightContent: <span className="text-xs font-semibold text-[#ff0000]">Subscribe</span>,
      })}
      <div className="px-4 pb-4 pt-2">
        {renderMedia({ placeholderHeight: 'h-60', roundedClass: 'rounded-xl' })}
        <p className="mt-3 whitespace-pre-wrap text-sm text-graystone-800">{prettyCaption}</p>
      </div>
    </div>
  );

  const renderDefault = () => (
    <div className="overflow-hidden rounded-2xl border border-graystone-200 bg-white shadow-sm">
      {renderHeader()}
      <div className="space-y-3 px-4 pb-4 pt-2">
        <p className="whitespace-pre-wrap text-sm text-graystone-800">{prettyCaption}</p>
        {renderMedia()}
      </div>
    </div>
  );

  switch (resolvedPlatform) {
    case 'LinkedIn':
      return renderLinkedIn();
    case 'Instagram':
      return renderInstagram();
    case 'BlueSky':
      return renderTwitter({
        customClassName:
          'overflow-hidden rounded-2xl border border-[#2a5bc2] bg-[#0c1f41] text-white shadow-sm',
      });
    case 'Facebook':
      return renderFacebook();
    case 'YouTube':
      return renderYouTube();
    default:
      return renderDefault();
  }
};

export default SocialPreview;
