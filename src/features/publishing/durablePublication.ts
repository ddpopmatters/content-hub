import type { DurablePublicationJob, Entry, PlatformPublishStatus } from '../../types/models';

export const shouldReconcilePublicationJob = (job: DurablePublicationJob): boolean =>
  job.status === 'queued' || job.status === 'publishing';

export const getDurablePublishStatus = (
  job: DurablePublicationJob,
): Record<string, PlatformPublishStatus> =>
  Object.fromEntries(
    job.results.map((result) => [
      result.platform,
      {
        status: result.status,
        url: result.url,
        error: result.error,
        timestamp: result.completedAt ?? result.updatedAt,
      } satisfies PlatformPublishStatus,
    ]),
  );

/** Project the latest durable job onto the legacy entry view without persisting secrets. */
export function applyDurablePublicationJob(
  entry: Entry,
  job: DurablePublicationJob | undefined,
): Entry {
  if (!job || job.entryId !== entry.id || job.entryRevision !== entry.contentRevision) {
    return entry;
  }

  return {
    ...entry,
    publicationJob: job,
    publishStatus: getDurablePublishStatus(job),
    ...(job.status === 'published'
      ? {
          workflowStatus: 'Published',
          publishedAt: job.completedAt,
        }
      : {}),
  };
}
