import type { AgentAuthConfig } from './agentAuth.ts';
import { MAX_AGENT_BODY_BYTES, verifyAgentRequest } from './agentAuth.ts';
import {
  buildReportingSnapshot,
  compareSavedReports,
  REPORTING_PLATFORMS,
  type ReportingEntryRow,
  type ReportingPlatform,
} from './agentReporting.ts';
import {
  AgentActionError,
  getPublicAgentAction,
  parseActionHash,
  parseActionId,
  parseApprovalReference,
  parseApprovedBy,
  parseIdempotencyKey,
  proposeAgentAction,
  type AgentActionRepository,
  type AgentWritePolicy,
} from './agentActions.ts';

export const CONTENT_HUB_AGENT_CONTRACT = 'content-hub-agent-v1';

const OPERATIONS = [
  'health',
  'list_entries',
  'get_entry',
  'calendar_summary',
  'reporting_snapshot',
  'list_reports',
  'get_report',
  'compare_reports',
  'publication_status',
  'propose_action',
  'get_action',
  'execute_action',
] as const;

export type AgentOperation = (typeof OPERATIONS)[number];
type ResultClass =
  | 'success'
  | 'invalid_request'
  | 'not_found'
  | 'conflict'
  | 'unavailable'
  | 'internal_error';

export interface EntryFilters {
  startDate?: string;
  endDate?: string;
  platform?: ReportingPlatform;
  workflowStatus?: string;
  campaign?: string;
  limit: number;
}

export interface ReportingFilters {
  startDate: string;
  endDate: string;
  platform?: ReportingPlatform;
  campaign?: string;
  contentPillar?: string;
  assetType?: string;
  limit: number;
}

export interface ReportFilters {
  reportType?: 'monthly' | 'quarterly' | 'annual' | 'campaign';
  year?: number;
  limit: number;
}

export interface AgentRepository extends AgentActionRepository {
  claimRequest(input: {
    clientId: string;
    nonce: string;
    capability: AgentOperation;
    payloadHash: string;
  }): Promise<{ decision: 'claimed' | 'replayed' | 'rate_limited'; requestId: string | null }>;
  completeRequest(requestId: string, resultClass: ResultClass): Promise<void>;
  listEntries(filters: EntryFilters): Promise<Record<string, unknown>[]>;
  getEntry(entryId: string): Promise<Record<string, unknown> | null>;
  getReportingEntries(
    filters: ReportingFilters,
  ): Promise<{ rows: ReportingEntryRow[]; truncated: boolean }>;
  listReports(filters: ReportFilters): Promise<Record<string, unknown>[]>;
  getReport(reportId: string): Promise<Record<string, unknown> | null>;
  getPublicationStatus(entryId: string): Promise<Record<string, unknown> | null>;
}

export interface ContentHubAgentDependencies {
  auth: AgentAuthConfig;
  repository: AgentRepository;
  writePolicy: AgentWritePolicy;
  now?: () => Date;
}

const responseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const jsonResponse = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders });

const errorResponse = (status: number, code: string, message: string): Response =>
  jsonResponse(status, { ok: false, error: { code, message } });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isOperation = (value: unknown): value is AgentOperation =>
  typeof value === 'string' && (OPERATIONS as readonly string[]).includes(value);

const stringParameter = (
  parameters: Record<string, unknown>,
  key: string,
  maxLength: number,
): string | undefined => {
  const value = parameters[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > maxLength) throw new Error(`invalid ${key}`);
  return value;
};

const integerParameter = (
  parameters: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number => {
  const value = parameters[key];
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`invalid ${key}`);
  }
  return Number(value);
};

const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const dateParameter = (parameters: Record<string, unknown>, key: string): string | undefined => {
  const value = stringParameter(parameters, key, 10);
  if (value !== undefined && !isIsoDate(value)) throw new Error(`invalid ${key}`);
  return value;
};

const dateRange = (
  parameters: Record<string, unknown>,
  now: Date,
  defaultDays: number,
  maximumDays: number,
): { startDate: string; endDate: string } => {
  const defaultEnd = now.toISOString().slice(0, 10);
  const defaultStartDate = new Date(now);
  defaultStartDate.setUTCDate(defaultStartDate.getUTCDate() - defaultDays + 1);
  const startDate =
    dateParameter(parameters, 'startDate') ?? defaultStartDate.toISOString().slice(0, 10);
  const endDate = dateParameter(parameters, 'endDate') ?? defaultEnd;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days < 1 || days > maximumDays) throw new Error('invalid date range');
  return { startDate, endDate };
};

