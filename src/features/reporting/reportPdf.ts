import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { REPORTING_PLATFORM_METRICS } from '../../constants';
import type { MonthlyReport } from '../../types/models';

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

const buildReportTitle = (report: MonthlyReport): string => {
  const type = report.reportType ?? 'monthly';
  if (type === 'monthly') {
    const monthName = MONTH_NAMES[(report.periodMonth ?? 1) - 1] ?? 'Unknown';
    return `${monthName} ${report.periodYear} — Monthly Social Media Report`;
  }
  if (type === 'quarterly') {
    const quarterName = QUARTER_NAMES[(report.periodQuarter ?? 1) - 1] ?? 'Q?';
    return `${quarterName} ${report.periodYear} — Quarterly Deep Dive`;
  }
  if (type === 'annual') {
    return `${report.periodYear} — Annual Review`;
  }
  return `${report.campaignName ?? 'Campaign'} — Campaign Report`;
};

const buildFilename = (report: MonthlyReport): string => {
  const type = report.reportType ?? 'monthly';
  if (type === 'monthly') {
    return `pm-report-${report.periodYear}-${String(report.periodMonth).padStart(2, '0')}.pdf`;
  }
  if (type === 'quarterly') {
    return `pm-report-${report.periodYear}-q${report.periodQuarter}.pdf`;
  }
  if (type === 'annual') {
    return `pm-report-${report.periodYear}-annual.pdf`;
  }
  const slug = (report.campaignName ?? 'campaign').toLowerCase().replace(/\s+/g, '-');
  return `pm-report-campaign-${slug}.pdf`;
};

export function generateMonthlyReportPdf(report: MonthlyReport): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfDoc = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  const title = buildReportTitle(report);
  const isDeepDive = report.reportType === 'quarterly' || report.reportType === 'annual';
  let cursorY = 20;

  const ensureSpace = (requiredHeight: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (cursorY + requiredHeight > pageHeight - 20) {
      doc.addPage();
      cursorY = 20;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Population Matters', 20, cursorY);

  cursorY += 8;
  doc.setFontSize(14);
  doc.text(title, 20, cursorY);

  cursorY += 5;
  doc.setDrawColor(17, 96, 125);
  doc.line(20, cursorY, 190, cursorY);
  cursorY += 8;

  Object.keys(REPORTING_PLATFORM_METRICS).forEach((platform) => {
    const rows = REPORTING_PLATFORM_METRICS[platform]
      .map((metric) => ({
        label: metric.label,
        value: report.platformMetrics[platform]?.[metric.key] ?? 0,
      }))
      .filter((m) => m.value > 0)
      .map((m) => [m.label, m.value.toLocaleString()]);

    if (rows.length === 0) return;

    ensureSpace(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(platform, 20, cursorY);
    cursorY += 4;

    autoTable(doc, {
      startY: cursorY,
      head: [['Metric', 'Value']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 2.5 },
      headStyles: { fillColor: [17, 96, 125] },
      margin: { left: 20, right: 20 },
    });

    cursorY = (pdfDoc.lastAutoTable?.finalY ?? cursorY) + 8;
  });

  const allQualSections = isDeepDive
    ? [...CORE_QUALITATIVE_SECTIONS, ...DEEP_DIVE_SECTIONS]
    : CORE_QUALITATIVE_SECTIONS;

  const qualitativeRows = allQualSections.filter(
    ({ field }) => (report.qualitative[field] ?? '').trim().length > 0,
  );

  if (qualitativeRows.length > 0) {
    ensureSpace(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Qualitative Insights', 20, cursorY);
    cursorY += 7;

    qualitativeRows.forEach(({ field, heading }) => {
      const body = (report.qualitative[field] ?? '').trim();
      const wrapped = doc.splitTextToSize(body, 170);

      ensureSpace(12 + wrapped.length * 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(heading, 20, cursorY);
      cursorY += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(wrapped, 20, cursorY);
      cursorY += wrapped.length * 5 + 4;
    });
  }

  doc.save(buildFilename(report));
}
