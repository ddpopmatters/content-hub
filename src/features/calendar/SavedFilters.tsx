import React, { useState } from 'react';
import { Button, Input, Badge } from '../../components/ui';
import { XIcon } from '../../components/common';

export interface FilterPreset {
  id: string;
  name: string;
  filters: {
    filterType?: string;
    filterWorkflow?: string;
    filterPlatforms?: string[];
    filterQuery?: string;
    filterOverdue?: boolean;
    filterEvergreen?: boolean;
  };
}

export interface SavedFiltersProps {
  /** Currently saved filter presets */
  presets: FilterPreset[];
  /** Current active filter values */
  currentFilters: FilterPreset['filters'];
  /** Callback when a preset is selected */
  onApplyPreset: (filters: FilterPreset['filters']) => void;
  /** Callback when presets are updated */
  onPresetsChange: (presets: FilterPreset[]) => void;
}

const STORAGE_KEY = 'pm-filter-presets';

/**
 * Load saved filter presets from localStorage
 * Validates data shape and returns empty array if corrupted
 */
export function loadFilterPresets(): FilterPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    // Validate each preset has required fields
    return parsed.filter(
      (p): p is FilterPreset =>
        p &&
        typeof p === 'object' &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        p.filters &&
        typeof p.filters === 'object',
    );
  } catch {
    return [];
  }
}

/**
 * Save filter presets to localStorage
 * Returns false if storage failed (e.g., quota exceeded, private mode)
 */
export function saveFilterPresets(presets: FilterPreset[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    return true;
  } catch {
    console.warn('Failed to save filter presets to localStorage');
    return false;
  }
}

/**
 * Check if current filters are non-default (have active filters)
 */
function hasActiveFilters(filters: FilterPreset['filters']): boolean {
  return !!(
    (filters.filterType && filters.filterType !== 'All') ||
    (filters.filterWorkflow && filters.filterWorkflow !== 'All') ||
    (filters.filterPlatforms && filters.filterPlatforms.length > 0) ||
    filters.filterQuery?.trim() ||
    filters.filterOverdue ||
    filters.filterEvergreen
  );
}

/**
 * Component for saving and loading filter presets
 */
export function SavedFilters({
  presets,
  currentFilters,
  onApplyPreset,
  onPresetsChange,
}: SavedFiltersProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;

    const newPreset: FilterPreset = {
      id: `preset-${Date.now()}`,
      name: newPresetName.trim(),
      filters: { ...currentFilters },
    };

    const updated = [...presets, newPreset];
    onPresetsChange(updated);
    saveFilterPresets(updated);
    setNewPresetName('');
    setIsOpen(false);
  };

  const handleDeletePreset = (id: string) => {
    const updated = presets.filter((p) => p.id !== id);
    onPresetsChange(updated);
    saveFilterPresets(updated);
  };

  const handleApplyPreset = (preset: FilterPreset) => {
    onApplyPreset(preset.filters);
    setIsOpen(false);
  };

  const canSave = hasActiveFilters(currentFilters);

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setIsOpen(!isOpen)} className="gap-1">
        <span>Saved Filters</span>
        {presets.length > 0 && (
          <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-[10px]">
            {presets.length}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-graystone-200 bg-white p-4 shadow-xl">
          <h4 className="mb-3 text-sm font-semibold text-graystone-700">Filter Presets</h4>

          {/* Existing presets */}
          {presets.length > 0 ? (
            <div className="mb-4 space-y-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between rounded-lg bg-graystone-50 px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="flex-1 text-left text-sm font-medium text-ocean-700 hover:text-ocean-900"
                  >
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePreset(preset.id)}
                    className="ml-2 rounded p-1 text-graystone-400 hover:bg-graystone-200 hover:text-graystone-600"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-4 text-sm text-graystone-500">No saved filters yet.</p>
          )}

          {/* Save current filters */}
          {canSave && (
            <div className="border-t border-graystone-200 pt-3">
              <p className="mb-2 text-xs text-graystone-500">Save current filters as preset:</p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Preset name..."
                  className="flex-1 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                />
                <Button size="sm" onClick={handleSavePreset} disabled={!newPresetName.trim()}>
                  Save
                </Button>
              </div>
            </div>
          )}

          {!canSave && (
            <p className="text-xs text-graystone-400">Apply filters first to save a preset.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default SavedFilters;
