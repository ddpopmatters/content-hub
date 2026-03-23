import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Label } from '../../components/ui';
import { selectBaseClasses } from '../../lib/styles';
import { cx } from '../../lib/utils';
import type { Entry } from '../../types/models';
import { AudienceSegmentPicker } from './AudienceSegmentPicker';
import { IterationPanel } from './IterationPanel';
import { PM_PERSONAS } from './personas';
import { SimResultCard } from './SimResultCard';
import { useAudienceSim } from './useAudienceSim';
import { useIterate } from './useIterate';
import type { AudienceSim, ContentType } from './types';

export interface AudienceSimPanelProps {
  entry: Entry | null;
  ideaId?: string;
}

const CONTENT_TYPE_OPTIONS: Array<{ value: ContentType; label: string }> = [
  { value: 'social_caption', label: 'Social caption' },
  { value: 'blog_post', label: 'Blog post' },
  { value: 'email', label: 'Email' },
  { value: 'appeal', label: 'Appeal' },
  { value: 'script', label: 'Script' },
  { value: 'other', label: 'Other' },
];

const getContentForType = (entry: Entry | null, contentType: ContentType): string => {
  if (!entry) return '';

  switch (contentType) {
    case 'script':
      return (entry.script || entry.caption || '').trim();
    case 'other':
      return (entry.designCopy || entry.caption || '').trim();
    default:
      return (entry.caption || '').trim();
  }
};

const formatHistoryLabel = (sim: AudienceSim) => {
  const labels = sim.segments
    .map((segmentId) => PM_PERSONAS.find((persona) => persona.id === segmentId)?.label || segmentId)
    .join(', ');
  return labels || 'No personas selected';
};

export function AudienceSimPanel({ entry, ideaId }: AudienceSimPanelProps): React.ReactElement {
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [contentType, setContentType] = useState<ContentType>('social_caption');
  const [acceptedMessage, setAcceptedMessage] = useState('');

  const { sim, history, loading, error, runSim, loadHistory, polling } = useAudienceSim();
  const { diff, revised, iterating, error: iterateError, iterate, accept, reject } = useIterate();

  const contentText = useMemo(() => getContentForType(entry, contentType), [contentType, entry]);
  const resolvedError = sim?.error_message || iterateError || error || '';

  useEffect(() => {
    void loadHistory(entry?.id, ideaId).catch(() => {});
  }, [entry?.id, ideaId, loadHistory]);

  const handleRun = async () => {
    if (!contentText || selectedSegments.length === 0) return;
    setAcceptedMessage('');
    await runSim({
      contentText,
      contentType,
      entryId: entry?.id,
      ideaId,
      segments: selectedSegments,
    });
  };

  const handleIterate = async () => {
    if (!sim?.id || !sim.results?.segment_results?.length) return;
    setAcceptedMessage('');
    await iterate(sim.id, contentText, sim.results.segment_results);
  };

  const handleAccept = async () => {
    const accepted = await accept();
    if (accepted) {
      setAcceptedMessage('Revision accepted. Revised copy is ready below.');
    }
  };

  const activeResultSet = sim?.results;

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl text-ocean-900">Audience Sim</CardTitle>
          <p className="text-sm text-graystone-500">
            Test the current copy against PM audience personas, then iterate with Claude.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Audience segments</Label>
            <AudienceSegmentPicker selectedIds={selectedSegments} onChange={setSelectedSegments} />
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px_auto] md:items-end">
            <div className="space-y-2">
              <Label>Content preview</Label>
              <div className="min-h-[132px] rounded-3xl border border-graystone-200 bg-graystone-50 p-4 text-sm leading-6 text-graystone-700 whitespace-pre-wrap">
                {contentText || 'No content is available for this content type yet.'}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Content type</Label>
              <select
                value={contentType}
                onChange={(event) => setContentType(event.target.value as ContentType)}
                className={cx(selectBaseClasses, 'w-full')}
              >
                {CONTENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="button"
              onClick={handleRun}
              disabled={!contentText || selectedSegments.length === 0 || loading || polling}
              className="h-11 rounded-xl bg-ocean-600 hover:bg-ocean-700"
            >
              Run
            </Button>
          </div>

          {(loading || polling) && (
            <div className="flex items-center gap-3 rounded-2xl border border-aqua-200 bg-aqua-50 px-4 py-3 text-sm text-ocean-700">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-ocean-200 border-t-ocean-600" />
              <span>Simulating audience reactions…</span>
            </div>
          )}

          {resolvedError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {resolvedError}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {activeResultSet ? (
        <Card className="rounded-3xl shadow-sm">
          <CardHeader className="space-y-2">
            <CardTitle className="text-lg text-ocean-900">Results</CardTitle>
            <p className="text-sm text-graystone-500">{activeResultSet.overall_summary}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              {activeResultSet.segment_results.map((result) => (
                <div key={`${result.persona_id}-${result.label}`}>
                  <SimResultCard result={result} />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-ocean-900">Iteration</h3>
                  <p className="text-sm text-graystone-500">
                    Generate a revision that responds to the strongest audience concerns.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleIterate}
                  disabled={iterating}
                  className="rounded-xl bg-ocean-600 hover:bg-ocean-700"
                >
                  {iterating ? 'Iterating…' : 'Iterate with Claude'}
                </Button>
              </div>

              {diff ? (
                <IterationPanel diff={diff} onAccept={handleAccept} onReject={reject} />
              ) : null}

              {acceptedMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {acceptedMessage}
                </div>
              ) : null}

              {revised ? (
                <div className="rounded-3xl border border-graystone-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-graystone-500">
                    Revised content
                  </div>
                  <div className="mt-2 text-sm leading-6 text-graystone-700 whitespace-pre-wrap">
                    {revised}
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-3xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-ocean-900">History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-graystone-500">No audience simulations recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <details
                  key={item.id}
                  className="rounded-2xl border border-graystone-200 bg-white px-4 py-3 shadow-sm"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-ocean-900">
                          {formatHistoryLabel(item)}
                        </div>
                        <div className="text-xs text-graystone-500">
                          {new Date(item.created_at).toLocaleString()}
                        </div>
                      </div>
                      <span
                        className={cx(
                          'rounded-full px-2.5 py-1 text-xs font-semibold',
                          item.status === 'complete'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.status === 'failed'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-aqua-100 text-ocean-700',
                        )}
                      >
                        {item.status}
                      </span>
                    </div>
                  </summary>

                  {item.results ? (
                    <div className="mt-4 space-y-2 text-sm text-graystone-700">
                      <p>{item.results.overall_summary}</p>
                      <ul className="list-disc space-y-1 pl-5">
                        {item.results.segment_results.map((result) => (
                          <li key={`${item.id}-${result.persona_id}`}>
                            {result.label}: {result.score}/100, {result.sentiment}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-graystone-500">
                      No result payload was saved for this run.
                    </p>
                  )}
                </details>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AudienceSimPanel;
