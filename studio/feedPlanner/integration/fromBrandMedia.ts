import type { Candidate, Semantic } from '../types';
import type { MediaItem } from '../../../shared/types/socialMedia';
import { assetToMediaItem, brandMediaFolder, isConsistentAsset, isSafePathId, kindFromMime, LIBRARY_THUMB_FILE } from '../../../shared/types/brandMedia';
import type { BrandMediaAsset, MediaSourcePolicy } from '../../../shared/types/brandMedia';
import type { LiveBrandMediaAsset, LiveCatalog, LiveMediaUsage } from './liveTypes';
import { readinessByType } from './readiness';

export type ExcludeReason =
  | 'archived'
  | 'scope_mismatch'
  | 'unsafe_id'
  | 'inconsistent_storage'
  | 'storage_policy_unverified'
  | 'dimensions_invalid';

export type FromBrandMediaResult =
  | { ok: true; candidate: Candidate; mediaItem: MediaItem; verification: 'verified' | 'unverified' }
  | { ok: false; reason: ExcludeReason; detail: string };

const SHOT_SCALE: Record<LiveCatalog['composition']['shotType'], Semantic['shotScale']> = {
  yakın_çekim: 'yakın',
  orta_plan: 'orta',
  genel_plan: 'geniş',
  mekan: 'geniş',
  // Kamera açısı / odak türü çekim ÖLÇEĞİ değildir: tahmin edilmez.
  üstten: 'bilinmiyor',
  ürün_odaklı: 'bilinmiyor',
  diğer: 'bilinmiyor',
};
const SUBJECT_POS: Record<LiveCatalog['composition']['subjectPlacement'], Semantic['subjectPos']> = {
  merkez: 'merkez', sol: 'sol', sağ: 'sağ', üst: 'üst', alt: 'alt', dağınık: 'bilinmiyor',
};

const groupOf = (c: LiveCatalog | null | undefined): string => {
  const cat = c?.foodCategories?.[0]?.trim().toLocaleLowerCase('tr');
  return cat ? cat.replace(/\s+/g, '_') : 'bilinmiyor';
};

export interface FromBrandMediaOptions {
  catalog?: LiveCatalog | null;
  usage?: LiveMediaUsage;
  /**
   * Güvenilen host/bucket ilkesi (sunucuda getMediaSourcePolicy). Verilirse gerçek shared isConsistentAsset çalışır
   * ve sonuç 'verified' olur. Verilmezse FAIL-CLOSED: 'storage_policy_unverified' (aday döndürülmez).
   */
  policy?: MediaSourcePolicy;
  /**
   * Yalnız açık opt-in: ilke olmadan yol/tenant/proje/tür denetimiyle aday döner ama verification='unverified' ve
   * candidate.storageVerified=false olur; taslak yazma sözleşmesi bunu reddeder. Güvenli sayılmamalıdır.
   */
  allowUnverified?: boolean;
}

const POSITIVE = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/**
 * Gerçek brand_media kaydı → planlayıcı adayı. Kapsam anahtarı brand = projectId (tenant+proje ayrı doğrulanır).
 * Anlamsal alanlar yalnız katalogdan; yoksa 'bilinmiyor'. Piksel estetiği tarayıcıda yetkili okumayla ölçülür.
 */
