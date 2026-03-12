import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PLATFORM_METRICS } from '../../constants';
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

const QUALITATIVE_SECTIONS: Array<{
  field: keyof MonthlyReport['qualitative'];
  heading: string;
}> = [
  { field: 'whatWorked', heading: 'What Worked' },
  { field: 'whatDidnt', heading: 'Challenges' },
  { field: 'themes', heading: 'Audience Themes' },
  { field: 'nextMonthFocus', heading: 'Focus for Next Month' },
  { field: 'highlights', heading: 'Highlights' },
];

export function generateMonthlyReportPdf(report: MonthlyReport): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pdfDoc = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  const monthName = MONTH_NAMES[report.periodMonth - 1] ?? 'Unknown';
  const title = `${monthName} ${report.periodYear} - Monthly Social Media Report`;
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

  Object.keys(PLATFORM_METRICS).forEach((platform) => {
    const rows = PLATFORM_METRICS[platform]
      .map((metric) => ({
        label: metric.label,
        value: report.platformMetrics[platform]?.[metric.key] ?? 0,
      }))
      .filter((metric) => metric.value > 0)
      .map((metric) => [metric.label, metric.value.toLocaleString()]);

    if (rows.length === 0) {
      return;
    }

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

  const qualitativeRows = QUALITATIVE_SECTIONS.filter(
    ({ field }) => report.qualitative[field]?.trim().length > 0,
  );

  if (qualitativeRows.length > 0) {
    ensureSpace(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Qualitative Insights', 20, cursorY);
    cursorY += 7;

    qualitativeRows.forEach(({ field, heading }) => {
      const body = report.qualitative[field].trim();
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

  doc.save(
    `pm-social-report-${report.periodYear}-${String(report.periodMonth).padStart(2, '0')}.pdf`,
  );
}
