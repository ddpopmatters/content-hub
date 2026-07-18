export interface ApprovalFreshnessIssue {
  code: 'invalid_approval_revision' | 'revision_not_approved';
  message: string;
}

const timestampValue = (value: string | null | undefined): number =>
  typeof value === 'string' && value.trim() ? Date.parse(value) : Number.NaN;

const validRevision = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export function getApprovalFreshnessIssue({
  approvedAt,
  contentRevision,
  approvedRevision,
}: {
  approvedAt: string | null | undefined;
  contentRevision: number | null | undefined;
  approvedRevision: number | null | undefined;
}): ApprovalFreshnessIssue | null {
  const approvedAtValue = timestampValue(approvedAt);

  if (
    !Number.isFinite(approvedAtValue) ||
    !validRevision(contentRevision) ||
    !validRevision(approvedRevision)
  ) {
    return {
      code: 'invalid_approval_revision',
      message: 'This entry must be approved again before publishing.',
    };
  }

  if (approvedRevision !== contentRevision) {
    return {
      code: 'revision_not_approved',
      message: 'This entry changed after approval. Approve the latest version before publishing.',
    };
  }

  return null;
}
