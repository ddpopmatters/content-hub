import type { ReactElement } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Label } from '../../../components/ui';
import { selectBaseClasses } from '../../../lib/styles';

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

const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

interface PeriodStepProps {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
  existingReportId?: string;
  onNext: () => void;
}

export function PeriodStep({
  month,
  year,
  onChange,
  existingReportId,
  onNext,
}: PeriodStepProps): ReactElement {
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="shadow-xl">
        <CardHeader className="border-b-0 pb-2 text-center">
          <CardTitle className="text-2xl">Select reporting period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reporting-month">Month</Label>
              <select
                id="reporting-month"
                value={month}
                onChange={(event) => onChange(Number(event.target.value), year)}
                className={`${selectBaseClasses} w-full`}
              >
                {MONTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reporting-year">Year</Label>
              <select
                id="reporting-year"
                value={year}
                onChange={(event) => onChange(month, Number(event.target.value))}
                className={`${selectBaseClasses} w-full`}
              >
                {YEAR_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {existingReportId ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              A report already exists for this period. Submitting will update it.
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={onNext} className="w-full sm:w-auto">
              Next -&gt;
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
