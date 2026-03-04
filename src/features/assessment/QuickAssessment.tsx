import React from 'react';
import { cx } from '../../lib/utils';
import { QUICK_ASSESSMENT_QUESTIONS } from '../../constants';

export interface QuickAssessmentValues {
  hook?: boolean;
  platformFit?: boolean;
  shareWorthy?: boolean;
  pmVoice?: boolean;
}

export interface QuickAssessmentProps {
  values: QuickAssessmentValues;
  onChange: (values: QuickAssessmentValues) => void;
  readOnly?: boolean;
  compact?: boolean;
}

export function QuickAssessment({
  values,
  onChange,
  readOnly = false,
  compact = false,
}: QuickAssessmentProps): React.ReactElement {
  const toggle = (key: string) => {
    if (readOnly) return;
    const current = values[key as keyof QuickAssessmentValues];
    onChange({ ...values, [key]: current === true ? false : true });
  };

  const allPassed = QUICK_ASSESSMENT_QUESTIONS.every(
    (q) => values[q.key as keyof QuickAssessmentValues] === true,
  );
  const answeredCount = QUICK_ASSESSMENT_QUESTIONS.filter(
    (q) => values[q.key as keyof QuickAssessmentValues] !== undefined,
  ).length;

  if (compact) {
    return (
      <div className="flex items-center gap-1" title={`${answeredCount}/5 checks completed`}>
        {QUICK_ASSESSMENT_QUESTIONS.map((q) => {
          const val = values[q.key as keyof QuickAssessmentValues];
          return (
            <span
              key={q.key}
              title={`${q.label}: ${val === true ? 'Yes' : val === false ? 'No' : 'Not checked'}`}
              className={cx(
                'inline-block h-2 w-2 rounded-full',
                val === true && 'bg-emerald-500',
                val === false && 'bg-red-400',
                val === undefined && 'bg-graystone-300',
              )}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-graystone-500">
          Quick check
        </span>
        {answeredCount === 5 && (
          <span
            className={cx(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
              allPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
            )}
          >
            {allPassed ? 'All passed' : 'Needs revision'}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {QUICK_ASSESSMENT_QUESTIONS.map((q) => {
          const val = values[q.key as keyof QuickAssessmentValues];
          return (
            <button
              key={q.key}
              type="button"
              disabled={readOnly}
              onClick={() => toggle(q.key)}
              title={q.description}
              className={cx(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                val === true && 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300',
                val === false && 'bg-red-50 text-red-600 ring-1 ring-red-200',
                val === undefined &&
                  'bg-graystone-100 text-graystone-600 ring-1 ring-graystone-200',
                !readOnly && 'cursor-pointer hover:ring-2',
                readOnly && 'cursor-default',
              )}
            >
              {q.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default QuickAssessment;
