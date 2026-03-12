import { useEffect, useState, type ReactElement } from 'react';
import { PLATFORM_METRICS } from '../../constants';
import { SUPABASE_API } from '../../lib/supabase';
import type { MonthlyReport, QualitativeInsights } from '../../types/models';
import { ReportFinalView } from './ReportFinalView';
import { PeriodStep } from './steps/PeriodStep';
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

const EMPTY_QUALITATIVE: QualitativeInsights = {
  whatWorked: '',
  whatDidnt: '',
  themes: '',
  nextMonthFocus: '',
  highlights: '',
};

const STEP_LABELS = [
  '1 of 3 - Reporting Period',
  '2 of 3 - Platform Metrics',
  '3 of 3 - Insights',
  'Report Ready',
] as const;

const getDefaultReportingPeriod = (): { month: number; year: number } => {
  const previousMonth = new Date();
  previousMonth.setDate(1);
  previousMonth.setMonth(previousMonth.getMonth() - 1);

  return {
    month: previousMonth.getMonth() + 1,
    year: previousMonth.getFullYear(),
  };
};

const buildPeriodLabel = (month: number, year: number): string =>
  `${MONTH_NAMES[month - 1] ?? 'Unknown'} ${year}`;

const normalizePlatformMetrics = (
  metrics: Record<string, Record<string, number>>,
): Record<string, Record<string, number>> =>
  Object.fromEntries(
    Object.entries(PLATFORM_METRICS).map(([platform, definitions]) => [
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
  const defaultPeriod = getDefaultReportingPeriod();
  const [step, setStep] = useState<WizardStep>(0);
  const [slideDir, setSlideDir] = useState<SlideDirection>('forward');
  const [selectedMonth, setSelectedMonth] = useState<number>(defaultPeriod.month);
  const [selectedYear, setSelectedYear] = useState<number>(defaultPeriod.year);
  const [platformMetrics, setPlatformMetrics] = useState<Record<string, Record<string, number>>>(
    {},
  );
  const [qualitative, setQualitative] = useState<QualitativeInsights>(EMPTY_QUALITATIVE);
  const [existingReportId, setExistingReportId] = useState<string | undefined>(undefined);
  const [savedReport, setSavedReport] = useState<MonthlyReport | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadMonthlyReport = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const report = await SUPABASE_API.getMonthlyReport(selectedYear, selectedMonth);

        if (cancelled) {
          return;
        }

        if (report) {
          setExistingReportId(report.id);
          setPlatformMetrics(report.platformMetrics || {});
          setQualitative({ ...EMPTY_QUALITATIVE, ...report.qualitative });
        } else {
          setExistingReportId(undefined);
          setPlatformMetrics({});
          setQualitative(EMPTY_QUALITATIVE);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage('Unable to load an existing report for that period.');
          setExistingReportId(undefined);
          setPlatformMetrics({});
          setQualitative(EMPTY_QUALITATIVE);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMonthlyReport();

    return () => {
      cancelled = true;
    };
  }, [selectedMonth, selectedYear]);

  const goNext = () => {
    setSlideDir('forward');
    setStep((current) => (current < 3 ? ((current + 1) as WizardStep) : current));
  };

  const goBack = () => {
    setSlideDir('back');
    setStep((current) => (current > 0 ? ((current - 1) as WizardStep) : current));
  };

  const handlePeriodChange = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    setSavedReport(undefined);
  };

  const handleMetricChange = (platform: string, key: string, value: number) => {
    setPlatformMetrics((current) => {
      const next = {
        ...current,
        [platform]: {
          ...(current[platform] || {}),
        },
      };

      if (!Number.isFinite(value)) {
        delete next[platform][key];
        if (Object.keys(next[platform]).length === 0) {
          delete next[platform];
        }
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
          periodMonth: selectedMonth,
          periodYear: selectedYear,
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
    } catch (error) {
      setErrorMessage('Unable to save the monthly report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewReport = () => {
    setSavedReport(undefined);
    setSlideDir('back');
    setStep(0);
  };

  const periodLabel = buildPeriodLabel(selectedMonth, selectedYear);
  const animationClass = slideDir === 'forward' ? 'slide-in-right' : 'slide-in-left';

  return (
    <div className="space-y-6">
      <div className="gradient-header rounded-2xl p-8 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="heading-font text-3xl font-bold">Monthly Reporting</h1>
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
              month={selectedMonth}
              year={selectedYear}
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
