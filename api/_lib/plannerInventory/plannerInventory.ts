/**
 * Planlayıcı envanteri — SAYFALI katalog. 200 sınırı sessiz kırpma değildir: her sayfa bir imleç (nextCursor) döner ve
 * istemci tükenene kadar sayfa ister. Her sayfa yalnız bu tenant+proje, aktif ve depolama tutarlı medyayı döner;
 * elenenler nedenle raporlanır. İndirme URL'si (token) DÖNMEZ: görüntü yetkili Storage okumasıyla alınır.
 */
import { isConsistentAsset, type BrandMediaAsset, type MediaSourcePolicy } from '../../../shared/types/brandMedia.js';
import type { CatalogLite } from '../../../shared/planner/copyContract.js';
import { loadEffectiveCatalog } from '../mediaAnalysis/correctionStore.js';
import { readinessFor, PLAN_POST_TYPES, APPROVED_POST_STATES, PENDING_POST_STATES, type Readiness } from '../planSuggest/planSuggest.js';
import { assetToMediaItem } from '../../../shared/types/brandMedia.js';

type Db = any;

export const PAGE_DEFAULT = 100;
export const PAGE_MAX = 100;

export class InventoryError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export interface InventoryItemDTO {
  id: string;
  kind: 'photo' | 'video';
  title: string;
  fileName: string;
  width: number | null;
  height: number | null;
  contentType: string;
  size: number;
  /** Yetkili Storage okuması için yol (herkese açık URL/token YOK) */
  path: string;
  /** Önizleme (küçük) Storage yolu; yoksa null */
  thumbPath: string | null;
  createdAtMs: number | null;
  catalog: CatalogLite | null;
  /** İnsan doğrulamalı ürün kimlikleri (gerçek ürün/seri kimliği kaynağı) */
  verifiedProductIds: string[];
  usage: { usedInPostCount: number; approvedUseCount: number; pendingUseCount: number };
  readiness: Record<'static' | 'carousel' | 'story' | 'reels', Readiness>;
}

export interface InventoryPage {
  items: InventoryItemDTO[];
  nextCursor: string | null;
  excluded: Array<{ id: string; reason: 'inconsistent_asset' | 'not_ready' }>;
  pageSize: number;
}

const msOf = (v: any): number | null => (v == null ? null : typeof v === 'number' ? v : typeof v.toMillis === 'function' ? v.toMillis() : null);
const SAFE = /^[A-Za-z0-9_-]{1,128}$/;

/** İmleç TAM zaman damgasını (saniye + nanosaniye) ve belge kimliğini taşır: milisaniyeye yuvarlama yok. */
export interface CursorPos { sec: number; nanos: number; id: string }
export const encodeCursor = (sec: number, nanos: number, id: string) => Buffer.from(JSON.stringify({ s: sec, n: nanos, i: id })).toString('base64url');
export function decodeCursor(raw: string): CursorPos {
  try {
    const o = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (Number.isSafeInteger(o?.s) && o.s >= 0 && o.s < 253_402_300_800 && Number.isInteger(o?.n) && o.n >= 0 && o.n <= 999_999_999 && typeof o?.i === 'string' && SAFE.test(o.i)) {
      return { sec: o.s, nanos: o.n, id: o.i };
    }
  } catch {
    // aşağıda hata
  }
  throw new InventoryError(400, 'bad_cursor', 'Sayfa imleci geçersiz.');
}
/** Firestore Timestamp (seconds/nanoseconds) veya sayı (ms; yalnız sahte depo) → tam konum */
function exactTime(v: any): { sec: number; nanos: number } | null {
  if (v == null) return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v < 0) return null;
    const sec = Math.floor(v / 1000);
    return { sec, nanos: Math.round((v - sec * 1000) * 1e6) };
  }
  const sec = v.seconds ?? v._seconds;
  const nanos = v.nanoseconds ?? v._nanoseconds;
  return Number.isSafeInteger(sec) && Number.isInteger(nanos) ? { sec, nanos } : null;
}

const toLite = (c: any): CatalogLite => ({
  subject: String(c.subject ?? ''),
  description: String(c.description ?? ''),
  tags: Array.isArray(c.tags) ? c.tags : [],
  foodCategories: Array.isArray(c.foodCategories) ? c.foodCategories : [],
  visibleObjects: Array.isArray(c.visibleObjects) ? c.visibleObjects : [],
  uncertainties: Array.isArray(c.uncertainties) ? c.uncertainties : [],
  shotType: c.composition?.shotType,
  subjectPlacement: c.composition?.subjectPlacement,
  negativeSpace: !!c.composition?.negativeSpace,
  peoplePresent: !!c.peoplePresent,
});

