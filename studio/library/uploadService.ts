/**
 * Uygulama genelinde yaşayan yükleme kuyruğu (framework'süz).
 *
 * Sayfa/marka değişimi kuyruğu ETKİLEMEZ: her iş oluşturulurken tenant, proje, marka adı ve işi başlatan
 * kullanıcı sabit bağlanır (değişmez). Kuyruk yalnız OTURUM sona erince (çıkış / başka kullanıcı) iptal edilir.
 * Tenant değişimi de hedefi değiştirmez: iş, oluşturulduğu tenant'a yazılır (bkz. enqueue ctx).
 *
 * Dürüstlük: tarayıcı kapanırsa/yenilenirse kuyruk bellekte olduğu için gider; biten dosyalar kütüphanede kalır,
 * yarım kalanlar için dosyaların yeniden seçilmesi gerekir. Kayıt (saving) yazılırken iptal kabul edilmez.
 */
import { prepareItem, runUploadItem, type Actor, type UploadDeps, type UploadHandle, type UploadItem } from './uploadRunner';

export type QueuedUpload = UploadItem & {
  /** Aynı oturumda tekrar eklemeyi önlemek için dosya imzası (tenant|proje|ad|boyut|lastModified) */
  sig: string;
  projectName?: string;
  actor: Actor;
};

export const ACTIVE_STATUSES = new Set<UploadItem['status']>(['queued', 'uploading', 'paused', 'saving']);

export interface UploadSummary {
  /** İptal edilenler hariç iş sayısı */
  total: number;
  /** Katalog kaydı yazılmış (kütüphaneye eklenmiş) */
  done: number;
  queued: number;
  uploading: number;
  paused: number;
  saving: number;
  failed: number;
  canceled: number;
  totalBytes: number;
  /** Depolamaya aktarılmış bayt (kayıt yazılana kadar iş "tamamlandı" sayılmaz) */
  uploadedBytes: number;
  /** Dosyası yüklenmiş ama katalog kaydı henüz yazılmamış iş sayısı */
  recordsPending: number;
  /** 0–1, bayt oranı */
  fraction: number;
  active: boolean;
}

export interface UploadSnapshot {
  items: QueuedUpload[];
  queuePaused: boolean;
  summary: UploadSummary;
  /**
   * Yükleme bileşenleri (Storage/kayıt bağımlılıkları) yüklenemedi. Kuyruktaki işler BEKLER; kullanıcı açıkça
   * "Tekrar dene" demeden otomatik yeniden deneme YOKTUR (sınırsız döngü/UI kilitlenmesi önlenir).
   */
  dependencyError: string | null;
}

export interface UploadCreatedEvent {
  tenantId: string;
  projectId: string;
  assetId: string;
}

export interface EnqueueCtx {
  tenantId: string;
  projectId: string;
  projectName?: string;
  tags: string[];
  actor: Actor;
}

/** Ana yükleme 0–90 bandına, önizleme 95'e, kayıt 100'e eşlenir (uploadRunner) */
function uploadedBytesOf(i: UploadItem): number {
  if (i.status === 'done' || i.mainUploaded) return i.file.size;
  if (i.status === 'canceled' || i.status === 'queued') return 0;
  return Math.round(i.file.size * Math.max(0, Math.min(1, i.progress / 90)));
}

export function summarize(items: QueuedUpload[]): UploadSummary {
  const s: UploadSummary = {
    total: 0, done: 0, queued: 0, uploading: 0, paused: 0, saving: 0, failed: 0, canceled: 0,
    totalBytes: 0, uploadedBytes: 0, recordsPending: 0, fraction: 0, active: false,
  };
  for (const i of items) {
    if (i.status === 'canceled') {
      s.canceled++;
      continue;
    }
    s.total++;
    s.totalBytes += i.file.size;
    s.uploadedBytes += uploadedBytesOf(i);
    if (i.status === 'done') s.done++;
    else if (i.status === 'queued') s.queued++;
    else if (i.status === 'uploading') s.uploading++;
    else if (i.status === 'paused') s.paused++;
    else if (i.status === 'saving') s.saving++;
    else if (i.status === 'error') s.failed++;
    if (i.status !== 'done' && i.mainUploaded) s.recordsPending++;
  }
  s.fraction = s.totalBytes > 0 ? Math.min(1, s.uploadedBytes / s.totalBytes) : 0;
  s.active = s.queued + s.uploading + s.paused + s.saving > 0;
  return s;
}

const fileSig = (tenantId: string, projectId: string, f: File) => `${tenantId}|${projectId}|${f.name}|${f.size}|${f.lastModified}`;

export class UploadService {
  private items: QueuedUpload[] = [];
  private queuePaused = false;
  private generation = 0;
  private aborted = new Set<string>();
  private current: { key: string; handle: UploadHandle } | null = null;
  private running = false;
  private sessionUid: string | null = null;
  private listeners = new Set<() => void>();
  private createdListeners = new Set<(e: UploadCreatedEvent) => void>();
  private deps: UploadDeps | null = null;
  private depsError: string | null = null;
  private snapshot: UploadSnapshot = { items: [], queuePaused: false, summary: summarize([]), dependencyError: null };

