// @vitest-environment node
/**
 * Canva otomatik senkron — gerçek Firestore emülatörü + Admin SDK (gerçek Timestamp, gerçek sorgu biçimleri).
 * Çalıştırma: firebase emulators:exec --only firestore --project demo-canva-autosync "<node> ./node_modules/vitest/vitest.mjs run tests/rules/canvaAutoSync.emulator.test.ts"
 * Dış çağrı yok: Canva istemcisi sahte.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { randomBytes } from 'crypto';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = 'demo-canva-autosync';
const T = 't1';
const P = 'p1';
const SINCE_MS = 1_760_000_000_000;

let admin: typeof import('../../api/_lib/firebaseAdmin');
let auto: typeof import('../../api/_lib/canva/autoSync');
let stores: typeof import('../../api/_lib/canva/firestoreStores');
let Timestamp: any;

describe.skipIf(!HAS_EMULATOR)('Canva otomatik senkron (emülatör, gerçek Timestamp)', () => {
  beforeAll(async () => {
    process.env.FIREBASE_PROJECT_ID = PROJECT;
    process.env.GCLOUD_PROJECT = PROJECT;
    process.env.INTEGRATION_TOKEN_KEY = randomBytes(32).toString('base64');
    admin = await import('../../api/_lib/firebaseAdmin');
    auto = await import('../../api/_lib/canva/autoSync');
    stores = await import('../../api/_lib/canva/firestoreStores');
    Timestamp = (await import('firebase-admin/firestore')).Timestamp;
  });

  beforeEach(async () => {
    const db = admin.getAdminDb();
    for (const col of ['brand_media', stores.COL.secrets, stores.COL.mappings, stores.COL.jobs, stores.COL.contentIndex, auto.RECONCILE_CURSORS]) {
      const snap = await db.collection(col).get();
      await Promise.all(snap.docs.map((d: any) => d.ref.delete()));
    }
  });

  async function seed() {
    const db = admin.getAdminDb();
    const conn = await stores.saveConnection(db, { tenantId: T, uid: 'admin1', tokens: { accessToken: 'A', refreshToken: 'R', expiresAt: 9e15 }, now: SINCE_MS - 10 });
    await db.collection(stores.COL.mappings).doc(stores.mappingDocId(T, P)).set({
      tenantId: T, projectId: P, connectionId: conn.connectionId, canvaFolderId: 'FOLD1', toCanva: true, fromCanva: true,
      toCanvaSince: SINCE_MS, verifiedAt: SINCE_MS, createdBy: 'admin1', updatedAt: SINCE_MS,
    });
    const base = Math.floor(SINCE_MS / 1000) + 10;
    const docs: Array<[string, any]> = [];
    // 70 kayıt AYNI milisaniyede (5,000–5,069 ms), mikrosaniyeleri farklı (> pageSize 50)
    for (let i = 0; i < 70; i++) docs.push([`same-ms-${String(i).padStart(3, '0')}`, new Timestamp(base, 5_000_000 + i * 1_000)]);
    // 10 kayıt BİREBİR aynı Timestamp → yalnız belge kimliği ayırır
    for (let i = 0; i < 10; i++) docs.push([`tie-${i}`, new Timestamp(base, 6_123_456)]);
    // 50 kayıt farklı saniyelerde, kesirli ms
    for (let i = 0; i < 50; i++) docs.push([`later-${String(i).padStart(2, '0')}`, new Timestamp(base + 1 + i, 987_654_321)]);
    // eşleme öncesi eski medya (backfill yok)
    for (let i = 0; i < 3; i++) docs.push([`old-${i}`, new Timestamp(base - 100 - i, 1)]);
    const batch = db.batch();
    for (const [id, createdAt] of docs) {
      batch.set(db.collection('brand_media').doc(id), {
        tenantId: T, projectId: P, kind: 'photo', status: 'active', fileName: `${id}.jpg`, createdAt,
        storage: { path: `brand-media/${T}/${P}/${id}/${id}.jpg`, contentType: 'image/jpeg', size: 1234 },
      });
    }
    await batch.commit();
    return { db, conn };
  }

  const NOW = SINCE_MS + 10 * 86_400_000;
  const tv = (ms: number) => Timestamp.fromMillis(ms);

  it('aynı ms\'de >pageSize kayıt + birebir eşit Timestamp: cursor ilerler, 130 kaydın hepsi kuyruğa girer', async () => {
    const { db } = await seed();
    const r = await auto.reconcileRecentAssets(db, { featureEnabled: true, now: NOW, pageSize: 50, timeValue: tv });
    expect(r.scanned).toBe(130);
    expect(r.queued).toBe(130);
    const jobs = await db.collection(stores.COL.jobs).get();
    expect(jobs.size).toBe(130);
    expect(jobs.docs.some((d: any) => d.data().assetId.startsWith('old-'))).toBe(false);
    const cur = (await db.collection(auto.RECONCILE_CURSORS).doc(stores.mappingDocId(T, P)).get()).data();
    expect(cur.assetId).toBe('later-49');
    expect(cur.createdAt).toBeInstanceOf(Timestamp);
    // Firestore mikrosaniye saklar: cursor saklanan HAM değerle birebir aynı, ms'ye yuvarlanmamış
    const last = (await db.collection('brand_media').doc('later-49').get()).data().createdAt;
    expect(cur.createdAt.isEqual(last)).toBe(true);
    expect(cur.createdAt.nanoseconds).toBe(987_654_000);
    expect(cur.createdAt.nanoseconds % 1_000_000).not.toBe(0);
    // ikinci tur: cursor'dan sonra kayıt yok
    expect((await auto.reconcileRecentAssets(db, { featureEnabled: true, now: NOW, pageSize: 50, timeValue: tv })).scanned).toBe(0);
  });

  it('bütçe ile bölünmüş taramada (her turda 1 sayfa) aynı-ms grubunun ortasından sürer, tekrar/kayıp yok', async () => {
    const { db } = await seed();
    let total = 0;
    const seen: number[] = [];
    for (let run = 0; run < 6; run++) {
      let ticks = 0;
      const r = await auto.reconcileRecentAssets(db, { featureEnabled: true, now: NOW, pageSize: 50, timeValue: tv, clock: () => ticks++, deadline: 2 });
      seen.push(r.scanned);
      total += r.scanned;
    }
    expect(seen).toEqual([50, 50, 30, 0, 0, 0]);
    expect(total).toBe(130);
    expect((await db.collection(stores.COL.jobs).get()).size).toBe(130);
  });

  it('işçi: gerçek in+aralık+sıralı sayfalı kuyruk sorgusu tüm işleri bitirir; ikinci tur boş', async () => {
    const { db } = await seed();
    await auto.reconcileRecentAssets(db, { featureEnabled: true, now: NOW, pageSize: 50, timeValue: tv });
    let n = 0;
    const canva = {
      createAssetUploadJob: vi.fn(async () => ({ id: `J${n}`, status: 'success' as const, assetId: `CA${n++}` })),
      getAssetUploadJob: vi.fn(async () => ({ id: 'J', status: 'success' as const, assetId: 'CA' })),
      moveFolderItem: vi.fn(async () => undefined),
    };
    const clock = { v: NOW };
    const deps = {
      canvaFor: () => canva,
      readSourceFor: async (a: any) => ({ bytes: Buffer.from(a.id), sha256: Buffer.from(a.id).toString('hex').padEnd(64, '0').slice(0, 64), contentType: 'image/jpeg', size: 1234 }),
      owner: 'w1',
      now: () => clock.v,
      sleep: async () => undefined,
    };
    const out = await auto.processDueJobs(db, deps, { featureEnabled: true, limit: 500, pageSize: 25 });
    expect(out.states).toEqual({ done: 130 });
    expect(canva.createAssetUploadJob).toHaveBeenCalledTimes(130);
    expect(canva.moveFolderItem).toHaveBeenCalledTimes(130);
    expect((await auto.processDueJobs(db, deps, { featureEnabled: true })).considered).toBe(0);
  }, 120_000);
});
