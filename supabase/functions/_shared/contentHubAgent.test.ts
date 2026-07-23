import { assertEquals } from 'jsr:@std/assert@1';
import { handleContentHubAgentRequest, type AgentRepository } from './contentHubAgent.ts';
import { AGENT_SIGNATURE_VERSION, buildAgentCanonicalRequest, sha256Hex } from './agentAuth.ts';
import type { AgentActionRecord, AgentActionType } from './agentActions.ts';

const CLIENT_ID = 'pm_hermes';
const SECRET = 'secure-agent-test-secret-with-32-plus-bytes';
const PATH = '/functions/v1/content-hub-agent';

const signedRequest = async (
  payload: Record<string, unknown>,
  nonce = 'nonce_1234567890abcdef',
): Promise<Request> => {
  const body = JSON.stringify(payload);
  const timestamp = '1000000000';
  const canonical = buildAgentCanonicalRequest(
    'POST',
    PATH,
    timestamp,
    nonce,
    await sha256Hex(body),
  );
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = Array.from(
    new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical))),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
  return new Request(`https://example.supabase.co${PATH}`, {
    method: 'POST',
    headers: {
      'x-pm-agent-version': AGENT_SIGNATURE_VERSION,
      'x-pm-agent-client': CLIENT_ID,
      'x-pm-agent-timestamp': timestamp,
      'x-pm-agent-nonce': nonce,
      'x-pm-agent-signature': signature,
    },
    body,
  });
};

const repository = (decision: 'claimed' | 'replayed' | 'rate_limited' = 'claimed') => {
  const completed: string[] = [];
  const action = (actionType: AgentActionType = 'create_entry'): AgentActionRecord => ({
    id: 'action_1234567890abcdef',
    actionType,
    targetId: null,
    payloadHash: 'a'.repeat(64),
    idempotencyKey: 'proposal:12345678',
    summary: 'Create a Draft entry.',
    status: 'proposed',
    expiresAt: '2001-09-09T02:16:40.000Z',
    resultClass: null,
    result: null,
    createdAt: '2001-09-09T01:46:40.000Z',
    appliedAt: null,
  });
  const value: AgentRepository & { completed: string[] } = {
    completed,
    claimRequest: async () => ({
      decision,
      requestId: decision === 'claimed' ? 'request-1' : null,
    }),
    completeRequest: async (_requestId, resultClass) => {
      completed.push(resultClass);
    },
    createAction: async (input) => ({
      ...action(input.actionType),
      targetId: input.targetId,
      payloadHash: input.payloadHash,
      idempotencyKey: input.idempotencyKey,
      summary: input.summary,
      expiresAt: input.expiresAt,
    }),
    getAction: async () => action(),
    executeAction: async () => ({
      decision: 'applied',
      action: { ...action(), status: 'applied' },
    }),
    listEntries: async () => [],
    getEntry: async () => null,
    getReportingEntries: async () => ({ rows: [], truncated: false }),
    listReports: async () => [],
    getReport: async () => null,
    getPublicationStatus: async () => null,
  };
  return value;
};

Deno.test('agent handler returns authenticated health and records success', async () => {
  const request = await signedRequest({ operation: 'health' });
  const repo = repository();
  const response = await handleContentHubAgentRequest(request, {
    auth: { enabled: true, clientId: CLIENT_ID, secret: SECRET, nowSeconds: 1_000_000_100 },
    repository: repo,
    writePolicy: {
      proposalsEnabled: false,
      executionEnabled: false,
      enabledActions: new Set(),
    },
  });
  assertEquals(response.status, 200);
  assertEquals((await response.json()).data.mode, 'read_only');
  assertEquals(repo.completed, ['success']);
});

Deno.test('agent handler rejects replay before domain work', async () => {
  const response = await handleContentHubAgentRequest(
    await signedRequest({ operation: 'health' }),
    {
      auth: { enabled: true, clientId: CLIENT_ID, secret: SECRET, nowSeconds: 1_000_000_100 },
      repository: repository('replayed'),
      writePolicy: {
        proposalsEnabled: false,
        executionEnabled: false,
        enabledActions: new Set(),
      },
    },
  );
  assertEquals(response.status, 409);
  assertEquals((await response.json()).error.code, 'replayed_request');
});

Deno.test('agent handler rejects unavailable operations before request claim', async () => {
  let claimCount = 0;
  const repo = repository();
  repo.claimRequest = async () => {
    claimCount += 1;
    return { decision: 'claimed', requestId: 'request-1' };
  };
  const response = await handleContentHubAgentRequest(
    await signedRequest({ operation: 'run_sql' }),
    {
      auth: { enabled: true, clientId: CLIENT_ID, secret: SECRET, nowSeconds: 1_000_000_100 },
      repository: repo,
      writePolicy: {
        proposalsEnabled: false,
        executionEnabled: false,
        enabledActions: new Set(),
      },
    },
  );
  assertEquals(response.status, 400);
  assertEquals(claimCount, 0);
});

