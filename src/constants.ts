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
    { key: 'comments', label: 'Replies' },
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
  ideas: 'ideas',
};

export const PLAN_TAB_ORDER = ['plan', 'ideas', 'requests'] as const;

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
