import React, { useState } from 'react';
import type { PlanningCampaign } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Textarea } from '../../components/ui/Textarea';

const COLOUR_SWATCHES = [
  { label: 'Blue', value: '#0ea5e9' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Slate', value: '#64748b' },
] as const;

const CAMPAIGN_TYPES = ['campaign', 'theme', 'series'] as const;
type CampaignType = (typeof CAMPAIGN_TYPES)[number];

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

export function CampaignModal({
  campaign,
  onSave,
  onUpdate,
  onDelete,
  onClose,
}: CampaignModalProps): React.ReactElement {
  const isEditMode = campaign !== undefined;

  const [name, setName] = useState(campaign?.name ?? '');
  const [type, setType] = useState<CampaignType>(campaign?.type ?? 'campaign');
  const [startDate, setStartDate] = useState(campaign?.startDate ?? '');
  const [endDate, setEndDate] = useState(campaign?.endDate ?? '');
  const [colour, setColour] = useState(campaign?.colour ?? COLOUR_SWATCHES[0].value);
  const [notes, setNotes] = useState(campaign?.notes ?? '');

  const dateError =
    startDate && endDate && endDate < startDate
      ? 'End date must be on or after the start date.'
      : null;

  const isSaveDisabled = name.trim() === '' || dateError !== null;

  const handleSave = () => {
    if (isSaveDisabled) return;

    const data: Omit<PlanningCampaign, 'id' | 'createdAt' | 'createdBy'> = {
      name: name.trim(),
      type,
      startDate,
      endDate,
      colour,
      notes: notes.trim() || undefined,
    };

    if (isEditMode && onUpdate) {
      onUpdate(campaign.id, data);
    } else {
      onSave(data);
    }
    onClose();
  };

  const handleDelete = () => {
    if (isEditMode && onDelete) {
      onDelete(campaign.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <h2 className="mb-5 text-lg font-semibold text-graystone-900">
          {isEditMode ? 'Edit campaign' : 'New campaign'}
        </h2>

        {/* Fields */}
        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Campaign name"
              autoFocus
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="campaign-type">Type</Label>
            <select
              id="campaign-type"
              value={type}
              onChange={(e) => setType(e.target.value as CampaignType)}
              className="w-full rounded-xl border border-graystone-300 bg-white px-3 py-2 text-sm text-graystone-900 focus:outline-none focus:ring-2 focus:ring-ocean-400 focus:ring-offset-2"
            >
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
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

          {/* Colour */}
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex gap-2">
              {COLOUR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  aria-label={swatch.label}
                  onClick={() => setColour(swatch.value)}
                  className={[
                    'h-7 w-7 rounded-full transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-400 focus-visible:ring-offset-2',
                    colour === swatch.value
                      ? 'scale-110 border-2 border-gray-700'
                      : 'border border-transparent hover:scale-105',
                  ].join(' ')}
                  style={{ backgroundColor: swatch.value }}
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
              rows={3}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center">
          {/* Delete — edit mode only, left-aligned */}
          <div className="flex-1">
            {isEditMode && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="text-sm font-medium text-rose-600 hover:text-rose-700 focus:outline-none focus-visible:underline"
              >
                Delete
              </button>
            )}
          </div>

          {/* Cancel + Save — right-aligned */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="default" size="sm" onClick={handleSave} disabled={isSaveDisabled}>
              {isEditMode ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CampaignModal;
