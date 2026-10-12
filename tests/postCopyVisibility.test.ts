// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { fakeFirestore } from './helpers/fakeFirestore';
import { generateCopy, applyCropVisibility, BRAND_VOICE_COLLECTION, brandVoiceDocId, type CopyModelCall } from '@/api/_lib/planCopy/planCopy';
import { cropVisibility, VISUAL_SCHEMA_VERSION, cropWindow } from '@/shared/planner/visualDecision';
import { validateCopyRequest, mediaLine, type CopyMedia, type CatalogLite } from '@/shared/planner/copyContract';
import { ANALYSES, ANALYSIS_LATEST } from '@/api/_lib/mediaAnalysis/correctionStore';
import { seedAsset, POLICY, T, P } from './feedPlanner/integration/liveFixtures';
import { bundle, feedItem, req, out } from './planner/helpers';
import { unknownVisual, visual } from './helpers/visualFixture';

const CAT = {
  subject: 'masada makarna tabağı', description: 'Beyaz örtülü masada porselen tabakta makarna; yanında zeytin kasesi.', tags: ['makarna'], visibleObjects: ['tabak', 'zeytin kasesi'], foodCategories: ['makarna'],
  composition: { shotType: 'orta_plan', subjectPlacement: 'merkez', negativeSpace: true }, uncertainties: ['sos içeriği görünmüyor'], peoplePresent: false, usageSuggestions: ['feed'],
};
const FULL = { focus: { x: 0.5, y: 0.5 }, zoom: 1, version: 3 };
const seed = (db: any, id: string, vis: unknown, dims: { w: number; h: number } = { w: 1080, h: 1350 }) => {
  seedAsset(db, id, { w: dims.w, h: dims.h });
  db.data.set(`${ANALYSIS_LATEST}/${T}_${P}_${id}`, { key: `k-${id}` });
  db.data.set(`${ANALYSES}/k-${id}`, { key: `k-${id}`, tenantId: T, projectId: P, sourceId: id, status: 'done', sourceQuality: 'original', visualSchemaVersion: VISUAL_SCHEMA_VERSION, visualStatus: 'ok', visual: vis, result: CAT });
};
const model = (parsed: unknown) => vi.fn(async () => ({ id: 'resp-1', stopReason: 'end_turn', parsed })) as unknown as CopyModelCall & ReturnType<typeof vi.fn>;
const run = (db: any, call: CopyModelCall, items: any[], extra: Record<string, unknown> = {}) =>
  generateCopy(db, { callModel: call, policy: POLICY }, { tenantId: T, projectId: P, req: { ...req(items), ...extra } });
const withBundle = (db: any) => db.data.set(`${BRAND_VOICE_COLLECTION}/${brandVoiceDocId(T, P)}`, { tenantId: T, projectId: P, bundle: bundle(), updatedBy: 'a', updatedAt: 1 });
const item = (slot: number, id: string, crop?: any) => ({ ...feedItem(slot, id), ...(crop ? { crop } : {}) });
const sent = (call: any) => call.mock.calls[0][0] as { system: string; user: string };

describe('kırpım görünürlüğü (kod, sunucu ve istemci ortak)', () => {
  const dims = { w: 4000, h: 3000 };
  it('tam kare (4:5 kaynak, zoom 1): kırpılmış değil → olgular tam; yatay kaynak 4:5\'e kırpılınca kırpılmış', () => {
    expect(cropVisibility(visual(), { w: 1080, h: 1350 }, 0.8, { x: 0.5, y: 0.5 }, 1)).toMatchObject({ cropped: false, facts: 'tam' });
    expect(cropVisibility(visual(), dims, 0.8, { x: 0.5, y: 0.5 }, 1)).toMatchObject({ cropped: true, facts: 'yalnız_konu', subject: 'visible' });
  });
  it('ana konu kırpım DIŞINDA / kısmen kesik / kutu bilinmiyor → görünür olgu YOK', () => {
    const left = visual({ subject: { box: { x: 0.02, y: 0.3, w: 0.15, h: 0.4 }, boxConfidence: 'yüksek', scale: 'orta' } });
    const w = cropWindow(dims, 0.8, { x: 0.9, y: 0.5 }, 1);
    expect(w.x).toBeGreaterThan(0.3);
    expect(cropVisibility(left, dims, 0.8, { x: 0.9, y: 0.5 }, 1)).toMatchObject({ subject: 'outside', facts: 'yok' });
    const wide = visual({ subject: { box: { x: 0.1, y: 0.3, w: 0.8, h: 0.4 }, boxConfidence: 'yüksek', scale: 'geniş' } });
    expect(cropVisibility(wide, dims, 0.8, { x: 0.5, y: 0.5 }, 1)).toMatchObject({ subject: 'partial', facts: 'yok' });
    expect(cropVisibility(unknownVisual(), dims, 0.8, { x: 0.5, y: 0.5 }, 1)).toMatchObject({ subject: 'unknown', facts: 'yok' });
    expect(cropVisibility(null, dims, 0.8, { x: 0.5, y: 0.5 }, 1)).toMatchObject({ subject: 'unknown', facts: 'yok' });
    expect(cropVisibility(visual({ subject: { box: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, boxConfidence: 'belirsiz', scale: 'orta' } }), dims, 0.8, { x: 0.5, y: 0.5 }, 1).facts).toBe('yok');
  });
});

