import type { ReportCadence, ReportingPeriod } from '../../types/models';
import { getMetricDefinitionsForCadence, REPORT_QUALITATIVE_FIELDS } from './metricRegistry';

const isEmptyValue = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (typeof value === 'number' && Number.isNaN(value));

const requiredNarrativeFieldsByCadence: Record<
  ReportCadence,
  (keyof ReportingPeriod['narrative'])[]
> = {
  Weekly: ['wins', 'risks', 'nextActions'],
  Monthly: [
    'executiveSummary',
    'notableMoments',
    'wins',
    'risks',
    'nextActions',
    'audienceQualityNotes',
    'sentimentSummary',
  ],
  Quarterly: [
    'executiveSummary',
    'notableMoments',
    'wins',
    'risks',
    'nextActions',
    'audienceQualityNotes',
    'sentimentSummary',
    'platformHealthCommentary',
  ],
  Annual: ['executiveSummary', 'wins', 'risks', 'nextActions', 'annualReflection'],
};

export const calculateReportCompleteness = (report: ReportingPeriod) => {
  const metricDefs = getMetricDefinitionsForCadence(report.cadence).filter((metric) => metric.required);
  const missingMetricIds = metricDefs
    .filter((metric) => isEmptyValue(report.metrics[metric.group][metric.id]?.value))
    .map((metric) => metric.id);

  const requiredNarrativeIds = requiredNarrativeFieldsByCadence[report.cadence];
  const missingNarrativeIds = requiredNarrativeIds.filter((field) =>
    isEmptyValue(report.narrative[field]),
  );

  const qualitativeFields = REPORT_QUALITATIVE_FIELDS[report.cadence]
    .map((field) => field.id)
    .filter((field) => field in report.qualitative) as (keyof ReportingPeriod['qualitative'])[];
  const missingQualitativeIds = qualitativeFields.filter((field) =>
    isEmptyValue(report.qualitative[field]),
  );

  const requiredCount = metricDefs.length + requiredNarrativeIds.length + qualitativeFields.length;
  const missingCount =
    missingMetricIds.length + missingNarrativeIds.length + missingQualitativeIds.length;
  const completionRatio = requiredCount
    ? Number((((requiredCount - missingCount) / requiredCount) * 100).toFixed(2))
    : 100;

  return {
    complete: missingCount === 0,
    completionRatio,
    missingMetricIds,
    missingNarrativeIds,
    missingQualitativeIds,
    lastCheckedAt: new Date().toISOString(),
  };
};
