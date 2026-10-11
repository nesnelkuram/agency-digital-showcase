/**
 * Studio → Canva OTOMATİK senkron (yalnız yeni fotoğraflar). Studio yüklemesi bu işe bağlı DEĞİL.
 *
 * Akış:
 *  1) Hızlı yol: Studio dosya + katalog kaydını yazınca istemci "upload_complete" bildirir →
 *     enqueueForAsset kalıcı iş açar (deterministik kimlik: tekrar bildirim tek iş) ve hemen ilerletmeyi dener.
 *  2) Kalıcı yol (cron/worker): reconcileRecentAssets istemci bildirimi kaybolduysa (sayfa kapandı vb.) kalıcı cursor ile
 *     son yüklenen fotoğraflar için eksik işleri açar; processDueJobs zamanı gelen işleri mevcut motorla
 *     (lease, içerik rezervasyonu, needs_review, yalnız-taşıma tekrarı, sınırlı deneme) ilerletir.
 * Koşullar (hepsi): özellik açık · bağlantı "connected" · eşleme toCanva=true ve GÜNCEL connectionId ·
 * tenant/proje eşleşmesi · aktif JPEG/PNG fotoğraf < 50 MB · eşleme açıldıktan SONRA yüklenmiş (backfill yok).
 * Koşul sağlanmazsa dış çağrı yapılmaz.
 */

import { CANVA_IMAGE_MAX_BYTES, CANVA_SYNC_MIME } from './client.js';
import { COL, firestoreSyncStore, loadConnection, mappingDocId, type CanvaConnection, type CanvaFolderMapping } from './firestoreStores.js';
import { newSyncJob, runSyncJob, syncJobId, type CanvaOps, type SourceFile, type SyncJob } from './syncEngine.js';

type Db = any;

export interface AutoSyncAsset {
  id: string;
  tenantId: string;
  projectId: string;
  kind: string;
  status: string;
  fileName?: string;
  createdAtMs: number | null;
  storage: { path: string; contentType: string; size: number };
}

export type AutoDecision = { ok: true } | { ok: false; reason: string };

export function toMs(v: any): number | null {
  if (!v) return null;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  return null;
}

/** Saf karar: bu varlık için otomatik Canva işi açılabilir mi */
export function decideAutoEnqueue(p: {
  featureEnabled: boolean;
  conn: Pick<CanvaConnection, 'status' | 'connectionId' | 'tenantId'> | null;
  mapping: (Pick<CanvaFolderMapping, 'tenantId' | 'projectId' | 'connectionId' | 'toCanva'> & { toCanvaSince?: number | null }) | null;
  asset: AutoSyncAsset | null;
  tenantId: string;
  projectId: string;
}): AutoDecision {
  const { conn, mapping, asset } = p;
  if (!p.featureEnabled) return { ok: false, reason: 'feature_disabled' };
  if (!conn || conn.status !== 'connected' || conn.tenantId !== p.tenantId) return { ok: false, reason: 'not_connected' };
  if (!mapping || !mapping.toCanva) return { ok: false, reason: 'no_mapping' };
  if (mapping.tenantId !== p.tenantId || mapping.projectId !== p.projectId) return { ok: false, reason: 'mapping_mismatch' };
  if (mapping.connectionId !== conn.connectionId) return { ok: false, reason: 'mapping_stale_connection' };
  if (!asset || asset.tenantId !== p.tenantId || asset.projectId !== p.projectId) return { ok: false, reason: 'asset_mismatch' };
  if (asset.status !== 'active' || asset.kind !== 'photo') return { ok: false, reason: 'not_active_photo' };
  if (!CANVA_SYNC_MIME.has(asset.storage?.contentType) || !(asset.storage?.size > 0 && asset.storage.size < CANVA_IMAGE_MAX_BYTES)) {
    return { ok: false, reason: 'unsupported_media' };
  }
  const since = mapping.toCanvaSince ?? null;
  if (!since || asset.createdAtMs === null || asset.createdAtMs < since) return { ok: false, reason: 'before_mapping_no_backfill' };
  return { ok: true };
}