Deno.test('agent handler rejects a streamed oversized body before authentication', async () => {
  const response = await handleContentHubAgentRequest(
    new Request(`https://example.supabase.co${PATH}`, {
      method: 'POST',
      body: 'x'.repeat(32_769),
    }),
    {
      auth: { enabled: true, clientId: CLIENT_ID, secret: SECRET, nowSeconds: 1_000_000_100 },
      repository: repository(),
      writePolicy: {
        proposalsEnabled: false,
        executionEnabled: false,
        enabledActions: new Set(),
      },
    },
  );
  assertEquals(response.status, 413);
  assertEquals((await response.json()).error.code, 'request_too_large');
});

Deno.test('agent handler creates an inert Draft proposal with an exact confirmation', async () => {
  let createCalls = 0;
  const repo = repository();
  repo.createAction = async (input) => {
    createCalls += 1;
    return {
      id: 'action_1234567890abcdef',
      actionType: input.actionType,
      targetId: input.targetId,
      payloadHash: input.payloadHash,
      idempotencyKey: input.idempotencyKey,
      summary: input.summary,
      status: 'proposed',
      expiresAt: input.expiresAt,
      resultClass: null,
      result: null,
      createdAt: '2001-09-09T01:46:40.000Z',
      appliedAt: null,
    };
  };
  const response = await handleContentHubAgentRequest(
    await signedRequest({
      operation: 'propose_action',
      parameters: {
        actionType: 'create_entry',
        idempotencyKey: 'draft:campaign:1234',
        payload: {
          date: '2001-09-10',
          platforms: ['Instagram'],
          caption: 'Access to voluntary family planning supports her choice.',
        },
      },
    }),
    {
      auth: { enabled: true, clientId: CLIENT_ID, secret: SECRET, nowSeconds: 1_000_000_100 },
      repository: repo,
      writePolicy: {
        proposalsEnabled: true,
        executionEnabled: false,
        enabledActions: new Set(['create_entry']),
      },
      now: () => new Date('2001-09-09T01:48:20.000Z'),
    },
  );
  const payload = await response.json();
  assertEquals(response.status, 200);
  assertEquals(createCalls, 1);
  assertEquals(payload.data.action.status, 'proposed');
  assertEquals(payload.data.review.exactConfirmation, 'execute action_1234567890abcdef');
});

Deno.test('agent handler rejects forbidden write fields before proposal storage', async () => {
  let createCalls = 0;
  const repo = repository();
  repo.createAction = async (input) => {
    createCalls += 1;
    throw new Error(String(input));
  };
  const response = await handleContentHubAgentRequest(
    await signedRequest({
      operation: 'propose_action',
      parameters: {
        actionType: 'create_entry',
        idempotencyKey: 'draft:campaign:5678',
        payload: {
          date: '2001-09-10',
          platforms: ['Instagram'],
          caption: 'A safe draft.',
          status: 'Approved',
        },
      },
    }),
    {
      auth: { enabled: true, clientId: CLIENT_ID, secret: SECRET, nowSeconds: 1_000_000_100 },
      repository: repo,
      writePolicy: {
        proposalsEnabled: true,
        executionEnabled: false,
        enabledActions: new Set(['create_entry']),
      },
    },
  );
  assertEquals(response.status, 400);
  assertEquals(createCalls, 0);
});

Deno.test('agent handler keeps execution disabled independently of proposals', async () => {
  const response = await handleContentHubAgentRequest(
    await signedRequest({
      operation: 'execute_action',
      parameters: {
        actionId: 'action_1234567890abcdef',
        payloadHash: 'a'.repeat(64),
        idempotencyKey: 'proposal:12345678',
        approvalReference: 'approval:12345678',
        approvedBy: 'Dan',
      },
    }),
    {
      auth: { enabled: true, clientId: CLIENT_ID, secret: SECRET, nowSeconds: 1_000_000_100 },
      repository: repository(),
      writePolicy: {
        proposalsEnabled: true,
        executionEnabled: false,
        enabledActions: new Set(['create_entry']),
      },
    },
  );
  assertEquals(response.status, 503);
  assertEquals((await response.json()).error.code, 'write_disabled');
});

