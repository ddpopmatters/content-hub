import {
  CONTENT_CATEGORIES,
  CTA_TYPES,
  EXECUTION_STATUSES,
  LINK_PLACEMENTS,
  PRIORITY_TIERS,
  RESPONSE_MODES,
  SIGN_OFF_ROUTES,
} from '../constants';
import { daysInMonth } from './utils';

export const getMonthEndDate = (monthKey: string): string => {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const lastDay = daysInMonth(year, month);
  return `${monthKey}-${String(lastDay).padStart(2, '0')}`;
};

export const mapWorkflowStatusToDb = (status: string | undefined): string => {
  if (!status) return 'Draft';
  switch (status) {
    case 'Draft':
    case 'Approved':
    case 'Published':
      return status;
    case 'Ready for Review':
      return 'In Review';
    case 'In Review':
    case 'Approval required':
    case 'Awaiting brand approval':
    case 'Awaiting SME approval':
    case 'Awaiting visual':
      return 'In Review';
    case 'Scheduled':
      return 'Approved';
    default:
      return 'Draft';
  }
};

export const mapWorkflowStatusFromDb = (status: string | undefined): string => {
  if (!status) return 'Draft';
  switch (status) {
    case 'Draft':
      return 'Draft';
    case 'In Review':
      return 'Ready for Review';
    case 'Approved':
    case 'Scheduled':
      return 'Approved';
    case 'Published':
      return 'Published';
    default:
      return 'Draft';
  }
};

export const mapPriorityTierToDb = (priorityTier: string | undefined): string => {
  if (!priorityTier) return 'Medium';
  if (PRIORITY_TIERS.includes(priorityTier as (typeof PRIORITY_TIERS)[number])) {
    return priorityTier;
  }
  return 'Medium';
};

export const mapPriorityTierFromDb = (
  priorityTier: string | undefined,
): (typeof PRIORITY_TIERS)[number] => {
  return PRIORITY_TIERS.find((tier) => tier === priorityTier) ?? 'Medium';
};

export const mapContentCategoryFromDb = (
  value: string | null | undefined,
): (typeof CONTENT_CATEGORIES)[number] | undefined =>
  CONTENT_CATEGORIES.find((option) => option === value) ?? undefined;

export const mapResponseModeFromDb = (
  value: string | null | undefined,
): (typeof RESPONSE_MODES)[number] | undefined =>
  RESPONSE_MODES.find((option) => option === value) ?? undefined;

export const mapSignOffRouteFromDb = (
  value: string | null | undefined,
): (typeof SIGN_OFF_ROUTES)[number] | undefined =>
  SIGN_OFF_ROUTES.find((option) => option === value) ?? undefined;

export const mapExecutionStatusFromDb = (
  value: string | null | undefined,
): (typeof EXECUTION_STATUSES)[number] | undefined =>
  EXECUTION_STATUSES.find((option) => option === value) ?? undefined;

export const mapLinkPlacementFromDb = (
  value: string | null | undefined,
): (typeof LINK_PLACEMENTS)[number] | undefined =>
  LINK_PLACEMENTS.find((option) => option === value) ?? undefined;

export const mapCtaTypeFromDb = (
  value: string | null | undefined,
): (typeof CTA_TYPES)[number] | undefined =>
  CTA_TYPES.find((option) => option === value) ?? undefined;

const OPPORTUNITY_URGENCY_LEVELS = ['High', 'Medium', 'Low'] as const;
const OPPORTUNITY_STATUS_VALUES = ['Open', 'Acted', 'Dismissed'] as const;
const CONTENT_REQUEST_STATUS_VALUES = ['Pending', 'In Progress', 'Converted', 'Declined'] as const;

export const mapOpportunityUrgencyToDb = (urgency: string | undefined): string => {
  if (!urgency) return 'Medium';
  if (OPPORTUNITY_URGENCY_LEVELS.includes(urgency as (typeof OPPORTUNITY_URGENCY_LEVELS)[number])) {
    return urgency;
  }
  return 'Medium';
};

export const mapOpportunityUrgencyFromDb = (
  urgency: string | undefined,
): (typeof OPPORTUNITY_URGENCY_LEVELS)[number] => {
  return OPPORTUNITY_URGENCY_LEVELS.find((value) => value === urgency) ?? 'Medium';
};

export const mapOpportunityStatusToDb = (status: string | undefined): string => {
  if (!status) return 'Open';
  if (OPPORTUNITY_STATUS_VALUES.includes(status as (typeof OPPORTUNITY_STATUS_VALUES)[number])) {
    return status;
  }
  return 'Open';
};

export const mapOpportunityStatusFromDb = (
  status: string | undefined,
): (typeof OPPORTUNITY_STATUS_VALUES)[number] => {
  return OPPORTUNITY_STATUS_VALUES.find((value) => value === status) ?? 'Open';
};

export const mapContentRequestStatusToDb = (status: string | undefined): string => {
  if (!status) return 'Pending';
  if (
    CONTENT_REQUEST_STATUS_VALUES.includes(status as (typeof CONTENT_REQUEST_STATUS_VALUES)[number])
  ) {
    return status;
  }
  return 'Pending';
};

export const mapContentRequestStatusFromDb = (
  status: string | undefined,
): (typeof CONTENT_REQUEST_STATUS_VALUES)[number] => {
  return CONTENT_REQUEST_STATUS_VALUES.find((value) => value === status) ?? 'Pending';
};

export const mapTestingStatusToDb = (status: string | undefined): string => {
  if (!status) return 'Planned';
  switch (status) {
    case 'Planned':
    case 'Completed':
      return status;
    case 'In flight':
      return 'Running';
    case 'Archived':
      return 'Cancelled';
    case 'Running':
    case 'Cancelled':
      return status;
    default:
      return 'Planned';
  }
};

export const mapTestingStatusFromDb = (status: string | undefined): string => {
  if (!status) return 'Planned';
  switch (status) {
    case 'Planned':
    case 'Completed':
      return status;
    case 'Running':
      return 'In flight';
    case 'Cancelled':
      return 'Archived';
    default:
      return status;
  }
};

export const dateOrNull = (value: string | undefined): string | null => {
  if (!value || value.trim() === '') return null;
  return value;
};