export function assetFromDoc(id: string, d: any): AutoSyncAsset {
  return { id, tenantId: d?.tenantId, projectId: d?.projectId, kind: d?.kind, status: d?.status, fileName: d?.fileName, createdAtMs: toMs(d?.createdAt), storage: d?.storage || {} };
}

export async function loadMapping(db: Db, tenantId: string, projectId: string): Promise<(CanvaFolderMapping & { toCanvaSince?: number | null }) | null> {
  const s = await db.collection(COL.mappings).doc(mappingDocId(tenantId, projectId)).get();
  return s.exists ? s.data() : null;
}

/** Kalıcı iş açar (yoksa). Koşul sağlanmazsa iş açılmaz ve dış çağrı yapılmaz. */
export async function enqueueForAsset(
  db: Db,
  p: { tenantId: string; projectId: string; assetId: string; featureEnabled: boolean; now: number }
): Promise<{ queued: true; job: SyncJob } | { queued: false; reason: string }> {
  const [conn, mapping, assetSnap] = await Promise.all([
    loadConnection(db, p.tenantId),
    loadMapping(db, p.tenantId, p.projectId),
    db.collection('brand_media').doc(p.assetId).get(),
  ]);
  const asset = assetSnap.exists ? assetFromDoc(p.assetId, assetSnap.data()) : null;
  const d = decideAutoEnqueue({ featureEnabled: p.featureEnabled, conn, mapping, asset, tenantId: p.tenantId, projectId: p.projectId });
  if (!d.ok) return { queued: false, reason: d.reason };
  const job = await firestoreSyncStore(db).createIfAbsent(
    newSyncJob({ tenantId: p.tenantId, projectId: p.projectId, connectionId: conn!.connectionId, assetId: p.assetId, fileName: asset!.fileName || `${p.assetId}.jpg`, canvaFolderId: mapping!.canvaFolderId }, p.now)
  );
  return { queued: true, job };
}

/* ───────────────────────── Uzlaştırma (kayıp bildirim kurtarma) ─────────────────────────
 * Eşleme başına KALICI cursor (createdAt ↑, belge kimliği ↑): her çalıştırma kaldığı yerden sayfa sayfa
 * ilerler; iki cron arasında çok sayıda yükleme veya uzun kesinti kayıp oluşturmaz. Başlangıç noktası
 * eşlemenin toCanvaSince anı (backfill yok). Eşleme (bağlantı/klasör/since) değişirse cursor geçersizdir.
 * Cursor belgenin HAM createdAt değerini (Timestamp, nanosaniye) + belge kimliğini saklar; ms'ye yuvarlama yok.
 * Son SETTLE_MS içindeki kayıtlar işlenir ama cursor onların ötesine geçmez (geç commit edilen kayıt kaçmaz).
 */
export const RECONCILE_CURSORS = 'canva_reconcile_cursors';
export const RECONCILE_PAGE = 50;
export const SETTLE_MS = 2 * 60_000;
export const DOC_ID_FIELD = '__name__';

export interface ReconcileCursor {
  connectionId: string;
  canvaFolderId: string;
  toCanvaSince: number;
  /** Belgedeki HAM createdAt (Firestore Timestamp, nanosaniye korunur) — startAfter yalnız bununla */
  createdAt: any;
  /** Yalnız görüntüleme/oturma kontrolü (yuvarlanmış; sayfalamada KULLANILMAZ) */
  createdAtMs: number;
  assetId: string;
  updatedAt: number;
}

export interface ReconcileOpts {
  featureEnabled: boolean;
  now: number;
  /** Süre bütçesi: clock() >= deadline olunca durur (sonraki çalıştırma cursor'dan sürer) */
  clock?: () => number;
  deadline?: number;
  pageSize?: number;
  /** ms → Firestore'da saklanan createdAt tipi (Admin SDK: Timestamp.fromMillis) */
  timeValue?: (ms: number) => any;
}

