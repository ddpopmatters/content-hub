import React, { useState } from 'react';
import { Button, Modal, ModalContent, ModalFooter, ModalHeader } from '../../components/ui';

interface MetricInfoButtonProps {
  label: string;
  guidance: string;
}

export function MetricInfoButton({ label, guidance }: MetricInfoButtonProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const headingId = `metric-info-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex-shrink-0 rounded-full text-graystone-400 transition-colors hover:text-ocean-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500"
        aria-label={`About ${label}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby={headingId}
        className="max-w-lg"
      >
        <ModalHeader>
          <h2 id={headingId} className="text-base font-semibold text-ocean-900">
            {label}
          </h2>
        </ModalHeader>
        <ModalContent>
          <div className="space-y-2 text-sm text-graystone-700 whitespace-pre-line">{guidance}</div>
        </ModalContent>
        <ModalFooter>
          <Button size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
