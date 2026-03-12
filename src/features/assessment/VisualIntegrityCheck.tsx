import React from 'react';
import { cx } from '../../lib/utils';
import { VISUAL_INTEGRITY_QUESTIONS } from '../../constants';

export interface VisualIntegrityValues {
  victimImagery?: boolean;
  anonWithoutContext?: boolean;
  recipientFraming?: boolean;
}

export interface VisualIntegrityCheckProps {
  values: VisualIntegrityValues;
  onChange: (values: VisualIntegrityValues) => void;
  readOnly?: boolean;
}

const REFRAME_GUIDANCE: Record<string, string> = {
  victimImagery:
    'Replace with imagery showing agency, leadership, and strength. Stock photography showing distress or passivity reinforces the narratives PM is working to dismantle.',
  anonWithoutContext:
    "Where possible, name individuals (with consent) from PM's partner network. 'Amina, a community health worker in Kaduna' is more powerful and more respectful than an uncredited stock image.",
  recipientFraming:
    "Reframe to position partners as experts and leaders of their own work. PM's role is to amplify their expertise — not to present ourselves as delivering it.",
};

export function VisualIntegrityCheck({
  values,
  onChange,
  readOnly = false,
}: VisualIntegrityCheckProps): React.ReactElement {
  const allAnswered = VISUAL_INTEGRITY_QUESTIONS.every(
    (q) => values[q.key as keyof VisualIntegrityValues] !== undefined,
  );
  const allPassed = VISUAL_INTEGRITY_QUESTIONS.every(
    (q) => values[q.key as keyof VisualIntegrityValues] === false,
  );
  const hasFailures = VISUAL_INTEGRITY_QUESTIONS.some(
    (q) => values[q.key as keyof VisualIntegrityValues] === true,
  );

  const setAnswer = (key: string, answer: boolean) => {
    if (readOnly) return;
    onChange({ ...values, [key]: answer });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-graystone-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-ocean-700">Visual Integrity Check</h3>
        <p className="text-xs text-graystone-500">
          Flag any issues with the image. Failures show guidance — content can still be submitted.
        </p>
      </div>

      <div className="space-y-3">
        {VISUAL_INTEGRITY_QUESTIONS.map((q) => {
          const val = values[q.key as keyof VisualIntegrityValues];
          const failed = val === true;
          return (
            <div
              key={q.key}
              className={cx(
                'rounded-xl border p-3',
                failed ? 'border-red-200 bg-red-50' : 'border-graystone-100 bg-graystone-50',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-xs font-semibold text-graystone-700">{q.label}</div>
                  <p className="mt-0.5 text-xs text-graystone-600">{q.description}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => setAnswer(q.key, true)}
                    className={cx(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      val === true
                        ? 'bg-red-500 text-white'
                        : 'bg-graystone-100 text-graystone-500 hover:bg-red-100 hover:text-red-600',
                      readOnly && 'cursor-default opacity-60',
                    )}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => setAnswer(q.key, false)}
                    className={cx(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      val === false
                        ? 'bg-emerald-500 text-white'
                        : 'bg-graystone-100 text-graystone-500 hover:bg-emerald-100 hover:text-emerald-600',
                      readOnly && 'cursor-default opacity-60',
                    )}
                  >
                    No
                  </button>
                </div>
              </div>
              {failed && (
                <p className="mt-2 rounded-lg bg-red-100 px-2 py-1.5 text-xs text-red-700">
                  {REFRAME_GUIDANCE[q.key]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {allAnswered && (
        <div
          className={cx(
            'rounded-xl px-3 py-2 text-xs font-semibold',
            allPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
          )}
        >
          {allPassed
            ? 'Visual integrity passed. Image is consistent with PM principles.'
            : 'Visual integrity issues flagged. Review guidance above before publishing.'}
        </div>
      )}
      {!allAnswered && hasFailures && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          Incomplete — answer all three checks to proceed.
        </div>
      )}
    </div>
  );
}

export default VisualIntegrityCheck;