export async function reconcileRecentAssets(db: Db, p: ReconcileOpts) {
  const skipped: Record<string, number> = {};
  const skip = (r: string, n = 1) => (skipped[r] = (skipped[r] || 0) + n);
  const clock = p.clock ?? Date.now;
  const deadline = p.deadline ?? Infinity;
  const pageSize = p.pageSize ?? RECONCILE_PAGE;
  const tv = p.timeValue ?? ((ms: number) => ms);
  let queued = 0;
  let scanned = 0;
  let budgetExhausted = false;
  if (!p.featureEnabled) return { mappings: 0, queued, scanned, budgetExhausted, skipped: { feature_disabled: 1 } };
  const maps = await db.collection(COL.mappings).where('toCanva', '==', true).get();
  for (const m of maps.docs) {
    if (clock() >= deadline) {
      budgetExhausted = true;
      break;
    }
    const mapping = m.data() as CanvaFolderMapping & { toCanvaSince?: number | null };
    if (m.id !== mappingDocId(mapping.tenantId, mapping.projectId)) {
      skip('mapping_mismatch');
      continue;
    }
    if (!mapping.toCanvaSince) {
      skip('before_mapping_no_backfill');
      continue;
    }
    // Eşleme düzeyinde ön kontrol: bağlantı yok/eski ise sayfa taranmaz, cursor ilerlemez
    const conn = await loadConnection(db, mapping.tenantId);
    if (!conn || conn.status !== 'connected' || conn.tenantId !== mapping.tenantId) {
      skip('not_connected');
      continue;
    }
    if (conn.connectionId !== mapping.connectionId) {
      skip('mapping_stale_connection');
      continue;
    }
    const curRef = db.collection(RECONCILE_CURSORS).doc(m.id);
    const curSnap = await curRef.get();
    const c = curSnap.exists ? (curSnap.data() as ReconcileCursor) : null;
    let cursor =
      c && c.connectionId === mapping.connectionId && c.canvaFolderId === mapping.canvaFolderId && c.toCanvaSince === mapping.toCanvaSince
        ? { createdAt: c.createdAt, createdAtMs: c.createdAtMs, assetId: c.assetId }
        : null;
    for (;;) {
      if (clock() >= deadline) {
        budgetExhausted = true;
        break;
      }
      let q = db
        .collection('brand_media')
        .where('tenantId', '==', mapping.tenantId)
        .where('projectId', '==', mapping.projectId)
        .where('createdAt', '>=', tv(mapping.toCanvaSince))
        .orderBy('createdAt', 'asc')
        .orderBy(DOC_ID_FIELD, 'asc');
      // Ham değer: ms'ye yuvarlanmış Timestamp aynı ms'deki kayıtları tekrar döndürür → sayfa ilerlemez
      if (cursor) q = q.startAfter(cursor.createdAt, cursor.assetId);
      const page = await q.limit(pageSize).get();
      let advanced: { createdAt: any; createdAtMs: number; assetId: string } | null = null;
      let unsettled = false;
      let failed = false;
      for (const a of page.docs) {
        scanned++;
        const rawCreatedAt = a.data()?.createdAt;
        const createdAtMs = toMs(rawCreatedAt);
        try {
          const r = await enqueueForAsset(db, { tenantId: mapping.tenantId, projectId: mapping.projectId, assetId: a.id, featureEnabled: true, now: p.now });
          if (r.queued) queued++;
          else skip(r.reason);
        } catch {
          skip('enqueue_error');
          failed = true; // bu kaydın ötesine geçme; sonraki çalıştırma yeniden dener
          break;
        }
        if (createdAtMs === null) continue;
        if (createdAtMs > p.now - SETTLE_MS) unsettled = true;
        if (!unsettled) advanced = { createdAt: rawCreatedAt, createdAtMs, assetId: a.id };
      }
      if (advanced) {
        await curRef.set({ connectionId: mapping.connectionId, canvaFolderId: mapping.canvaFolderId, toCanvaSince: mapping.toCanvaSince, ...advanced, updatedAt: p.now } satisfies ReconcileCursor);
        cursor = advanced;
      }
      if (failed || unsettled || page.docs.length < pageSize || !advanced) break;
    }
  }
  return { mappings: maps.size ?? maps.docs.length, queued, scanned, budgetExhausted, skipped };
}

