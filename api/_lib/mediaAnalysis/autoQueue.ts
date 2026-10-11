/**
 * Studio yüklemesi → AI kataloglama hazırlığı (kalıcı kuyruk). Canva senkronundan BAĞIMSIZ:
 * Canva kapalı/başarısız olsa da görsel tanınır. Varsayılan KAPALI (MEDIA_AI_ANALYSIS_ENABLED).
 *
 *  - enqueueAnalysis: deterministik iş kimliği (tenant+proje+varlık) → yinelenen bildirim tek iş.
 *  - reconcileNewMedia: bildirimi kaybolan yeni fotoğraflar (sayfa kapandı) için tek global cursor.
 *    Başlangıç AÇIK aktivasyon anıdır (MEDIA_AI_ANALYSIS_SINCE) ve cursor'da saklanır: bayrağın açılması ile
 *    ilk cron arasındaki yüklemeler kaçmaz; bu andan önceki arşiv için backfill YOK. Değer yoksa uzlaştırma çalışmaz.
 *  - processAnalysisQueue: zamanı gelen işleri analyzeBrandMedia ile işler. Aynı kaynak/model/prompt için
 *    tamamlanmış analiz varsa runner ücretli çağrı yapmaz (analysisKey); deneme sınırı runner'da.
 * İnsan düzeltmeleri (media_catalog_reviews) burada hiç okunmaz/yazılmaz.
 */

import { analyzeBrandMedia, type AnalysisDeps, type BrandMediaLike } from './runner.js';
export { parseActivationSince } from '../integrations/config.js';

type Db = any;

export const ANALYSIS_QUEUE = 'media_ai_queue';
export const ANALYSIS_CURSOR_COL = 'media_ai_queue_cursor';
export const ANALYSIS_CURSOR_ID = 'global';
/** Kuyruk işi analiz lease'ini (180 sn) kapsar */
export const QUEUE_LEASE_MS = 200_000;
export const QUEUE_MAX_ATTEMPTS = 3;
/**
 * Cron süre bütçesi (vercel.json maxDuration 300 sn): uzlaştırma ilk 20 sn; yeni analiz işi yalnız ilk 120 sn içinde
 * BAŞLATILIR. En kötü iş = indirme + model zaman aşımı (120 sn) + yazma < ANALYSIS_LEASE_MS (180 sn)
 * → 120 + 180 = 300: başlatılan iş platform sınırından önce biter, lease çağrı sürerken düşmez.
 */
export const CRON_MAX_DURATION_S = 300;
export const RECONCILE_BUDGET_MS = 20_000;
export const WORK_START_DEADLINE_MS = 120_000;
export const QUEUE_RETRY_MS = 5 * 60_000;
export const QUEUE_SETTLE_MS = 2 * 60_000;
const DOC_ID_FIELD = '__name__';

export type QueueState = 'pending' | 'done' | 'skipped' | 'failed';

export interface AnalysisQueueJob {
  id: string;
  tenantId: string;
  projectId: string;
  assetId: string;
  state: QueueState;
  attempts: number;
  nextAttemptAt: number;
  leaseOwner?: string | null;
  leaseUntil?: number | null;
  analysisKey?: string | null;
  lastError?: { code: string; message: string } | null;
  createdAt: number;
  updatedAt: number;
}

export const queueJobId = (tenantId: string, projectId: string, assetId: string) => `${tenantId}_${projectId}_${assetId}`;

function assetLike(id: string, d: any): BrandMediaLike | null {
  if (!d) return null;
  return { id, tenantId: d.tenantId, projectId: d.projectId, kind: d.kind, status: d.status, storage: d.storage || {} };
}

/** Analize uygun aday mı (saf): aktif fotoğraf, kayıt tenant/projeyle eşleşiyor */
export function decideAnalysisEnqueue(p: { featureEnabled: boolean; asset: BrandMediaLike | null; tenantId: string; projectId: string }): { ok: true } | { ok: false; reason: string } {
  if (!p.featureEnabled) return { ok: false, reason: 'feature_disabled' };
  const a = p.asset;
  if (!a || a.tenantId !== p.tenantId || a.projectId !== p.projectId) return { ok: false, reason: 'asset_mismatch' };
  if (a.status !== 'active' || a.kind !== 'photo') return { ok: false, reason: 'not_active_photo' };
  return { ok: true };
}

