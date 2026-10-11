// @vitest-environment node
/**
 * Yükleme → AI kataloglama (Haiku, sahte) → insan düzeltmesi → haftalık TASLAK önerisi (Sonnet, sahte).
 * Gerçek model/dış servis çağrısı YOK.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fakeFirestore } from './helpers/fakeFirestore';
import { effectiveCatalog, type ImageCatalog } from '@/api/_lib/mediaAnalysis/spec';
import { CORRECTIONS, loadEffectiveCatalog, saveCorrection } from '@/api/_lib/mediaAnalysis/correctionStore';
import {
  ANALYSIS_QUEUE,
  CRON_MAX_DURATION_S,
  QUEUE_LEASE_MS,
  WORK_START_DEADLINE_MS,
  enqueueAnalysis,
  processAnalysisQueue,
  queueJobId,
  reconcileNewMedia,
  parseActivationSince,
} from '@/api/_lib/mediaAnalysis/autoQueue';
import { ANALYSIS_LEASE_MS, firestoreAnalysisStore, type BrandMediaLike, type ModelCall } from '@/api/_lib/mediaAnalysis/runner';
import { CATALOG_TIMEOUT_MS } from '@/api/_lib/mediaAnalysis/anthropicCall';
import { PLAN_TIMEOUT_MS } from '@/api/_lib/planSuggest/anthropicPlanCall';
import { buildInventory, suggestWeeklyPlan, validateSuggestion, PLAN_MODEL, type PlanModelCall } from '@/api/_lib/planSuggest/planSuggest';
import { notifyUploadComplete } from '@/studio/mediaIntegrationsApi';
import { addSuggestionsAsDrafts } from '@/studio/components/PlanSuggestPanel';

const T = 't1';
const P = 'p1';
const BUCKET = 'demo.appspot.com';
const HOST = 'firebasestorage.googleapis.com';
const POLICY = { buckets: [BUCKET], hosts: [HOST] };
const url = (path: string) => `https://${HOST}/v0/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media&token=x`;

function addAsset(db: any, id: string, over: Record<string, any> = {}) {
  const tenantId = over.tenantId ?? T;
  const projectId = over.projectId ?? P;
  const path = `brand-media/${tenantId}/${projectId}/${id}/${id}.jpg`;
  const kind = over.kind ?? 'photo';
  db.data.set(`brand_media/${id}`, {
    tenantId, projectId, kind, status: 'active', title: id, fileName: `${id}.jpg`, tags: [], createdBy: 'u1', createdAt: 2_000,
    storage: { path, downloadUrl: url(path), contentType: kind === 'video' ? 'video/mp4' : 'image/jpeg', size: 500_000, width: 1080, height: 1350, ...(kind === 'video' ? { duration: 20, width: 1080, height: 1920 } : {}) },
    ...over,
  });
}

const CATALOG: ImageCatalog = {
  subject: 'masada tatlı tabağı',
  description: 'Beyaz tabakta bir dilim tatlı.',
  tags: ['tatlı', 'masa'],
  visibleObjects: ['tabak'],
  foodCategories: ['tatlı'],
  composition: { shotType: 'yakın_çekim', orientation: 'dikey', hasTextOverlay: false, subjectPlacement: 'merkez', negativeSpace: true },
  productIdentity: { status: 'genel_kategori', note: 'tatlı türü belirsiz' },
  usageSuggestions: ['feed', 'story'],
  peoplePresent: false,
  uncertainties: [],
  planningNotes: [],
  overallConfidence: 'orta',
};

const haiku = (catalog: ImageCatalog = CATALOG) =>
  vi.fn<ModelCall>(async () => ({ id: 'msg', stopReason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 }, parsed: catalog }));

const workerDeps = (db: any, callModel: ModelCall, t = { v: 10_000 }) => ({
  owner: 'w1',
  now: () => t.v,
  analysisDeps: (_a: BrandMediaLike) => ({ store: firestoreAnalysisStore(db), readBytes: async (p: string) => Buffer.from(p), callModel, now: () => t.v }),
});

describe('insan katalog düzeltmesi otoritedir', () => {
  it('etkin katalog: insan alanları AI\'yı ezer; AI yoksa uydurma katalog kurulmaz', () => {
    const e = effectiveCatalog(CATALOG, { overrides: { subject: 'cheesecake dilimi', productIdentity: { status: 'okunaklı_etiket', note: 'menüde: limonlu cheesecake' } }, verifiedProductIds: ['menu-12'] });
    expect(e.catalog?.subject).toBe('cheesecake dilimi');
    expect(e.catalog?.productIdentity.status).toBe('okunaklı_etiket');
    expect(e.catalog?.tags).toEqual(CATALOG.tags); // düzeltilmeyen alan AI'dan
    expect(e.sources).toEqual({ subject: 'human', productIdentity: 'human' });
    expect(e.verifiedProductIds).toEqual(['menu-12']);
    expect(effectiveCatalog(null, { overrides: { subject: 'x' } }).catalog).toBeNull();
    expect('reviewStatus' in e).toBe(false); // medya onay katmanı yok
  });

  it('yeniden analiz düzeltme belgesine dokunmaz; kısmi düzeltme önceki insan alanlarını korur', async () => {
    const db = fakeFirestore();
    addAsset(db, 'a1');
    await saveCorrection(db, { tenantId: T, projectId: P, assetId: 'a1', input: { overrides: { subject: 'insan konusu' }, verifiedProductIds: ['menu-1'] }, uid: 'u1', now: 1 });
    await saveCorrection(db, { tenantId: T, projectId: P, assetId: 'a1', input: { overrides: { tags: ['tatlı'] } }, uid: 'u2', now: 2 });
    const before = JSON.stringify(db.data.get(`${CORRECTIONS}/${T}_${P}_a1`));
    // AI analizi (iki kez, farklı içerikle — ör. yeni prompt sürümü/yeniden analiz)
    await enqueueAnalysis(db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: true, now: 5_000 });
    await processAnalysisQueue(db, workerDeps(db, haiku({ ...CATALOG, subject: 'AI konusu', tags: ['ai'] })), { featureEnabled: true });
    expect(JSON.stringify(db.data.get(`${CORRECTIONS}/${T}_${P}_a1`))).toBe(before);
    const eff = await loadEffectiveCatalog(db, T, P, 'a1');
    expect(eff.catalog?.subject).toBe('insan konusu');
    expect(eff.catalog?.tags).toEqual(['tatlı']);
    expect(eff.verifiedProductIds).toEqual(['menu-1']);
  });

  it('başka tenant/proje düzeltmesi okunmaz', async () => {
    const db = fakeFirestore();
    db.data.set(`${CORRECTIONS}/${T}_${P}_a1`, { tenantId: 't2', projectId: P, assetId: 'a1', overrides: { subject: 'sızıntı' } });
    expect((await loadEffectiveCatalog(db, T, P, 'a1')).sources).toEqual({});
  });
});

describe('yükleme → kalıcı analiz kuyruğu (Canva\'dan bağımsız)', () => {
  it('özellik kapalı: hiçbir yazma ve model çağrısı yok', async () => {
    const db = fakeFirestore();
    addAsset(db, 'a1');
    const before = db.data.size;
    expect(await enqueueAnalysis(db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: false, now: 1 })).toEqual({ queued: false, reason: 'feature_disabled' });
    const m = haiku();
    expect((await processAnalysisQueue(db, workerDeps(db, m), { featureEnabled: false })).considered).toBe(0);
    expect((await reconcileNewMedia(db, { featureEnabled: false, sinceMs: 0, now: 1 })).scanned).toBe(0);
    expect(db.data.size).toBe(before);
    expect(m).not.toHaveBeenCalled();
  });

  it('yinelenen bildirim tek iş; aynı medya ikinci kez ücretli analiz üretmez', async () => {
    const db = fakeFirestore();
    addAsset(db, 'a1');
    const r1 = await enqueueAnalysis(db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: true, now: 1 });
    const r2 = await enqueueAnalysis(db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: true, now: 2 });
    expect(r1).toMatchObject({ queued: true, created: true });
    expect(r2).toMatchObject({ queued: true, created: false });
    expect([...db.data.keys()].filter((k) => k.startsWith(`${ANALYSIS_QUEUE}/`))).toEqual([`${ANALYSIS_QUEUE}/${queueJobId(T, P, 'a1')}`]);
    const m = haiku();
    await processAnalysisQueue(db, workerDeps(db, m), { featureEnabled: true });
    // iş bittikten sonra yeni bildirim yeniden kuyruğa almaz; işçi tekrar çağırmaz
    await enqueueAnalysis(db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: true, now: 3 });
    await processAnalysisQueue(db, workerDeps(db, m), { featureEnabled: true });
    expect(m).toHaveBeenCalledTimes(1);
    expect(db.data.get(`${ANALYSIS_QUEUE}/${queueJobId(T, P, 'a1')}`).state).toBe('done');
  });

  it('istemci: Canva bildirimi başarısız olsa da analiz bildirimi gider', async () => {
    const canva = vi.fn(async () => {
      throw new Error('canva 503');
    });
    const analysis = vi.fn(async () => ({ queued: true }));
    const r = await notifyUploadComplete('p1', 'a1', { canva, analysis } as any);
    expect(analysis).toHaveBeenCalledWith('p1', 'a1');
    expect(r).toEqual({ canva: 'rejected', analysis: 'fulfilled' });
  });

  it('başka tenant/projenin kaydı, arşiv ve video kuyruğa alınmaz', async () => {
    const db = fakeFirestore();
    addAsset(db, 'x', { tenantId: 't2' });
    addAsset(db, 'arch', { status: 'archived' });
    addAsset(db, 'vid', { kind: 'video' });
    for (const id of ['x', 'arch', 'vid']) expect((await enqueueAnalysis(db, { tenantId: T, projectId: P, assetId: id, featureEnabled: true, now: 1 })).queued).toBe(false);
  });

  it('geçici model hatası (529) → bekler ve yeniden dener; sınır dolunca failed', async () => {
    const db = fakeFirestore();
    addAsset(db, 'a1');
    addAsset(db, 'a2');
    await enqueueAnalysis(db, { tenantId: T, projectId: P, assetId: 'a1', featureEnabled: true, now: 1 });
    await enqueueAnalysis(db, { tenantId: T, projectId: P, assetId: 'a2', featureEnabled: true, now: 1 });
    let n = 0;
    const flaky = vi.fn<ModelCall>(async () => {
      if (n++ === 0) throw Object.assign(new Error('overloaded'), { status: 529 });
      return { id: 'm', stopReason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 }, parsed: CATALOG };
    });
    const t = { v: 10_000 };
    await processAnalysisQueue(db, workerDeps(db, flaky, t), { featureEnabled: true });
    const j1 = db.data.get(`${ANALYSIS_QUEUE}/${queueJobId(T, P, 'a1')}`);
    expect(j1.state).toBe('pending');
    t.v += 10 * 60_000;
    await processAnalysisQueue(db, workerDeps(db, flaky, t), { featureEnabled: true });
    expect(db.data.get(`${ANALYSIS_QUEUE}/${queueJobId(T, P, 'a1')}`).state).toBe('done');

    const always = vi.fn<ModelCall>(async () => {
      throw Object.assign(new Error('500'), { status: 500 });
    });
    addAsset(db, 'a3');
    await enqueueAnalysis(db, { tenantId: T, projectId: P, assetId: 'a3', featureEnabled: true, now: t.v });
    for (let i = 0; i < 5; i++) {
      t.v += 60 * 60_000;
      await processAnalysisQueue(db, workerDeps(db, always, t), { featureEnabled: true });
    }
    expect(db.data.get(`${ANALYSIS_QUEUE}/${queueJobId(T, P, 'a3')}`).state).toBe('failed');
    expect(always).toHaveBeenCalledTimes(3);
  });

  it('kayıp bildirim kurtarma: aktivasyon anı ile ilk cron arasındaki yüklemeler kuyruğa girer; öncesi (arşiv) girmez', async () => {
    const db = fakeFirestore();
    const SINCE = 100_000;
    addAsset(db, 'old', { createdAt: SINCE - 1 }); // aktivasyon öncesi arşiv
    addAsset(db, 'gap1', { createdAt: SINCE + 10 }); // bayrak açıldı, bildirim kayboldu, cron henüz çalışmadı
    addAsset(db, 'gap2', { createdAt: SINCE + 20 });
    const NOW = SINCE + 60 * 60_000; // ilk cron bir saat sonra
    expect((await reconcileNewMedia(db, { featureEnabled: true, sinceMs: null, now: NOW })).skipped).toEqual({ activation_since_missing: 1 });
    const r = await reconcileNewMedia(db, { featureEnabled: true, sinceMs: SINCE, now: NOW });
    expect(r.queued).toBe(2);
    const queued = [...db.data.values()].filter((v: any) => v?.state === 'pending').map((v: any) => v.assetId).sort();
    expect(queued).toEqual(['gap1', 'gap2']);
    // ikinci tur cursor'dan sürer
    addAsset(db, 'later', { createdAt: SINCE + 30 });
    const r2 = await reconcileNewMedia(db, { featureEnabled: true, sinceMs: SINCE, now: NOW });
    expect(r2.scanned).toBe(1);
    expect(r2.queued).toBe(1);
  });

  it('aktivasyon anı değişirse cursor yeni andan başlar', async () => {
    const db = fakeFirestore();
    addAsset(db, 'a', { createdAt: 1_000 });
    addAsset(db, 'b', { createdAt: 3_000 });
    await reconcileNewMedia(db, { featureEnabled: true, sinceMs: 5_000, now: 10_000_000 });
    expect([...db.data.keys()].filter((k) => k.startsWith(`${ANALYSIS_QUEUE}/`))).toHaveLength(0);
    const r = await reconcileNewMedia(db, { featureEnabled: true, sinceMs: 2_000, now: 10_000_000 });
    expect(r.initialized).toBe(true);
    expect(r.queued).toBe(1); // yalnız b
  });

  it('aktivasyon anı ayrıştırma: yalnız açık ISO zaman damgası', () => {
    expect(parseActivationSince('2026-10-12T09:00:00+03:00')).toBe(Date.parse('2026-10-12T06:00:00Z'));
    expect(parseActivationSince(undefined)).toBeNull();
    expect(parseActivationSince('yarın')).toBeNull();
    expect(parseActivationSince('2026-10-12')).toBeNull();
  });
});

describe('plan envanteri: gerçek mediaID, izolasyon, uygunluk/kullanım/onay bağlamı', () => {
  async function seed() {
    const db = fakeFirestore();
    addAsset(db, 'p1photo');
    addAsset(db, 'p2photo');
    addAsset(db, 'vid1', { kind: 'video' });
    addAsset(db, 'arch', { status: 'archived' });
    addAsset(db, 'other', { tenantId: 't2' });
    addAsset(db, 'otherproj', { projectId: 'p9' });
    addAsset(db, 'bad', { storage: { path: 'brand-media/t1/p1/bad/x.jpg', downloadUrl: 'https://evil.example/x.jpg', contentType: 'image/jpeg', size: 1, width: 1080, height: 1350 } });
    db.data.set('social_media_posts/s1', { tenantId: T, projectId: P, status: 'approved', libraryAssetIds: ['p2photo'] });
    db.data.set('social_media_posts/s2', { tenantId: T, projectId: P, status: 'pending_approval', libraryAssetIds: ['p2photo'] });
    db.data.set('social_media_posts/s3', { tenantId: 't2', projectId: P, status: 'approved', libraryAssetIds: ['p1photo'] }); // başka tenant
    return db;
  }

  it('yalnız aktif, tutarlı, bu tenant+proje medyası; onay bağlamı mevcut post durumlarından', async () => {
    const db = await seed();
    const inv = await buildInventory(db, { tenantId: T, projectId: P, policy: POLICY });
    expect(inv.items.map((i) => i.mediaId).sort()).toEqual(['p1photo', 'p2photo', 'vid1']);
    expect(inv.excluded).toEqual([{ mediaId: 'bad', reason: 'inconsistent_asset' }]);
    const p1 = inv.items.find((i) => i.mediaId === 'p1photo')!;
    const p2 = inv.items.find((i) => i.mediaId === 'p2photo')!;
    expect(p1.usedInPostCount).toBe(0); // başka tenant post'u sayılmaz
    expect(p1.line).toContain('onay_bağlamı:henüz_yok');
    expect(p1.line).not.toContain('onaylı_postta');
    expect(p2.line).toContain('onaylı_postta:1');
    expect(p2.line).toContain('onay_sürecinde:1');
    expect(p2.line).toContain('kullanım:2');
    expect(inv.items.find((i) => i.mediaId === 'vid1')!.line).toContain('uygun_tür:story,reels');
  });

  it('insan düzeltmesi envanter satırına yansır; doğrulanmamış ürün işaretli kalır', async () => {
    const db = await seed();
    db.data.set(`media_ai_analysis_latest/${T}_${P}_p1photo`, { key: 'k1' });
    db.data.set('media_ai_analyses/k1', { tenantId: T, projectId: P, sourceId: 'p1photo', status: 'done', result: CATALOG, sourceQuality: 'original' });
    await saveCorrection(db, { tenantId: T, projectId: P, assetId: 'p1photo', input: { overrides: { subject: 'limonlu cheesecake' }, verifiedProductIds: ['menu-7'] }, uid: 'u', now: 1 });
    const inv = await buildInventory(db, { tenantId: T, projectId: P, policy: POLICY });
    const line = inv.items.find((i) => i.mediaId === 'p1photo')!.line;
    expect(line).toContain('konu:limonlu cheesecake');
    expect(line).toContain('ürün:menu-7');
    expect(line).toContain('katalog:insan_düzeltmeli');
    expect(inv.items.find((i) => i.mediaId === 'p2photo')!.line).toContain('ürün:doğrulanmamış');
  });
});

describe('Sonnet çıktısı sunucuda doğrulanır', () => {
  const opts = { weekStart: '2026-10-12', timeZone: 'Europe/Istanbul', count: 5, postTypes: ['static', 'carousel', 'story', 'reels'] as const };

  it('uydurma/başka markanın kimliği, tür ihlali, tekrar ve geçersiz zaman reddedilir; eksiklik raporlanır', async () => {
    const db = fakeFirestore();
    addAsset(db, 'a1');
    addAsset(db, 'a2');
    addAsset(db, 'v1', { kind: 'video' });
    addAsset(db, 'foreign', { tenantId: 't2' });
    const inv = (await buildInventory(db, { tenantId: T, projectId: P, policy: POLICY })).items;
    const post = (o: any) => ({ day: 0, time: '10:00', postType: 'static', mediaIds: ['a1'], captionDraft: 'c', rationale: 'r', ...o });
    const r = validateSuggestion(
      {
        posts: [
          post({}), // geçerli
          post({ mediaIds: ['made-up-123'] }), // uydurma
          post({ mediaIds: ['foreign'] }), // başka tenant
          post({ mediaIds: ['a1'], day: 1 }), // aynı haftada tekrar
          post({ mediaIds: ['a2', 'v1'], postType: 'carousel' }), // carousel'de video
          post({ mediaIds: ['a2'], postType: 'reels' }), // reels foto
          post({ mediaIds: ['a2'], day: 7 }), // geçersiz gün
          post({ mediaIds: ['a2'], time: '25:00' }), // geçersiz saat
          post({ mediaIds: ['v1'], postType: 'reels', day: 2, time: '19:30' }), // geçerli
        ],
        shortages: ['carousel için yeterli foto yok'],
      },
      inv,
      opts
    );
    expect(r.accepted.map((a) => a.index)).toEqual([0, 8]);
    const reasons = Object.fromEntries(r.rejected.map((x) => [x.index, x.reasons]));
    expect(reasons[1]).toContain('unknown_media:made-up-123');
    expect(reasons[2]).toContain('unknown_media:foreign');
    expect(reasons[3]).toContain('reused_media:a1');
    expect(reasons[4]).toContain('carousel_needs_2_10_photos');
    expect(reasons[5]).toContain('reels_needs_one_video');
    expect(reasons[6]).toContain('invalid_day');
    expect(reasons[7]).toContain('invalid_time');
    expect(r.shortages).toContain('carousel için yeterli foto yok');
    expect(r.shortages.some((s) => s.includes('İstenen 5 post için doğrulanmış öneri 2'))).toBe(true);
    // medya URL'si modelden değil sunucu envanterinden; zaman marka saat diliminde
    expect(r.accepted[0].media[0].libraryAssetId).toBe('a1');
    expect(r.accepted[0].media[0].url).toContain(encodeURIComponent('brand-media/t1/p1/a1/'));
    expect(r.accepted[0].scheduledAt).toBe('2026-10-12T07:00:00.000Z'); // 10:00 İstanbul
    expect(r.accepted[1].scheduledAt).toBe('2026-10-14T16:30:00.000Z');
  });

  it('şemaya uymayan çıktı tamamen reddedilir', () => {
    const r = validateSuggestion({ posts: [{ day: 'pazartesi' }] }, [], opts);
    expect(r.accepted).toEqual([]);
    expect(r.rejected[0].reasons).toEqual(['schema_invalid']);
  });

  it('uygun medya yoksa model çağrılmaz, eksiklik açıkça döner', async () => {
    const db = fakeFirestore();
    addAsset(db, 'arch', { status: 'archived' });
    const call = vi.fn<PlanModelCall>();
    const r = await suggestWeeklyPlan(db, { callModel: call, policy: POLICY }, { tenantId: T, projectId: P, weekStart: '2026-10-14', timeZone: 'Europe/Istanbul', count: 3 });
    expect(call).not.toHaveBeenCalled();
    expect(r.modelCalled).toBe(false);
    expect(r.weekStart).toBe('2026-10-12'); // herhangi bir gün → Pazartesi
    expect(r.shortages[0]).toMatch(/uygun medya yok/);
  });
});

describe('uçtan uca: yükleme → analiz → düzeltme → taslak öneri → mevcut post servisiyle draft', () => {
  it('yalnız gerçek envanter kullanılır; taslaklar insan incelemesine draft olarak gider', async () => {
    const db = fakeFirestore();
    for (const id of ['u1', 'u2', 'u3']) addAsset(db, id);
    addAsset(db, 'foreign', { projectId: 'p-other' });
    // 1) yükleme bildirimleri (biri yinelenmiş) → kuyruk → Haiku (sahte)
    for (const id of ['u1', 'u2', 'u3', 'u1']) await enqueueAnalysis(db, { tenantId: T, projectId: P, assetId: id, featureEnabled: true, now: 1 });
    const h = haiku();
    await processAnalysisQueue(db, workerDeps(db, h), { featureEnabled: true });
    expect(h).toHaveBeenCalledTimes(3);
    // 2) insan düzeltmesi
    await saveCorrection(db, { tenantId: T, projectId: P, assetId: 'u2', input: { overrides: { subject: 'mekan girişi' } }, uid: 'u', now: 2 });
    // 3) Sonnet (sahte): envanteri görür, bir uydurma ve bir başka proje kimliği de döndürür
    const sonnet = vi.fn<PlanModelCall>(async ({ user, model }) => {
      expect(model).toBe(PLAN_MODEL);
      expect(user).toContain('media:u1');
      expect(user).toContain('konu:mekan girişi');
      expect(user).not.toContain('media:foreign');
      return {
        id: 'msg_plan',
        stopReason: 'end_turn',
        parsed: {
          posts: [
            { day: 0, time: '12:00', postType: 'static', mediaIds: ['u1'], captionDraft: 'Öğle tatlısı', rationale: 'yakın çekim' },
            { day: 2, time: '18:00', postType: 'carousel', mediaIds: ['u2', 'u3'], captionDraft: 'Akşam', rationale: 'iki kare' },
            { day: 4, time: '18:00', postType: 'static', mediaIds: ['ghost'], captionDraft: 'x', rationale: 'x' },
            { day: 5, time: '18:00', postType: 'static', mediaIds: ['foreign'], captionDraft: 'x', rationale: 'x' },
          ],
          shortages: [],
        },
      };
    });
    const r = await suggestWeeklyPlan(db, { callModel: sonnet, policy: POLICY }, { tenantId: T, projectId: P, weekStart: '2026-10-12', timeZone: 'Europe/Istanbul', count: 4 });
    expect(r.accepted.map((a) => a.mediaIds)).toEqual([['u1'], ['u2', 'u3']]);
    expect(r.rejected.map((x) => x.reasons[0])).toEqual(['unknown_media:ghost', 'unknown_media:foreign']);
    expect(r.shortages.some((s) => s.includes('İstenen 4 post için doğrulanmış öneri 2'))).toBe(true);
    // 4) insan seçer → mevcut createSocialPost ile DRAFT (plan/onay/yayın yok)
    const create = vi.fn(async () => 'post-id');
    await addSuggestionsAsDrafts({ tenantId: T, projectId: P, uid: 'u', name: 'Şeyma', posts: r.accepted as any }, create as any);
    expect(create).toHaveBeenCalledTimes(2);
    const payload = (create.mock.calls[1] as any[])[1];
    expect(payload).toMatchObject({ projectId: P, postType: 'carousel', libraryAssetIds: ['u2', 'u3'], platforms: ['instagram'], tags: ['ai-taslak'] });
    expect(payload.contentPlanId).toBeUndefined();
    expect(payload.status).toBeUndefined(); // createSocialPost her zaman 'draft' yazar
  });
});

describe('süre bütçesi: SDK zaman aşımı < lease < platform süresi (yerel vercel.json)', () => {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const dur = (f: string) => vercel.functions[f]?.maxDuration;

  it('maxDuration açık ve model zaman aşımını kapsıyor', () => {
    expect(dur('api/media/analyze.ts')).toBeGreaterThanOrEqual(CATALOG_TIMEOUT_MS / 1000 + 30);
    expect(dur('api/studio/plan-suggest.ts')).toBeGreaterThanOrEqual(PLAN_TIMEOUT_MS / 1000 + 30);
    expect(dur('api/cron/media-analysis.ts')).toBe(CRON_MAX_DURATION_S);
    expect(vercel.crons.map((c: any) => c.path)).toContain('/api/cron/media-analysis');
  });

  it('lease çağrıdan uzun; son başlatılan iş platform sınırından önce biter', () => {
    expect(ANALYSIS_LEASE_MS).toBeGreaterThan(CATALOG_TIMEOUT_MS + 30_000);
    expect(QUEUE_LEASE_MS).toBeGreaterThanOrEqual(ANALYSIS_LEASE_MS);
    expect(WORK_START_DEADLINE_MS + ANALYSIS_LEASE_MS).toBeLessThanOrEqual(CRON_MAX_DURATION_S * 1000);
  });
});