/* ───────────────────────── İşçi (kalıcı kuyruk) ─────────────────────────
 * Sorgu: state ∈ İŞLENEBİLİR ve nextAttemptAt <= now, nextAttemptAt ↑ + kimlik ↑ sıralı, sayfalı (startAfter).
 * Her incelenen iş ya ilerler ya da kalıcı olarak ertelenir/sonlandırılır → önde bekleyen işler arkadakileri
 * aç bırakmaz. Süresi geçmiş lease'li upload_started → needs_review (kör yeniden yükleme yok);
 * moving → yalnız klasöre taşıma tekrarı (motor). Lease'i canlı işlere dokunulmaz.
 */
export const PROCESSABLE_STATES = ['pending', 'upload_started', 'upload_submitted', 'uploaded', 'moving'] as const;
const RECOVERY_STATES = new Set(['upload_started', 'moving']);
export const WORKER_PAGE = 25;
/** Eşleme kapatıldı/değişti veya medya aktif değil: iş silinmez, uzun süre ertelenir */
export const DEFER_MS = 6 * 60 * 60_000;

export interface WorkerDeps {
  /** Token yalnız bu connectionId için verilmeli (getAccessToken expectedConnectionId) */
  canvaFor: (tenantId: string, connectionId: string) => CanvaOps;
  readSourceFor: (asset: AutoSyncAsset) => Promise<SourceFile>;
  owner: string;
  now: () => number;
  maxPolls?: number;
  pollDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface WorkerOpts {
  featureEnabled: boolean;
  /** En fazla işlenecek (motor çalıştırılan) iş */
  limit?: number;
  pageSize?: number;
  deadline?: number;
}

/** Lease'i boşta olan ve durumu değişmemiş işe fenced yama (başka çalıştırıcı işliyorsa dokunmaz) */
async function patchIfIdle(db: Db, id: string, expectState: string, patch: Partial<SyncJob>, now: number): Promise<boolean> {
  const ref = db.collection(COL.jobs).doc(id);
  return db.runTransaction(async (tx: any) => {
    const s = await tx.get(ref);
    if (!s.exists) return false;
    const j = s.data() as SyncJob;
    if (j.state !== expectState) return false;
    if (j.leaseOwner && (j.leaseUntil || 0) > now) return false;
    tx.update(ref, { ...patch, updatedAt: now });
    return true;
  });
}

const errOf = (code: string, message: string, at: number) => ({ code, message, at });

export async function processDueJobs(db: Db, deps: WorkerDeps, p: WorkerOpts) {
  const out = { considered: 0, processed: 0, budgetExhausted: false, skipped: {} as Record<string, number>, states: {} as Record<string, number> };
  if (!p.featureEnabled) return out;
  const skip = (r: string) => (out.skipped[r] = (out.skipped[r] || 0) + 1);
  const limit = p.limit ?? 25;
  const pageSize = p.pageSize ?? WORKER_PAGE;
  const deadline = p.deadline ?? Infinity;
  const store = firestoreSyncStore(db);
  const scanAt = deps.now();
  let after: [number, string] | null = null;

  for (;;) {
    let q = db
      .collection(COL.jobs)
      .where('state', 'in', [...PROCESSABLE_STATES])
      .where('nextAttemptAt', '<=', scanAt)
      .orderBy('nextAttemptAt', 'asc')
      .orderBy(DOC_ID_FIELD, 'asc');
    if (after) q = q.startAfter(...after);
    const snap = await q.limit(pageSize).get();
    for (const doc of snap.docs) {
      if (out.processed >= limit) return out;
      if (deps.now() >= deadline) {
        out.budgetExhausted = true;
        return out;
      }
      const job = doc.data() as SyncJob;
      after = [job.nextAttemptAt ?? 0, doc.id];
      out.considered++;
      const now = deps.now();
      if (job.nextAttemptAt && job.nextAttemptAt > now) {
        skip('not_due');
        continue;
      }
      if (job.leaseOwner && (job.leaseUntil || 0) > now) {
        skip('leased'); // canlı çalıştırıcı var (ör. upload_complete isteği)
        continue;
      }
      const [conn, mapping, assetSnap] = await Promise.all([
        loadConnection(db, job.tenantId),
        loadMapping(db, job.tenantId, job.projectId),
        db.collection('brand_media').doc(job.assetId).get(),
      ]);

      // Bağlantı değişti (yeniden bağlanma = yeni connectionId = yeni iş kimliği): eski iş bir daha ilerleyemez
      if (!conn || conn.tenantId !== job.tenantId || conn.connectionId !== job.connectionId) {
        const uncertain = job.state !== 'pending'; // Canva'da yükleme olmuş olabilir → görünür bırak
        await patchIfIdle(db, job.id, job.state, uncertain
          ? { state: 'needs_review', lastError: errOf('connection_changed', 'Canva bağlantısı değişti; bu kaydı Canva\'da kontrol edin', now) }
          : { state: 'failed', lastError: errOf('connection_changed', 'Canva bağlantısı değişti; yeni bağlantıyla yeniden kuyruğa alınmalı', now) }, now);
        skip('connection_changed');
        continue;
      }
      if (conn.status !== 'connected') {
        await patchIfIdle(db, job.id, job.state, { nextAttemptAt: now + DEFER_MS, lastError: errOf('not_connected', 'Canva yeniden yetki bekliyor', now) }, now);
        skip('not_connected');
        continue;
      }
      if (
        !mapping || !mapping.toCanva || mapping.tenantId !== job.tenantId || mapping.projectId !== job.projectId ||
        mapping.connectionId !== job.connectionId || mapping.canvaFolderId !== job.canvaFolderId
      ) {
        await patchIfIdle(db, job.id, job.state, { nextAttemptAt: now + DEFER_MS, lastError: errOf('mapping_changed', 'Klasör eşlemesi kapatıldı veya değişti; aktarım bekletiliyor', now) }, now);
        skip('mapping_changed');
        continue;
      }
      const asset = assetSnap.exists ? assetFromDoc(job.assetId, assetSnap.data()) : null;
      if (!asset || asset.tenantId !== job.tenantId || asset.projectId !== job.projectId || asset.status !== 'active') {
        await patchIfIdle(db, job.id, job.state, { nextAttemptAt: now + DEFER_MS, lastError: errOf('asset_not_active', 'Medya aktif değil (arşiv/silinmiş); Canva\'ya aktarılmıyor', now) }, now);
        skip('asset_not_active');
        continue;
      }
      if (RECOVERY_STATES.has(job.state)) skip(`recovered_${job.state}`);
      const result = await runSyncJob(job.id, {
        store,
        canva: deps.canvaFor(job.tenantId, job.connectionId),
        readSource: () => deps.readSourceFor(asset),
        now: deps.now,
        owner: deps.owner,
        maxPolls: deps.maxPolls ?? 3,
        pollDelayMs: deps.pollDelayMs ?? 2000,
        sleep: deps.sleep,
      });
      out.processed++;
      out.states[result.state] = (out.states[result.state] || 0) + 1;
    }
    if (snap.docs.length < pageSize) return out;
  }
}

export { syncJobId };
