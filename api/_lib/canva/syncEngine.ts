/**
 * Studio → Canva fotoğraf senkronu — durum makinesi (saf; depo/istemci/kaynak dışarıdan verilir).
 *
 * Durumlar: pending → upload_started → upload_submitted → uploaded → (moving) → done
 *           unsupported | failed | needs_review | move_failed
 * Güvenceler:
 *  - İş kimliği tenant+proje+bağlantı+Studio varlığından deterministik; aynı kayıt için tek iş.
 *  - Lease: aynı anda tek çalıştırıcı.
 *  - "upload_started" POST'tan ÖNCE kalıcı yazılır. POST yanıtı alınamazsa veya 5xx dönerse yükleme
 *    gerçekleşmiş olabilir → needs_review; KÖR YENİDEN YÜKLEME YOK. Yönetici "Canva'da var, asset ID bağla"
 *    veya "yoksa yeniden yükle" der. Bu nedenle mutlak exactly-once garantisi YOKTUR; çift yükleme ancak
 *    yöneticinin açık "yeniden yükle" kararıyla olabilir.
 *  - İçerik SHA-256 + tenant/proje/bağlantı ile aynı baytlar ikinci kez yüklenmez: yüklemeden önce içerik
 *    anahtarı ATOMİK olarak rezerve edilir (farklı Studio kayıtları aynı baytlarla eşzamanlı çalışsa da tek
 *    yükleme). Kesin başarısızlıkta rezervasyon bırakılır; belirsizlikte korunur (diğer kayıt da kör yüklemez).
 *  - Klasöre taşıma ayrı adım; hatasında yalnız taşıma yeniden denenir, yükleme tekrarlanmaz.
 *  - Studio kaydı ve orijinal hiçbir zaman bu senkron yüzünden değişmez/silinmez.
 */

import { createHash } from 'crypto';
import { AUTH_UNAVAILABLE, CANVA_IMAGE_MAX_BYTES, CANVA_SYNC_MIME, CanvaApiError, type CanvaUploadJob } from './client';

export type SyncState =
  | 'pending'
  | 'upload_started'
  | 'upload_submitted'
  | 'uploaded'
  | 'moving'
  | 'done'
  | 'unsupported'
  | 'failed'
  | 'needs_review'
  | 'move_failed';

export interface SyncJob {
  id: string;
  tenantId: string;
  projectId: string;
  connectionId: string;
  assetId: string;
  fileName: string;
  canvaFolderId: string | null;
  state: SyncState;
  contentSha256?: string;
  uploadAttempts: number;
  moveAttempts: number;
  /** Kaynak (Studio Storage) okuma hataları — sınırlı */
  sourceErrors?: number;
  canvaUploadJobId?: string | null;
  canvaAssetId?: string | null;
  movedAt?: number | null;
  nextAttemptAt?: number | null;
  lastError?: { code: string; message: string; at: number } | null;
  leaseOwner?: string | null;
  leaseUntil?: number | null;
  createdAt: number;
  updatedAt: number;
}

export const MAX_UPLOAD_ATTEMPTS = 3;
export const MAX_MOVE_ATTEMPTS = 5;
export const MAX_SOURCE_ERRORS = 3;
export const RETRY_DELAY_MS = 60_000;
export const POLL_RETRY_MS = 30_000;
export const LEASE_MS = 90_000;

export const syncJobId = (p: { tenantId: string; projectId: string; connectionId: string; assetId: string }) =>
  createHash('sha256').update(['canva-sync', p.tenantId, p.projectId, p.connectionId, p.assetId].join('|')).digest('hex').slice(0, 40);

export const contentIndexKey = (p: { tenantId: string; projectId: string; connectionId: string; sha256: string }) =>
  createHash('sha256').update(['canva-content', p.tenantId, p.projectId, p.connectionId, p.sha256].join('|')).digest('hex').slice(0, 40);

export interface SyncStore {
  get(id: string): Promise<SyncJob | null>;
  /** Yoksa oluşturur; varsa mevcut olanı döndürür */
  createIfAbsent(job: SyncJob): Promise<SyncJob>;
  /** Lease alır (süresi geçmişse veya boşsa); alınamazsa null */
  claim(id: string, owner: string, now: number, leaseMs: number): Promise<SyncJob | null>;
  /** Yalnız lease sahibi yazabilir */
  update(id: string, owner: string, patch: Partial<SyncJob>): Promise<void>;
  release(id: string, owner: string): Promise<void>;
  getContentIndex(key: string): Promise<{ canvaAssetId: string } | null>;
  setContentIndex(key: string, value: { canvaAssetId: string; jobId: string; at: number }): Promise<void>;
  /**
   * İçerik anahtarını atomik rezerve eder:
   *  - zaten asset varsa → { kind: 'asset', canvaAssetId }
   *  - başka işin geçerli rezervasyonu varsa → { kind: 'busy', jobId }
   *  - yoksa / aynı işe aitse / süresi geçmiş ve belirsiz değilse → { kind: 'reserved' }
   */
  reserveContent(key: string, jobId: string, now: number, ttlMs: number): Promise<ContentReservation>;
  /** Yalnız sahibi değiştirebilir. hold: süresiz tutulur (Canva işi sürerken veya sonuç belirsizken) */
  markContent(key: string, jobId: string, action: 'release' | 'hold'): Promise<void>;
}

