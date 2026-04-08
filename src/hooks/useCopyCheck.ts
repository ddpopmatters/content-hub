import { useCallback } from 'react';
import { runCopyCheck, type CopyCheckPayload, type CopyCheckResult } from '../lib/copyCheck';

export function useCopyCheck(): (payload: CopyCheckPayload) => Promise<CopyCheckResult> {
  return useCallback((payload: CopyCheckPayload) => runCopyCheck(payload), []);
}
