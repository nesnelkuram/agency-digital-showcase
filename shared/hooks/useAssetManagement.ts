import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  orderBy,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/config';
import { Asset, AssetFolder, getAssetTypeFromMimeType } from '@/shared/types/asset';
import { useAuth } from '@/contexts/AuthContext';

interface UseAssetManagementReturn {
  assets: Asset[];
  folders: AssetFolder[];
  currentFolderId: string | null;
  loading: boolean;
  uploading: boolean;
  uploadProgress: number;
  error: string | null;
  setCurrentFolderId: (id: string | null) => void;
  uploadFile: (file: File, folderId?: string) => Promise<Asset | null>;
  uploadFromUrl: (url: string, name: string, mimeType: string, driveFileId?: string) => Promise<Asset | null>;
  createFolder: (name: string, parentId?: string) => Promise<AssetFolder | null>;
  deleteAsset: (assetId: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  updateAssetTags: (assetId: string, tags: string[]) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useAssetManagement(): UseAssetManagementReturn {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!db) {
      setError('Firestore baglantisi kurulamadi');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build query based on current folder
      const assetsQuery = currentFolderId
        ? query(
            collection(db, 'assets'),
            where('folderId', '==', currentFolderId),
            orderBy('createdAt', 'desc')
          )
        : query(
            collection(db, 'assets'),
            where('folderId', '==', null),
            orderBy('createdAt', 'desc')
          );

      const foldersQuery = currentFolderId
        ? query(
            collection(db, 'assetFolders'),
            where('parentId', '==', currentFolderId),
            orderBy('name')
          )
        : query(
            collection(db, 'assetFolders'),
            where('parentId', '==', null),
            orderBy('name')
          );

      const [assetsSnapshot, foldersSnapshot] = await Promise.all([
        getDocs(assetsQuery),
        getDocs(foldersQuery),
      ]);

      const assetsList: Asset[] = [];
      assetsSnapshot.forEach((doc) => {
        const data = doc.data();
        assetsList.push({
          id: doc.id,
          name: data.name || '',
          type: data.type || 'other',
          source: data.source || 'upload',
          url: data.url || '',
          thumbnailUrl: data.thumbnailUrl,
          driveFileId: data.driveFileId,
          driveWebViewLink: data.driveWebViewLink,
          folderId: data.folderId,
          projectId: data.projectId,
          tags: data.tags || [],
          metadata: data.metadata || { size: 0, mimeType: '' },
          createdBy: data.createdBy || '',
          createdByName: data.createdByName || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        });
      });

      const foldersList: AssetFolder[] = [];
      foldersSnapshot.forEach((doc) => {
        const data = doc.data();
        foldersList.push({
          id: doc.id,
          name: data.name || '',
          parentId: data.parentId,
          color: data.color,
          driveFolderId: data.driveFolderId,
          createdBy: data.createdBy || '',
          createdAt: data.createdAt?.toDate?.() || new Date(),
        });
      });

      setAssets(assetsList);
      setFolders(foldersList);
    } catch (err) {
      console.error('[AssetManagement] Error fetching data:', err);
      setError('Assetler yuklenirken bir hata olustu');
    } finally {
      setLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const uploadFile = useCallback(
    async (file: File, folderId?: string): Promise<Asset | null> => {
      if (!db || !storage || !user) {
        setError('Baglanti hatasi');
        return null;
      }

      setUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        // Generate unique file path
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `assets/${user.uid}/${timestamp}_${safeName}`;
        const storageRef = ref(storage, filePath);

        // Upload file
        setUploadProgress(30);
        await uploadBytes(storageRef, file);
        setUploadProgress(70);

        // Get download URL
        const downloadUrl = await getDownloadURL(storageRef);
        setUploadProgress(90);

        // Create asset document
        const assetRef = doc(collection(db, 'assets'));
        const assetData = {
          name: file.name,
          type: getAssetTypeFromMimeType(file.type),
          source: 'upload' as const,
          url: downloadUrl,
          folderId: folderId || currentFolderId || null,
          tags: [],
          metadata: {
            size: file.size,
            mimeType: file.type,
          },
          createdBy: user.uid,
          createdByName: user.displayName || user.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(assetRef, assetData);
        setUploadProgress(100);

        const newAsset: Asset = {
          id: assetRef.id,
          ...assetData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Add to local state
        setAssets((prev) => [newAsset, ...prev]);

        return newAsset;
      } catch (err: any) {
        console.error('[AssetManagement] Upload error:', err);
        setError(err.message || 'Dosya yuklenirken hata olustu');
        return null;
      } finally {
        setUploading(false);
        setTimeout(() => setUploadProgress(0), 1000);
      }
    },
    [db, storage, user, currentFolderId]
  );

  const uploadFromUrl = useCallback(
    async (
      url: string,
      name: string,
      mimeType: string,
      driveFileId?: string
    ): Promise<Asset | null> => {
      if (!db || !user) {
        setError('Baglanti hatasi');
        return null;
      }

      try {
        // Create asset document (reference to external URL)
        const assetRef = doc(collection(db, 'assets'));
        const assetData = {
          name,
          type: getAssetTypeFromMimeType(mimeType),
          source: 'google_drive' as const,
          url,
          driveFileId,
          driveWebViewLink: driveFileId
            ? `https://drive.google.com/file/d/${driveFileId}/view`
            : undefined,
          folderId: currentFolderId || null,
          tags: [],
          metadata: {
            size: 0,
            mimeType,
          },
          createdBy: user.uid,
          createdByName: user.displayName || user.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(assetRef, assetData);

        const newAsset: Asset = {
          id: assetRef.id,
          ...assetData,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        setAssets((prev) => [newAsset, ...prev]);
        return newAsset;
      } catch (err: any) {
        console.error('[AssetManagement] Import error:', err);
        setError(err.message || 'Dosya import edilirken hata olustu');
        return null;
      }
    },
    [db, user, currentFolderId]
  );

  const createFolder = useCallback(
    async (name: string, parentId?: string): Promise<AssetFolder | null> => {
      if (!db || !user) {
        setError('Baglanti hatasi');
        return null;
      }

      try {
        const folderRef = doc(collection(db, 'assetFolders'));
        const folderData = {
          name,
          parentId: parentId || currentFolderId || null,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        };

        await setDoc(folderRef, folderData);

        const newFolder: AssetFolder = {
          id: folderRef.id,
          ...folderData,
          createdAt: new Date(),
        };

        setFolders((prev) => [...prev, newFolder].sort((a, b) => a.name.localeCompare(b.name)));
        return newFolder;
      } catch (err: any) {
        console.error('[AssetManagement] Create folder error:', err);
        setError(err.message || 'Klasor olusturulurken hata olustu');
        return null;
      }
    },
    [db, user, currentFolderId]
  );

  const deleteAsset = useCallback(
    async (assetId: string) => {
      if (!db) {
        setError('Baglanti hatasi');
        return;
      }

      try {
        const asset = assets.find((a) => a.id === assetId);

        // Delete from storage if it's an uploaded file
        if (asset?.source === 'upload' && asset.url && storage) {
          try {
            const storageRef = ref(storage, asset.url);
            await deleteObject(storageRef);
          } catch {
            // Ignore storage delete errors (file might not exist)
          }
        }

        // Delete document
        await deleteDoc(doc(db, 'assets', assetId));

        // Update local state
        setAssets((prev) => prev.filter((a) => a.id !== assetId));
      } catch (err: any) {
        console.error('[AssetManagement] Delete error:', err);
        setError(err.message || 'Dosya silinirken hata olustu');
      }
    },
    [db, storage, assets]
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      if (!db) {
        setError('Baglanti hatasi');
        return;
      }

      try {
        // Check if folder has contents
        const assetsInFolder = assets.filter((a) => a.folderId === folderId);
        const subfoldersInFolder = folders.filter((f) => f.parentId === folderId);

        if (assetsInFolder.length > 0 || subfoldersInFolder.length > 0) {
          setError('Klasor bos degil. Once icerigini silin.');
          return;
        }

        await deleteDoc(doc(db, 'assetFolders', folderId));
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
      } catch (err: any) {
        console.error('[AssetManagement] Delete folder error:', err);
        setError(err.message || 'Klasor silinirken hata olustu');
      }
    },
    [db, assets, folders]
  );

  const updateAssetTags = useCallback(
    async (assetId: string, tags: string[]) => {
      if (!db) {
        setError('Baglanti hatasi');
        return;
      }

      try {
        await updateDoc(doc(db, 'assets', assetId), {
          tags,
          updatedAt: serverTimestamp(),
        });

        setAssets((prev) =>
          prev.map((a) => (a.id === assetId ? { ...a, tags } : a))
        );
      } catch (err: any) {
        console.error('[AssetManagement] Update tags error:', err);
        setError(err.message || 'Etiketler guncellenirken hata olustu');
      }
    },
    [db]
  );

  return {
    assets,
    folders,
    currentFolderId,
    loading,
    uploading,
    uploadProgress,
    error,
    setCurrentFolderId,
    uploadFile,
    uploadFromUrl,
    createFolder,
    deleteAsset,
    deleteFolder,
    updateAssetTags,
    refetch: fetchData,
  };
}
