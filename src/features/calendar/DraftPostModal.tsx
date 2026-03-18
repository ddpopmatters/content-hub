import React, { useState, useId } from 'react';
import {
  Modal,
  ModalHeader,
  ModalContent,
  ModalFooter,
  Button,
} from '../../components/ui';
import { ALL_PLATFORMS, ASSET_TYPES } from '../../constants';
import type { DraftPost } from '../../types/models';

export interface DraftPostModalProps {
  open: boolean;
  date: string; // YYYY-MM-DD
  /** Pass an existing post to edit it; undefined = new post */
  existing?: DraftPost;
  isSaving: boolean;
  onSave: (values: DraftPostFormValues) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export interface DraftPostFormValues {
  platform: string;
  topic: string;
  assetType: string;
  notes: string;
}

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function DraftPostModal({
  open,
  date,
  existing,
  isSaving,
  onSave,
  onDelete,
  onClose,
}: DraftPostModalProps): React.ReactElement {
  const headingId = useId();
  const isEditing = !!existing;

  const [platform, setPlatform] = useState(existing?.platform ?? ALL_PLATFORMS[0]);
  const [topic, setTopic] = useState(existing?.topic ?? '');
  const [assetType, setAssetType] = useState(existing?.assetType ?? ASSET_TYPES[0]);
  const [notes, setNotes] = useState(existing?.notes ?? '');

  // Reset form when modal opens for a new post or a different existing post
  const postId = existing?.id;
  React.useEffect(() => {
    if (open) {
      setPlatform(existing?.platform ?? ALL_PLATFORMS[0]);
      setTopic(existing?.topic ?? '');
      setAssetType(existing?.assetType ?? ASSET_TYPES[0]);
      setNotes(existing?.notes ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, postId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    onSave({ platform, topic: topic.trim(), assetType, notes: notes.trim() });
  }

  const labelClass = 'block text-xs font-semibold text-graystone-600 mb-1';
  const inputClass =
    'w-full rounded-md border border-graystone-200 bg-white px-3 py-2 text-sm text-graystone-900 focus:border-ocean-400 focus:outline-none focus:ring-1 focus:ring-ocean-400';

  return (
    <Modal open={open} onClose={onClose} aria-labelledby={headingId} className="w-full max-w-md">
      <ModalHeader id={headingId}>
        <div>
          <p className="text-xs text-graystone-500 font-normal mb-0.5">{formatDateLabel(date)}</p>
          <h2 className="text-base font-semibold text-graystone-900">
            {isEditing ? 'Edit draft post' : 'Add draft post'}
          </h2>
        </div>
      </ModalHeader>

      <ModalContent>
        <form id="draft-post-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Platform */}
          <div>
            <label htmlFor="draft-platform" className={labelClass}>
              Platform
            </label>
            <select
              id="draft-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className={inputClass}
            >
              {ALL_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Topic */}
          <div>
            <label htmlFor="draft-topic" className={labelClass}>
              Topic <span className="text-red-500">*</span>
            </label>
            <input
              id="draft-topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. World Population Day stats"
              required
              className={inputClass}
            />
          </div>

          {/* Asset type */}
          <div>
            <label htmlFor="draft-asset-type" className={labelClass}>
              Asset type
            </label>
            <select
              id="draft-asset-type"
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className={inputClass}
            >
              {ASSET_TYPES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="draft-notes" className={labelClass}>
              Notes
            </label>
            <textarea
              id="draft-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context…"
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>
        </form>
      </ModalContent>

      <ModalFooter>
        <div className="flex items-center justify-between w-full gap-2">
          {/* Delete (edit mode only) */}
          <div>
            {isEditing && onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={isSaving}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                Delete
              </Button>
            )}
          </div>

          {/* Cancel + Save */}
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="draft-post-form"
              size="sm"
              disabled={isSaving || !topic.trim()}
            >
              {isSaving ? 'Saving…' : isEditing ? 'Save changes' : 'Add post'}
            </Button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}
