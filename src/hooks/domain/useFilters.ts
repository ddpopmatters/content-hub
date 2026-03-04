import { useState, useCallback, useMemo } from 'react';

export function useFilters() {
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPlatforms, setFilterPlatforms] = useState<string[]>([]);
  const [filterWorkflow, setFilterWorkflow] = useState('All');
  const [filterQuery, setFilterQuery] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterEvergreen, setFilterEvergreen] = useState(false);

  const resetFilters = useCallback(() => {
    setFilterType('All');
    setFilterStatus('All');
    setFilterWorkflow('All');
    setFilterPlatforms([]);
    setFilterQuery('');
    setFilterOverdue(false);
    setFilterEvergreen(false);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterType !== 'All') count += 1;
    if (filterStatus !== 'All') count += 1;
    if (filterWorkflow !== 'All') count += 1;
    if (filterPlatforms.length) count += 1;
    if (filterQuery.trim()) count += 1;
    if (filterOverdue) count += 1;
    if (filterEvergreen) count += 1;
    return count;
  }, [
    filterType,
    filterStatus,
    filterWorkflow,
    filterPlatforms,
    filterQuery,
    filterOverdue,
    filterEvergreen,
  ]);

  return {
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    filterPlatforms,
    setFilterPlatforms,
    filterWorkflow,
    setFilterWorkflow,
    filterQuery,
    setFilterQuery,
    filterOverdue,
    setFilterOverdue,
    filterEvergreen,
    setFilterEvergreen,
    resetFilters,
    activeFilterCount,
  };
}
