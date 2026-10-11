// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomBytes } from 'crypto';
import { fakeFirestore } from './helpers/fakeFirestore';
import { decideAutoEnqueue, enqueueForAsset, processDueJobs, reconcileRecentAssets, RECONCILE_CURSORS, SETTLE_MS, type AutoSyncAsset } from '@/api/_lib/canva/autoSync';
import { COL, getAccessToken, mappingDocId, saveConnection, secretDocId } from '@/api/_lib/canva/firestoreStores';
import { AUTH_UNAVAILABLE, CanvaApiError, CanvaClient, type CanvaUploadJob } from '@/api/_lib/canva/client';
import { newSyncJob, syncJobId, type CanvaOps, type SourceFile } from '@/api/_lib/canva/syncEngine';

const T = 't1';
const P = 'p1';
const MAP_SINCE = 1_000;

beforeEach(() => {
  process.env.INTEGRATION_TOKEN_KEY = randomBytes(32).toString('base64');
});

async function world(opts: { mapping?: Partial<any> | null; connected?: boolean } = {}) {
  const db = fakeFirestore();
  const conn = await saveConnection(db, { tenantId: T, uid: 'admin1', tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 9e15 }, now: 500 });
  if (opts.connected === false) db.data.set(`${COL.secrets}/${secretDocId(T)}`, { ...db.data.get(`${COL.secrets}/${secretDocId(T)}`), status: 'reauth_required' });
  if (opts.mapping !== null) {
    db.data.set(`${COL.mappings}/${mappingDocId(T, P)}`, {
      tenantId: T, projectId: P, connectionId: conn.connectionId, canvaFolderId: 'FAF3jRI82Dk', toCanva: true, fromCanva: true, toCanvaSince: MAP_SINCE, verifiedAt: MAP_SINCE, createdBy: 'admin1', updatedAt: MAP_SINCE,
      ...(opts.mapping || {}),
    });
  }
  return { db, conn };
}

const addAsset = (db: any, id: string, over: Record<string, any> = {}) =>
  db.data.set(`brand_media/${id}`, {
    tenantId: T, projectId: P, kind: 'photo', status: 'active', fileName: `${id}.jpg`, createdAt: 2_000,
    storage: { path: `brand-media/${T}/${P}/${id}/${id}.jpg`, contentType: 'image/jpeg', size: 1234 },
    ...over,
  });

function canvaMock(over: Partial<Record<keyof CanvaOps, any>> = {}) {
  return {
    createAssetUploadJob: vi.fn<CanvaOps['createAssetUploadJob']>(over.createAssetUploadJob || (async (): Promise<CanvaUploadJob> => ({ id: 'J1', status: 'in_progress' }))),
    getAssetUploadJob: vi.fn<CanvaOps['getAssetUploadJob']>(over.getAssetUploadJob || (async (): Promise<CanvaUploadJob> => ({ id: 'J1', status: 'success', assetId: 'CA1' }))),
    moveFolderItem: vi.fn<CanvaOps['moveFolderItem']>(over.moveFolderItem || (async () => undefined)),
  };
}
const BYTES = (tag: string): SourceFile => ({ bytes: Buffer.from(tag), sha256: tag.padEnd(64, '0'), contentType: 'image/jpeg', size: 1234 });
const deps = (canva: any, readSourceFor = vi.fn(async (a: AutoSyncAsset) => BYTES(a.id)), t = { v: 10_000 }) => ({
  canvaFor: vi.fn(() => canva),
  readSourceFor,
  owner: 'worker1',
  now: () => t.v,
  sleep: async () => undefined,
  maxPolls: 2,
});