const platformParameter = (parameters: Record<string, unknown>): ReportingPlatform | undefined => {
  const value = stringParameter(parameters, 'platform', 20);
  if (!value) return undefined;
  const match = REPORTING_PLATFORMS.find(
    (platform) => platform.toLowerCase() === value.toLowerCase(),
  );
  if (!match) throw new Error('invalid platform');
  return match;
};

const idParameter = (parameters: Record<string, unknown>, key: string): string => {
  const value = stringParameter(parameters, key, 64);
  if (!value || !/^[A-Za-z0-9_-]{6,64}$/.test(value)) throw new Error(`invalid ${key}`);
  return value;
};

const buildCalendarSummary = (
  entries: Record<string, unknown>[],
  startDate: string,
  endDate: string,
): Record<string, unknown> => {
  const byStatus: Record<string, number> = {};
  const byPlatform: Record<string, number> = {};
  const byDate: Record<string, number> = {};
  for (const entry of entries) {
    const status = typeof entry.workflowStatus === 'string' ? entry.workflowStatus : 'Unknown';
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    const date = typeof entry.date === 'string' ? entry.date : null;
    if (date) byDate[date] = (byDate[date] ?? 0) + 1;
    if (Array.isArray(entry.platforms)) {
      for (const platform of entry.platforms) {
        if (typeof platform === 'string') byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
      }
    }
  }
  return {
    startDate,
    endDate,
    totalEntries: entries.length,
    byStatus,
    byPlatform,
    byDate,
    entries,
  };
};

const authFailureStatus = (code: string): number => {
  if (code === 'integration_disabled' || code === 'invalid_configuration') return 503;
  if (code === 'request_too_large') return 413;
  return 401;
};

const readBoundedBody = async (request: Request): Promise<string | null> => {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > MAX_AGENT_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
};

const successResponse = (operation: AgentOperation, data: unknown): Response =>
  jsonResponse(200, {
    ok: true,
    contractVersion: CONTENT_HUB_AGENT_CONTRACT,
    operation,
    dataClassification: 'untrusted_application_data',
    data,
  });

