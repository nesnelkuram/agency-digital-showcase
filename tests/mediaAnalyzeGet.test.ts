// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { bundle } from './planner/helpers';

const authUser: { current: any } = { current: null };
vi.mock('@/api/_lib/withAuth', () => ({
  withAuth: (h: any) => (req: any, res: any) => h(Object.assign(req, authUser.current), res),
}));

const docs: Record<string, any> = {};
const reads: string[] = [];
const failReads = new Set<string>();
const writes = { set: vi.fn(), update: vi.fn(), delete: vi.fn(), txn: vi.fn() };
const fakeDb = {
  collection: (c: string) => ({
    doc: (id: string) => ({
      get: async () => {
        reads.push(`${c}/${id}`);
        if (failReads.has(c)) throw new Error(`okuma hatası ${c}`);
        return { exists: `${c}/${id}` in docs, data: () => docs[`${c}/${id}`] };
      },
      set: (...a: any[]) => writes.set(...a),
      update: (...a: any[]) => writes.update(...a),
      delete: (...a: any[]) => writes.delete(...a),
    }),
  }),
  runTransaction: (...a: any[]) => writes.txn(...a),
};
const storage = vi.fn(async () => ({}));
vi.mock('@/api/_lib/firebaseAdmin', () => ({ getAdminDb: () => fakeDb, getAdminStorage: () => storage() }));
const fetchSpy = vi.fn();
vi.stubGlobal('fetch', fetchSpy);

import analyzeHandler from '@/api/media/analyze';

function res() {
  const r: any = { statusCode: 0, body: null, headers: {} };
  r.setHeader = (k: string, v: string) => ((r.headers[k] = v), r);
  r.status = (s: number) => ((r.statusCode = s), r);
  r.json = (b: any) => ((r.body = b), r);
  return r;
}
const as = (uid: string, role: string, tenantId = 't1') => (authUser.current = { userId: uid, userUid: uid, tenantId, userRole: role });
const get = async (assetId = 'a1', projectId = 'p1') => {
  const r = res();
  await analyzeHandler({ method: 'GET', query: { projectId, assetId } } as any, r);
  return r;
};
const NOW = 1_760_000_000_000;
const job = (over: any = {}) => ({ id: 't1_p1_a1', tenantId: 't1', projectId: 'p1', assetId: 'a1', state: 'pending', attempts: 0, nextAttemptAt: NOW - 1000, createdAt: NOW - 5000, updatedAt: NOW - 4000, ...over });
const analysisRec = (over: any = {}) => ({ key: 'k1', tenantId: 't1', projectId: 'p1', sourceId: 'a1', status: 'done', model: 'claude-haiku-5-5', promptVersion: 'media-catalog-v2', sourceQuality: 'original', createdAt: NOW - 100, updatedAt: NOW - 50,
  result: { subject: 'AI konu', description: 'AI açıklaması', tags: ['a'], composition: { shotType: 'yakın_çekim' }, uncertainties: [] }, ...over });
const seedAnalysis = (rec = analysisRec()) => {
  docs['media_ai_analysis_latest/t1_p1_a1'] = { key: rec.key };
  docs[`media_ai_analyses/${rec.key}`] = rec;
};
const forbiddenReads = /^(media_ai_queue|media_ai_analysis_latest|media_ai_analyses|media_catalog_corrections|brand_voice_context)\//;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  for (const k of Object.keys(docs)) delete docs[k];
  reads.length = 0;
  failReads.clear();
  Object.values(writes).forEach((f) => f.mockReset());
  fetchSpy.mockReset();
  storage.mockClear();
  docs['projects/p1'] = { tenantId: 't1' };
  docs['users/admin1'] = { tenantId: 't1', role: 'admin' };
  docs['users/client1'] = { tenantId: 't1', role: 'client', profile: { assignedProjectIds: ['p1'] } };
  docs['users/fl1'] = { tenantId: 't1', role: 'freelancer', profile: { assignedProjectIds: ['p1'] } };
  docs['brand_media/a1'] = { tenantId: 't1', projectId: 'p1', kind: 'photo', status: 'active', storage: {} };
  as('admin1', 'admin');
  delete process.env.MEDIA_AI_ANALYSIS_ENABLED;
});
afterEach(() => {
  vi.useRealTimers();
});
const noSideEffects = () => {
  expect(writes.set).not.toHaveBeenCalled();
  expect(writes.update).not.toHaveBeenCalled();
  expect(writes.delete).not.toHaveBeenCalled();
  expect(writes.txn).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(storage).not.toHaveBeenCalled();
};

