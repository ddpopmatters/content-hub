import { useState, useCallback } from 'react';
import { loadGuidelines, saveGuidelines, normalizeGuidelines } from '../../lib/guidelines';
import { SUPABASE_API } from '../../lib/supabase';

interface UseGuidelinesDeps {
  runSyncTask: (label: string, action: () => Promise<unknown>) => Promise<boolean>;
}

export function useGuidelines({ runSyncTask }: UseGuidelinesDeps) {
  const [guidelines, setGuidelines] = useState(() => loadGuidelines());
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);

  const handleGuidelinesSave = useCallback(
    (next: unknown) => {
      const normalized = normalizeGuidelines(next);
      setGuidelines(normalized);
      saveGuidelines(normalized);
      runSyncTask('Save guidelines', () => SUPABASE_API.saveGuidelines(normalized));
      setGuidelinesOpen(false);
    },
    [runSyncTask],
  );

  const teamsWebhookUrl = guidelines?.teamsWebhookUrl as string | undefined;

  const reset = useCallback(() => {
    setGuidelines(loadGuidelines());
    setGuidelinesOpen(false);
  }, []);

  return {
    guidelines,
    setGuidelines,
    guidelinesOpen,
    setGuidelinesOpen,
    handleGuidelinesSave,
    teamsWebhookUrl,
    reset,
  };
}
