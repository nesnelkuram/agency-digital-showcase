/**
 * Kütüphane yükleme adımları (framework'süz; Storage/Firestore bağımlılıkları dışarıdan verilir).
 *
 * Sıra: ana dosya → (varsa) önizleme → katalog kaydı. Kayıt YALNIZ dosya tamamlanınca yazılır.
 * - İptal / sayfadan ayrılma / marka değişimi (abort) sonrası kayıt yazılmaz.
 * - Tekrar denemede tamamlanmış adımlar atlanır: Storage write-once olduğu için yüklenmiş dosya
 *   yeniden yüklenmez; yalnız URL alınır. Kayıt yazılmış ama yanıt kaybolmuşsa önce varlığı kontrol edilir.
 * - Önizleme hatası yüklemeyi durdurmaz (önizlemesiz kayıt).
 */

import {
  LIBRARY_THUMB_FILE,
  LIBRARY_THUMB_MAX_BYTES,
  brandMediaFolder,
  isSafePathId,
  kindFromMime,
  safeStorageFileName,
  validateLibraryFile,
  type BrandMediaKind,
} from '@/shared/types/brandMedia';
import type { NewBrandMediaRecord } from '../brandMediaData';

export interface UploadHandle {
  done: Promise<void>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

export interface UploadDeps {
  startUpload: (path: string, data: Blob, contentType: string, onProgress: (fraction: number) => void) => UploadHandle;
  getUrl: (path: string) => Promise<string>;
  readMetadata: (file: File) => Promise<{ width?: number; height?: number; duration?: number }>;
  makeThumbnail: (file: File) => Promise<Blob | undefined>;
  recordExists: (assetId: string) => Promise<boolean>;
  writeRecord: (r: NewBrandMediaRecord) => Promise<void>;
}

export type UploadStatus = 'queued' | 'uploading' | 'paused' | 'saving' | 'done' | 'error' | 'canceled';

export interface UploadItem {
  key: string;
  file: File;
  tenantId: string;
  projectId: string;
  assetId: string;
  kind: BrandMediaKind;
  mainPath: string;
  status: UploadStatus;
  /** 0–100 */
  progress: number;
  error?: string;
  tags: string[];
  // Tamamlanan adımlar (tekrar denemede atlanır)
  /** Ana yükleme en az bir kez başlatıldı (tamamlanıp yanıtı kaybolmuş olabilir) */
  mainStarted?: boolean;
  mainUploaded?: boolean;
  mainUrl?: string;
  meta?: { width?: number; height?: number; duration?: number };
  thumbTried?: boolean;
  thumbPath?: string;
  thumbUrl?: string;
  recordWritten?: boolean;
}

export interface Actor {
  uid: string;
  displayName?: string;
}

/** Kuyruğa eklenebilir mi? (dosya + tenant/proje kimliği) */
export function prepareItem(
  file: File,
  ctx: { tenantId: string; projectId: string; assetId: string; tags: string[] }
): { ok: true; item: UploadItem } | { ok: false; error: string } {
  const invalid = validateLibraryFile(file);
  if (invalid) return { ok: false, error: `${file.name}: ${invalid}` };
  if (!isSafePathId(ctx.tenantId) || !isSafePathId(ctx.projectId) || !isSafePathId(ctx.assetId)) {
    return { ok: false, error: 'Marka bilgisi geçersiz; sayfayı yenileyin.' };
  }
  const folder = brandMediaFolder(ctx.tenantId, ctx.projectId, ctx.assetId);
  const item: UploadItem = {
    key: ctx.assetId,
    file,
    tenantId: ctx.tenantId,
    projectId: ctx.projectId,
    assetId: ctx.assetId,
    kind: kindFromMime(file.type)!,
    mainPath: `${folder}/${safeStorageFileName(file.name)}`,
    status: 'queued',
    progress: 0,
    tags: ctx.tags,
  };
  return { ok: true, item };
}

export class UploadAborted extends Error {
  constructor() {
    super('aborted');
  }
}

/**
 * Bir öğeyi çalıştırır. `update` her durum değişiminde yeni öğe nesnesi alır.
 * `isAborted` true dönerse yan etki (kayıt) yapılmadan durur. `setHandle` aktif yükleme
 * tutamacını dışarı verir (duraklat/devam/iptal için).
 */
export async function runUploadItem(
  start: UploadItem,
  deps: UploadDeps,
  actor: Actor,
  hooks: {
    update: (item: UploadItem) => void;
    isAborted: () => boolean;
    setHandle: (h: UploadHandle | null) => void;
  }
): Promise<UploadItem> {
  let item: UploadItem = { ...start, status: 'uploading', error: undefined };
  const set = (patch: Partial<UploadItem>) => {
    item = { ...item, ...patch };
    hooks.update(item);
  };
  const checkAbort = () => {
    if (hooks.isAborted()) throw new UploadAborted();
  };
  hooks.update(item);

  try {
    // 1) Ana dosya — önceki denemede tamamlanmış olabilir (write-once: yeniden yüklenemez)
    if (!item.mainUploaded && item.mainStarted) {
      checkAbort();
      const existing = await deps.getUrl(item.mainPath).catch(() => null);
      if (existing) set({ mainUploaded: true, mainUrl: existing, progress: 90 });
    }
    if (!item.mainUploaded) {
      checkAbort();
      set({ mainStarted: true });
      const h = deps.startUpload(item.mainPath, item.file, item.file.type, (f) => set({ progress: Math.min(90, Math.round(f * 90)) }));
      hooks.setHandle(h);
      try {
        await h.done;
      } finally {
        hooks.setHandle(null);
      }
      set({ mainUploaded: true, progress: 90 });
    }
    if (!item.mainUrl) {
      checkAbort();
      set({ mainUrl: await deps.getUrl(item.mainPath) });
    }

    // 2) Metadata ve önizleme (hata durdurmaz)
    if (!item.meta) {
      checkAbort();
      set({ meta: await deps.readMetadata(item.file).catch(() => ({})) });
    }
    if (!item.thumbTried) {
      checkAbort();
      const thumbPath = `${brandMediaFolder(item.tenantId, item.projectId, item.assetId)}/${LIBRARY_THUMB_FILE}`;
      try {
        const blob = await deps.makeThumbnail(item.file);
        if (blob && blob.size > 0 && blob.size <= LIBRARY_THUMB_MAX_BYTES) {
          checkAbort();
          const th = deps.startUpload(thumbPath, blob, 'image/jpeg', () => {});
          hooks.setHandle(th);
          try {
            await th.done;
          } finally {
            hooks.setHandle(null);
          }
          set({ thumbPath, thumbUrl: await deps.getUrl(thumbPath) });
        }
      } catch (err) {
        if (err instanceof UploadAborted || hooks.isAborted()) throw new UploadAborted();
        // önizlemesiz devam
      }
      set({ thumbTried: true, progress: 95 });
    }

    // 3) Katalog kaydı — yalnız tamamlanmış dosya için, abort edilmediyse
    checkAbort();
    set({ status: 'saving' });
    if (!item.recordWritten) {
      const exists = await deps.recordExists(item.assetId).catch(() => false);
      checkAbort();
      if (!exists) {
        await deps.writeRecord({
          assetId: item.assetId,
          tenantId: item.tenantId,
          projectId: item.projectId,
          kind: item.kind,
          title: item.file.name.replace(/\.[^.]+$/, '').slice(0, 200),
          fileName: item.file.name,
          tags: item.tags,
          storage: {
            path: item.mainPath,
            downloadUrl: item.mainUrl!,
            contentType: item.file.type,
            size: item.file.size,
            ...item.meta,
            ...(item.thumbPath && item.thumbUrl ? { thumbPath: item.thumbPath, thumbUrl: item.thumbUrl } : {}),
          },
          createdBy: actor.uid,
          createdByName: actor.displayName,
        });
      }
      set({ recordWritten: true });
    }
    set({ status: 'done', progress: 100 });
    return item;
  } catch (err: any) {
    if (err instanceof UploadAborted || hooks.isAborted() || err?.code === 'storage/canceled') {
      set({ status: 'canceled' });
      return item;
    }
    set({ status: 'error', error: describeUploadError(err) });
    return item;
  }
}

export function describeUploadError(err: any): string {
  const code: string = err?.code || '';
  if (code === 'storage/unauthorized' || code === 'permission-denied') return 'Bu markaya yükleme yetkiniz yok veya dosya kurallara uymuyor.';
  if (code === 'storage/retry-limit-exceeded' || code === 'unavailable') return 'Bağlantı koptu. "Tekrar dene" ile kaldığı adımdan devam edin.';
  if (code === 'storage/quota-exceeded') return 'Depolama kotası dolu. Yöneticiye bildirin.';
  return 'Yükleme tamamlanamadı. "Tekrar dene" ile kaldığı adımdan devam edin.';
}
