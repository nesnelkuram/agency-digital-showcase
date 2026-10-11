// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { CanvaApiError, type CanvaUploadJob } from '@/api/_lib/canva/client';
import { contentIndexKey, decideReservation, newSyncJob, runSyncJob, type CanvaOps, type SourceFile, type SyncJob, type SyncStore, MAX_UPLOAD_ATTEMPTS } from '@/api/_lib/canva/syncEngine';

function memoryStore(): SyncStore & { jobs: Map<string, SyncJob>; index: Map<string, any> } {
  const jobs = new Map<string, SyncJob>();
  const index = new Map<string, any>();
  return {
    jobs,
    index,
    async get(id) {
      return jobs.get(id) ? { ...jobs.get(id)! } : null;
    },
    async createIfAbsent(job) {
      if (!jobs.has(job.id)) jobs.set(job.id, { ...job });
      return { ...jobs.get(job.id)! };
    },
    async claim(id, owner, now, leaseMs) {
      const j = jobs.get(id);
      if (!j) return null;
      if (j.leaseOwner && j.leaseOwner !== owner && (j.leaseUntil || 0) > now) return null;
      Object.assign(j, { leaseOwner: owner, leaseUntil: now + leaseMs });
      return { ...j };
    },
    async update(id, owner, patch) {
      const j = jobs.get(id)!;
      if (j.leaseOwner !== owner) throw new Error('lease_lost');
      Object.assign(j, patch);
    },
    async release(id, owner) {
      const j = jobs.get(id);
      if (j && j.leaseOwner === owner) Object.assign(j, { leaseOwner: null, leaseUntil: null });
    },
    async getContentIndex(k) {
      const v = index.get(k);
      return v?.canvaAssetId ? { canvaAssetId: v.canvaAssetId } : null;
    },
    async setContentIndex(k, v) {
      index.set(k, { ...v, reservedBy: null, held: false });
    },
    // JS tek iş parçacıklı: senkron gövde = atomik (Firestore'da transaction)
    async reserveContent(k, jobId, now, ttl) {
      const d = decideReservation(index.get(k) || null, jobId, now);
      if (d.kind === 'reserved') index.set(k, { ...(index.get(k) || {}), reservedBy: jobId, reservedUntil: now + ttl, held: false });
      return d;
    },
    async markContent(k, jobId, action) {
      const v = index.get(k);
      if (!v || v.reservedBy !== jobId || v.canvaAssetId) return;
      index.set(k, action === 'release' ? { ...v, reservedBy: null, reservedUntil: null, held: false } : { ...v, held: true });
    },
  };
}

const SRC = { bytes: Buffer.from([255, 216, 1]), sha256: 'a'.repeat(64), contentType: 'image/jpeg', size: 3 };
const base = { tenantId: 't1', projectId: 'p1', connectionId: 't1:1', assetId: 'asset1', fileName: 'WEDD5280.jpg', canvaFolderId: 'FAF3jRI82Dk' };

function setup(over: Partial<{ create: any; poll: any; move: any; src: any; folder: string | null }> = {}) {
  const store = memoryStore();
  let t = 1_000;
  const job = newSyncJob({ ...base, canvaFolderId: over.folder === undefined ? base.canvaFolderId : over.folder }, t);
  store.jobs.set(job.id, job);
  const canva = {
    createAssetUploadJob: vi.fn<CanvaOps['createAssetUploadJob']>(over.create || (async (): Promise<CanvaUploadJob> => ({ id: 'J1', status: 'in_progress' }))),
    getAssetUploadJob: vi.fn<CanvaOps['getAssetUploadJob']>(over.poll || (async (): Promise<CanvaUploadJob> => ({ id: 'J1', status: 'success', assetId: 'CA1' }))),
    moveFolderItem: vi.fn<CanvaOps['moveFolderItem']>(over.move || (async () => undefined)),
    getAsset: vi.fn<NonNullable<CanvaOps['getAsset']>>(async (id: string) => ({ id, type: 'image', name: 'x' })),
  };
  const deps = { store, canva, readSource: vi.fn<() => Promise<SourceFile>>(async () => over.src || SRC), now: () => (t += 1), owner: 'w1', sleep: async () => undefined, maxPolls: 3 };
  return { store, canva, deps, id: job.id };
}

