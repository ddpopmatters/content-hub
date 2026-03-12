import { useEffect, useState, type ReactElement } from 'react';
import { REPORTING_PLATFORM_METRICS } from '../../constants';
import { SUPABASE_API } from '../../lib/supabase';
import type { MonthlyReport, QualitativeInsights, ReportType } from '../../types/models';
import { ReportFinalView } from './ReportFinalView';
import { PeriodStep, type PeriodSelection } from './steps/PeriodStep';
import { PlatformMetricsStep } from './steps/PlatformMetricsStep';
import { QualitativeStep } from './steps/QualitativeStep';

type WizardStep = 0 | 1 | 2 | 3;
type SlideDirection = 'forward' | 'back';

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

const EMPTY_QUALITATIVE: QualitativeInsights = {
  whatWorked: '',
  whatDidnt: '',
  themes: '',
  nextPeriodFocus: '',
  highlights: '',
};

const STEP_LABELS = [
  '1 of 3 — Reporting Period',
  '2 of 3 — Platform Metrics',
  '3 of 3 — Insights',
  'Report Ready',
] as const;

const getDefaultPeriod = (): PeriodSelection => {
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  return {
    reportType: 'monthly',
    month: prev.getMonth() + 1,
    quarter: Math.floor(prev.getMonth() / 3) + 1,
    year: prev.getFullYear(),
    campaignName: '',
    dateFrom: '',
    dateTo: '',
  };
};

const buildPeriodLabel = (period: PeriodSelection): string => {
  const { reportType, month, quarter, year, campaignName } = period;
  if (reportType === 'monthly') return `${MONTH_NAMES[month - 1] ?? 'Unknown'} ${year}`;
  if (reportType === 'quarterly') return `${QUARTER_NAMES[quarter - 1] ?? 'Q?'} ${year}`;
  if (reportType === 'annual') return `${year} Annual`;
  return campaignName || 'Campaign';
};

const buildReportTypeLabel = (type: ReportType): string => {
  const labels: Record<ReportType, string> = {
    monthly: 'Monthly Report',
    quarterly: 'Quarterly Deep Dive',
    annual: 'Annual Review',
    campaign: 'Campaign Report',
  };
  return labels[type];
};

const normalizePlatformMetrics = (
  metrics: Record<string, Record<string, number>>,
): Record<string, Record<string, number>> =>
  Object.fromEntries(
    Object.entries(REPORTING_PLATFORM_METRICS).map(([platform, definitions]) => [
      platform,
      Object.fromEntries(
        definitions.map((metric) => [
          metric.key,
          Number.isFinite(metrics[platform]?.[metric.key]) ? metrics[platform][metric.key] : 0,
        ]),
      ),
    ]),
  );

interface ReportingViewProps {
  currentUser: string;
  currentUserEmail: string;
}

