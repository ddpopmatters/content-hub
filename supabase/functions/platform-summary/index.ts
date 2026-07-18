import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') ?? 'https://ddpopmatters.github.io/content-hub/';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

type CountTone = 'neutral' | 'attention' | 'positive';
type ActionKind = 'open' | 'review' | 'create';

type PlatformSummaryResponse = {
  currentStatus: string;
  notes: string[];
  primaryActions: Array<{
    label: string;
    href: string;
    kind: ActionKind;
  }>;
  headlineCounts: Array<{
    label: string;
    value: number | null;
    tone: CountTone;
  }>;
  generatedAt: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const getServiceClient = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const buildAppUrl = (path: string) => new URL(path, APP_URL).toString();

async function fetchCount(
  supabase: ReturnType<typeof getServiceClient>,
  table: string,
  configure?: (
    query: ReturnType<ReturnType<typeof getServiceClient>['from']>['select'],
  ) => ReturnType<ReturnType<typeof getServiceClient>['from']>['select'],
): Promise<number | null> {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (configure) {
    query = configure(query);
  }

  const { count, error } = await query;
  if (error) {
    console.error(`Failed to count ${table}:`, error.message);
    return null;
  }

  return typeof count === 'number' ? count : 0;
}

function buildSummary(payload: {
  activeEntries: number | null;
  pendingRequests: number | null;
  activeConnections: number | null;
  activeUsers: number | null;
}): PlatformSummaryResponse {
  const { activeEntries, pendingRequests, activeConnections, activeUsers } = payload;
  const hasAttention = typeof pendingRequests === 'number' && pendingRequests > 0;

  return {
    currentStatus: hasAttention ? 'review-queue-active' : 'canonical',
    notes: [
      'Content Hub remains the specialist content operations workspace.',
      hasAttention
        ? 'There is live review demand in the content request queue.'
        : 'No outstanding content request queue pressure is currently reported.',
      'Platform alignment should continue through shared access and registry contracts rather than backend consolidation.',
    ],
    primaryActions: [
      { label: 'Open dashboard', href: buildAppUrl('/#dashboard'), kind: 'open' },
      { label: 'Open approvals', href: buildAppUrl('/#approvals'), kind: 'review' },
      { label: 'Create content', href: buildAppUrl('/#create'), kind: 'create' },
    ],
    headlineCounts: [
      {
        label: 'Active entries',
        value: activeEntries,
        tone: activeEntries && activeEntries > 0 ? 'positive' : 'neutral',
      },
      {
        label: 'Pending requests',
        value: pendingRequests,
        tone: hasAttention ? 'attention' : 'neutral',
      },
      {
        label: 'Active channels',
        value: activeConnections,
        tone: activeConnections && activeConnections > 0 ? 'positive' : 'neutral',
      },
      {
        label: 'Active users',
        value: activeUsers,
        tone: activeUsers && activeUsers > 0 ? 'positive' : 'neutral',
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabase = getServiceClient();

    const [activeEntries, pendingRequests, activeConnections, activeUsers] = await Promise.all([
      fetchCount(supabase, 'entries', (query) => query.is('deleted_at', null)),
      fetchCount(supabase, 'content_requests', (query) =>
        query.in('status', ['Pending', 'In Progress']),
      ),
      fetchCount(supabase, 'platform_connections', (query) => query.eq('is_active', true)),
      fetchCount(supabase, 'user_profiles', (query) => query.eq('status', 'active')),
    ]);

    return json(
      buildSummary({
        activeEntries,
        pendingRequests,
        activeConnections,
        activeUsers,
      }),
    );
  } catch (error) {
    console.error('Failed to generate platform summary:', error);
    return json({ error: 'Failed to generate platform summary.' }, 500);
  }
});