export type ContentReservation = { kind: 'asset'; canvaAssetId: string } | { kind: 'busy'; jobId: string } | { kind: 'reserved' };
export const CONTENT_RESERVATION_TTL_MS = 10 * 60_000;

/** Rezervasyon kararı (saf; depo uygulamaları transaction içinde kullanır) */
export function decideReservation(
  existing: { canvaAssetId?: string; reservedBy?: string; reservedUntil?: number; held?: boolean } | null,
  jobId: string,
  now: number
): ContentReservation {
  if (existing?.canvaAssetId) return { kind: 'asset', canvaAssetId: existing.canvaAssetId };
  if (existing?.reservedBy && existing.reservedBy !== jobId && (existing.held || (existing.reservedUntil || 0) > now)) {
    return { kind: 'busy', jobId: existing.reservedBy };
  }
  return { kind: 'reserved' };
}

export interface SourceFile {
  bytes: Buffer;
  sha256: string;
  contentType: string;
  size: number;
}

export interface CanvaOps {
  createAssetUploadJob(bytes: Buffer, fileName: string): Promise<CanvaUploadJob>;
  getAssetUploadJob(jobId: string): Promise<CanvaUploadJob>;
  moveFolderItem(itemId: string, toFolderId: string): Promise<void>;
  getAsset?(assetId: string): Promise<{ id: string; type: string; name: string }>;
}

export interface SyncDeps {
  store: SyncStore;
  canva: CanvaOps;
  readSource: () => Promise<SourceFile>;
  now: () => number;
  owner: string;
  sleep?: (ms: number) => Promise<void>;
  maxPolls?: number;
  pollDelayMs?: number;
}

export type SyncCommand =
  | { type: 'run' }
  /** Yönetici: needs_review sonrası Canva'da kontrol etti, yükleme yok → yeniden yükle */
  | { type: 'reupload' }
  /** Yönetici: needs_review sonrası Canva'da buldu → mevcut asset'i bağla (yükleme yok) */
  | { type: 'link_existing'; canvaAssetId: string }
  /** move_failed sonrası (ör. klasör izni düzeltildi): yalnız taşıma */
  | { type: 'retry_move' };

const isSupported = (s: Pick<SourceFile, 'contentType' | 'size'>) => CANVA_SYNC_MIME.has(s.contentType) && s.size > 0 && s.size < CANVA_IMAGE_MAX_BYTES;

export function newSyncJob(p: Omit<SyncJob, 'id' | 'state' | 'uploadAttempts' | 'moveAttempts' | 'createdAt' | 'updatedAt'>, now: number): SyncJob {
  // nextAttemptAt her zaman sayı: işçi kuyruğu `nextAttemptAt <= now` sıralı sorgusuyla tarar
  return { ...p, id: syncJobId(p), state: 'pending', uploadAttempts: 0, moveAttempts: 0, nextAttemptAt: now, createdAt: now, updatedAt: now };
}

function err(code: string, message: string, now: number) {
  return { code, message: message.slice(0, 300), at: now };
}

