import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { z } from 'zod/v4';
import { fakeFirestore } from './helpers/fakeFirestore';
import { PUBLISHED_FUTURE_SKEW_MS, listInventoryPage, validPublishedMs } from '@/api/_lib/plannerInventory/plannerInventory';
import { candidateFromInventory } from '@/studio/feedPlanner/integration/fromInventory';
import { VisualDecisionSchema, parseAnalysisOutput, VISUAL_SYSTEM_PROMPT } from '@/api/_lib/mediaAnalysis/visualSpec';
import { ANALYSES, ANALYSIS_LATEST } from '@/api/_lib/mediaAnalysis/correctionStore';
import { FIELD_KEYS, SURROUND_RELATION, SURROUND_SETTING, VISUAL_PROMPT_VERSION, VISUAL_SCHEMA_VERSION } from '@/shared/planner/visualDecision';
import { analysisKey } from '@/api/_lib/mediaAnalysis/spec';
import { seedAsset, POLICY, T, P } from './feedPlanner/integration/liveFixtures';
import { unknownVisual, visual } from './helpers/visualFixture';

const api = vi.hoisted(() => ({ getMediaAnalysis: vi.fn() }));
vi.mock('@/studio/mediaIntegrationsApi', async (orig) => ({ ...(await orig<any>()), getMediaAnalysis: (...a: any[]) => api.getMediaAnalysis(...a) }));
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: vi.fn() }));
import { AssetDescription } from '@/studio/components/AssetDescription';

const NOW = Date.UTC(2026, 9, 12, 12, 0, 0);
const DAY = 86_400_000;
const post = (over: Record<string, unknown>) => ({ tenantId: T, projectId: P, libraryAssetIds: ['m1'], ...over });
const inv = async (posts: Record<string, any>) => {
  const db = fakeFirestore();
  seedAsset(db, 'm1');
  seedAsset(db, 'm2');
  for (const [id, v] of Object.entries(posts)) db.data.set(`social_media_posts/${id}`, v);
  const page = await listInventoryPage(db, { tenantId: T, projectId: P, policy: POLICY, now: NOW });
  return Object.fromEntries(page.items.map((i) => [i.id, i]));
};