export function candidateFromBrandMedia(
  asset: LiveBrandMediaAsset,
  scope: { tenantId: string; projectId: string },
  opts: FromBrandMediaOptions = {},
): FromBrandMediaResult {
  if (asset.status !== 'active') return { ok: false, reason: 'archived', detail: 'Arşivlenmiş medya planlayıcıya girmez.' };
  if (asset.tenantId !== scope.tenantId || asset.projectId !== scope.projectId)
    return { ok: false, reason: 'scope_mismatch', detail: 'Başka tenant/proje medyası.' };
  if (!isSafePathId(asset.id) || !isSafePathId(scope.tenantId) || !isSafePathId(scope.projectId))
    return { ok: false, reason: 'unsafe_id', detail: 'Kimlik güvenli desende değil.' };
  const s = asset.storage;
  const folder = `${brandMediaFolder(scope.tenantId, scope.projectId, asset.id)}/`;
  const rest = s && typeof s.path === 'string' && s.path.startsWith(folder) ? s.path.slice(folder.length) : null;
  const pathOk =
    rest !== null && rest.length > 0 && !rest.includes('/') && rest !== '.' && rest !== '..' && !s.path.includes('..') &&
    rest !== LIBRARY_THUMB_FILE && kindFromMime(s.contentType || '') === asset.kind;
  if (!pathOk) return { ok: false, reason: 'inconsistent_storage', detail: 'Depolama yolu boş dosya adı/klasör yolu/önizleme dosyası olamaz ve katalog türüyle tutarlı olmalı.' };
  if (!POSITIVE(s.width) || !POSITIVE(s.height)) return { ok: false, reason: 'dimensions_invalid', detail: 'Kaynak boyutu sonlu ve > 0 olmalı: kırpma/format denetimi yapılamaz.' };

  let verification: 'verified' | 'unverified';
  if (opts.policy) {
    if (!isConsistentAsset(asset as unknown as BrandMediaAsset, scope.tenantId, scope.projectId, opts.policy))
      return { ok: false, reason: 'inconsistent_storage', detail: 'Güvenilen host/bucket denetimi geçmedi.' };
    verification = 'verified';
  } else if (opts.allowUnverified) {
    verification = 'unverified';
  } else {
    return { ok: false, reason: 'storage_policy_unverified', detail: 'Güvenilen host/bucket ilkesi verilmedi: fail-closed. Doğrulanmamış kullanım için allowUnverified açıkça verilmeli.' };
  }

  const mediaItem = assetToMediaItem(asset as unknown as BrandMediaAsset, 0);
  const cat = opts.catalog ?? null;
  const semantic: Semantic = cat
    ? {
        shotScale: SHOT_SCALE[cat.composition.shotType] ?? 'bilinmiyor',
        subjectPos: SUBJECT_POS[cat.composition.subjectPlacement] ?? 'bilinmiyor',
        source: 'katalog',
      }
    : { shotScale: 'bilinmiyor', subjectPos: 'bilinmiyor', source: 'bilinmiyor' };

  const candidate: Candidate = {
    id: asset.id,
    imageKey: s.path,
    brand: scope.projectId,
    kind: asset.kind === 'photo' ? 'photo' : 'video_cover',
    origin: 'studio',
    provenance: `Studio kütüphanesi · brand_media/${asset.id}${cat ? ' · katalog var' : ' · katalog yok'}${verification === 'verified' ? '' : ' · depolama ilkesi DOĞRULANMADI'}`,
    published: false,
    dims: { w: s.width as number, h: s.height as number },
    dimsSource: 'kaynak',
    group: groupOf(cat),
    note: cat?.subject ?? '',
    aiMark: 'belirsiz',
    humanPresence: cat ? (cat.peoplePresent ? 'evet' : 'hayır') : 'bilinmiyor',
    semantic,
    storageVerified: verification === 'verified',
    readiness: readinessByType(mediaItem),
    ...(opts.usage ? { usage: opts.usage } : {}),
  };
  return { ok: true, candidate, mediaItem, verification };
}

export interface CatalogConversion {
  candidates: Candidate[];
  mediaItems: Map<string, MediaItem>;
  excluded: Array<{ id: string; reason: ExcludeReason }>;
}

export function candidatesFromBrandMedia(
  assets: LiveBrandMediaAsset[],
  scope: { tenantId: string; projectId: string },
  lookup: { catalog?: (id: string) => LiveCatalog | null | undefined; usage?: (id: string) => LiveMediaUsage | undefined; policy?: MediaSourcePolicy; allowUnverified?: boolean } = {},
): CatalogConversion {
  const out: CatalogConversion = { candidates: [], mediaItems: new Map(), excluded: [] };
  for (const a of assets) {
    const r = candidateFromBrandMedia(a, scope, { catalog: lookup.catalog?.(a.id), usage: lookup.usage?.(a.id), policy: lookup.policy, allowUnverified: lookup.allowUnverified });
    if (r.ok) {
      out.candidates.push(r.candidate);
      out.mediaItems.set(a.id, r.mediaItem);
    } else out.excluded.push({ id: a.id, reason: r.reason });
  }
  return out;
}

/** Canlı envanter 200 medya ile sınırlıdır ve sayfalama imleci yoktur (planSuggest.INVENTORY_LIMIT). */
export const LIVE_INVENTORY_LIMIT = 200;
export function catalogCoverageNotice(inv: { eligible: number; truncated: boolean }): string | null {
  return inv.truncated
    ? `Canlı envanter kırpıldı: planlayıcı yalnız en yeni ${LIVE_INVENTORY_LIMIT} medyayı görür; daha eskiler plana girmez (imleç/sayfalama yok).`
    : null;
}
