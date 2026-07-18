/**
 * Performance data CSV merge logic.
 * Extracted from app.jsx.
 */
import type { Entry } from '../types/models';
import { normalizeHeaderKey } from './csv';
import { ensureArray, normalizeDateValue } from './utils';
import { ensureAnalytics } from './sanitizers';
import {
  normalizePlatform,
  normalizePerformanceMetricKey,
  PERFORMANCE_HEADER_KEYS,
  PERFORMANCE_IGNORED_METRIC_KEYS,
} from './platforms';

interface CsvRecord {
  rowNumber: number;
  record: Record<string, string>;
}

interface CsvDataset {
  headers: string[];
  records: CsvRecord[];
}

interface ImportIssue {
  rowNumber: number;
  reason: string;
}

interface MergeSummary {
  totalRows: number;
  matched: number;
  updatedEntries: string[];
  updatedEntryCount: number;
  missing: ImportIssue[];
  ambiguous: ImportIssue[];
  errors: ImportIssue[];
}

interface MergeResult {
  nextEntries: Entry[];
  summary: MergeSummary;
}

export const mergePerformanceData = (entries: Entry[], dataset: CsvDataset): MergeResult => {
  const headers = Array.isArray(dataset?.headers) ? dataset.headers : [];
  const records = Array.isArray(dataset?.records) ? dataset.records : [];
  const summary: {
    totalRows: number;
    matched: number;
    updatedEntries: Set<string> | string[];
    updatedEntryCount?: number;
    missing: ImportIssue[];
    ambiguous: ImportIssue[];
    errors: ImportIssue[];
  } = {
    totalRows: records.length,
    matched: 0,
    updatedEntries: new Set<string>(),
    missing: [],
    ambiguous: [],
    errors: [],
  };
  if (!headers.length || !records.length) {
    return {
      nextEntries: entries,
      summary: { ...summary, updatedEntries: [], updatedEntryCount: 0 } as MergeSummary,
    };
  }
  const normalizedHeaders = headers.map((header) => normalizeHeaderKey(header));
  const headerLabels: Record<string, string> = {};
  normalizedHeaders.forEach((key, idx) => {
    if (!headerLabels[key]) headerLabels[key] = headers[idx].trim();
  });
  const hasEntryId = normalizedHeaders.some((key) => PERFORMANCE_HEADER_KEYS.entryId.includes(key));
  const hasDate = normalizedHeaders.some((key) => PERFORMANCE_HEADER_KEYS.date.includes(key));
  const hasPlatform = normalizedHeaders.some((key) =>
    PERFORMANCE_HEADER_KEYS.platform.includes(key),
  );
  if (!hasEntryId && (!hasDate || !hasPlatform)) {
    summary.errors.push({
      rowNumber: 1,
      reason: 'CSV must include an entry_id column or both date and platform columns.',
    });
    return {
      nextEntries: entries,
      summary: { ...summary, updatedEntries: [], updatedEntryCount: 0 } as MergeSummary,
    };
  }
  const metricKeys = normalizedHeaders.filter((key) => !PERFORMANCE_IGNORED_METRIC_KEYS.has(key));
  if (!metricKeys.length) {
    summary.errors.push({
      rowNumber: 1,
      reason: 'No metric columns detected in the upload.',
    });
    return {
      nextEntries: entries,
      summary: { ...summary, updatedEntries: [], updatedEntryCount: 0 } as MergeSummary,
    };
  }

  const nextEntries = entries.map((entry) => ({
    ...entry,
    analytics: ensureAnalytics(entry.analytics),
  }));
  const entryIndexById = new Map<string, number>();
  nextEntries.forEach((entry, index) => {
    entryIndexById.set(entry.id, index);
  });

  const entriesByDatePlatform = new Map<string, number[]>();
  nextEntries.forEach((entry, index) => {
    ensureArray(entry.platforms).forEach((platform) => {
      const key = `${entry.date}__${platform}`;
      if (!entriesByDatePlatform.has(key)) entriesByDatePlatform.set(key, []);
      entriesByDatePlatform.get(key)!.push(index);
    });
  });

  const getFirstValue = (row: Record<string, string>, keys: string[]): string => {
    for (const key of keys) {
      if (row[key]) return row[key];
    }
    return '';
  };

  let mutated = false;
  const timestamp = new Date().toISOString();

  records.forEach(({ rowNumber, record }) => {
    const normalizedRow: Record<string, string> = {};
    headers.forEach((header, idx) => {
      const key = normalizedHeaders[idx];
      normalizedRow[key] = record[header] ?? '';
    });

    const entryIdValue = getFirstValue(normalizedRow, PERFORMANCE_HEADER_KEYS.entryId);
    let entryIndex = -1;
    let matchedEntry: Entry | null = null;
    let platform = '';

    if (entryIdValue) {
      const foundIndex = entryIndexById.get(entryIdValue);
      if (foundIndex === undefined) {
        summary.missing.push({
          rowNumber,
          reason: `Entry ID "${entryIdValue}" not found.`,
        });
        return;
      }
      entryIndex = foundIndex;
      matchedEntry = nextEntries[entryIndex];
      const platformRaw = getFirstValue(normalizedRow, PERFORMANCE_HEADER_KEYS.platform);
      platform = normalizePlatform(platformRaw);
      if (!platform) {
        if (ensureArray(matchedEntry.platforms).length === 1) {
          platform = matchedEntry.platforms[0];
        } else {
          summary.errors.push({
            rowNumber,
            reason: `Specify platform for entry ID "${entryIdValue}" (multiple platforms linked).`,
          });
          return;
        }
      }
      if (!ensureArray(matchedEntry.platforms).includes(platform)) {
        summary.ambiguous.push({
          rowNumber,
          reason: `Entry ID "${entryIdValue}" is not planned for ${platform}.`,
        });
        return;
      }
    } else {
      const dateRaw = getFirstValue(normalizedRow, PERFORMANCE_HEADER_KEYS.date);
      const isoDate = normalizeDateValue(dateRaw);
      if (!isoDate) {
        summary.errors.push({
          rowNumber,
          reason: 'Row is missing a valid date value.',
        });
        return;
      }
      const platformRaw = getFirstValue(normalizedRow, PERFORMANCE_HEADER_KEYS.platform);
      platform = normalizePlatform(platformRaw);
      if (!platform) {
        summary.errors.push({
          rowNumber,
          reason: 'Row is missing a recognizable platform value.',
        });
        return;
      }
      const candidates = (entriesByDatePlatform.get(`${isoDate}__${platform}`) || []).map(
        (candidateIndex) => nextEntries[candidateIndex],
      );
      if (!candidates.length) {
        summary.missing.push({
          rowNumber,
          reason: `No calendar item on ${isoDate} for ${platform}.`,
        });
        return;
      }
      if (candidates.length === 1) {
        matchedEntry = candidates[0];
        entryIndex = entryIndexById.get(matchedEntry.id)!;
      } else {
        const snippet = getFirstValue(normalizedRow, PERFORMANCE_HEADER_KEYS.caption).toLowerCase();
        const link = getFirstValue(normalizedRow, PERFORMANCE_HEADER_KEYS.url).toLowerCase();
        let filtered = candidates;
        if (snippet) {
          filtered = filtered.filter((entry) =>
            (entry.caption || '').toLowerCase().includes(snippet),
          );
        }
        if (filtered.length !== 1 && link) {
          filtered = candidates.filter((entry) => (entry.url || '').toLowerCase().includes(link));
        }
        if (filtered.length === 1) {
          matchedEntry = filtered[0];
          entryIndex = entryIndexById.get(matchedEntry.id)!;
        } else {
          summary.ambiguous.push({
            rowNumber,
            reason: `Multiple calendar items found on ${isoDate} for ${platform}. Add entry_id to disambiguate.`,
          });
          return;
        }
      }
    }

    if (!matchedEntry || entryIndex === -1) {
      summary.errors.push({
        rowNumber,
        reason: 'Unable to match this row to a calendar item.',
      });
      return;
    }

    const metricPayload: Record<string, string | number> = {};
    metricKeys.forEach((key) => {
      const rawValue = normalizedRow[key];
      if (rawValue === undefined || rawValue === null || rawValue === '') return;
      const label = normalizePerformanceMetricKey(headerLabels[key] || key);
      const cleanedNumeric = typeof rawValue === 'string' ? rawValue.replace(/,/g, '') : rawValue;
      const numericValue =
        typeof cleanedNumeric === 'string' && cleanedNumeric !== ''
          ? Number(cleanedNumeric)
          : Number.isFinite(cleanedNumeric as unknown as number)
            ? (cleanedNumeric as unknown as number)
            : NaN;
      if (typeof rawValue === 'string' && rawValue.trim().endsWith('%')) {
        metricPayload[label] = rawValue.trim();
        return;
      }
      if (!Number.isNaN(numericValue) && rawValue !== '') {
        metricPayload[label] = numericValue;
      } else {
        metricPayload[label] = rawValue;
      }
    });

    if (!Object.keys(metricPayload).length) {
      summary.errors.push({
        rowNumber,
        reason: 'No metric values detected in this row.',
      });
      return;
    }

    const targetEntry = nextEntries[entryIndex];
    const analytics = ensureAnalytics(targetEntry.analytics) as Record<
      string,
      Record<string, unknown>
    >;
    const existing = analytics[platform] ? { ...analytics[platform] } : {};
    const mergedMetrics = {
      ...existing,
      ...metricPayload,
      lastImportedAt: timestamp,
    };
    analytics[platform] = mergedMetrics;
    nextEntries[entryIndex] = {
      ...targetEntry,
      analytics,
      analyticsUpdatedAt: timestamp,
    };
    summary.matched += 1;
    (summary.updatedEntries as Set<string>).add(targetEntry.id);
    mutated = true;
  });

  const finalUpdatedEntries = Array.from(summary.updatedEntries as Set<string>);
  const resultEntries = mutated ? nextEntries : entries;
  return {
    nextEntries: resultEntries,
    summary: {
      ...summary,
      updatedEntries: finalUpdatedEntries,
      updatedEntryCount: finalUpdatedEntries.length,
    } as MergeSummary,
  };
};
