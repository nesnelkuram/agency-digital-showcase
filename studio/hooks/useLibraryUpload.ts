/**
 * Kütüphane sayfasının yükleme kancası — kuyruk SAYFADA değil uygulama düzeyindeki UploadService'te yaşar.
 * Sayfa unmount'u / marka değişimi işleri iptal etmez; işler oluşturulurken tenant+proje+marka adı sabit bağlanır.
 * Bu kanca yalnız (a) enqueue'ya aktif marka bağlamını verir, (b) yalnız bu markanın satırlarını gösterir,
 * (c) bu markada kayıt yazılınca sayfayı tazelemek için dinler.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUploadServiceOptional } from '../contexts/StudioUploadContext';
import { UploadService } from '../library/uploadService';
import type { UploadDeps } from '../library/uploadRunner';
import { newUploadAssetId } from '../contexts/StudioUploadContext';

export function useLibraryUpload(params: {
  tenantId: string;
  projectId: string | undefined;
  projectName?: string;
  /** Bu markada katalog kaydı yazıldığında (sayfa açıkken) */
  onAssetCreated?: (assetId: string) => void;
  /** Yalnız sağlayıcısız yalıtılmış kullanım/test için */
  deps?: UploadDeps;
  newId?: () => string;
}) {
  const { tenantId, projectId, projectName, onAssetCreated } = params;
  const { user } = useAuth();
  const provided = useUploadServiceOptional();
  // Sağlayıcı yoksa (test) kanca-yerel servis; üretimde sağlayıcı her zaman vardır
  const [local] = useState(() => (provided || !params.deps ? null : new UploadService(() => Promise.resolve(params.deps!), params.newId || newUploadAssetId)));
  const service = provided || local;
  const onCreatedRef = useRef(onAssetCreated);
  onCreatedRef.current = onAssetCreated;

  const empty = useMemo(() => ({ items: [], queuePaused: false, summary: null as any, dependencyError: null }), []);
  const snap = useSyncExternalStore(
    service ? service.subscribe : (() => () => {}),
    service ? service.getSnapshot : () => empty,
    service ? service.getSnapshot : () => empty
  );

  useEffect(() => {
    if (!local) return;
    local.bindSession(user?.uid ?? null);
  }, [local, user?.uid]);

  useEffect(() => {
    if (!service || !projectId) return;
    return service.onAssetCreated((e) => {
      if (e.tenantId === tenantId && e.projectId === projectId) onCreatedRef.current?.(e.assetId);
    });
  }, [service, tenantId, projectId]);

  const items = useMemo(() => snap.items.filter((i) => i.tenantId === tenantId && i.projectId === projectId), [snap.items, tenantId, projectId]);
  const busy = items.some((i) => i.status === 'queued' || i.status === 'uploading' || i.status === 'paused' || i.status === 'saving');

  const enqueue = useCallback(
    (files: File[], tags: string[]): string[] => {
      if (!service || !projectId) return ['Marka seçili değil.'];
      if (!user) return ['Oturum açık değil.'];
      return service.enqueue(files, {
        tenantId,
        projectId,
        projectName,
        tags,
        actor: { uid: user.uid, displayName: user.displayName || user.email || undefined },
      });
    },
    [service, tenantId, projectId, projectName, user]
  );

  return {
    items,
    busy,
    enqueue,
    pause: (key: string) => service?.pause(key),
    resume: (key: string) => service?.resume(key),
    cancel: (key: string) => service?.cancel(key),
    retry: (key: string) => service?.retry(key),
    dismiss: (key: string) => service?.dismiss(key),
  };
}
