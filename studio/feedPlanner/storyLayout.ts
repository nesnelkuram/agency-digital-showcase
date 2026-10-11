import type { Aesthetics, SlotText } from './types';

/**
 * Story kuralları (Dieci_Paylasim_Stilleri.md, 21 Eylül 2026 güncel kurallar):
 * 1080×1920, tam sayfa fotoğraf, siyah zemin/bant/metin paneli yok; aynı ürünün 2–3 karesinde başlık
 * yalnız ilk karede, devam karelerinde küçük açıklama veya metinsiz fotoğraf.
 */
export type StoryRole = 'headline' | 'body' | 'none';

export const STORY_SIZE = { w: 1080, h: 1920 } as const;
export const MAX_SERIES_FRAMES = 3;

export interface SeriesFrame {
  role: StoryRole;
  /** Gerçek seri kimliği (insan doğrulamalı ürün veya plandaki açık seri adı); tek kareli seride null */
  key: string | null;
  position: number;
  size: number;
}

/**
 * Seri kareleri. Seri YALNIZ açık bir seri kimliğinden kurulur (ardışık aynı kimlik, en çok 3 kare); kimliksiz kare
 * tek karelik seridir ve başlık alır. Aynı gün/tarih olmak seri DEĞİLDİR. 3 kareden uzun koşu 3+kalan olarak bölünür;
 * tek kalan kare tek karelik seridir. Roller: 1. kare başlık, 2. küçük açıklama, 3. metinsiz.
 */
export function seriesFrames(keys: (string | null | undefined)[]): SeriesFrame[] {
  const out: SeriesFrame[] = [];
  let i = 0;
  while (i < keys.length) {
    const k = keys[i] || null;
    let run = 1;
    if (k) while (i + run < keys.length && keys[i + run] === k) run++;
    let left = run;
    while (left > 0) {
      const size = k ? Math.min(MAX_SERIES_FRAMES, left) : 1;
      if (size < 2) out.push({ role: 'headline', key: null, position: 0, size: 1 });
      else for (let p = 0; p < size; p++) out.push({ role: p === 0 ? 'headline' : p === 1 ? 'body' : 'none', key: k, position: p, size });
      left -= size;
    }
    i += run;
  }
  return out;
}

export const seriesRoles = (keys: (string | null | undefined)[]): StoryRole[] => seriesFrames(keys).map((f) => f.role);

/** Hiyerarşi ihlalleri: başlık yalnız ilk karede; devam karesinde büyük slogan/kapanış başlığı yok. */
export function validateHierarchy(texts: (SlotText | null)[], roles: StoryRole[]): string[] {
  const problems: string[] = [];
  texts.forEach((t, i) => {
    if (!t) return;
    const role = roles[i];
    if (role !== 'headline' && t.headline) problems.push(`Kare ${i + 1}: başlık yalnız serinin ilk karesinde olur`);
    if (role === 'none' && (t.body || t.caption)) problems.push(`Kare ${i + 1}: bu kare metinsiz olmalı`);
    if (role === 'headline' && !t.headline && (t.body || t.caption)) problems.push(`Kare ${i + 1}: ilk karede başlık beklenir`);
  });
  return problems;
}

export interface Placement {
  zone: 'üst' | 'orta' | 'alt';
  /** Ölçülen sakin (düz) alan var mı; yoksa metin üstte, hafif gölgeyle ve uyarıyla gösterilir */
  calm: boolean;
  ink: 'cream' | 'burgundy';
  shadow: boolean;
}

const ZONE_INDEX = { üst: 0, orta: 1, alt: 2 } as const;

/** Metni fotoğrafın ölçülmüş sakin bölgesine yerleştirir. Bant veya panel üretmez. */
export function placeText(a?: Aesthetics): Placement {
  const calmZone = a?.measured && a.negativeSpace >= 0.1 && a.negativeZone !== 'dağınık' ? a.negativeZone : null;
  const zone = calmZone ?? 'üst';
  const b = a?.zoneBrightness?.[ZONE_INDEX[zone]];
  const ink = b !== undefined && b >= 0.5 ? 'burgundy' : 'cream';
  return { zone, calm: !!calmZone, ink, shadow: !calmZone };
}

/** Yerel şablon yazı tipi: Canva kaynak fontu DEĞİLDİR (kılavuzda doğrulanmamış). */
export const LOCAL_FONT_NOTE =
  'Yerel şablon yazı tipi (genel serif). Canva kaynak font ailesi ve puntosu kılavuzda doğrulanmadı; birebir kaynak font olarak sunulmaz.';
