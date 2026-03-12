import type { ReactElement } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Label } from '../../../components/ui';
import { REPORTING_PLATFORM_METRICS } from '../../../constants';
import { inputBaseClasses } from '../../../lib/styles';

interface PlatformMetricsStepProps {
  metrics: Record<string, Record<string, number>>;
  periodLabel: string;
  onChange: (platform: string, key: string, value: number) => void;
  onNext: () => void;
  onBack: () => void;
}

const COUNT_KEYS = new Set(['numberOfPosts', 'numberOfStories']);

function formatPerPost(value: number, divisor: number): string {
  if (divisor <= 0 || !Number.isFinite(value) || value === 0) return '';
  const avg = value / divisor;
  const formatted = avg >= 100 ? avg.toFixed(0) : avg >= 10 ? avg.toFixed(1) : avg.toFixed(2);
  return `${formatted} per post`;
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
        {Object.keys(REPORTING_PLATFORM_METRICS).map((platform) => {
          const platformMetrics = metrics[platform] ?? {};
          const postCount = Number.isFinite(platformMetrics['numberOfPosts'])
            ? platformMetrics['numberOfPosts']
            : 0;
          const storyCount = Number.isFinite(platformMetrics['numberOfStories'])
            ? platformMetrics['numberOfStories']
            : 0;

          return (
            <Card key={platform} className="shadow-md">
              <CardHeader>
                <CardTitle>{platform}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {REPORTING_PLATFORM_METRICS[platform].map((metric) => {
                    const inputId = `${platform}-${metric.key}`;
                    const rawValue = platformMetrics[metric.key];
                    const value = Number.isFinite(rawValue) ? rawValue : 0;

                    const perPostLabel =
                      !metric.isRate && !COUNT_KEYS.has(metric.key)
                        ? formatPerPost(value, metric.key === 'storyViews' ? storyCount : postCount)
                        : '';

                    return (
                      <div key={metric.key} className="space-y-1">
                        <Label htmlFor={inputId}>{metric.label}</Label>
                        {metric.hint ? (
                          <p className="text-xs text-graystone-500">{metric.hint}</p>
                        ) : null}
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
                        {perPostLabel ? (
                          <p className="text-xs font-medium text-ocean-600">{perPostLabel}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" onClick={onBack}>
          &larr; Back
        </Button>
        <Button onClick={onNext}>Next &rarr;</Button>
      </div>
    </div>
  );
}
