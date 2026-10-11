import React, { useEffect, useState } from 'react';
import { getBlob, ref } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import type { MediaItem } from '@/shared/types/socialMedia';

/**
 * Özel Storage dosyasını yetkili oturumla gösterir (getBlob). Herkese açık ACL veya indirme jetonu kullanmaz;
 * okuma storage.rules ile denetlenir. Blob URL'si bileşen kapanınca serbest bırakılır.
 */
export const AuthStorageImage: React.FC<{ path: string; alt?: string; className?: string }> = ({ path, alt = '', className }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setSrc(null);
    if (!path || !storage) return;
    getBlob(ref(storage, path))
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => { if (alive) setSrc(null); });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  if (!src) return <div className={`${className || ''} bg-neutral-100`} aria-busy="true" />;
  return <img src={src} alt={alt} className={className} />;
};

/** Önizleme yolu: önce previewStoragePath, yoksa storagePath (url boşsa) */
export const mediaStoragePath = (m?: MediaItem): string | undefined =>
  m && !m.url ? (m.previewStoragePath || m.storagePath) : undefined;
