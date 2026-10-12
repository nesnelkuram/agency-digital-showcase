/** Gerçek Firebase bağımlılıkları (Storage + katalog kaydı). Ana pakete değil, ilk yüklemede tembel yüklenir. */
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { brandMediaExists, createBrandMediaRecord } from '../brandMediaData';
import { makeThumbnail, readMediaMetadata } from './mediaProbe';
import type { UploadDeps } from './uploadRunner';

export function firebaseUploadDeps(): UploadDeps {
  return {
    startUpload: (path, data, contentType, onProgress) => {
      if (!storage) throw new Error('Storage hazır değil');
      const task = uploadBytesResumable(ref(storage, path), data, { contentType });
      const done = new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => onProgress(snap.totalBytes > 0 ? snap.bytesTransferred / snap.totalBytes : 0),
          reject,
          () => resolve()
        );
      });
      return { done, pause: () => task.pause(), resume: () => task.resume(), cancel: () => task.cancel() };
    },
    getUrl: (path) => {
      if (!storage) return Promise.reject(new Error('Storage hazır değil'));
      return getDownloadURL(ref(storage, path));
    },
    readMetadata: readMediaMetadata,
    makeThumbnail,
    recordExists: brandMediaExists,
    writeRecord: createBrandMediaRecord,
  };
}
