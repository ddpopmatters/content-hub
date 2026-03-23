import React, { useMemo, useState } from 'react';
import { PM_PERSONAS } from './personas';
import type { SegmentResult } from './types';

export interface SimResultCardProps {
  result: SegmentResult;
}

const sentimentClasses: Record<SegmentResult['sentiment'], string> = {
  positive: 'bg-emerald-100 text-emerald-700',
  negative: 'bg-rose-100 text-rose-700',
  mixed: 'bg-amber-100 text-amber-700',
  neutral: 'bg-sky-100 text-sky-700',
};

export function SimResultCard({ result }: SimResultCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  const personaLabel = useMemo(
    () => PM_PERSONAS.find((persona) => persona.id === result.persona_id)?.label || result.label,
    [result.label, result.persona_id],
  );

  return (
    <div className="rounded-3xl border border-graystone-200 bg-white p-5 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="space-y-2">
          <div className="text-sm font-semibold text-ocean-900">{personaLabel}</div>
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${sentimentClasses[result.sentiment]}`}
          >
            {result.sentiment}
          </span>
        </div>
        <span className="text-xs font-medium text-graystone-500">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-graystone-500">
          <span>Audience fit</span>
          <span>{Math.max(0, Math.min(100, result.score))}/100</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-graystone-100">
          <div
            className="h-full rounded-full bg-ocean-400 transition-[width]"
            style={{ width: `${Math.max(0, Math.min(100, result.score))}%` }}
          />
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-4 text-sm text-graystone-700">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-graystone-500">
              Key reactions
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.key_reactions.map((reaction) => (
                <li key={reaction}>{reaction}</li>
              ))}
            </ul>
          </div>

          {result.concerns.length > 0 ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-graystone-500">
                Concerns
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {result.concerns.map((concern) => (
                  <li key={concern}>{concern}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.suggested_improvements.length > 0 ? (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-graystone-500">
                Suggested improvements
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {result.suggested_improvements.map((improvement) => (
                  <li key={improvement}>{improvement}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default SimResultCard;
