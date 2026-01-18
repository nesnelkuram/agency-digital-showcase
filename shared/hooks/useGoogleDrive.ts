import { useState, useCallback, useEffect } from 'react';
import { GoogleDriveFile, GoogleDriveFolder } from '@/shared/types/asset';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

interface UseGoogleDriveReturn {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  files: GoogleDriveFile[];
  folders: GoogleDriveFolder[];
  currentFolderId: string | null;
  breadcrumbs: { id: string; name: string }[];
  connect: () => Promise<void>;
  disconnect: () => void;
  listFiles: (folderId?: string) => Promise<void>;
  navigateToFolder: (folderId: string | null, folderName?: string) => void;
  navigateUp: () => void;
  searchFiles: (query: string) => Promise<void>;
  getFileDownloadUrl: (fileId: string) => Promise<string | null>;
}

// Load Google API script
function loadGoogleApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.gapi) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google API yuklenemedi'));
    document.body.appendChild(script);
  });
}

// Load Google Identity Services
function loadGoogleIdentity(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity Services yuklenemedi'));
    document.body.appendChild(script);
  });
}

export function useGoogleDrive(): UseGoogleDriveReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [folders, setFolders] = useState<GoogleDriveFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);

  // Check if Google Drive is configured
  const isConfigured = !!(GOOGLE_CLIENT_ID && GOOGLE_API_KEY);

  // Initialize Google API
  useEffect(() => {
    if (!isConfigured) return;

    const initializeGoogleApi = async () => {
      try {
        await loadGoogleApi();
        await loadGoogleIdentity();

        // Initialize GAPI client
        await new Promise<void>((resolve) => {
          window.gapi.load('client', async () => {
            await window.gapi.client.init({
              apiKey: GOOGLE_API_KEY,
              discoveryDocs: [
                'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
              ],
            });
            resolve();
          });
        });

        // Initialize token client
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPES,
          callback: (response: any) => {
            if (response.access_token) {
              setAccessToken(response.access_token);
              setIsConnected(true);
              // Load root files after connecting
              listFilesInternal(null, response.access_token);
            }
          },
        });
        setTokenClient(client);

        // Check for existing token in localStorage
        const savedToken = localStorage.getItem('google_drive_token');
        if (savedToken) {
          try {
            // Verify token is still valid
            const response = await fetch(
              'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' +
                savedToken
            );
            if (response.ok) {
              setAccessToken(savedToken);
              setIsConnected(true);
              listFilesInternal(null, savedToken);
            } else {
              localStorage.removeItem('google_drive_token');
            }
          } catch {
            localStorage.removeItem('google_drive_token');
          }
        }
      } catch (err) {
        console.error('[GoogleDrive] Init error:', err);
        setError('Google Drive baglantisi kurulamadi');
      }
    };

    initializeGoogleApi();
  }, [isConfigured]);

  const listFilesInternal = async (
    folderId: string | null,
    token: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const parentQuery = folderId
        ? `'${folderId}' in parents`
        : "'root' in parents";

      // Fetch folders
      const foldersResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?` +
          new URLSearchParams({
            q: `${parentQuery} and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id,name,parents)',
            orderBy: 'name',
            pageSize: '100',
          }),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!foldersResponse.ok) {
        throw new Error('Klasorler yuklenemedi');
      }

      const foldersData = await foldersResponse.json();
      setFolders(foldersData.files || []);

      // Fetch files (non-folders)
      const filesResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?` +
          new URLSearchParams({
            q: `${parentQuery} and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
            fields:
              'files(id,name,mimeType,size,thumbnailLink,webViewLink,webContentLink,iconLink,createdTime,modifiedTime,parents)',
            orderBy: 'modifiedTime desc',
            pageSize: '100',
          }),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!filesResponse.ok) {
        throw new Error('Dosyalar yuklenemedi');
      }

      const filesData = await filesResponse.json();
      setFiles(filesData.files || []);
      setCurrentFolderId(folderId);
    } catch (err: any) {
      console.error('[GoogleDrive] List files error:', err);
      setError(err.message || 'Dosyalar yuklenirken hata olustu');
    } finally {
      setIsLoading(false);
    }
  };

  const connect = useCallback(async () => {
    if (!isConfigured) {
      setError('Google Drive yapilandirmasi eksik. VITE_GOOGLE_CLIENT_ID ve VITE_GOOGLE_API_KEY gerekli.');
      return;
    }

    if (!tokenClient) {
      setError('Google API henuz hazir degil');
      return;
    }

    try {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      console.error('[GoogleDrive] Connect error:', err);
      setError('Google Drive baglantisi kurulamadi');
    }
  }, [tokenClient, isConfigured]);

  const disconnect = useCallback(() => {
    setAccessToken(null);
    setIsConnected(false);
    setFiles([]);
    setFolders([]);
    setCurrentFolderId(null);
    setBreadcrumbs([]);
    localStorage.removeItem('google_drive_token');

    if (accessToken) {
      window.google?.accounts?.oauth2?.revoke(accessToken);
    }
  }, [accessToken]);

  const listFiles = useCallback(
    async (folderId?: string) => {
      if (!accessToken) {
        setError('Google Drive baglantisi gerekli');
        return;
      }
      await listFilesInternal(folderId || null, accessToken);
    },
    [accessToken]
  );

  const navigateToFolder = useCallback(
    (folderId: string | null, folderName?: string) => {
      if (!accessToken) return;

      if (folderId === null) {
        // Navigate to root
        setBreadcrumbs([]);
      } else if (folderName) {
        setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
      }

      listFilesInternal(folderId, accessToken);
    },
    [accessToken]
  );

  const navigateUp = useCallback(() => {
    if (!accessToken || breadcrumbs.length === 0) return;

    const newBreadcrumbs = breadcrumbs.slice(0, -1);
    setBreadcrumbs(newBreadcrumbs);

    const parentId =
      newBreadcrumbs.length > 0
        ? newBreadcrumbs[newBreadcrumbs.length - 1].id
        : null;
    listFilesInternal(parentId, accessToken);
  }, [accessToken, breadcrumbs]);

  const searchFiles = useCallback(
    async (query: string) => {
      if (!accessToken) {
        setError('Google Drive baglantisi gerekli');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files?` +
            new URLSearchParams({
              q: `name contains '${query}' and trashed=false`,
              fields:
                'files(id,name,mimeType,size,thumbnailLink,webViewLink,webContentLink,iconLink,createdTime,modifiedTime,parents)',
              orderBy: 'modifiedTime desc',
              pageSize: '50',
            }),
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok) {
          throw new Error('Arama yapilamadi');
        }

        const data = await response.json();
        setFiles(data.files || []);
        setFolders([]);
      } catch (err: any) {
        console.error('[GoogleDrive] Search error:', err);
        setError(err.message || 'Arama sirasinda hata olustu');
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken]
  );

  const getFileDownloadUrl = useCallback(
    async (fileId: string): Promise<string | null> => {
      if (!accessToken) return null;

      try {
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok) {
          throw new Error('Dosya indirilemedi');
        }

        const blob = await response.blob();
        return URL.createObjectURL(blob);
      } catch (err) {
        console.error('[GoogleDrive] Download error:', err);
        return null;
      }
    },
    [accessToken]
  );

  // Save token when it changes
  useEffect(() => {
    if (accessToken) {
      localStorage.setItem('google_drive_token', accessToken);
    }
  }, [accessToken]);

  return {
    isConnected,
    isLoading,
    error,
    files,
    folders,
    currentFolderId,
    breadcrumbs,
    connect,
    disconnect,
    listFiles,
    navigateToFolder,
    navigateUp,
    searchFiles,
    getFileDownloadUrl,
  };
}

// Type declarations for Google API
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}
