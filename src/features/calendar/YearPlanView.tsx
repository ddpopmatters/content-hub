import React, { useState } from 'react';
import { Button } from '../../components/ui';
import { cx } from '../../lib/utils';
import type { PlanningCampaign } from '../../hooks/domain/useYearPlan';
import { CampaignModal } from './CampaignModal';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

function dayOfYear(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function barPosition(
  campaign: PlanningCampaign,
  year: number,
): { left: string; width: string } | null {
  const total = daysInYear(year);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  if (campaign.startDate > yearEnd || campaign.endDate < yearStart) return null;

  const clampedStart = campaign.startDate < yearStart ? yearStart : campaign.startDate;
  const clampedEnd = campaign.endDate > yearEnd ? yearEnd : campaign.endDate;

  const startDay = dayOfYear(clampedStart);
  const endDay = dayOfYear(clampedEnd);
  const leftPct = clamp(((startDay - 1) / total) * 100, 0, 100);
  const widthPct = clamp(((endDay - startDay + 1) / total) * 100, 0.5, 100 - leftPct);

  return { left: `${leftPct.toFixed(2)}%`, width: `${widthPct.toFixed(2)}%` };
}

function todayBarPosition(year: number): number | null {
  const now = new Date();
  if (now.getFullYear() !== year) return null;
  const total = daysInYear(year);
  const day = dayOfYear(now.toISOString().slice(0, 10));
  return clamp(((day - 1) / total) * 100, 0, 100);
}

const TYPE_BADGE_CLASSES: Record<string, string> = {
  campaign: 'bg-ocean-100 text-ocean-700',
  theme: 'bg-purple-100 text-purple-700',
  series: 'bg-amber-100 text-amber-700',
};

interface YearPlanViewProps {
  campaigns: PlanningCampaign[];
  onAdd: (data: Omit<PlanningCampaign, 'id' | 'createdAt' | 'createdBy'>) => void;
  onUpdate: (
    id: string,
    updates: Partial<Omit<PlanningCampaign, 'id' | 'createdAt' | 'createdBy'>>,
  ) => void;
  onDelete: (id: string) => void;
}

export function YearPlanView({
  campaigns,
  onAdd,
  onUpdate,
  onDelete,
}: YearPlanViewProps): React.ReactElement {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editCampaign, setEditCampaign] = useState<PlanningCampaign | null>(null);

  const todayPct = todayBarPosition(year);

  const visibleCampaigns = campaigns
    .filter((c) => {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      return c.startDate <= yearEnd && c.endDate >= yearStart;
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            className="rounded-lg p-1.5 text-graystone-500 hover:bg-graystone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-400"
            aria-label="Previous year"
          >
            ←
          </button>
          <span className="min-w-[4ch] text-center text-lg font-semibold text-graystone-900">
            {year}
          </span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            className="rounded-lg p-1.5 text-graystone-500 hover:bg-graystone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-400"
            aria-label="Next year"
          >
            →
          </button>
        </div>
        <Button variant="default" size="sm" onClick={() => setShowAddModal(true)}>
          Add campaign
        </Button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 600 }}>
          {/* Month headers */}
          <div className="mb-1 flex" style={{ marginLeft: 180 }}>
            {MONTHS.map((m) => (
              <div key={m} className="flex-1 text-center text-xs text-graystone-500">
                {m}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="relative">
            {/* Month column dividers — rendered behind rows */}
            <div className="pointer-events-none absolute inset-0" style={{ left: 180 }}>
              {MONTHS.map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-graystone-100"
                  style={{ left: `${(i / 12) * 100}%` }}
                />
              ))}
              {/* Right edge */}
              <div className="absolute right-0 top-0 h-full border-l border-graystone-100" />
            </div>

            {/* Today line */}
            {todayPct !== null && (
              <div
                className="pointer-events-none absolute top-0 z-10 h-full w-px bg-ocean-400"
                style={{
                  left: `calc(180px + ${todayPct / 100} * (100% - 180px))`,
                }}
                aria-hidden="true"
              />
            )}

            {/* Empty state */}
            {visibleCampaigns.length === 0 && (
              <div className="py-12 text-center text-sm text-graystone-400">
                No campaigns yet for {year} — add one to get started.
              </div>
            )}

            {/* Campaign rows */}
            {visibleCampaigns.map((campaign) => {
              const pos = barPosition(campaign, year);
              const badgeClass =
                TYPE_BADGE_CLASSES[campaign.type] ?? 'bg-graystone-100 text-graystone-600';

              return (
                <div key={campaign.id} className="flex items-center py-1">
                  {/* Label column */}
                  <div className="flex shrink-0 items-center gap-1.5 pr-3" style={{ width: 180 }}>
                    <span className="truncate text-sm text-graystone-800" title={campaign.name}>
                      {campaign.name}
                    </span>
                    <span
                      className={cx(
                        'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
                        badgeClass,
                      )}
                    >
                      {campaign.type}
                    </span>
                  </div>

                  {/* Bar track */}
                  <div className="relative h-7 flex-1">
                    {pos && (
                      <button
                        type="button"
                        onClick={() => setEditCampaign(campaign)}
                        className="absolute inset-y-0.5 truncate rounded-md px-2 text-xs font-medium text-white hover:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-400 focus-visible:ring-offset-1"
                        style={{
                          left: pos.left,
                          width: pos.width,
                          backgroundColor: campaign.colour,
                        }}
                        title={campaign.name}
                        aria-label={`Edit campaign: ${campaign.name}`}
                      >
                        {campaign.name}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add modal */}
      {showAddModal && <CampaignModal onSave={onAdd} onClose={() => setShowAddModal(false)} />}

      {/* Edit modal */}
      {editCampaign && (
        <CampaignModal
          campaign={editCampaign}
          onSave={onAdd}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={() => setEditCampaign(null)}
        />
      )}
    </div>
  );
}

export default YearPlanView;