describe('GET /api/media/analyze: yetki ve aidiyet metadata okumasından ÖNCE', () => {
  it('müşteri ve freelancer: 403; kuyruk/analiz/düzeltme/paket belgelerinden HİÇBİRİ okunmaz', async () => {
    for (const [uid, role] of [['client1', 'client'], ['fl1', 'freelancer']]) {
      as(uid, role);
      const r = await get();
      expect(r.statusCode).toBe(403);
    }
    expect(reads.filter((x) => forbiddenReads.test(x) || x.startsWith('brand_media/'))).toEqual([]);
    noSideEffects();
  });

  it('başka marka/tenant varlığı: 404; kuyruk, analiz, düzeltme ve ürün paketi ASLA okunmaz (sızıntı yok)', async () => {
    docs['brand_media/a9'] = { tenantId: 't1', projectId: 'p-other', kind: 'photo', status: 'active', storage: {} };
    docs['brand_media/a8'] = { tenantId: 'tX', projectId: 'p1', kind: 'photo', status: 'active', storage: {} };
    for (const id of ['a9', 'a8', 'yok']) {
      const r = await get(id);
      expect(r.statusCode).toBe(404);
      expect(JSON.stringify(r.body)).not.toMatch(/queue|analysis|correction/);
    }
    expect(reads.filter((x) => forbiddenReads.test(x))).toEqual([]);
    noSideEffects();
  });

  it('geçersiz assetId 400', async () => {
    expect((await get('../x')).statusCode).toBe(400);
    noSideEffects();
  });
});

describe('kuyruk durumu (gerçek veri; yalnız okuma)', () => {
  it('PENDING kuyruk işi var ama analiz kaydı YOK: analysis null, job pending — "kayıt yok" ile karışmaz', async () => {
    docs['media_ai_queue/t1_p1_a1'] = job({ state: 'pending', attempts: 0 });
    const r = await get();
    expect(r.statusCode).toBe(200);
    expect(r.body.analysis).toBeNull();
    expect(r.body.queue).toMatchObject({ state: 'ok', job: { state: 'pending', attempts: 0, maxAttempts: 3, leaseActive: false } });
    expect(r.body.scope).toEqual({ tenantId: 't1', projectId: 'p1', assetId: 'a1' });
    expect(r.body.serverNow).toBe(NOW);
    noSideEffects();
  });

  it('lease: geçerli lease → leaseActive true; süresi dolmuş → false; iç alan (leaseOwner) dönmez', async () => {
    docs['media_ai_queue/t1_p1_a1'] = job({ attempts: 1, leaseOwner: 'req:uid9:123', leaseUntil: NOW + 60_000 });
    let r = await get();
    expect(r.body.queue.job).toMatchObject({ state: 'pending', leaseActive: true, leaseUntil: NOW + 60_000, attempts: 1 });
    expect(JSON.stringify(r.body)).not.toMatch(/req:uid9|leaseOwner/);
    docs['media_ai_queue/t1_p1_a1'] = job({ attempts: 1, leaseOwner: 'req:uid9:123', leaseUntil: NOW - 1 });
    r = await get();
    expect(r.body.queue.job.leaseActive).toBe(false);
    noSideEffects();
  });

  it('failed / skipped / done ve son hata aynen taşınır', async () => {
    docs['media_ai_queue/t1_p1_a1'] = job({ state: 'failed', attempts: 3, lastError: { code: 'http_529', message: 'Model meşgul' } });
    let r = await get();
    expect(r.body.queue.job).toMatchObject({ state: 'failed', attempts: 3, lastError: { code: 'http_529', message: 'Model meşgul' } });
    docs['media_ai_queue/t1_p1_a1'] = job({ state: 'skipped', lastError: { code: 'not_active_photo', message: 'Varlık analize uygun değil' } });
    r = await get();
    expect(r.body.queue.job).toMatchObject({ state: 'skipped', lastError: { code: 'not_active_photo' } });
    docs['media_ai_queue/t1_p1_a1'] = job({ state: 'done', analysisKey: 'k1' });
    r = await get();
    expect(r.body.queue.job).toMatchObject({ state: 'done', analysisKey: 'k1' });
    noSideEffects();
  });

  it('kuyruk işi YOK: state ok + job null (kesin "iş yok"); başka kapsamın belgesi iş sayılmaz', async () => {
    let r = await get();
    expect(r.body.queue).toEqual({ state: 'ok', job: null });
    docs['media_ai_queue/t1_p1_a1'] = job({ tenantId: 'tX' });
    r = await get();
    expect(r.body.queue).toEqual({ state: 'ok', job: null });
  });

  it('kuyruk OKUMA HATASI: GET yine 200; queue "unavailable" — "iş yok" DENMEZ; diğer veriler gelir', async () => {
    seedAnalysis();
    failReads.add('media_ai_queue');
    const r = await get();
    expect(r.statusCode).toBe(200);
    expect(r.body.queue).toEqual({ state: 'unavailable' });
    expect(r.body.analysis.status).toBe('done');
    noSideEffects();
  });

  it('analiz kayıtları başka kapsama aitse görmezden gelinir', async () => {
    seedAnalysis(analysisRec({ tenantId: 'tX' }));
    const r = await get();
    expect(r.body.analysis).toBeNull();
  });
});