  constructor(
    private getDeps: () => Promise<UploadDeps>,
    private newId: () => string,
    /** Katalog kaydı yazıldıktan sonra (iş ne olursa olsun, sayfa kapalı olsa da) çalışan ayrı bildirim */
    private afterCreate?: (e: UploadCreatedEvent) => void | Promise<void>
  ) {}

  // ---- abonelik (useSyncExternalStore) ----
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = (): UploadSnapshot => this.snapshot;
  onAssetCreated(fn: (e: UploadCreatedEvent) => void) {
    this.createdListeners.add(fn);
    return () => {
      this.createdListeners.delete(fn);
    };
  }

  private commit(next: QueuedUpload[]) {
    this.items = next;
    this.publish();
  }
  private publish() {
    this.snapshot = { items: this.items, queuePaused: this.queuePaused, summary: summarize(this.items), dependencyError: this.depsError };
    this.listeners.forEach((l) => l());
  }
  private patch(key: string, p: Partial<QueuedUpload> | ((i: QueuedUpload) => QueuedUpload)) {
    this.commit(this.items.map((i) => (i.key === key ? (typeof p === 'function' ? p(i) : { ...i, ...p }) : i)));
  }

  // ---- oturum ----
  /**
   * Kimlik doğrulama oturumunu bağlar. Kullanıcı değişir/çıkış yapılırsa kuyruk güvenle iptal edilir
   * (başka kullanıcının işi yeni oturumda yazılmaz). Aynı kullanıcı için çağrı etkisizdir.
   */
  bindSession(uid: string | null) {
    if (this.sessionUid === uid) return;
    const had = this.sessionUid !== null;
    this.sessionUid = uid;
    if (had) this.endSession();
  }

  /** Oturum sonu: yükleme iptal, kuyruk temizlenir. Yazılmakta olan katalog kaydı geri alınamaz; arka planda biter, arayüze yansımaz. */
  endSession() {
    this.generation++;
    this.current?.handle.cancel();
    this.current = null;
    this.aborted.clear();
    this.queuePaused = false;
    this.depsError = null;
    this.commit([]);
  }

  // ---- kuyruk ----
  /**
   * `ctx` işe SABİT bağlanır; sonradan aktif marka/tenant değişse de hedef değişmez.
   * Dönüş: kuyruğa alınamayan/atlanan dosyalar için açıklamalar (hata ya da "zaten kuyrukta").
   */
  enqueue(files: File[], ctx: EnqueueCtx): string[] {
    if (!ctx.projectId || !ctx.tenantId) return ['Marka seçili değil.'];
    const notes: string[] = [];
    const added: QueuedUpload[] = [];
    let requeued = false;
    for (const file of files) {
      const sig = fileSig(ctx.tenantId, ctx.projectId, file);
      const existing = this.items.find((i) => i.sig === sig) || added.find((i) => i.sig === sig);
      if (existing) {
        if (existing.status === 'error' || existing.status === 'canceled') {
          // Aynı dosya yeniden eklenirse YENİ varlık açılmaz: aynı kimlikle kaldığı adımdan sürer
          this.aborted.delete(existing.key);
          this.patch(existing.key, { status: 'queued', error: undefined });
          requeued = true;
        } else {
          notes.push(`${file.name}: ${existing.status === 'done' ? 'zaten kütüphaneye eklendi' : 'zaten kuyrukta'}, tekrar eklenmedi.`);
        }
        continue;
      }
      const prepared = prepareItem(file, { tenantId: ctx.tenantId, projectId: ctx.projectId, assetId: this.newId(), tags: ctx.tags });
      if (prepared.ok) added.push({ ...prepared.item, sig, projectName: ctx.projectName, actor: { ...ctx.actor } });
      else notes.push(prepared.error);
    }
    if (added.length) this.commit([...this.items, ...added]);
    if (added.length || requeued) void this.pump();
    return notes;
  }

  private async pump() {
    // Bağımlılık hatası varken (veya zaten çalışırken) HİÇBİR yeni bağımlılık çağrısı yapılmaz
    if (this.running || this.depsError) return;
    this.running = true;
    const gen = this.generation;
    let depsFailed = false;
    try {
      if (!this.deps) {
        try {
          this.deps = await this.getDeps();
        } catch {
          if (gen === this.generation) {
            depsFailed = true;
            this.depsError = 'Yükleme bileşenleri yüklenemedi. Dosyalar sırada bekliyor; bağlantıyı kontrol edip "Tekrar dene"ye basın.';
            this.publish();
          }
          return;
        }
      }
      const deps = this.deps;
      for (;;) {
        if (gen !== this.generation || this.queuePaused) break;
        const next = this.items.find((i) => i.status === 'queued');
        if (!next) break;
        const result = await runUploadItem(next, deps, next.actor, {
          update: (it) => {
            if (gen !== this.generation) return;
            this.patch(it.key, (prev) => ({
              ...prev,
              ...it,
              status: prev.status === 'paused' && it.status === 'uploading' ? 'paused' : it.status,
            }));
          },
          isAborted: () => gen !== this.generation || this.aborted.has(next.key),
          setHandle: (h) => {
            this.current = h ? { key: next.key, handle: h } : null;
          },
        });
        if (result.status === 'done') this.created({ tenantId: result.tenantId, projectId: result.projectId, assetId: result.assetId }, gen);
      }
    } finally {
      this.running = false;
      // Çalışırken eklenen işler için bir kez daha; bağımlılık hatasında ASLA (otomatik döngü yok)
      if (!depsFailed && !this.depsError && !this.queuePaused && this.items.some((i) => i.status === 'queued')) void this.pump();
    }
  }