async function dispatchOperation(
  operation: AgentOperation,
  parameters: Record<string, unknown>,
  clientId: string,
  dependencies: ContentHubAgentDependencies,
): Promise<{ response: Response; resultClass: ResultClass }> {
  const now = (dependencies.now ?? (() => new Date()))();
  const repository = dependencies.repository;
  if (operation === 'health') {
    return {
      response: successResponse(operation, {
        ready: true,
        mode: dependencies.writePolicy.executionEnabled
          ? 'approval_gated_writes'
          : dependencies.writePolicy.proposalsEnabled
            ? 'proposal_only'
            : 'read_only',
        proposalsEnabled: dependencies.writePolicy.proposalsEnabled,
        executionEnabled: dependencies.writePolicy.executionEnabled,
        enabledActions: [...dependencies.writePolicy.enabledActions].sort(),
        contractVersion: CONTENT_HUB_AGENT_CONTRACT,
      }),
      resultClass: 'success',
    };
  }

  if (operation === 'list_entries') {
    const startDate = dateParameter(parameters, 'startDate');
    const endDate = dateParameter(parameters, 'endDate');
    if ((startDate && !endDate) || (!startDate && endDate))
      throw new Error('incomplete date range');
    if (startDate && endDate) dateRange({ startDate, endDate }, now, 30, 366);
    const entries = await repository.listEntries({
      startDate,
      endDate,
      platform: platformParameter(parameters),
      workflowStatus: stringParameter(parameters, 'workflowStatus', 40),
      campaign: stringParameter(parameters, 'campaign', 100),
      limit: integerParameter(parameters, 'limit', 1, 50, 20),
    });
    return { response: successResponse(operation, { entries }), resultClass: 'success' };
  }

  if (operation === 'get_entry') {
    const entry = await repository.getEntry(idParameter(parameters, 'entryId'));
    return entry
      ? { response: successResponse(operation, { entry }), resultClass: 'success' }
      : {
          response: errorResponse(404, 'not_found', 'The requested entry was not found.'),
          resultClass: 'not_found',
        };
  }

  if (operation === 'calendar_summary') {
    const range = dateRange(parameters, now, 30, 93);
    const entries = await repository.listEntries({
      ...range,
      platform: platformParameter(parameters),
      limit: integerParameter(parameters, 'limit', 1, 100, 50),
    });
    return {
      response: successResponse(
        operation,
        buildCalendarSummary(entries, range.startDate, range.endDate),
      ),
      resultClass: 'success',
    };
  }

  if (operation === 'reporting_snapshot') {
    const range = dateRange(parameters, now, 30, 366);
    const platform = platformParameter(parameters);
    const campaign = stringParameter(parameters, 'campaign', 200);
    const contentPillar = stringParameter(parameters, 'contentPillar', 200);
    const assetType = stringParameter(parameters, 'assetType', 40);
    if (assetType && !['No asset', 'Video', 'Design', 'Carousel'].includes(assetType)) {
      throw new Error('invalid assetType');
    }
    const result = await repository.getReportingEntries({
      ...range,
      platform,
      campaign,
      contentPillar,
      assetType,
      limit: integerParameter(parameters, 'limit', 1, 500, 500),
    });
    return {
      response: successResponse(
        operation,
        buildReportingSnapshot(result.rows, {
          ...range,
          platform,
          campaign,
          contentPillar,
          assetType,
          truncated: result.truncated,
        }),
      ),
      resultClass: 'success',
    };
  }

  if (operation === 'list_reports') {
    const reportType = stringParameter(parameters, 'reportType', 20);
    if (
      reportType &&
      !(['monthly', 'quarterly', 'annual', 'campaign'] as const).includes(
        reportType as 'monthly' | 'quarterly' | 'annual' | 'campaign',
      )
    ) {
      throw new Error('invalid reportType');
    }
    const yearValue = parameters.year;
    const year =
      yearValue === undefined
        ? undefined
        : integerParameter(parameters, 'year', 2020, 2100, now.getUTCFullYear());
    const reports = await repository.listReports({
      reportType: reportType as ReportFilters['reportType'],
      year,
      limit: integerParameter(parameters, 'limit', 1, 50, 20),
    });
    return { response: successResponse(operation, { reports }), resultClass: 'success' };
  }

  if (operation === 'get_report') {
    const report = await repository.getReport(idParameter(parameters, 'reportId'));
    return report
      ? { response: successResponse(operation, { report }), resultClass: 'success' }
      : {
          response: errorResponse(404, 'not_found', 'The requested report was not found.'),
          resultClass: 'not_found',
        };
  }

  if (operation === 'compare_reports') {
    const left = await repository.getReport(idParameter(parameters, 'leftReportId'));
    const right = await repository.getReport(idParameter(parameters, 'rightReportId'));
    return left && right
      ? {
          response: successResponse(operation, compareSavedReports(left, right)),
          resultClass: 'success',
        }
      : {
          response: errorResponse(404, 'not_found', 'One or both reports were not found.'),
          resultClass: 'not_found',
        };
  }

  if (operation === 'propose_action') {
    if (!dependencies.writePolicy.proposalsEnabled) {
      throw new AgentActionError(
        'write_disabled',
        'Content Hub action proposals are disabled.',
        503,
      );
    }
    const proposedType = parameters.actionType;
    if (
      typeof proposedType !== 'string' ||
      !dependencies.writePolicy.enabledActions.has(
        proposedType as Parameters<AgentWritePolicy['enabledActions']['has']>[0],
      )
    ) {
      throw new AgentActionError('write_disabled', 'This Content Hub action is disabled.', 503);
    }
    const proposal = await proposeAgentAction(parameters, clientId, repository, now);
    return { response: successResponse(operation, proposal), resultClass: 'success' };
  }

  if (operation === 'get_action') {
    const action = await repository.getAction(parseActionId(parameters.actionId));
    return action
      ? {
          response: successResponse(operation, { action: getPublicAgentAction(action) }),
          resultClass: 'success',
        }
      : {
          response: errorResponse(404, 'not_found', 'The requested action was not found.'),
          resultClass: 'not_found',
        };
  }

  if (operation === 'execute_action') {
    if (!dependencies.writePolicy.executionEnabled) {
      throw new AgentActionError(
        'write_disabled',
        'Content Hub action execution is disabled.',
        503,
      );
    }
    const allowedKeys = new Set([
      'actionId',
      'payloadHash',
      'idempotencyKey',
      'approvalReference',
      'approvedBy',
    ]);
    if (
      Object.keys(parameters).some((key) => !allowedKeys.has(key)) ||
      [...allowedKeys].some((key) => !(key in parameters))
    ) {
      throw new AgentActionError('invalid_request', 'The execution request is invalid.', 400);
    }
    const actionId = parseActionId(parameters.actionId);
    const action = await repository.getAction(actionId);
    if (!action) {
      throw new AgentActionError('not_found', 'The requested action was not found.', 404);
    }
    if (!dependencies.writePolicy.enabledActions.has(action.actionType)) {
      throw new AgentActionError('write_disabled', 'This Content Hub action is disabled.', 503);
    }
    const result = await repository.executeAction({
      actionId,
      clientId,
      payloadHash: parseActionHash(parameters.payloadHash),
      idempotencyKey: parseIdempotencyKey(parameters.idempotencyKey),
      approvalReference: parseApprovalReference(parameters.approvalReference),
      approvedBy: parseApprovedBy(parameters.approvedBy),
    });
    const responseStatus =
      result.decision === 'expired'
        ? 410
        : result.decision === 'conflict'
          ? 409
          : result.decision === 'rejected' || result.decision === 'failed'
            ? 422
            : 200;
    const resultClass: ResultClass =
      result.decision === 'conflict'
        ? 'conflict'
        : result.decision === 'expired' ||
            result.decision === 'rejected' ||
            result.decision === 'failed'
          ? 'invalid_request'
          : 'success';
    return {
      response: jsonResponse(responseStatus, {
        ok: responseStatus === 200,
        contractVersion: CONTENT_HUB_AGENT_CONTRACT,
        operation,
        dataClassification: 'untrusted_application_data',
        data: { decision: result.decision, action: getPublicAgentAction(result.action) },
        ...(responseStatus === 200
          ? {}
          : { error: { code: result.decision, message: 'The approved action was not applied.' } }),
      }),
      resultClass,
    };
  }

  const status = await repository.getPublicationStatus(idParameter(parameters, 'entryId'));
  return {
    response: successResponse(operation, { publication: status }),
    resultClass: 'success',
  };
}

