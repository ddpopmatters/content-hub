import React, { useState, useEffect } from 'react';
import { Button, Label } from '../../components/ui';
import type { OrgEvent } from '../../types/models';
import { GANTT_COLOUR_SWATCHES } from './CampaignModal';

const PRESET_ORG_TYPES = [
  'conference',
  'policy',
  'fundraising',
  'internal',
  'report',
  'partnership',
] as const;
type PresetOrgType = (typeof PRESET_ORG_TYPES)[number];

const CUSTOM_SENTINEL = '__custom__';

const ORG_EVENT_TYPE_LABELS: Record<PresetOrgType, string> = {
  conference: 'Conference / event',
  policy: 'Policy moment',
  fundraising: 'Fundraising',
  internal: 'Internal milestone',
  report: 'Report / publication',
  partnership: 'Partnership',
};

const TYPE_DEFAULT_COLOURS: Record<PresetOrgType, string> = {
  conference: '#7c3aed',
  policy: '#d97706',
  fundraising: '#059669',
  internal: '#475569',
  report: '#0284c7',
  partnership: '#db2777',
};

const COLOUR_LABEL_ID = 'org-event-colour-label';

function isPreset(t: string): t is PresetOrgType {
  return (PRESET_ORG_TYPES as readonly string[]).includes(t);
}

interface OrgEventModalProps {
  event?: OrgEvent;
  onSave: (data: Omit<OrgEvent, 'id' | 'createdBy' | 'createdAt'>) => void;
  onUpdate?: (
    id: string,
    updates: Partial<Omit<OrgEvent, 'id' | 'createdBy' | 'createdAt'>>,
  ) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

export function OrgEventModal({
  event,
  onSave,
  onUpdate,
  onDelete,
  onClose,
}: OrgEventModalProps): React.ReactElement {
  const isEditMode = event !== undefined;

  const [name, setName] = useState(event?.name ?? '');
  const [type, setType] = useState(event?.type ?? 'conference');
  const [customType, setCustomType] = useState(
    event?.type && !isPreset(event.type) ? event.type : '',
  );
  const [startDate, setStartDate] = useState(event?.startDate ?? '');
  const [endDate, setEndDate] = useState(event?.endDate ?? '');
  const [colour, setColour] = useState(event?.colour ?? TYPE_DEFAULT_COLOURS['conference']);
  const [notes, setNotes] = useState(event?.notes ?? '');

  useEffect(() => {
    setName(event?.name ?? '');
    setType(event?.type ?? 'conference');
    setCustomType(event?.type && !isPreset(event.type) ? event.type : '');
    setStartDate(event?.startDate ?? '');
    setEndDate(event?.endDate ?? '');
    setColour(event?.colour ?? TYPE_DEFAULT_COLOURS['conference']);
    setNotes(event?.notes ?? '');
  }, [event]);

  const isCustom = !isPreset(type);
  const selectValue = isCustom ? CUSTOM_SENTINEL : type;
  const resolvedType = isCustom ? customType.trim() : type;

  function handleTypeChange(val: string) {
    if (val === CUSTOM_SENTINEL) {
      setType(CUSTOM_SENTINEL);
    } else {
      setType(val);
      setCustomType('');
      if (!isEditMode && isPreset(val)) {
        setColour(TYPE_DEFAULT_COLOURS[val as PresetOrgType]);
      }
    }
  }

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

  function handleSave() {
    if (isSaveDisabled) return;
    const data = {
      name: name.trim(),
      type: resolvedType,
      startDate,
      endDate,
      colour,
      notes: notes.trim(),
    };
    if (isEditMode && onUpdate) {
      onUpdate(event.id, data);
    } else {
      onSave(data);
    }
    onClose();
  }

  const inputClass =
    'w-full rounded-xl border border-graystone-300 bg-white px-3 py-2 text-sm text-graystone-900 focus:outline-none focus:ring-2 focus:ring-ocean-400 focus:ring-offset-2';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEditMode ? 'Edit org event' : 'Add org event'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-graystone-100 px-5 py-4">
          <h2 className="text-base font-semibold text-graystone-900">
            {isEditMode ? 'Edit org event' : 'Add org event'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-graystone-400 hover:bg-graystone-100 hover:text-graystone-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-400"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="flex flex-col gap-4 px-5 py-4"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="org-event-name">Name</Label>
            <input
              id="org-event-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. World Population Day"
              className={inputClass}
              autoFocus
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="org-event-type">Type</Label>
            <select
              id="org-event-type"
              value={selectValue}
              onChange={(e) => handleTypeChange(e.target.value)}
              className={inputClass}
            >
              {PRESET_ORG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ORG_EVENT_TYPE_LABELS[t]}
                </option>
              ))}
              <option disabled>──────────</option>
              <option value={CUSTOM_SENTINEL}>Custom…</option>
            </select>
            {isCustom && (
              <input
                type="text"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                placeholder="Enter type name"
                className={inputClass}
                autoFocus
              />
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="org-event-start">Start date</Label>
              <input
                id="org-event-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-event-end">End date</Label>
              <input
                id="org-event-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
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
              className="grid grid-cols-8 gap-1.5"
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
            <Label htmlFor="org-event-notes">Notes</Label>
            <textarea
              id="org-event-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context…"
              rows={2}
              className={`resize-none ${inputClass}`}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center border-t border-graystone-100 pt-3 mt-1">
            <div className="flex-1">
              {isEditMode && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(event.id);
                    onClose();
                  }}
                  className="text-sm font-medium text-rose-600 hover:text-rose-700 focus:outline-none focus-visible:underline"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSaveDisabled}>
                {isEditMode ? 'Save changes' : 'Add event'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