Deno.test('reporting filters are passed to the bounded repository query', async () => {
  let captured: unknown = {};
  const repo = repository();
  repo.getReportingEntries = async (filters) => {
    captured = filters;
    return { rows: [], truncated: false };
  };
  const response = await handleContentHubAgentRequest(
    await signedRequest({
      operation: 'reporting_snapshot',
      parameters: {
        startDate: '2001-08-01',
        endDate: '2001-08-31',
        platform: 'Instagram',
        campaign: 'Choice campaign',
        contentPillar: 'Reproductive rights',
        assetType: 'Carousel',
      },
    }),
    {
      auth: { enabled: true, clientId: CLIENT_ID, secret: SECRET, nowSeconds: 1_000_000_100 },
      repository: repo,
      writePolicy: {
        proposalsEnabled: false,
        executionEnabled: false,
        enabledActions: new Set(),
      },
    },
  );
  assertEquals(response.status, 200);
  assertEquals(captured, {
    startDate: '2001-08-01',
    endDate: '2001-08-31',
    platform: 'Instagram',
    campaign: 'Choice campaign',
    contentPillar: 'Reproductive rights',
    assetType: 'Carousel',
    limit: 500,
  });
});

Deno.test('enabled execution forwards only the exact approved action binding', async () => {
  const actionId = '12345678-1234-4234-9234-123456789abc';
  let captured: unknown = {};
  const repo = repository();
  repo.getAction = async () => ({
    id: actionId,
    actionType: 'create_entry',
    targetId: null,
    payloadHash: 'a'.repeat(64),
    idempotencyKey: 'proposal:12345678',
    summary: 'Create one Draft entry.',
    status: 'proposed',
    expiresAt: '2001-09-09T02:16:40.000Z',
    resultClass: null,
    result: null,
    createdAt: '2001-09-09T01:46:40.000Z',
    appliedAt: null,
  });
  repo.executeAction = async (input) => {
    captured = input;
    const action = await repo.getAction(input.actionId);
    if (!action) throw new Error('missing action');
    return { decision: 'applied', action: { ...action, status: 'applied' } };
  };
  const response = await handleContentHubAgentRequest(
    await signedRequest({
      operation: 'execute_action',
      parameters: {
        actionId,
        payloadHash: 'a'.repeat(64),
        idempotencyKey: 'proposal:12345678',
        approvalReference: 'cha_1234567890abcdef12345678',
        approvedBy: 'Dan',
      },
    }),
    {
      auth: { enabled: true, clientId: CLIENT_ID, secret: SECRET, nowSeconds: 1_000_000_100 },
      repository: repo,
      writePolicy: {
        proposalsEnabled: true,
        executionEnabled: true,
        enabledActions: new Set(['create_entry']),
      },
    },
  );
  assertEquals(response.status, 200);
  assertEquals(captured, {
    actionId,
    clientId: CLIENT_ID,
    payloadHash: 'a'.repeat(64),
    idempotencyKey: 'proposal:12345678',
    approvalReference: 'cha_1234567890abcdef12345678',
    approvedBy: 'Dan',
  });
});

Deno.test('successful execution survives a later request-ledger completion failure', async () => {
  const actionId = '12345678-1234-4234-9234-123456789abc';
  const repo = repository();
  repo.getAction = async () => ({
    id: actionId,
    actionType: 'create_entry',
    targetId: null,
    payloadHash: 'a'.repeat(64),
    idempotencyKey: 'proposal:12345678',
    summary: 'Create one Draft entry.',
    status: 'proposed',
    expiresAt: '2001-09-09T02:16:40.000Z',
    resultClass: null,
    result: null,
    createdAt: '2001-09-09T01:46:40.000Z',
    appliedAt: null,
  });
  repo.executeAction = async () => {
    const action = await repo.getAction(actionId);
    if (!action) throw new Error('missing action');
    return { decision: 'applied', action: { ...action, status: 'applied' } };
  };
  repo.completeRequest = async () => {
    throw new Error('audit completion unavailable');
  };
  const response = await handleContentHubAgentRequest(
    await signedRequest({
      operation: 'execute_action',
      parameters: {
        actionId,
        payloadHash: 'a'.repeat(64),
        idempotencyKey: 'proposal:12345678',
        approvalReference: 'cha_1234567890abcdef12345678',
        approvedBy: 'Dan',
      },
    }),
    {
      auth: { enabled: true, clientId: CLIENT_ID, secret: SECRET, nowSeconds: 1_000_000_100 },
      repository: repo,
      writePolicy: {
        proposalsEnabled: true,
        executionEnabled: true,
        enabledActions: new Set(['create_entry']),
      },
    },
  );
  const payload = await response.json();
  assertEquals(response.status, 200);
  assertEquals(payload.data.decision, 'applied');
});
