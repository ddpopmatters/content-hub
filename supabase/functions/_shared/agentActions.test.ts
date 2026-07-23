import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import {
  AgentActionError,
  proposeAgentAction,
  stableStringify,
  type AgentActionRecord,
  type AgentActionRepository,
  type CreateAgentActionInput,
} from './agentActions.ts';

const ENTRY_ID = '12345678-1234-4234-9234-123456789abc';
const REPORT_ID = '22345678-1234-4234-9234-123456789abc';
const ACTION_ID = '32345678-1234-4234-9234-123456789abc';

const repository = () => {
  const created: CreateAgentActionInput[] = [];
  const repo: AgentActionRepository & { created: CreateAgentActionInput[] } = {
    created,
    createAction: async (input) => {
      created.push(input);
      return {
        id: ACTION_ID,
        actionType: input.actionType,
        targetId: input.targetId,
        payloadHash: input.payloadHash,
        idempotencyKey: input.idempotencyKey,
        summary: input.summary,
        status: 'proposed',
        expiresAt: input.expiresAt,
        resultClass: null,
        result: null,
        createdAt: '2026-07-19T12:00:00.000Z',
        appliedAt: null,
      } satisfies AgentActionRecord;
    },
    getAction: async () => null,
    executeAction: async () => {
      throw new Error('not used');
    },
    getEntry: async (entryId) =>
      entryId === ENTRY_ID
        ? {
            id: ENTRY_ID,
            workflowStatus: 'Draft',
            contentRevision: 2,
            updatedAt: '2026-07-19T11:00:00.000Z',
            date: '2026-06-10',
          }
        : null,
    getReport: async (reportId) =>
      reportId === REPORT_ID
        ? {
            id: REPORT_ID,
            reportType: 'monthly',
            periodMonth: 6,
            periodYear: 2026,
            updatedAt: '2026-07-19T11:00:00.000Z',
            platformMetrics: {
              Instagram: {
                numberOfPosts: 7,
                accountsReached: 99,
                followersTotal: 4_500,
              },
            },
            agentEvidence: {
              coverage: {
                Instagram: {
                  manual: {
                    accountsReached: 'Legacy saved report, verified 30 June 2026',
                    followersTotal: 'Instagram Insights, 30 June 2026',
                  },
                },
              },
            },
            qualitative: { whatWorked: 'Existing evidence', themes: 'Existing theme' },
          }
        : null,
    getReportingEntries: async () => ({
      rows: [
        {
          id: ENTRY_ID,
          date: '2026-06-10',
          platforms: ['Instagram'],
          status: 'Published',
          analytics: { Instagram: { reach: 120, likes: 0 } },
        },
      ],
      truncated: false,
    }),
  };
  return repo;
};

Deno.test('stable action JSON sorts nested object keys', () => {
  assertEquals(stableStringify({ z: 1, a: { y: 2, b: 3 } }), '{"a":{"b":3,"y":2},"z":1}');
});

Deno.test('report proposals derive metrics and retain named manual sources', async () => {
  const repo = repository();
  const response = await proposeAgentAction(
    {
      actionType: 'create_report',
      idempotencyKey: 'report:2026:06',
      payload: {
        reportType: 'monthly',
        periodMonth: 6,
        periodYear: 2026,
        qualitative: { whatWorked: 'Rights-based stories performed well.' },
        evidenceReferences: [{ entryId: ENTRY_ID, claim: 'Reach evidence' }],
        manualMetrics: {
          Instagram: {
            followersTotal: { value: 5000, source: 'Instagram Insights, 30 June 2026' },
          },
        },
      },
    },
    'pm_hermes',
    repo,
    new Date('2026-07-19T12:00:00.000Z'),
  );
  const payload = repo.created[0].payload;
  const metrics = payload.platformMetrics as Record<string, Record<string, number>>;
  const evidence = payload.evidence as Record<string, unknown>;
  assertEquals(metrics.Instagram.numberOfPosts, 1);
  assertEquals(metrics.Instagram.accountsReached, 120);
  assertEquals(metrics.Instagram.likes, 0);
  assertEquals(metrics.Instagram.followersTotal, 5000);
  assertEquals(
    (response.review as Record<string, unknown>).exactConfirmation,
    `execute ${ACTION_ID}`,
  );
  assertEquals(evidence.source, 'content_hub_entries');
});

Deno.test('report updates preserve qualitative fields not included in the proposal', async () => {
  const repo = repository();
  await proposeAgentAction(
    {
      actionType: 'update_report',
      idempotencyKey: 'report:update:2026:06',
      payload: {
        reportId: REPORT_ID,
        expectedUpdatedAt: '2026-07-19T11:00:00.000Z',
        qualitative: { themes: 'Updated theme' },
      },
    },
    'pm_hermes',
    repo,
    new Date('2026-07-19T12:00:00.000Z'),
  );
  assertEquals(repo.created[0].payload.qualitative, {
    whatWorked: 'Existing evidence',
    themes: 'Updated theme',
  });
  const metrics = repo.created[0].payload.platformMetrics as Record<string, Record<string, number>>;
  assertEquals(repo.created[0].payload.refreshCalculatedMetrics, false);
  assertEquals(metrics.Instagram.numberOfPosts, 7);
  assertEquals(metrics.Instagram.accountsReached, 99);
  assertEquals(metrics.Instagram.followersTotal, 4_500);
  const evidence = repo.created[0].payload.evidence as {
    coverage: Record<string, { manual: Record<string, string> }>;
  };
  assertEquals(
    evidence.coverage.Instagram.manual.followersTotal,
    'Instagram Insights, 30 June 2026',
  );
  assertEquals(repo.created[0].summary.includes('preserve the saved metrics'), true);
});

