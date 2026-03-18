import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { cx, isoFromParts } from '../../lib/utils';
import { SUPABASE_API } from '../../lib/supabase';
import type { DraftPost } from '../../types/models';
import { DraftPostModal, type DraftPostFormValues } from './DraftPostModal';
import { ALL_PLATFORMS } from '../../constants';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const PLATFORM_COLOURS: Record<string, string> = {
  Instagram: 'bg-pink-100 text-pink-700',
  LinkedIn: 'bg-blue-100 text-blue-700',
  YouTube: 'bg-red-100 text-red-700',
  Facebook: 'bg-indigo-100 text-indigo-700',
  BlueSky: 'bg-sky-100 text-sky-700',
};

interface PlanningGridProps {
  days: number[];
  month: number;
  year: number;
  userEmail: string;
}

interface ModalState {
  open: boolean;
  date: string;
  existing?: DraftPost;
}

const CLOSED_MODAL: ModalState = { open: false, date: '' };

export function PlanningGrid({
  days,
  month,
  year,
  userEmail,
}: PlanningGridProps): React.ReactElement {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [draftPosts, setDraftPosts] = useState<DraftPost[]>([]);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(CLOSED_MODAL);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    SUPABASE_API.fetchPlanningNotes().then((fetched) => {
      setNotes(fetched);
    });
    SUPABASE_API.fetchDraftPosts(year, month).then((fetched) => {
      setDraftPosts(fetched);
    });
  }, [year, month]);

  const handleChange = useCallback(
    (iso: string, value: string) => {
      setNotes((prev) => {
        const next = { ...prev };
        if (value) next[iso] = value;
        else delete next[iso];
        return next;
      });

      clearTimeout(saveTimers.current[iso]);
      saveTimers.current[iso] = setTimeout(() => {
        SUPABASE_API.savePlanningNote(iso, value, userEmail);
      }, 800);
    },
    [userEmail],
  );

  function openNewDraft(date: string) {
    setModal({ open: true, date, existing: undefined });
  }

  function openEditDraft(post: DraftPost) {
    setModal({ open: true, date: post.date, existing: post });
  }

  async function handleSave(values: DraftPostFormValues) {
    setIsSaving(true);
    const saved = await SUPABASE_API.saveDraftPost({
      id: modal.existing?.id,
      date: modal.date,
      platform: values.platform,
      topic: values.topic,
      assetType: values.assetType,
      notes: values.notes,
      createdBy: userEmail,
    });
    setIsSaving(false);

    if (saved) {
      setDraftPosts((prev) => {
        const without = prev.filter((p) => p.id !== saved.id);
        return [...without, saved].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
      });
      setModal(CLOSED_MODAL);
    }
  }

  async function handleDelete() {
    if (!modal.existing) return;
    setIsSaving(true);
    const ok = await SUPABASE_API.deleteDraftPost(modal.existing.id);
    setIsSaving(false);

    if (ok) {
      const deletedId = modal.existing.id;
      setDraftPosts((prev) => prev.filter((p) => p.id !== deletedId));
      setModal(CLOSED_MODAL);
    }
  }

  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const weeks = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const result: { weekKey: string; slots: (number | null)[] }[] = [];
    let currentSlots: (number | null)[] = Array(firstDayOfMonth).fill(null);

    for (const day of days) {
      currentSlots.push(day);
      if (currentSlots.length === 7) {
        const firstActual = currentSlots.find((d) => d !== null) as number;
        result.push({ weekKey: isoFromParts(year, month, firstActual), slots: currentSlots });
        currentSlots = [];
      }
    }

    if (currentSlots.length > 0) {
      while (currentSlots.length < 7) currentSlots.push(null);
      const firstActual = currentSlots.find((d) => d !== null) as number;
      result.push({ weekKey: isoFromParts(year, month, firstActual), slots: currentSlots });
    }

    return result;
  }, [days, month, year]);

  const visibleDrafts = useMemo(
    () => (platformFilter ? draftPosts.filter((p) => p.platform === platformFilter) : draftPosts),
    [draftPosts, platformFilter],
  );

  const draftsByDate = useMemo(() => {
    const map: Record<string, DraftPost[]> = {};
    for (const post of visibleDrafts) {
      if (!map[post.date]) map[post.date] = [];
      map[post.date].push(post);
    }
    return map;
  }, [visibleDrafts]);

  const usedPlatforms = useMemo(
    () => ALL_PLATFORMS.filter((p) => draftPosts.some((d) => d.platform === p)),
    [draftPosts],
  );

  return (
    <>
      {usedPlatforms.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPlatformFilter(null)}
            className={cx(
              'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
              platformFilter === null
                ? 'bg-graystone-800 text-white'
                : 'bg-graystone-100 text-graystone-600 hover:bg-graystone-200',
            )}
          >
            All
          </button>
          {usedPlatforms.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatformFilter(platformFilter === p ? null : p)}
              className={cx(
                'rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity',
                PLATFORM_COLOURS[p] ?? 'bg-graystone-100 text-graystone-600',
                platformFilter !== null && platformFilter !== p ? 'opacity-30' : 'opacity-100',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <div role="grid" aria-label="Planning calendar">
        <div className="mb-1 grid grid-cols-7 gap-1">
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-graystone-500"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="space-y-1">
          {weeks.map((week) => (
            <div key={week.weekKey} className="grid grid-cols-7 gap-1">
              {week.slots.map((day, slotIndex) => {
                if (day === null) {
                  return (
                    <div
                      key={`empty-${slotIndex}`}
                      className="min-h-24 rounded-lg bg-graystone-50 opacity-30"
                    />
                  );
                }

                const iso = isoFromParts(year, month, day);
                const isToday = iso === todayISO;
                const dayDrafts = draftsByDate[iso] ?? [];

                return (
                  <div
                    key={iso}
                    className={cx(
                      'flex min-h-24 flex-col overflow-hidden rounded-lg border bg-white',
                      isToday ? 'border-ocean-400' : 'border-graystone-200',
                    )}
                  >
                    <div
                      className={cx(
                        'border-b px-1.5 py-1',
                        isToday ? 'border-ocean-200 bg-ocean-50' : 'border-graystone-100',
                      )}
                    >
                      <span
                        className={cx(
                          'text-xs font-semibold',
                          isToday ? 'text-ocean-700' : 'text-graystone-700',
                        )}
                      >
                        {day}
                      </span>
                    </div>

                    {dayDrafts.length > 0 && (
                      <div className="flex flex-col gap-0.5 px-1 pt-1">
                        {dayDrafts.map((post) => (
                          <button
                            key={post.id}
                            type="button"
                            onClick={() => openEditDraft(post)}
                            title={post.topic}
                            className={cx(
                              'w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight',
                              'transition-opacity hover:opacity-80',
                              PLATFORM_COLOURS[post.platform] ??
                                'bg-graystone-100 text-graystone-700',
                            )}
                          >
                            {post.platform} · {post.topic}
                          </button>
                        ))}
                      </div>
                    )}

                    <textarea
                      value={notes[iso] ?? ''}
                      onChange={(e) => handleChange(iso, e.target.value)}
                      placeholder="Notes…"
                      aria-label={`Planning notes for ${iso}`}
                      className="flex-1 resize-none bg-transparent p-1 text-[11px] leading-snug text-graystone-700 placeholder-graystone-300 focus:outline-none"
                    />

                    <div className="border-t border-graystone-100 px-1 py-0.5">
                      <button
                        type="button"
                        onClick={() => openNewDraft(iso)}
                        className="flex w-full items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-graystone-400 hover:bg-graystone-50 hover:text-ocean-600 transition-colors"
                        aria-label={`Add draft post for ${iso}`}
                      >
                        <svg
                          aria-hidden="true"
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        >
                          <line x1="5" y1="1" x2="5" y2="9" />
                          <line x1="1" y1="5" x2="9" y2="5" />
                        </svg>
                        Draft
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <DraftPostModal
        open={modal.open}
        date={modal.date || todayISO}
        existing={modal.existing}
        isSaving={isSaving}
        onSave={handleSave}
        onDelete={modal.existing ? handleDelete : undefined}
        onClose={() => setModal(CLOSED_MODAL)}
      />
    </>
  );
}

export default PlanningGrid;