/** Kalıcı iş açar (yoksa). Var olan iş (her durumda) korunur → yinelenen bildirim yeni iş/çağrı üretmez. */
export async function enqueueAnalysis(
  db: Db,
  p: { tenantId: string; projectId: string; assetId: string; featureEnabled: boolean; now: number }
): Promise<{ queued: true; created: boolean; job: AnalysisQueueJob } | { queued: false; reason: string }> {
  if (!p.featureEnabled) return { queued: false, reason: 'feature_disabled' }; // kapalıyken hiçbir yazma yok
  const snap = await db.collection('brand_media').doc(p.assetId).get();
  const d = decideAnalysisEnqueue({ featureEnabled: true, asset: snap.exists ? assetLike(p.assetId, snap.data()) : null, tenantId: p.tenantId, projectId: p.projectId });
  if (!d.ok) return { queued: false, reason: d.reason };
  const id = queueJobId(p.tenantId, p.projectId, p.assetId);
  const ref = db.collection(ANALYSIS_QUEUE).doc(id);
  return db.runTransaction(async (tx: any) => {
    const s = await tx.get(ref);
    if (s.exists) return { queued: true as const, created: false, job: s.data() as AnalysisQueueJob };
    const job: AnalysisQueueJob = { id, tenantId: p.tenantId, projectId: p.projectId, assetId: p.assetId, state: 'pending', attempts: 0, nextAttemptAt: p.now, createdAt: p.now, updatedAt: p.now };
    tx.set(ref, job);
    return { queued: true as const, created: true, job };
  });
}

/**
 * Kaybolan bildirimler: brand_media createdAt ↑ + kimlik ↑, HAM createdAt değeriyle kalıcı cursor.
 * Başlangıç = açık aktivasyon anı (sinceMs). Cursor farklı bir sinceMs ile kurulmuşsa sıfırlanır.
 * Son QUEUE_SETTLE_MS içindekiler işlenir ama cursor geçmez.
 */
export async function reconcileNewMedia(
  db: Db,
  p: { featureEnabled: boolean; sinceMs: number | null; now: number; clock?: () => number; deadline?: number; pageSize?: number; timeValue?: (ms: number) => any }
) {
  const out = { queued: 0, scanned: 0, initialized: false, budgetExhausted: false, skipped: {} as Record<string, number> };
  if (!p.featureEnabled) return out;
  if (p.sinceMs === null) {
    out.skipped.activation_since_missing = 1;
    return out;
  }
  const clock = p.clock ?? Date.now;
  const tv = p.timeValue ?? ((ms: number) => ms);
  const pageSize = p.pageSize ?? 50;
  const curRef = db.collection(ANALYSIS_CURSOR_COL).doc(ANALYSIS_CURSOR_ID);
  const curSnap = await curRef.get();
  let cur = curSnap.exists ? curSnap.data() : null;
  if (!cur || cur.sinceMs !== p.sinceMs) {
    cur = { sinceMs: p.sinceMs, createdAt: null, assetId: null, updatedAt: p.now };
    await curRef.set(cur);
    out.initialized = true;
  }
  let after: [any, string] | null = cur.createdAt != null && cur.assetId ? [cur.createdAt, cur.assetId] : null;
  for (;;) {
    if (clock() >= (p.deadline ?? Infinity)) {
      out.budgetExhausted = true;
      break;
    }
    let q = db.collection('brand_media').where('createdAt', '>=', tv(cur.sinceMs)).orderBy('createdAt', 'asc').orderBy(DOC_ID_FIELD, 'asc');
    if (after) q = q.startAfter(...after);
    const page = await q.limit(pageSize).get();
    let advanced: [any, string] | null = null;
    let unsettled = false;
    let failed = false;
    for (const a of page.docs) {
      out.scanned++;
      const d = a.data();
      try {
        const r = await enqueueAnalysis(db, { tenantId: d.tenantId, projectId: d.projectId, assetId: a.id, featureEnabled: true, now: p.now });
        if (r.queued) out.queued += r.created ? 1 : 0;
        else out.skipped[r.reason] = (out.skipped[r.reason] || 0) + 1;
      } catch {
        out.skipped.enqueue_error = (out.skipped.enqueue_error || 0) + 1;
        failed = true;
        break;
      }
      const ms = toMs(d.createdAt);
      if (ms === null || ms > p.now - QUEUE_SETTLE_MS) unsettled = true;
      if (!unsettled) advanced = [d.createdAt, a.id];
    }
    if (advanced) {
      await curRef.set({ sinceMs: cur.sinceMs, createdAt: advanced[0], assetId: advanced[1], updatedAt: p.now });
      after = advanced;
    }
    if (failed || unsettled || page.docs.length < pageSize || !advanced) break;
  }
  return out;
}

function toMs(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  return null;
}

export interface QueueWorkerDeps {
  analysisDeps: (asset: BrandMediaLike) => AnalysisDeps;
  owner: string;
  now: () => number;
}

/** Lease al (transaction): bekleyen, zamanı gelmiş, lease'i boş iş */
async function claimJob(db: Db, id: string, owner: string, now: number): Promise<AnalysisQueueJob | null> {
  const ref = db.collection(ANALYSIS_QUEUE).doc(id);
  return db.runTransaction(async (tx: any) => {
    const s = await tx.get(ref);
    if (!s.exists) return null;
    const j = s.data() as AnalysisQueueJob;
    if (j.state !== 'pending' || j.nextAttemptAt > now) return null;
    if (j.leaseOwner && (j.leaseUntil || 0) > now) return null;
    const next = { ...j, attempts: j.attempts + 1, leaseOwner: owner, leaseUntil: now + QUEUE_LEASE_MS, updatedAt: now };
    tx.set(ref, next);
    return next;
  });
}