Deno.test('report updates refresh calculated metrics only when explicitly requested', async () => {
  const repo = repository();
  await proposeAgentAction(
    {
      actionType: 'update_report',
      idempotencyKey: 'report:refresh:2026:06',
      payload: {
        reportId: REPORT_ID,
        expectedUpdatedAt: '2026-07-19T11:00:00.000Z',
        refreshCalculatedMetrics: true,
      },
    },
    'pm_hermes',
    repo,
    new Date('2026-07-19T12:00:00.000Z'),
  );
  const metrics = repo.created[0].payload.platformMetrics as Record<string, Record<string, number>>;
  assertEquals(repo.created[0].payload.refreshCalculatedMetrics, true);
  assertEquals(metrics.Instagram.numberOfPosts, 1);
  assertEquals(metrics.Instagram.accountsReached, 99);
  assertEquals(metrics.Instagram.followersTotal, 4_500);
  const evidence = repo.created[0].payload.evidence as {
    source: string;
    coverage: Record<string, { manual: Record<string, string> }>;
  };
  assertEquals(evidence.source, 'content_hub_entries');
  assertEquals(
    evidence.coverage.Instagram.manual.accountsReached,
    'Legacy saved report, verified 30 June 2026',
  );
  assertEquals(repo.created[0].summary.includes('refresh calculated metrics'), true);
});

Deno.test('proposal validation blocks PM language violations before persistence', async () => {
  const repo = repository();
  await assertRejects(
    () =>
      proposeAgentAction(
        {
          actionType: 'create_entry',
          idempotencyKey: 'draft:unsafe:0001',
          payload: {
            date: '2026-07-20',
            platforms: ['Instagram'],
            caption: 'A claim about population control.',
          },
        },
        'pm_hermes',
        repo,
        new Date('2026-07-19T12:00:00.000Z'),
      ),
    AgentActionError,
  );
  assertEquals(repo.created.length, 0);
});

Deno.test('stale entry state is rejected before an approval proposal is stored', async () => {
  const repo = repository();
  await assertRejects(
    () =>
      proposeAgentAction(
        {
          actionType: 'update_entry',
          idempotencyKey: 'draft:stale:0001',
          payload: {
            entryId: ENTRY_ID,
            expectedContentRevision: 1,
            expectedUpdatedAt: '2026-07-19T11:00:00.000Z',
            changes: { caption: 'A current rights-based caption.' },
          },
        },
        'pm_hermes',
        repo,
        new Date('2026-07-19T12:00:00.000Z'),
      ),
    AgentActionError,
  );
  assertEquals(repo.created.length, 0);
});

Deno.test('entry update proposals retain PostgreSQL timestamp precision', async () => {
  const repo = repository();
  const preciseTimestamp = '2026-07-19T11:00:00.123456+00:00';
  repo.getEntry = async () => ({
    id: ENTRY_ID,
    workflowStatus: 'Draft',
    contentRevision: 2,
    updatedAt: preciseTimestamp,
  });
  await proposeAgentAction(
    {
      actionType: 'update_entry',
      idempotencyKey: 'draft:precise:0001',
      payload: {
        entryId: ENTRY_ID,
        expectedContentRevision: 2,
        expectedUpdatedAt: preciseTimestamp,
        changes: { caption: 'A current rights-based caption.' },
      },
    },
    'pm_hermes',
    repo,
    new Date('2026-07-19T12:00:00.000Z'),
  );
  assertEquals(repo.created[0].payload.expectedUpdatedAt, preciseTimestamp);
});

Deno.test('report evidence outside the exact period is rejected', async () => {
  const repo = repository();
  repo.getEntry = async () => ({ id: ENTRY_ID, date: '2026-05-31' });
  await assertRejects(
    () =>
      proposeAgentAction(
        {
          actionType: 'create_report',
          idempotencyKey: 'report:evidence:0001',
          payload: {
            reportType: 'monthly',
            periodMonth: 6,
            periodYear: 2026,
            evidenceReferences: [{ entryId: ENTRY_ID, claim: 'Reach evidence' }],
          },
        },
        'pm_hermes',
        repo,
        new Date('2026-07-19T12:00:00.000Z'),
      ),
    AgentActionError,
  );
  assertEquals(repo.created.length, 0);
});

Deno.test('campaign reports derive metrics only from the exact campaign query', async () => {
  const repo = repository();
  let selectedCampaign: string | undefined;
  repo.getReportingEntries = async (filters) => {
    selectedCampaign = filters.campaign;
    return { rows: [], truncated: false };
  };
  await proposeAgentAction(
    {
      actionType: 'create_report',
      idempotencyKey: 'report:campaign:0001',
      payload: {
        reportType: 'campaign',
        periodYear: 2026,
        campaignName: 'Choice campaign',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
      },
    },
    'pm_hermes',
    repo,
    new Date('2026-07-19T12:00:00.000Z'),
  );
  assertEquals(selectedCampaign, 'Choice campaign');
  assertEquals(
    (repo.created[0].payload.evidence as Record<string, unknown>).source,
    'content_hub_entries',
  );
});
