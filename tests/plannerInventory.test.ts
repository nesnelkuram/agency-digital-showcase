// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeFirestore } from './helpers/fakeFirestore';
import { listInventoryPage, decodeCursor, encodeCursor, PAGE_MAX, InventoryError } from '@/api/_lib/plannerInventory/plannerInventory';
import { saveCorrection, ANALYSES, ANALYSIS_LATEST } from '@/api/_lib/mediaAnalysis/correctionStore';
import { seedAsset, POLICY, T, P } from './feedPlanner/integration/liveFixtures';
import { bundle } from './planner/helpers';
import { BRAND_VOICE_COLLECTION, brandVoiceDocId } from '@/api/_lib/planCopy/planCopy';

async function pageAll(db: any, over: Record<string, unknown> = {}) {
  const pages: any[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 50; i++) {
    const r: any = await listInventoryPage(db, { tenantId: T, projectId: P, policy: POLICY, cursor, ...over });
    pages.push(r);
    if (!r.nextCursor) return pages;
    cursor = r.nextCursor;
  }
  throw new Error('sayfalama bitmedi');
}

describe('sayfalı katalog: 200 sınırı sessiz kırpma değil', () => {
  it('447 kayıt 100\'lük sayfalarla EKSİKSİZ ve yinelenmeden gelir; yeni önce; son sayfada nextCursor null', async () => {
    const db = fakeFirestore();
    for (let i = 0; i < 447; i++) seedAsset(db, `a${String(i).padStart(3, '0')}`, { createdAt: 1000 + i });
    const pages = await pageAll(db);
    expect(pages.map((p) => p.items.length)).toEqual([100, 100, 100, 100, 47]);
    const ids = pages.flatMap((p) => p.items.map((i: any) => i.id));
    expect(ids).toHaveLength(447);
    expect(new Set(ids).size).toBe(447);
    expect(ids[0]).toBe('a446');
    expect(ids[446]).toBe('a000');
    expect(pages.at(-1).nextCursor).toBeNull();
    expect(pages.slice(0, -1).every((p) => typeof p.nextCursor === 'string')).toBe(true);
  });

  it('AYNI createdAt (eşitlik): kimlikle ayrıştırılır, hiçbir kayıt kaybolmaz veya tekrarlanmaz', async () => {
    const db = fakeFirestore();
    for (let i = 0; i < 230; i++) seedAsset(db, `t${String(i).padStart(3, '0')}`, { createdAt: i < 120 ? 5000 : 4000 });
    const ids = (await pageAll(db, { limit: 50 })).flatMap((p) => p.items.map((i: any) => i.id));
    expect(ids).toHaveLength(230);
    expect(new Set(ids).size).toBe(230);
  });

  it('tam sayfa katları: 200 kayıt 2 sayfa (boş üçüncü sayfa yok); limit sınırlanır', async () => {
    const db = fakeFirestore();
    for (let i = 0; i < 200; i++) seedAsset(db, `b${i}`, { createdAt: i + 1 });
    const pages = await pageAll(db);
    expect(pages.map((p) => p.items.length)).toEqual([100, 100]);
    expect(pages[1].nextCursor).toBeNull();
    const big = await listInventoryPage(db, { tenantId: T, projectId: P, policy: POLICY, limit: 5000 });
    expect(big.items).toHaveLength(PAGE_MAX);
    expect(big.pageSize).toBe(PAGE_MAX);
  });

  it('kapsam: başka proje/tenant ve arşivli medya gelmez; depolama tutarsız kayıt NEDENLE raporlanır (sessiz değil)', async () => {
    const db = fakeFirestore();
    for (let i = 0; i < 5; i++) seedAsset(db, `c${i}`, { createdAt: 10 + i });
    seedAsset(db, 'other-project', { projectId: 'p2', createdAt: 99 });
    seedAsset(db, 'other-tenant', { tenantId: 't2', createdAt: 98 });
    seedAsset(db, 'old', { status: 'archived', createdAt: 97 });
    seedAsset(db, 'bad', { createdAt: 96 });
    const bad = db.data.get('brand_media/bad');
    db.data.set('brand_media/bad', { ...bad, storage: { ...bad.storage, path: 'brand-media/t1/p1/bad/' } });
    const [pg] = await pageAll(db);
    expect(pg.items.map((i: any) => i.id).sort()).toEqual(['c0', 'c1', 'c2', 'c3', 'c4']);
    expect(pg.excluded).toEqual([{ id: 'bad', reason: 'inconsistent_asset' }]);
  });

  it('kayıt biçimi: indirme URL\'si/token YOK; Storage yolu, katalog, doğrulanmış ürün ve kullanım sayaçları var', async () => {
    const db = fakeFirestore();
    seedAsset(db, 'm1', { createdAt: 10 });
    seedAsset(db, 'm2', { createdAt: 9 });
    db.data.set(`${ANALYSIS_LATEST}/${T}_${P}_m1`, { key: 'k1' });
    db.data.set(`${ANALYSES}/k1`, { tenantId: T, projectId: P, sourceId: 'm1', status: 'done', sourceQuality: 'original', result: { subject: 'masa', description: 'd', tags: ['masa'], visibleObjects: [], foodCategories: ['makarna'], composition: { shotType: 'yakın_çekim', orientation: 'dikey', hasTextOverlay: false, subjectPlacement: 'sol', negativeSpace: true }, productIdentity: { status: 'belirsiz', note: '' }, usageSuggestions: [], peoplePresent: false, uncertainties: [], planningNotes: [], overallConfidence: 'orta' } });
    await saveCorrection(db, { tenantId: T, projectId: P, assetId: 'm1', input: { verifiedProductIds: ['the-ghosting'] }, uid: 'u', now: 1 });
    db.data.set('social_media_posts/p1', { tenantId: T, projectId: P, status: 'approved', libraryAssetIds: ['m1'] });
    db.data.set('social_media_posts/p2', { tenantId: T, projectId: P, status: 'internal_review', libraryAssetIds: ['m1', 'm2'] });
    db.data.set('social_media_posts/p3', { tenantId: 't2', projectId: P, status: 'approved', libraryAssetIds: ['m1'] });
    const [pg] = await pageAll(db);
    const m1 = pg.items.find((i: any) => i.id === 'm1');
    expect(m1).toMatchObject({ path: `brand-media/${T}/${P}/m1/m1.jpg`, width: 1080, height: 1350, verifiedProductIds: ['the-ghosting'], usage: { usedInPostCount: 2, approvedUseCount: 1, pendingUseCount: 1 }, catalog: { subject: 'masa', shotType: 'yakın_çekim', subjectPlacement: 'sol' } });
    expect(m1.readiness).toMatchObject({ static: 'ok', story: 'ok' });
    expect(JSON.stringify(pg)).not.toMatch(/downloadUrl|token=|alt=media|https:\/\//);
    expect(pg.items.find((i: any) => i.id === 'm2')).toMatchObject({ catalog: null, verifiedProductIds: [], usage: { usedInPostCount: 1 } });
  });

  it('imleç ve limit doğrulaması: bozuk imleç/limit kontrollü hata (fırlatma değil 400)', async () => {
    const db = fakeFirestore();
    seedAsset(db, 'x1');
    for (const cursor of ['###', 'e30', Buffer.from('{"s":"x","n":0,"i":"a"}').toString('base64url'), Buffer.from('{"s":1,"n":0,"i":"../x"}').toString('base64url'), Buffer.from('{"s":1,"n":1000000000,"i":"a"}').toString('base64url'), Buffer.from('{"s":1,"n":-1,"i":"a"}').toString('base64url'), Buffer.from('{"s":1.5,"n":0,"i":"a"}').toString('base64url'), Buffer.from('{"c":1,"i":"a"}').toString('base64url')]) {
      await expect(listInventoryPage(db, { tenantId: T, projectId: P, policy: POLICY, cursor })).rejects.toMatchObject({ status: 400, code: 'bad_cursor' });
    }
    for (const limit of [0, -1, 1.5, 'x']) await expect(listInventoryPage(db, { tenantId: T, projectId: P, policy: POLICY, limit })).rejects.toBeInstanceOf(InventoryError);
    expect(decodeCursor(encodeCursor(1_760_000_000, 123_456_789, 'abc'))).toEqual({ sec: 1_760_000_000, nanos: 123_456_789, id: 'abc' });
  });
});

// ── uç noktalar ──
const authUser: { current: any } = { current: null };
vi.mock('@/api/_lib/withAuth', () => ({ withAuth: (h: any) => (r: any, s: any) => h(Object.assign(r, authUser.current), s) }));
const endpointDb: { current: any } = { current: null };
vi.mock('@/api/_lib/firebaseAdmin', () => ({ getAdminDb: () => endpointDb.current }));
import inventoryHandler from '@/api/studio/planner-inventory';
import voiceHandler from '@/api/studio/brand-voice';
const res = () => {
  const r: any = { statusCode: 0, body: null, headers: {} };
  r.setHeader = (k: string, v: string) => ((r.headers[k] = v), r);
  r.status = (s: number) => ((r.statusCode = s), r);
  r.json = (b: any) => ((r.body = b), r);
  return r;
};
const callH = async (h: any, method: string, o: any) => { const r = res(); await h({ method, body: method === 'PUT' ? o : undefined, query: method === 'GET' ? o : {} }, r); return r; };

describe('uç noktalar: planner-inventory ve brand-voice', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    const d = fakeFirestore();
    seedAsset(d, 'e1', { createdAt: 5 });
    d.data.set('projects/p1', { tenantId: 't1' });
    for (const [u, role, extra] of [['admin1', 'admin', {}], ['client1', 'client', { profile: { assignedProjectIds: ['p1'] } }], ['fl1', 'freelancer', { profile: { assignedProjectIds: ['p1'] } }], ['bm1', 'brand_manager', { profile: { assignedProjectIds: ['p1'] } }], ['bm2', 'brand_manager', { profile: { assignedProjectIds: ['p2'] } }], ['staff1', 'staff', {}]] as const) d.data.set(`users/${u}`, { tenantId: 't1', role, ...extra });
    d.data.set('users/other', { tenantId: 't2', role: 'admin' });
    endpointDb.current = d;
    authUser.current = { userId: 'admin1', userUid: 'admin1', tenantId: 't1', userRole: 'admin' };
    process.env.FIREBASE_STORAGE_BUCKET = POLICY.buckets[0];
  });
  const restore = () => { process.env = { ...saved }; };

  it('envanter: erişim kümesi kütüphane rolleri; sayfa döner; kötü imleç 400; yöntem 405', async () => {
    const ok = await callH(inventoryHandler, 'GET', { projectId: 'p1' });
    expect(ok).toMatchObject({ statusCode: 200, body: { nextCursor: null, items: [{ id: 'e1' }] } });
    expect((await callH(inventoryHandler, 'GET', { projectId: 'p1', cursor: '###' })).statusCode).toBe(400);
    expect((await callH(inventoryHandler, 'GET', { projectId: 'p1', limit: '0' })).statusCode).toBe(400);
    expect((await callH(inventoryHandler, 'PUT', { projectId: 'p1' })).statusCode).toBe(405);
    for (const [uid, tenant] of [['client1', 't1'], ['fl1', 't1'], ['bm2', 't1'], ['other', 't2']]) {
      authUser.current = { userId: uid, userUid: uid, tenantId: tenant, userRole: 'x' };
      expect((await callH(inventoryHandler, 'GET', { projectId: 'p1' })).statusCode, uid).toBe(403);
    }
    authUser.current = { userId: 'bm1', userUid: 'bm1', tenantId: 't1', userRole: 'brand_manager' };
    expect((await callH(inventoryHandler, 'GET', { projectId: 'p1' })).statusCode).toBe(200);
    restore();
  });

  it('marka sesi: yalnız yönetici yükler; geçersiz/yabancı hesaplı paket 422 ve saklanmaz; durum rehber METNİ döndürmez', async () => {
    const put = (b: any) => callH(voiceHandler, 'PUT', { projectId: 'p1', bundle: b });
    authUser.current = { userId: 'staff1', userUid: 'staff1', tenantId: 't1', userRole: 'staff' };
    expect((await put(bundle())).statusCode).toBe(403); // staff kütüphane rolü ama yönetici değil
    authUser.current = { userId: 'admin1', userUid: 'admin1', tenantId: 't1', userRole: 'admin' };
    const foreign = bundle({ captions: [{ ...bundle().captions[0], owner: 'idfineporcelain' }] });
    expect(await put(foreign)).toMatchObject({ statusCode: 422, body: { code: 'bundle_invalid' } });
    expect(await put(null)).toMatchObject({ statusCode: 422 });
    expect(endpointDb.current.data.has(`${BRAND_VOICE_COLLECTION}/${brandVoiceDocId(T, P)}`)).toBe(false);
    expect((await callH(voiceHandler, 'GET', { projectId: 'p1' })).body).toEqual({ exists: false });
    const ok = await put(bundle());
    expect(ok).toMatchObject({ statusCode: 200, body: { ok: true, captionCount: 2 } });
    const st = (await callH(voiceHandler, 'GET', { projectId: 'p1' })).body;
    expect(st).toMatchObject({ exists: true, valid: true, account: 'diecimoda', captionCount: 2 });
    expect(JSON.stringify(st)).not.toMatch(/Dieci sesi üzerine|Dil rehberi metni/);
    // marka-dışı kullanıcı durumu göremez
    authUser.current = { userId: 'other', userUid: 'other', tenantId: 't2', userRole: 'admin' };
    expect((await callH(voiceHandler, 'GET', { projectId: 'p1' })).statusCode).toBe(403);
    restore();
  });
});
