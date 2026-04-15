import React, { useState } from 'react';
import { Button } from './Button';
import { ChevronDownIcon } from '../common';

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface MultiSelectProps {
  /** Placeholder text when no items selected */
  placeholder: string;
  /** Currently selected values */
  value: string[];
  /** Callback when selection changes */
  onChange: (values: string[]) => void;
  /** Available options */
  options: MultiSelectOption[];
  /** Optional button id for label association */
  buttonId?: string;
  /** Optional accessible label reference */
  labelledBy?: string;
}

const MULTI_OPTION_BASE =
  'dropdown-font flex cursor-pointer items-center gap-3 px-4 py-2 text-sm font-normal text-black transition hover:bg-black hover:text-white';

const checklistCheckboxClass =
  'h-4 w-4 rounded border-black bg-white text-[#00F5FF] focus:ring-0 focus:ring-offset-0';

/**
 * MultiSelect - Dropdown component for selecting multiple options
 */
export const MultiSelect: React.FC<MultiSelectProps> = ({
  placeholder,
  value,
  onChange,
  options,
  buttonId,
  labelledBy,
}) => {
  const [open, setOpen] = useState(false);

  const toggle = (val: string) => {
    const exists = value.includes(val);
    onChange(exists ? value.filter((x) => x !== val) : [...value, val]);
  };

  return (
    <div className="relative">
      <Button
        id={buttonId}
        variant="outline"
        className="dropdown-font w-full justify-between px-4 py-2"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={labelledBy}
      >
        <span className="dropdown-font text-sm">
          {value.length ? `${value.length} selected` : placeholder}
        </span>
        <ChevronDownIcon className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute left-0 top-12 z-30 w-full rounded-3xl border border-black bg-white text-black shadow-[0_0_25px_rgba(15,157,222,0.3)]">
          <div className="max-h-52 overflow-y-auto py-2">
            {options.map((option) => (
              <label key={option.value} className={MULTI_OPTION_BASE}>
                <input
                  type="checkbox"
                  className={checklistCheckboxClass}
                  checked={value.includes(option.value)}
                  onChange={() => toggle(option.value)}
                />
                {option.icon ? <span className="transition-colors">{option.icon}</span> : null}
                <span className="text-sm font-normal">{option.label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-black/10 px-3 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
              className="heading-font text-sm"
            >
              Clear
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
