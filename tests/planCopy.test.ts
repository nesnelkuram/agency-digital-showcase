// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeFirestore } from './helpers/fakeFirestore';
import { generateCopy, loadBrandVoice, CopyError, BRAND_VOICE_COLLECTION, brandVoiceDocId, COPY_ISSUED, copyIssuedDocId, DEFAULT_OPENROUTER_COPY_MODEL, type CopyModelCall } from '@/api/_lib/planCopy/planCopy';
import { copyContentHash } from '@/shared/planner/copyContract';
import { saveCorrection, ANALYSES, ANALYSIS_LATEST } from '@/api/_lib/mediaAnalysis/correctionStore';
import { copySuggestState } from '@/api/_lib/integrations/config';
import { seedAsset, POLICY, T, P } from './feedPlanner/integration/liveFixtures';
import { bundle, feedItem, req, out } from './planner/helpers';
import type { CopyItemRequest } from '@/shared/planner/copyContract';

const CAT = { subject: 'masada makarna tabağı', description: 'Beyaz örtülü masada porselen tabakta makarna.', tags: ['makarna', 'tabak'], visibleObjects: ['tabak', 'kadeh'], foodCategories: ['makarna'], composition: { shotType: 'yakın_çekim', orientation: 'dikey', hasTextOverlay: false, subjectPlacement: 'merkez', negativeSpace: true }, productIdentity: { status: 'genel_kategori', note: '' }, usageSuggestions: ['story'], peoplePresent: false, uncertainties: ['sos içeriği görünmüyor'], planningNotes: [], overallConfidence: 'orta' };

function seedCatalog(db: any, id: string, catalog: any = CAT) {
  const key = `k-${id}`;
  db.data.set(`${ANALYSIS_LATEST}/${T}_${P}_${id}`, { key });
  db.data.set(`${ANALYSES}/${key}`, { tenantId: T, projectId: P, sourceId: id, status: 'done', result: catalog, sourceQuality: 'original' });
}
function seedVoice(db: any, over: Record<string, any> = {}) {
  db.data.set(`${BRAND_VOICE_COLLECTION}/${brandVoiceDocId(T, P)}`, { tenantId: T, projectId: P, bundle: bundle(), updatedBy: 'admin1', updatedAt: 1, ...over });
}
const GOOD = 'Sofrada kuralları biz koyarız; siz sadece tabağa bakın ve masanın sakinliğini hissedin.';
const model = (parsed: unknown, extra: Record<string, unknown> = {}): CopyModelCall & ReturnType<typeof vi.fn> =>
  vi.fn(async () => ({ id: 'resp-1', stopReason: 'end_turn', parsed, usage: { input_tokens: 1000, output_tokens: 200 }, ...extra })) as any;
const run = (db: any, call: CopyModelCall, items: CopyItemRequest[], extra: Record<string, unknown> = {}) =>
  generateCopy(db, { callModel: call, policy: POLICY }, { tenantId: T, projectId: P, req: { ...req(items), ...extra } });

const setup = () => {
  const db = fakeFirestore();
  seedAsset(db, 'a1');
  seedAsset(db, 'a2');
  seedCatalog(db, 'a1');
  seedVoice(db);
  return db;
};
const catchErr = async (p: Promise<unknown>): Promise<CopyError> => {
  try { await p; } catch (e) { return e as CopyError; }
  throw new Error('hata beklendi');
};

