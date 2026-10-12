import type { Candidate } from '../types';
import { POST_COLS, rowsOf, type CropEdit, type Post, type PostPlan } from './postPlan';

/**
 * Yayın sırası (kronolojik) ile profil görünümü AYRI şeylerdir:
 *  - plan düzeni = profil sırası: indeks 0 = en yeni (sol üst); yayın sırası bunun TERSİDİR (indeks N-1 ilk, indeks 0 son yayınlanır)
 *  - profil görünümü = plan bloğu + mevcut yayınlar (geçmiş SNAPSHOT; canlı yayın DEĞİL), yeni gönderi her zaman BAŞA gelir
 * Hiçbir işlev canlı yayına/veriye yazmaz.
 */

export interface SnapshotInfo {
  /** Geçmişin geldiği kaynak etiketi (ör. "Instagram arşivi snapshot'ı") */
  source: string;
  /** Bilinen en yeni tarih (ISO gün) ya da null (tarihsiz) */
  newestKnownDate: string | null;
  count: number;
  note: string;
}

const dateMs = (d?: string): number | null => {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : null;
};

/** Mevcut yayınları en yeni önce sıralar; tarihsizler girdi sırasıyla sona. Orijinal diziyi değiştirmez. */
export function sortHistory(history: Candidate[]): Candidate[] {
  const dated = history.map((c, i) => ({ c, i, t: dateMs(c.date) }));
  const known = dated.filter((x) => x.t !== null).sort((a, b) => b.t! - a.t! || a.i - b.i);
  const unknown = dated.filter((x) => x.t === null);
  return [...known, ...unknown].map((x) => x.c);
}

export function snapshotInfo(history: Candidate[], source = 'Yayımlanmış geçmiş snapshot'): SnapshotInfo {
  const ds = history.map((c) => dateMs(c.date)).filter((t): t is number => t !== null);
  const newest = ds.length ? new Date(Math.max(...ds)).toISOString().slice(0, 10) : null;
  return {
    source,
    newestKnownDate: newest,
    count: history.length,
    note: history.length
      ? `${source}: ${history.length} gönderi${newest ? `, bilinen en yeni tarih ${newest}` : ', tarihler bilinmiyor'}. CANLI veri değildir; bu tarihten sonra paylaşılanlar görünmeyebilir.`
      : 'Bu ekranda mevcut yayın geçmişi bağlı değil: profil görünümü yalnız planlanan postları gösterir.',
  };
}

export interface ChronoItem {
  /** 1 = ilk yayınlanacak */
  order: number;
  postId: string;
  assetId: string;
  /** Profil gridindeki (plan bloğundaki) konumu: 0 = sol üst */
  profileIdx: number;
  /** Varlığın SON kırpım düzenlemesi (null = otomatik); önizleme aynı kırpımla çizilir */
  crop: CropEdit | null;
}
/** Kronolojik yayın sırası: ilk yayınlanan = profil sırasının EN SONU */
export function chronology(posts: Post[], crops: Record<string, CropEdit> = {}): ChronoItem[] {
  const n = posts.length;
  return posts.map((p, idx) => ({ order: n - idx, postId: p.id, assetId: p.assetId, profileIdx: idx, crop: crops[p.assetId] ?? null })).sort((a, b) => a.order - b.order);
}

export interface ProfileCell {
  idx: number;
  assetId: string;
  source: 'plan' | 'snapshot';
  postId?: string;
  /** plan postu için yayın sırası (1 = ilk) */
  publishOrder?: number;
  date?: string;
  dateKnown?: boolean;
  /** Plan postu için SON 4:5 kırpım düzenlemesi (null = otomatik). Geçmiş snapshot hücrelerinde yok: olduğu gibi (kırpımı bugünkü kırpıma çevrilmez). */
  crop?: CropEdit | null;
}
/** Planın tamamı yayınlandıktan sonraki profil: plan bloğu (yeni → eski) + mevcut yayınlar (snapshot) */
export function profileView(posts: Post[], history: Candidate[], crops: Record<string, CropEdit> = {}): ProfileCell[] {
  const n = posts.length;
  return [
    ...posts.map((p, idx) => ({ idx, assetId: p.assetId, source: 'plan' as const, postId: p.id, publishOrder: n - idx, crop: crops[p.assetId] ?? null })),
    ...history.map((c, k) => ({ idx: n + k, assetId: c.id, source: 'snapshot' as const, date: c.date, dateKnown: dateMs(c.date) !== null })),
  ];
}
/**
 * İlk `k` post yayınlandıktan sonraki profil: son yayınlanan BAŞA gelir, öncekiler ve mevcut yayınlar kayar.
 * k = 0: yalnız mevcut yayınlar (snapshot).
 */
export function profileAfterStep(posts: Post[], history: Candidate[], k: number, crops: Record<string, CropEdit> = {}): ProfileCell[] {
  const n = posts.length;
  const kk = Math.max(0, Math.min(n, Math.floor(k)));
  const published = chronology(posts, crops).slice(0, kk); // order 1..k
  const newestFirst = [...published].reverse();
  return [
    ...newestFirst.map((c, idx) => ({ idx, assetId: c.assetId, source: 'plan' as const, postId: c.postId, publishOrder: c.order, crop: c.crop })),
    ...history.map((c, i) => ({ idx: kk + i, assetId: c.id, source: 'snapshot' as const, date: c.date, dateKnown: dateMs(c.date) !== null })),
  ];
}

export interface GridShape {
  total: number;
  rows: number;
  /** Son sıradaki dolu hücre sayısı (1..3); tam satırsa 3 */
  lastRowFilled: number;
  partial: boolean;
}
export function gridShape(total: number): GridShape {
  const rows = rowsOf(total);
  const rem = total % POST_COLS;
  return { total, rows, lastRowFilled: total === 0 ? 0 : rem === 0 ? POST_COLS : rem, partial: rem !== 0 };
}
export const planShape = (plan: Pick<PostPlan, 'posts'>) => gridShape(plan.posts.length);
