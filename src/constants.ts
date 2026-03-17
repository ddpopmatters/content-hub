export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export const ASSET_TYPES = ['No asset', 'Video', 'Design', 'Carousel'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const IDEA_TYPES = ['Topic', 'Theme', 'Series', 'Campaign', 'Other'] as const;
export type IdeaType = (typeof IDEA_TYPES)[number];

// Streamlined Kanban with 4 statuses (simplified from 7)
export const KANBAN_STATUSES = ['Draft', 'Ready for Review', 'Approved', 'Published'] as const;
export type KanbanStatus = (typeof KANBAN_STATUSES)[number];

export const PRIORITY_TIERS = ['Low', 'Medium', 'High', 'Urgent'] as const;
export type PriorityTier = (typeof PRIORITY_TIERS)[number];

export const PRIORITY_TIER_BADGE_CLASSES: Record<PriorityTier, string> = {
  Low: 'bg-graystone-100 text-graystone-700',
  Medium: 'bg-ocean-100 text-ocean-800',
  High: 'bg-amber-100 text-amber-800',
  Urgent: 'bg-red-100 text-red-700',
};

export const PRIORITY_TIER_BORDER_CLASSES: Record<PriorityTier, string> = {
  Low: 'border-l-graystone-300',
  Medium: 'border-l-ocean-500',
  High: 'border-l-amber-500',
  Urgent: 'border-l-red-500',
};

export const PRIORITY_TIER_DOT_CLASSES: Record<PriorityTier, string> = {
  Low: 'bg-graystone-400',
  Medium: 'bg-ocean-500',
  High: 'bg-amber-500',
  Urgent: 'bg-red-500',
};

// Legacy status mapping for migration
export const LEGACY_STATUS_MAP: Record<string, KanbanStatus> = {
  Draft: 'Draft',
  'Approval required': 'Ready for Review',
  'Awaiting brand approval': 'Ready for Review',
  'Awaiting SME approval': 'Ready for Review',
  'Awaiting visual': 'Ready for Review',
  'In Review': 'Ready for Review',
  Approved: 'Approved',
  Scheduled: 'Approved',
  Published: 'Published',
};

export const CAMPAIGNS = [
  'Evergreen',
  'Campaign',
  'Research Launch',
  'Advocacy Moment',
  'Event',
  'Awareness Day',
] as const;
export type Campaign = (typeof CAMPAIGNS)[number];

export const CONTENT_CATEGORIES = [
  'Evidence & education',
  'Campaign & advocacy',
  'Counter-disinformation',
  'Community & engagement',
  'Partner & people stories',
  'Organisational',
] as const;
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export const CONTENT_CATEGORY_TARGETS: Record<ContentCategory, number> = {
  'Evidence & education': 30,
  'Campaign & advocacy': 25,
  'Counter-disinformation': 15,
  'Community & engagement': 15,
  'Partner & people stories': 10,
  Organisational: 5,
};

export const RESPONSE_MODES = ['Planned', 'Reactive', 'Pre-bunk', 'Rapid response'] as const;
export type ResponseMode = (typeof RESPONSE_MODES)[number];

export const SIGN_OFF_ROUTES = [
  'Standard scheduled content',
  'Reactive / rapid response',
  'Counter-disinformation / pre-bunking',
  'Research publication content',
  'Partner / E2P content',
  'Coalition content',
  'Paid social creative',
  'Named staff content',
  'Risk audience content',
] as const;
export type SignOffRoute = (typeof SIGN_OFF_ROUTES)[number];

export const EXECUTION_STATUSES = ['Pending', 'Ready', 'Not needed'] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const LINK_PLACEMENTS = [
  'First comment',
  'Caption / body',
  'Bio / profile',
  'No external link',
] as const;
export type LinkPlacement = (typeof LINK_PLACEMENTS)[number];

export const CTA_TYPES = [
  'Read more',
  'Donate',
  'Sign petition',
  'Share',
  'Comment',
  'Follow',
  'Register',
  'Partner action',
  'No CTA',
] as const;
export type CtaType = (typeof CTA_TYPES)[number];

export interface SignOffRouteRecommendationInput {
  campaign?: string | null;
  contentCategory?: string | null;
  partnerOrg?: string | null;
  responseMode?: string | null;
}

export interface ApprovalRouteTemplate {
  route: SignOffRoute;
  preferredCount: number;
  matchers: string[];
}

export const recommendSignOffRoute = ({
  campaign,
  contentCategory,
  partnerOrg,
  responseMode,
}: SignOffRouteRecommendationInput): SignOffRoute | '' => {
  if (responseMode === 'Rapid response' || responseMode === 'Reactive') {
    return 'Reactive / rapid response';
  }
  if (responseMode === 'Pre-bunk' || contentCategory === 'Counter-disinformation') {
    return 'Counter-disinformation / pre-bunking';
  }
  if (campaign === 'Research Launch') {
    return 'Research publication content';
  }
  if (partnerOrg && partnerOrg.trim()) {
    return 'Partner / E2P content';
  }
  return 'Standard scheduled content';
};

export const APPROVAL_ROUTE_TEMPLATES: readonly ApprovalRouteTemplate[] = [
  {
    route: 'Standard scheduled content',
    preferredCount: 2,
    matchers: ['comms', 'social', 'content'],
  },
  {
    route: 'Reactive / rapid response',
    preferredCount: 2,
    matchers: ['comms', 'social', 'campaign'],
  },
  {
    route: 'Counter-disinformation / pre-bunking',
    preferredCount: 2,
    matchers: ['policy', 'campaign', 'comms'],
  },
  {
    route: 'Research publication content',
    preferredCount: 2,
    matchers: ['policy', 'research', 'comms'],
  },
  {
    route: 'Partner / E2P content',
    preferredCount: 2,
    matchers: ['campaign', 'partnership', 'comms'],
  },
  {
    route: 'Coalition content',
    preferredCount: 2,
    matchers: ['campaign', 'advocacy', 'comms'],
  },
  {
    route: 'Paid social creative',
    preferredCount: 2,
    matchers: ['creative', 'design', 'social'],
  },
  {
    route: 'Named staff content',
    preferredCount: 2,
    matchers: ['comms', 'social', 'manager'],
  },
  {
    route: 'Risk audience content',
    preferredCount: 3,
    matchers: ['policy', 'campaign', 'comms', 'manager'],
  },
] as const;

export const recommendApproversForRoute = (
  route: string | null | undefined,
  approverOptions: readonly string[] = DEFAULT_APPROVERS,
): string[] => {
  const normalizedOptions = Array.from(
    new Set(
      approverOptions
        .map((option) => (typeof option === 'string' ? option.trim() : ''))
        .filter(Boolean),
    ),
  );
  if (!normalizedOptions.length) return [];
  const template = APPROVAL_ROUTE_TEMPLATES.find((item) => item.route === route);
  if (!template) return normalizedOptions.slice(0, 2);

  const matched = normalizedOptions.filter((option) => {
    const lower = option.toLowerCase();
    return template.matchers.some((matcher) => lower.includes(matcher));
  });
  const picks = matched.slice(0, template.preferredCount);
  if (picks.length >= template.preferredCount) return picks;

  const fallbacks = normalizedOptions.filter((option) => !picks.includes(option));
  return [...picks, ...fallbacks.slice(0, Math.max(template.preferredCount - picks.length, 0))];
};

export const CONTENT_PILLARS = [
  'Reproductive Rights & Bodily Autonomy',
  'Population & Demographics',
  'Environmental Sustainability',
  'Social Justice',
] as const;
export type ContentPillar = (typeof CONTENT_PILLARS)[number];

export const CONTENT_PILLAR_DESCRIPTIONS: Record<ContentPillar, string> = {
  'Reproductive Rights & Bodily Autonomy':
    'Our lead narrative. Every woman has the right to decide if and when to have children, free from pressure, targets, or coercion.',
  'Population & Demographics':
    'Making the evidence case with data. Translating demographic research into accessible, shareable content. Challenging the Baby Bust panic with data.',
  'Environmental Sustainability':
    'The connection between population dynamics and planetary boundaries — biodiversity, water, land, climate. Blame systems not individuals.',
  'Social Justice':
    'The structural conditions — inequality, discrimination, inadequate healthcare and education — that make genuine reproductive choice impossible.',
};

// Platforms ordered by strategic tier (TikTok removed)
export const ALL_PLATFORMS = ['Instagram', 'LinkedIn', 'YouTube', 'Facebook', 'BlueSky'] as const;
export type Platform = (typeof ALL_PLATFORMS)[number];

export const PLATFORM_TIERS: Record<Platform, 1 | 2 | 3> = {
  Instagram: 1,
  LinkedIn: 1,
  YouTube: 2,
  Facebook: 2,
  BlueSky: 3,
};

export interface PlatformMetricField {
  key: string;
  label: string;
  hint?: string;
  /** Extended guidance shown in the info modal: what this metric measures and where to find it. */
  guidance?: string;
  isRate?: boolean; // true for %, ratio, or rate fields — excluded from per-post calculation
}

export const PLATFORM_METRICS: Record<Platform, PlatformMetricField[]> = {
  Instagram: [
    { key: 'impressions', label: 'Impressions', hint: 'Total times the post was displayed' },
    { key: 'reach', label: 'Reach', hint: 'Unique accounts that saw the post' },
    { key: 'likes', label: 'Likes' },
    { key: 'comments', label: 'Comments' },
    { key: 'shares', label: 'Shares' },
    { key: 'saves', label: 'Saves' },
  ],
  LinkedIn: [
    { key: 'impressions', label: 'Impressions' },
    { key: 'clicks', label: 'Clicks (link)' },
    { key: 'likes', label: 'Likes' },
    { key: 'comments', label: 'Comments' },
    { key: 'shares', label: 'Reposts / Shares' },
  ],
  YouTube: [
    { key: 'views', label: 'Views' },
    { key: 'watchTime', label: 'Watch time (mins)' },
    { key: 'likes', label: 'Likes' },
    { key: 'comments', label: 'Comments' },
    { key: 'shares', label: 'Shares' },
    { key: 'subscribersGained', label: 'Subscribers gained' },
  ],
  Facebook: [
    { key: 'impressions', label: 'Impressions' },
    { key: 'reach', label: 'Reach' },
    { key: 'likes', label: 'Likes / Reactions' },
    { key: 'comments', label: 'Comments' },
    { key: 'shares', label: 'Shares' },
    { key: 'clicks', label: 'Link clicks' },
  ],
  BlueSky: [
    { key: 'impressions', label: 'Impressions' },
    { key: 'likes', label: 'Likes' },
    { key: 'shares', label: 'Reposts' },
    { key: 'quotePosts', label: 'Quote posts' },
    { key: 'comments', label: 'Replies' },
  ],
};

// Reporting-specific metrics aligned to the Analytics & Optimisation Framework.
// Separate from PLATFORM_METRICS (which covers per-post analytics entry).
// De-prioritised signals (likes, raw impressions) are intentionally excluded.
export const REPORTING_PLATFORM_METRICS: Record<Platform, PlatformMetricField[]> = {
  Instagram: [
    {
      key: 'numberOfPosts',
      label: 'Posts published',
      guidance:
        'Count of feed posts (including carousels and Reels) published during the period. Find in Instagram Insights → Content → filter by date range. Does not include Stories.',
    },
    {
      key: 'numberOfStories',
      label: 'Stories published',
      guidance:
        'Count of Stories published during the period. Find in Instagram Insights → Content → Stories tab → filter by date range.',
    },
    {
      key: 'followersTotal',
      label: 'Total followers',
      isRate: true,
      guidance:
        'Total follower count at the end of the reporting period. Find in Instagram Insights → Audience → Followers → note the current total. Record at the last day of the period for consistency.',
    },
    {
      key: 'followersGained',
      label: 'New followers',
      guidance:
        'Net new followers gained during the period (follows minus unfollows). Find in Instagram Insights → Audience → Followers → select the date range and read the net change figure.',
    },
    {
      key: 'views',
      label: 'Views',
      guidance:
        'Total video and Reel plays for the period. Find in Instagram Insights → Overview → Views, or sum Reel plays from the Content tab. Includes replays by the same account.',
    },
    {
      key: 'followerNonFollowerRatio',
      label: 'Follower / Non-follower ratio (%)',
      isRate: true,
      guidance:
        'Percentage of your reach that came from accounts NOT already following you. A higher percentage means the algorithm is distributing your content beyond your existing audience.\n\nWhere to find it: Instagram Insights → Reach → scroll to the "Follower and Non-follower" breakdown. Enter the non-follower percentage here. A rising ratio over time indicates improving organic discovery.',
    },
    {
      key: 'accountsReached',
      label: 'Accounts reached',
      guidance:
        'Unique accounts that saw any of your content during the period. This is the period-level unique figure — do not sum per-post reach, as the same account is counted multiple times.\n\nWhere to find it: Instagram Insights → Overview → Accounts reached → select the date range.',
    },
    {
      key: 'profileVisits',
      label: 'Profile visits',
      guidance:
        'Number of times your profile was visited during the period. A leading indicator of audience interest — someone who visits your profile after seeing a post is considering following or exploring further.\n\nWhere to find it: Instagram Insights → Overview → Profile visits → select the date range.',
    },
    {
      key: 'likes',
      label: 'Likes',
      guidance:
        'Total likes across all posts in the period. Sum from Instagram Insights → Content → select each post. Likes are a low-quality signal and are de-prioritised in the framework, but useful for per-post comparison.',
    },
    {
      key: 'saves',
      label: 'Saves',
      guidance:
        "Total saves/bookmarks across all posts in the period. Saves are a high-quality signal — they indicate content worth returning to. Instagram's algorithm weights saves heavily.\n\nWhere to find it: Instagram Insights → individual post → Saves. Sum across all posts in the period, or use the period-level summary in the Content tab if available.",
    },
    {
      key: 'reposts',
      label: 'Reposts',
      guidance:
        'Total reposts of your posts during the period. Find in Instagram Insights → individual post → Shares (the share-to-feed / repost figure). Sum across all posts.',
    },
    {
      key: 'sharesToStory',
      label: 'Shares to story',
      guidance:
        'Number of times people shared your posts to their own Stories using the paper-plane send button → "Add to your Story". A strong secondary distribution signal — the post is being amplified into another account\'s network.\n\nWhere to find it: Instagram Insights → individual post → Shares to story. Sum across posts in the period.',
    },
    {
      key: 'comments',
      label: 'Comments',
      guidance:
        'Total comments across all posts in the period. Find in Instagram Insights → Content tab or individual post analytics. Review comment quality qualitatively — substantive comments carry more strategic weight than low-effort responses.',
    },
    {
      key: 'dmSends',
      label: 'DM sends',
      hint: '#1 algorithm signal (Mosseri, Jan 2026)',
      guidance:
        'Number of times your posts were sent via DM (the paper-plane button → "Send to"). Confirmed as Instagram\'s primary ranking signal by Adam Mosseri in January 2026. When someone sends your post to a friend, it signals genuine value to the algorithm.\n\nWhere to find it: Instagram Insights → individual post → Sends. Sum across all posts in the period. Also visible in the post\'s interaction summary as "Send to".',
    },
    {
      key: 'reelViews',
      label: 'Reel views',
      guidance:
        'Total plays of your Reels during the period. Each play counts separately, including replays. Compare against Reel reach to understand replay rate.\n\nWhere to find it: Instagram Insights → Content → Reels tab → sum the "Plays" figure across all Reels published in the period.',
    },
    {
      key: 'storyViews',
      label: 'Story views',
      guidance:
        'Total views (impressions) across all Stories published in the period. Instagram counts each Story slide separately.\n\nWhere to find it: Instagram Insights → Content → Stories tab → sum the "Impressions" or "Views" figure across all Stories in the period.',
    },
    {
      key: 'externalLinkClicks',
      label: 'External link clicks',
      guidance:
        'Clicks on external links from your profile and posts — includes bio link, link stickers in Stories, and any linked content.\n\nWhere to find it: Instagram Insights → Overview → External link taps, or individual post/Story analytics for link sticker clicks. This is the closest Instagram gets to a CTR metric given that links in feed posts are not permitted.',
    },
  ],
  LinkedIn: [
    {
      key: 'numberOfPosts',
      label: 'Posts published',
      guidance:
        'Total posts published from the Page during the period. Find in LinkedIn Page Analytics → Content tab → filter by date range → count entries.',
    },
    {
      key: 'followersTotal',
      label: 'Total followers',
      isRate: true,
      guidance:
        'Total Page followers at the end of the reporting period. Find in LinkedIn Page Analytics → Followers → note the current total. Record at the last day of the period.',
    },
    {
      key: 'followersGained',
      label: 'New followers',
      guidance:
        'Net new followers gained during the period. Find in LinkedIn Page Analytics → Followers → follower growth graph → read the net change for the date range.',
    },
    {
      key: 'impressions',
      label: 'Impressions',
      guidance:
        'Total times your posts were displayed, including repeat views by the same member. Context only — not a target metric. Find in LinkedIn Page Analytics → Content tab → Impressions column. Use Members reached for a more meaningful reach figure.',
    },
    {
      key: 'reactions',
      label: 'Reactions',
      guidance:
        'Total reactions (Like, Celebrate, Support, Love, Insightful, Funny) across all posts in the period. Find in LinkedIn Page Analytics → Content tab → Reactions column.',
    },
    {
      key: 'comments',
      label: 'Comments',
      guidance:
        'Total comments across all posts in the period. Find in LinkedIn Page Analytics → Content tab → Comments column. Review comment quality — LinkedIn comments from policymakers or NGO leads are high-value signals worth capturing in the narrative.',
    },
    {
      key: 'reposts',
      label: 'Reposts',
      guidance:
        'Total reposts (silent reposts and commented reposts combined) across all posts in the period. Find in LinkedIn Page Analytics → Content tab → Reposts column.',
    },
    {
      key: 'engagements',
      label: 'Engagements',
      guidance:
        'LinkedIn\'s aggregate engagement count: reactions + comments + clicks + reposts. Find in LinkedIn Page Analytics → Content tab → Engagements column. Note: LinkedIn\'s "Engagements" includes link clicks, which inflates the figure compared to the standard formula used elsewhere in this tool.',
    },
    {
      key: 'engagementRate',
      label: 'Engagement rate (%)',
      isRate: true,
      guidance:
        "LinkedIn's native engagement rate: engagements (reactions + comments + clicks + reposts) ÷ impressions × 100.\n\nWhere to find it: LinkedIn Page Analytics → Content tab → Engagement rate column.\n\nImportant: LinkedIn's formula differs from the cross-platform standard formula used in the Tier 1 metrics (which uses engagements ÷ reach, excluding clicks). Use this figure for LinkedIn-specific benchmarking. Target: 3–4% (sector average 1.91%; document carousels average 6.10%).",
    },
    {
      key: 'ctr',
      label: 'CTR (%)',
      isRate: true,
      guidance:
        'Click-through rate: link clicks ÷ impressions × 100. Only meaningful for posts containing external links.\n\nWhere to find it: LinkedIn Page Analytics → Content tab → CTR column. Target: 1%+ for organic posts with links.',
    },
    {
      key: 'membersReached',
      label: 'Members reached',
      guidance:
        'Unique LinkedIn members who saw your content at least once in the period. This is the closest equivalent to "reach" on LinkedIn.\n\nWhere to find it: LinkedIn Page Analytics → Reach tab → "Unique impressions". LinkedIn uses the term "unique impressions" in some views and "members reached" in others — they refer to the same figure. Use this rather than total Impressions for the engagement rate calculation.',
    },
    {
      key: 'clicks',
      label: 'Clicks',
      guidance:
        'Total link clicks across all posts in the period. Find in LinkedIn Page Analytics → Content tab → Clicks column. Includes clicks on any external URL in the post.',
    },
  ],
  YouTube: [
    {
      key: 'numberOfPosts',
      label: 'Videos published',
      guidance:
        'Total videos (long-form and Shorts) published during the period. Find in YouTube Studio → Content tab → filter by date published.',
    },
    {
      key: 'subscribersTotal',
      label: 'Total subscribers',
      isRate: true,
      guidance:
        'Total channel subscribers at the end of the reporting period. Find in YouTube Studio → Analytics → Audience tab → current subscriber count. Record at the last day of the period.',
    },
    {
      key: 'subscribers',
      label: 'Subscribers gained',
      guidance:
        'Net new subscribers gained during the period (gained minus lost). Find in YouTube Studio → Analytics → Audience tab → Subscribers gained/lost graph → read the net figure for the date range.',
    },
    {
      key: 'views',
      label: 'Views',
      guidance:
        'Total views across all videos in the period. Find in YouTube Studio → Analytics → Overview tab → Views → filter by date range.',
    },
    {
      key: 'watchTimeHours',
      label: 'Watch time (hours)',
      guidance:
        "Total hours watched across all videos in the period. This is YouTube's primary quality metric — the algorithm heavily weights watch time as evidence that content delivered on its promise.\n\nWhere to find it: YouTube Studio → Analytics → Overview or Content tab → Watch time → filter by date range. YouTube reports in hours. A rising watch time trend matters more than absolute view count.",
    },
    {
      key: 'comments',
      label: 'Comments',
      guidance:
        'Total comments across all videos in the period. Find in YouTube Studio → Analytics → Content tab → Comments column. Review comment quality — substantive discussion indicates content is landing with the right audiences.',
    },
    {
      key: 'likes',
      label: 'Likes',
      guidance:
        'Total likes across all videos in the period. Find in YouTube Studio → Analytics → Content tab → Likes column.',
    },
    {
      key: 'shares',
      label: 'Shares',
      guidance:
        'Total shares across all videos (using the Share button). Find in YouTube Studio → Analytics → Content tab → Shares column.',
    },
  ],
  Facebook: [
    {
      key: 'numberOfPosts',
      label: 'Posts published',
      guidance:
        'Total posts published from the Page during the period. Find in Facebook Insights → Content → filter by date range → count entries. Note: all Page videos are now auto-published as Reels.',
    },
    {
      key: 'followersTotal',
      label: 'Total followers',
      isRate: true,
      guidance:
        'Total Page followers at the end of the reporting period. Find in Facebook Insights → Followers → note the current total. Record at the last day of the period.',
    },
    {
      key: 'followersGained',
      label: 'New followers',
      guidance:
        'Net new Page followers gained during the period. Find in Facebook Insights → Followers → net follower change graph → read the figure for the date range.',
    },
    {
      key: 'views',
      label: 'Views',
      guidance:
        'Total video views during the period. Find in Facebook Insights → Videos → Total video views. Includes both feed views and Reels views (all Page videos are auto-Reels).',
    },
    {
      key: 'viewers',
      label: 'Viewers',
      guidance:
        'Unique accounts that watched any of your videos during the period. Compare against Views to understand repeat-view rate.\n\nWhere to find it: Facebook Insights → Videos → Unique video viewers.',
    },
    {
      key: 'contentInteractions',
      label: 'Content interactions',
      guidance:
        'Facebook\'s aggregate engagement count: reactions, comments, shares, and clicks combined. Find in Facebook Insights → Overview → Content interactions or Posts → Content interactions column.\n\nNote: Facebook\'s "Content interactions" formula differs from the cross-platform standard formula used elsewhere in this tool. Use for Facebook-specific trending rather than cross-channel comparison.',
    },
    {
      key: 'threeSecondViews',
      label: '3-second views',
      guidance:
        'Number of times your videos were watched for at least 3 seconds. The minimum threshold for Facebook to count a "view".\n\nWhere to find it: Facebook Insights → Videos → 3-second video views.\n\nUse alongside 1-minute views to gauge hook effectiveness. A high 3-second count with low 1-minute count means your thumbnail/opening is attracting clicks but the content is not holding attention.',
    },
    {
      key: 'oneMinuteViews',
      label: '1-minute views',
      guidance:
        'Number of times your videos were watched for at least 60 seconds. Indicates sustained attention beyond the hook.\n\nWhere to find it: Facebook Insights → Videos → 1-minute video views.\n\nCompare the ratio of 1-minute views to 3-second views — this is your effective completion rate proxy for Facebook. Target: aim for at least 30–40% of 3-second views converting to 1-minute views.',
    },
    {
      key: 'shares',
      label: 'Shares',
      guidance:
        "Total shares of your posts during the period. Shares are the most meaningful organic signal on Facebook — they extend reach to the sharer's network. Find in Facebook Insights → Posts → Shares column.",
    },
    {
      key: 'comments',
      label: 'Comments',
      guidance:
        'Total comments across all posts in the period. Find in Facebook Insights → Posts → Comments column. Review tone qualitatively alongside reaction sentiment data.',
    },
    {
      key: 'saves',
      label: 'Saves',
      guidance:
        'Total saves/bookmarks across posts in the period. Find in Facebook Insights → Posts → Saves column (available on most post types). A save indicates the content was worth returning to.',
    },
    {
      key: 'totalWatchTime',
      label: 'Total watch time (mins)',
      guidance:
        'Total minutes watched across all videos in the period. Includes both feed views and Reels (all Page videos are now auto-Reels).\n\nWhere to find it: Facebook Insights → Videos → Total minutes viewed.',
    },
    {
      key: 'reactionLove',
      label: 'Love reactions',
      guidance:
        'Count of Love reactions (heart) on posts during the period. Find in Facebook Insights → individual post → expand reaction breakdown.\n\nHigh Love reactions on partner stories or rights-based content signal strong emotional resonance. Track alongside Care and Angry reactions for sentiment shifts.',
    },
    {
      key: 'reactionCare',
      label: 'Care reactions',
      guidance:
        'Count of Care reactions (hugging face) on posts during the period. Find in Facebook Insights → individual post → expand reaction breakdown.\n\nCare reactions on content about affected communities or vulnerable populations indicate emotional engagement with the human stories behind the data.',
    },
    {
      key: 'reactionAngry',
      label: 'Angry reactions',
      hint: 'Leading indicator of discomfort on sensitive content',
      guidance:
        "Count of Angry reactions on posts during the period. Find in Facebook Insights → individual post → expand reaction breakdown → Angry.\n\nAngry reactions on population, family size, migration, or environmental content are an early warning signal of discomfort or misread framing. Track the ratio vs Love and Care reactions — a spike in Angry alongside flat positive reactions warrants a review of the content's framing and whether risk audiences are misinterpreting the message.\n\nDo not optimise away from topics that attract Angry reactions — some friction indicates you are engaging people with contested views, which is part of the counter-disinformation function.",
    },
  ],
  BlueSky: [
    {
      key: 'numberOfPosts',
      label: 'Posts published',
      guidance:
        "Total posts published from the PM BlueSky account during the period. Count from your BlueSky profile or use a third-party analytics tool. BlueSky's native analytics are limited — manual counting from the profile is the most reliable method.",
    },
    {
      key: 'followersTotal',
      label: 'Total followers',
      isRate: true,
      guidance:
        'Total followers at the end of the reporting period. Find on your BlueSky profile page. Record at the last day of the period. BlueSky does not have a built-in analytics dashboard — note the count at the start and end of each month.',
    },
    {
      key: 'followersGained',
      label: 'New followers',
      guidance:
        'Net new followers during the period. Calculate by subtracting the follower count at the start of the period from the count at the end. Keep a note of your follower count at the start of each reporting period for this purpose.',
    },
    {
      key: 'replies',
      label: 'Replies',
      guidance:
        'Total replies received on your posts during the period. Visible under each post. BlueSky reply threads from journalists, researchers, and policymakers are the highest-value engagement signal on this platform — review them qualitatively and note notable interactions in the narrative.',
    },
    {
      key: 'quotePosts',
      label: 'Quotes',
      guidance:
        "Total quote-posts of your content during the period. Visible under each post (the speech-bubble-with-arrow icon). Quote-posts from credible accounts in PM's target segments (researchers, journalists, policymakers) are particularly valuable — they amplify your content into a new audience network with an implicit endorsement.",
    },
    {
      key: 'likes',
      label: 'Likes',
      guidance:
        'Total likes on your posts during the period. Visible under each post. On BlueSky, likes are a lower-quality signal than quote-posts or replies — they indicate passive approval but less than active amplification.',
    },
    {
      key: 'reposts',
      label: 'Reposts',
      guidance:
        'Total reposts (silent reposts, without added commentary) during the period. Visible under each post. Track alongside quote-posts — a high repost rate relative to quote-posts means content is being shared but not commented on. A high quote-post rate suggests content is prompting substantive engagement.',
    },
  ],
};

export const DEFAULT_APPROVERS = [
  'Jameen Kaur',
  'Emma Lewendon-Strutt',
  'Josh Hill',
  'Shweta Shirodkar',
  'Dan Davis',
] as const;

export const PLATFORM_DEFAULT_LIMITS: Record<Platform, number> = {
  Instagram: 2200,
  LinkedIn: 3000,
  YouTube: 5000,
  Facebook: 63206,
  BlueSky: 300,
};

export const GUIDELINES_STORAGE_KEY = 'content-guidelines-settings-v1';

export interface UserRecord {
  name: string;
  email: string;
}

export const DEFAULT_USERS: UserRecord[] = [
  { name: 'Daniel Davis', email: 'daniel.davis@populationmatters.org' },
  { name: 'Dan Davis', email: 'dan@example.com' },
  { name: 'Francesca Harrison', email: '' },
  { name: 'Comms Lead', email: '' },
  { name: 'Campaigns Manager', email: '' },
  { name: 'Policy Lead', email: '' },
  { name: 'Creative Director', email: '' },
  { name: 'Social Lead', email: '' },
];

export interface FeatureOption {
  key: string;
  label: string;
}

export const FEATURE_OPTIONS: FeatureOption[] = [
  { key: 'calendar', label: 'Calendar & planning' },
  { key: 'kanban', label: 'Production Kanban' },
  { key: 'approvals', label: 'Approvals queue' },
  { key: 'ideas', label: 'Ideas log' },
  { key: 'influencers', label: 'Influencer tracking' },
  { key: 'admin', label: 'Admin tools' },
];

export const PLAN_TAB_FEATURES: Record<string, string> = {
  plan: 'calendar',
  peaks: 'calendar',
  series: 'calendar',
  responses: 'calendar',
  ideas: 'ideas',
};

export const PLAN_TAB_ORDER = [
  'plan',
  'peaks',
  'series',
  'responses',
  'ideas',
  'requests',
] as const;

export const WORKFLOW_STAGES = [
  'Briefing',
  'Production',
  'Ready for review',
  'Internals approved',
  'Scheduled',
  'Published',
] as const;
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export interface ChecklistItem {
  key: string;
  label: string;
}

export const UNIVERSAL_CHECKLIST_ITEMS: ChecklistItem[] = [
  { key: 'goldenThreadPassed', label: 'Golden Thread passed' },
  { key: 'terminologyChecked', label: 'Terminology checked' },
  { key: 'copyProofed', label: 'Copy proofed' },
  { key: 'linksChecked', label: 'Links checked' },
];

export const ASSET_CHECKLIST_ITEMS: Partial<Record<AssetType, ChecklistItem[]>> = {
  Video: [
    { key: 'subtitlesAdded', label: 'Subtitles/captions added' },
    { key: 'thumbnailSet', label: 'Thumbnail set' },
  ],
  Design: [
    { key: 'altTextWritten', label: 'Alt text prepared' },
    { key: 'imageOptimised', label: 'Image optimised for platform' },
  ],
  Carousel: [
    { key: 'altTextWritten', label: 'Alt text prepared' },
    { key: 'slidesReadableOnMobile', label: 'All slides readable on mobile' },
  ],
};

export const PLATFORM_CHECKLIST_ITEMS: Partial<Record<Platform, ChecklistItem[]>> = {
  Instagram: [
    { key: 'hashtagsAdded', label: 'Hashtags added (3–5)' },
    { key: 'altTextWritten', label: 'Alt text prepared' },
  ],
  LinkedIn: [{ key: 'linksInFirstComment', label: 'External links in first comment' }],
  YouTube: [
    { key: 'subtitlesAdded', label: 'Subtitles/captions uploaded' },
    { key: 'descriptionOptimised', label: 'Description optimised for search' },
  ],
};

export const getChecklistItemsForEntry = (
  platforms: string[] = [],
  assetType: string = '',
): ChecklistItem[] => {
  const seen = new Set<string>();
  const items: ChecklistItem[] = [];
  const add = (item: ChecklistItem) => {
    if (!seen.has(item.key)) {
      seen.add(item.key);
      items.push(item);
    }
  };
  UNIVERSAL_CHECKLIST_ITEMS.forEach(add);
  ASSET_CHECKLIST_ITEMS[assetType as AssetType]?.forEach(add);
  platforms.forEach((p) => PLATFORM_CHECKLIST_ITEMS[p as Platform]?.forEach(add));
  return items;
};

export const ALL_CHECKLIST_ITEMS: ChecklistItem[] = (() => {
  const seen = new Set<string>();
  const items: ChecklistItem[] = [];
  const add = (item: ChecklistItem) => {
    if (!seen.has(item.key)) {
      seen.add(item.key);
      items.push(item);
    }
  };
  UNIVERSAL_CHECKLIST_ITEMS.forEach(add);
  Object.values(ASSET_CHECKLIST_ITEMS).forEach((group) => group?.forEach(add));
  Object.values(PLATFORM_CHECKLIST_ITEMS).forEach((group) => group?.forEach(add));
  return items;
})();

/** @deprecated Use ALL_CHECKLIST_ITEMS or getChecklistItemsForEntry() */
export const CHECKLIST_ITEMS = ALL_CHECKLIST_ITEMS;

export const PLATFORM_IMAGES: Record<Platform, string> = {
  Instagram: 'https://cdn.simpleicons.org/instagram/E4405F',
  LinkedIn:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNCAyNCc+PHJlY3Qgd2lkdGg9JzI0JyBoZWlnaHQ9JzI0JyByeD0nNCcgZmlsbD0nJTIzMEE2NkMyJy8+PHBhdGggZmlsbD0nd2hpdGUnIGQ9J005LjE5IDE4LjVINi41NFY5Ljg4aDIuNjVWMTguNVptLTEuMzItOS44NGMtLjg1IDAtMS41My0uNjktMS41My0xLjUzcy42OC0xLjUzIDEuNTMtMS41MyAxLjUzLjY5IDEuNTMgMS41My0uNjggMS41My0xLjUzIDEuNTNabTExLjEzIDkuODRoLTIuNjR2LTQuNDJjMC0xLjA1LS4wMi0yLjQtMS40Ni0yLjQtMS40NiAwLTEuNjggMS4xNC0xLjY4IDIuMzJ2NC40OUgxMC4yVjkuODhoMi41M3YxLjE4aC4wNGMuMzUtLjY2IDEuMjEtMS4zNiAyLjQ5LTEuMzYgMi42NiAwIDMuMTYgMS43NSAzLjE2IDQuMDJ2NC43N1onLz48L3N2Zz4=',
  YouTube: 'https://cdn.simpleicons.org/youtube/FF0000',
  Facebook: 'https://cdn.simpleicons.org/facebook/1877F2',
  BlueSky: 'https://cdn.simpleicons.org/bluesky/1A3B55',
};

export const PLATFORM_TIPS: Record<Platform, string[]> = {
  Instagram: [
    'Tier 1 platform — primary investment. Format mix: 50-60% Reels, 25-30% carousels, 15-20% static.',
    'Reels: hook in first 1.5 seconds. Algorithm rewards completion rate and rewatches above all else.',
    'Carousels: lead with a bold claim or question on slide 1. Each slide must justify a swipe.',
    'Saves and shares outweigh likes — design for "I need to save this" or "someone I know needs to see this".',
    'Captions: front-load the hook. Instagram truncates after 2 lines in feed.',
    'Use 3-5 targeted hashtags (niche > popular). Hashtags in caption, not first comment.',
    'Alt text on every image — both for accessibility and Instagram search indexing.',
    'Post Reels during high-engagement windows (test yours via Insights).',
    'Carousel text should be readable without zooming — minimum 24pt on mobile.',
    'Always apply the Golden Thread before posting — would this survive a hostile screenshot?',
  ],
  LinkedIn: [
    'Tier 1 platform — primary investment. Company page reach is ~1.6% of followers. Staff voices get 8-12x distribution.',
    'Document carousels (PDF uploads) get 2-3x the engagement of text-only posts.',
    'Dwell time ("Depth Score") is the highest-weighted signal — write content worth reading slowly.',
    'Substantive comments carry 15x more weight than likes. End posts with questions that invite expertise.',
    'Write in short paragraphs (1-2 sentences each) for skim reading on mobile.',
    'Open with a bold insight, data point, or counterintuitive claim — not "I\'m excited to share".',
    'No hashtags in body text. Add 3-5 relevant hashtags at the end if using them.',
    'External links in posts are deprioritised. Put links in the first comment instead.',
    'Video with captions is increasingly favoured — native upload only, not YouTube links.',
    'Tag relevant people and organisations to expand reach through their networks.',
  ],
  YouTube: [
    'Tier 2 platform — secondary investment. Algorithm now measures viewer satisfaction, not just watch time.',
    'Shorts and long-form are fully decoupled — use both without cannibalisation risk.',
    'YouTube content is cited in 29.5% of Google AI Overviews — treat it as a search engine play.',
    'Dormant channels get a "new creator" boost when reactivated — the algorithm tests reactivated content.',
    'Long-form: front-load the value proposition. First 30 seconds determine if viewers stay.',
    'Add timestamps/chapters for longer videos — improves both UX and search visibility.',
    'Shorts: hook in the first frame. Vertical, under 60 seconds, loopable endings.',
    'Captions/subtitles on all video — both for accessibility and silent browsing.',
    'Optimise title and description for search — include keywords naturally.',
    'End with a clear next step: another video, report link, or subscribe.',
  ],
  Facebook: [
    'Tier 2 platform — secondary investment. Organic reach is ~1.37% of followers. Primarily paid + community.',
    'Shares and saves outweigh likes — a single share outweighs 50 likes as a quality signal.',
    'Video completion rate and watch time are key signals. Native video only — external links are deprioritised.',
    'Content that keeps users on Facebook is rewarded. Avoid external links in the main post.',
    'Comments and authentic interactions matter more than passive reactions.',
    'Facebook Groups are where organic reach still works — engage in relevant communities.',
    'Keep copy short and conversational. Mention the benefit before the ask.',
    'For fundraising content: direct to PM donation tools or Facebook fundraiser features.',
    'Images should be high quality and attention-grabbing in a cluttered feed.',
    'Always apply the Golden Thread — does this pass the coercion, blame, instrumentalisation, and co-option checks?',
  ],
  BlueSky: [
    'Tier 3 platform — experimental/emerging. No single hidden algorithm — multiple feed types.',
    'Following feed is strictly chronological — posting time matters more than on algorithmic platforms.',
    'Discover feed is algorithmic based on your interactions — improving with topic tags.',
    'Custom feeds: subscribe to feeds for climate, reproductive health, UK policy, etc.',
    'No link throttling — URLs to reports, petitions, and articles get full visibility. Material advantage.',
    'No advertising — purely organic reach. Authentic voice matters most.',
    'Stay conversational and lift the strongest statement up front.',
    'Thread format works well for longer arguments — number your posts for clarity.',
    'Engage with the reproductive rights, climate, and policy communities actively.',
    'Would a journalist or researcher find this useful enough to quote or engage with?',
  ],
};

export const PM_PROFILE_IMAGE =
  'https://upload.wikimedia.org/wikipedia/en/thumb/3/35/Population_Matters_logo.png/240px-Population_Matters_logo.png';

export interface PlatformPreviewMeta {
  name: string;
  handle: string;
  accent: string;
  profileUrl: string;
  avatar: string;
}

export const PLATFORM_PREVIEW_META: Record<Platform, PlatformPreviewMeta> = {
  Instagram: {
    name: 'Population Matters',
    handle: '@popnmatters',
    accent: '#F56040',
    profileUrl: 'https://www.instagram.com/popnmatters/',
    avatar:
      'https://www.wikicorporates.org/mediawiki/images/thumb/d/db/Population-Matters-2020.png/250px-Population-Matters-2020.png',
  },
  Facebook: {
    name: 'Population Matters',
    handle: 'facebook.com/PopulationMatters',
    accent: '#1877F2',
    profileUrl: 'https://www.facebook.com/PopulationMatters',
    avatar:
      'https://www.wikicorporates.org/mediawiki/images/thumb/d/db/Population-Matters-2020.png/250px-Population-Matters-2020.png',
  },
  LinkedIn: {
    name: 'Population Matters',
    handle: 'population matters',
    accent: '#0A66C2',
    profileUrl: 'https://www.linkedin.com/company/population-matters/',
    avatar:
      'https://www.wikicorporates.org/mediawiki/images/thumb/d/db/Population-Matters-2020.png/250px-Population-Matters-2020.png',
  },
  BlueSky: {
    name: 'Population Matters',
    handle: '@popnmatters.bsky.social',
    accent: '#1D9BF0',
    profileUrl: 'https://bsky.app/profile/popnmatters.bsky.social',
    avatar:
      'https://www.wikicorporates.org/mediawiki/images/thumb/d/db/Population-Matters-2020.png/250px-Population-Matters-2020.png',
  },
  YouTube: {
    name: 'Population Matters',
    handle: 'PopulationMatters',
    accent: '#FF0000',
    profileUrl: 'https://www.youtube.com/c/populationmatters',
    avatar:
      'https://www.wikicorporates.org/mediawiki/images/thumb/d/db/Population-Matters-2020.png/250px-Population-Matters-2020.png',
  },
};

export interface ManagerEntry {
  name: string;
  email: string;
  team: string;
  reports: string[];
}

/** @deprecated Use buildManagersFromProfiles() with DB profiles instead. Kept as fallback. */
export const DEFAULT_MANAGERS: ManagerEntry[] = [
  {
    name: 'Jameen Kaur',
    email: 'Jameen.Kaur@PopulationMatters.org',
    team: 'Advocacy & Influence',
    reports: ['Daniel Davis', 'Francesca Harrison', 'Madeleine Hewitt', 'Shweta Shirodkar'],
  },
];

export interface VisualIntegrityQuestion {
  key: string;
  label: string;
  description: string;
}

export const VISUAL_INTEGRITY_QUESTIONS: VisualIntegrityQuestion[] = [
  {
    key: 'victimImagery',
    label: 'Victim imagery',
    description:
      'Does this image show suffering, passivity, or disempowerment — rather than agency, strength, or leadership?',
  },
  {
    key: 'anonWithoutContext',
    label: 'Anonymous without context',
    description:
      "Is this an uncredited stock photo or anonymous image where a named individual from PM's partner network could be used instead?",
  },
  {
    key: 'recipientFraming',
    label: 'Recipient framing',
    description:
      "Does this image position our partners as recipients of PM's help, rather than as leaders of their own work?",
  },
];

export const INFLUENCER_STATUSES = [
  'Follow & Observe',
  'Engage Publicly',
  'Build Relationship',
  'Direct Outreach',
  'Collaborate',
] as const;
export type InfluencerStatusType = (typeof INFLUENCER_STATUSES)[number];

export const INFLUENCER_NICHES: string[] = [];
export type InfluencerNiche = string;

export const INFLUENCER_STATUS_COLORS: Record<InfluencerStatusType, string> = {
  'Follow & Observe': 'bg-graystone-100 text-graystone-700',
  'Engage Publicly': 'bg-blue-100 text-blue-700',
  'Build Relationship': 'bg-amber-100 text-amber-700',
  'Direct Outreach': 'bg-emerald-100 text-emerald-700',
  Collaborate: 'bg-purple-100 text-purple-700',
};

// --- Strategy-aligned constants ---

export const AUDIENCE_SEGMENTS = [
  'The Catalysts',
  'The Silently Aware',
  'The Persuadables',
  'The Changemakers',
  'The Anxious Citizens',
  'The Guardians',
  'The Deciders',
  'The Shapers',
  'The Connectors',
  'The Environmentalists',
  'The SRHR Advocates',
] as const;
export type AudienceSegment = (typeof AUDIENCE_SEGMENTS)[number];

export const AUDIENCE_SEGMENT_DESCRIPTIONS: Record<AudienceSegment, string> = {
  'The Catalysts':
    'Gen Z and Millennials (18-35). Intersectional feminists, climate justice activists connecting systemic inequality, reproductive rights, and environmental breakdown.',
  'The Silently Aware':
    'People who privately connect population to climate, housing, public services, cost of living — but stay silent publicly for fear of association with coercive narratives.',
  'The Persuadables':
    "People who care about climate, gender equality, global health, or social justice but haven't yet connected those concerns to population dynamics.",
  'The Changemakers':
    "Partners in communities where PM's grassroots work happens — primarily Nigeria, Kenya, Ethiopia, and India. E2P partners and south-to-south networks.",
  'The Anxious Citizens':
    'People feeling pressure of stretched public services, unaffordable housing, and rising costs. Some drawn toward anti-immigration rhetoric. Highest co-option risk.',
  'The Guardians':
    'Long-term PM supporters, predominantly 55+. The financial engine — donors, members. May be disoriented by the shift to an interlinkages approach.',
  'The Deciders':
    'People with direct power over policy, budgets, and institutional positions. Politicians, civil servants, UN officials. Risk-averse — fear backlash.',
  'The Shapers':
    'Political journalists, think tank researchers, podcast hosts, academics, influential commentators. They frame the conversation decision-makers operate within.',
  'The Connectors':
    'Senior NGO leaders, diplomatic advisors, foundation programme officers, political staffers. They control access to decision-makers and broker relationships.',
  'The Environmentalists':
    'Major environmental NGOs, climate campaigners, conservation organisations working on issues that population dynamics directly affect.',
  'The SRHR Advocates':
    "Reproductive rights organisations, gender equality NGOs, maternal health charities, girls' education campaigns. Rightly cautious about instrumentalisation.",
};

export interface GoldenThreadQuestion {
  key: string;
  label: string;
  description: string;
}

export const GOLDEN_THREAD_QUESTIONS: GoldenThreadQuestion[] = [
  {
    key: 'coercion',
    label: 'Coercion check',
    description:
      'Does this frame population reduction as something done to people, or rights and choices available for people?',
  },
  {
    key: 'blame',
    label: 'Blame check',
    description:
      'Does this blame individuals, communities, or countries for population growth, or does it address systemic failures in access to rights?',
  },
  {
    key: 'instrumentalisation',
    label: 'Instrumentalisation check',
    description:
      'Does this treat women as means to a demographic end, or as people with inherent rights?',
  },
  {
    key: 'cooption',
    label: 'Co-option check',
    description:
      'Could this be screenshot-shared by nationalist, eugenicist, or eco-fascist accounts as supporting their position?',
  },
];

export interface TerminologyEntry {
  neverUse: string;
  useInstead: string;
}

export const TERMINOLOGY_MAP: TerminologyEntry[] = [
  {
    neverUse: 'overpopulation',
    useInstead: 'unsustainable population growth / rapid population growth',
  },
  {
    neverUse: 'population control',
    useInstead: 'voluntary family planning access / reproductive rights',
  },
  {
    neverUse: 'overpopulated countries',
    useInstead: 'countries where rapid population growth compounds existing pressures',
  },
  {
    neverUse: 'too many people',
    useInstead: 'frame around rights, access, empowerment',
  },
  {
    neverUse: 'population stabilisation',
    useInstead: 'rights-based approaches that support sustainable outcomes',
  },
];

export interface QuickAssessmentQuestion {
  key: string;
  label: string;
  description: string;
}

export const QUICK_ASSESSMENT_QUESTIONS: QuickAssessmentQuestion[] = [
  {
    key: 'hook',
    label: 'Hook',
    description: 'Does the first 3 seconds / first slide / first line stop the scroll?',
  },
  {
    key: 'platformFit',
    label: 'Platform fit',
    description: 'Is this created for this specific platform, not just cross-posted?',
  },
  {
    key: 'shareWorthy',
    label: 'Share-worthy',
    description: 'Would someone save this or send it to a friend?',
  },
  {
    key: 'pmVoice',
    label: 'PM Voice',
    description: 'Does this sound like PM — evidence-led, rights-framed, human?',
  },
];

export const FULL_ASSESSMENT_LEVELS = [
  {
    key: 'mission',
    label: 'Mission Alignment',
    description:
      'Golden Thread + Screenshot Test. Must pass — content does not publish if this fails.',
    mustPass: true,
  },
  {
    key: 'platform',
    label: 'Platform Optimisation',
    description: 'Format, length, hooks, hashtags/keywords for selected platform.',
    mustPass: false,
  },
  {
    key: 'engagement',
    label: 'Engagement Quality',
    description: 'Designed for saves/shares/sends, not just likes.',
    mustPass: false,
  },
  {
    key: 'voice',
    label: 'PM Voice & Quality',
    description: 'Terminology, tone, evidence-based, rights-forward.',
    mustPass: false,
  },
  {
    key: 'pillar',
    label: 'Content Pillar Alignment',
    description: 'Clear connection to selected pillar.',
    mustPass: false,
  },
] as const;