describe('otomatik kuyruk kararı (saf)', () => {
  const base = {
    featureEnabled: true,
    conn: { status: 'connected' as const, connectionId: 'c1', tenantId: T },
    mapping: { tenantId: T, projectId: P, connectionId: 'c1', toCanva: true, toCanvaSince: 1000 },
    asset: { id: 'a', tenantId: T, projectId: P, kind: 'photo', status: 'active', createdAtMs: 2000, storage: { path: 'x', contentType: 'image/jpeg', size: 10 } },
    tenantId: T,
    projectId: P,
  };
  it('tüm koşullar sağlanınca kabul; her koşul ayrı ayrı reddeder', () => {
    expect(decideAutoEnqueue(base)).toEqual({ ok: true });
    const cases: Array<[any, string]> = [
      [{ featureEnabled: false }, 'feature_disabled'],
      [{ conn: null }, 'not_connected'],
      [{ conn: { ...base.conn, status: 'reauth_required' } }, 'not_connected'],
      [{ mapping: null }, 'no_mapping'],
      [{ mapping: { ...base.mapping, toCanva: false } }, 'no_mapping'],
      [{ mapping: { ...base.mapping, projectId: 'p2' } }, 'mapping_mismatch'],
      [{ mapping: { ...base.mapping, connectionId: 'c0' } }, 'mapping_stale_connection'],
      [{ asset: { ...base.asset, tenantId: 't2' } }, 'asset_mismatch'],
      [{ asset: { ...base.asset, kind: 'video' } }, 'not_active_photo'],
      [{ asset: { ...base.asset, status: 'archived' } }, 'not_active_photo'],
      [{ asset: { ...base.asset, storage: { ...base.asset.storage, contentType: 'image/heic' } } }, 'unsupported_media'],
      [{ asset: { ...base.asset, storage: { ...base.asset.storage, size: 50_000_000 } } }, 'unsupported_media'],
      [{ asset: { ...base.asset, createdAtMs: 999 } }, 'before_mapping_no_backfill'],
      [{ mapping: { ...base.mapping, toCanvaSince: null } }, 'before_mapping_no_backfill'],
    ];
    for (const [over, reason] of cases) expect(decideAutoEnqueue({ ...base, ...over })).toEqual({ ok: false, reason });
  });
});

describe('upload-complete → kalıcı iş', () => {
  it('yinelenen bildirim tek iş açar (deterministik kimlik)', async () => {
    const { db, conn } = await world();
    addAsset(db, 'a1');
    const r1 = await enqueueForAsset(db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: true, now: 3000 });
    const r2 = await enqueueForAsset(db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: true, now: 4000 });
    expect(r1.queued && r2.queued).toBe(true);
    const jobs = [...db.data.keys()].filter((k) => k.startsWith(`${COL.jobs}/`));
    expect(jobs).toEqual([`${COL.jobs}/${syncJobId({ tenantId: T, projectId: P, connectionId: conn.connectionId, assetId: 'a1' })}`]);
  });

  it('özellik kapalı / eşleme yok / bağlantı yok: iş açılmaz', async () => {
    const off = await world();
    addAsset(off.db, 'a1');
    expect(await enqueueForAsset(off.db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: false, now: 3000 })).toEqual({ queued: false, reason: 'feature_disabled' });
    const nomap = await world({ mapping: null });
    addAsset(nomap.db, 'a1');
    expect((await enqueueForAsset(nomap.db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: true, now: 3000 })) as any).toMatchObject({ queued: false, reason: 'no_mapping' });
    const disc = await world({ connected: false });
    addAsset(disc.db, 'a1');
    expect((await enqueueForAsset(disc.db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: true, now: 3000 })) as any).toMatchObject({ queued: false, reason: 'not_connected' });
  });
});

