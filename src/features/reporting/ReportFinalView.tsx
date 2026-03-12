import type { ReactElement } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../../components/ui';
import { REPORTING_PLATFORM_METRICS } from '../../constants';
import type { MonthlyReport } from '../../types/models';
import { generateMonthlyReportPdf } from './reportPdf';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const QUARTER_NAMES = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)'];

const CORE_QUALITATIVE_SECTIONS: Array<{
  field: keyof MonthlyReport['qualitative'];
  heading: string;
}> = [
  { field: 'whatWorked', heading: 'What Worked' },
  { field: 'whatDidnt', heading: 'Challenges' },
  { field: 'themes', heading: 'Audience Themes' },
  { field: 'nextPeriodFocus', heading: 'Focus for Next Period' },
  { field: 'highlights', heading: 'Highlights' },
];

const DEEP_DIVE_SECTIONS: Array<{
  field: keyof MonthlyReport['qualitative'];
  heading: string;
}> = [
  { field: 'audienceQuality', heading: 'Audience Quality Check' },
  { field: 'coalitionSignals', heading: 'Coalition Signals' },
  { field: 'narrativeUptake', heading: 'Narrative Uptake' },
  { field: 'pillarPerformance', heading: 'Content Pillar Performance' },
  { field: 'platformTierReview', heading: 'Platform Tier Review' },
];

const buildReportHeading = (report: MonthlyReport): string => {
  const type = report.reportType ?? 'monthly';
  if (type === 'monthly') {
    const month = MONTH_NAMES[(report.periodMonth ?? 1) - 1] ?? 'Unknown';
    return `${month} ${report.periodYear} — Monthly Social Media Report`;
  }
  if (type === 'quarterly') {
    const quarter = QUARTER_NAMES[(report.periodQuarter ?? 1) - 1] ?? 'Q?';
    return `${quarter} ${report.periodYear} — Quarterly Deep Dive`;
  }
  if (type === 'annual') return `${report.periodYear} — Annual Review`;
  return `${report.campaignName ?? 'Campaign'} — Campaign Report`;
};

interface ReportFinalViewProps {
  report: MonthlyReport;
  onNewReport: () => void;
}

export function ReportFinalView({ report, onNewReport }: ReportFinalViewProps): ReactElement {
  const heading = buildReportHeading(report);
  const generatedDate = new Date(report.updatedAt || report.createdAt).toLocaleDateString();
  const isDeepDive = report.reportType === 'quarterly' || report.reportType === 'annual';

  const platformsWithData = Object.keys(REPORTING_PLATFORM_METRICS).filter((platform) =>
    REPORTING_PLATFORM_METRICS[platform].some(
      (metric) => (report.platformMetrics[platform]?.[metric.key] ?? 0) > 0,
    ),
  );

  const allQualSections = isDeepDive
    ? [...CORE_QUALITATIVE_SECTIONS, ...DEEP_DIVE_SECTIONS]
    : CORE_QUALITATIVE_SECTIONS;

  const populatedQualSections = allQualSections.filter(
    ({ field }) => (report.qualitative[field] ?? '').trim().length > 0,
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        ✓ Report saved
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-semibold text-ocean-900">{heading}</h2>
        <p className="text-sm text-graystone-600">
          Generated {generatedDate} by {report.createdBy}
        </p>
      </div>

      {platformsWithData.length > 0 ? (
        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-ocean-900">Platform Metrics</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {platformsWithData.map((platform) => (
              <Card key={platform} className="shadow-md">
                <CardHeader>
                  <CardTitle>{platform}</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <tbody>
                      {REPORTING_PLATFORM_METRICS[platform]
                        .map((metric) => ({
                          ...metric,
                          value: report.platformMetrics[platform]?.[metric.key] ?? 0,
                        }))
                        .filter((metric) => metric.value > 0)
                        .map((metric) => (
                          <tr
                            key={metric.key}
                            className="border-b border-graystone-100 last:border-b-0"
                          >
                            <td className="py-2 text-graystone-600">{metric.label}</td>
                            <td className="py-2 text-right font-semibold text-ocean-900">
                              {metric.value.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {populatedQualSections.length > 0 ? (
        <section className="space-y-4">
          <h3 className="text-xl font-semibold text-ocean-900">Qualitative Insights</h3>
          <Card className="shadow-md">
            <CardContent className="space-y-5 pt-6">
              {populatedQualSections.map(({ field, heading: sectionHeading }) => (
                <div key={field} className="space-y-1">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-ocean-700">
                    {sectionHeading}
                  </h4>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-graystone-700">
                    {report.qualitative[field]}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => generateMonthlyReportPdf(report)}>Export as PDF</Button>
        <Button variant="outline" onClick={onNewReport}>
          Create New Report
        </Button>
      </div>
    </div>
  );
}
