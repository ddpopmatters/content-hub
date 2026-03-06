// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ReportingWorkspace } from '../ReportingWorkspace';
import { createReportingPeriod } from '../../../lib/reporting/reportCalculations';

describe('ReportingWorkspace', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('autosaves draft changes after a debounce', async () => {
    const report = createReportingPeriod('Monthly', 'Dan', new Date('2026-03-15'));
    const onUpdateReport = vi.fn<
      (id: string, updates: Partial<typeof report>) => typeof report | null
    >(() => report);

    render(
      <ReportingWorkspace
        entries={[]}
        reportingPeriods={[report]}
        onCreateReport={() => report}
        onUpdateReport={onUpdateReport}
        onRecalculateReport={() => report}
        onUpdateStatus={() => report}
        onDeleteReport={() => {}}
        onOpenAnalytics={() => {}}
        onOpenImport={() => {}}
      />,
    );

    const labelInput = screen.getByDisplayValue(report.label);
    fireEvent.change(labelInput, { target: { value: 'Monthly report • March refresh' } });

    await act(async () => {
      vi.advanceTimersByTime(550);
    });

    expect(onUpdateReport).toHaveBeenCalled();
    const firstCall = onUpdateReport.mock.calls[0];
    expect(firstCall?.[0]).toBe(report.id);
    expect(firstCall?.[1]?.label).toBe('Monthly report • March refresh');
  });
});
