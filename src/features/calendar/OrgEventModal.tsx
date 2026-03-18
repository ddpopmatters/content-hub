import React, { useState, useEffect } from 'react';
import { Button, Label } from '../../components/ui';
import type { OrgEvent, OrgEventType } from '../../types/models';

const ORG_EVENT_TYPES: { value: OrgEventType; label: string }[] = [
  { value: 'conference', label: 'Conference / event' },
  { value: 'policy', label: 'Policy moment' },
  { value: 'fundraising', label: 'Fundraising' },
  { value: 'internal', label: 'Internal milestone' },
  { value: 'report', label: 'Report / publication' },
  { value: 'partnership', label: 'Partnership' },
];

const TYPE_DEFAULT_COLOURS: Record<OrgEventType, string> = {
  conference:  '#8b5cf6',
  policy:      '#f59e0b',
  fundraising: '#10b981',
  internal:    '#6b7280',
  report:      '#0ea5e9',
  partnership: '#ec4899',
};

const COLOUR_SWATCHES = [
  { label: 'Purple',  value: '#8b5cf6' },
  { label: 'Amber',   value: '#f59e0b' },
  { label: 'Green',   value: '#10b981' },
  { label: 'Gray',    value: '#6b7280' },
  { label: 'Sky',     value: '#0ea5e9' },
  { label: 'Pink',    value: '#ec4899' },
  { label: 'Ocean',   value: '#0f9dde' },
  { label: 'Red',     value: '#ef4444' },
];

interface OrgEventModalProps {
  event?: OrgEvent;
  onSave: (data: Omit<OrgEvent, 'id' | 'createdBy' | 'createdAt'>) => void;
  onUpdate?: (id: string, updates: Partial<Omit<OrgEvent, 'id' | 'createdBy' | 'createdAt'>>) => void;
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
  const [type, setType] = useState<OrgEventType>(event?.type ?? 'conference');
  const [startDate, setStartDate] = useState(event?.startDate ?? '');
  const [endDate, setEndDate] = useState(event?.endDate ?? '');
  const [colour, setColour] = useState(event?.colour ?? COLOUR_SWATCHES[0].value);
  const [notes, setNotes] = useState(event?.notes ?? '');

  useEffect(() => {
    setName(event?.name ?? '');
    setType(event?.type ?? 'conference');
    setStartDate(event?.startDate ?? '');
    setEndDate(event?.endDate ?? '');
    setColour(event?.colour ?? COLOUR_SWATCHES[0].value);
    setNotes(event?.notes ?? '');
  }, [event]);

  // When type changes, auto-apply its default colour (only if user hasn't diverged from defaults)
  function handleTypeChange(newType: OrgEventType) {
    setType(newType);
    if (!isEditMode) {
      setColour(TYPE_DEFAULT_COLOURS[newType]);
    }
  }

  const dateError =
    startDate && endDate && endDate < startDate
      ? 'End date must be on or after the start date.'
      : null;

  const isSaveDisabled = name.trim() === '' || !startDate || !endDate || dateError !== null;

  function handleSave() {
    if (isSaveDisabled) return;
    const data = { name: name.trim(), type, startDate, endDate, colour, notes: notes.trim() };
    if (isEditMode && onUpdate) {
      onUpdate(event.id, data);
    } else {
      onSave(data);
    }
    onClose();
  }

  function handleDelete() {
    if (isEditMode && onDelete) {
      onDelete(event.id);
      onClose();
    }
  }

  const inputClass =
    'w-full rounded-md border border-graystone-200 bg-white px-3 py-2 text-sm text-graystone-900 focus:border-ocean-400 focus:outline-none focus:ring-1 focus:ring-ocean-400';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEditMode ? 'Edit org event' : 'Add org event'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-graystone-100 px-5 py-4">
          <h2 className="text-base font-semibold text-graystone-900">
            {isEditMode ? 'Edit org event' : 'Add org event'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-graystone-400 hover:bg-graystone-100 hover:text-graystone-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-4">
          {/* Name */}
          <div>
            <Label htmlFor="org-event-name">Name *</Label>
            <input
              id="org-event-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. World Population Day"
              className={`mt-1 ${inputClass}`}
              autoFocus
            />
          </div>

          {/* Type */}
          <div>
            <Label htmlFor="org-event-type">Type</Label>
            <select
              id="org-event-type"
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as OrgEventType)}
              className={`mt-1 ${inputClass}`}
            >
              {ORG_EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="org-event-start">Start date *</Label>
              <input
                id="org-event-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </div>
            <div>
              <Label htmlFor="org-event-end">End date *</Label>
              <input
                id="org-event-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`mt-1 ${inputClass}`}
              />
            </div>
          </div>
          {dateError && (
            <p className="text-xs text-red-600">{dateError}</p>
          )}

          {/* Colour */}
          <div>
            <Label>Colour</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {COLOUR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  onClick={() => setColour(swatch.value)}
                  className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: swatch.value,
                    borderColor: colour === swatch.value ? '#1e293b' : 'transparent',
                  }}
                  aria-label={swatch.label}
                  title={swatch.label}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="org-event-notes">Notes</Label>
            <textarea
              id="org-event-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context…"
              rows={2}
              className={`mt-1 resize-none ${inputClass}`}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-graystone-100 px-5 py-3">
          <div>
            {isEditMode && onDelete && (
              <Button variant="ghost" size="sm" onClick={handleDelete}
                className="text-red-600 hover:bg-red-50 hover:text-red-700">
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={isSaveDisabled}>
              {isEditMode ? 'Save changes' : 'Add event'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
