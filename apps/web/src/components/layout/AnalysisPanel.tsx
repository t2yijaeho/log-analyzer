import { lazy, Suspense } from 'react';
import { isStaticMode } from '../../config';
import { Spinner } from '../common/Spinner';

const ChatPanel = lazy(() => import('../chat/ChatPanel').then(({ ChatPanel: component }) => ({ default: component })));
const LocalInsightsPanel = lazy(() =>
  import('../insights/LocalInsightsPanel').then(({ LocalInsightsPanel: component }) => ({ default: component })),
);

export interface AnalysisPanelProps {
  staticMode?: boolean;
}

export function AnalysisPanel({ staticMode = isStaticMode }: AnalysisPanelProps) {
  return (
    <Suspense fallback={<Spinner label="Loading analysis panel…" />}>
      {staticMode ? <LocalInsightsPanel /> : <ChatPanel />}
    </Suspense>
  );
}
