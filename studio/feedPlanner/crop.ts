import type { Dims, FormatId } from './types';
import { FORMATS } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const ratioOf = (f: FormatId): number => FORMATS[f].w / FORMATS[f].h;

/** Kaynağın hedef orana kırpıldığında görünen kesri (0..1). 0.5 altı = format uymaz. */
export function coverage(dims: Dims, target: number): number {
  const sr = dims.w / dims.h;
  return sr > target ? target / sr : sr / target;
}

export interface Focus {
  /** 0..1, kaynağın yatay konumu */
  x: number;
  /** 0..1, kaynağın dikey konumu */
  y: number;
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: number;
}

/** Kaynak piksellerinde kırpma dikdörtgeni. Odak etrafında merkezlenir, sınırlara sabitlenir. */
export function cropRect(dims: Dims, target: number, focus: Focus, zoom = 1): CropRect {
  const z = Math.max(1, zoom);
  const sr = dims.w / dims.h;
  let bw: number;
  let bh: number;
  if (sr > target) {
    bh = dims.h;
    bw = dims.h * target;
  } else {
    bw = dims.w;
    bh = dims.w / target;
  }
  const w = Math.round(bw / z);
  const h = Math.round(bh / z);
  const cx = clamp(focus.x, 0, 1) * dims.w;
  const cy = clamp(focus.y, 0, 1) * dims.h;
  const x = clamp(Math.round(cx - w / 2), 0, dims.w - w);
  const y = clamp(Math.round(cy - h / 2), 0, dims.h - h);
  return { x, y, w, h, zoom: z };
}
