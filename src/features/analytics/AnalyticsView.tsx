import type { ReactElement } from 'react';
import { ReportingView } from '../reporting';
import type { Entry } from '../../types/models';

interface AnalyticsViewProps {
  entries: Entry[];
  currentUser?: string;
  currentUserEmail?: string;
}

export function AnalyticsView({ currentUser, currentUserEmail }: AnalyticsViewProps): ReactElement {
  return (
    <ReportingView
      currentUser={currentUser || 'Unknown user'}
      currentUserEmail={currentUserEmail || ''}
    />
  );
}
