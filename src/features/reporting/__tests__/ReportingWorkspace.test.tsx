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

  it('allows manual overrides for auto-filled reporting metrics', async () => {
    const report = createReportingPeriod('Monthly', 'Dan', new Date('2026-03-15'));
    report.metrics.tier1.nativeShares = {
      value: 12,
      unit: 'count',
      source: 'auto-filled',
      notes: '',
      updatedAt: new Date().toISOString(),
    };
    const onUpdateReport = vi.fn<
      (id: string, updates: Partial<typeof report>) => typeof report | null
    >((_id, updates) => ({ ...report, ...updates }));

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

    const nativeSharesInput = screen.getByDisplayValue('12');
    fireEvent.change(nativeSharesInput, { target: { value: '18' } });

    await act(async () => {
      vi.advanceTimersByTime(550);
    });

    const lastCall = onUpdateReport.mock.calls[onUpdateReport.mock.calls.length - 1];
    expect(lastCall?.[1]?.metrics?.tier1?.nativeShares?.value).toBe(18);
    expect(lastCall?.[1]?.metrics?.tier1?.nativeShares?.source).toBe('manual');
  });
});
