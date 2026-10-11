import type { Candidate, Semantic } from '../types';
import type { InventoryItemDTO } from '../../../api/_lib/plannerInventory/plannerInventory';

/**
 * Sunucu envanter kaydı (/api/studio/planner-inventory) → planlayıcı adayı. Sunucu depolama tutarlılığını (güvenilen
 * host/bucket) ZATEN doğrulamıştır; bu yüzden storageVerified=true yalnız bu yoldan gelir. İstemci kendi başına
 * doğrulayamaz. Anlamsal alanlar yalnız katalogdan; yoksa 'bilinmiyor'.
 */
export type InventoryDTO = Pick<InventoryItemDTO, 'id' | 'kind' | 'width' | 'height' | 'path' | 'catalog' | 'verifiedProductIds' | 'usage' | 'readiness'> & { thumbPath?: string | null };

const SHOT: Record<string, Semantic['shotScale']> = { yakın_çekim: 'yakın', orta_plan: 'orta', genel_plan: 'geniş', mekan: 'geniş' };
const POS: Record<string, Semantic['subjectPos']> = { merkez: 'merkez', sol: 'sol', sağ: 'sağ', üst: 'üst', alt: 'alt' };

export type FromInventoryResult = { ok: true; candidate: Candidate } | { ok: false; reason: 'dimensions_invalid' };

export function candidateFromInventory(dto: InventoryDTO, scope: { projectId: string }): FromInventoryResult {
  const w = dto.width;
  const h = dto.height;
  if (typeof w !== 'number' || typeof h !== 'number' || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return { ok: false, reason: 'dimensions_invalid' };
  const cat = dto.catalog;
  const cat0 = cat?.foodCategories?.[0]?.trim().toLocaleLowerCase('tr');
  return {
    ok: true,
    candidate: {
      id: dto.id,
      // Görüntü kaynağı: önizleme varsa onu kullan (yetkili okuma); yoksa ana dosya
      imageKey: dto.thumbPath || dto.path,
      brand: scope.projectId,
      kind: dto.kind === 'photo' ? 'photo' : 'video_cover',
      origin: 'studio',
      provenance: `Studio kütüphanesi · brand_media/${dto.id}${cat ? ' · katalog var' : ' · katalog yok'}`,
      published: false,
      dims: { w, h },
      dimsSource: 'kaynak',
      group: cat0 ? cat0.replace(/\s+/g, '_') : 'bilinmiyor',
      note: cat?.subject ?? '',
      aiMark: 'belirsiz',
      humanPresence: cat ? (cat.peoplePresent ? 'evet' : 'hayır') : 'bilinmiyor',
      semantic: cat
        ? { shotScale: SHOT[cat.shotType ?? ''] ?? 'bilinmiyor', subjectPos: POS[cat.subjectPlacement ?? ''] ?? 'bilinmiyor', source: 'katalog' }
        : { shotScale: 'bilinmiyor', subjectPos: 'bilinmiyor', source: 'bilinmiyor' },
      storageVerified: true,
      readiness: dto.readiness,
      usage: { ...dto.usage, lastUsedAt: null },
      productId: dto.verifiedProductIds[0] ?? null,
    },
  };
}