describe('insan düzeltmesi: AI yokken de görünür, alan seçimli', () => {
  const corr = (over: any = {}) => ({ tenantId: 't1', projectId: 'p1', assetId: 'a1', overrides: { subject: 'İnsan konusu', description: 'İnsan açıklaması' }, verifiedProductIds: [], note: 'Şef doğruladı', basedOnAnalysisKey: 'k0', correctedBy: 'uid-gizli', correctedAt: NOW - 777, ...over });

  it('AI analizi YOK: insan subject/description/not/tarih döner; effective.catalog null KALIR (uydurma katalog yok); correctedBy sızmaz', async () => {
    docs['media_catalog_corrections/t1_p1_a1'] = corr();
    const r = await get();
    expect(r.body.analysis).toBeNull();
    expect(r.body.correction).toEqual({ state: 'ok', value: { overrides: { subject: 'İnsan konusu', description: 'İnsan açıklaması' }, verifiedProductIds: [], note: 'Şef doğruladı', correctedAt: NOW - 777 } });
    expect(r.body.effective.catalog).toBeNull();
    expect(r.body.effective.sources).toMatchObject({ subject: 'human', description: 'human' });
    expect(JSON.stringify(r.body)).not.toMatch(/uid-gizli|correctedBy|basedOnAnalysisKey/);
    noSideEffects();
  });

  it('AI + insan: etkin katalogta İNSAN değeri kazanır; ham AI sonucu analysis içinde ezilmeden durur', async () => {
    seedAnalysis();
    docs['media_catalog_corrections/t1_p1_a1'] = corr();
    const r = await get();
    expect(r.body.effective.catalog).toMatchObject({ subject: 'İnsan konusu', description: 'İnsan açıklaması', tags: ['a'] });
    expect(r.body.analysis.result).toMatchObject({ subject: 'AI konu', description: 'AI açıklaması' });
    expect(r.body.effective.sources.subject).toBe('human');
    expect(r.body.effective.sources.tags).toBeUndefined();
    noSideEffects();
  });

  it('düzeltme yok: value null (kesin); düzeltme OKUMA HATASI: unavailable ve effective null (insanı gizleyen sahte etkin katalog yok)', async () => {
    seedAnalysis();
    let r = await get();
    expect(r.body.correction).toEqual({ state: 'ok', value: null });
    failReads.add('media_catalog_corrections');
    r = await get();
    expect(r.statusCode).toBe(200);
    expect(r.body.correction).toEqual({ state: 'unavailable' });
    expect(r.body.effective).toBeNull();
    expect(r.body.analysis.status).toBe('done');
  });

  it('bozuk/yabancı alanlar süzülür: tip dışı değerler ve kimlik biçimi dışı ürün kimlikleri atılır', async () => {
    docs['media_catalog_corrections/t1_p1_a1'] = corr({ overrides: { subject: 5, description: '  ', tags: ['x', 3, ''], peoplePresent: 'evet', extra: 'sızmasın', shotType: 'yakın_çekim' }, verifiedProductIds: ['ok-1', '../kötü', 7] });
    const r = await get();
    expect(r.body.correction.value.overrides).toEqual({ tags: ['x'], shotType: 'yakın_çekim' });
    expect(r.body.correction.value.verifiedProductIds).toEqual(['ok-1']);
  });
});

