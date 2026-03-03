import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle, Badge, Button } from '../../components/ui';
import type { ContentRequest, ContentRequestStatus } from '../../types/models';
import { ContentRequestForm } from './ContentRequestForm';
import type { ContentRequestPayload } from '../../hooks/domain/useContentRequests';

const STATUS_BADGE_CLASSES: Record<ContentRequestStatus, string> = {
  Pending: 'bg-amber-100 text-amber-800',
  'In Progress': 'bg-ocean-100 text-ocean-800',
  Converted: 'bg-emerald-100 text-emerald-800',
  Declined: 'bg-graystone-200 text-graystone-700',
};

const REVIEWABLE_STATUSES: ContentRequestStatus[] = ['Pending', 'In Progress'];

export interface ContentRequestsViewProps {
  contentRequests: ContentRequest[];
  currentUser: string | null;
  approverOptions: string[];
  onAddContentRequest: (payload: ContentRequestPayload) => void;
  onUpdateStatus: (id: string, status: ContentRequestStatus) => void;
  onConvertToEntry: (request: ContentRequest) => void;
}

export function ContentRequestsView({
  contentRequests,
  currentUser,
  approverOptions,
  onAddContentRequest,
  onUpdateStatus,
  onConvertToEntry,
}: ContentRequestsViewProps): React.ReactElement {
  const reviewRequests = useMemo(() => {
    return contentRequests.filter((request) => REVIEWABLE_STATUSES.includes(request.status));
  }, [contentRequests]);

  const completedRequests = useMemo(() => {
    return contentRequests.filter((request) => !REVIEWABLE_STATUSES.includes(request.status));
  }, [contentRequests]);

  const [selectedRequestId, setSelectedRequestId] = useState('');

  useEffect(() => {
    const existing = contentRequests.find((item) => item.id === selectedRequestId);
    if (existing) return;
    const fallback = reviewRequests[0] || completedRequests[0];
    setSelectedRequestId(fallback?.id || '');
  }, [selectedRequestId, contentRequests, reviewRequests, completedRequests]);

  const selectedRequest =
    contentRequests.find((request) => request.id === selectedRequestId) || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ocean-700">Content Requests</h2>
          <p className="text-sm text-graystone-600">
            Intake briefs from across the organisation. Fran can review and convert these into
            planned entries.
          </p>
        </div>
        <Badge variant="outline">{reviewRequests.length} pending review</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <ContentRequestForm
          onSubmit={onAddContentRequest}
          currentUser={currentUser}
          approverOptions={approverOptions}
        />

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-ocean-900">Requests for review</CardTitle>
            <p className="text-sm text-graystone-500">
              Select a brief to preview it and convert it into an entry.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {reviewRequests.length === 0 ? (
              <p className="text-sm text-graystone-500">No pending requests right now.</p>
            ) : (
              <div className="space-y-3">
                {reviewRequests.map((request) => (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => setSelectedRequestId(request.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedRequestId === request.id
                        ? 'border-ocean-400 bg-ocean-50'
                        : 'border-graystone-200 bg-white hover:border-ocean-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={STATUS_BADGE_CLASSES[request.status]}>
                        {request.status}
                      </Badge>
                      {request.deadline ? (
                        <Badge variant="outline">Due {request.deadline}</Badge>
                      ) : (
                        <Badge variant="outline">No deadline</Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-graystone-900">{request.title}</p>
                    <p className="mt-1 text-xs text-graystone-500">
                      Requested by {request.createdBy || 'Unknown'}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {completedRequests.length > 0 ? (
              <div className="space-y-2 border-t border-graystone-200 pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-graystone-500">
                  Recently processed
                </h4>
                <div className="space-y-2">
                  {completedRequests.slice(0, 4).map((request) => (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => setSelectedRequestId(request.id)}
                      className="w-full rounded-xl border border-graystone-200 bg-white px-3 py-2 text-left text-sm hover:border-ocean-200"
                    >
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_BADGE_CLASSES[request.status]}>
                          {request.status}
                        </Badge>
                        <span className="truncate font-medium text-graystone-800">
                          {request.title}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl text-ocean-900">Brief preview</CardTitle>
          <p className="text-sm text-graystone-500">
            Markdown generated at submission time and stored in the request record.
          </p>
        </CardHeader>
        <CardContent>
          {!selectedRequest ? (
            <p className="text-sm text-graystone-500">Select a request to preview the brief.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={STATUS_BADGE_CLASSES[selectedRequest.status]}>
                  {selectedRequest.status}
                </Badge>
                {selectedRequest.deadline ? (
                  <Badge variant="outline">Deadline {selectedRequest.deadline}</Badge>
                ) : null}
                {selectedRequest.convertedEntryId ? (
                  <Badge variant="outline">Entry linked</Badge>
                ) : null}
              </div>

              <pre className="max-h-[420px] overflow-auto rounded-2xl border border-graystone-200 bg-graystone-50 p-4 text-xs leading-5 text-graystone-800">
                {selectedRequest.generatedBrief}
              </pre>

              <div className="flex flex-wrap items-center gap-2">
                {selectedRequest.status === 'Pending' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateStatus(selectedRequest.id, 'In Progress')}
                  >
                    Start review
                  </Button>
                ) : null}
                {selectedRequest.status !== 'Converted' && selectedRequest.status !== 'Declined' ? (
                  <Button size="sm" onClick={() => onConvertToEntry(selectedRequest)}>
                    Convert to Entry
                  </Button>
                ) : null}
                {selectedRequest.status !== 'Declined' && selectedRequest.status !== 'Converted' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUpdateStatus(selectedRequest.id, 'Declined')}
                  >
                    Decline
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ContentRequestsView;
