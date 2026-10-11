/**
 * Kütüphane yükleme kuyruğu: tarayıcıdan doğrudan Storage'a (uploadBytesResumable), sırayla.
 * İlerleme, duraklat/devam, iptal, tekrar dene. Marka değişince veya sayfadan çıkınca
 * süren dosya yüklemesi iptal edilir ve katalog kaydı yazılmaz. İSTİSNA: kayıt yazımı başlamışsa
 * (status 'saving') geri alınamaz; kayıt tamamlanır ve sonraki yüklemede listede görünür.
 * Sayfa yenilenirse yarım kalan yükleme baştan başlar.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { brandMediaExists, createBrandMediaRecord, newBrandMediaId } from '../brandMediaData';
import { makeThumbnail, readMediaMetadata } from '../library/mediaProbe';
import { prepareItem, runUploadItem, type UploadDeps, type UploadHandle, type UploadItem } from '../library/uploadRunner';

function firebaseDeps(): UploadDeps {
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

const ACTIVE = new Set(['queued', 'uploading', 'paused', 'saving']);

export function useLibraryUpload(params: {
  tenantId: string;
  projectId: string | undefined;
  /** Katalog kaydı yazıldıktan sonra (Studio yüklemesi tamamlandı) — assetId ile */
  onAssetCreated?: (assetId: string) => void;
  deps?: UploadDeps;
  newId?: () => string;
}) {
  const { tenantId, projectId, onAssetCreated } = params;
  const { user } = useAuth();
  const deps = useMemo(() => params.deps || firebaseDeps(), [params.deps]);
  const newId = params.newId || newBrandMediaId;

  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  const generation = useRef(0);
  const aborted = useRef(new Set<string>());
  const current = useRef<{ key: string; handle: UploadHandle } | null>(null);
  const running = useRef(false);
  const onCreatedRef = useRef(onAssetCreated);
  onCreatedRef.current = onAssetCreated;

  const commit = useCallback((next: UploadItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);
  const patch = useCallback(
    (key: string, p: Partial<UploadItem> | ((i: UploadItem) => UploadItem)) =>
      commit(itemsRef.current.map((i) => (i.key === key ? (typeof p === 'function' ? p(i) : { ...i, ...p }) : i))),
    [commit]
  );

  const pump = useCallback(async () => {
    if (running.current || !user) return;
    running.current = true;
    const gen = generation.current;
    try {
      for (;;) {
        if (gen !== generation.current) break;
        const next = itemsRef.current.find((i) => i.status === 'queued');
        if (!next) break;
        const result = await runUploadItem(next, deps, { uid: user.uid, displayName: user.displayName || user.email || undefined }, {
          update: (it) => {
            if (gen !== generation.current) return;
            // Kullanıcının duraklatması ilerleme olaylarıyla ezilmez
            patch(it.key, (prev) => ({ ...it, status: prev.status === 'paused' && it.status === 'uploading' ? 'paused' : it.status }));
          },
          isAborted: () => gen !== generation.current || aborted.current.has(next.key),
          setHandle: (h) => {
            current.current = h ? { key: next.key, handle: h } : null;
          },
        });
        if (result.status === 'done' && gen === generation.current) onCreatedRef.current?.(result.assetId);
      }
    } finally {
      running.current = false;
      // Bu sırada (marka değişiminden sonra dahil) kuyruğa eklenen olduysa güncel nesille devam et
      if (itemsRef.current.some((i) => i.status === 'queued')) void pump();
    }
  }, [deps, patch, user]);

  /** Marka değişimi / unmount: süren işleri iptal et, kuyruğu temizle (eski seçim yeni markaya sızmaz) */
  const abortAll = useCallback(() => {
    generation.current++;
    current.current?.handle.cancel();
    current.current = null;
    aborted.current.clear();
    commit([]);
  }, [commit]);

  useEffect(() => abortAll, [projectId, tenantId, abortAll]);

  const busy = items.some((i) => ACTIVE.has(i.status));
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const enqueue = useCallback(
    (files: File[], tags: string[]): string[] => {
      if (!projectId) return ['Marka seçili değil.'];
      const errors: string[] = [];
      const added: UploadItem[] = [];
      for (const file of files) {
        const prepared = prepareItem(file, { tenantId, projectId, assetId: newId(), tags });
        if (prepared.ok) added.push(prepared.item);
        else errors.push(prepared.error);
      }
      if (added.length) {
        commit([...itemsRef.current, ...added]);
        void pump();
      }
      return errors;
    },
    [commit, newId, projectId, pump, tenantId]
  );

  const pause = useCallback(
    (key: string) => {
      if (current.current?.key !== key) return;
      current.current.handle.pause();
      patch(key, { status: 'paused' });
    },
    [patch]
  );
  const resume = useCallback(
    (key: string) => {
      if (current.current?.key !== key) return;
      current.current.handle.resume();
      patch(key, { status: 'uploading' });
    },
    [patch]
  );
  const cancel = useCallback(
    (key: string) => {
      const item = itemsRef.current.find((i) => i.key === key);
      // Kayıt yazılırken iptal kabul edilmez: commit geri alınamaz, "iptal edildi" denmez
      if (!item || !ACTIVE.has(item.status) || item.status === 'saving') return;
      aborted.current.add(key);
      if (current.current?.key === key) current.current.handle.cancel();
      if (item.status === 'queued' || item.status === 'paused') patch(key, { status: 'canceled' });
    },
    [patch]
  );
  const retry = useCallback(
    (key: string) => {
      const item = itemsRef.current.find((i) => i.key === key);
      if (!item || item.status !== 'error') return;
      aborted.current.delete(key);
      patch(key, { status: 'queued', error: undefined });
      void pump();
    },
    [patch, pump]
  );
  const dismiss = useCallback(
    (key: string) => {
      const item = itemsRef.current.find((i) => i.key === key);
      if (!item || ACTIVE.has(item.status)) return;
      commit(itemsRef.current.filter((i) => i.key !== key));
    },
    [commit]
  );

  return { items, busy, enqueue, pause, resume, cancel, retry, dismiss };
}
