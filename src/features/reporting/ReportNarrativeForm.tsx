import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, Textarea } from '../../components/ui';
import type { ReportingPeriod } from '../../types/models';
import { REPORT_QUALITATIVE_FIELDS } from '../../lib/reporting/metricRegistry';

interface ReportNarrativeFormProps {
  report: ReportingPeriod;
  onNarrativeChange: (field: keyof ReportingPeriod['narrative'], value: string) => void;
  onQualitativeChange: (field: keyof ReportingPeriod['qualitative'], value: string) => void;
}

export function ReportNarrativeForm({
  report,
  onNarrativeChange,
  onQualitativeChange,
}: ReportNarrativeFormProps): React.ReactElement {
  const fields = REPORT_QUALITATIVE_FIELDS[report.cadence];

  return (
    <Card className="shadow-md">
      <CardHeader className="border-b border-graystone-100">
        <CardTitle>Qualitative reporting</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {fields.map((field) => {
          const narrativeValue =
            field.id in report.narrative
              ? report.narrative[field.id as keyof ReportingPeriod['narrative']]
              : null;
          const qualitativeValue =
            field.id in report.qualitative
              ? report.qualitative[field.id as keyof ReportingPeriod['qualitative']]
              : null;
          return (
            <div key={field.id} className="space-y-2">
              <div>
                <div className="text-sm font-semibold text-ocean-900">{field.label}</div>
                <p className="text-xs text-graystone-500">{field.description}</p>
              </div>
              <Textarea
                value={(narrativeValue as string) ?? (qualitativeValue as string) ?? ''}
                onChange={(event) => {
                  if (field.id in report.narrative) {
                    onNarrativeChange(
                      field.id as keyof ReportingPeriod['narrative'],
                      event.target.value,
                    );
                    return;
                  }
                  onQualitativeChange(
                    field.id as keyof ReportingPeriod['qualitative'],
                    event.target.value,
                  );
                }}
                rows={4}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default ReportNarrativeForm;
