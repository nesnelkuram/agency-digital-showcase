import { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleDriveFile, GoogleDriveFolder } from '@/shared/types/asset';
import { getAuth } from 'firebase/auth';

interface DriveConnectionStatus {
  connected: boolean;
  email?: string;
  lastSyncAt?: string;
}

interface UseGoogleDriveReturn {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  files: GoogleDriveFile[];
  folders: GoogleDriveFolder[];
  currentFolderId: string | null;
  breadcrumbs: { id: string; name: string }[];
  connectionEmail: string | null;
  lastSyncAt: string | null;
  connect: () => void;
  disconnect: () => void;
  listFiles: (folderId?: string) => Promise<void>;
  navigateToFolder: (folderId: string | null, folderName?: string) => void;
  navigateUp: () => void;
  searchFiles: (query: string) => Promise<void>;
  importFile: (fileId: string, folderId?: string, mode?: 'link' | 'copy') => Promise<string | null>;
  syncDrive: (driveFolderId?: string) => Promise<{ syncedFolders: number; syncedFiles: number } | null>;
  checkConnection: () => Promise<void>;
}

async function getAuthToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const token = await getAuthToken();
  const resp = await fetch(path, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(json.error || `API error: ${resp.status}`);
  }
  return json;
}

export function useGoogleDrive(): UseGoogleDriveReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [connectionEmail, setConnectionEmail] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const checkedRef = useRef(false);

  const checkConnection = useCallback(async () => {
    try {
      const data: DriveConnectionStatus = await apiFetch('/api/drive/connection-status');
      setIsConnected(data.connected);
      setConnectionEmail(data.email || null);
      setLastSyncAt(data.lastSyncAt || null);
    } catch {
      setIsConnected(false);
    }
  }, []);

  // Check connection on mount
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    checkConnection();
  }, [checkConnection]);

  // Check for ?connected=google_drive in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'google_drive') {
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('connected');
      window.history.replaceState({}, '', url.toString());
      // Recheck connection
      checkConnection();
    }
  }, [checkConnection]);

  const connect = useCallback(() => {
    const state = JSON.stringify({
      platform: 'google_drive',
      redirectPath: '/admin/assets',
    });
    window.location.href = `/api/marketing/platforms/connect?platform=google_drive&state=${encodeURIComponent(state)}`;
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setFiles([]);
    setFolders([]);
    setCurrentFolderId(null);
    setBreadcrumbs([]);
    setConnectionEmail(null);
  }, []);

  const listFiles = useCallback(async (folderId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (folderId) params.set('folderId', folderId);
      const data = await apiFetch(`/api/drive/list?${params.toString()}`);
      setFolders(data.folders || []);
      setFiles(data.files || []);
      setCurrentFolderId(folderId || null);
    } catch (err: any) {
      setError(err.message || 'Dosyalar yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const navigateToFolder = useCallback(
    (folderId: string | null, folderName?: string) => {
      if (folderId === null) {
        setBreadcrumbs([]);
        listFiles();
      } else {
        if (folderName) {
          setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
        }
        listFiles(folderId);
      }
    },
    [listFiles]
  );

  const navigateUp = useCallback(() => {
    if (breadcrumbs.length === 0) return;
    const newBreadcrumbs = breadcrumbs.slice(0, -1);
    setBreadcrumbs(newBreadcrumbs);
    const parentId = newBreadcrumbs.length > 0 ? newBreadcrumbs[newBreadcrumbs.length - 1].id : undefined;
    listFiles(parentId);
  }, [breadcrumbs, listFiles]);

  const searchFiles = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/api/drive/list?q=${encodeURIComponent(query)}`);
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch (err: any) {
      setError(err.message || 'Arama başarısız');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const importFile = useCallback(
    async (fileId: string, folderId?: string, mode: 'link' | 'copy' = 'link'): Promise<string | null> => {
      try {
        const data = await apiFetch('/api/drive/import', {
          method: 'POST',
          body: JSON.stringify({ fileId, folderId, mode }),
        });
        return data.assetId || null;
      } catch (err: any) {
        setError(err.message || 'Import başarısız');
        return null;
      }
    },
    []
  );

  const syncDrive = useCallback(
    async (driveFolderId?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiFetch('/api/drive/sync', {
          method: 'POST',
          body: JSON.stringify({ driveFolderId }),
        });
        setLastSyncAt(new Date().toISOString());
        return { syncedFolders: data.syncedFolders, syncedFiles: data.syncedFiles };
      } catch (err: any) {
        setError(err.message || 'Senkronizasyon başarısız');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isConnected,
    isLoading,
    error,
    files,
    folders,
    currentFolderId,
    breadcrumbs,
    connectionEmail,
    lastSyncAt,
    connect,
    disconnect,
    listFiles,
    navigateToFolder,
    navigateUp,
    searchFiles,
    importFile,
    syncDrive,
    checkConnection,
  };
}