describe('kalıcı işçi (cron) — kurtarma ve ilerletme', () => {
  it('sayfa kapandı (bildirim yok): uzlaştırma yeni fotoğrafa iş açar, işçi Canva klasörüne kadar götürür', async () => {
    const { db } = await world();
    addAsset(db, 'a1');
    const rec = await reconcileRecentAssets(db, { featureEnabled: true, now: 5000 });
    expect(rec.queued).toBe(1);
    const canva = canvaMock();
    const out = await processDueJobs(db, deps(canva), { featureEnabled: true });
    expect(out.states).toEqual({ done: 1 });
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
    expect(canva.moveFolderItem).toHaveBeenCalledWith('CA1', 'FAF3jRI82Dk');
  });

  it('backfill yok: eşleme öncesi yüklenen eski medya kuyruğa alınmaz', async () => {
    const { db } = await world();
    addAsset(db, 'old', { createdAt: 900 });
    addAsset(db, 'new', { createdAt: 1500 });
    const rec = await reconcileRecentAssets(db, { featureEnabled: true, now: 5000 });
    expect(rec.queued).toBe(1);
    expect([...db.data.values()].filter((v: any) => v?.assetId).map((v: any) => v.assetId)).toEqual(['new']);
  });

  it('başka tenant/projenin medyası bu eşlemeyle kuyruğa girmez', async () => {
    const { db } = await world();
    addAsset(db, 'x1', { tenantId: 't2' });
    addAsset(db, 'x2', { projectId: 'p2' });
    expect((await reconcileRecentAssets(db, { featureEnabled: true, now: 5000 })).queued).toBe(0);
  });

  it('geçici ağ hatası (sorgulama): durum korunur, sonraki çalıştırma tamamlar, yeniden yükleme yok', async () => {
    const { db } = await world();
    addAsset(db, 'a1');
    await reconcileRecentAssets(db, { featureEnabled: true, now: 5000 });
    let n = 0;
    const canva = canvaMock({
      getAssetUploadJob: async () => {
        if (n++ === 0) throw new CanvaApiError('net', null, 'no_response', true);
        return { id: 'J1', status: 'success', assetId: 'CA1' };
      },
    });
    const t = { v: 10_000 };
    expect((await processDueJobs(db, deps(canva, undefined, t), { featureEnabled: true })).states).toEqual({ upload_submitted: 1 });
    // hemen sonraki çalıştırmada zamanı gelmemiş: sorguya girmez (önü tıkamaz)
    expect((await processDueJobs(db, deps(canva, undefined, t), { featureEnabled: true })).considered).toBe(0);
    t.v += 60_000;
    expect((await processDueJobs(db, deps(canva, undefined, t), { featureEnabled: true })).states).toEqual({ done: 1 });
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
  });

  it('dayanıklı kurtarma: istek ortasında kesilen iş (lease süresi geçmiş, upload_submitted) işçide sürer', async () => {
    const { db, conn } = await world();
    addAsset(db, 'a1');
    await enqueueForAsset(db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: true, now: 3000 });
    const id = syncJobId({ tenantId: T, projectId: P, connectionId: conn.connectionId, assetId: 'a1' });
    db.data.set(`${COL.jobs}/${id}`, { ...db.data.get(`${COL.jobs}/${id}`), state: 'upload_submitted', canvaUploadJobId: 'J9', contentSha256: 'a1'.padEnd(64, '0'), uploadAttempts: 1, leaseOwner: 'dead-request', leaseUntil: 1 });
    const canva = canvaMock({ getAssetUploadJob: async () => ({ id: 'J9', status: 'success', assetId: 'CA9' }) });
    expect((await processDueJobs(db, deps(canva), { featureEnabled: true })).states).toEqual({ done: 1 });
    expect(canva.createAssetUploadJob).not.toHaveBeenCalled();
  });

  it('POST sırasında ölen iş (upload_started, lease süresi geçmiş) işçide toparlanır → needs_review, KÖR YÜKLEME YOK', async () => {
    const { db, conn } = await world();
    addAsset(db, 'a1');
    await enqueueForAsset(db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: true, now: 3000 });
    const id = syncJobId({ tenantId: T, projectId: P, connectionId: conn.connectionId, assetId: 'a1' });
    const sha = 'a1'.padEnd(64, '0');
    db.data.set(`${COL.jobs}/${id}`, { ...db.data.get(`${COL.jobs}/${id}`), state: 'upload_started', contentSha256: sha, uploadAttempts: 1, leaseOwner: 'dead', leaseUntil: 1 });
    const canva = canvaMock();
    const d = deps(canva);
    const out = await processDueJobs(db, d, { featureEnabled: true });
    expect(out.states).toEqual({ needs_review: 1 });
    expect(out.skipped).toEqual({ recovered_upload_started: 1 });
    expect(canva.createAssetUploadJob).not.toHaveBeenCalled();
    expect(d.readSourceFor).not.toHaveBeenCalled();
    expect(db.data.get(`${COL.jobs}/${id}`).lastError.code).toBe('upload_interrupted');
  });

  it('lease\'i CANLI upload_started/moving işine işçi dokunmaz', async () => {
    const { db, conn } = await world();
    addAsset(db, 'a1');
    await enqueueForAsset(db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: true, now: 3000 });
    const id = syncJobId({ tenantId: T, projectId: P, connectionId: conn.connectionId, assetId: 'a1' });
    db.data.set(`${COL.jobs}/${id}`, { ...db.data.get(`${COL.jobs}/${id}`), state: 'moving', canvaAssetId: 'CA1', moveAttempts: 1, leaseOwner: 'live', leaseUntil: 999_999 });
    const canva = canvaMock();
    const out = await processDueJobs(db, deps(canva), { featureEnabled: true });
    expect(out.skipped).toEqual({ leased: 1 });
    expect(canva.moveFolderItem).not.toHaveBeenCalled();
    expect(db.data.get(`${COL.jobs}/${id}`).state).toBe('moving');
  });

  it('taşıma sırasında ölen iş (moving, lease süresi geçmiş) yalnız taşımayı tekrarlar — yükleme yok', async () => {
    const { db, conn } = await world();
    addAsset(db, 'a1');
    await enqueueForAsset(db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: true, now: 3000 });
    const id = syncJobId({ tenantId: T, projectId: P, connectionId: conn.connectionId, assetId: 'a1' });
    db.data.set(`${COL.jobs}/${id}`, { ...db.data.get(`${COL.jobs}/${id}`), state: 'moving', canvaAssetId: 'CA7', contentSha256: 'x'.padEnd(64, '0'), uploadAttempts: 1, moveAttempts: 1, leaseOwner: 'dead', leaseUntil: 1 });
    const canva = canvaMock();
    const d = deps(canva);
    const out = await processDueJobs(db, d, { featureEnabled: true });
    expect(out.states).toEqual({ done: 1 });
    expect(out.skipped).toEqual({ recovered_moving: 1 });
    expect(canva.moveFolderItem).toHaveBeenCalledWith('CA7', 'FAF3jRI82Dk');
    expect(canva.createAssetUploadJob).not.toHaveBeenCalled();
    expect(canva.getAssetUploadJob).not.toHaveBeenCalled();
    expect(d.readSourceFor).not.toHaveBeenCalled();
  });

  it('eşzamanlı iki işçi + aynı baytlı iki yeni fotoğraf → tek Canva yüklemesi', async () => {
    const { db } = await world();
    addAsset(db, 'a1');
    addAsset(db, 'a2');
    await reconcileRecentAssets(db, { featureEnabled: true, now: 5000 });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const canva = canvaMock({
      createAssetUploadJob: async () => {
        await gate;
        return { id: 'J1', status: 'in_progress' };
      },
    });
    const same = vi.fn(async () => BYTES('same'));
    const w1 = processDueJobs(db, { ...deps(canva, same), owner: 'w1' }, { featureEnabled: true });
    const w2 = processDueJobs(db, { ...deps(canva, same), owner: 'w2' }, { featureEnabled: true });
    await new Promise((r) => setTimeout(r, 0));
    release();
    await Promise.all([w1, w2]);
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
  });

  it('yeniden bağlanma (yeni connectionId) veya eşleme kapatma sonrası eski işler işlenmez; dış çağrı yok', async () => {
    const { db } = await world();
    addAsset(db, 'a1');
    await reconcileRecentAssets(db, { featureEnabled: true, now: 5000 });
    await saveConnection(db, { tenantId: T, uid: 'admin1', tokens: { accessToken: 'A2', refreshToken: 'R2', expiresAt: 9e15 }, now: 7000 });
    const canva = canvaMock();
    const d = deps(canva);
    const out = await processDueJobs(db, d, { featureEnabled: true });
    expect(out.skipped).toEqual({ connection_changed: 1 });
    expect(d.canvaFor).not.toHaveBeenCalled();
    // eşleme de eski bağlantıda kaldığı için yeni iş açılmaz
    expect((await reconcileRecentAssets(db, { featureEnabled: true, now: 8000 })).skipped).toEqual({ mapping_stale_connection: 1 });
  });

  it('özellik kapalı: uzlaştırma ve işçi hiçbir şey yapmaz', async () => {
    const { db } = await world();
    addAsset(db, 'a1');
    expect((await reconcileRecentAssets(db, { featureEnabled: false, now: 5000 })).queued).toBe(0);
    const canva = canvaMock();
    const d = deps(canva);
    expect((await processDueJobs(db, d, { featureEnabled: false })).considered).toBe(0);
    expect(d.canvaFor).not.toHaveBeenCalled();
  });

  it('token alınamadı (istek gönderilmedi) → belirsiz DEĞİL: pending, sonra yeniden denenir', async () => {
    const { db } = await world();
    addAsset(db, 'a1');
    await reconcileRecentAssets(db, { featureEnabled: true, now: 5000 });
    let n = 0;
    const canva = canvaMock({
      createAssetUploadJob: async () => {
        if (n++ === 0) throw new CanvaApiError('token yok', null, AUTH_UNAVAILABLE, false);
        return { id: 'J1', status: 'success', assetId: 'CA1' };
      },
    });
    const t = { v: 10_000 };
    expect((await processDueJobs(db, deps(canva, undefined, t), { featureEnabled: true })).states).toEqual({ pending: 1 });
    expect((await processDueJobs(db, deps(canva, undefined, t), { featureEnabled: true })).considered).toBe(0); // zamanı gelmedi
    t.v += 120_000;
    expect((await processDueJobs(db, deps(canva, undefined, t), { featureEnabled: true })).states).toEqual({ done: 1 });
  });

  it('Studio dosyası okunamazsa sınırlı yeniden deneme, sonra failed', async () => {
    const { db } = await world();
    addAsset(db, 'a1');
    await reconcileRecentAssets(db, { featureEnabled: true, now: 5000 });
    const canva = canvaMock();
    const t = { v: 10_000 };
    const broken = vi.fn(async () => {
      throw new Error('storage unavailable');
    });
    const states: string[] = [];
    for (let i = 0; i < 4; i++) {
      t.v += 1_000_000;
      const o = await processDueJobs(db, deps(canva, broken as any, t), { featureEnabled: true });
      states.push(Object.keys(o.states)[0] || 'none');
    }
    expect(states).toEqual(['pending', 'pending', 'failed', 'none']);
    expect(canva.createAssetUploadJob).not.toHaveBeenCalled();
  });
});

