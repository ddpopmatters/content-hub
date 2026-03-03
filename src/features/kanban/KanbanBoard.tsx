import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { Badge, Button } from '../../components/ui';
import { cx } from '../../lib/utils';
import { selectBaseClasses } from '../../lib/styles';
import {
  PRIORITY_TIERS,
  PRIORITY_TIER_BADGE_CLASSES,
  PRIORITY_TIER_BORDER_CLASSES,
  PRIORITY_TIER_DOT_CLASSES,
} from '../../constants';
import { QuickAssessment } from '../assessment';
import type { Entry } from '../../types/models';

export interface KanbanBoardProps {
  /** Array of workflow status names for columns */
  statuses: readonly string[];
  /** Entries to display on the board */
  entries: Entry[];
  /** Callback when entry is opened */
  onOpen: (id: string) => void;
  /** Callback when entry status is updated */
  onUpdateStatus: (id: string, status: string) => void;
}

export function KanbanBoard({
  statuses,
  entries,
  onOpen,
  onUpdateStatus,
}: KanbanBoardProps): React.ReactElement {
  const [focusedColumnIndex, setFocusedColumnIndex] = useState(0);
  const [focusedCardIndex, setFocusedCardIndex] = useState(-1);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Default status for entries without a valid workflowStatus
  const defaultStatus = statuses[0] ?? '';

  // Build cards by column using single-pass reduce (memoized)
  const cardsByColumn = useMemo(() => {
    // Initialise empty arrays for each status
    const grouped = new Map<string, Entry[]>();
    statuses.forEach((status) => grouped.set(status, []));

    // Single pass through entries
    entries.forEach((entry) => {
      // Normalise: use entry's status if valid, otherwise default to first column
      const status =
        entry.workflowStatus && statuses.includes(entry.workflowStatus)
          ? entry.workflowStatus
          : defaultStatus;

      const column = grouped.get(status);
      if (column) {
        column.push(entry);
      }
    });

    // Return as array in statuses order
    return statuses.map((status) => grouped.get(status) ?? []);
  }, [statuses, entries, defaultStatus]);

  // Reset focus and clear refs only when statuses change (not on every entries change)
  useEffect(() => {
    setFocusedColumnIndex(0);
    setFocusedCardIndex(-1);
    columnRefs.current = [];
    cardRefs.current = {};
  }, [statuses]);

  // Validate focus indices when entries change (without full reset)
  useEffect(() => {
    // If focused column is out of bounds, reset
    if (focusedColumnIndex >= statuses.length) {
      setFocusedColumnIndex(Math.max(0, statuses.length - 1));
      setFocusedCardIndex(-1);
      return;
    }

    // If focused card is out of bounds for current column, adjust
    const currentColumnCards = cardsByColumn[focusedColumnIndex] ?? [];
    if (focusedCardIndex >= currentColumnCards.length) {
      setFocusedCardIndex(Math.max(-1, currentColumnCards.length - 1));
    }
  }, [entries, statuses.length, focusedColumnIndex, focusedCardIndex, cardsByColumn]);

  const handleColumnKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, columnIndex: number) => {
      const cards = cardsByColumn[columnIndex] ?? [];

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          if (columnIndex < statuses.length - 1) {
            setFocusedColumnIndex(columnIndex + 1);
            setFocusedCardIndex(-1);
            columnRefs.current[columnIndex + 1]?.focus();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (columnIndex > 0) {
            setFocusedColumnIndex(columnIndex - 1);
            setFocusedCardIndex(-1);
            columnRefs.current[columnIndex - 1]?.focus();
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (cards.length > 0) {
            setFocusedCardIndex(0);
            cardRefs.current[`${columnIndex}-0`]?.focus();
          }
          break;
      }
    },
    [statuses.length, cardsByColumn],
  );

  const handleCardKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, columnIndex: number, cardIndex: number, entryId: string) => {
      const cards = cardsByColumn[columnIndex] ?? [];

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (cardIndex < cards.length - 1) {
            setFocusedCardIndex(cardIndex + 1);
            cardRefs.current[`${columnIndex}-${cardIndex + 1}`]?.focus();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (cardIndex > 0) {
            setFocusedCardIndex(cardIndex - 1);
            cardRefs.current[`${columnIndex}-${cardIndex - 1}`]?.focus();
          } else {
            // Move back to column header
            setFocusedCardIndex(-1);
            columnRefs.current[columnIndex]?.focus();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (columnIndex < statuses.length - 1) {
            // Move to same card index in next column, or last card if not available
            const nextCards = cardsByColumn[columnIndex + 1] ?? [];
            const nextCardIndex = Math.min(cardIndex, nextCards.length - 1);
            setFocusedColumnIndex(columnIndex + 1);
            if (nextCardIndex >= 0) {
              setFocusedCardIndex(nextCardIndex);
              cardRefs.current[`${columnIndex + 1}-${nextCardIndex}`]?.focus();
            } else {
              setFocusedCardIndex(-1);
              columnRefs.current[columnIndex + 1]?.focus();
            }
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (columnIndex > 0) {
            // Move to same card index in previous column, or last card if not available
            const prevCards = cardsByColumn[columnIndex - 1] ?? [];
            const prevCardIndex = Math.min(cardIndex, prevCards.length - 1);
            setFocusedColumnIndex(columnIndex - 1);
            if (prevCardIndex >= 0) {
              setFocusedCardIndex(prevCardIndex);
              cardRefs.current[`${columnIndex - 1}-${prevCardIndex}`]?.focus();
            } else {
              setFocusedCardIndex(-1);
              columnRefs.current[columnIndex - 1]?.focus();
            }
          }
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onOpen(entryId);
          break;
        case 'Escape':
          e.preventDefault();
          // Move focus back to column
          setFocusedCardIndex(-1);
          columnRefs.current[columnIndex]?.focus();
          break;
      }
    },
    [statuses.length, cardsByColumn, onOpen],
  );

  // Guard against empty statuses
  if (statuses.length === 0) {
    return (
      <div className="rounded-xl border border-graystone-200 bg-graystone-50 px-4 py-8 text-center text-sm text-graystone-500">
        No workflow statuses configured.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4" role="region" aria-label="Kanban board">
      <div className="flex min-w-max gap-4" role="list" aria-label="Workflow columns">
        {statuses.map((status, columnIndex) => {
          const cards = cardsByColumn[columnIndex] ?? [];
          const isFocusedColumn = focusedColumnIndex === columnIndex;
          return (
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <div
              key={status}
              ref={(el) => {
                columnRefs.current[columnIndex] = el;
              }}
              tabIndex={isFocusedColumn && focusedCardIndex === -1 ? 0 : -1}
              role="listitem"
              aria-label={`${status} column, ${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`}
              onKeyDown={(e) => handleColumnKeyDown(e, columnIndex)}
              className={cx(
                'w-72 shrink-0 outline-none rounded-lg',
                'focus:ring-2 focus:ring-aqua-500 focus:ring-offset-2',
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-ocean-700">{status}</div>
                <Badge variant="secondary">{cards.length}</Badge>
              </div>
              <div className="space-y-3">
                {cards.length === 0 ? (
                  <div className="rounded-xl border border-aqua-200 bg-aqua-50 px-3 py-4 text-xs text-graystone-500">
                    Nothing here yet.
                  </div>
                ) : (
                  cards.map((entry, cardIndex) => {
                    const isFocusedCard = isFocusedColumn && focusedCardIndex === cardIndex;
                    // Normalise display value for select
                    const displayStatus =
                      entry.workflowStatus && statuses.includes(entry.workflowStatus)
                        ? entry.workflowStatus
                        : defaultStatus;
                    const priorityTier = PRIORITY_TIERS.includes(entry.priorityTier)
                      ? entry.priorityTier
                      : 'Medium';
                    return (
                      /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
                      <div
                        key={entry.id}
                        ref={(el) => {
                          cardRefs.current[`${columnIndex}-${cardIndex}`] = el;
                        }}
                        tabIndex={isFocusedCard ? 0 : -1}
                        role="article"
                        aria-label={`${entry.caption || 'Untitled'}, ${entry.assetType}, ${entry.status}`}
                        onKeyDown={(e) => handleCardKeyDown(e, columnIndex, cardIndex, entry.id)}
                        className={cx(
                          'space-y-2 rounded-2xl border border-graystone-200 border-l-4 bg-white p-3 shadow-sm outline-none',
                          PRIORITY_TIER_BORDER_CLASSES[priorityTier],
                          'focus:ring-2 focus:ring-aqua-500 focus:ring-offset-1',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{entry.assetType}</Badge>
                            <Badge className={PRIORITY_TIER_BADGE_CLASSES[priorityTier]}>
                              <span
                                className={cx(
                                  'mr-1 inline-block h-1.5 w-1.5 rounded-full',
                                  PRIORITY_TIER_DOT_CLASSES[priorityTier],
                                )}
                              />
                              {priorityTier}
                            </Badge>
                          </div>
                          {entry.analytics && Object.keys(entry.analytics).length ? (
                            <span className="rounded-full bg-ocean-500/10 px-2 py-0.5 text-[11px] font-semibold text-ocean-700">
                              Performance
                            </span>
                          ) : null}
                          <select
                            value={displayStatus}
                            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                              onUpdateStatus(entry.id, event.target.value)
                            }
                            className={cx(selectBaseClasses, 'w-32 px-3 py-1 text-xs')}
                          >
                            {statuses.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <div className="line-clamp-2 text-sm font-semibold text-graystone-800">
                            {entry.caption || 'Untitled'}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-[11px] text-graystone-500">
                            {entry.campaign ? (
                              <span className="rounded-full bg-aqua-100 px-2 py-0.5 text-ocean-700">
                                {entry.campaign}
                              </span>
                            ) : null}
                            {entry.contentPillar ? (
                              <span className="rounded-full bg-graystone-100 px-2 py-0.5 text-graystone-700">
                                {entry.contentPillar}
                              </span>
                            ) : null}
                            {entry.testingFrameworkName ? (
                              <span className="rounded-full bg-ocean-500/10 px-2 py-0.5 text-ocean-700">
                                Test: {entry.testingFrameworkName}
                              </span>
                            ) : null}
                            {(!entry.contentPillar ||
                              !entry.audienceSegments?.length ||
                              !entry.assessmentScores?.quick) && (
                              <span
                                className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700"
                                title="Missing strategy fields"
                              >
                                Strategy incomplete
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-graystone-500">
                          <span>{new Date(entry.date).toLocaleDateString()}</span>
                          {entry.platforms && entry.platforms.length > 0 && (
                            <span>{entry.platforms.join(', ')}</span>
                          )}
                        </div>
                        {entry.firstComment && (
                          <div className="line-clamp-2 rounded-xl bg-aqua-50 px-2 py-1 text-[11px] text-ocean-700">
                            {entry.firstComment}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpen(entry.id)}
                            className="text-xs"
                          >
                            Open
                          </Button>
                          <div className="flex items-center gap-2">
                            {entry.goldenThreadPass !== undefined &&
                              entry.goldenThreadPass !== null && (
                                <span
                                  className={cx(
                                    'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white',
                                    entry.goldenThreadPass ? 'bg-emerald-500' : 'bg-red-500',
                                  )}
                                  title={
                                    entry.goldenThreadPass
                                      ? 'Golden Thread passed'
                                      : 'Golden Thread failed'
                                  }
                                >
                                  {entry.goldenThreadPass ? '\u2713' : '\u2717'}
                                </span>
                              )}
                            {entry.assessmentScores?.quick && (
                              <QuickAssessment
                                values={entry.assessmentScores.quick}
                                onChange={() => {}}
                                readOnly
                                compact
                              />
                            )}
                            <span className="text-[11px] uppercase tracking-wide text-graystone-400">
                              {entry.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default KanbanBoard;
