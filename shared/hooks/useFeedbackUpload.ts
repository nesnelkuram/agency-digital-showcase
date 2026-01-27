import { useState, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { createFeedbackVideo } from '@/shared/services/feedbackService';
import type { FeedbackVideo, RecordingMode } from '@/shared/types/feedback';

interface UseFeedbackUploadReturn {
  uploading: boolean;
  uploadProgress: number;
  uploadRecording: (
    blob: Blob,
    title: string,
    mode: RecordingMode,
    duration: number,
    projectId?: string
  ) => Promise<FeedbackVideo | null>;
  uploadVideoFile: (
    file: File,
    title: string,
    duration: number,
    projectId?: string
  ) => Promise<FeedbackVideo | null>;
  error: string | null;
}

function generateThumbnail(videoBlob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(videoBlob);
    video.src = url;
    video.muted = true;
    video.currentTime = 1; // 1. saniyeyi yakala

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

    // Timeout fallback
    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, 5000);
  });
}

export function useFeedbackUpload(): UseFeedbackUploadReturn {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadToStorage = useCallback(
    async (
      blob: Blob,
      title: string,
      mode: RecordingMode,
      duration: number,
      mimeType: string,
      projectId?: string
    ): Promise<FeedbackVideo | null> => {
      if (!db || !storage || !user) {
        setError('Baglanti hatasi');
        return null;
      }

      setUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        const timestamp = Date.now();
        const safeTitle = title.replace(/[^a-zA-Z0-9.-]/g, '_');
        const ext = mimeType.includes('webm') ? 'webm' : 'mp4';

        // Upload video with resumable upload (handles large files + retries)
        const videoPath = `feedback/${user.uid}/${timestamp}_${safeTitle}.${ext}`;
        const videoRef = ref(storage, videoPath);
        setUploadProgress(5);

        const videoUrl = await new Promise<string>((resolve, reject) => {
          const uploadTask = uploadBytesResumable(videoRef, blob, {
            contentType: mimeType,
          });

          uploadTask.on(
            'state_changed',
            (snapshot) => {
              // Video upload = 0-65% of total progress
              const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 65;
              setUploadProgress(Math.round(pct));
            },
            (err) => reject(err),
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            }
          );
        });
        setUploadProgress(65);

        // Generate and upload thumbnail
        let thumbnailUrl: string | undefined;
        const thumbnailBlob = await generateThumbnail(blob);
        if (thumbnailBlob) {
          const thumbPath = `feedback/${user.uid}/${timestamp}_${safeTitle}_thumb.jpg`;
          const thumbRef = ref(storage, thumbPath);
          // Thumbnail is small, resumable not needed but consistent
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
        setUploadProgress(80);

        // Create Firestore record
        const videoId = await createFeedbackVideo(
          {
            title,
            videoUrl,
            thumbnailUrl,
            duration,
            recordingMode: mode,
            projectId,
            metadata: {
              size: blob.size,
              mimeType,
            },
          },
          user.uid,
          user.displayName || user.email || 'Unknown'
        );
        setUploadProgress(100);

        // Return the created video object
        const video: FeedbackVideo = {
          id: videoId,
          title,
          videoUrl,
          thumbnailUrl,
          duration,
          recordingMode: mode,
          projectId,
          tags: [],
          shareToken: '', // will be set by service
          isPublic: true,
          allowedUsers: [],
          viewCount: 0,
          commentCount: 0,
          status: 'ready',
          metadata: { size: blob.size, mimeType },
          createdBy: user.uid,
          createdByName: user.displayName || user.email || 'Unknown',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        return video;
      } catch (err: any) {
        console.error('[FeedbackUpload] Error:', err);
        setError(err.message || 'Video yuklenirken hata olustu');
        return null;
      } finally {
        setUploading(false);
        setTimeout(() => setUploadProgress(0), 1000);
      }
    },
    [user]
  );

  const uploadRecording = useCallback(
    async (
      blob: Blob,
      title: string,
      mode: RecordingMode,
      duration: number,
      projectId?: string
    ): Promise<FeedbackVideo | null> => {
      return uploadToStorage(blob, title, mode, duration, blob.type || 'video/webm', projectId);
    },
    [uploadToStorage]
  );

  const uploadVideoFile = useCallback(
    async (
      file: File,
      title: string,
      duration: number,
      projectId?: string
    ): Promise<FeedbackVideo | null> => {
      return uploadToStorage(file, title, 'camera', duration, file.type, projectId);
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
