import type { ReactElement } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Textarea,
} from '../../../components/ui';
import type { QualitativeInsights, ReportType } from '../../../types/models';

interface QualitativeStepProps {
  reportType: ReportType;
  values: QualitativeInsights;
  onChange: (field: keyof QualitativeInsights, value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
}

const CORE_FIELDS: Array<{ field: keyof QualitativeInsights; label: string }> = [
  { field: 'whatWorked', label: 'What content performed best, and why do you think it resonated?' },
  { field: 'whatDidnt', label: 'What was challenging or underperformed?' },
  { field: 'themes', label: 'What themes or narratives connected most with your audience?' },
  {
    field: 'nextPeriodFocus',
    label: 'What are your priorities or focus areas for the next period?',
  },
  {
    field: 'highlights',
    label: 'Any notable highlights? (partnerships, campaigns, press mentions)',
  },
];

const QUARTERLY_FIELDS: Array<{ field: keyof QualitativeInsights; label: string; hint: string }> = [
  {
    field: 'audienceQuality',
    label: 'Audience quality check',
    hint: 'Review the 50 most engaged accounts per platform. Are we reaching more Deciders, Connectors, Shapers, and SRHR Advocates? Note any quarter-on-quarter shifts.',
  },
  {
    field: 'coalitionSignals',
    label: 'Coalition signals',
    hint: 'Are partner organisations, aligned NGOs, and research institutions sharing, citing, or amplifying PM content? Qualitative observation.',
  },
  {
    field: 'narrativeUptake',
    label: 'Narrative uptake',
    hint: 'Are PM\'s specific framings and terminology appearing in media coverage, parliamentary discourse, or partner communications? Note any "tracer phrases" spotted in the wild.',
  },
  {
    field: 'pillarPerformance',
    label: 'Content pillar performance',
    hint: 'Which pillars drove the most meaningful engagement? Does performance align with strategic priority? (The strategy drives pillar weighting — not the algorithm.)',
  },
  {
    field: 'platformTierReview',
    label: 'Platform tier review',
    hint: 'Should any channel move tier? Use the Platform Tiers and Strategic Functions table as the decision framework. Note any platform health signals.',
  },
];

export function QualitativeStep({
  reportType,
  values,
  onChange,
  onSubmit,
  onBack,
  loading,
}: QualitativeStepProps): ReactElement {
  const isDeepDive = reportType === 'quarterly' || reportType === 'annual';

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Capture qualitative insights</CardTitle>
        {isDeepDive && (
          <p className="text-sm text-graystone-500">
            This {reportType} report includes additional deep-dive sections.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {CORE_FIELDS.map(({ field, label }) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={`qualitative-${field}`}>{label}</Label>
            <Textarea
              id={`qualitative-${field}`}
              rows={3}
              className="w-full"
              value={values[field] ?? ''}
              onChange={(e) => onChange(field, e.target.value)}
            />
          </div>
        ))}

        {isDeepDive && (
          <>
            <div className="border-t border-graystone-200 pt-4">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-graystone-500">
                Quarterly deep-dive
              </h3>
              <div className="space-y-5">
                {QUARTERLY_FIELDS.map(({ field, label, hint }) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={`qualitative-${field}`}>{label}</Label>
                    <p className="text-xs text-graystone-500">{hint}</p>
                    <Textarea
                      id={`qualitative-${field}`}
                      rows={3}
                      className="w-full"
                      value={values[field] ?? ''}
                      onChange={(e) => onChange(field, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onBack} disabled={loading}>
            &larr; Back
          </Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Submit Report \u2192'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
