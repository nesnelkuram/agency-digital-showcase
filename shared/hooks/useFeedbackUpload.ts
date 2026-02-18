import { useState, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import { createFeedbackVideo, updateFeedbackVideo } from '@/shared/services/feedbackService';
import type { FeedbackVideo, RecordingMode } from '@/shared/types/feedback';

const MAX_VIDEO_SIZE_MB = 300;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

interface UseFeedbackUploadReturn {
  uploading: boolean;
  uploadProgress: number;
  uploadRecording: (
    blob: Blob,
    mode: RecordingMode,
    duration: number,
    audioBlob?: Blob | null,
    projectId?: string
  ) => Promise<FeedbackVideo | null>;
  uploadVideoFile: (
    file: File,
    duration: number,
    projectId?: string
  ) => Promise<FeedbackVideo | null>;
  error: string | null;
}

function generatePlaceholderTitle(): string {
  return `Kayit - ${new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function generateThumbnail(videoBlob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(videoBlob);
    video.src = url;
    video.muted = true;
    video.currentTime = 1;

    video.onloadeddata = () => {
      video.currentTime = 1;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            resolve(blob);
          },
          'image/jpeg',
          0.7
        );
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, 5000);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip data URL prefix (e.g., "data:audio/webm;base64,")
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function callTranscriptionAPI(
  audioBlob: Blob | null | undefined,
  videoUrl: string | null,
  mimeType: string,
  duration: number,
  recordingMode: RecordingMode
): Promise<{ title: string; description: string } | null> {
  try {
    let body: Record<string, unknown>;

    if (audioBlob && audioBlob.size > 0) {
      // FAST PATH: Send audio inline as base64
      const audioData = await blobToBase64(audioBlob);
      body = {
        audioData,
        audioMimeType: audioBlob.type || 'audio/webm',
        duration,
        recordingMode,
      };
    } else if (videoUrl) {
      // SLOW PATH: Send video URL for File API processing
      body = { videoUrl, mimeType, duration, recordingMode };
    } else {
      return null;
    }

    const response = await fetch('/api/transcribe-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.success && data.title) {
      return { title: data.title, description: data.description || '' };
    }
    return null;
  } catch (error) {
    console.error('[FeedbackUpload] AI transcription failed:', error);
    return null;
  }
}

export function useFeedbackUpload(): UseFeedbackUploadReturn {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadToStorage = useCallback(
    async (
      blob: Blob,
      mode: RecordingMode,
      duration: number,
      mimeType: string,
      audioBlob?: Blob | null,
      projectId?: string
    ): Promise<FeedbackVideo | null> => {
      if (!db || !storage || !user) {
        setError('Baglanti hatasi');
        return null;
      }

      if (blob.size > MAX_VIDEO_SIZE_BYTES) {
        const sizeMB = Math.round(blob.size / (1024 * 1024));
        setError(`Video cok buyuk (${sizeMB}MB). Maksimum ${MAX_VIDEO_SIZE_MB}MB yuklenebilir.`);
        return null;
      }

      setUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        const timestamp = Date.now();
        const placeholderTitle = generatePlaceholderTitle();
        const safeTitle = `recording_${timestamp}`;
        const ext = mimeType.includes('webm') ? 'webm' : 'mp4';

        // ── PARALLEL: Video upload + AI transcription + Thumbnail ──

        // 1. Start video upload to Firebase Storage
        const videoPath = `feedback/${user.uid}/${timestamp}_${safeTitle}.${ext}`;
        const videoRef = ref(storage, videoPath);
        setUploadProgress(5);

        const videoUploadPromise = new Promise<string>((resolve, reject) => {
          const uploadTask = uploadBytesResumable(videoRef, blob, {
            contentType: mimeType,
          });
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 70;
              setUploadProgress(Math.round(5 + pct));
            },
            (err) => reject(err),
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            }
          );
        });

        // 2. Start AI transcription in parallel (fast path with audio blob)
        const aiPromise = audioBlob
          ? callTranscriptionAPI(audioBlob, null, mimeType, duration, mode)
          : Promise.resolve(null);

        // 3. Start thumbnail generation in parallel
        const thumbnailPromise = generateThumbnail(blob);

        // Wait for all three in parallel
        const [videoUrl, aiResult, thumbnailBlob] = await Promise.all([
          videoUploadPromise,
          aiPromise,
          thumbnailPromise,
        ]);

        setUploadProgress(80);

        // Upload thumbnail if generated
        let thumbnailUrl: string | undefined;
        if (thumbnailBlob) {
          const thumbPath = `feedback/${user.uid}/${timestamp}_${safeTitle}_thumb.jpg`;
          const thumbRef = ref(storage, thumbPath);
          const thumbTask = uploadBytesResumable(thumbRef, thumbnailBlob, {
            contentType: 'image/jpeg',
          });
          await new Promise<void>((resolve, reject) => {
            thumbTask.on('state_changed', null, reject, async () => {
              thumbnailUrl = await getDownloadURL(thumbTask.snapshot.ref);
              resolve();
            });
          });
        }
        setUploadProgress(90);

        // Determine title/description: AI result or placeholder
        const title = aiResult?.title || placeholderTitle;
        const description = aiResult?.description || '';
        const status = aiResult ? 'ready' as const : (audioBlob ? 'ready' as const : 'transcribing' as const);

        // Create Firestore record
        const videoId = await createFeedbackVideo(
          tenantId,
          {
            title,
            description,
            videoUrl,
            thumbnailUrl,
            duration,
            recordingMode: mode,
            projectId,
            status,
            metadata: {
              size: blob.size,
              mimeType,
            },
          },
          user.uid,
          user.displayName || user.email || 'Unknown'
        );
        setUploadProgress(100);

        // For file uploads without audio: fire async video-based transcription
        if (!audioBlob && !aiResult) {
          callTranscriptionAPI(null, videoUrl, mimeType, duration, mode).then(
            async (result) => {
              if (result) {
                await updateFeedbackVideo(tenantId, videoId, {
                  title: result.title,
                  description: result.description,
                  status: 'ready',
                });
              } else {
                await updateFeedbackVideo(tenantId, videoId, { status: 'ready' });
              }
            }
          );
        }

        const video: FeedbackVideo = {
          id: videoId,
          title,
          description,
          videoUrl,
          thumbnailUrl,
          duration,
          recordingMode: mode,
          projectId,
          tags: [],
          shareToken: '',
          isPublic: true,
          allowedUsers: [],
          viewCount: 0,
          commentCount: 0,
          status,
          metadata: { size: blob.size, mimeType },
          createdBy: user.uid,
          createdByName: user.displayName || user.email || 'Unknown',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        return video;
      } catch (err: any) {
        const code = err?.code || '';
        const sizeMB = Math.round(blob.size / (1024 * 1024));
        console.error('[FeedbackUpload] Error:', {
          code,
          message: err?.message,
          serverResponse: err?.serverResponse,
          blobSize: `${sizeMB}MB`,
          mimeType,
          fullError: err,
        });
        if (code === 'storage/retry-limit-exceeded') {
          setError(`Yukleme zaman asimina ugradi (${sizeMB}MB). Lutfen internet baglantinizi kontrol edip tekrar deneyin.`);
        } else if (code === 'storage/unauthorized') {
          setError('Yukleme yetkisi yok. Lutfen tekrar giris yapin.');
        } else if (code === 'storage/canceled') {
          setError('Yukleme iptal edildi.');
        } else {
          setError(err.message || 'Video yuklenirken hata olustu');
        }
        return null;
      } finally {
        setUploading(false);
        setTimeout(() => setUploadProgress(0), 1000);
      }
    },
    [tenantId, user]
  );

  const uploadRecording = useCallback(
    async (
      blob: Blob,
      mode: RecordingMode,
      duration: number,
      audioBlob?: Blob | null,
      projectId?: string
    ): Promise<FeedbackVideo | null> => {
      return uploadToStorage(blob, mode, duration, blob.type || 'video/webm', audioBlob, projectId);
    },
    [uploadToStorage]
  );

  const uploadVideoFile = useCallback(
    async (
      file: File,
      duration: number,
      projectId?: string
    ): Promise<FeedbackVideo | null> => {
      // File uploads don't have separate audio - use slow path
      return uploadToStorage(file, 'camera', duration, file.type, null, projectId);
    },
    [uploadToStorage]
  );

  return {
    uploading,
    uploadProgress,
    uploadRecording,
    uploadVideoFile,
    error,
  };
}
