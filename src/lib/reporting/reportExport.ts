import type { ReportingPeriod } from '../../types/models';

export const printReportingPeriod = (report: ReportingPeriod | null) => {
  if (!report || typeof window === 'undefined') return;
  window.document.title = `${report.label} | Content Hub`;
  window.print();
};
