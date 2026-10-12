/**
 * Uygulama düzeyinde yükleme sağlayıcısı: <AuthProvider> altında, rotaların ÜSTÜNDE yaşar. Studio içi/dışı gezinme,
 * sayfa unmount'u ve marka değişimi kuyruğu etkilemez. Kullanıcı değişir/çıkış yapılırsa kuyruk güvenle iptal edilir.
 */
import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UploadService, type UploadCreatedEvent } from '../library/uploadService';
import type { UploadDeps } from '../library/uploadRunner';
import UploadTray from '../components/UploadTray';

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/** 20 karakterli güvenli kimlik (Storage yolu + katalog doküman kimliği) */
export function newUploadAssetId(): string {
  const bytes = new Uint8Array(20);
  (globalThis.crypto || ({} as Crypto)).getRandomValues?.(bytes);
  let out = '';
  for (let i = 0; i < 20; i++) out += ID_CHARS[(bytes[i] || Math.floor(Math.random() * 256)) % ID_CHARS.length];
  return out;
}

const loadFirebaseDeps = async (): Promise<UploadDeps> => (await import('../library/firebaseUploadDeps')).firebaseUploadDeps();
/** Canva senkronu ve AI kataloglama ayrı, kalıcı işler: biri başarısızsa diğeri ve yükleme etkilenmez */
const defaultAfterCreate = async (e: UploadCreatedEvent) => {
  const { notifyUploadComplete } = await import('../mediaIntegrationsApi');
  await notifyUploadComplete(e.projectId, e.assetId);
};

const Ctx = createContext<UploadService | null>(null);

export const StudioUploadProvider: React.FC<{
  children: React.ReactNode;
  deps?: UploadDeps;
  newId?: () => string;
  afterCreate?: (e: UploadCreatedEvent) => void | Promise<void>;
}> = ({ children, deps, newId, afterCreate }) => {
  const { user } = useAuth();
  const [service] = useState(
    () => new UploadService(() => (deps ? Promise.resolve(deps) : loadFirebaseDeps()), newId || newUploadAssetId, afterCreate ?? (deps ? undefined : defaultAfterCreate))
  );
  const uid = user?.uid ?? null;
  // Oturum değişimi (çıkış / başka kullanıcı) kuyruğu iptal eder; marka/tenant/sayfa değişimi etkilemez
  useEffect(() => {
    service.bindSession(uid);
  }, [service, uid]);

  const snap = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const active = snap.summary.active;
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);

  return (
    <Ctx.Provider value={service}>
      {children}
      <UploadTray service={service} />
    </Ctx.Provider>
  );
};

/** Sağlayıcı yoksa (yalıtılmış testler) null */
export const useUploadServiceOptional = (): UploadService | null => useContext(Ctx);