  /**
   * Açık kullanıcı eylemi: bağımlılık hatasını temizler ve TAM BİR yeni deneme yapar. Hata sürerse yine bekleme durumuna döner.
   * Biten adımlar/kimlikler korunur; sırada bekleyen işler aynı varlık kimlikleriyle sürer (çift kayıt olmaz).
   */
  retryDependencies() {
    if (!this.depsError) return;
    this.depsError = null;
    this.publish();
    void this.pump();
  }

  /**
   * Kayıt yazıldıktan sonra yalnız OTURUM SÜRÜYORSA: ayrı bildirim + dinleyiciler. Oturum bitmişse bildirim gönderilmez
   * (yeni oturumun kimliğiyle başka kullanıcının varlığı için istek atılmaz); Canva/AI uzlaştırması cron'dadır.
   */
  private created(e: UploadCreatedEvent, gen: number) {
    if (gen !== this.generation) return;
    try {
      void Promise.resolve(this.afterCreate?.(e)).catch(() => {});
    } catch {
      // bildirim hatası yüklemeyi etkilemez
    }
    this.createdListeners.forEach((l) => l(e));
  }

  pause(key: string) {
    const item = this.items.find((i) => i.key === key);
    if (!item) return;
    if (this.current?.key === key && item.status === 'uploading') {
      this.current.handle.pause();
      this.patch(key, { status: 'paused' });
    } else if (item.status === 'queued') {
      this.patch(key, { status: 'paused' });
    }
  }
  resume(key: string) {
    const item = this.items.find((i) => i.key === key);
    if (!item || item.status !== 'paused') return;
    if (this.current?.key === key) {
      this.current.handle.resume();
      this.patch(key, { status: 'uploading' });
    } else {
      this.patch(key, { status: 'queued' });
      void this.pump();
    }
  }
  cancel(key: string) {
    const item = this.items.find((i) => i.key === key);
    // Kayıt yazılırken iptal kabul edilmez: commit geri alınamaz, "iptal edildi" denmez
    if (!item || !ACTIVE_STATUSES.has(item.status) || item.status === 'saving') return;
    this.aborted.add(key);
    if (this.current?.key === key) this.current.handle.cancel();
    if (item.status === 'queued' || item.status === 'paused') this.patch(key, { status: 'canceled' });
  }
  /** Hata veya iptal sonrası aynı kimlikle kaldığı adımdan sürer (biten adımlar atlanır, yeni varlık açılmaz) */
  retry(key: string) {
    const item = this.items.find((i) => i.key === key);
    if (!item || (item.status !== 'error' && item.status !== 'canceled')) return;
    this.aborted.delete(key);
    this.patch(key, { status: 'queued', error: undefined });
    this.depsError = null; // açık "Tekrar dene" eylemi
    void this.pump();
  }
  dismiss(key: string) {
    const item = this.items.find((i) => i.key === key);
    if (!item || ACTIVE_STATUSES.has(item.status)) return;
    this.commit(this.items.filter((i) => i.key !== key));
  }

  // ---- toplu eylemler ----
  pauseAll() {
    this.queuePaused = true;
    if (this.current) {
      const cur = this.items.find((i) => i.key === this.current!.key);
      if (cur?.status === 'uploading') {
        this.current.handle.pause();
        this.patch(cur.key, { status: 'paused' });
        return;
      }
    }
    this.publish();
  }
  resumeAll() {
    this.queuePaused = false;
    for (const i of this.items) {
      if (i.status === 'paused') {
        if (this.current?.key === i.key) this.current.handle.resume();
        this.patch(i.key, { status: this.current?.key === i.key ? 'uploading' : 'queued' });
      }
    }
    this.publish();
    void this.pump();
  }
  /** Kayıt yazılanlar hariç tüm aktif işleri iptal eder */
  cancelAll() {
    for (const i of [...this.items]) this.cancel(i.key);
  }
  retryFailed() {
    for (const i of [...this.items]) if (i.status === 'error') this.retry(i.key);
  }
  /** Biten ve iptal edilen satırları listeden kaldırır (kütüphane kayıtları silinmez) */
  clearFinished() {
    this.commit(this.items.filter((i) => ACTIVE_STATUSES.has(i.status) || i.status === 'error'));
  }
}