async function finishJob(db: Db, id: string, owner: string, patch: Partial<AnalysisQueueJob>): Promise<boolean> {
  const ref = db.collection(ANALYSIS_QUEUE).doc(id);
  return db.runTransaction(async (tx: any) => {
    const s = await tx.get(ref);
    if (!s.exists || s.data().leaseOwner !== owner) return false; // fencing
    tx.update(ref, { ...patch, leaseOwner: null, leaseUntil: null });
    return true;
  });
}

/** Tek iş: varlığı yeniden doğrula → analyzeBrandMedia → kuyruk durumunu eşle */
export async function processAnalysisJob(db: Db, id: string, deps: QueueWorkerDeps): Promise<QueueState | 'busy'> {
  const job = await claimJob(db, id, deps.owner, deps.now());
  if (!job) return 'busy';
  const now = deps.now();
  const snap = await db.collection('brand_media').doc(job.assetId).get();
  const asset = snap.exists ? assetLike(job.assetId, snap.data()) : null;
  const d = decideAnalysisEnqueue({ featureEnabled: true, asset, tenantId: job.tenantId, projectId: job.projectId });
  if (!d.ok) {
    await finishJob(db, id, deps.owner, { state: 'skipped', lastError: { code: d.reason, message: 'Varlık analize uygun değil' }, updatedAt: now });
    return 'skipped';
  }
  try {
    const rec = await analyzeBrandMedia(asset!, deps.analysisDeps(asset!));
    const patch: Partial<AnalysisQueueJob> = { analysisKey: rec.key || null, updatedAt: deps.now() };
    if (rec.status === 'done') return (await finishJob(db, id, deps.owner, { ...patch, state: 'done', lastError: null }), 'done');
    if (rec.status === 'unsupported') return (await finishJob(db, id, deps.owner, { ...patch, state: 'skipped', lastError: rec.error || null }), 'skipped');
    // running (başka çalıştırıcı) veya yeniden denenebilir hata → sonra; sınır dolduysa failed
    const retry = (rec.status === 'running' || rec.retryable) && job.attempts < QUEUE_MAX_ATTEMPTS;
    const state: QueueState = retry ? 'pending' : 'failed';
    await finishJob(db, id, deps.owner, { ...patch, state, nextAttemptAt: deps.now() + QUEUE_RETRY_MS * job.attempts, lastError: rec.error || null });
    return state;
  } catch (e: any) {
    // Kaynak okunamadı vb. (model çağrısı başlamadı): sınırlı yeniden deneme
    const state: QueueState = job.attempts < QUEUE_MAX_ATTEMPTS ? 'pending' : 'failed';
    await finishJob(db, id, deps.owner, { state, nextAttemptAt: deps.now() + QUEUE_RETRY_MS * job.attempts, lastError: { code: 'source_error', message: String(e?.message || e).slice(0, 200) }, updatedAt: deps.now() });
    return state;
  }
}

/** Zamanı gelen işler: nextAttemptAt ↑ + kimlik ↑ sayfalı; lease'i canlı/başkasına ait işler atlanır */
export async function processAnalysisQueue(db: Db, deps: QueueWorkerDeps, p: { featureEnabled: boolean; limit?: number; pageSize?: number; deadline?: number }) {
  const out = { considered: 0, processed: 0, budgetExhausted: false, states: {} as Record<string, number> };
  if (!p.featureEnabled) return out;
  const limit = p.limit ?? 10;
  const pageSize = p.pageSize ?? 25;
  const scanAt = deps.now();
  let after: [number, string] | null = null;
  for (;;) {
    let q = db.collection(ANALYSIS_QUEUE).where('state', '==', 'pending').where('nextAttemptAt', '<=', scanAt).orderBy('nextAttemptAt', 'asc').orderBy(DOC_ID_FIELD, 'asc');
    if (after) q = q.startAfter(...after);
    const snap = await q.limit(pageSize).get();
    for (const doc of snap.docs) {
      if (out.processed >= limit) return out;
      if (deps.now() >= (p.deadline ?? Infinity)) {
        out.budgetExhausted = true;
        return out;
      }
      const j = doc.data() as AnalysisQueueJob;
      after = [j.nextAttemptAt, doc.id];
      out.considered++;
      const st = await processAnalysisJob(db, doc.id, deps);
      if (st !== 'busy') out.processed++;
      out.states[st] = (out.states[st] || 0) + 1;
    }
    if (snap.docs.length < pageSize) return out;
  }
}
