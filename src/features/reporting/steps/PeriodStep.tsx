import type { ReactElement } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Label } from '../../../components/ui';
import { inputBaseClasses, selectBaseClasses } from '../../../lib/styles';
import type { ReportType } from '../../../types/models';

const REPORT_TYPES: { value: ReportType; label: string; description: string }[] = [
  {
    value: 'monthly',
    label: 'Monthly',
    description: 'Performance report — first week of the month',
  },
  {
    value: 'quarterly',
    label: 'Quarterly',
    description: 'Deep dive — audience quality, pillars, platform tier review',
  },
  { value: 'annual', label: 'Annual', description: 'Full-year review for Board reporting' },
  {
    value: 'campaign',
    label: 'Campaign',
    description: 'World Population Day, Lancet launches, COP, 16 Days, etc.',
  },
];

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const QUARTER_OPTIONS = [
  { value: 1, label: 'Q1 (Jan – Mar)' },
  { value: 2, label: 'Q2 (Apr – Jun)' },
  { value: 3, label: 'Q3 (Jul – Sep)' },
  { value: 4, label: 'Q4 (Oct – Dec)' },
];

const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

export interface PeriodSelection {
  reportType: ReportType;
  month: number;
  quarter: number;
  year: number;
  campaignName: string;
  dateFrom: string;
  dateTo: string;
}

interface PeriodStepProps {
  period: PeriodSelection;
  onChange: (next: Partial<PeriodSelection>) => void;
  existingReportId?: string;
  onNext: () => void;
}

export function PeriodStep({
  period,
  onChange,
  existingReportId,
  onNext,
}: PeriodStepProps): ReactElement {
  const { reportType, month, quarter, year, campaignName, dateFrom, dateTo } = period;

  const canProceed =
    reportType === 'campaign' ? campaignName.trim().length > 0 && !!dateFrom && !!dateTo : true;

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="shadow-xl">
        <CardHeader className="border-b-0 pb-2 text-center">
          <CardTitle className="text-2xl">Select reporting period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Report type</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {REPORT_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  type="button"
                  onClick={() => onChange({ reportType: rt.value })}
                  className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                    reportType === rt.value
                      ? 'border-ocean-500 bg-ocean-50 font-semibold text-ocean-900'
                      : 'border-graystone-200 text-graystone-700 hover:border-ocean-300 hover:bg-graystone-50'
                  }`}
                >
                  <div className="font-medium">{rt.label}</div>
                  <div className="mt-0.5 text-xs leading-snug text-graystone-500">
                    {rt.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {reportType === 'monthly' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reporting-month">Month</Label>
                <select
                  id="reporting-month"
                  value={month}
                  onChange={(e) => onChange({ month: Number(e.target.value) })}
                  className={`${selectBaseClasses} w-full`}
                >
                  {MONTH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reporting-year">Year</Label>
                <select
                  id="reporting-year"
                  value={year}
                  onChange={(e) => onChange({ year: Number(e.target.value) })}
                  className={`${selectBaseClasses} w-full`}
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {reportType === 'quarterly' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reporting-quarter">Quarter</Label>
                <select
                  id="reporting-quarter"
                  value={quarter}
                  onChange={(e) => onChange({ quarter: Number(e.target.value) })}
                  className={`${selectBaseClasses} w-full`}
                >
                  {QUARTER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reporting-year-q">Year</Label>
                <select
                  id="reporting-year-q"
                  value={year}
                  onChange={(e) => onChange({ year: Number(e.target.value) })}
                  className={`${selectBaseClasses} w-full`}
                >
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {reportType === 'annual' && (
            <div className="space-y-2">
              <Label htmlFor="reporting-year-a">Year</Label>
              <select
                id="reporting-year-a"
                value={year}
                onChange={(e) => onChange({ year: Number(e.target.value) })}
                className={`${selectBaseClasses} w-full`}
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportType === 'campaign' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign name</Label>
                <input
                  id="campaign-name"
                  type="text"
                  placeholder="e.g. World Population Day 2026"
                  value={campaignName}
                  onChange={(e) => onChange({ campaignName: e.target.value })}
                  className={`${inputBaseClasses} w-full`}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date-from">Start date</Label>
                  <input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => onChange({ dateFrom: e.target.value })}
                    className={`${inputBaseClasses} w-full`}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-to">End date</Label>
                  <input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => onChange({ dateTo: e.target.value })}
                    className={`${inputBaseClasses} w-full`}
                  />
                </div>
              </div>
            </div>
          )}

          {existingReportId ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              A report already exists for this period. Submitting will update it.
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={onNext} disabled={!canProceed} className="w-full sm:w-auto">
              Next &rarr;
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
