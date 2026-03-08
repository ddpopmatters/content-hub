import { recommendSignOffRoute } from '../constants';
import type { Opportunity, RapidResponse } from '../types/models';
import { uuid } from './utils';

const nowIso = () => new Date().toISOString();

export const buildRapidResponseFromOpportunity = (
  opportunity: Opportunity,
  owner: string,
): RapidResponse => {
  const isHigh = opportunity.urgency === 'High';
  const dueDate = new Date(`${opportunity.date}T09:00:00`);
  dueDate.setHours(dueDate.getHours() + (isHigh ? 6 : 24));
  const responseMode: RapidResponse['responseMode'] = isHigh ? 'Rapid response' : 'Reactive';

  return {
    id: uuid(),
    title: opportunity.description.slice(0, 80),
    owner,
    status: 'New',
    responseMode,
    triggerDate: opportunity.date,
    dueAt: dueDate.toISOString(),
    signOffRoute: recommendSignOffRoute({ responseMode }) || undefined,
    sourceOpportunityId: opportunity.id,
    linkedEntryId: opportunity.linkedEntryId,
    targetPlatforms: [],
    notes: opportunity.angle || '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
};

export interface RapidResponseSnapshot {
  overdue: boolean;
  dueSoon: boolean;
}

export const buildRapidResponseSnapshot = (
  response: RapidResponse,
  now = new Date(),
): RapidResponseSnapshot => {
  const dueAt = new Date(response.dueAt);
  const diffMs = dueAt.getTime() - now.getTime();
  return {
    overdue: diffMs < 0 && response.status !== 'Closed',
    dueSoon: diffMs >= 0 && diffMs <= 6 * 60 * 60 * 1000 && response.status !== 'Closed',
  };
};