describe('istek doğrulama: crop alanı', () => {
  const ok = (crop: unknown, lane = 'feed') => validateCopyRequest({ projectId: 'p1', weekStart: '2026-10-12', items: [lane === 'feed' ? { ...feedItem(0, 'a1'), crop } : { slotKey: 'story:0', mediaId: 'a1', lane: 'story', role: 'headline', seriesKey: null, crop }] }).ok;
  it('geçerli kırpım kabul; aralık dışı odak/zoom, bilinmeyen alan, geçersiz sürüm ve STORY\'de kırpım reddedilir', () => {
    expect(ok(FULL)).toBe(true);
    for (const bad of [{ ...FULL, focus: { x: 2, y: 0.5 } }, { ...FULL, zoom: 3 }, { ...FULL, zoom: 0.5 }, { ...FULL, version: -1 }, { ...FULL, version: 1.5 }, { ...FULL, extra: 1 }, { ...FULL, focus: { x: 0.5, y: 0.5, z: 1 } }, 'x', null]) {
      expect(ok(bad), JSON.stringify(bad)).toBe(false);
    }
    expect(ok(FULL, 'story')).toBe(false);
  });
});

describe('caption girdisi yalnız KIRPIMDA GÖRÜNÜR olgularla (sunucu hesabı; istemci iddiasına güvenilmez)', () => {
  const dims = { w: 4000, h: 3000 };
  it('KIRPILMAMIŞ (tam kare): katalog olguları görünür; satırda kırpım notu yok', async () => {
    const db = fakeFirestore();
    seed(db, 'a1', visual());
    withBundle(db);
    const call = model(out([{ slotKey: 'feed:0', caption: 'Beyaz örtülü masada porselen tabakta makarna; yanında zeytin kasesi duruyor.', evidenceBasis: 'katalog_gozlem' }]));
    const r = await run(db, call, [item(0, 'a1', FULL)]);
    expect(sent(call).user).toMatch(/açıklama:Beyaz örtülü masada porselen tabakta makarna; yanında zeytin kasesi/);
    expect(sent(call).user).not.toMatch(/kırpım:4x5_kırpıldı/);
    expect(r.accepted[0].crop).toEqual({ version: 3, facts: 'tam' });
  });

  it('KIRPILMIŞ + ana konu görünür: yalnız ANA KONU taşınır; açıklama/nesne/etiket (kırpım dışı olabilir) prompt\'a girmez; kullanılırsa REDDEDİLİR', async () => {
    const db = fakeFirestore();
    seed(db, 'a1', visual(), dims);
    withBundle(db);
    const call = model(out([{ slotKey: 'feed:0', caption: 'Masada makarna tabağı; yanında zeytin kasesi de var.', evidenceBasis: 'katalog_gozlem' }]));
    const r = await run(db, call, [item(0, 'a1', FULL)]);
    const u = sent(call).user;
    expect(u).toMatch(/konu:masada makarna tabağı/);
    expect(u).toMatch(/kırpım:4x5_kırpıldı \| görünür_olgu:yalnız_ana_konu/);
    expect(u).not.toMatch(/zeytin|açıklama:|nesneler:|etiket:|kategori:/);
    expect(sent(call).system).toMatch(/kırpım:.* yalnız satırda verilen GÖRÜNÜR olgulara dayan/);
    // model yine de kırpım dışında kalmış olabilecek nesneyi yazarsa doğrulama reddeder
    expect(r.accepted).toEqual([]);
    expect(r.rejected[0].reasons).toEqual(expect.arrayContaining(['kanıtsız_içerik:zeytin']));
    // yalnız ana konuyu yazan metin kabul edilir ve kapsamı etiketler
    const ok = model(out([{ slotKey: 'feed:0', caption: 'Masada makarna tabağı; sofra kuruldu.', evidenceBasis: 'katalog_gozlem' }]));
    const r2 = await run(db, ok, [item(0, 'a1', FULL)]);
    expect(r2.accepted).toHaveLength(1);
    expect(r2.accepted[0].crop).toEqual({ version: 3, facts: 'yalnız_konu' });
    expect(r2.voice.assumptions.join(' ')).toMatch(/yalnız ana konunun görünürlüğü doğrulandı/);
  });

  it('KIRPILMIŞ + ana konu kırpım DIŞINDA/kısmen: slot modele GİTMEZ (ücret yok), neden kirpimda_gorunur_olgu_yok; paket modunda da', async () => {
    const left = visual({ subject: { box: { x: 0.02, y: 0.3, w: 0.15, h: 0.4 }, boxConfidence: 'yüksek', scale: 'orta' } });
    for (const mode of ['bundle', 'tone'] as const) {
      const db = fakeFirestore();
      seed(db, 'a1', left, dims);
      if (mode === 'bundle') withBundle(db);
      const call = model(out([{ slotKey: 'feed:0', caption: 'Masada makarna tabağı.', evidenceBasis: 'katalog_gozlem' }]));
      const r = await run(db, call, [item(0, 'a1', { focus: { x: 0.9, y: 0.5 }, zoom: 1, version: 1 })], mode === 'tone' ? { tempTone: { label: 'zarif' } } : {});
      expect(call, mode).not.toHaveBeenCalled();
      expect(r.accepted, mode).toEqual([]);
      expect(r.rejected, mode).toEqual([{ slotKey: 'feed:0', reasons: ['kirpimda_gorunur_olgu_yok'] }]);
      expect(r.voice.assumptions.join(' '), mode).toMatch(/kırpımda ana konunun görünürlüğü doğrulanamadı/);
    }
  });

  it('görünürlük doğrulanamıyor (kutu bilinmiyor / analiz yok) → kırpılmış öğede görünür olgu YOK; kırpılmamış öğede olgular korunur', async () => {
    const db = fakeFirestore();
    seed(db, 'a1', unknownVisual(), dims);
    seedAsset(db, 'a2', { w: 4000, h: 3000 }); // analiz hiç yok
    withBundle(db);
    const call = model(out([]));
    const r = await run(db, call, [item(0, 'a1', FULL), item(1, 'a2', FULL)]);
    expect(call).not.toHaveBeenCalled();
    expect(r.rejected.map((x) => x.reasons[0]).sort()).toEqual(['kirpimda_gorunur_olgu_yok', 'semantik_aciklama_yok']);
    const db2 = fakeFirestore();
    seed(db2, 'a1', unknownVisual());
    withBundle(db2);
    const call2 = model(out([{ slotKey: 'feed:0', caption: 'Beyaz örtülü masada porselen tabakta makarna.', evidenceBasis: 'katalog_gozlem' }]));
    const r2 = await run(db2, call2, [item(0, 'a1', FULL)]);
    expect(r2.accepted).toHaveLength(1); // 4:5 kaynak, kırpım yok → olgular tam görünür
  });

  it('İSTEMCİ İDDİASINA GÜVENİLMEZ: yalnız odak/zoom/sürüm alınır; görünürlük sunucudaki kayıtlı analiz + asıl boyuttan hesaplanır', async () => {
    const left = visual({ subject: { box: { x: 0.02, y: 0.3, w: 0.15, h: 0.4 }, boxConfidence: 'yüksek', scale: 'orta' } });
    const db = fakeFirestore();
    seed(db, 'a1', left, dims);
    withBundle(db);
    const call = model(out([]));
    const forged = { ...item(0, 'a1', { focus: { x: 0.9, y: 0.5 }, zoom: 1, version: 1 }), visibility: { facts: 'tam' }, visibleObjects: ['zeytin'] };
    const r = await run(db, call, [forged]);
    expect(call).not.toHaveBeenCalled();
    expect(r.rejected[0].reasons).toEqual(['kirpimda_gorunur_olgu_yok']);
  });

  it('applyCropVisibility: verilen kırpımda katalog daraltılır, doğrulanmış ürün yalnız ana konu görünürse kalır; crop olmayan öğeye dokunulmaz', () => {
    const lite = (): CatalogLite => ({ subject: 'S', description: 'D', tags: ['t'], foodCategories: ['f'], visibleObjects: ['o'], uncertainties: [] });
    const m = (): CopyMedia => ({ mediaId: 'a1', kind: 'photo', width: 4000, height: 3000, catalog: lite(), verifiedProductIds: ['urun-1'] });
    const mk = (box: any) => new Map([['a1', visual({ subject: { box, boxConfidence: 'yüksek', scale: 'orta' } })]]);
    const item0 = { slotKey: 'feed:0', mediaId: 'a1', lane: 'feed' as const, role: 'caption' as const, crop: { focus: { x: 0.5, y: 0.5 }, zoom: 1, version: 1 } };
    const a = new Map([['a1', m()]]);
    expect(applyCropVisibility(a, mk({ x: 0.4, y: 0.3, w: 0.2, h: 0.4 }), [item0]).size).toBe(0);
    expect(a.get('a1')!.catalog).toMatchObject({ subject: 'S', description: '', visibleObjects: [], tags: [] });
    expect(a.get('a1')!.verifiedProductIds).toEqual(['urun-1']);
    const b = new Map([['a1', m()]]);
    expect([...applyCropVisibility(b, mk({ x: 0.0, y: 0.3, w: 0.1, h: 0.4 }), [{ ...item0, crop: { ...item0.crop, focus: { x: 0.9, y: 0.5 } } }])]).toEqual(['a1']);
    expect(b.get('a1')!.catalog).toBeNull();
    expect(b.get('a1')!.verifiedProductIds).toEqual([]);
    const c = new Map([['a1', m()]]);
    applyCropVisibility(c, mk({ x: 0, y: 0, w: 1, h: 1 }), [{ slotKey: 'feed:0', mediaId: 'a1', lane: 'feed', role: 'caption' }]);
    expect(c.get('a1')!.catalog).toMatchObject({ description: 'D' });
    expect(c.get('a1')!.visibility).toBeUndefined();
  });

  it('applyCropVisibility: KATALOG YOK + doğrulanmış ürün + kırpılmış + analiz yok → facts=yok, ürün bağı düşer, medya blocked içinde (tutarlı sözleşme)', () => {
    const noCat = (): CopyMedia => ({ mediaId: 'x', kind: 'photo', width: 1500, height: 1000, catalog: null, verifiedProductIds: ['verified-id'] });
    const crop = { focus: { x: 0.5, y: 0.5 }, zoom: 2, version: 1 };
    const it0 = { slotKey: 'feed:0', mediaId: 'x', lane: 'feed' as const, role: 'caption' as const, crop };
    const a = new Map([['x', noCat()]]);
    const blocked = applyCropVisibility(a, new Map(), [it0]);
    expect(blocked.has('x')).toBe(true);
    expect(a.get('x')!.visibility).toMatchObject({ cropped: true, facts: 'yok' });
    expect(a.get('x')!.verifiedProductIds).toEqual([]);
    // NEGATİF: kırpım yoksa (veya tam kare) hiçbir şey engellenmez ve ürün bağı korunur
    const b = new Map([['x', { ...noCat(), width: 1080, height: 1350 }]]);
    expect(applyCropVisibility(b, new Map(), [{ ...it0, crop: { ...crop, zoom: 1 } }]).size).toBe(0);
    expect(b.get('x')!.verifiedProductIds).toEqual(['verified-id']);
    const c = new Map([['x', noCat()]]);
    expect(applyCropVisibility(c, new Map(), [{ slotKey: 'feed:0', mediaId: 'x', lane: 'feed' as const, role: 'caption' as const }]).size).toBe(0);
    expect(c.get('x')!.verifiedProductIds).toEqual(['verified-id']);
  });

  it('810×1000 kaynak 4:5 kırpımda kesilen kenar "tam kare" sayılmaz: konu bilinmiyorsa facts=yok', () => {
    const m: CopyMedia = { mediaId: 'x', kind: 'photo', width: 810, height: 1000, catalog: { subject: 'S', description: 'D', tags: [], foodCategories: [], visibleObjects: ['o'], uncertainties: [] }, verifiedProductIds: [] };
    const map = new Map([['x', m]]);
    const blocked = applyCropVisibility(map, new Map(), [{ slotKey: 'feed:0', mediaId: 'x', lane: 'feed', role: 'caption', crop: { focus: { x: 0.5, y: 0.5 }, zoom: 1, version: 1 } }]);
    expect(blocked.has('x')).toBe(true);
    expect(map.get('x')!.visibility).toMatchObject({ cropped: true, facts: 'yok' });
    expect(map.get('x')!.catalog).toBeNull();
  });

  it('mediaLine: kırpılmış öğede görünür olgu kapsamı açıkça yazılır; boş açıklama satıra girmez', () => {
    const m: CopyMedia = { mediaId: 'a1', kind: 'photo', catalog: { subject: 'S', description: '', tags: [], foodCategories: [], visibleObjects: [], uncertainties: [] }, verifiedProductIds: [], visibility: { cropped: true, facts: 'yalnız_konu' } };
    const line = mediaLine(m, { slotKey: 'feed:0', mediaId: 'a1', lane: 'feed', role: 'caption' } as any, bundle());
    expect(line).toMatch(/konu:S/);
    expect(line).not.toMatch(/açıklama:/);
    expect(line).toMatch(/kırpım:4x5_kırpıldı \| görünür_olgu:yalnız_ana_konu\(nesne\/ayrıntı_görünürlüğü_doğrulanmadı\)/);
  });
});
