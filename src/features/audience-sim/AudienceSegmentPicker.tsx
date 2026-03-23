import { cx } from '../../lib/utils';
import { PM_PERSONAS } from './personas';

export interface AudienceSegmentPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function AudienceSegmentPicker({ selectedIds, onChange }: AudienceSegmentPickerProps) {
  const togglePersona = (personaId: string) => {
    if (selectedIds.includes(personaId)) {
      onChange(selectedIds.filter((id) => id !== personaId));
      return;
    }
    onChange([...selectedIds, personaId]);
  };

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {PM_PERSONAS.map((persona) => {
        const checked = selectedIds.includes(persona.id);

        return (
          <div
            key={persona.id}
            className={cx(
              'flex cursor-pointer gap-3 rounded-xl border bg-white p-4 shadow-sm transition-colors',
              checked
                ? 'border-ocean-600 bg-aqua-50 ring-1 ring-ocean-400'
                : 'border-graystone-200 hover:border-ocean-400',
            )}
          >
            <input
              id={`audience-segment-${persona.id}`}
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-graystone-300 text-ocean-600"
              checked={checked}
              onChange={() => togglePersona(persona.id)}
              aria-label={persona.label}
            />
            <label htmlFor={`audience-segment-${persona.id}`} className="space-y-1">
              <span className="block text-sm font-semibold text-ocean-900">{persona.label}</span>
              <span className="block text-xs leading-relaxed text-graystone-600">
                {persona.description}
              </span>
            </label>
          </div>
        );
      })}
    </div>
  );
}

export default AudienceSegmentPicker;
