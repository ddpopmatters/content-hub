import type { ReactElement } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Label } from '../../../components/ui';
import { PLATFORM_METRICS } from '../../../constants';
import { inputBaseClasses } from '../../../lib/styles';

interface PlatformMetricsStepProps {
  metrics: Record<string, Record<string, number>>;
  periodLabel: string;
  onChange: (platform: string, key: string, value: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PlatformMetricsStep({
  metrics,
  periodLabel,
  onChange,
  onNext,
  onBack,
}: PlatformMetricsStepProps): ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-ocean-900">
          Enter platform metrics for {periodLabel}
        </h2>
        <p className="mt-1 text-sm text-graystone-600">
          Leave any field blank if you do not have that figure yet.
        </p>
      </div>

      <div className="space-y-4">
        {Object.keys(PLATFORM_METRICS).map((platform) => (
          <Card key={platform} className="shadow-md">
            <CardHeader>
              <CardTitle>{platform}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {PLATFORM_METRICS[platform].map((metric) => {
                  const inputId = `${platform}-${metric.key}`;

                  return (
                    <div key={metric.key} className="space-y-2">
                      <Label htmlFor={inputId}>{metric.label}</Label>
                      <input
                        id={inputId}
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={metrics[platform]?.[metric.key] ?? ''}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          onChange(
                            platform,
                            metric.key,
                            nextValue === '' ? Number.NaN : Number(nextValue),
                          );
                        }}
                        className={inputBaseClasses}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={onBack}>
          &larr; Back
        </Button>
        <Button onClick={onNext}>Next -&gt;</Button>
      </div>
    </div>
  );
}