/** Bir işi mümkün olduğunca ilerletir; her durumda son hâlini döndürür */
export async function runSyncJob(jobId: string, deps: SyncDeps, cmd: SyncCommand = { type: 'run' }): Promise<SyncJob> {
  const { store, canva, owner } = deps;
  const now = deps.now;
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const claimed = await store.claim(jobId, owner, now(), LEASE_MS);
  if (!claimed) return (await store.get(jobId))!; // başka bir çalıştırıcı işliyor
  let job: SyncJob = claimed;
  const save = async (patch: Partial<SyncJob>) => {
    job = { ...job, ...patch, updatedAt: now() };
    await store.update(jobId, owner, { ...patch, updatedAt: job.updatedAt });
  };

  try {
    // ── Yönetici komutları ──
    if (cmd.type === 'link_existing') {
      if (job.state !== 'needs_review') return job;
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(cmd.canvaAssetId)) {
        await save({ lastError: err('bad_asset_id', 'Geçersiz Canva asset ID', now()) });
        return job;
      }
      if (canva.getAsset) {
        const a = await canva.getAsset(cmd.canvaAssetId); // erişilebilir ve görsel olmalı
        if (a.type !== 'image') {
          await save({ lastError: err('not_image', 'Bağlanan asset görsel değil', now()) });
          return job;
        }
      }
      await save({ canvaAssetId: cmd.canvaAssetId, canvaUploadJobId: null, state: 'uploaded', lastError: null });
      if (job.contentSha256) {
        await store.setContentIndex(contentIndexKey({ ...job, sha256: job.contentSha256 }), { canvaAssetId: cmd.canvaAssetId, jobId, at: now() });
      }
    } else if (cmd.type === 'reupload') {
      if (job.state !== 'needs_review') return job;
      await save({ state: 'pending', canvaUploadJobId: null, lastError: null });
    } else if (cmd.type === 'retry_move') {
      if (job.state !== 'move_failed') return job;
      await save({ state: 'uploaded', moveAttempts: 0, lastError: null });
    }

    if (['done', 'unsupported', 'failed', 'needs_review', 'move_failed'].includes(job.state)) return job;
    if (job.nextAttemptAt && job.nextAttemptAt > now() && cmd.type === 'run') return job;

    // ── 1) Yükleme ──
    if (!job.canvaAssetId) {
      if (job.state === 'upload_started' && !job.canvaUploadJobId) {
        // Önceki çalıştırma POST sırasında kesildi: yükleme olmuş olabilir → kör tekrar yok
        if (job.contentSha256) await store.markContent(contentIndexKey({ ...job, sha256: job.contentSha256 }), jobId, 'hold');
        await save({ state: 'needs_review', lastError: err('upload_interrupted', 'Önceki yükleme isteğinin sonucu bilinmiyor; Canva\'da kontrol edin', now()) });
        return job;
      }
      if (!job.canvaUploadJobId) {
        let src: SourceFile;
        try {
          src = await deps.readSource();
        } catch (e: any) {
          const n = (job.sourceErrors || 0) + 1;
          await save({
            sourceErrors: n,
            state: n >= MAX_SOURCE_ERRORS ? 'failed' : 'pending',
            nextAttemptAt: now() + RETRY_DELAY_MS * n,
            lastError: err('source_unavailable', `Studio dosyası okunamadı: ${String(e?.message || e)}`, now()),
          });
          return job;
        }
        if (!isSupported(src)) {
          await save({
            state: 'unsupported',
            contentSha256: src.sha256,
            lastError: err('unsupported', `Yalnız JPEG/PNG ve 50.000.000 bayttan küçük fotoğraf (${src.contentType}, ${src.size} B)`, now()),
          });
          return job;
        }
        const idxKey = contentIndexKey({ ...job, sha256: src.sha256 });
        const resv = await store.reserveContent(idxKey, jobId, now(), CONTENT_RESERVATION_TTL_MS);
        if (resv.kind === 'busy') {
          await save({ state: 'pending', contentSha256: src.sha256, nextAttemptAt: now() + 60_000, lastError: err('content_busy', 'Aynı dosya başka bir kayıt için Canva\'ya gönderiliyor', now()) });
          return job;
        }
        if (resv.kind === 'asset') {
          await save({ contentSha256: src.sha256, canvaAssetId: resv.canvaAssetId, state: 'uploaded', lastError: null });
        } else {
          if (job.uploadAttempts >= MAX_UPLOAD_ATTEMPTS) {
            await store.markContent(idxKey, jobId, 'release');
            await save({ state: 'failed', lastError: err('upload_attempts_exhausted', 'Yükleme deneme sınırı doldu', now()) });
            return job;
          }
          await save({ state: 'upload_started', contentSha256: src.sha256, uploadAttempts: job.uploadAttempts + 1 });
          // POST uçuştayken sonuç bilinmez: rezervasyon süresiz tutulur; kesin hatada bırakılır
          await store.markContent(idxKey, jobId, 'hold');
          let created: CanvaUploadJob;
          try {
            created = await canva.createAssetUploadJob(src.bytes, job.fileName);
          } catch (e) {
            const ce = e instanceof CanvaApiError ? e : new CanvaApiError(String((e as any)?.message || e), null, 'unknown', true);
            if (ce.rateLimited || ce.code === AUTH_UNAVAILABLE) {
              await store.markContent(idxKey, jobId, 'release');
              await save({
                state: 'pending',
                nextAttemptAt: now() + RETRY_DELAY_MS,
                lastError: err(ce.code === AUTH_UNAVAILABLE ? AUTH_UNAVAILABLE : 'rate_limited', ce.code === AUTH_UNAVAILABLE ? 'Canva token alınamadı; istek gönderilmedi, sonra yeniden denenecek' : 'Canva hız sınırı; sonra yeniden denenecek', now()),
              });
            } else if (ce.noResponse || ce.serverError) {
              await store.markContent(idxKey, jobId, 'hold');
              await save({ state: 'needs_review', lastError: err(ce.code, 'Yükleme isteğinin sonucu belirsiz; Canva\'da kontrol edin', now()) });
            } else {
              await store.markContent(idxKey, jobId, 'release');
              await save({ state: 'failed', lastError: err(ce.code, ce.message, now()) });
            }
            return job;
          }
          await save({ state: 'upload_submitted', canvaUploadJobId: created.id });
          if (created.status === 'success' && created.assetId) {
            await save({ canvaAssetId: created.assetId });
          }
        }
      }
      // İş durumunu sorgula (salt okuma; hata olursa durum korunur)
      const maxPolls = deps.maxPolls ?? 10;
      for (let i = 0; !job.canvaAssetId && job.canvaUploadJobId && i < maxPolls; i++) {
        let st: CanvaUploadJob;
        try {
          st = await canva.getAssetUploadJob(job.canvaUploadJobId);
        } catch (e) {
          const ce = e as CanvaApiError;
          await save({ nextAttemptAt: now() + POLL_RETRY_MS, lastError: err(ce.code || 'poll_error', 'Yükleme durumu alınamadı; sonra yeniden sorgulanacak', now()) });
          return job;
        }
        if (st.status === 'success' && st.assetId) {
          await save({ canvaAssetId: st.assetId });
        } else if (st.status === 'failed') {
          // İş başarısız → Canva'da asset oluşmadı; sınırlı yeniden yükleme güvenli
          const code = st.error?.code || 'import_failed';
          const terminal = code === 'file_too_big' || job.uploadAttempts >= MAX_UPLOAD_ATTEMPTS;
          if (job.contentSha256) await store.markContent(contentIndexKey({ ...job, sha256: job.contentSha256 }), jobId, 'release');
          await save({ state: terminal ? 'failed' : 'pending', canvaUploadJobId: null, lastError: err(code, st.error?.message || 'Canva içe aktarma başarısız', now()) });
          return job;
        } else if (i < maxPolls - 1) {
          await sleep(deps.pollDelayMs ?? 2000);
        }
      }
      if (!job.canvaAssetId) {
        // Hâlâ işleniyor: sonraki çalıştırma sorgular; kuyruğun önünü tıkamasın diye sıraya geri gönder
        await save({ nextAttemptAt: now() + POLL_RETRY_MS });
        return job;
      }
      await save({ state: 'uploaded', lastError: null });
      if (job.contentSha256) {
        await store.setContentIndex(contentIndexKey({ ...job, sha256: job.contentSha256 }), { canvaAssetId: job.canvaAssetId!, jobId, at: now() });
      }
    }

    // ── 2) Klasöre taşıma (yalnız bu adım yeniden denenir) ──
    if (!job.canvaFolderId) {
      await save({ state: 'done', lastError: null });
      return job;
    }
    if (job.movedAt) {
      await save({ state: 'done' });
      return job;
    }
    if (job.moveAttempts >= MAX_MOVE_ATTEMPTS) {
      await save({ state: 'move_failed', lastError: err('move_attempts_exhausted', 'Klasöre taşıma deneme sınırı doldu', now()) });
      return job;
    }
    await save({ state: 'moving', moveAttempts: job.moveAttempts + 1 });
    try {
      await canva.moveFolderItem(job.canvaAssetId!, job.canvaFolderId);
      await save({ state: 'done', movedAt: now(), lastError: null });
    } catch (e) {
      const ce = e instanceof CanvaApiError ? e : new CanvaApiError(String((e as any)?.message || e), null, 'unknown', true);
      if (ce.rateLimited || ce.serverError || ce.noResponse || ce.code === AUTH_UNAVAILABLE) {
        await save({ state: 'uploaded', nextAttemptAt: now() + RETRY_DELAY_MS, lastError: err(ce.code, 'Klasöre taşıma sonra yeniden denenecek', now()) });
      } else {
        // item_in_multiple_folders, permission_denied, folder_not_found, quota_exceeded … → kullanıcı düzeltmeli
        await save({ state: 'move_failed', lastError: err(ce.code, ce.message, now()) });
      }
    }
    return job;
  } finally {
    await store.release(jobId, owner).catch(() => undefined);
  }
}
