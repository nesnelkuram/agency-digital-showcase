import { createContext, useContext, useEffect, useState } from 'react';
import type { Candidate } from '../types';

/** Aday görselinin adresi: yerel inceleme → sunucu URL'si (eşzamanlı); Studio → yetkili okumayla blob URL'si (eşzamansız). */
export type ImageResolver = (c: Candidate) => string | Promise<string>;
export const ImageSrcContext = createContext<ImageResolver>((c) => `/__review/asset/${c.imageKey}`);

/** Çözümleme sonucu; hata/yükleniyor durumunda null (görsel yer tutucu gösterir). */
export function useImageSrc(c: Candidate): string | null {
  const resolve = useContext(ImageSrcContext);
  const [src, setSrc] = useState<string | null>(() => {
    const r = resolve(c);
    return typeof r === 'string' ? r : null;
  });
  useEffect(() => {
    let alive = true;
    const r = resolve(c);
    if (typeof r === 'string') {
      setSrc(r);
      return;
    }
    setSrc(null);
    r.then((u) => alive && setSrc(u)).catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [c.id, c.imageKey, resolve]);
  return src;
}

export function PlannerImg({ c, className, style, alt = '', loading }: { c: Candidate; className?: string; style?: React.CSSProperties; alt?: string; loading?: 'lazy' | 'eager' }) {
  const src = useImageSrc(c);
  if (!src) return <span className={`imgph ${className ?? ''}`} style={style} aria-busy="true" />;
  return <img src={src} alt={alt} className={className} style={style} loading={loading} draggable={false} />;
}
