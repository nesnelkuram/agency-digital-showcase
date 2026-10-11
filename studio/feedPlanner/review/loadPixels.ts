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