describe('lastUsedAt: yalnız doğrulanmış YAYIN kaydından; yoksa null = bilinmiyor', () => {
  it('yayınlanmış post\'ların en yeni publishedAt değeri; planlanmış/onaylı tarih (scheduledAt) HİÇBİR koşulda kullanılmaz', async () => {
    const items = await inv({
      a: post({ status: 'published', publishedAt: NOW - 30 * DAY, scheduledAt: NOW - 31 * DAY }),
      b: post({ status: 'published', publishedAt: NOW - 10 * DAY, scheduledAt: NOW + 9 * DAY }), // zamanlama ileride ama yayın tarihi esas
      c: post({ status: 'scheduled', scheduledAt: NOW - 1 * DAY }),
      d: post({ status: 'approved', scheduledAt: NOW - 1 * DAY, approvedAt: NOW - 1 * DAY }),
    });
    expect(items.m1.usage.lastUsedAt).toBe(NOW - 10 * DAY);
    expect(items.m1.usage).toMatchObject({ usedInPostCount: 4, approvedUseCount: 4, pendingUseCount: 0 }); // sayaçlar tüm kayıtlı post'lar
  });

  it('yalnız planlanmış/onaylı/inceleme post\'ları varsa null (kullanıldı sayılır ama SON KULLANIM tarihi bilinmiyor); hiç post yoksa null', async () => {
    const items = await inv({
      c: post({ status: 'scheduled', scheduledAt: NOW - DAY }),
      d: post({ status: 'approved', scheduledAt: NOW + DAY }),
      e: post({ status: 'internal_review', createdAt: NOW - DAY }),
    });
    expect(items.m1.usage).toMatchObject({ usedInPostCount: 3, lastUsedAt: null });
    expect(items.m2.usage).toMatchObject({ usedInPostCount: 0, lastUsedAt: null });
  });

  it('hatalı yayın kaydı alınmaz: tarihsiz, 0/negatif, NaN, metin, gelecekteki (>1 gün) yayın tarihi → null; sınırdaki makul saat kayması kabul', async () => {
    for (const bad of [undefined, null, 0, -5, NaN, 'dün', {}, NOW + PUBLISHED_FUTURE_SKEW_MS + 1, NOW + 400 * DAY]) {
      const items = await inv({ x: post({ status: 'published', publishedAt: bad }) });
      expect(items.m1.usage.lastUsedAt, String(bad)).toBeNull();
      expect(items.m1.usage.usedInPostCount).toBe(1);
    }
    expect((await inv({ x: post({ status: 'published', publishedAt: NOW + 3_600_000 }) })).m1.usage.lastUsedAt).toBe(NOW + 3_600_000);
  });

  it('YANLIŞ kapsam alınmaz: başka tenant/proje post\'u (daha yeni yayın tarihli olsa da) görmezden gelinir', async () => {
    const items = await inv({
      ok: post({ status: 'published', publishedAt: NOW - 20 * DAY }),
      t2: post({ tenantId: 't2', status: 'published', publishedAt: NOW - 1 * DAY }),
      p2: post({ projectId: 'pX', status: 'published', publishedAt: NOW - 2 * DAY }),
      other: post({ libraryAssetIds: ['m2'], status: 'published', publishedAt: NOW - 3 * DAY }),
    });
    expect(items.m1.usage.lastUsedAt).toBe(NOW - 20 * DAY);
    expect(items.m2.usage.lastUsedAt).toBe(NOW - 3 * DAY);
  });

  it('Firestore Timestamp benzeri değer (toMillis) kabul edilir; güncel zamandan TÜRETİLMEZ: now değişse de tarih aynı kalır', async () => {
    const ts = { toMillis: () => NOW - 7 * DAY };
    const db = fakeFirestore();
    seedAsset(db, 'm1');
    db.data.set('social_media_posts/a', post({ status: 'published', publishedAt: ts }));
    const a = await listInventoryPage(db, { tenantId: T, projectId: P, policy: POLICY, now: NOW });
    const b = await listInventoryPage(db, { tenantId: T, projectId: P, policy: POLICY, now: NOW + 5 * DAY });
    expect(a.items[0].usage.lastUsedAt).toBe(NOW - 7 * DAY);
    expect(b.items[0].usage.lastUsedAt).toBe(NOW - 7 * DAY);
    expect(validPublishedMs({ status: 'draft', publishedAt: NOW - DAY }, NOW)).toBeNull();
  });

  it('DTO → aday: doğrulanmış tarih taşınır; yok/geçersiz/eski DTO (alan yok) → null; zincirin sonunda aday.usage.lastUsedAt', async () => {
    const items = await inv({ a: post({ status: 'published', publishedAt: NOW - 12 * DAY }) });
    const r = candidateFromInventory(items.m1 as any, { projectId: P });
    expect(r.ok && r.candidate.usage).toEqual({ usedInPostCount: 1, approvedUseCount: 1, pendingUseCount: 0, lastUsedAt: NOW - 12 * DAY });
    const none = candidateFromInventory(items.m2 as any, { projectId: P });
    expect(none.ok && none.candidate.usage?.lastUsedAt).toBeNull();
    const legacy = candidateFromInventory({ ...(items.m1 as any), usage: { usedInPostCount: 1, approvedUseCount: 1, pendingUseCount: 0 } }, { projectId: P });
    expect(legacy.ok && legacy.candidate.usage?.lastUsedAt).toBeNull();
    for (const bad of [NaN, -1, 0, '123', Infinity]) {
      const x = candidateFromInventory({ ...(items.m1 as any), usage: { ...items.m1.usage, lastUsedAt: bad } }, { projectId: P });
      expect(x.ok && x.candidate.usage?.lastUsedAt, String(bad)).toBeNull();
    }
  });
});

const catalog = {
  subject: 'masada tatlı', description: 'Beyaz tabakta bir dilim tatlı.', tags: [], visibleObjects: [], foodCategories: [],
  composition: { shotType: 'yakın_çekim', orientation: 'dikey', hasTextOverlay: false, subjectPlacement: 'merkez', negativeSpace: true },
  productIdentity: { status: 'belirsiz', note: '' }, usageSuggestions: [], peoplePresent: false, uncertainties: [], planningNotes: [], overallConfidence: 'orta',
};

