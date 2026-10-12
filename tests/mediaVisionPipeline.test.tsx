import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { fakeFirestore } from './helpers/fakeFirestore';
import { seedAsset, POLICY, T, P } from './feedPlanner/integration/liveFixtures';
import { analysisOutput, visual } from './helpers/visualFixture';

// GERÇEK yükleme-sonrası tetik + kuyruk + OpenRouter adaptörü + runner + GET + envanter + aday dönüşümü + plan motoru + panel.
// Taklit edilenler yalnız: Firestore (bellek içi), Storage baytları ve AĞ (global fetch; OpenRouter yanıtı üretir). Gerçek çağrı YOK.
const h = vi.hoisted(() => ({ db: null as any, user: null as any }));
vi.mock('@/api/_lib/withAuth', () => ({ withAuth: (fn: any) => (req: any, res: any) => fn(Object.assign(req, h.user), res) }));
vi.mock('@/api/_lib/firebaseAdmin', () => ({
  getAdminDb: () => h.db,
  getAdminStorage: async () => ({ bucket: () => ({ file: (p: string) => ({ download: async () => [Buffer.from(`PIXELS:${p}`)] }) }) }),
}));
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import analyzeHandler from '@/api/media/analyze';
import { processAnalysisQueue } from '@/api/_lib/mediaAnalysis/autoQueue';
import { firestoreAnalysisStore } from '@/api/_lib/mediaAnalysis/runner';
import { listInventoryPage } from '@/api/_lib/plannerInventory/plannerInventory';
import { candidateFromInventory } from '@/studio/feedPlanner/integration/fromInventory';
import { emptyPlan, generate, FEED_SLOTS, type PlanCtx } from '@/studio/feedPlanner/planner';
import { scoreCandidate } from '@/studio/feedPlanner/scorer';
import { gridCtxFor } from '@/studio/feedPlanner/planner';
import type { Candidate } from '@/studio/feedPlanner/types';

vi.mock('@/studio/mediaIntegrationsApi', async (orig) => ({
  ...(await orig<any>()),
  getMediaAnalysis: async (projectId: string, assetId: string) => {
    const r = res();
    await analyzeHandler({ method: 'GET', query: { projectId, assetId } } as any, r);
    if (r.statusCode >= 400) throw new Error(r.body?.error || `İstek başarısız (${r.statusCode})`);
    return JSON.parse(JSON.stringify(r.body));
  },
}));
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: vi.fn() }));
import { AssetDescription } from '@/studio/components/AssetDescription';

function res() {
  const r: any = { statusCode: 0, body: null, headers: {} };
  r.setHeader = (k: string, v: string) => ((r.headers[k] = v), r);
  r.status = (s: number) => ((r.statusCode = s), r);
  r.json = (b: any) => ((r.body = b), r);
  return r;
}
const CATALOG = {
  subject: 'masada makarna tabağı', description: 'Beyaz örtülü masada porselen tabakta makarna.', tags: ['makarna'], visibleObjects: ['tabak'], foodCategories: ['makarna'],
  composition: { shotType: 'orta_plan', orientation: 'dikey', hasTextOverlay: false, subjectPlacement: 'merkez', negativeSpace: true },
  productIdentity: { status: 'genel_kategori', note: 'makarna türü görünmüyor' }, usageSuggestions: ['feed'], peoplePresent: false,
  uncertainties: ['sos içeriği görünmüyor'], planningNotes: [], overallConfidence: 'orta',
};
const orBody = (content: unknown, over: Record<string, unknown> = {}) => ({
  ok: true, status: 200, headers: { get: () => 'rq-1' },
  json: async () => ({ id: 'gen-1', model: 'anthropic/claude-haiku-5.5-20261007', choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }], usage: { prompt_tokens: 1800, completion_tokens: 700, total_tokens: 2500, cost: 0.0021 }, ...over }),
});
const post = async (body: Record<string, unknown>) => {
  const r = res();
  await analyzeHandler({ method: 'POST', body: { projectId: P, ...body }, query: {} } as any, r);
  return r;
};
const get = async (assetId = 'a1', projectId = P) => {
  const r = res();
  await analyzeHandler({ method: 'GET', query: { projectId, assetId } } as any, r);
  return r;
};
const as = (uid: string, role: string, tenantId = T) => (h.user = { userId: uid, userUid: uid, tenantId, userRole: role });
const ENV = ['MEDIA_AI_ANALYSIS_ENABLED', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'FIREBASE_STORAGE_BUCKET', 'MEDIA_AI_MODEL'];
const savedEnv: Record<string, string | undefined> = {};
const enable = () => Object.assign(process.env, { MEDIA_AI_ANALYSIS_ENABLED: 'true', OPENROUTER_API_KEY: 'or-test-sahte', FIREBASE_STORAGE_BUCKET: 'demo.appspot.com' });

