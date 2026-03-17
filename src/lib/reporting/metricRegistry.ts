import { ALL_PLATFORMS, CONTENT_PILLARS } from '../../constants';
import type { ReportCadence } from '../../types/models';

export type ReportMetricGroup = 'tier1' | 'tier2' | 'tier3';
export type ReportMetricInputType = 'number' | 'percent' | 'text';
export type ReportMetricSourceType = 'auto' | 'manual' | 'aggregated';
export type ReportMetricAggregation = 'sum' | 'average' | 'latest';

export interface ReportMetricDefinition {
  id: string;
  label: string;
  description: string;
  /** Extended guidance shown in the info modal: what the metric means, how to calculate it, where to find it. */
  guidance: string;
  cadence: ReportCadence[];
  group: ReportMetricGroup;
  unit: string;
  inputType: ReportMetricInputType;
  sourceType: ReportMetricSourceType;
  required: boolean;
  leadership: boolean;
  aggregation: ReportMetricAggregation;
}

export const REPORT_METRIC_REGISTRY: ReportMetricDefinition[] = [
  {
    id: 'nativeShares',
    label: 'Native shares',
    description: 'Combined reposts and shares captured on platform posts.',
    guidance:
      'Auto-calculated from post analytics logged in Content Hub. Counts all shares and reposts across posts in the period.\n\nSources by platform:\n• Instagram: Reposts field in post analytics\n• LinkedIn: Reposts/Shares\n• YouTube: Shares\n• Facebook: Shares\n• BlueSky: Reposts\n\nLog post-level analytics first using "Log post metrics" to populate this automatically. Native shares are the strongest distribution signal — they indicate content is travelling beyond your existing audience.',
    cadence: ['Weekly', 'Monthly', 'Quarterly', 'Annual'],
    group: 'tier1',
    unit: 'count',
    inputType: 'number',
    sourceType: 'auto',
    required: true,
    leadership: true,
    aggregation: 'sum',
  },
  {
    id: 'privateSends',
    label: 'Private sends',
    description: 'Private shares or sends where the platform exposes them.',
    guidance:
      'Auto-calculated from post analytics where platforms expose this data.\n\nInstagram is the primary source: DM sends appear in Instagram Insights under each post\'s interaction breakdown ("Sends"). This is the #1 ranking signal per Adam Mosseri (January 2026).\n\nLinkedIn and Facebook do not reliably expose private send data, so this metric will largely reflect Instagram activity.\n\nIf the value looks low, check that you have logged Instagram post metrics for the period using "Log post metrics".',
    cadence: ['Weekly', 'Monthly', 'Quarterly', 'Annual'],
    group: 'tier1',
    unit: 'count',
    inputType: 'number',
    sourceType: 'auto',
    required: true,
    leadership: true,
    aggregation: 'sum',
  },
  {
    id: 'engagementRate',
    label: 'Engagement rate',
    description: 'Engagements divided by reach, expressed as a percentage.',
    guidance:
      'Auto-calculated. Formula: total engagements (likes + comments + shares + saves + clicks) ÷ total reach × 100.\n\nPopulated from post-level analytics logged in Content Hub.\n\nPlatform benchmarks:\n• Instagram: target 0.75–1.50% (sector average 0.48%)\n• LinkedIn: target 3–4% (sector average 1.91%)\n• Facebook: target 0.10–0.25% (sector average 0.046%)\n• YouTube Shorts: target 4–6% (sector average 5.91%)\n• BlueSky: track quality over rate — focus on who is engaging\n\nThis uses the standard cross-platform formula (engagements ÷ reach). Platform-native dashboards may show a different figure because they include different signals.',
    cadence: ['Weekly', 'Monthly', 'Quarterly', 'Annual'],
    group: 'tier1',
    unit: '%',
    inputType: 'percent',
    sourceType: 'auto',
    required: true,
    leadership: true,
    aggregation: 'average',
  },
  {
    id: 'employeeAdvocacyReach',
    label: 'Employee advocacy reach',
    description: 'Reach generated through staff amplification and advocacy.',
    guidance:
      'Manual entry. Ask each team member who shared PM content during the period to report their post impressions from LinkedIn analytics. Sum across all staff posts.\n\nTarget: 5× the company page reach for the same period. Staff posts receive 561% more reach than company page posts on average.\n\nHow to collect: at the end of each month, ask staff who posted on LinkedIn to check their post analytics (tap the "impressions" figure under each post) and share the total with you.\n\nIf your organisation uses LinkedIn\'s Employee Advocacy feature, the aggregate reach figure is available directly in your Page analytics dashboard.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier1',
    unit: 'count',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: true,
    aggregation: 'sum',
  },
  {
    id: 'audienceQualityScore',
    label: 'Audience quality score',
    description: 'Periodic health score for target audience fit and quality.',
    guidance:
      "Manual entry. Score 1–10 based on a 50-account audit.\n\nHow to conduct the audit:\n1. On each platform, identify the 50 most engaged accounts in the period (commenters, sharers, saves where visible)\n2. Categorise each account against PM's audience segments:\n   • Deciders: policymakers, civil servants, parliamentary staff\n   • Connectors: NGO leaders, foundation staff, INGO programme leads\n   • Shapers: researchers, academics, think-tank staff\n   • Catalysts: 18–35, engaged with climate, gender, or rights content\n   • Guardians: 55+, long-tenure supporters\n3. Count what proportion match PM's target segments\n\nScoring guide:\n• 8–10: most engaged accounts match target segments\n• 5–7: mixed picture, some target audience but also mismatched accounts\n• Below 5: reaching the wrong audiences — review content strategy\n\nRun the full audit quarterly. For monthly scoring, use a lighter check on the top 10–15 accounts plus platform follower demographics.",
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier1',
    unit: 'score',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: true,
    aggregation: 'average',
  },
  {
    id: 'engagementQuality',
    label: 'Engagement quality',
    description: 'Weighted score for comments, saves, shares, and meaningful interactions.',
    guidance:
      'Auto-calculated. Formula: (shares × 3 + saves × 3 + comments × 2) ÷ total posts.\n\nHigher weights are applied to saves and shares because they indicate content travelling beyond the existing audience or being treated as a reference resource. Comments are weighted above likes because they require active intent. Likes are excluded entirely as a passive signal.\n\nThe score is normalised by total posts, so it trends meaningfully month-on-month regardless of posting volume. A rising score means content depth is improving even if raw totals stay flat.\n\nPopulated automatically from post-level analytics logged in Content Hub.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'score',
    inputType: 'number',
    sourceType: 'auto',
    required: true,
    leadership: false,
    aggregation: 'average',
  },
  {
    id: 'sentimentScore',
    label: 'Sentiment score',
    description: 'Manual summary score for audience sentiment over the period.',
    guidance:
      'Manual entry. Score 1–10 based on a qualitative review of comments and replies across all platforms.\n\nScoring guide:\n• 8–10: overwhelmingly positive, supportive, and on-mission\n• 5–7: mixed — some friction or off-topic engagement but broadly constructive\n• Below 5: significant negative sentiment or hostile engagement patterns\n\nWhat to check:\n• Facebook: review Angry reaction counts and hostile comments\n• BlueSky: read reply threads for tone, especially on counter-disinformation posts\n• LinkedIn: scan comments for critical or dismissive responses\n• Instagram: check comment quality on high-reach posts\n\nCapture notable specific comments (positive or negative) in the Sentiment Summary narrative field to give the score context for anyone reading the report.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'score',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'average',
  },
  {
    id: 'saves',
    label: 'Saves',
    description: 'Total saves/bookmarks across supported platforms.',
    guidance:
      'Auto-calculated from post analytics logged in Content Hub.\n\nWhere saves are available by platform:\n• Instagram: "Saves" in post Insights — available for all post types\n• Facebook: "Saves" available on most post types in Insights\n• LinkedIn: no native save metric exposed in analytics\n• YouTube: no save/bookmark metric in analytics\n• BlueSky: no save metric\n\nA rising save rate signals that content is being bookmarked for later reference — a strong indicator that it is perceived as valuable rather than just scroll-stopping. Instagram treats saves as a high-quality signal in its distribution algorithm.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'count',
    inputType: 'number',
    sourceType: 'auto',
    required: true,
    leadership: false,
    aggregation: 'sum',
  },
  {
    id: 'completionRate',
    label: 'Completion rate',
    description: 'Video completion rate or equivalent watch-through metric.',
    guidance:
      'Manual entry. Average video completion rate across short-form and long-form video content for the period.\n\nHow to find it by platform:\n• Instagram Reels: Insights → individual Reel → "Avg watch time" ÷ Reel length × 100, or check "Plays" vs "Reach" as a proxy\n• YouTube: YouTube Studio → Content tab → individual video → "Average view duration" ÷ video length × 100\n• Facebook: Insights → Videos → compare "1-minute views" to "3-second views" as a proxy\n• LinkedIn: not available for video\n• TikTok (if used): Analytics → Video → "Average watch time"\n\nTargets:\n• Short-form (under 60s): 50%+\n• Long-form: 40%+\n\nIf completion rate is consistently low, review the hook (first 3 seconds) and whether the thumbnail/title accurately sets expectations for what the video delivers.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: '%',
    inputType: 'percent',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'average',
  },
  {
    id: 'quotePosts',
    label: 'Quote posts',
    description: 'Count of quote-post or repost-with-comment executions.',
    guidance:
      'Manual entry. Count of quote-posts and commented reposts on BlueSky and LinkedIn during the period.\n\nWhere to find it:\n• BlueSky: quote count is visible directly under each post (the speech-bubble-with-arrow icon). Check your most-seen posts for the period.\n• LinkedIn: post analytics → "Reposts" includes both silent reposts and commented reposts. Use the full reposts figure unless the breakdown is available.\n\nThis metric is most meaningful on BlueSky, where researchers, journalists, and policymakers actively quote-post to add commentary to content they find credible. A quote-post from a credible account in PM\'s target audience segments is worth more than ten standard reposts — it amplifies into a new network with an endorsement attached.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'count',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'sum',
  },
  {
    id: 'websiteTrafficFromSocial',
    label: 'Website traffic from social',
    description: 'Sessions or visits attributed to social traffic.',
    guidance:
      'Manual entry. Find in Google Analytics 4.\n\nHow to find it:\n1. GA4 → Acquisition → Traffic Acquisition\n2. Filter by "Session source / medium" containing your social UTM sources: instagram/organic, linkedin/organic, facebook/organic, youtube/organic, bluesky/organic\n3. Sum sessions across all social sources for the reporting period\n\nImportant caveat: this figure materially undercounts the true contribution due to dark social. If you see a spike in "Direct" traffic to a specific promoted URL during the same period, note it in the narrative — it is very likely dark social attribution. Nobody manually types a long URL.\n\nTarget: 4–8% of total site traffic. Do not treat this as a primary success metric for organic social — it is an operational indicator.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'count',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'sum',
  },
  {
    id: 'emailSignUps',
    label: 'Email sign-ups',
    description: 'New email subscribers attributed to social activity.',
    guidance:
      'Manual entry. Check new subscriber source data for the period.\n\nWhere to find it:\n• Email platform (Mailchimp, Klaviyo, etc.): check subscriber growth report → filter by source or acquisition channel → look for social referrals\n• GA4: if email sign-up events are tagged, check Conversions → filter by utm_source matching your social platforms\n• "How did you hear about us?" responses: if your sign-up form includes this field, include self-reported social referrals in the count\n\nThis is an upper-funnel conversion metric — organic social builds awareness that feeds sign-ups over time, but the last-click attribution will often credit email, search, or direct traffic. The trend over time matters more than the absolute monthly figure.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'count',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'sum',
  },
  {
    id: 'donationPageVisits',
    label: 'Donation page visits',
    description: 'Visits to donation pages from social channels.',
    guidance:
      'Manual entry. Find in Google Analytics 4.\n\nHow to find it:\n1. GA4 → Engagement → Pages and Screens\n2. Filter by the donation page URL\n3. Cross-reference with Session source containing your social UTM values\n\nAlternatively: GA4 → Acquisition → Traffic Acquisition → filter by social sources → look at which pages these sessions landed on or navigated to.\n\nContext: this measures intent visits, not donation completions. Organic social is upper-funnel — a supporter may see a campaign post, visit the donation page, leave, and donate three weeks later via a Google search. Last-click attribution gives social zero credit for that donation. A spike in donation page visits following a campaign post is meaningful evidence of contribution even without a completed conversion.',
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'count',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'sum',
  },
  {
    id: 'ctr',
    label: 'CTR',
    description: 'Click-through rate using tracked clicks and impressions.',
    guidance:
      "Auto-calculated. Formula: total clicks ÷ total impressions × 100.\n\nPopulated from post-level analytics logged in Content Hub.\n\nImportant context by platform:\n• LinkedIn: primary source — link clicks are tracked reliably\n• Facebook: link clicks available in Insights\n• Instagram: does not allow links in posts (bio link only), so Instagram's contribution to CTR will be near zero unless you are measuring Stories swipe-ups or link stickers\n• YouTube: click-through from end screens and cards is available in YouTube Studio\n• BlueSky: links are not throttled, making CTR here more reliable than on other platforms\n\nTarget: 1%+ for organic posts containing external links. Only interpret CTR for posts where a link was included — posts without links will artificially lower the average.",
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: '%',
    inputType: 'percent',
    sourceType: 'auto',
    required: true,
    leadership: false,
    aggregation: 'average',
  },
  {
    id: 'advocacyActionCompletions',
    label: 'Advocacy action completions',
    description: 'Actions taken via petitions, emails, or campaign tools.',
    guidance:
      "Manual entry. Sum all measurable advocacy actions taken during the period that are attributable to or running alongside social media activity.\n\nAction types to include:\n• Petition signatures (Change.org, 38 Degrees, PM's own tool)\n• Email-to-MP completions (WriteToThem or equivalent)\n• Event registrations from social referrals\n• Consultation response submissions\n• Report or briefing downloads (if tracked as an action)\n\nHow to find source data:\n• Check each advocacy platform's admin dashboard for completions in the period\n• In GA4: if actions are tagged as conversion events, filter by social UTM sources\n• Where possible, track by action type and note the breakdown in the Advocacy Commentary narrative field\n\nDistinguish from fundraising conversions, which are tracked separately via donation page visits.",
    cadence: ['Monthly', 'Quarterly', 'Annual'],
    group: 'tier2',
    unit: 'count',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'sum',
  },
  {
    id: 'followerGrowth',
    label: 'Follower growth',
    description: 'Net audience growth over the reporting period.',
    guidance:
      'Manual entry. Net new followers across all active platforms for the period.\n\nWhere to find it:\n• Instagram: Insights → Audience → Followers → net change for the period\n• LinkedIn: Page Analytics → Followers → follower growth graph → net new followers\n• YouTube: YouTube Studio → Analytics → Audience tab → subscribers gained minus subscribers lost\n• Facebook: Insights → Followers → net follower change for the period\n• BlueSky: check your follower count at the start and end of the period (no built-in analytics — use a note or screenshot at the start of each month)\n\nRecord total net new followers across all platforms combined.\n\nRate of growth matters more than absolute numbers. A smaller account growing at 3% per month is on a stronger trajectory than a larger account growing at 0.5%.',
    cadence: ['Quarterly', 'Annual'],
    group: 'tier3',
    unit: 'count',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'sum',
  },
  {
    id: 'reachGrowth',
    label: 'Reach growth',
    description: 'Growth in reach versus the prior comparable period.',
    guidance:
      'Manual entry. Percentage change in total reach compared to the equivalent prior period.\n\nFormula: (current period reach − prior period reach) ÷ prior period reach × 100\n\nHow to calculate:\n1. Note the "Total reach" figure in the Derived Breakdowns section of this report\n2. Open the equivalent report from the prior comparable period (same quarter last year for quarterly reports; same month last year for monthly)\n3. Apply the formula above\n\nUse year-on-year comparisons rather than sequential periods where possible — seasonal content patterns mean month-on-month comparisons can mislead (e.g. December is always lower than November).\n\nA positive percentage means you are reaching more unique accounts than the same period previously.',
    cadence: ['Quarterly', 'Annual'],
    group: 'tier3',
    unit: '%',
    inputType: 'percent',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'average',
  },
  {
    id: 'postingConsistency',
    label: 'Posting consistency',
    description: 'How consistently the team hit planned publishing cadence.',
    guidance:
      'Auto-calculated. Formula: unique days with at least one published or approved post ÷ total days in the period × 100.\n\nThis is a floor measure — it tells you whether anything was posted on a given day, not whether the full planned cadence per channel was met. A score of 100% means there was no day in the period with zero posts, but does not mean every channel hit its target frequency.\n\nFor a fuller picture, compare against channel strategy targets in the narrative:\n• Instagram: 5×/week\n• LinkedIn: 3–4×/week\n• Facebook: 3–4×/week\n• YouTube: 1–2×/month (long-form), more for Shorts\n• BlueSky: reactive + 3–5×/week\n\nAlgorithms on Instagram and LinkedIn actively reward consistent posting — gaps of more than 3–4 days can reduce organic reach in the following week.',
    cadence: ['Quarterly', 'Annual'],
    group: 'tier3',
    unit: '%',
    inputType: 'percent',
    sourceType: 'auto',
    required: true,
    leadership: false,
    aggregation: 'average',
  },
  {
    id: 'responseTimeHours',
    label: 'Average response time',
    description: 'Average time to respond to comments or DMs.',
    guidance:
      'Manual entry. Average hours to respond to comments and DMs across platforms for the period.\n\nWhere to find it:\n• Instagram + Facebook: Meta Business Suite → Inbox → shows average response time and response rate for DMs. For comments, review manually or estimate from timestamps.\n• LinkedIn: Page admin → Messaging → review response timestamps manually\n• BlueSky: review reply timestamps on your posts\n• YouTube: no built-in response time analytics — estimate from comment timestamps\n\nTargets:\n• General comments: under 24 hours\n• DMs from journalists, policymakers, or partners: under 4 hours\n\nIf response time is consistently high, review whether inbox monitoring is part of the daily workflow and whether Meta Business Suite notifications are enabled.',
    cadence: ['Quarterly', 'Annual'],
    group: 'tier3',
    unit: 'hours',
    inputType: 'number',
    sourceType: 'manual',
    required: true,
    leadership: false,
    aggregation: 'average',
  },
];