describe('regresyon: kalıcı cursor, süre bütçesi, açlık ve doğrulama', () => {
  const BIG_NOW = 10_000_000;

  it('iki cron arasında 130 yükleme: cursor sayfa sayfa ilerler, hiçbiri kaçmaz; eski medya hariç', async () => {
    const { db } = await world();
    for (let i = 0; i < 5; i++) addAsset(db, `old${i}`, { createdAt: 500 + i }); // eşleme öncesi
    for (let i = 0; i < 130; i++) addAsset(db, `n${String(i).padStart(3, '0')}`, { createdAt: 2_000 + i });
    const r = await reconcileRecentAssets(db, { featureEnabled: true, now: BIG_NOW, pageSize: 50 });
    expect(r.queued).toBe(130);
    expect(r.scanned).toBe(130);
    const ids = [...db.data.values()].filter((v: any) => v?.assetId && v?.state).map((v: any) => v.assetId);
    expect(ids.some((x: string) => x.startsWith('old'))).toBe(false);
    expect(db.data.get(`${RECONCILE_CURSORS}/${mappingDocId(T, P)}`)).toMatchObject({ assetId: 'n129', createdAtMs: 2129 });
  });

  it('süre bütçesi dolunca durur, sonraki çalıştırma cursor\'dan sürer (aynı kayıtlar yeniden taranmaz)', async () => {
    const { db } = await world();
    for (let i = 0; i < 120; i++) addAsset(db, `n${String(i).padStart(3, '0')}`, { createdAt: 2_000 + i });
    let ticks = 0;
    const clock = () => ticks++; // her kontrol 1 birim
    const r1 = await reconcileRecentAssets(db, { featureEnabled: true, now: BIG_NOW, pageSize: 50, clock, deadline: 2 });
    expect(r1.budgetExhausted).toBe(true);
    expect(r1.scanned).toBe(50);
    const r2 = await reconcileRecentAssets(db, { featureEnabled: true, now: BIG_NOW, pageSize: 50 });
    expect(r2.scanned).toBe(70); // yalnız kalanlar
    expect(r1.queued + r2.queued).toBe(120);
  });

  it('yeni (henüz oturmamış) kayıtlar işlenir ama cursor onların ötesine geçmez', async () => {
    const { db } = await world();
    addAsset(db, 'a1', { createdAt: 2_000 });
    addAsset(db, 'a2', { createdAt: BIG_NOW - 1_000 }); // SETTLE_MS içinde
    const r = await reconcileRecentAssets(db, { featureEnabled: true, now: BIG_NOW });
    expect(r.queued).toBe(2);
    expect(db.data.get(`${RECONCILE_CURSORS}/${mappingDocId(T, P)}`)).toMatchObject({ assetId: 'a1' });
    // sonraki tur a2'yi yeniden görür (idempotent, tek iş)
    const r2 = await reconcileRecentAssets(db, { featureEnabled: true, now: BIG_NOW + SETTLE_MS * 2 });
    expect(r2.scanned).toBe(1);
    expect([...db.data.keys()].filter((k) => k.startsWith(`${COL.jobs}/`))).toHaveLength(2);
  });

  it('eşleme since değişirse eski cursor geçersiz sayılır (yeni since\'den başlar)', async () => {
    const { db } = await world();
    for (let i = 0; i < 3; i++) addAsset(db, `n${i}`, { createdAt: 2_000 + i });
    await reconcileRecentAssets(db, { featureEnabled: true, now: BIG_NOW });
    const key = `${COL.mappings}/${mappingDocId(T, P)}`;
    db.data.set(key, { ...db.data.get(key), toCanvaSince: 2_001 });
    const r = await reconcileRecentAssets(db, { featureEnabled: true, now: BIG_NOW });
    expect(r.scanned).toBe(2); // n1, n2 (n0 since öncesi)
  });

  it('kuyruğa alma hatası olan kaydın ötesine cursor geçmez', async () => {
    const { db } = await world();
    for (let i = 0; i < 3; i++) addAsset(db, `n${i}`, { createdAt: 2_000 + i });
    const realCreate = db.runTransaction;
    let n = 0;
    (db as any).runTransaction = async (fn: any) => {
      if (n++ === 1) throw new Error('firestore unavailable');
      return realCreate(fn);
    };
    const r = await reconcileRecentAssets(db, { featureEnabled: true, now: BIG_NOW });
    expect(r.skipped.enqueue_error).toBe(1);
    expect(db.data.get(`${RECONCILE_CURSORS}/${mappingDocId(T, P)}`)).toMatchObject({ assetId: 'n0' });
    (db as any).runTransaction = realCreate;
    const r2 = await reconcileRecentAssets(db, { featureEnabled: true, now: BIG_NOW });
    expect(r2.scanned).toBe(2);
    expect([...db.data.keys()].filter((k) => k.startsWith(`${COL.jobs}/`))).toHaveLength(3);
  });

  it('açlık yok: önde 30 ertelenecek iş (eşleme kapalı proje) arkadaki geçerli işi bekletmez; ertelenenler arkaya gider', async () => {
    const { db, conn } = await world();
    // p2: eşleme yok → bu işler mapping_changed olur
    for (let i = 0; i < 30; i++) {
      const j = newSyncJob({ tenantId: T, projectId: 'p2', connectionId: conn.connectionId, assetId: `s${i}`, fileName: 'x.jpg', canvaFolderId: 'F2' }, 100 + i);
      db.data.set(`${COL.jobs}/${j.id}`, j);
      addAsset(db, `s${i}`, { projectId: 'p2' });
    }
    addAsset(db, 'good');
    await enqueueForAsset(db, { tenantId: T, projectId: P, assetId: 'good', featureEnabled: true, now: 5_000 });
    const canva = canvaMock();
    const out = await processDueJobs(db, deps(canva), { featureEnabled: true, pageSize: 25, limit: 25 });
    expect(out.skipped.mapping_changed).toBe(30);
    expect(out.states).toEqual({ done: 1 });
    // ertelenenler sonraki turda sorguya girmez
    expect((await processDueJobs(db, deps(canva), { featureEnabled: true })).considered).toBe(0);
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(1);
  });

  it('işçi doğrulaması: eşleme belgesinin tenant/proje alanı işle uyuşmazsa ve medya arşivliyse aktarım yok', async () => {
    const { db } = await world();
    addAsset(db, 'a1');
    addAsset(db, 'a2');
    await reconcileRecentAssets(db, { featureEnabled: true, now: 5_000 });
    // a2 arşivlendi
    db.data.set('brand_media/a2', { ...db.data.get('brand_media/a2'), status: 'archived' });
    // eşleme belgesi içeriği başka projeyi gösteriyor
    const key = `${COL.mappings}/${mappingDocId(T, P)}`;
    const canva = canvaMock();
    const d = deps(canva);
    let out = await processDueJobs(db, d, { featureEnabled: true });
    expect(out.skipped.asset_not_active).toBe(1);
    expect(out.states).toEqual({ done: 1 });
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(1);

    const { db: db2 } = await world();
    addAsset(db2, 'b1');
    await reconcileRecentAssets(db2, { featureEnabled: true, now: 5_000 });
    db2.data.set(key, { ...db2.data.get(key), projectId: 'p-other' });
    const canva2 = canvaMock();
    const d2 = deps(canva2);
    out = await processDueJobs(db2, d2, { featureEnabled: true });
    expect(out.skipped).toEqual({ mapping_changed: 1 });
    expect(d2.canvaFor).not.toHaveBeenCalled();
  });

  it('bağlantı değişince: bekleyen iş failed, Canva\'ya gitmiş olabilecek iş needs_review', async () => {
    const { db, conn } = await world();
    addAsset(db, 'a1');
    addAsset(db, 'a2');
    await reconcileRecentAssets(db, { featureEnabled: true, now: 5_000 });
    const id2 = syncJobId({ tenantId: T, projectId: P, connectionId: conn.connectionId, assetId: 'a2' });
    db.data.set(`${COL.jobs}/${id2}`, { ...db.data.get(`${COL.jobs}/${id2}`), state: 'upload_submitted', canvaUploadJobId: 'J2' });
    await saveConnection(db, { tenantId: T, uid: 'admin1', tokens: { accessToken: 'A2', refreshToken: 'R2', expiresAt: 9e15 }, now: 7000 });
    const canva = canvaMock();
    const d = deps(canva);
    await processDueJobs(db, d, { featureEnabled: true });
    const id1 = syncJobId({ tenantId: T, projectId: P, connectionId: conn.connectionId, assetId: 'a1' });
    expect(db.data.get(`${COL.jobs}/${id1}`).state).toBe('failed');
    expect(db.data.get(`${COL.jobs}/${id2}`).state).toBe('needs_review');
    expect(d.canvaFor).not.toHaveBeenCalled();
  });
});

