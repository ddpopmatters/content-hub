import { useState, useCallback, useEffect } from 'react';
import type { OrgEvent } from '../../types/models';
import { SUPABASE_API } from '../../lib/supabase';

interface UseOrgEventsOptions {
  year: number;
  currentUser: string;
}

export function useOrgEvents({ year, currentUser }: UseOrgEventsOptions) {
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(() => {
    setIsLoading(true);
    SUPABASE_API.fetchOrgEvents(year)
      .then((data) => setEvents(data))
      .finally(() => setIsLoading(false));
  }, [year]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addEvent = useCallback(
    (data: Omit<OrgEvent, 'id' | 'createdBy' | 'createdAt'>) => {
      SUPABASE_API.saveOrgEvent({ ...data, createdBy: null }, currentUser).then((saved) => {
        if (saved) setEvents((prev) => [...prev, saved].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      });
    },
    [currentUser],
  );

  const updateEvent = useCallback(
    (id: string, updates: Partial<Omit<OrgEvent, 'id' | 'createdBy' | 'createdAt'>>) => {
      setEvents((prev) => {
        const existing = prev.find((e) => e.id === id);
        if (!existing) return prev;
        const merged = { ...existing, ...updates };
        SUPABASE_API.saveOrgEvent(merged, currentUser);
        return prev.map((e) => (e.id === id ? merged : e))
          .sort((a, b) => a.startDate.localeCompare(b.startDate));
      });
    },
    [currentUser],
  );

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    SUPABASE_API.deleteOrgEvent(id);
  }, []);

  return { events, isLoading, addEvent, updateEvent, deleteEvent, refresh };
}