describe('konu–çevre ilişkisi (surroundings): yapılandırılmış alan, açık unknown, kaynak/güven/not', () => {
  it('şema: relation + setting enum\'ları belirsiz içerir; alan güveni ve notu context anahtarını kullanır; sürümler v3', () => {
    const js: any = z.toJSONSchema(VisualDecisionSchema, { target: 'draft-7', reused: 'inline' });
    expect(js.properties.surroundings.properties.relation.enum).toEqual([...SURROUND_RELATION]);
    expect(js.properties.surroundings.properties.setting.enum).toEqual([...SURROUND_SETTING]);
    expect(SURROUND_RELATION).toContain('belirsiz');
    expect(SURROUND_SETTING).toContain('belirsiz');
    expect(js.required).toContain('surroundings');
    expect(js.properties.surroundings.additionalProperties).toBe(false);
    expect(js.properties.fieldConfidence.required).toContain('context');
    expect(js.properties.fieldConfidence.properties.context.enum).toContain('belirsiz');
    expect(js.properties.fieldNotes.items.properties.field.enum).toContain('context');
    expect([...FIELD_KEYS]).toContain('context');
    expect(VISUAL_SCHEMA_VERSION).toBe('visual-decision-3');
    expect(VISUAL_PROMPT_VERSION).toBe('visual-decision-prompt-3');
  });

  it('görünenden desteklenmeyen çevre/kimlik iddiası ŞEMAYA SOKULAMAZ: serbest metin yer/marka/işletme adı reddedilir; yalnız kaba enum', () => {
    const base = visual();
    for (const bad of [{ relation: 'Starbucks Kadıköy', setting: 'iç_mekan' }, { relation: 'izole', setting: 'Paris, Eyfel Kulesi' }, { relation: 'izole' }, undefined]) {
      expect(VisualDecisionSchema.safeParse({ ...base, surroundings: bad }).success, JSON.stringify(bad)).toBe(false);
      expect(parseAnalysisOutput({ catalog, visual: { ...base, surroundings: bad } })).toMatchObject({ ok: true, visual: null, visualStatus: 'invalid' });
    }
    expect(VISUAL_SYSTEM_PROMPT).toMatch(/surroundings: .*YALNIZ görüntüde açıkça görünenden/);
    expect(VISUAL_SYSTEM_PROMPT).toMatch(/Mekan, işletme, şehir, marka veya kişi adı\/kimliği ÇIKARMA/);
    expect(VISUAL_SYSTEM_PROMPT).toMatch(/fieldNotes \(context\)/);
  });

  it('geçerli değer korunur; bilinmeyen "belirsiz" olarak kalır (başka değere çevrilmez); alan notu ve güven kaydedilir', () => {
    const v = visual({ surroundings: { relation: 'bağlam_içinde', setting: 'iç_mekan' }, fieldNotes: [{ field: 'context', note: 'arka planda masa ve pencere görünüyor' }] });
    const r = parseAnalysisOutput({ catalog, visual: v });
    expect(r).toMatchObject({ ok: true, visualStatus: 'ok' });
    if (r.ok) {
      expect(r.visual!.surroundings).toEqual({ relation: 'bağlam_içinde', setting: 'iç_mekan' });
      expect(r.visual!.fieldNotes).toEqual([{ field: 'context', note: 'arka planda masa ve pencere görünüyor' }]);
      expect(r.visual!.fieldConfidence.context).toBe('orta');
    }
    const u = parseAnalysisOutput({ catalog, visual: unknownVisual() });
    if (u.ok) {
      expect(u.visual!.surroundings).toEqual({ relation: 'belirsiz', setting: 'belirsiz' });
      expect(u.visual!.fieldConfidence.context).toBe('belirsiz');
    }
  });

  it('sürüm/cache: analiz anahtarı kırpım+model+katalog şeması değişince ayrışır; görsel sürüm sabitleri anahtara girer (v3 kayıt ≠ v2 anahtarı)', () => {
    const b = { tenantId: 't', projectId: 'p', sourceKind: 'brand_media', sourceId: 'a', sourceSha256: 'h', sourceQuality: 'original' as const, model: 'anthropic/claude-haiku-5.5' };
    expect(analysisKey(b)).toBe(analysisKey({ ...b }));
    expect(analysisKey(b)).not.toBe(analysisKey({ ...b, crop: 'story' }));
    expect(analysisKey(b)).not.toBe(analysisKey({ ...b, model: 'anthropic/claude-sonnet-5.5' }));
  });

  describe('envanter/panel aktarımı', () => {
    const rec = (over: Record<string, unknown> = {}) => ({
      key: 'k1', tenantId: T, projectId: P, sourceId: 'm1', status: 'done', sourceQuality: 'original', model: 'anthropic/claude-haiku-5.5', promptVersion: 'media-catalog-v3', schemaVersion: '3',
      visualSchemaVersion: VISUAL_SCHEMA_VERSION, visualPromptVersion: VISUAL_PROMPT_VERSION, visualStatus: 'ok', visual: visual({ surroundings: { relation: 'izole', setting: 'düz_zemin' } }), result: catalog, ...over,
    });
    const load = async (r: Record<string, unknown>) => {
      const db = fakeFirestore();
      seedAsset(db, 'm1');
      db.data.set(`${ANALYSIS_LATEST}/${T}_${P}_m1`, { key: 'k1' });
      db.data.set(`${ANALYSES}/k1`, r);
      return (await listInventoryPage(db, { tenantId: T, projectId: P, policy: POLICY, now: NOW })).items[0];
    };

    it('envanter DTO\'su surroundings\'i taşır; v2 (alan yok) kayıt "eski şema" olarak planda KULLANILMAZ ve alan uydurulmaz', async () => {
      const cur = await load(rec());
      expect(cur.visual!.decision.surroundings).toEqual({ relation: 'izole', setting: 'düz_zemin' });
      const { surroundings, ...rest } = visual() as any;
      void surroundings;
      const old = await load(rec({ visualSchemaVersion: 'visual-decision-2', visual: rest }));
      expect(old.visual).toBeNull();
      expect(old.catalog?.subject).toBe('masada tatlı'); // konu kataloğu etkilenmez
    });

    beforeEach(() => api.getMediaAnalysis.mockReset());
    afterEach(() => cleanup());
    const resp = (analysis: any) => ({ enabled: true, scope: { tenantId: T, projectId: P, assetId: 'm1' }, serverNow: NOW, analysis, queue: { state: 'ok', job: null }, correction: { state: 'ok', value: null }, effective: null, products: { state: 'none', items: [] } });
    const panel = () => render(<AssetDescription tenantId={T} projectId={P} assetId="m1" />);

    it('panel: ilişki + çevre türü model gözlemi ve alan güveniyle; belirsiz açıkça "belirsiz"; alan notu görünür', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp(rec({ visual: visual({ surroundings: { relation: 'iç_içe', setting: 'belirsiz' }, fieldNotes: [{ field: 'context', note: 'çevre kadrajın dışında kalıyor' }], fieldConfidence: { ...visual().fieldConfidence, context: 'düşük' } }) })));
      panel();
      await waitFor(() => expect(screen.getByTestId('desc-visual-surroundings')).toBeTruthy());
      const el = screen.getByTestId('desc-visual-surroundings');
      expect(el.textContent).toMatch(/iç içe · çevre türü belirsiz/);
      expect(el.textContent).toMatch(/güven: düşük/);
      expect(el.querySelector('[data-source="ai"]')).toBeTruthy();
      expect(screen.getByTestId('desc-visual-notes').textContent).toMatch(/context: çevre kadrajın dışında kalıyor/);
    });

    it('panel: alan hiç yoksa (eski biçim) "bu kayıtta yok" der, ilişki UYDURMAZ; eski şema sürümlü kayıt hiç gösterilmez', async () => {
      const { surroundings, ...rest } = visual() as any;
      void surroundings;
      api.getMediaAnalysis.mockResolvedValue(resp(rec({ visual: rest })));
      const a = panel();
      await waitFor(() => expect(screen.getByTestId('desc-visual-surroundings-missing')).toBeTruthy());
      expect(screen.queryByTestId('desc-visual-surroundings')).toBeNull();
      a.unmount();
      api.getMediaAnalysis.mockResolvedValue(resp(rec({ visualSchemaVersion: 'visual-decision-2', visual: rest })));
      panel();
      await waitFor(() => expect(screen.getByTestId('desc-visual-stale')).toBeTruthy());
      expect(screen.queryByTestId('desc-visual-surroundings')).toBeNull();
    });
  });
});