export function ReportingView({ currentUser, currentUserEmail }: ReportingViewProps): ReactElement {
  const [step, setStep] = useState<WizardStep>(0);
  const [slideDir, setSlideDir] = useState<SlideDirection>('forward');
  const [period, setPeriod] = useState<PeriodSelection>(getDefaultPeriod);
  const [platformMetrics, setPlatformMetrics] = useState<Record<string, Record<string, number>>>(
    {},
  );
  const [qualitative, setQualitative] = useState<QualitativeInsights>(EMPTY_QUALITATIVE);
  const [existingReportId, setExistingReportId] = useState<string | undefined>(undefined);
  const [savedReport, setSavedReport] = useState<MonthlyReport | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load an existing monthly report when period changes (monthly only for now)
  useEffect(() => {
    if (period.reportType !== 'monthly') {
      setExistingReportId(undefined);
      setPlatformMetrics({});
      setQualitative(EMPTY_QUALITATIVE);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMessage(null);

    SUPABASE_API.getMonthlyReport(period.year, period.month)
      .then((report) => {
        if (cancelled) return;
        if (report) {
          setExistingReportId(report.id);
          setPlatformMetrics(report.platformMetrics || {});
          setQualitative({ ...EMPTY_QUALITATIVE, ...report.qualitative });
        } else {
          setExistingReportId(undefined);
          setPlatformMetrics({});
          setQualitative(EMPTY_QUALITATIVE);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('Unable to load an existing report for that period.');
          setExistingReportId(undefined);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [period.reportType, period.month, period.year]);

  const goNext = () => {
    setSlideDir('forward');
    setStep((s) => (s < 3 ? ((s + 1) as WizardStep) : s));
  };

  const goBack = () => {
    setSlideDir('back');
    setStep((s) => (s > 0 ? ((s - 1) as WizardStep) : s));
  };

  const handlePeriodChange = (next: Partial<PeriodSelection>) => {
    setPeriod((current) => ({ ...current, ...next }));
    setSavedReport(undefined);
  };

  const handleMetricChange = (platform: string, key: string, value: number) => {
    setPlatformMetrics((current) => {
      const next = { ...current, [platform]: { ...(current[platform] || {}) } };
      if (!Number.isFinite(value)) {
        delete next[platform][key];
        if (Object.keys(next[platform]).length === 0) delete next[platform];
        return next;
      }
      next[platform][key] = value;
      return next;
    });
  };

  const handleQualitativeChange = (field: keyof QualitativeInsights, value: string) => {
    setQualitative((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const report = await SUPABASE_API.saveMonthlyReport(
        {
          reportType: period.reportType,
          periodMonth: period.reportType === 'monthly' ? period.month : undefined,
          periodQuarter: period.reportType === 'quarterly' ? period.quarter : undefined,
          periodYear: period.year,
          campaignName: period.reportType === 'campaign' ? period.campaignName : undefined,
          dateFrom: period.reportType === 'campaign' ? period.dateFrom : undefined,
          dateTo: period.reportType === 'campaign' ? period.dateTo : undefined,
          platformMetrics: normalizePlatformMetrics(platformMetrics),
          qualitative,
          createdBy: currentUser,
          createdByEmail: currentUserEmail,
        },
        existingReportId,
      );

      setExistingReportId(report.id);
      setSavedReport(report);
      setSlideDir('forward');
      setStep(3);
    } catch {
      setErrorMessage('Unable to save the report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewReport = () => {
    setSavedReport(undefined);
    setSlideDir('back');
    setStep(0);
  };

  const periodLabel = buildPeriodLabel(period);
  const animationClass = slideDir === 'forward' ? 'slide-in-right' : 'slide-in-left';

  return (
    <div className="space-y-6">
      <div className="gradient-header rounded-2xl p-8 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="heading-font text-3xl font-bold">
              {buildReportTypeLabel(period.reportType)}
            </h1>
            <p className="mt-2 text-ocean-100">{STEP_LABELS[step]}</p>
          </div>
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3].map((dot) => (
              <span
                key={dot}
                className={`h-3 w-3 rounded-full border border-white/60 ${
                  step === dot ? 'bg-ocean-500' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-hidden">
        <div key={step} className={animationClass}>
          {step === 0 ? (
            <PeriodStep
              period={period}
              onChange={handlePeriodChange}
              existingReportId={existingReportId}
              onNext={goNext}
            />
          ) : null}

          {step === 1 ? (
            <PlatformMetricsStep
              metrics={platformMetrics}
              periodLabel={periodLabel}
              onChange={handleMetricChange}
              onBack={goBack}
              onNext={goNext}
            />
          ) : null}

          {step === 2 ? (
            <QualitativeStep
              reportType={period.reportType}
              values={qualitative}
              onChange={handleQualitativeChange}
              onBack={goBack}
              onSubmit={handleSubmit}
              loading={loading}
            />
          ) : null}

          {step === 3 && savedReport ? (
            <ReportFinalView report={savedReport} onNewReport={handleNewReport} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
