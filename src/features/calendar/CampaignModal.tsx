import React, { useState, useEffect, useRef } from 'react';
import type { PlanningCampaign } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Textarea } from '../../components/ui/Textarea';
import { Modal } from '../../components/ui/Modal';

// 24-colour palette — 3 rows × 8, covers full spectrum
export const GANTT_COLOUR_SWATCHES = [
  // Warm
  { label: 'Crimson', value: '#dc2626' },
  { label: 'Coral', value: '#ea580c' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Yellow', value: '#ca8a04' },
  { label: 'Lime', value: '#65a30d' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Cyan', value: '#0891b2' },
  // Cool
  { label: 'Sky', value: '#0284c7' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Indigo', value: '#4338ca' },
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Purple', value: '#9333ea' },
  { label: 'Fuchsia', value: '#c026d3' },
  { label: 'Pink', value: '#db2777' },
  { label: 'Rose', value: '#e11d48' },
  // Deep / muted
  { label: 'Slate', value: '#334155' },
  { label: 'Steel', value: '#475569' },
  { label: 'Bronze', value: '#92400e' },
  { label: 'Forest', value: '#166534' },
  { label: 'Navy', value: '#1e3a8a' },
  { label: 'Plum', value: '#6b21a8' },
  { label: 'Garnet', value: '#881337' },
  { label: 'Moss', value: '#3f6212' },
] as const;

const PRESET_TYPES = ['campaign', 'theme', 'series'] as const;
const CUSTOM_SENTINEL = '__custom__';

const COLOUR_LABEL_ID = 'campaign-colour-label';

interface CampaignModalProps {
  campaign?: PlanningCampaign;
  onSave: (data: Omit<PlanningCampaign, 'id' | 'createdAt' | 'createdBy'>) => void;
  onUpdate?: (
    id: string,
    updates: Partial<Omit<PlanningCampaign, 'id' | 'createdAt' | 'createdBy'>>,
  ) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

function isPreset(t: string): boolean {
  return (PRESET_TYPES as readonly string[]).includes(t);
}

export function CampaignModal({
  campaign,
  onSave,
  onUpdate,
  onDelete,
  onClose,
}: CampaignModalProps): React.ReactElement {
  const isEditMode = campaign !== undefined;

  const [name, setName] = useState(campaign?.name ?? '');
  const [type, setType] = useState(campaign?.type ?? 'campaign');
  const [customType, setCustomType] = useState(
    campaign?.type && !isPreset(campaign.type) ? campaign.type : '',
  );
  const [startDate, setStartDate] = useState(campaign?.startDate ?? '');
  const [endDate, setEndDate] = useState(campaign?.endDate ?? '');
  const [colour, setColour] = useState(campaign?.colour ?? GANTT_COLOUR_SWATCHES[8].value);
  const [notes, setNotes] = useState(campaign?.notes ?? '');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const customTypeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(campaign?.name ?? '');
    setType(campaign?.type ?? 'campaign');
    setCustomType(campaign?.type && !isPreset(campaign.type) ? campaign.type : '');
    setStartDate(campaign?.startDate ?? '');
    setEndDate(campaign?.endDate ?? '');
    setColour(campaign?.colour ?? GANTT_COLOUR_SWATCHES[8].value);
    setNotes(campaign?.notes ?? '');
  }, [campaign]);

  const isCustom = !isPreset(type);
  const selectValue = isCustom ? CUSTOM_SENTINEL : type;
  const resolvedType = isCustom ? customType.trim() : type;

  useEffect(() => {
    const nextTarget = isCustom ? customTypeInputRef.current : nameInputRef.current;
    nextTarget?.focus();
  }, [isCustom]);

  const dateError =
    startDate && endDate && endDate < startDate
      ? 'End date must be on or after the start date.'
      : null;

  const isSaveDisabled =
    name.trim() === '' ||
    !startDate ||
    !endDate ||
    dateError !== null ||
    (isCustom && customType.trim() === '');

  function handleTypeChange(val: string) {
    if (val === CUSTOM_SENTINEL) {
      setType(CUSTOM_SENTINEL);
    } else {
      setType(val);
      setCustomType('');
    }
  }

  function handleSave() {
    if (isSaveDisabled) return;
    const data = {
      name: name.trim(),
      type: resolvedType,
      startDate,
      endDate,
      colour,
      notes: notes.trim() || undefined,
    };
    if (isEditMode) {
      onUpdate?.(campaign.id, data);
    } else {
      onSave(data);
    }
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      aria-labelledby="campaign-modal-title"
      className="max-w-lg rounded-2xl"
    >
      <div className="p-5 sm:p-6">
        <h2 id="campaign-modal-title" className="mb-5 text-lg font-semibold text-graystone-900">
          {isEditMode ? 'Edit campaign' : 'New campaign'}
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="campaign-name">Name</Label>
              <Input
                id="campaign-name"
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Campaign name"
              />
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label htmlFor="campaign-type">Type</Label>
              <select
                id="campaign-type"
                value={selectValue}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full rounded-xl border border-graystone-300 bg-white px-3 py-2 text-sm text-graystone-900 focus:outline-none focus:ring-2 focus:ring-ocean-400 focus:ring-offset-2"
              >
                {PRESET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
                <option disabled>──────────</option>
                <option value={CUSTOM_SENTINEL}>Custom…</option>
              </select>
              {isCustom && (
                <Input
                  ref={customTypeInputRef}
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="Enter type name"
                />
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="campaign-start">Start date</Label>
                <Input
                  id="campaign-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-end">End date</Label>
                <Input
                  id="campaign-end"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            {dateError && <p className="text-xs text-rose-600">{dateError}</p>}

            {/* Colour — 8×3 grid */}
            <div className="space-y-1.5">
              <Label id={COLOUR_LABEL_ID}>Colour</Label>
              <div
                role="radiogroup"
                aria-labelledby={COLOUR_LABEL_ID}
                className="grid grid-cols-6 gap-2 sm:grid-cols-8 sm:gap-1.5"
              >
                {GANTT_COLOUR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.value}
                    type="button"
                    role="radio"
                    aria-checked={colour === swatch.value}
                    aria-label={swatch.label}
                    onClick={() => setColour(swatch.value)}
                    className={[
                      'h-6 w-6 rounded-full transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-400 focus-visible:ring-offset-1',
                      colour === swatch.value
                        ? 'scale-110 ring-2 ring-graystone-700 ring-offset-1'
                        : 'hover:scale-110',
                    ].join(' ')}
                    style={{ backgroundColor: swatch.value }}
                    title={swatch.label}
                  />
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="campaign-notes">Notes</Label>
              <Textarea
                id="campaign-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes…"
                rows={2}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-3 border-t border-graystone-100 pt-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              {isEditMode && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(campaign.id);
                    onClose();
                  }}
                  className="text-sm font-medium text-rose-600 hover:text-rose-700 focus:outline-none focus-visible:underline"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="justify-center"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={isSaveDisabled}
                className="justify-center"
              >
                {isEditMode ? 'Save changes' : 'Create'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export default CampaignModal;
