/**
 * Sayfalı envanter — YEREL EMÜLATÖR (demo-*): gerçek Firestore Timestamp imleci, eşit createdAt ve 447 kayıt.
 * Çalıştırma: firebase emulators:exec --config <ports.json> --only firestore --project demo-planner-inv "node ./node_modules/vitest/vitest.mjs run tests/rules/plannerInventory.emulator.test.ts"
 */
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { listInventoryPage } from '@/api/_lib/plannerInventory/plannerInventory';

const HAS_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;
const T = 't1';
const P = 'p1';
const BUCKET = 'demo.appspot.com';
const HOST = 'firebasestorage.googleapis.com';
const POLICY = { buckets: [BUCKET], hosts: [HOST] };
let app: App;
let db: Firestore;

const asset = (id: string, createdMs: number | Timestamp, o: Record<string, any> = {}) => {
  const path = `brand-media/${T}/${P}/${id}/${id}.jpg`;
  return {
    tenantId: T, projectId: P, kind: 'photo', status: 'active', title: id, fileName: `${id}.jpg`, tags: [], createdBy: 'u', createdAt: typeof createdMs === 'number' ? Timestamp.fromMillis(createdMs) : createdMs,
    storage: { path, downloadUrl: `https://${HOST}/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=x`, contentType: 'image/jpeg', size: 1000, width: 1080, height: 1350 }, ...o,
  };
};
const makeCursorValue = (sec: number, nanos: number) => new Timestamp(sec, nanos);

describe.skipIf(!HAS_EMULATOR)('sayfalı envanter: gerçek Timestamp imleci', () => {
  beforeAll(() => { app = initializeApp({ projectId: 'demo-planner-inv' }, 'planner-inv-test'); db = getFirestore(app); });
  afterAll(async () => { await deleteApp(app); });
  beforeEach(async () => {
    const snap = await db.collection('brand_media').get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  });

  const pageAll = async (limit = 100) => {
    const pages: Awaited<ReturnType<typeof listInventoryPage>>[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 200; i++) {
      const r = await listInventoryPage(db, { tenantId: T, projectId: P, policy: POLICY, cursor, limit, makeCursorValue });
      pages.push(r);
      if (!r.nextCursor) return pages;
      cursor = r.nextCursor;
    }
    throw new Error('bitmedi');
  };

  it('447 kayıt eksiksiz ve yinelenmeden; yeni önce; son sayfa nextCursor null', async () => {
    const batch = db.batch();
    for (let i = 0; i < 447; i++) batch.set(db.doc(`brand_media/a${String(i).padStart(3, '0')}`), asset(`a${String(i).padStart(3, '0')}`, 1_000_000 + i * 1000));
    await batch.commit().catch(async () => { // 500 işlem sınırı altında; yine de yedek
      for (let i = 0; i < 447; i++) await db.doc(`brand_media/a${String(i).padStart(3, '0')}`).set(asset(`a${String(i).padStart(3, '0')}`, 1_000_000 + i * 1000));
    });
    const pages = await pageAll();
    expect(pages.map((p) => p.items.length)).toEqual([100, 100, 100, 100, 47]);
    const ids = pages.flatMap((p) => p.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(447);
    expect(ids[0]).toBe('a446');
    expect(ids.at(-1)).toBe('a000');
    expect(pages.at(-1)!.nextCursor).toBeNull();
  });

  it('EŞİT createdAt: kimlikle ayrıştırma; sayfa sınırı eşit kayıtların ortasına düşse bile kayıp/tekrar yok', async () => {
    const batch = db.batch();
    for (let i = 0; i < 230; i++) batch.set(db.doc(`brand_media/t${String(i).padStart(3, '0')}`), asset(`t${String(i).padStart(3, '0')}`, i < 120 ? 5_000_000 : 4_000_000));
    await batch.commit();
    const ids = (await pageAll(50)).flatMap((p) => p.items.map((i) => i.id));
    expect(ids).toHaveLength(230);
    expect(new Set(ids).size).toBe(230);
  });

  it('NANOSANİYE: gerçek epoch zamanında AYNI milisaniyenin farklı nanos değerleri ve aynı Timestamp\'te farklı kimlikler; her sayfa sınırında kayıp/tekrar yok', async () => {
    const SEC = 1_760_123_456; // gerçek epoch ölçeği (2025-10)
    const batch = db.batch();
    const expected: string[] = [];
    // 30 kayıt AYNI milisaniye içinde 30 farklı nanos (…000001..…000030 ns), 20 kayıt tamı tamına aynı Timestamp (kimlikle ayrışır), 10 kayıt sonraki saniye
    for (let i = 0; i < 30; i++) batch.set(db.doc(`brand_media/n${String(i).padStart(2, '0')}`), asset(`n${String(i).padStart(2, '0')}`, new Timestamp(SEC, 123_000_000 + i + 1)));
    for (let i = 0; i < 20; i++) batch.set(db.doc(`brand_media/e${String(i).padStart(2, '0')}`), asset(`e${String(i).padStart(2, '0')}`, new Timestamp(SEC, 123_000_500)));
    for (let i = 0; i < 10; i++) batch.set(db.doc(`brand_media/f${String(i).padStart(2, '0')}`), asset(`f${String(i).padStart(2, '0')}`, new Timestamp(SEC + 1, i)));
    await batch.commit();
    // Beklenen sıra: createdAt desc, id desc
    const rows = (await db.collection('brand_media').orderBy('createdAt', 'desc').orderBy('__name__', 'desc').get()).docs.map((d) => d.id);
    expected.push(...rows);
    expect(expected).toHaveLength(60);
    for (const limit of [1, 7, 10, 13, 25]) {
      const ids = (await pageAll(limit)).flatMap((p) => p.items.map((i) => i.id));
      expect(ids).toEqual(expected); // sıra, kayıp ve tekrar: birebir
    }
    // Eski (ms'e yuvarlayan) imleç davranışı bu veride kayıp/tekrar üretirdi: nanos farkı ms'e sığmaz
    const a = new Timestamp(SEC, 123_000_001);
    expect(Timestamp.fromMillis(a.toMillis()).isEqual(a)).toBe(false);
  });

  it('kapsam: başka proje/tenant ve arşivli kayıt sayfalarda hiç görünmez', async () => {
    for (let i = 0; i < 5; i++) await db.doc(`brand_media/c${i}`).set(asset(`c${i}`, 10_000 + i));
    await db.doc('brand_media/op').set(asset('op', 99_000, { projectId: 'p2' }));
    await db.doc('brand_media/ot').set(asset('ot', 98_000, { tenantId: 't2' }));
    await db.doc('brand_media/old').set(asset('old', 97_000, { status: 'archived' }));
    const ids = (await pageAll()).flatMap((p) => p.items.map((i) => i.id)).sort();
    expect(ids).toEqual(['c0', 'c1', 'c2', 'c3', 'c4']);
  });
});
