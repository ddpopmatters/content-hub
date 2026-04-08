import { useCallback } from 'react';
import { getSupabase, initSupabase } from '../lib/supabase';

const STORAGE_BUCKET = 'content-media';
const MAX_STORAGE_UPLOAD_BYTES = 500 * 1024 * 1024;
const MAX_INLINE_PREVIEW_BYTES = 512 * 1024;

type ToastFn = (message: string, type?: 'success' | 'warning' | 'error') => void;

const canUseInlinePreviewFallback = (file: File): boolean => file.size <= MAX_INLINE_PREVIEW_BYTES;

const readFileAsDataUrl = async (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });

const isStorageConfigError = (message: string): boolean =>
  /bucket|storage|not found|permission|policy|row-level security|unauthorized/i.test(message);

const buildStoragePath = (file: File): string => {
  const extension = file.name.split('.').pop()?.trim() || 'bin';
  const id =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `entries/${id}.${extension}`;
};

interface UseAssetPreviewUploadOptions {
  pushSyncToast?: ToastFn;
}

export function useAssetPreviewUpload({ pushSyncToast }: UseAssetPreviewUploadOptions = {}): {
  uploadFiles: (files: File[]) => Promise<string[]>;
} {
  const uploadFiles = useCallback(
    async (files: File[]): Promise<string[]> => {
      const uploadedUrls: string[] = [];

      for (const file of files) {
        if (file.size > MAX_STORAGE_UPLOAD_BYTES) {
          pushSyncToast?.('Each file must be under 500 MB.', 'warning');
          continue;
        }

        const client = (await initSupabase()) ?? getSupabase();
        if (client) {
          const path = buildStoragePath(file);
          const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, file, {
            upsert: false,
            contentType: file.type || undefined,
          });

          if (!error) {
            const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
            if (data?.publicUrl) {
              uploadedUrls.push(data.publicUrl);
              continue;
            }
          } else if (!isStorageConfigError(error.message) || !canUseInlinePreviewFallback(file)) {
            pushSyncToast?.(`Upload failed: ${error.message}`, 'error');
            continue;
          }
        }

        if (canUseInlinePreviewFallback(file)) {
          const inlinePreview = await readFileAsDataUrl(file);
          uploadedUrls.push(inlinePreview);
          pushSyncToast?.(
            'Preview storage is unavailable, so a local inline preview was used for this file.',
            'warning',
          );
          continue;
        }

        pushSyncToast?.(
          'Preview storage is unavailable. Use a hosted preview URL or configure the content-media bucket for files over 500 KB.',
          'error',
        );
      }

      return uploadedUrls;
    },
    [pushSyncToast],
  );

  return { uploadFiles };
}
