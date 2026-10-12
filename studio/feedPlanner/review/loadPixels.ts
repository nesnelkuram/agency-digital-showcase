import { measurePixels } from '../aesthetics';
import type { Aesthetics } from '../types';

/** Yalnız yerel allowlist görselini ölçer (64 px genişlik). Hata: null (ölçüm yok). */
export async function measureImage(url: string): Promise<Aesthetics | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('görsel yüklenemedi'));
      el.src = url;
    });
    const scale = Math.min(1, 64 / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    return measurePixels(data, w, h);
  } catch {
    return null;
  }
}

/**
 * NİHAİ KIRPIM görünümünü ölçer: `window` kaynak karenin normalize (0–1) dikdörtgenidir; yalnız bu bölge çizilip ölçülür
 * (orijinalin tüm-kare ölçümü kopyalanmaz). window null = tüm kare (ör. mevcut yayınlar). Hata: null (ölçüm yok).
 */
export async function measureImageCrop(url: string, window: { x: number; y: number; w: number; h: number } | null): Promise<Aesthetics | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('görsel yüklenemedi'));
      el.src = url;
    });
    const win = window ?? { x: 0, y: 0, w: 1, h: 1 };
    const sx = Math.max(0, Math.round(win.x * img.naturalWidth));
    const sy = Math.max(0, Math.round(win.y * img.naturalHeight));
    const sw = Math.max(1, Math.min(img.naturalWidth - sx, Math.round(win.w * img.naturalWidth)));
    const sh = Math.max(1, Math.min(img.naturalHeight - sy, Math.round(win.h * img.naturalHeight)));
    const scale = Math.min(1, 64 / sw);
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    return measurePixels(data, w, h);
  } catch {
    return null;
  }
}
