import { useState, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import type { MediaItem } from '@/shared/types/socialMedia';

interface UseMediaUploadReturn {
  uploadFiles: (files: File[], projectId: string) => Promise<MediaItem[]>;
  uploading: boolean;
  progress: number;
  fileProgress: Map<string, number>;
  error: string | null;
  clearError: () => void;
}

const IMAGE_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const VIDEO_MAX_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES = 10;

function generateThumbnail(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(undefined);
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      const maxDim = 200;
      const ratio = Math.min(maxDim / img.width, maxDim / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
      URL.revokeObjectURL(img.src);
    };

    img.onerror = () => {
      resolve(undefined);
      URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(file);
  });
}

function getMediaDimensions(file: File): Promise<{ width?: number; height?: number; duration?: number }> {
  return new Promise((resolve) => {
    if (file.type.startsWith('image/')) {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        resolve({});
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
        });
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => {
        resolve({});
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
    } else {
      resolve({});
    }
  });
}

export function useMediaUpload(): UseMediaUploadReturn {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileProgress, setFileProgress] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const uploadFiles = useCallback(
    async (files: File[], projectId: string): Promise<MediaItem[]> => {
      if (!storage || !user || !tenantId) {
        setError('Baglanti hatasi');
        return [];
      }

      if (files.length > MAX_FILES) {
        setError(`En fazla ${MAX_FILES} dosya yukleyebilirsiniz.`);
        return [];
      }

      // Validate file sizes
      for (const file of files) {
        const isVideo = file.type.startsWith('video/');
        const maxSize = isVideo ? VIDEO_MAX_SIZE : IMAGE_MAX_SIZE;
        if (file.size > maxSize) {
          setError(`${file.name}: Dosya boyutu cok buyuk (max ${isVideo ? '100MB' : '10MB'})`);
          return [];
        }
      }

      setUploading(true);
      setProgress(0);
      setError(null);

      const progressMap = new Map<string, number>();
      files.forEach((f) => progressMap.set(f.name, 0));
      setFileProgress(new Map(progressMap));

      const results: MediaItem[] = [];

      // Upload max 3 in parallel
      const chunks: File[][] = [];
      for (let i = 0; i < files.length; i += 3) {
        chunks.push(files.slice(i, i + 3));
      }

      let completedCount = 0;

      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(async (file, chunkIndex) => {
            try {
              const timestamp = Date.now();
              const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
              const filePath = `social-media/${tenantId}/${projectId}/${timestamp}_${safeName}`;
              const storageRef = ref(storage, filePath);

              progressMap.set(file.name, 30);
              setFileProgress(new Map(progressMap));

              await uploadBytes(storageRef, file);

              progressMap.set(file.name, 70);
              setFileProgress(new Map(progressMap));

              const downloadUrl = await getDownloadURL(storageRef);

              progressMap.set(file.name, 90);
              setFileProgress(new Map(progressMap));

              const [thumbnail, dimensions] = await Promise.all([
                generateThumbnail(file),
                getMediaDimensions(file),
              ]);

              progressMap.set(file.name, 100);
              setFileProgress(new Map(progressMap));

              completedCount++;
              setProgress(Math.round((completedCount / files.length) * 100));

              const mediaItem: MediaItem = {
                id: crypto.randomUUID(),
                url: downloadUrl,
                thumbnailUrl: thumbnail,
                type: file.type.startsWith('video/') ? 'video' : 'image',
                mimeType: file.type,
                size: file.size,
                width: dimensions.width,
                height: dimensions.height,
                duration: dimensions.duration,
                order: results.length + chunkIndex,
              };

              return mediaItem;
            } catch (err: any) {
              console.error(`[useMediaUpload] Error uploading ${file.name}:`, err);
              progressMap.set(file.name, -1);
              setFileProgress(new Map(progressMap));
              return null;
            }
          })
        );

        results.push(...chunkResults.filter((r): r is MediaItem => r !== null));
      }

      // Re-order
      results.forEach((item, index) => {
        item.order = index;
      });

      setUploading(false);
      setProgress(100);

      if (results.length < files.length) {
        setError(`${files.length - results.length} dosya yuklenemedi.`);
      }

      return results;
    },
    [user, tenantId]
  );

  return {
    uploadFiles,
    uploading,
    progress,
    fileProgress,
    error,
    clearError,
  };
}