export async function handleContentHubAgentRequest(
  request: Request,
  dependencies: ContentHubAgentDependencies,
): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Only POST requests are supported.');
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_AGENT_BODY_BYTES) {
    return errorResponse(413, 'request_too_large', 'The request is too large.');
  }

  const body = await readBoundedBody(request);
  if (body === null) {
    return errorResponse(413, 'request_too_large', 'The request is too large.');
  }
  const auth = await verifyAgentRequest(request, body, dependencies.auth);
  if (!auth.ok) {
    return errorResponse(
      authFailureStatus(auth.code),
      auth.code,
      auth.code === 'integration_disabled' || auth.code === 'invalid_configuration'
        ? 'The integration is unavailable.'
        : 'The request could not be authenticated.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return errorResponse(400, 'invalid_request', 'The request body is invalid.');
  }
  if (!isRecord(parsed) || !isOperation(parsed.operation)) {
    return errorResponse(400, 'invalid_request', 'The requested operation is not available.');
  }
  const parameters = parsed.parameters === undefined ? {} : parsed.parameters;
  if (!isRecord(parameters)) {
    return errorResponse(400, 'invalid_request', 'The request parameters are invalid.');
  }

  let claim: Awaited<ReturnType<AgentRepository['claimRequest']>>;
  try {
    claim = await dependencies.repository.claimRequest({
      clientId: auth.clientId,
      nonce: auth.nonce,
      capability: parsed.operation,
      payloadHash: auth.payloadHash,
    });
  } catch {
    return errorResponse(503, 'unavailable', 'The integration request ledger is unavailable.');
  }
  if (claim.decision === 'replayed') {
    return errorResponse(409, 'replayed_request', 'This request has already been used.');
  }
  if (claim.decision === 'rate_limited') {
    return errorResponse(429, 'rate_limited', 'Too many requests have been received.');
  }
  if (!claim.requestId) {
    return errorResponse(503, 'unavailable', 'The integration request could not be recorded.');
  }

  try {
    const result = await dispatchOperation(
      parsed.operation,
      parameters,
      auth.clientId,
      dependencies,
    );
    try {
      await dependencies.repository.completeRequest(claim.requestId, result.resultClass);
    } catch {
      if (parsed.operation !== 'execute_action') {
        return errorResponse(503, 'unavailable', 'The integration request could not be completed.');
      }
      // Execution has already reached the transactional action boundary. Preserve its
      // authoritative response rather than misreporting a committed write as not applied.
    }
    return result.response;
  } catch (error) {
    if (error instanceof AgentActionError) {
      const resultClass: ResultClass =
        error.code === 'not_found'
          ? 'not_found'
          : error.code === 'conflict'
            ? 'conflict'
            : error.code === 'write_disabled'
              ? 'unavailable'
              : 'invalid_request';
      await dependencies.repository
        .completeRequest(claim.requestId, resultClass)
        .catch(() => undefined);
      return errorResponse(error.status, error.code, error.message);
    }
    const invalidRequest = error instanceof Error && error.message.startsWith('invalid');
    const incompleteRange = error instanceof Error && error.message === 'incomplete date range';
    const resultClass: ResultClass =
      invalidRequest || incompleteRange ? 'invalid_request' : 'internal_error';
    await dependencies.repository
      .completeRequest(claim.requestId, resultClass)
      .catch(() => undefined);
    return invalidRequest || incompleteRange
      ? errorResponse(400, 'invalid_request', 'The request parameters are invalid.')
      : errorResponse(500, 'internal_error', 'The request could not be completed.');
  }
}