describe('bağlantı izolasyonu: doğrulama ile token alma arasında yeniden OAuth', () => {
  const reconnect = (db: any) => saveConnection(db, { tenantId: T, uid: 'admin2', tokens: { accessToken: 'NEW', refreshToken: 'NR', expiresAt: 9e15 }, now: 8000 });

  async function raceRun(pinned: boolean, stage: 'pending' | 'uploaded') {
    const { db, conn } = await world();
    addAsset(db, 'a1');
    await enqueueForAsset(db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: true, now: 3000 });
    const id = syncJobId({ tenantId: T, projectId: P, connectionId: conn.connectionId, assetId: 'a1' });
    if (stage === 'uploaded') db.data.set(`${COL.jobs}/${id}`, { ...db.data.get(`${COL.jobs}/${id}`), state: 'uploaded', canvaAssetId: 'CA1', contentSha256: 'a1'.padEnd(64, '0'), uploadAttempts: 1 });
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ job: { id: 'J1', status: 'success', asset: { id: 'CA1' } } }) }));
    const tokens: string[] = [];
    const out = await processDueJobs(
      db,
      {
        canvaFor: (tenantId, connectionId) => {
          void reconnect(db); // işçi doğrulamasından SONRA, token alınmadan ÖNCE
          return new CanvaClient(async () => {
            await new Promise((r) => setTimeout(r, 0));
            const t = await getAccessToken(db, tenantId, { clientId: 'c', clientSecret: 's', fetchImpl: vi.fn(), ...(pinned ? { expectedConnectionId: connectionId } : {}) });
            tokens.push(t);
            return t;
          }, fetchImpl as any);
        },
        readSourceFor: async (a) => BYTES(a.id),
        owner: 'w1',
        now: () => 10_000,
        sleep: async () => undefined,
      },
      { featureEnabled: true }
    );
    return { db, id, out, fetchImpl, tokens };
  }

  it('yükleme: sabitlenmiş connectionId ile Canva çağrısı 0, yeni hesabın token\'ı kullanılmaz', async () => {
    const r = await raceRun(true, 'pending');
    expect(r.fetchImpl).not.toHaveBeenCalled();
    expect(r.tokens).toEqual([]);
    const j = r.db.data.get(`${COL.jobs}/${r.id}`);
    expect(j.state).toBe('pending'); // istek gönderilmedi → belirsiz değil
    expect(j.lastError.code).toBe(AUTH_UNAVAILABLE);
    // sonraki tur bağlantı değişikliğini görür ve işi sonlandırır (yine dış çağrı yok)
    r.db.data.set(`${COL.jobs}/${r.id}`, { ...j, nextAttemptAt: 0 });
    const f2 = vi.fn();
    const out2 = await processDueJobs(r.db, { canvaFor: f2 as any, readSourceFor: async () => BYTES('x'), owner: 'w2', now: () => 20_000 }, { featureEnabled: true });
    expect(out2.skipped).toEqual({ connection_changed: 1 });
    expect(f2).not.toHaveBeenCalled();
    expect(r.db.data.get(`${COL.jobs}/${r.id}`).state).toBe('failed');
  });

  it('taşıma: sabitlenmiş connectionId ile move çağrısı 0', async () => {
    const r = await raceRun(true, 'uploaded');
    expect(r.fetchImpl).not.toHaveBeenCalled();
    expect(r.db.data.get(`${COL.jobs}/${r.id}`).state).toBe('uploaded');
  });

  it('kontrol: sabitleme OLMADAN aynı yarışta yeni hesabın token\'ıyla aktarım gider (testin yakaladığı açık)', async () => {
    const r = await raceRun(false, 'pending');
    expect(r.tokens).toContain('NEW');
    expect(r.fetchImpl).toHaveBeenCalled();
  });

  it('getAccessToken: beklenen connectionId eşleşmezse connection_changed; eşleşirse token', async () => {
    const { db, conn } = await world();
    await expect(getAccessToken(db, T, { clientId: 'c', clientSecret: 's', fetchImpl: vi.fn(), expectedConnectionId: 'other' })).rejects.toMatchObject({ code: 'connection_changed' });
    await expect(getAccessToken(db, T, { clientId: 'c', clientSecret: 's', fetchImpl: vi.fn(), expectedConnectionId: conn.connectionId })).resolves.toBe('A');
  });
});
