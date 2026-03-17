import { useState, useCallback, useRef, useEffect } from 'react';
import { getAuth } from 'firebase/auth';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PARALLEL = 2;
const STORAGE_KEY = 'drive_upload_sessions';

export interface UploadItem {
  id: string;
  file?: File;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sessionUri: string;
  sessionId: string;
  uploadedBytes: number;
  status: 'uploading' | 'paused' | 'completed' | 'failed' | 'expired';
  driveFolderId?: string;
  driveFileId?: string;
  error?: string;
}

interface UseDriveUploadReturn {
  uploads: UploadItem[];
  isUploading: boolean;
  addFiles: (files: File[], driveFolderId?: string) => Promise<void>;
  pauseUpload: (sessionId: string) => void;
  resumeUpload: (sessionId: string) => void;
  cancelUpload: (sessionId: string) => void;
  retryUpload: (sessionId: string) => void;
  clearCompleted: () => void;
}

async function getAuthToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

function loadSavedSessions(): Partial<UploadItem>[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveSessions(uploads: UploadItem[]) {
  const toSave = uploads
    .filter((u) => u.status !== 'completed' && u.status !== 'expired')
    .map(({ file, ...rest }) => rest);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

export function useDriveUpload(): UseDriveUploadReturn {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const activeCount = useRef(0);
  const queueRef = useRef<string[]>([]);

  const isUploading = uploads.some((u) => u.status === 'uploading');

  // Restore sessions on mount
  useEffect(() => {
    const saved = loadSavedSessions();
    if (saved.length > 0) {
      const restored = saved.map((s) => ({
        ...s,
        status: s.status === 'uploading' ? 'paused' : s.status,
      })) as UploadItem[];
      setUploads(restored);
    }
  }, []);

  // Persist sessions on change
  useEffect(() => {
    saveSessions(uploads);
  }, [uploads]);

  const updateUpload = useCallback((sessionId: string, updates: Partial<UploadItem>) => {
    setUploads((prev) => prev.map((u) => (u.sessionId === sessionId ? { ...u, ...updates } : u)));
  }, []);

  const processNextInQueue = useCallback(() => {
    while (activeCount.current < MAX_PARALLEL && queueRef.current.length > 0) {
      const nextId = queueRef.current.shift()!;
      uploadChunks(nextId);
    }
  }, []);

  const uploadChunks = useCallback(
    async (sessionId: string) => {
      const upload = uploads.find((u) => u.sessionId === sessionId) ||
        (() => { const saved = loadSavedSessions(); return saved.find((s) => s.sessionId === sessionId); })();
      if (!upload || !upload.sessionUri) return;

      activeCount.current++;
      const controller = new AbortController();
      abortControllers.current.set(sessionId, controller);

      updateUpload(sessionId, { status: 'uploading' });

      let offset = upload.uploadedBytes || 0;
      const fileSize = upload.fileSize;
      const file = (upload as UploadItem).file;

      try {
        while (offset < fileSize) {
          if (controller.signal.aborted) {
            updateUpload(sessionId, { status: 'paused', uploadedBytes: offset });
            break;
          }

          const end = Math.min(offset + CHUNK_SIZE, fileSize);

          if (!file) {
            // No file reference (restored session) — can't continue without file
            updateUpload(sessionId, {
              status: 'paused',
              uploadedBytes: offset,
              error: 'Dosya referansı kayıp. Lütfen dosyayı tekrar seçin.',
            });
            break;
          }

          const chunk = file.slice(offset, end);
          const resp = await fetch(upload.sessionUri, {
            method: 'PUT',
            headers: {
              'Content-Range': `bytes ${offset}-${end - 1}/${fileSize}`,
              'Content-Type': upload.mimeType,
            },
            body: chunk,
            signal: controller.signal,
          });

          if (resp.status === 200 || resp.status === 201) {
            // Upload complete
            const result = await resp.json();
            updateUpload(sessionId, {
              status: 'completed',
              uploadedBytes: fileSize,
              driveFileId: result.id,
            });
            break;
          }

          if (resp.status === 308) {
            // Chunk received, continue
            const range = resp.headers.get('Range');
            offset = range ? parseInt(range.split('-')[1], 10) + 1 : end;
            updateUpload(sessionId, { uploadedBytes: offset });
          } else {
            throw new Error(`Upload failed with status ${resp.status}`);
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          updateUpload(sessionId, { status: 'paused', uploadedBytes: offset });
        } else {
          updateUpload(sessionId, {
            status: 'failed',
            uploadedBytes: offset,
            error: err.message || 'Yükleme başarısız',
          });
        }
      } finally {
        activeCount.current--;
        abortControllers.current.delete(sessionId);
        processNextInQueue();
      }
    },
    [uploads, updateUpload, processNextInQueue]
  );

  const addFiles = useCallback(
    async (files: File[], driveFolderId?: string) => {
      const token = await getAuthToken();

      for (const file of files) {
        try {
          const resp = await fetch('/api/drive/initiate-upload', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              fileSize: file.size,
              folderId: driveFolderId,
            }),
          });

          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error);

          const newUpload: UploadItem = {
            id: data.sessionId,
            file,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
            sessionUri: data.sessionUri,
            sessionId: data.sessionId,
            uploadedBytes: 0,
            status: 'uploading',
            driveFolderId,
          };

          setUploads((prev) => [...prev, newUpload]);

          if (activeCount.current < MAX_PARALLEL) {
            uploadChunks(data.sessionId);
          } else {
            queueRef.current.push(data.sessionId);
          }
        } catch (err: any) {
          console.error('[useDriveUpload] Failed to initiate upload:', err.message);
        }
      }
    },
    [uploadChunks]
  );

  const pauseUpload = useCallback((sessionId: string) => {
    const controller = abortControllers.current.get(sessionId);
    if (controller) controller.abort();
  }, []);

  const resumeUpload = useCallback(
    (sessionId: string) => {
      const upload = uploads.find((u) => u.sessionId === sessionId);
      if (!upload || upload.status === 'uploading') return;

      if (activeCount.current < MAX_PARALLEL) {
        uploadChunks(sessionId);
      } else {
        queueRef.current.push(sessionId);
      }
    },
    [uploads, uploadChunks]
  );

  const cancelUpload = useCallback(
    (sessionId: string) => {
      const controller = abortControllers.current.get(sessionId);
      if (controller) controller.abort();
      setUploads((prev) => prev.filter((u) => u.sessionId !== sessionId));
      queueRef.current = queueRef.current.filter((id) => id !== sessionId);
    },
    []
  );

  const retryUpload = useCallback(
    (sessionId: string) => {
      resumeUpload(sessionId);
    },
    [resumeUpload]
  );

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status !== 'completed'));
  }, []);

  return {
    uploads,
    isUploading,
    addFiles,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryUpload,
    clearCompleted,
  };
}
