import { useCallback } from 'react';
import { APP_CONFIG } from '../lib/config';
import { getSupabase, initSupabase } from '../lib/supabase';

const STORAGE_BUCKET = 'content-media';
const MEBIBYTE = 1024 * 1024;
const CONTENT_MEDIA_TYPES: Readonly<
  Record<string, { extension: string; maxBytes: number; sizeLabel: string }>
> = {
  'application/pdf': { extension: 'pdf', maxBytes: 25 * MEBIBYTE, sizeLabel: '25 MB' },
  'image/gif': { extension: 'gif', maxBytes: 10 * MEBIBYTE, sizeLabel: '10 MB' },
  'image/jpeg': { extension: 'jpg', maxBytes: 10 * MEBIBYTE, sizeLabel: '10 MB' },
  'image/png': { extension: 'png', maxBytes: 10 * MEBIBYTE, sizeLabel: '10 MB' },
  'image/webp': { extension: 'webp', maxBytes: 10 * MEBIBYTE, sizeLabel: '10 MB' },
  'video/mp4': { extension: 'mp4', maxBytes: 500 * MEBIBYTE, sizeLabel: '500 MB' },
  'video/quicktime': { extension: 'mov', maxBytes: 500 * MEBIBYTE, sizeLabel: '500 MB' },
  'video/webm': { extension: 'webm', maxBytes: 500 * MEBIBYTE, sizeLabel: '500 MB' },
};

type ToastFn = (message: string, type?: 'success' | 'warning' | 'error') => void;

export const getContentMediaFileIssue = (file: Pick<File, 'size' | 'type'>): string | null => {
  const mediaType = CONTENT_MEDIA_TYPES[file.type];
  if (!mediaType) {
    return 'Upload a supported image, MP4, WebM, MOV or PDF file.';
  }
  if (file.size <= 0) return 'The selected file is empty.';
  if (file.size > mediaType.maxBytes) {
    return `This file must be ${mediaType.sizeLabel} or smaller.`;
  }
  return null;
};

export const buildContentMediaPath = (
  file: Pick<File, 'type'>,
  id: string = crypto.randomUUID(),
): string => {
  const mediaType = CONTENT_MEDIA_TYPES[file.type];
  if (!mediaType) throw new Error('Unsupported content media type');
  return `entries/${id}.${mediaType.extension}`;
};

interface UseAssetPreviewUploadOptions {
  pushSyncToast?: ToastFn;
}

export function useAssetPreviewUpload({ pushSyncToast }: UseAssetPreviewUploadOptions = {}): {
  canUploadFiles: boolean;
  uploadFiles: (files: File[]) => Promise<string[]>;
} {
  const canUploadFiles = APP_CONFIG.CONTENT_MEDIA_UPLOADS_ENABLED;

  const uploadFiles = useCallback(
    async (files: File[]): Promise<string[]> => {
      if (!canUploadFiles) {
        pushSyncToast?.(
          'File uploads are disabled until Content Hub storage is configured.',
          'warning',
        );
        return [];
      }

      const uploadedUrls: string[] = [];

      for (const file of files) {
        const fileIssue = getContentMediaFileIssue(file);
        if (fileIssue) {
          pushSyncToast?.(fileIssue, 'warning');
          continue;
        }

        const client = (await initSupabase()) ?? getSupabase();
        if (client) {
          const path = buildContentMediaPath(file);
          const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, file, {
            upsert: false,
            contentType: file.type,
          });

          if (!error) {
            const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
            if (data?.publicUrl) {
              uploadedUrls.push(data.publicUrl);
              continue;
            }
          } else {
            pushSyncToast?.('Upload failed. Check Content Hub storage and try again.', 'error');
            continue;
          }
        }

        pushSyncToast?.(
          'Preview storage is unavailable. Configure the content-media bucket and upload the image again.',
          'error',
        );
      }

      return uploadedUrls;
    },
    [canUploadFiles, pushSyncToast],
  );

  return { canUploadFiles, uploadFiles };
}