describe('Studio → Canva senkron motoru', () => {
  it('mutlu yol: orijinal baytlar bir kez yüklenir, asset ID kaydedilir, klasöre taşınır', async () => {
    const { canva, deps, id, store } = setup();
    const j = await runSyncJob(id, deps);
    expect(j.state).toBe('done');
    expect(j.canvaAssetId).toBe('CA1');
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
    expect(canva.createAssetUploadJob.mock.calls[0][0]).toBe(SRC.bytes);
    expect(canva.moveFolderItem).toHaveBeenCalledWith('CA1', 'FAF3jRI82Dk');
    expect(store.index.get(contentIndexKey({ ...base, sha256: SRC.sha256 }))?.canvaAssetId).toBe('CA1');
    expect(store.jobs.get(id)!.leaseOwner).toBeNull();
  });

  it('aynı kayıt tekrar çalıştırılınca yeniden yükleme yok', async () => {
    const { canva, deps, id } = setup();
    await runSyncJob(id, deps);
    await runSyncJob(id, deps);
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
    expect(canva.moveFolderItem).toHaveBeenCalledTimes(1);
  });

  it('aynı içerik (hash) başka Studio kaydında yüklenmez; mevcut Canva asset\'i kullanılır', async () => {
    const a = setup();
    await runSyncJob(a.id, a.deps);
    const store = a.store;
    const second = newSyncJob({ ...base, assetId: 'asset2' }, 900);
    store.jobs.set(second.id, second);
    const j = await runSyncJob(second.id, { ...a.deps, store });
    expect(j.canvaAssetId).toBe('CA1');
    expect(a.canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
  });

  it('POST yanıtsız/zaman aşımı → needs_review; tekrar çalıştırma KÖR YÜKLEME YAPMAZ', async () => {
    const { canva, deps, id } = setup({ create: async () => Promise.reject(new CanvaApiError('t', null, 'no_response', true)) });
    expect((await runSyncJob(id, deps)).state).toBe('needs_review');
    expect((await runSyncJob(id, deps)).state).toBe('needs_review');
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
  });

  it('5xx yanıtı da belirsiz sayılır (Canva işlemiş olabilir)', async () => {
    const { deps, id } = setup({ create: async () => Promise.reject(new CanvaApiError('x', 502, 'http_502')) });
    expect((await runSyncJob(id, deps)).state).toBe('needs_review');
  });

  it('önceki çalıştırma POST sırasında kesildiyse (upload_started, iş kimliği yok) yeniden yükleme yok', async () => {
    const { store, canva, deps, id } = setup();
    Object.assign(store.jobs.get(id)!, { state: 'upload_started', uploadAttempts: 1 });
    expect((await runSyncJob(id, deps)).state).toBe('needs_review');
    expect(canva.createAssetUploadJob).not.toHaveBeenCalled();
  });

  it('yönetici "Canva\'da var" der: mevcut asset bağlanır, yükleme yapılmadan taşınır', async () => {
    const { store, canva, deps, id } = setup();
    Object.assign(store.jobs.get(id)!, { state: 'needs_review', contentSha256: SRC.sha256 });
    const j = await runSyncJob(id, deps, { type: 'link_existing', canvaAssetId: 'EXIST1' });
    expect(j.state).toBe('done');
    expect(j.canvaAssetId).toBe('EXIST1');
    expect(canva.createAssetUploadJob).not.toHaveBeenCalled();
    expect(canva.moveFolderItem).toHaveBeenCalledWith('EXIST1', 'FAF3jRI82Dk');
  });

  it('yönetici "yoksa yeniden yükle" der: açık komutla bir kez daha yüklenir', async () => {
    const { store, canva, deps, id } = setup();
    Object.assign(store.jobs.get(id)!, { state: 'needs_review', uploadAttempts: 1 });
    expect((await runSyncJob(id, deps, { type: 'reupload' })).state).toBe('done');
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
  });

  it('429 → yükleme yapılmadı, sonra yeniden denenir; bekleme süresi dolmadan denemez', async () => {
    let n = 0;
    const { canva, deps, id, store } = setup({
      create: async () => {
        n++;
        if (n === 1) throw new CanvaApiError('rl', 429, 'too_many_requests');
        return { id: 'J2', status: 'in_progress' };
      },
    });
    expect((await runSyncJob(id, deps)).state).toBe('pending');
    expect((await runSyncJob(id, deps)).state).toBe('pending'); // nextAttemptAt dolmadı
    store.jobs.get(id)!.nextAttemptAt = 0;
    expect((await runSyncJob(id, deps)).state).toBe('done');
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(2);
  });

  it('Canva işi failed → asset oluşmadı; sınırlı yeniden yükleme, file_too_big kalıcı', async () => {
    const { deps, id, store, canva } = setup({ poll: async () => ({ id: 'J1', status: 'failed', error: { code: 'import_failed' } }) });
    for (let i = 0; i < MAX_UPLOAD_ATTEMPTS + 2; i++) await runSyncJob(id, deps);
    expect(store.jobs.get(id)!.state).toBe('failed');
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(MAX_UPLOAD_ATTEMPTS);
    const big = setup({ poll: async () => ({ id: 'J1', status: 'failed', error: { code: 'file_too_big' } }) });
    expect((await runSyncJob(big.id, big.deps)).state).toBe('failed');
  });

  it('iş hâlâ işleniyorsa durum korunur; sonraki çalıştırma yalnız sorgular', async () => {
    let ready = false;
    const { canva, deps, id } = setup({ poll: async () => (ready ? { id: 'J1', status: 'success', assetId: 'CA9' } : { id: 'J1', status: 'in_progress' }) });
    const store = (deps as any).store;
    expect((await runSyncJob(id, deps)).state).toBe('upload_submitted');
    // kuyruğun önünü tıkamasın: hâlâ işleniyor → sıraya geri (POLL_RETRY_MS sonra)
    expect(store.jobs.get(id)!.nextAttemptAt).toBeGreaterThan(1_000);
    expect((await runSyncJob(id, deps)).state).toBe('upload_submitted'); // zamanı gelmeden sorgu yok
    expect(canva.getAssetUploadJob).toHaveBeenCalledTimes(3);
    store.jobs.set(id, { ...store.jobs.get(id)!, nextAttemptAt: 0 }); // süre geçti
    ready = true;
    expect((await runSyncJob(id, deps)).state).toBe('done');
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
  });

  it('taşıma hatası (item_in_multiple_folders/permission_denied) → move_failed; düzeltince YALNIZ taşıma denenir', async () => {
    let allow = false;
    const { canva, deps, id } = setup({
      move: async () => {
        if (!allow) throw new CanvaApiError('perm', 403, 'permission_denied');
      },
    });
    const j = await runSyncJob(id, deps);
    expect(j.state).toBe('move_failed');
    expect(j.lastError?.code).toBe('permission_denied');
    expect((await runSyncJob(id, deps)).state).toBe('move_failed'); // komutsuz tekrar denemez
    allow = true;
    expect((await runSyncJob(id, deps, { type: 'retry_move' })).state).toBe('done');
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
    expect(canva.moveFolderItem).toHaveBeenCalledTimes(2);
  });

  it('taşıma 5xx/yanıtsız → yükleme korunur, yalnız taşıma sonra yeniden denenir', async () => {
    let n = 0;
    const { canva, deps, id, store } = setup({
      move: async () => {
        if (n++ === 0) throw new CanvaApiError('x', null, 'no_response', true);
      },
    });
    expect((await runSyncJob(id, deps)).state).toBe('uploaded');
    store.jobs.get(id)!.nextAttemptAt = 0;
    expect((await runSyncJob(id, deps)).state).toBe('done');
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
  });

  it('desteklenmeyen kaynak (video, 50 MB ve üstü, HEIC) yüklenmez', async () => {
    for (const src of [
      { ...SRC, contentType: 'video/mp4' },
      { ...SRC, size: 50_000_000 },
      { ...SRC, contentType: 'image/heic' },
    ]) {
      const s = setup({ src });
      expect((await runSyncJob(s.id, s.deps)).state).toBe('unsupported');
      expect(s.canva.createAssetUploadJob).not.toHaveBeenCalled();
    }
  });

  it('eşleme klasörü yoksa yükleme biter, taşıma yapılmaz', async () => {
    const { canva, deps, id } = setup({ folder: null });
    expect((await runSyncJob(id, deps)).state).toBe('done');
    expect(canva.moveFolderItem).not.toHaveBeenCalled();
  });

  it('lease: başka çalıştırıcı işlerken ikinci çalıştırma yan etki yapmaz', async () => {
    const { store, canva, deps, id } = setup();
    Object.assign(store.jobs.get(id)!, { leaseOwner: 'other', leaseUntil: Number.MAX_SAFE_INTEGER });
    await runSyncJob(id, deps);
    expect(canva.createAssetUploadJob).not.toHaveBeenCalled();
    expect(deps.readSource).not.toHaveBeenCalled();
  });

  it('YARIŞ: aynı baytlı iki farklı Studio kaydı eşzamanlı çalışınca tek yükleme olur', async () => {
    const a = setup();
    let releaseUpload!: () => void;
    const gate = new Promise<void>((r) => (releaseUpload = r));
    a.canva.createAssetUploadJob.mockImplementation(async () => {
      await gate;
      return { id: 'J1', status: 'in_progress' };
    });
    const second = newSyncJob({ ...base, assetId: 'asset2' }, 900);
    a.store.jobs.set(second.id, second);
    const deps2 = { ...a.deps, owner: 'w2' };
    const p1 = runSyncJob(a.id, a.deps);
    const p2 = runSyncJob(second.id, deps2);
    await new Promise((r) => setTimeout(r, 0));
    releaseUpload();
    const [j1, j2] = await Promise.all([p1, p2]);
    expect(a.canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
    expect(j1.state).toBe('done');
    expect(j2.state).toBe('pending');
    expect(j2.lastError?.code).toBe('content_busy');
    // ilk iş bitince ikinci kayıt mevcut asset'i kullanır, yüklemez
    a.store.jobs.get(second.id)!.nextAttemptAt = 0;
    const j2b = await runSyncJob(second.id, deps2);
    expect(j2b.canvaAssetId).toBe('CA1');
    expect(a.canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
  });

  it('belirsiz yüklemede içerik rezervasyonu tutulur: aynı baytlı diğer kayıt da kör yükleme yapmaz', async () => {
    const a = setup({ create: async () => Promise.reject(new CanvaApiError('t', null, 'no_response', true)) });
    expect((await runSyncJob(a.id, a.deps)).state).toBe('needs_review');
    const second = newSyncJob({ ...base, assetId: 'asset2' }, 900);
    a.store.jobs.set(second.id, second);
    const j2 = await runSyncJob(second.id, { ...a.deps, owner: 'w2', now: () => Number.MAX_SAFE_INTEGER - 1 }); // süre çok geçse de
    expect(j2.lastError?.code).toBe('content_busy');
    expect(a.canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
  });

  it('kesin hata (4xx) rezervasyonu bırakır: aynı baytlı diğer kayıt yükleyebilir', async () => {
    let n = 0;
    const a = setup({
      create: async () => {
        if (n++ === 0) throw new CanvaApiError('bad', 400, 'invalid_field');
        return { id: 'J2', status: 'success', assetId: 'CA2' };
      },
    });
    expect((await runSyncJob(a.id, a.deps)).state).toBe('failed');
    const second = newSyncJob({ ...base, assetId: 'asset2' }, 900);
    a.store.jobs.set(second.id, second);
    expect((await runSyncJob(second.id, { ...a.deps, owner: 'w2' })).canvaAssetId).toBe('CA2');
  });
});
