import React from 'react';
import { cx } from '../../lib/utils';
import { GOLDEN_THREAD_QUESTIONS } from '../../constants';

export interface GoldenThreadValues {
  coercion?: boolean;
  blame?: boolean;
  instrumentalisation?: boolean;
  cooption?: boolean;
}

export interface GoldenThreadCheckProps {
  values: GoldenThreadValues;
  onChange: (values: GoldenThreadValues) => void;
  readOnly?: boolean;
  onClose?: () => void;
}

const REFRAME_GUIDANCE: Record<string, string> = {
  coercion:
    'Reframe: focus on rights and choices available for people, not actions done to them. Emphasise voluntary access, not population reduction targets.',
  blame:
    'Reframe: address systemic failures in access to rights, education, and healthcare. Avoid singling out communities or countries.',
  instrumentalisation:
    'Reframe: centre women as people with inherent rights, not as means to a demographic end. Their choices matter because they are human, not because of population outcomes.',
  cooption:
    'Reframe: add context that makes the rights-based framing unmistakable. If a nationalist or eco-fascist could use this as a recruitment tool, it needs more work.',
};

export function GoldenThreadCheck({
  values,
  onChange,
  readOnly = false,
  onClose,
}: GoldenThreadCheckProps): React.ReactElement {
  const allAnswered = GOLDEN_THREAD_QUESTIONS.every(
    (q) => values[q.key as keyof GoldenThreadValues] !== undefined,
  );
  const allPassed = GOLDEN_THREAD_QUESTIONS.every(
    (q) => values[q.key as keyof GoldenThreadValues] === false,
  );
  const hasFailures = GOLDEN_THREAD_QUESTIONS.some(
    (q) => values[q.key as keyof GoldenThreadValues] === true,
  );

  const setAnswer = (key: string, answer: boolean) => {
    if (readOnly) return;
    onChange({ ...values, [key]: answer });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-graystone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ocean-700">Golden Thread Check</h3>
          <p className="text-xs text-graystone-500">
            Flag anything that applies. Failures show reframing guidance — content can still be
            submitted.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-graystone-400 hover:text-graystone-600"
          >
            Close
          </button>
        )}
      </div>

      <div className="space-y-3">
        {GOLDEN_THREAD_QUESTIONS.map((q) => {
          const val = values[q.key as keyof GoldenThreadValues];
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
                    aria-pressed={val === true}
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
                    aria-pressed={val === false}
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
            ? 'Golden Thread passed. Content is safe to proceed.'
            : 'Golden Thread failed. Revise flagged items before publishing.'}
        </div>
      )}
      {!allAnswered && hasFailures && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          Incomplete — answer all four checks to proceed.
        </div>
      )}
    </div>
  );
}

export default GoldenThreadCheck;
