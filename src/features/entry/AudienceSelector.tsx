import React from 'react';
import { cx } from '../../lib/utils';
import { AUDIENCE_SEGMENTS, AUDIENCE_SEGMENT_DESCRIPTIONS } from '../../constants';
import type { AudienceSegment } from '../../constants';

export interface AudienceSelectorProps {
  value: string[];
  onChange: (segments: string[]) => void;
  readOnly?: boolean;
  labelledBy?: string;
}

export function AudienceSelector({
  value,
  onChange,
  readOnly = false,
  labelledBy,
}: AudienceSelectorProps): React.ReactElement {
  const toggle = (segment: AudienceSegment) => {
    if (readOnly) return;
    if (value.includes(segment)) {
      onChange(value.filter((s) => s !== segment));
    } else {
      onChange([...value, segment]);
    }
  };

  return (
    <div className="space-y-2" role="group" aria-labelledby={labelledBy}>
      <div className="flex flex-wrap gap-1.5">
        {AUDIENCE_SEGMENTS.map((segment) => {
          const selected = value.includes(segment);
          return (
            <button
              key={segment}
              type="button"
              disabled={readOnly}
              onClick={() => toggle(segment)}
              title={AUDIENCE_SEGMENT_DESCRIPTIONS[segment]}
              aria-pressed={selected}
              className={cx(
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                selected
                  ? 'bg-ocean-600 text-white ring-1 ring-ocean-400'
                  : 'bg-graystone-100 text-graystone-600 ring-1 ring-graystone-200',
                !readOnly && 'cursor-pointer hover:ring-2',
                readOnly && 'cursor-default',
              )}
            >
              {segment}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <p className="text-[11px] text-graystone-500">
          {value.length === 1
            ? AUDIENCE_SEGMENT_DESCRIPTIONS[value[0] as AudienceSegment]
            : `${value.length} segments selected`}
        </p>
      )}
    </div>
  );
}

export default AudienceSelector;