export async function listInventoryPage(
  db: Db,
  p: { tenantId: string; projectId: string; policy: MediaSourcePolicy; cursor?: string | null; limit?: unknown; /** Timestamp üretici (üretimde Timestamp(sec, nanos)); sahte depoda ms sayısı */ makeCursorValue?: (sec: number, nanos: number) => unknown }
): Promise<InventoryPage> {
  let limit = PAGE_DEFAULT;
  if (p.limit !== undefined) {
    const n = Number(p.limit);
    if (!Number.isInteger(n) || n < 1) throw new InventoryError(400, 'bad_limit', 'limit pozitif tam sayı olmalı.');
    limit = Math.min(n, PAGE_MAX);
  }
  let q = db
    .collection('brand_media')
    .where('tenantId', '==', p.tenantId)
    .where('projectId', '==', p.projectId)
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .orderBy('__name__', 'desc');
  if (p.cursor) {
    const c = decodeCursor(p.cursor);
    q = q.startAfter((p.makeCursorValue ?? ((sec: number, nanos: number) => sec * 1000 + nanos / 1e6))(c.sec, c.nanos), c.id);
  }
  const [mediaSnap, postSnap] = await Promise.all([
    q.limit(limit + 1).get(),
    db.collection('social_media_posts').where('tenantId', '==', p.tenantId).where('projectId', '==', p.projectId).get(),
  ]);
  const used = new Map<string, number>();
  const approved = new Map<string, number>();
  const pending = new Map<string, number>();
  for (const d of postSnap.docs) {
    const post = d.data();
    if (post.tenantId !== p.tenantId || post.projectId !== p.projectId) continue;
    for (const id of new Set<string>(post.libraryAssetIds || [])) {
      used.set(id, (used.get(id) || 0) + 1);
      if (APPROVED_POST_STATES.has(post.status)) approved.set(id, (approved.get(id) || 0) + 1);
      else if (PENDING_POST_STATES.has(post.status)) pending.set(id, (pending.get(id) || 0) + 1);
    }
  }
  const docs = mediaSnap.docs.slice(0, limit);
  const hasMore = mediaSnap.docs.length > limit;
  const items: InventoryItemDTO[] = [];
  const excluded: InventoryPage['excluded'] = [];
  for (let i = 0; i < docs.length; i += 20) {
    const chunk = docs.slice(i, i + 20);
    const effs = await Promise.all(chunk.map((d: any) => loadEffectiveCatalog(db, p.tenantId, p.projectId, d.id)));
    chunk.forEach((d: any, j: number) => {
      const asset = { id: d.id, ...d.data() } as BrandMediaAsset;
      if (asset.tenantId !== p.tenantId || asset.projectId !== p.projectId || !isConsistentAsset(asset, p.tenantId, p.projectId, p.policy)) {
        excluded.push({ id: d.id, reason: 'inconsistent_asset' });
        return;
      }
      const readiness = readinessFor(assetToMediaItem(asset, 0));
      if (PLAN_POST_TYPES.every((t) => readiness[t] === 'error')) {
        excluded.push({ id: d.id, reason: 'not_ready' });
        return;
      }
      const eff = effs[j];
      items.push({
        id: d.id,
        kind: asset.kind,
        title: asset.title,
        fileName: asset.fileName,
        width: asset.storage.width ?? null,
        height: asset.storage.height ?? null,
        contentType: asset.storage.contentType,
        size: asset.storage.size,
        path: asset.storage.path,
        thumbPath: asset.storage.thumbPath ?? null,
        createdAtMs: msOf(asset.createdAt),
        catalog: eff.catalog ? toLite(eff.catalog) : null,
        verifiedProductIds: eff.verifiedProductIds,
        usage: { usedInPostCount: used.get(d.id) || 0, approvedUseCount: approved.get(d.id) || 0, pendingUseCount: pending.get(d.id) || 0 },
        readiness,
      });
    });
  }
  const last = docs[docs.length - 1];
  const lastPos = last ? exactTime(last.data().createdAt) : null;
  if (hasMore && !lastPos) throw new InventoryError(500, 'cursor_unavailable', 'Sayfa imleci üretilemedi (createdAt eksik).');
  return { items, nextCursor: hasMore && last && lastPos ? encodeCursor(lastPos.sec, lastPos.nanos, last.id) : null, excluded, pageSize: limit };
}
