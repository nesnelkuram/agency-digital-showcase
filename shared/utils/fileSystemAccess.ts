import { ref, getBytes } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import type { FilingTemplate, FilingTemplateFolder } from '@/shared/types/filing';

const DB_NAME = 'filing-system-db';
const STORE_NAME = 'directory-handles';
const HANDLE_KEY = 'root-directory';

// ============================================
// TARAYICI DESTEGI KONTROLU
// ============================================

export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in window;
}

// ============================================
// ROOT KLASOR SECIMI
// ============================================

export async function selectRootDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API bu tarayicida desteklenmiyor. Chrome veya Edge kullanin.');
  }

  const handle = await window.showDirectoryPicker({
    mode: 'readwrite',
  });

  return handle;
}

// ============================================
// INDEXEDDB ILE HANDLE PERSIST
// ============================================

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function persistDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(handle, HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPersistedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(HANDLE_KEY);
      request.onsuccess = () => {
        const handle = request.result as FileSystemDirectoryHandle | undefined;
        resolve(handle || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function verifyPermission(
  handle: FileSystemDirectoryHandle
): Promise<boolean> {
  const options = { mode: 'readwrite' as const };

  if ((await (handle as any).queryPermission(options)) === 'granted') {
    return true;
  }

  if ((await (handle as any).requestPermission(options)) === 'granted') {
    return true;
  }

  return false;
}

// ============================================
// PROJE KLASOR YAPISI OLUSTURMA
// ============================================

export async function createProjectFolders(
  rootHandle: FileSystemDirectoryHandle,
  folderName: string,
  template: FilingTemplate
): Promise<FileSystemDirectoryHandle> {
  // Ana proje klasorunu olustur
  const projectDirHandle = await rootHandle.getDirectoryHandle(folderName, {
    create: true,
  });

  // Sablon klasorlerini olustur (hiyerarsik)
  const folderHandles = new Map<string, FileSystemDirectoryHandle>();
  folderHandles.set('root', projectDirHandle);

  // Once ust klasorleri, sonra alt klasorleri olustur
  const sortedFolders = [...template.folders].sort((a, b) => a.order - b.order);

  for (const folder of sortedFolders) {
    const parentHandle = folder.parentId
      ? folderHandles.get(folder.parentId) || projectDirHandle
      : projectDirHandle;

    const dirHandle = await parentHandle.getDirectoryHandle(folder.name, {
      create: true,
    });

    folderHandles.set(folder.id, dirHandle);
  }

  return projectDirHandle;
}

// ============================================
// SABLON DOSYALARINI KOPYALAMA
// ============================================

export async function copyTemplateFiles(
  projectDirHandle: FileSystemDirectoryHandle,
  template: FilingTemplate,
  projectName: string
): Promise<void> {
  if (!storage) throw new Error('Firebase Storage not initialized');

  // Klasor handle'larini yeniden olustur (mevcut yapidan)
  const folderHandles = new Map<string, FileSystemDirectoryHandle>();
  folderHandles.set('root', projectDirHandle);

  const sortedFolders = [...template.folders].sort((a, b) => a.order - b.order);

  for (const folder of sortedFolders) {
    const parentHandle = folder.parentId
      ? folderHandles.get(folder.parentId) || projectDirHandle
      : projectDirHandle;

    try {
      const dirHandle = await parentHandle.getDirectoryHandle(folder.name);
      folderHandles.set(folder.id, dirHandle);
    } catch {
      // Klasor yoksa olustur
      const dirHandle = await parentHandle.getDirectoryHandle(folder.name, {
        create: true,
      });
      folderHandles.set(folder.id, dirHandle);
    }
  }

  // Her sablon dosyasini indir/olustur ve yeniden adlandirarak yaz
  for (const templateFile of template.files) {
    try {
      const targetFolderHandle =
        folderHandles.get(templateFile.folderId) || projectDirHandle;

      // [template] placeholder'ini proje adiyla degistir
      const newFileName = templateFile.name.replace(
        /\[template\]/gi,
        projectName
      );

      const fileHandle = await targetFolderHandle.getFileHandle(newFileName, {
        create: true,
      });
      const writable = await fileHandle.createWritable();

      if (templateFile.isBlank || !templateFile.storageUrl) {
        // Bos dosya olustur (icerik yok)
        await writable.write(new Uint8Array(0));
      } else {
        // Firebase Storage'dan dosya icerigini indir
        const storageRef = ref(storage, templateFile.storageUrl);
        const fileBytes = await getBytes(storageRef);
        await writable.write(fileBytes);
      }

      await writable.close();
    } catch (err) {
      console.error(`Dosya olusturulamadi: ${templateFile.name}`, err);
    }
  }
}

// ============================================
// YARDIMCI FONKSIYONLAR
// ============================================

export function generateFolderName(
  projectNumber: string,
  clientName: string,
  projectName: string,
  date: string,
  editor: string
): string {
  return `${projectNumber}_${clientName}_${projectName}_${date}_${editor}`;
}