export const REPORT_QUALITATIVE_FIELDS: Record<
  ReportCadence,
  { id: string; label: string; description: string }[]
> = {
  Weekly: [
    {
      id: 'wins',
      label: 'Wins this week',
      description: 'Short summary of wins or positive movement.',
    },
    { id: 'risks', label: 'Risks this week', description: 'Known issues or attention points.' },
    { id: 'nextActions', label: 'Next actions', description: 'Immediate next steps for the team.' },
  ],
  Monthly: [
    {
      id: 'executiveSummary',
      label: 'Executive summary',
      description: 'Monthly summary for leadership.',
    },
    {
      id: 'notableMoments',
      label: 'Notable moments',
      description: 'Campaign moments, spikes, or lessons.',
    },
    { id: 'wins', label: 'Top wins', description: 'What worked best this month.' },
    { id: 'risks', label: 'Watchouts', description: 'Performance or delivery concerns.' },
    { id: 'nextActions', label: 'Next actions', description: 'Actions for the upcoming month.' },
    {
      id: 'audienceQualityNotes',
      label: 'Audience quality notes',
      description: 'Audience fit and quality observations.',
    },
    {
      id: 'sentimentSummary',
      label: 'Sentiment summary',
      description: 'Tone and sentiment overview.',
    },
    {
      id: 'topContentNotes',
      label: 'Top content notes',
      description: 'Context on the strongest posts.',
    },
    {
      id: 'bottomContentNotes',
      label: 'Bottom content notes',
      description: 'Context on underperforming posts.',
    },
    {
      id: 'contentPillarNotes',
      label: 'Content pillar review',
      description: 'How pillar mix supported strategy.',
    },
    {
      id: 'audienceSegmentNotes',
      label: 'Audience segment review',
      description: 'How well posts served target segments.',
    },
  ],
  Quarterly: [
    {
      id: 'executiveSummary',
      label: 'Quarterly summary',
      description: 'Quarterly strategic overview.',
    },
    {
      id: 'notableMoments',
      label: 'Quarterly notable moments',
      description: 'Events, peaks, and important shifts.',
    },
    { id: 'wins', label: 'Quarterly wins', description: 'What created the strongest result.' },
    { id: 'risks', label: 'Quarterly risks', description: 'Risks or weak spots in the quarter.' },
    {
      id: 'nextActions',
      label: 'Strategic next actions',
      description: 'Actions for the next quarter.',
    },
    {
      id: 'audienceQualityNotes',
      label: 'Audience quality notes',
      description: 'Audience fit observations and account quality.',
    },
    {
      id: 'sentimentSummary',
      label: 'Sentiment summary',
      description: 'Quarter-level audience sentiment.',
    },
    {
      id: 'platformHealthCommentary',
      label: 'Platform health commentary',
      description: 'Platform-by-platform health summary.',
    },
    {
      id: 'quarterlyAuditNotes',
      label: '50-account audience audit',
      description: 'Quarterly quality audit notes.',
    },
    {
      id: 'contentPillarNotes',
      label: 'Content pillar review',
      description: 'How pillar mix supported strategy.',
    },
    {
      id: 'audienceSegmentNotes',
      label: 'Audience segment review',
      description: 'How well posts served target segments.',
    },
    {
      id: 'advocacyCommentary',
      label: 'Advocacy commentary',
      description: 'Interpretation of advocacy and action data.',
    },
  ],
  Annual: [
    {
      id: 'executiveSummary',
      label: 'Annual summary',
      description: 'Annual leadership-ready overview.',
    },
    { id: 'wins', label: 'Annual wins', description: 'Major wins across the year.' },
    { id: 'risks', label: 'Annual risks', description: 'Structural or strategic risks.' },
    {
      id: 'nextActions',
      label: 'Next-year priorities',
      description: 'Priorities for the next reporting cycle.',
    },
    {
      id: 'annualReflection',
      label: 'Annual reflection',
      description: 'Overall reflection on the year.',
    },
    {
      id: 'platformHealthCommentary',
      label: 'Platform health commentary',
      description: 'Year-end platform health summary.',
    },
    {
      id: 'contentPillarNotes',
      label: 'Content pillar review',
      description: 'How pillar mix evolved over the year.',
    },
    {
      id: 'audienceSegmentNotes',
      label: 'Audience segment review',
      description: 'How audience targeting evolved over the year.',
    },
  ],
};

export const getMetricDefinitionsForCadence = (cadence: ReportCadence): ReportMetricDefinition[] =>
  REPORT_METRIC_REGISTRY.filter((metric) => metric.cadence.includes(cadence));

export const getMetricDefinitionsForGroup = (
  cadence: ReportCadence,
  group: ReportMetricGroup,
): ReportMetricDefinition[] =>
  getMetricDefinitionsForCadence(cadence).filter((metric) => metric.group === group);

export const getMetricDefinition = (metricId: string): ReportMetricDefinition | undefined =>
  REPORT_METRIC_REGISTRY.find((metric) => metric.id === metricId);

export const REPORT_PLATFORM_SUMMARY_KEYS = [
  'posts',
  'reach',
  'impressions',
  'engagements',
] as const;

export const REPORT_DERIVED_TOTAL_KEYS = [
  'totalPosts',
  'totalPublishedPosts',
  'totalReach',
  'totalImpressions',
  'totalEngagements',
  'coverageScore',
] as const;

export const REPORT_PLATFORM_LIST = [...ALL_PLATFORMS];
export const REPORT_CONTENT_PILLAR_LIST = [...CONTENT_PILLARS];