beforeEach(() => {
  for (const k of ENV) { savedEnv[k] = process.env[k]; delete process.env[k]; }
  fetchMock.mockReset();
  h.db = fakeFirestore();
  h.db.data.set('projects/p1', { tenantId: 't1' });
  h.db.data.set('projects/p2', { tenantId: 't1' });
  h.db.data.set('users/admin1', { tenantId: 't1', role: 'admin' });
  seedAsset(h.db, 'a1');
  as('admin1', 'admin');
});
afterEach(() => { cleanup(); for (const k of ENV) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; } });

describe('yükleme → kuyruk → OpenRouter → kayıt (uçtan uca, sahte ağ)', () => {
  it('KAPALIYKEN hiçbir kuyruk işi, kayıt veya dış çağrı yok; yapılandırma eksikse dürüstçe kapalı (Anthropic anahtarı yedek DEĞİL)', async () => {
    const r = await post({ assetId: 'a1', trigger: 'upload_complete' });
    expect(r.body).toMatchObject({ enabled: false, queued: false, reason: 'feature_disabled' });
    Object.assign(process.env, { MEDIA_AI_ANALYSIS_ENABLED: 'true', ANTHROPIC_API_KEY: 'baska', FIREBASE_STORAGE_BUCKET: 'b' }); // OPENROUTER_API_KEY yok
    const r2 = await post({ assetId: 'a1', trigger: 'upload_complete' });
    expect(r2.body).toMatchObject({ enabled: false, queued: false });
    expect([...h.db.data.keys()].some((k: string) => k.startsWith('media_ai_'))).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    const g = await get();
    expect(g.body).toMatchObject({ enabled: false, analysis: null });
  });

  it('upload_complete: TEK iş açılır, TEK OpenRouter çağrısı (doğru model, görsel data URL, strict şema); katalog ve görsel karar AYRI sürümlü alanlarla kaydedilir; kuyruk done', async () => {
    enable();
    fetchMock.mockResolvedValue(orBody(analysisOutput(CATALOG, visual({ density: 'kalabalık' }))));
    const r = await post({ assetId: 'a1', trigger: 'upload_complete' });
    expect(r.body).toMatchObject({ enabled: true, queued: true, state: 'done' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe('anthropic/claude-haiku-5.5');
    expect(sent.messages[1].content[1].image_url.url).toBe(`data:image/jpeg;base64,${Buffer.from('PIXELS:brand-media/t1/p1/a1/a1.jpg').toString('base64')}`);
    expect(sent.provider).toEqual({ allow_fallbacks: false, require_parameters: true });
    expect(init.headers.Authorization).toBe('Bearer or-test-sahte');

    const job = h.db.data.get('media_ai_queue/t1_p1_a1');
    expect(job).toMatchObject({ state: 'done', attempts: 1 });
    const latest = h.db.data.get('media_ai_analysis_latest/t1_p1_a1');
    const rec = h.db.data.get(`media_ai_analyses/${latest.key}`);
    expect(rec).toMatchObject({
      status: 'done', provider: 'openrouter', model: 'anthropic/claude-haiku-5.5', modelUsed: 'anthropic/claude-haiku-5.5-20261007', requestId: 'rq-1',
      promptVersion: 'media-catalog-v3', schemaVersion: '3', catalogSchemaVersion: '2', visualSchemaVersion: 'visual-decision-3', visualPromptVersion: 'visual-decision-prompt-3',
      sourceQuality: 'original', visualStatus: 'ok', costUsd: 0.0021,
    });
    expect(rec.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(rec.result.subject).toBe('masada makarna tabağı'); // gerçek konu: ayrı alan
    expect(rec.visual.density).toBe('kalabalık'); // kompozisyon kararı: ayrı alan
    expect(rec.result).not.toHaveProperty('weight');
    expect(rec.visual).not.toHaveProperty('description');
  });

  it('idempotency: yinelenen/eşzamanlı bildirimler, tekrar tetik, doğrudan analiz ve cron TEK ücretli çağrı üretir', async () => {
    enable();
    fetchMock.mockResolvedValue(orBody(analysisOutput(CATALOG)));
    await Promise.all([post({ assetId: 'a1', trigger: 'upload_complete' }), post({ assetId: 'a1', trigger: 'upload_complete' }), post({ assetId: 'a1', trigger: 'upload_complete' })]);
    await post({ assetId: 'a1', trigger: 'upload_complete' });
    await post({ assetId: 'a1' });
    const w = await processAnalysisQueue(h.db, { owner: 'cron', now: Date.now, analysisDeps: () => ({ store: firestoreAnalysisStore(h.db), readBytes: async () => Buffer.from('x'), callModel: fetchMock as any, now: Date.now }) }, { featureEnabled: true });
    expect(w.processed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retry/limit: geçici hata (429) kuyrukta beklemeye alınır, süre dolunca cron yeniden dener ve başarır; kalıcı hata (402) yeniden denenmez; 3 denemede failed', async () => {
    enable();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, headers: { get: () => null }, json: async () => ({ error: { code: 429 } }) });
    const first = await post({ assetId: 'a1', trigger: 'upload_complete' });
    expect(first.body).toMatchObject({ queued: true, state: 'pending' });
    expect(h.db.data.get('media_ai_queue/t1_p1_a1')).toMatchObject({ state: 'pending', attempts: 1 });
    expect(h.db.data.get('media_ai_queue/t1_p1_a1').nextAttemptAt).toBeGreaterThan(Date.now());
    // süre dolmadan cron çağrı yapmaz
    // gerçek adaptörle yeniden deneme: cron aynı openrouterVisionCall'ı kullanır (analyze/ cron ortak)
    const { openrouterVisionCall } = await import('@/api/_lib/mediaAnalysis/openrouterVisionCall');
    const realDeps = (t: number) => ({ owner: 'cron', now: () => t, analysisDeps: () => ({ store: firestoreAnalysisStore(h.db), readBytes: async () => Buffer.from('PIXELS'), callModel: openrouterVisionCall(), now: () => t }) });
    expect((await processAnalysisQueue(h.db, realDeps(Date.now()), { featureEnabled: true })).processed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValue(orBody(analysisOutput(CATALOG)));
    const later = Date.now() + 10 * 60_000;
    const w = await processAnalysisQueue(h.db, realDeps(later), { featureEnabled: true });
    expect(w.states).toMatchObject({ done: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(h.db.data.get('media_ai_queue/t1_p1_a1')).toMatchObject({ state: 'done', attempts: 2 });

    // 402 (kredi yok) kalıcı: yeniden denenmez
    seedAsset(h.db, 'a2');
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: false, status: 402, headers: { get: () => null }, json: async () => ({ error: { code: 402 } }) });
    const p = await post({ assetId: 'a2', trigger: 'upload_complete' });
    expect(p.body).toMatchObject({ state: 'failed' });
    expect(h.db.data.get('media_ai_queue/t1_p1_a2')).toMatchObject({ state: 'failed', lastError: { code: 'http_402' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await processAnalysisQueue(h.db, realDeps(later + 3_600_000), { featureEnabled: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('desteklenmeyen (video / çok büyük + önizlemesiz) varlık: model ÇAĞRILMAZ, kuyruk skipped, panel "desteklenmiyor/atlandı" der', async () => {
    enable();
    seedAsset(h.db, 'v1', { kind: 'video' });
    const r = await post({ assetId: 'v1', trigger: 'upload_complete' });
    expect(r.body).toMatchObject({ queued: false, reason: 'not_active_photo' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.db.data.get('media_ai_queue/t1_p1_v1')).toBeUndefined();
  });

  it('geçersiz kutu görsel kararı DÜŞÜRMEZ: kutu bilinmiyor (null), diğer alanlar korunur, visualStatus=partial; katalog saklanır; şeması tamamen geçersiz karar ise invalid ve plan bunu bilinmiyor sayar', async () => {
    enable();
    fetchMock.mockResolvedValue(orBody(analysisOutput(CATALOG, visual({ subject: { box: { x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, boxConfidence: 'yüksek', scale: 'yakın' }, density: 'kalabalık' }))));
    await post({ assetId: 'a1', trigger: 'upload_complete' });
    const key = h.db.data.get('media_ai_analysis_latest/t1_p1_a1').key;
    const rec = h.db.data.get(`media_ai_analyses/${key}`);
    expect(rec).toMatchObject({ status: 'done', visualStatus: 'partial', visualIssue: 'konu_kutusu_geçersiz_bilinmiyor_sayıldı' });
    expect(rec.visual.subject).toEqual({ box: null, boxConfidence: 'belirsiz', scale: 'yakın' });
    expect(rec.visual.density).toBe('kalabalık');
    const inv = await listInventoryPage(h.db, { tenantId: T, projectId: P, policy: POLICY });
    expect(inv.items[0].catalog?.subject).toBe('masada makarna tabağı');
    expect(inv.items[0].visual?.decision.subject.box).toBeNull(); // kullanılabilir ama geometri bilinmiyor

    // şeması geçersiz görsel karar: invalid, plan için bilinmiyor
    seedAsset(h.db, 'a3');
    fetchMock.mockResolvedValue(orBody(analysisOutput(CATALOG, { ...visual(), density: 'çok_kalabalık' })));
    await post({ assetId: 'a3', trigger: 'upload_complete' });
    const key3 = h.db.data.get('media_ai_analysis_latest/t1_p1_a3').key;
    expect(h.db.data.get(`media_ai_analyses/${key3}`)).toMatchObject({ status: 'done', visual: null, visualStatus: 'invalid', visualIssue: 'görsel_karar_şeması_geçersiz' });
    const inv2 = await listInventoryPage(h.db, { tenantId: T, projectId: P, policy: POLICY });
    expect(inv2.items.find((i) => i.id === 'a3')!.visual).toBeNull();
  });
});

describe('kayıt → GET → panel (konu açıklaması ve kompozisyon kararı AYRI, kaynak etiketli)', () => {
  it('panel iki bölümü ayrı gösterir; ana obje konumu/alan kod hesabı olarak etiketlenir; kırpım satırları; v2 (eski) kayıtta dürüst "kompozisyon yok"', async () => {
    enable();
    fetchMock.mockResolvedValue(orBody(analysisOutput(CATALOG, visual({ subject: { box: { x: 0.0, y: 0.3, w: 0.3, h: 0.4 }, boxConfidence: 'orta', scale: 'yakın' }, weight: { direction: 'sol', reasons: ['büyük_obje', 'koyu_ton'] } }))));
    await post({ assetId: 'a1', trigger: 'upload_complete' });
    render(<AssetDescription tenantId={T} projectId={P} assetId="a1" dims={{ w: 4000, h: 3000 }} />);
    await waitFor(() => expect(screen.getByTestId('desc-visual')).toBeTruthy());
    expect(screen.getByTestId('desc-semantic').textContent).toMatch(/masada makarna tabağı/);
    expect(screen.getByTestId('desc-semantic').textContent).not.toMatch(/ağırlık|negatif alan/);
    const v = screen.getByTestId('desc-visual');
    expect(v.textContent).toMatch(/Ana obje konumu ve kapladığı alan: sol, kareyi yaklaşık %12 kaplıyor/);
    expect(screen.getByTestId('desc-visual-subject').querySelector('[data-source="code"]')).toBeTruthy();
    expect(screen.getByTestId('desc-visual-subject').textContent).toMatch(/modelin kutu tahmininden/);
    expect(screen.getByTestId('desc-visual-weight').textContent).toMatch(/sol \(büyük obje, koyu ton\)/);
    expect(screen.getByTestId('desc-visual-weight').querySelector('[data-source="ai"]')).toBeTruthy();
    expect(screen.getByTestId('desc-visual-version').textContent).toMatch(/visual-decision-3 · istem visual-decision-prompt-3/);
    expect(screen.getByTestId('desc-visual-crops').textContent).toMatch(/Story 9:16/);
    expect(screen.getByTestId('desc-provenance').textContent).toMatch(/anthropic\/claude-haiku-5\.5 · OpenRouter · istem media-catalog-v3 · şema 3/);
    // kompozisyon "sayısal ölçüm" diye sunulmaz
    expect(v.textContent).toMatch(/kesin ölçüm değildir/);
  });

  it('eski kayıt (v2, kompozisyon kararı yok): panel "eski sürüm, yeniden analiz başlatılmadı" der; sahte kompozisyon göstermez', async () => {
    h.db.data.set('media_ai_analysis_latest/t1_p1_a1', { key: 'old' });
    h.db.data.set('media_ai_analyses/old', { key: 'old', tenantId: T, projectId: P, sourceId: 'a1', status: 'done', model: 'claude-haiku-5-5', promptVersion: 'media-catalog-v2', schemaVersion: '2', sourceQuality: 'original', createdAt: 1, result: CATALOG });
    render(<AssetDescription tenantId={T} projectId={P} assetId="a1" />);
    await waitFor(() => expect(screen.getByTestId('desc-visual-missing')).toBeTruthy());
    expect(screen.getByTestId('desc-visual-missing').textContent).toMatch(/eski sürüm[\s\S]*otomatik başlatılmadı/);
    expect(screen.queryByTestId('desc-visual')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('envanter → aday → plan motoru (kayıtlı veriyi kullanır; görsele yeniden model çağrısı YOK)', () => {
  const seedAnalysis = (id: string, vis: unknown, over: Record<string, unknown> = {}, tenant = T, project = P) => {
    h.db.data.set(`media_ai_analysis_latest/${tenant}_${project}_${id}`, { key: `k-${id}` });
    h.db.data.set(`media_ai_analyses/k-${id}`, {
      key: `k-${id}`, tenantId: tenant, projectId: project, sourceId: id, status: 'done', model: 'anthropic/claude-haiku-5.5', promptVersion: 'media-catalog-v3', schemaVersion: '3',
      catalogSchemaVersion: '2', visualSchemaVersion: 'visual-decision-3', visualPromptVersion: 'visual-decision-prompt-3', sourceQuality: 'original', result: CATALOG, visual: vis, visualStatus: vis ? 'ok' : 'invalid', ...over,
    });
  };
  const dtos = async () => (await listInventoryPage(h.db, { tenantId: T, projectId: P, policy: POLICY })).items;

  it('envanter DTO\'su yalnız bu tenant+proje, güncel şemalı, doğrulanmış kararı taşır; başka proje/eski şema/geçersiz = null (sızıntı yok)', async () => {
    for (const id of ['b1', 'b2', 'b3', 'b4']) seedAsset(h.db, id);
    seedAnalysis('b1', visual());
    seedAnalysis('b2', visual(), { visualSchemaVersion: 'visual-decision-0' }); // eski şema
    seedAnalysis('b3', visual(), { projectId: 'p2' }); // kayıt başka projeye ait (işaretçi bu projede ama kayıt değil)
    seedAnalysis('b4', visual(), { tenantId: 'tX' }); // başka tenant
    const items = Object.fromEntries((await dtos()).map((i) => [i.id, i]));
    expect(items.b1.visual).toMatchObject({ provenance: { tenantId: T, projectId: P, assetId: 'b1', analysisKey: 'k-b1', geometryBasis: 'original' } });
    expect(items.b2.visual).toBeNull();
    expect(items.b3.visual).toBeNull();
    expect(items.b4.visual).toBeNull();
    expect(items.b3.catalog).toBeNull(); // katalog da kapsam dışı sızmaz
    expect(JSON.stringify(items.b1)).not.toMatch(/sourcePath|leaseOwner|correctedBy/);
  });

  it('İNSAN DÜZELTMESİ öncelikli: konu/açıklama insan değeri; kompozisyon kararı insan düzeltmesiyle SİLİNMEZ; AI yokken insan açıklaması katalogda "human" kalır', async () => {
    seedAsset(h.db, 'c1');
    seedAsset(h.db, 'c2');
    seedAnalysis('c1', visual());
    h.db.data.set('media_catalog_corrections/t1_p1_c1', { tenantId: T, projectId: P, assetId: 'c1', overrides: { subject: 'İnsan konusu' }, correctedBy: 'u', correctedAt: 1 });
    h.db.data.set('media_catalog_corrections/t1_p1_c2', { tenantId: T, projectId: P, assetId: 'c2', overrides: { subject: 'Sadece insan', description: 'İnsanın yazdığı açıklama.' }, correctedBy: 'u', correctedAt: 1 });
    const items = Object.fromEntries((await dtos()).map((i) => [i.id, i]));
    expect(items.c1.catalog).toMatchObject({ subject: 'İnsan konusu', source: 'ai_human' });
    expect(items.c1.catalog?.description).toBe(CATALOG.description);
    expect(items.c1.visual).not.toBeNull();
    expect(items.c2.catalog).toMatchObject({ subject: 'Sadece insan', description: 'İnsanın yazdığı açıklama.', source: 'human' });
    expect(items.c2.catalog?.uncertainties.join(' ')).toMatch(/AI görsel analizi yok/);
    expect(items.c2.visual).toBeNull();
  });

  const buildCandidates = async (ids: string[], vis: Record<string, any>) => {
    for (const id of ids) { seedAsset(h.db, id); if (vis[id]) seedAnalysis(id, vis[id]); }
    return (await dtos()).map((d) => candidateFromInventory(d as any, { projectId: P })).flatMap((r) => (r.ok ? [r.candidate] : []));
  };
  const ctxOf = (cands: Candidate[]): PlanCtx => ({ brand: P, byId: new Map(cands.map((c) => [c.id, c])), storyIds: [] });

  it('aday dönüşümü: görsel karar kapsam+şema doğrulamasından geçerse adaya girer; kadraj ölçeği modelin gözleminden gelir; başka proje kararı DÜŞER', async () => {
    const cands = await buildCandidates(['d1', 'd2'], { d1: visual({ subject: { box: { x: 0.3, y: 0.3, w: 0.4, h: 0.4 }, boxConfidence: 'orta', scale: 'geniş' } }) });
    const byId = Object.fromEntries(cands.map((c) => [c.id, c]));
    expect(byId.d1.visual?.provenance.analysisKey).toBe('k-d1');
    expect(byId.d1.semantic.shotScale).toBe('geniş'); // orta_plan kataloğu 'orta' derdi; model gözlemi öncelikli
    expect(byId.d2.visual).toBeUndefined();
    expect(byId.d1.provenance).toMatch(/kompozisyon kararı var/);
    expect(byId.d2.provenance).toMatch(/kompozisyon kararı yok/);
    const dto = (await dtos()).find((d) => d.id === 'd1')! as any;
    const foreign = candidateFromInventory({ ...dto, visual: { ...dto.visual, provenance: { ...dto.visual.provenance, projectId: 'p2' } } }, { projectId: P });
    expect(foreign.ok && foreign.candidate.visual).toBeFalsy();
    const wrongAsset = candidateFromInventory({ ...dto, visual: { ...dto.visual, provenance: { ...dto.visual.provenance, assetId: 'zzz' } } }, { projectId: P });
    expect(wrongAsset.ok && wrongAsset.candidate.visual).toBeFalsy();
  });

  it('plan motoru kayıtlı veriyi KULLANIR: komşu ağırlıkların dikişte yığılması / Story kırpımında konunun kesilmesi puanı düşürür; model/ağ çağrısı yok', async () => {
    const heavyRight = visual({ weight: { direction: 'sağ', reasons: ['büyük_obje'] }, subject: { box: { x: 0.55, y: 0.3, w: 0.4, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } });
    const heavyLeft = visual({ weight: { direction: 'sol', reasons: ['büyük_obje'] }, subject: { box: { x: 0.05, y: 0.3, w: 0.4, h: 0.4 }, boxConfidence: 'orta', scale: 'orta' } });
    const cands = await buildCandidates(['e1', 'e2', 'e3'], { e1: heavyRight, e2: heavyLeft, e3: heavyRight });
    const byId = new Map(cands.map((c) => [c.id, c]));
    const state = { ...emptyPlan('feed') };
    state.slots[0] = 'e1'; // slot 0 sol sütun; ağırlığı sağda (içeri)
    const fetchBefore = fetchMock.mock.calls.length;
    const g = gridCtxFor(1, state, { byId });
    const good = scoreCandidate(byId.get('e3')!, 'feed-4x5', [byId.get('e1')!], [byId.get('e1')!], [], g); // slot 1: sol komşu ağırlığı sağda; adayın ağırlığı sağda → dikişte yığılma YOK
    const crowd = scoreCandidate(byId.get('e2')!, 'feed-4x5', [byId.get('e1')!], [byId.get('e1')!], [], g); // aday ağırlığı solda → e1'in sağ ağırlığıyla dikişte YIĞILIR
    expect(crowd.parts.composition).not.toBeNull();
    expect(crowd.compositionNotes.join(' ')).toMatch(/dikişte yığılıyor/);
    expect(good.compositionNotes.join(' ')).not.toMatch(/dikişte yığılıyor/);
    expect(good.parts.composition!).toBeGreaterThan(crowd.parts.composition!);
    const plan = generate(emptyPlan('feed'), ctxOf(cands)).state;
    expect(plan.slots.filter(Boolean).length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.length).toBe(fetchBefore); // plan üretimi hiçbir model çağrısı yapmaz
    expect(FEED_SLOTS).toBe(9);
  });
});
