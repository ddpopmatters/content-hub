import { CHECKLIST_ITEMS, WORKFLOW_STAGES } from '../../constants';
import { cx } from '../../lib/utils';
import { ensureChecklist, isImageMedia } from '../../lib/sanitizers';
import { Button, Badge, Modal } from '../../components/ui';
import { CheckCircleIcon, LoaderIcon } from '../../components/common';

export function ApprovalsModal({ open, onClose, approvals = [], onOpenEntry, onApprove }) {
  const hasItems = approvals.length > 0;
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex h-full max-h-[80vh] flex-col bg-white">
        <div className="flex items-center justify-between border-b border-graystone-200 px-6 py-4">
          <div className="heading-font flex items-center gap-2 text-xl font-semibold text-black">
            <span className="inline-block h-3 w-3 rounded-full bg-[#00F5FF]" aria-hidden="true" />
            Your Approvals
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="heading-font text-sm normal-case"
          >
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {hasItems ? (
            <div className="space-y-4">
              {approvals.map((entry) => {
                const checklist = ensureChecklist(entry.checklist);
                const completed = Object.values(checklist).filter(Boolean).length;
                const total = CHECKLIST_ITEMS.length;
                const hasPreview = isImageMedia(entry.previewUrl);
                return (
                  <div
                    key={entry.id}
                    className="rounded-3xl border border-graystone-200 bg-white p-5 shadow-sm transition hover:border-aqua-300"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{entry.assetType}</Badge>
                          <span className="heading-font text-sm font-semibold text-graystone-800">
                            {new Date(entry.date).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              weekday: 'short',
                            })}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-aqua-100 px-2 py-1 text-xs font-medium text-ocean-700">
                            {entry.statusDetail || WORKFLOW_STAGES[0]}
                          </span>
                        </div>
                        {hasPreview ? (
                          <div className="overflow-hidden rounded-2xl border border-graystone-200">
                            <img
                              src={entry.previewUrl}
                              alt="Entry preview"
                              className="h-40 w-full object-cover"
                            />
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-graystone-500">
                          <span>Requested by {entry.author || 'Unknown'}</span>
                          {entry.approvers?.length ? (
                            <span>Approvers: {entry.approvers.join(', ')}</span>
                          ) : null}
                        </div>
                        {entry.caption ? (
                          <p className="line-clamp-4 text-sm text-graystone-700">{entry.caption}</p>
                        ) : null}
                        {(entry.campaign || entry.contentPillar || entry.testingFrameworkName) && (
                          <div className="flex flex-wrap items-center gap-1 text-[11px] text-graystone-500">
                            {entry.campaign ? (
                              <span className="rounded-full bg-aqua-100 px-2 py-0.5 text-ocean-700">
                                {entry.campaign}
                              </span>
                            ) : null}
                            {entry.contentPillar ? (
                              <span className="rounded-full bg-graystone-100 px-2 py-0.5 text-graystone-700">
                                {entry.contentPillar}
                              </span>
                            ) : null}
                            {entry.testingFrameworkName ? (
                              <span className="rounded-full bg-ocean-500/10 px-2 py-0.5 text-ocean-700">
                                Test: {entry.testingFrameworkName}
                              </span>
                            ) : null}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-graystone-500">
                          {Object.entries(checklist).map(([key, value]) => {
                            const definition = CHECKLIST_ITEMS.find((item) => item.key === key);
                            if (!definition) return null;
                            return (
                              <span
                                key={key}
                                className={cx(
                                  'inline-flex items-center gap-1 rounded-full px-2 py-1',
                                  value
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-graystone-100 text-graystone-500',
                                )}
                              >
                                {value ? (
                                  <CheckCircleIcon className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <LoaderIcon className="h-3 w-3 text-graystone-400 animate-none" />
                                )}
                                {definition.label}
                              </span>
                            );
                          })}
                          <span className="rounded-full bg-graystone-100 px-2 py-1 text-xs text-graystone-600">
                            Checklist {completed}/{total}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <Button
                          size="sm"
                          onClick={() => onOpenEntry?.(entry.id)}
                          className="heading-font text-xs normal-case"
                        >
                          Review
                        </Button>
                        {entry.status !== 'Approved' ? (
                          <Button
                            variant="solid"
                            size="sm"
                            onClick={() => onApprove?.(entry.id)}
                            className="heading-font text-xs normal-case"
                          >
                            Approve
                          </Button>
                        ) : (
                          <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Approved
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center rounded-3xl border border-dashed border-graystone-200 bg-white/80 px-6 py-16 text-center">
              <p className="heading-font text-lg font-semibold text-ocean-700">
                You&apos;re all caught up
              </p>
              <p className="mt-2 max-w-sm text-sm text-graystone-500">
                Anything assigned to you will pop up here for a quick review. Check back once
                teammates submit something new.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
