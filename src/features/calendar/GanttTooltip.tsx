import React, { useEffect, useRef, useState } from 'react';

export interface GanttTooltipItem {
  name: string;
  type: string;
  typeLabel: string;
  badgeClass: string;
  startDate: string;
  endDate: string;
  colour: string;
  notes?: string;
}

interface Position {
  x: number;
  y: number;
}

interface GanttTooltipProps {
  item: GanttTooltipItem | null;
  anchorPos: Position | null;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function durationLabel(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'}`;
  const months = Math.round(days / 30.44);
  return `${months} month${months === 1 ? '' : 's'}`;
}

const TOOLTIP_WIDTH = 240;
const TOOLTIP_OFFSET_Y = 12;

export function GanttTooltip({ item, anchorPos }: GanttTooltipProps): React.ReactElement | null {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useEffect(() => {
    if (!item || !anchorPos || !tooltipRef.current) {
      setStyle({ visibility: 'hidden' });
      return;
    }

    const tooltipHeight = tooltipRef.current.offsetHeight;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    let x = anchorPos.x - TOOLTIP_WIDTH / 2;
    let y = anchorPos.y + TOOLTIP_OFFSET_Y;

    // Clamp horizontally
    if (x + TOOLTIP_WIDTH > vpW - 8) x = vpW - TOOLTIP_WIDTH - 8;
    if (x < 8) x = 8;

    // Flip above if overflows below
    if (y + tooltipHeight > vpH - 8) {
      y = anchorPos.y - tooltipHeight - TOOLTIP_OFFSET_Y;
    }

    setStyle({ visibility: 'visible', left: x, top: y });
  }, [item, anchorPos]);

  if (!item) return null;

  const sameDay = item.startDate === item.endDate;

  return (
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        position: 'fixed',
        width: TOOLTIP_WIDTH,
        zIndex: 9999,
        pointerEvents: 'none',
        ...style,
      }}
      className="rounded-lg border border-graystone-200 bg-white shadow-lg"
    >
      {/* Colour accent bar */}
      <div className="h-1 rounded-t-lg" style={{ backgroundColor: item.colour }} />

      <div className="px-3 py-2.5 flex flex-col gap-1.5">
        {/* Name + type */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-graystone-900 leading-snug">{item.name}</span>
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${item.badgeClass}`}>
            {item.typeLabel}
          </span>
        </div>

        {/* Dates */}
        <div className="flex items-center gap-1 text-xs text-graystone-500">
          <svg
            aria-hidden="true"
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="1" y="2" width="10" height="9" rx="1.5" />
            <line x1="1" y1="5" x2="11" y2="5" />
            <line x1="4" y1="1" x2="4" y2="3" />
            <line x1="8" y1="1" x2="8" y2="3" />
          </svg>
          {sameDay ? (
            <span>{formatDate(item.startDate)}</span>
          ) : (
            <span>
              {formatDate(item.startDate)} – {formatDate(item.endDate)}
            </span>
          )}
        </div>

        {/* Duration */}
        {!sameDay && (
          <div className="text-xs text-graystone-400">
            {durationLabel(item.startDate, item.endDate)}
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <p className="text-xs text-graystone-600 border-t border-graystone-100 pt-1.5 mt-0.5 leading-snug">
            {item.notes}
          </p>
        )}
      </div>
    </div>
  );
}
