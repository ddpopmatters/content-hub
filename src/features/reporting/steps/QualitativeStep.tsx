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
import type { QualitativeInsights } from '../../../types/models';

interface QualitativeStepProps {
  values: QualitativeInsights;
  onChange: (field: keyof QualitativeInsights, value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
}

const FIELD_CONFIG: Array<{ field: keyof QualitativeInsights; label: string }> = [
  {
    field: 'whatWorked',
    label: 'What content performed best this month, and why do you think it resonated?',
  },
  { field: 'whatDidnt', label: 'What was challenging or underperformed?' },
  {
    field: 'themes',
    label: 'What themes or narratives connected most with your audience?',
  },
  {
    field: 'nextMonthFocus',
    label: 'What are your priorities or focus areas for next month?',
  },
  {
    field: 'highlights',
    label: 'Any notable highlights? (partnerships, campaigns, press mentions)',
  },
];

export function QualitativeStep({
  values,
  onChange,
  onSubmit,
  onBack,
  loading,
}: QualitativeStepProps): ReactElement {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle>Capture qualitative insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {FIELD_CONFIG.map(({ field, label }) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={`qualitative-${field}`}>{label}</Label>
            <Textarea
              id={`qualitative-${field}`}
              rows={3}
              className="w-full"
              value={values[field]}
              onChange={(event) => onChange(field, event.target.value)}
            />
          </div>
        ))}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onBack} disabled={loading}>
            &larr; Back
          </Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Submit Report ->'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
