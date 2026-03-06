import { describe, expect, it } from 'vitest';
import { calculateReportCompleteness } from '../reportCompleteness';
import { createReportingPeriod } from '../reportCalculations';
import { getMetricDefinitionsForCadence, REPORT_QUALITATIVE_FIELDS } from '../metricRegistry';
import type { ReportingPeriod } from '../../../types/models';

const fillReport = (report: ReportingPeriod) => {
  getMetricDefinitionsForCadence(report.cadence).forEach((definition) => {
    report.metrics[definition.group][definition.id] = {
      value: definition.inputType === 'text' ? 'Filled' : 1,
      unit: definition.unit,
      source: definition.sourceType === 'manual' ? 'manual' : 'auto-filled',
      notes: '',
      updatedAt: new Date().toISOString(),
    };
  });

  Object.keys(report.narrative).forEach((field) => {
    report.narrative[field as keyof ReportingPeriod['narrative']] = 'Filled';
  });

  REPORT_QUALITATIVE_FIELDS[report.cadence].forEach((field) => {
    if (
      field.id in report.qualitative &&
      typeof report.qualitative[field.id as keyof ReportingPeriod['qualitative']] === 'string'
    ) {
      report.qualitative[field.id as keyof ReportingPeriod['qualitative']] = 'Filled' as never;
    }
  });

  return report;
};

describe('reportCompleteness', () => {
  it('flags missing manual metrics and qualitative sections', () => {
    const report = createReportingPeriod('Monthly', 'Dan', new Date('2026-03-10'));

    const completeness = calculateReportCompleteness(report);

    expect(completeness.complete).toBe(false);
    expect(completeness.missingMetricIds).toContain('employeeAdvocacyReach');
    expect(completeness.missingNarrativeIds).toContain('executiveSummary');
    expect(completeness.missingQualitativeIds).toContain('topContentNotes');
  });

  it('marks a report complete once required fields are filled', () => {
    const report = fillReport(createReportingPeriod('Quarterly', 'Dan', new Date('2026-03-31')));

    const completeness = calculateReportCompleteness(report);

    expect(completeness.complete).toBe(true);
    expect(completeness.completionRatio).toBe(100);
    expect(completeness.missingMetricIds).toEqual([]);
    expect(completeness.missingNarrativeIds).toEqual([]);
    expect(completeness.missingQualitativeIds).toEqual([]);
  });
});