describe('doğrulanmış ürün adları (yalnız bu tenant+projenin geçerli paketinden)', () => {
  const withProducts = (ids: string[]) => (docs['media_catalog_corrections/t1_p1_a1'] = { tenantId: 't1', projectId: 'p1', assetId: 'a1', overrides: {}, verifiedProductIds: ids, correctedAt: NOW });
  const seedBundle = (over: any = {}) => (docs['brand_voice_context/t1_p1'] = { tenantId: 't1', projectId: 'p1', bundle: bundle(), updatedBy: 'admin1', updatedAt: 1, ...over });

  it('doğru adı çözer; paketteki İSTENMEYEN ürün adı yanıta girmez', async () => {
    withProducts(['lovebombing']);
    seedBundle();
    const r = await get();
    expect(r.body.products).toEqual({ state: 'bundle', items: [{ id: 'lovebombing', name: 'Lovebombing' }] });
    expect(JSON.stringify(r.body)).not.toMatch(/The Ghosting/);
    noSideEffects();
  });

  it('pakette olmayan kimlik: name null (ad tahmin EDİLMEZ); diğeri çözülür', async () => {
    withProducts(['lovebombing', 'bilinmeyen-urun']);
    seedBundle();
    const r = await get();
    expect(r.body.products.items).toEqual([{ id: 'lovebombing', name: 'Lovebombing' }, { id: 'bilinmeyen-urun', name: null }]);
  });

  it('BAŞKA marka/tenant paketi: ad çözülmez (no_bundle); sızıntı yok', async () => {
    withProducts(['lovebombing']);
    docs['brand_voice_context/t1_p1'] = { tenantId: 'tX', projectId: 'p1', bundle: bundle() };
    let r = await get();
    expect(r.body.products).toEqual({ state: 'no_bundle', items: [{ id: 'lovebombing', name: null }] });
    docs['brand_voice_context/t1_p1'] = { tenantId: 't1', projectId: 'p-other', bundle: bundle() };
    r = await get();
    expect(r.body.products.state).toBe('no_bundle');
    expect(JSON.stringify(r.body)).not.toMatch(/Lovebombing/);
    expect(reads).not.toContain('brand_voice_context/tX_p1');
  });

  it('paket yok → no_bundle; GEÇERSİZ (onaysız/bozuk) paket → invalid_bundle ve adlar gösterilmez', async () => {
    withProducts(['lovebombing']);
    let r = await get();
    expect(r.body.products).toEqual({ state: 'no_bundle', items: [{ id: 'lovebombing', name: null }] });
    seedBundle({ bundle: { ...bundle(), guideHashes: { ...bundle().guideHashes, persona: 'a'.repeat(64) } } });
    r = await get();
    expect(r.body.products).toEqual({ state: 'invalid_bundle', items: [{ id: 'lovebombing', name: null }] });
    expect(JSON.stringify(r.body)).not.toMatch(/Lovebombing/);
  });

  it('paket OKUMA HATASI: unavailable + name null; GET çökmez', async () => {
    withProducts(['lovebombing']);
    seedBundle();
    failReads.add('brand_voice_context');
    const r = await get();
    expect(r.statusCode).toBe(200);
    expect(r.body.products).toEqual({ state: 'unavailable', items: [{ id: 'lovebombing', name: null }] });
  });

  it('doğrulanmış ürün yoksa paket HİÇ okunmaz', async () => {
    withProducts([]);
    seedBundle();
    const r = await get();
    expect(r.body.products).toEqual({ state: 'none', items: [] });
    expect(reads.some((x) => x.startsWith('brand_voice_context/'))).toBe(false);
  });
});

describe('GET yolu salt okunur', () => {
  it('her durumda (analiz kapalı/açık, kuyruk, düzeltme, paket) sıfır yazma, sıfır işlem, sıfır model/Canva/dış çağrı', async () => {
    seedAnalysis();
    docs['media_ai_queue/t1_p1_a1'] = job({ state: 'pending' });
    docs['media_catalog_corrections/t1_p1_a1'] = { tenantId: 't1', projectId: 'p1', assetId: 'a1', overrides: { subject: 'x' }, verifiedProductIds: ['lovebombing'], correctedAt: NOW };
    docs['brand_voice_context/t1_p1'] = { tenantId: 't1', projectId: 'p1', bundle: bundle() };
    for (const flag of [undefined, 'true']) {
      if (flag) process.env.MEDIA_AI_ANALYSIS_ENABLED = flag;
      const r = await get();
      expect(r.statusCode).toBe(200);
    }
    noSideEffects();
  });
});
