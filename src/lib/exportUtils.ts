import type { Entry, Idea } from '../types/models';

/**
 * Escape a value for safe CSV output
 * - Wraps all values in quotes
 * - Escapes internal quotes by doubling them
 * - Prefixes formula-triggering characters to prevent CSV injection
 */
function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '""';

  let str = String(value);

  // Prevent formula injection - prefix dangerous leading characters
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }

  // Escape internal quotes by doubling them
  str = str.replace(/"/g, '""');

  // Always wrap in quotes for safety
  return `"${str}"`;
}

function filterEntriesByDateRange(entries: Entry[], startDate?: string, endDate?: string): Entry[] {
  return entries
    .filter((entry) => !entry.deletedAt)
    .filter((entry) => (startDate ? entry.date >= startDate : true))
    .filter((entry) => (endDate ? entry.date <= endDate : true));
}

function escapeICSText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatICSDate(date: string): string {
  return date.replace(/-/g, '');
}

function addDaysToISODate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const nextYear = d.getFullYear();
  const nextMonth = String(d.getMonth() + 1).padStart(2, '0');
  const nextDay = String(d.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function formatICSTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function foldICSLine(line: string): string {
  const limit = 75;
  if (line.length <= limit) return line;

  const chunks: string[] = [line.slice(0, limit)];
  let cursor = limit;
  while (cursor < line.length) {
    chunks.push(` ${line.slice(cursor, cursor + limit - 1)}`);
    cursor += limit - 1;
  }
  return chunks.join('\r\n');
}

export interface ICSExportOptions {
  startDate?: string;
  endDate?: string;
  calendarName?: string;
}

/**
 * Generate RFC 5545-compatible ICS content for entry exports
 */
export function generateICSContent(entries: Entry[], options: ICSExportOptions = {}): string {
  const now = new Date();
  const dtStamp = formatICSTimestamp(now);
  const filteredEntries = filterEntriesByDateRange(entries, options.startDate, options.endDate)
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Population Matters//Content Hub//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICSText(options.calendarName || 'Population Matters Content Calendar')}`,
  ];

  filteredEntries.forEach((entry) => {
    const summary = (entry.caption || '').trim() || 'Untitled content';
    const description = [
      `Platforms: ${entry.platforms.length ? entry.platforms.join(', ') : 'None'}`,
      `Workflow Status: ${entry.workflowStatus || 'Unknown'}`,
      `Status: ${entry.status || 'Unknown'}`,
      `Date: ${entry.date}`,
    ].join('\n');
    const uid = `${entry.id}@populationmatters-content-hub`;
    const dtStart = formatICSDate(entry.date);
    const dtEnd = formatICSDate(addDaysToISODate(entry.date, 1));

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeICSText(uid)}`);
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(`SUMMARY:${escapeICSText(summary)}`);
    lines.push(`DESCRIPTION:${escapeICSText(description)}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.map(foldICSLine).join('\r\n') + '\r\n';
}

/**
 * Convert entries to CSV format
 */
export function entriesToCSV(entries: Entry[]): string {
  const headers = [
    'ID',
    'Date',
    'Platforms',
    'Asset Type',
    'Caption',
    'Status',
    'Workflow Status',
    'Author',
    'Campaign',
    'Content Pillar',
    'Approved At',
    'Created At',
    'Updated At',
  ];

  const rows = entries.map((entry) =>
    [
      entry.id,
      entry.date,
      entry.platforms.join('; '),
      entry.assetType,
      entry.caption,
      entry.status,
      entry.workflowStatus,
      entry.author,
      entry.campaign,
      entry.contentPillar,
      entry.approvedAt,
      entry.createdAt,
      entry.updatedAt,
    ].map(escapeCsv),
  );

  return [headers.map(escapeCsv).join(','), ...rows.map((row) => row.join(','))].join('\n');
}

/**
 * Convert ideas to CSV format
 */
export function ideasToCSV(ideas: Idea[]): string {
  const headers = ['ID', 'Type', 'Title', 'Notes', 'Target Month', 'Created By', 'Created At'];

  const rows = ideas.map((idea) =>
    [
      idea.id,
      idea.type,
      idea.title,
      idea.notes,
      idea.targetMonth,
      idea.createdBy,
      idea.createdAt,
    ].map(escapeCsv),
  );

  return [headers.map(escapeCsv).join(','), ...rows.map((row) => row.join(','))].join('\n');
}

/**
 * Download content as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download data as CSV
 */
export function downloadCSV(csv: string, filename: string): void {
  downloadFile(csv, filename, 'text/csv;charset=utf-8');
}

/**
 * Download entries as an ICS calendar file
 */
export function downloadICS(entries: Entry[], filename: string): void {
  const ics = generateICSContent(entries);
  downloadFile(ics, filename, 'text/calendar;charset=utf-8');
}

/**
 * Download data as JSON
 */
export function downloadJSON(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, filename, 'application/json');
}

/**
 * Export all data as a JSON backup
 */
export interface DataBackup {
  version: string;
  exportedAt: string;
  entries: Entry[];
  ideas: Idea[];
}

export function createDataBackup(entries: Entry[], ideas: Idea[]): DataBackup {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    entries,
    ideas,
  };
}

/**
 * Download full data backup as JSON
 */
export function downloadDataBackup(entries: Entry[], ideas: Idea[]): void {
  const backup = createDataBackup(entries, ideas);
  const date = new Date().toISOString().split('T')[0];
  downloadJSON(backup, `pm-dashboard-backup-${date}.json`);
}

/**
 * Export entries for a date range as CSV
 */
export function exportEntriesForDateRange(
  entries: Entry[],
  startDate: string,
  endDate: string,
): void {
  const filtered = filterEntriesByDateRange(entries, startDate, endDate);
  const csv = entriesToCSV(filtered);
  downloadCSV(csv, `pm-entries-${startDate}-to-${endDate}.csv`);
}
