import type { Candidate, Semantic } from '../types';
import type { InventoryItemDTO } from '../../../api/_lib/plannerInventory/plannerInventory';
import { VISUAL_SCHEMA_VERSION, type CandidateVisual } from '../../../shared/planner/visualDecision';

/**
 * Sunucu envanter kaydı (/api/studio/planner-inventory) → planlayıcı adayı. Sunucu depolama tutarlılığını (güvenilen
 * host/bucket) ZATEN doğrulamıştır; bu yüzden storageVerified=true yalnız bu yoldan gelir. İstemci kendi başına
 * doğrulayamaz. Anlamsal alanlar yalnız katalogdan; yoksa 'bilinmiyor'.
 */
export type InventoryDTO = Pick<InventoryItemDTO, 'id' | 'kind' | 'width' | 'height' | 'path' | 'catalog' | 'verifiedProductIds' | 'usage' | 'readiness'> & { thumbPath?: string | null; visual?: CandidateVisual | null };

const SHOT: Record<string, Semantic['shotScale']> = { yakın_çekim: 'yakın', orta_plan: 'orta', genel_plan: 'geniş', mekan: 'geniş' };
const POS: Record<string, Semantic['subjectPos']> = { merkez: 'merkez', sol: 'sol', sağ: 'sağ', üst: 'üst', alt: 'alt' };

/**
 * Sunucudan gelen kompozisyon kararını KABUL eder mi: proje + varlık kapsamı eşleşmeli ve güncel görsel şemada olmalı.
 * Aksi (başka proje/varlık, eski şema) → null: bilinmiyor sayılır, başka verinin üzerine yazılmaz.
 */
export function acceptVisual(v: CandidateVisual | null | undefined, scope: { projectId: string }, assetId: string): CandidateVisual | null {
  if (!v?.decision || !v.provenance) return null;
  const p = v.provenance;
  if (p.projectId !== scope.projectId || p.assetId !== assetId) return null;
  if (p.visualSchemaVersion !== VISUAL_SCHEMA_VERSION) return null;
  return v;
}

export type FromInventoryResult = { ok: true; candidate: Candidate } | { ok: false; reason: 'dimensions_invalid' };

export function candidateFromInventory(dto: InventoryDTO, scope: { projectId: string }): FromInventoryResult {
  const w = dto.width;
  const h = dto.height;
  if (typeof w !== 'number' || typeof h !== 'number' || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return { ok: false, reason: 'dimensions_invalid' };
  const cat = dto.catalog;
  const visual = acceptVisual(dto.visual, scope, dto.id);
  // Çekim ölçeği: modelin kadraj ölçeği (gözlem) varsa o; yoksa katalog çekim türünden (üstten/ürün_odaklı ölçek değildir → bilinmiyor)
  const vScale = visual && visual.decision.subject.scale !== 'belirsiz' ? visual.decision.subject.scale : null;
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
      provenance: `Studio kütüphanesi · brand_media/${dto.id}${cat ? (cat.source === 'human' ? ' · yalnız insan açıklaması' : ' · katalog var') : ' · katalog yok'}${visual ? ' · kompozisyon kararı var' : ' · kompozisyon kararı yok'}`,
      published: false,
      dims: { w, h },
      dimsSource: 'kaynak',
      group: cat0 ? cat0.replace(/\s+/g, '_') : 'bilinmiyor',
      note: cat?.subject ?? '',
      aiMark: 'belirsiz',
      // Yalnız AÇIK true/false bilinen değerdir; yoksa (ör. yalnız insan açıklaması) bilinmiyor — 'hayır'a çevrilmez
      humanPresence: typeof cat?.peoplePresent === 'boolean' ? (cat.peoplePresent ? 'evet' : 'hayır') : 'bilinmiyor',
      semantic: cat
        ? { shotScale: vScale ?? SHOT[cat.shotType ?? ''] ?? 'bilinmiyor', subjectPos: POS[cat.subjectPlacement ?? ''] ?? 'bilinmiyor', source: 'katalog' }
        : { shotScale: vScale ?? 'bilinmiyor', subjectPos: 'bilinmiyor', source: visual ? 'katalog' : 'bilinmiyor' },
      storageVerified: true,
      readiness: dto.readiness,
      // Son kullanım: sunucunun doğruladığı YAYIN tarihi; yoksa/geçersizse bilinmiyor (null). Planlanmış tarih veya güncel zaman uydurulmaz.
      usage: { ...dto.usage, lastUsedAt: typeof dto.usage.lastUsedAt === 'number' && Number.isFinite(dto.usage.lastUsedAt) && dto.usage.lastUsedAt > 0 ? dto.usage.lastUsedAt : null },
      productId: dto.verifiedProductIds[0] ?? null,
      ...(visual ? { visual } : {}),
      ...(cat?.purposes?.length && cat.purposesSource ? { useTags: { values: cat.purposes, source: cat.purposesSource } } : {}),
    },
  };
}