describe('generateCopy: model hattı (sahte model; şablon fallback YOK)', () => {
  it('mutlu yol: marka sesi + sunucu yüklemeli katalog prompt\'a girer; doğrulanmış Türkçe metin kabul edilir', async () => {
    const db = setup();
    const call = model(out([{ slotKey: 'feed:0', caption: GOOD, evidenceBasis: 'katalog_gozlem' }]));
    const r = await run(db, call, [feedItem(0, 'a1')]);
    expect(call).toHaveBeenCalledTimes(1);
    const sent = (call.mock.calls[0] as any)[0];
    expect(sent.model).toBe('claude-sonnet-5-5');
    expect(sent.system).toMatch(/<guides>/);
    expect(sent.user).toMatch(/<account_posts>[\s\S]*P01/);
    expect(sent.user).toMatch(/slot:feed:0 \| rol:caption .*media:a1 .*konu:masada makarna tabağı/);
    expect(r.accepted).toHaveLength(1);
    expect(r.accepted[0]).toMatchObject({ slotKey: 'feed:0', mediaId: 'a1', text: { caption: GOOD } });
    expect(r).toMatchObject({ model: 'claude-sonnet-5-5', promptVersion: 'plan-copy-v1', responseId: 'resp-1', usage: { inputTokens: 1000, outputTokens: 200 } });
  });

  it('KAYIT: kullanıcı kimliği verilince kabul edilen metinlerin hash\'i yanıt kimliğiyle sunucuda saklanır (taslak kaydında model kaynağı doğrulaması bunu kullanır); reddedilen metin kaydedilmez', async () => {
    const db = setup();
    const items = [feedItem(0, 'a1'), feedItem(1, 'a2')];
    const call = model(out([{ slotKey: 'feed:0', caption: GOOD, evidenceBasis: 'katalog_gozlem' }, { slotKey: 'feed:1', caption: 'We already chose. You just take a seat at the table, please.' }]));
    const r = await generateCopy(db, { callModel: call, policy: POLICY }, { tenantId: T, projectId: P, req: req(items), issuedBy: { uid: 'u1', now: 42 } });
    expect(r.accepted).toHaveLength(1);
    const rec = db.data.get(`${COPY_ISSUED}/${copyIssuedDocId(T, P, 'resp-1')}`);
    expect(rec).toMatchObject({ tenantId: T, projectId: P, responseId: 'resp-1', issuedBy: 'u1', createdAt: 42 });
    expect(rec.hashes).toEqual({ [copyContentHash('a1', 'caption', { caption: GOOD })]: 'a1' });
    expect(r.accepted[0].contentHash).toBe(copyContentHash('a1', 'caption', { caption: GOOD }));
    // kimliksiz çağrıda (ör. test) kayıt yazılmaz
    const db2 = setup();
    await run(db2, model(out([{ slotKey: 'feed:0', caption: GOOD, evidenceBasis: 'katalog_gozlem' }])), [feedItem(0, 'a1')]);
    expect([...db2.data.keys()].some((k: string) => k.startsWith(`${COPY_ISSUED}/`))).toBe(false);
  });

  it('model çıktısı doğrulamadan geçmezse REDDEDİLİR (İngilizce, kanıtsız içerik); kabul edilen yok, şablonla doldurulmaz', async () => {
    const db = setup();
    const r = await run(db, model(out([{ slotKey: 'feed:0', caption: 'We already chose. You just take a seat at the table, please.' }])), [feedItem(0, 'a1')]);
    expect(r.accepted).toEqual([]);
    expect(r.rejected[0]).toMatchObject({ slotKey: 'feed:0' });
    expect(r.rejected[0].reasons).toContain('dil_türkçe_değil');
    const r2 = await run(db, model(out([{ slotKey: 'feed:0', caption: 'Karidesin diri dokusu ve mozzarellanın yumuşaklığı tabakta buluşuyor, siz sadece izleyin.' }])), [feedItem(0, 'a1')]);
    expect(r2.accepted).toEqual([]);
    expect(r2.rejected[0].reasons).toEqual(expect.arrayContaining(['kanıtsız_içerik:karides', 'kanıtsız_içerik:mozzarella']));
  });

  it('model hatası/ret/çıktısızlık AÇIK hata: 502 model_error, 422 model_refusal, 422 model_no_output', async () => {
    const db = setup();
    const boom = vi.fn(async () => { throw Object.assign(new Error('gizli ayrıntı: sk-ant-xyz'), { status: 529 }); }) as any;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const e1 = await catchErr(run(db, boom, [feedItem(0, 'a1')]));
    expect(e1).toMatchObject({ status: 502, code: 'model_error' });
    expect(e1.message).not.toMatch(/sk-ant|gizli/); // ayrıntı istemciye sızmaz
    spy.mockRestore();
    expect(await catchErr(run(db, model(null, { stopReason: 'refusal' }), [feedItem(0, 'a1')]))).toMatchObject({ status: 422, code: 'model_refusal' });
    expect(await catchErr(run(db, model(null), [feedItem(0, 'a1')]))).toMatchObject({ status: 422, code: 'model_no_output' });
  });

  it('marka sesi paketi yoksa model ÇAĞRILMAZ (412); başka tenant/proje paketi kullanılmaz; bozuk paket 500', async () => {
    const db = fakeFirestore();
    seedAsset(db, 'a1');
    const call = model(out([]));
    expect(await catchErr(run(db, call, [feedItem(0, 'a1')]))).toMatchObject({ status: 412, code: 'brand_voice_missing' });
    seedVoice(db, { tenantId: 't2' });
    expect(await catchErr(loadBrandVoice(db, T, P))).toMatchObject({ code: 'brand_voice_missing' });
    seedVoice(db, { bundle: { ...bundle(), captions: [] } });
    expect(await catchErr(loadBrandVoice(db, T, P))).toMatchObject({ status: 500, code: 'brand_voice_invalid' });
    seedVoice(db, { bundle: { ...bundle(), guideHashes: { ...bundle().guideHashes, persona: 'a'.repeat(64) } } });
    expect(await catchErr(loadBrandVoice(db, T, P))).toMatchObject({ code: 'brand_voice_invalid' });
    expect(call).not.toHaveBeenCalled();
  });

  it('geçersiz medya (yok, başka proje/tenant, arşiv, tutarsız depolama) → 422 media_invalid, model çağrılmaz, başka markanın varlığı sızmaz', async () => {
    const db = setup();
    seedAsset(db, 'other-project', { projectId: 'p2' });
    seedAsset(db, 'other-tenant', { tenantId: 't2' });
    seedAsset(db, 'old', { status: 'archived' });
    seedAsset(db, 'bad');
    const bad = db.data.get('brand_media/bad');
    db.data.set('brand_media/bad', { ...bad, storage: { ...bad.storage, path: 'brand-media/t1/p1/bad/' } });
    const call = model(out([]));
    const items = ['ghost', 'other-project', 'other-tenant', 'old', 'bad'].map((id, i) => feedItem(i, id));
    const e = await catchErr(run(db, call, items));
    expect(e).toMatchObject({ status: 422, code: 'media_invalid' });
    const reasons = Object.fromEntries((e.details as any[]).map((d) => [d.id, d.reason]));
    expect(reasons).toEqual({ ghost: 'not_found', 'other-project': 'not_found', 'other-tenant': 'not_found', old: 'archived', bad: 'inconsistent_asset' });
    expect(call).not.toHaveBeenCalled();
  });

  it('doğrulanmış ürün: yalnız insan düzeltmesi + paket listesi eşleşirse prompt\'a girer; bilinmeyen kimlik düşer', async () => {
    const db = setup();
    await saveCorrection(db, { tenantId: T, projectId: P, assetId: 'a1', input: { verifiedProductIds: ['the-ghosting', 'bilinmeyen-urun'] }, uid: 'u', now: 1 });
    const call = model(out([{ slotKey: 'feed:0', caption: 'The Ghosting sabah ritüelini bize bırakın; siz sadece oturun ve kupanın başında bekleyin.', evidenceBasis: 'dogrulanmis_urun' }, { slotKey: 'feed:1', caption: GOOD + ' Farklı.', evidenceBasis: 'persona_kanaat' }]));
    const r = await run(db, call, [feedItem(0, 'a1'), feedItem(1, 'a2')]);
    const user: string = (call.mock.calls[0] as any)[0].user;
    expect(user).toMatch(/media:a1 .*doğrulanmış_ürün:The Ghosting \(espresso\)/);
    expect(user).not.toMatch(/bilinmeyen-urun/);
    expect(user).toMatch(/media:a2 .*doğrulanmış_ürün:yok/);
    expect(r.accepted.map((a) => a.slotKey)).toContain('feed:0');
    // doğrulanmamış medyada aynı ürün adı reddedilir
    const r2 = await run(db, model(out([{ slotKey: 'feed:1', caption: 'The Ghosting ile başlayan bir sofra düzeni, siz sadece oturun ve tadına bakın.', evidenceBasis: 'persona_kanaat' }])), [feedItem(1, 'a2')]);
    expect(r2.rejected[0].reasons).toContain('ürün_bu_medya_için_doğrulanmadı:the-ghosting');
  });

  it('STORY SERİSİ yalnız gerçek ürün kimliğiyle: eşleşmeyen seri kimliği 422 series_unverified; eşleşen seri kabul', async () => {
    const db = setup();
    await saveCorrection(db, { tenantId: T, projectId: P, assetId: 'a1', input: { verifiedProductIds: ['the-ghosting'] }, uid: 'u', now: 1 });
    await saveCorrection(db, { tenantId: T, projectId: P, assetId: 'a2', input: { verifiedProductIds: ['the-ghosting'] }, uid: 'u', now: 1 });
    seedAsset(db, 'a3');
    const s = (n: number, id: string, role: CopyItemRequest['role'], key: string | null, pos?: number, size?: number): CopyItemRequest => ({ slotKey: `story:${n}`, mediaId: id, lane: 'story', role, seriesKey: key, seriesPosition: pos, seriesSize: size });
    const call = model(out([]));
    // a3'ün doğrulanmış ürünü yok ama seri iddia ediliyor
    const e = await catchErr(run(db, call, [s(0, 'a1', 'headline', 'the-ghosting', 0, 2), s(1, 'a3', 'body', 'the-ghosting', 1, 2)]));
    expect(e).toMatchObject({ status: 422, code: 'series_unverified', details: ['story:1'] });
    expect(call).not.toHaveBeenCalled();
    const ok = model(out([{ slotKey: 'story:0', headline: 'Sabahın ilk kararı.' }, { slotKey: 'story:1', body: 'Bu masada karar çoktan verildi, siz sadece oturun.' }]));
    const r = await run(db, ok, [s(0, 'a1', 'headline', 'the-ghosting', 0, 2), s(1, 'a2', 'body', 'the-ghosting', 1, 2)]);
    expect(r.accepted.map((a) => [a.slotKey, Object.keys(a.text)[0]])).toEqual([['story:0', 'headline'], ['story:1', 'body']]);
    expect((ok.mock.calls[0] as any)[0].user).toMatch(/seri:the-ghosting#0\/2/);
  });

  it('kısmi sonuç: geçerli slot kabul, diğeri nedenle red; eksik slot missing_output', async () => {
    const db = setup();
    const r = await run(db, model(out([{ slotKey: 'feed:0', caption: GOOD }])), [feedItem(0, 'a1'), feedItem(1, 'a2')]);
    expect(r.accepted.map((a) => a.slotKey)).toEqual(['feed:0']);
    expect(r.rejected).toEqual([{ slotKey: 'feed:1', reasons: ['missing_output'] }]);
  });

  it('avoidTexts prompt\'a girer ve benzer çıktıyı reddeder', async () => {
    const db = setup();
    const call = model(out([{ slotKey: 'feed:0', caption: GOOD }]));
    const r = await run(db, call, [feedItem(0, 'a1')], { avoidTexts: [GOOD] });
    expect((call.mock.calls[0] as any)[0].user).toMatch(/<avoid>/);
    expect(r.rejected[0].reasons).toContain('diğer_slotla_çok_benzer');
  });
});

// ── uç nokta ──
const authUser: { current: any } = { current: null };
vi.mock('@/api/_lib/withAuth', () => ({ withAuth: (h: any) => (r: any, s: any) => h(Object.assign(r, authUser.current), s) }));
const endpointDb: { current: any } = { current: null };
vi.mock('@/api/_lib/firebaseAdmin', () => ({ getAdminDb: () => endpointDb.current }));
vi.mock('@/api/_lib/rateLimit', async (orig) => ({ ...(await orig<any>()), applyRateLimit: () => true }));
const endpointModel: { current: CopyModelCall } = { current: model(out([])) };
vi.mock('@/api/_lib/planCopy/openrouterCopyCall', () => ({ openrouterCopyCall: () => (...a: any[]) => (endpointModel.current as any)(...a) }));

import handler from '@/api/studio/plan-copy';
const res = () => {
  const r: any = { statusCode: 0, body: null, headers: {} };
  r.setHeader = (k: string, v: string) => ((r.headers[k] = v), r);
  r.status = (s: number) => ((r.statusCode = s), r);
  r.json = (b: any) => ((r.body = b), r);
  return r;
};
const call = async (body: any, method = 'POST') => { const r = res(); await (handler as any)({ method, body, query: {} }, r); return r; };

describe('POST /api/studio/plan-copy', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    const db = setup();
    db.data.set('projects/p1', { tenantId: 't1' });
    db.data.set('users/admin1', { tenantId: 't1', role: 'admin' });
    db.data.set('users/client1', { tenantId: 't1', role: 'client', profile: { assignedProjectIds: ['p1'] } });
    db.data.set('users/fl1', { tenantId: 't1', role: 'freelancer', profile: { assignedProjectIds: ['p1'] } });
    db.data.set('users/bm1', { tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['p1'] } });
    db.data.set('users/bm2', { tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['p2'] } });
    db.data.set('users/other', { tenantId: 't2', role: 'admin' });
    endpointDb.current = db;
    authUser.current = { userId: 'admin1', userUid: 'admin1', tenantId: 't1', userRole: 'admin' };
    process.env.PLAN_COPY_AI_ENABLED = 'true';
    process.env.OPENROUTER_API_KEY = 'test-anahtar-gercek-degil';
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.PLAN_COPY_MODEL;
    process.env.FIREBASE_STORAGE_BUCKET = POLICY.buckets[0];
    endpointModel.current = model(out([{ slotKey: 'feed:0', caption: GOOD, evidenceBasis: 'katalog_gozlem' }]));
  });
  afterEach(() => { process.env = { ...saved }; });
  const body = (o: any = {}) => ({ ...req([feedItem(0, 'a1')]), ...o });

  it('başarılı istek 200: kabul edilen metin, taslak işareti; model bir kez çağrıldı', async () => {
    const r = await call(body());
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ draftOnly: true, accepted: [{ slotKey: 'feed:0', text: { caption: GOOD } }] });
    expect(endpointModel.current).toHaveBeenCalledTimes(1);
  });
  it('yöntem 405, geçersiz gövde 400 (model çağrılmaz)', async () => {
    expect((await call(body(), 'GET')).statusCode).toBe(405);
    const bad = await call({ projectId: 'p1', weekStart: 'x', items: [] });
    expect(bad.statusCode).toBe(400);
    expect(bad.body.code).toBe('bad_request');
    expect(endpointModel.current).not.toHaveBeenCalled();
  });
  it.each([
    ['müşteri', 'client1', 't1'], ['freelancer', 'fl1', 't1'], ['atanmamış marka yöneticisi', 'bm2', 't1'], ['başka tenant admini', 'other', 't2'],
  ])('%s erişemez (403) ve model çağrılmaz', async (_n, uid, tenant) => {
    authUser.current = { userId: uid, userUid: uid, tenantId: tenant, userRole: 'x' };
    const r = await call(body());
    expect(r.statusCode).toBe(403);
    expect(endpointModel.current).not.toHaveBeenCalled();
  });
  it('atanmış marka yöneticisi erişir', async () => {
    authUser.current = { userId: 'bm1', userUid: 'bm1', tenantId: 't1', userRole: 'brand_manager' };
    expect((await call(body())).statusCode).toBe(200);
  });
  it('özellik kapalı/yapılandırma eksik 503; yalnız değişken ADLARI raporlanır, model çağrılmaz', async () => {
    delete process.env.PLAN_COPY_AI_ENABLED;
    const off = await call(body());
    expect(off).toMatchObject({ statusCode: 503, body: { code: 'feature_disabled' } });
    process.env.PLAN_COPY_AI_ENABLED = 'true';
    delete process.env.OPENROUTER_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'baska-sirket-anahtari'; // Anthropic anahtarı VAR ama bu akış ona yedeklenmez
    const missing = await call(body());
    expect(missing.statusCode).toBe(503);
    expect(copySuggestState()).toEqual({ enabled: false, reason: 'AI yapılandırması eksik.', missing: ['OPENROUTER_API_KEY'] });
    expect(JSON.stringify(missing.body)).not.toMatch(/baska-sirket/);
    expect(JSON.stringify(missing.body)).not.toMatch(/test-anahtar/);
    expect(endpointModel.current).not.toHaveBeenCalled();
  });
  it('model kimliği OpenRouter biçimindedir (sağlayıcı/model): varsayılan, PLAN_COPY_MODEL ile geçersiz kılma, geçersiz değer 503 ve model çağrılmaz', async () => {
    await call(body());
    expect((endpointModel.current as any).mock.calls[0][0].model).toBe(DEFAULT_OPENROUTER_COPY_MODEL);
    process.env.PLAN_COPY_MODEL = 'openai/gpt-5-mini';
    (endpointModel.current as any).mockClear();
    await call(body({ idempotencyKey: undefined }));
    expect((endpointModel.current as any).mock.calls[0][0].model).toBe('openai/gpt-5-mini');
    (endpointModel.current as any).mockClear();
    for (const bad of ['claude-sonnet-5-5', 'anthropic/', '/x', 'a b/c', 'https://x/y']) {
      process.env.PLAN_COPY_MODEL = bad;
      const r = await call(body());
      expect(r, bad).toMatchObject({ statusCode: 503, body: { code: 'feature_disabled' } });
    }
    expect(endpointModel.current).not.toHaveBeenCalled();
  });
  it('yanıt sağlayıcı, çalışan model, yanıt/istek kimliği, usage ve maliyeti taşır; taslak kaydı da bunları saklar', async () => {
    endpointModel.current = model(out([{ slotKey: 'feed:0', caption: GOOD, evidenceBasis: 'katalog_gozlem' }]), {
      provider: 'openrouter', modelUsed: 'anthropic/claude-sonnet-5.5-20261001', requestId: 'req-9',
      usageDetail: { inputTokens: 900, outputTokens: 120, totalTokens: 1020, cachedTokens: 0, reasoningTokens: null, costUsd: 0.0042 },
    });
    const r = await call(body());
    expect(r.body).toMatchObject({
      provider: 'openrouter', requestedModel: DEFAULT_OPENROUTER_COPY_MODEL, modelUsed: 'anthropic/claude-sonnet-5.5-20261001', model: 'anthropic/claude-sonnet-5.5-20261001',
      requestId: 'req-9', responseId: 'resp-1', usage: { inputTokens: 900, outputTokens: 120, totalTokens: 1020, costUsd: 0.0042 },
    });
    expect(endpointDb.current.data.get(`${COPY_ISSUED}/${copyIssuedDocId(T, P, 'resp-1')}`)).toMatchObject({ provider: 'openrouter', requestId: 'req-9', usage: { costUsd: 0.0042 } });
  });
  it('hata eşlemesi: marka sesi yok 412, model hatası 502 (metin yok), geçersiz medya 422', async () => {
    endpointDb.current.data.delete(`${BRAND_VOICE_COLLECTION}/${brandVoiceDocId(T, P)}`);
    expect(await call(body())).toMatchObject({ statusCode: 412, body: { code: 'brand_voice_missing' } });
    seedVoice(endpointDb.current);
    endpointModel.current = vi.fn(async () => { throw new Error('x'); }) as any;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await call(body());
    spy.mockRestore();
    expect(r).toMatchObject({ statusCode: 502, body: { code: 'model_error' } });
    expect(r.body.accepted).toBeUndefined();
    expect(await call(body({ items: [feedItem(0, 'yok-medya')] }))).toMatchObject({ statusCode: 422, body: { code: 'media_invalid' } });
  });

  it('REHBERSİZ AKIŞ (uç nokta): paket yok + ton yok → 412 (needs: tone_or_guide), model yok; ton varsa 200 ve voice.source=temporary_tone; sağlayıcı kapalıyken 503 (412 DEĞİL, rehber durumuna bakılmadan)', async () => {
    endpointDb.current.data.delete(`${BRAND_VOICE_COLLECTION}/${brandVoiceDocId(T, P)}`);
    const none = await call(body());
    expect(none).toMatchObject({ statusCode: 412, body: { code: 'brand_voice_missing', details: { needs: 'tone_or_guide' } } });
    expect(endpointModel.current).not.toHaveBeenCalled();
    const obs = { brightness: 0.6, warmth: 0.1, contrast: 0.2, density: 0.2, negativeSpace: 0.3, negativeZone: 'üst', palette: ['#aa8855'] };
    // a1 için KAYITLI konu açıklaması (katalog) var: geçici tonla taslak üretilebilir; ölçüm (observed) kanıt DEĞİLDİR
    endpointModel.current = model(out([{ slotKey: 'feed:0', caption: 'Tabakta makarna, masada sakin bir sofra kurulmuş.', evidenceBasis: 'katalog_gozlem' }]));
    const items = [{ ...feedItem(0, 'a1'), observed: obs }];
    const ok = await call({ ...req(items), tempTone: { label: 'zarif' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toMatchObject({ draftOnly: true, voice: { source: 'temporary_tone', tone: { label: 'zarif' }, tempToneIgnored: false }, accepted: [{ slotKey: 'feed:0', evidenceBasis: 'katalog_gozlem' }] });
    expect(ok.body.voice.assumptions.join(' ')).toMatch(/onaylı marka hafızası değildir/);
    expect(ok.body.voice.assumptions.join(' ')).toMatch(/ölçtüğü görsel özellikler.*caption kanıtı olarak kullanılmadı/);
    // sağlayıcı kapalı: 503, ton/rehber ne olursa olsun; model çağrılmaz
    delete process.env.PLAN_COPY_AI_ENABLED;
    (endpointModel.current as any).mockClear();
    expect(await call({ ...req(items), tempTone: { label: 'zarif' } })).toMatchObject({ statusCode: 503, body: { code: 'feature_disabled' } });
    expect(await call(body())).toMatchObject({ statusCode: 503, body: { code: 'feature_disabled' } });
    expect(endpointModel.current).not.toHaveBeenCalled();
    // geçersiz ton → 400
    process.env.PLAN_COPY_AI_ENABLED = 'true';
    expect((await call({ ...req(items), tempTone: { label: 'agresif' } })).statusCode).toBe(400);
  });
});
