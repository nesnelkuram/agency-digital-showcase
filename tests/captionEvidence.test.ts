// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { fakeFirestore } from './helpers/fakeFirestore';
import { generateCopy, BRAND_VOICE_COLLECTION, brandVoiceDocId, type CopyModelCall } from '@/api/_lib/planCopy/planCopy';
import { buildCopyPrompt, mediaLine, validateCopyOutput, type CopyMedia, type CatalogLite } from '@/shared/planner/copyContract';
import { ANALYSES, ANALYSIS_LATEST } from '@/api/_lib/mediaAnalysis/correctionStore';
import { seedAsset, POLICY, T, P } from './feedPlanner/integration/liveFixtures';
import { bundle, feedItem, req, out } from './planner/helpers';
import { visual } from './helpers/visualFixture';

const CAT: CatalogLite = { subject: 'masada makarna tabağı', description: 'Beyaz örtülü masada porselen tabakta makarna.', tags: ['makarna'], foodCategories: ['makarna'], visibleObjects: ['tabak'], uncertainties: ['sos içeriği görünmüyor'], shotType: 'yakın_çekim', subjectPlacement: 'merkez', negativeSpace: true, peoplePresent: false, source: 'ai', purposes: ['feed'] };
const media = (over: Partial<CopyMedia> = {}): CopyMedia => ({ mediaId: 'a1', kind: 'photo', width: 1080, height: 1350, catalog: CAT, verifiedProductIds: [], ...over });
const feed0 = { slotKey: 'feed:0', mediaId: 'a1', lane: 'feed' as const, role: 'caption' as const };
const R = (items: any[]) => ({ projectId: P, weekStart: '2026-10-12', items });
const GOOD = 'Beyaz örtülü masada porselen tabakta makarna; sofra sakin başlıyor.';
const ctx = (m = media()) => ({ media: new Map([['a1', m]]), bundle: bundle(), mode: 'tone' as const });
const one = (o: Record<string, unknown>, m = media()) => validateCopyOutput(out([{ slotKey: 'feed:0', caption: GOOD, evidenceBasis: 'katalog_gozlem', ...o }]), R([feed0]) as any, ctx(m));
const reasons = (v: ReturnType<typeof one>) => v.rejected[0]?.reasons ?? [];

describe('caption istemi: gerçek konu açıklaması + belirsizlik sınırı; kompozisyon terminolojisi YOK', () => {
  it('medya satırı konu/açıklama/nesne/belirsizlik/kaynak/amaç taşır; çekim, konu yeri, boş alan, ölçüm taşımaz', () => {
    const line = mediaLine(media(), { ...feed0 } as any, bundle());
    expect(line).toMatch(/konu:masada makarna tabağı/);
    expect(line).toMatch(/açıklama:Beyaz örtülü masada porselen tabakta makarna/);
    expect(line).toMatch(/nesneler:tabak/);
    expect(line).toMatch(/belirsiz:sos içeriği görünmüyor/);
    expect(line).toMatch(/kaynak:AI_gözlemi/);
    expect(line).toMatch(/amaç:feed/);
    expect(line).not.toMatch(/çekim:|konu_yeri|boş_alan|yakın_çekim|palet|kadraj|ölçülen/);
    const human = mediaLine(media({ catalog: { ...CAT, source: 'human', uncertainties: ['AI görsel analizi yok; yalnız insanın yazdığı açıklama var'] } }), { ...feed0 } as any, bundle());
    expect(human).toMatch(/kaynak:insan_açıklaması\(AI analizi yok\)/);
    const p = buildCopyPrompt(bundle(), R([feed0]) as any, new Map([['a1', media()]]));
    expect(p.system).toMatch(/Kompozisyon terimleri .* caption.a girmez/);
    expect(p.system).toMatch(/observation = .*caption\/headline\/body = .*rationale = /);
  });

  it('GERÇEK zincir: kayıtta kompozisyon kararı + renk/ağırlık alanları olsa bile caption istemine HİÇBİRİ sızmaz (yalnız konu açıklaması gider)', async () => {
    const db = fakeFirestore();
    seedAsset(db, 'a1');
    db.data.set(`${BRAND_VOICE_COLLECTION}/${brandVoiceDocId(T, P)}`, { tenantId: T, projectId: P, bundle: bundle(), updatedBy: 'a', updatedAt: 1 });
    db.data.set(`${ANALYSIS_LATEST}/${T}_${P}_a1`, { key: 'k1' });
    const v = visual({ color: { main: 'FUKSİYA', accents: ['TURKUAZ'], temperature: 'sıcak' }, weight: { direction: 'sağ', reasons: ['koyu_ton'] }, uncertainties: ['KOMPOZİSYON-BELİRSİZLİĞİ'] });
    db.data.set(`${ANALYSES}/k1`, { key: 'k1', tenantId: T, projectId: P, sourceId: 'a1', status: 'done', sourceQuality: 'original', visualSchemaVersion: 'visual-decision-3', visualStatus: 'ok', visual: v, result: { ...CAT, composition: { shotType: 'yakın_çekim', subjectPlacement: 'merkez', negativeSpace: true }, usageSuggestions: ['feed'] } });
    const call = vi.fn(async () => ({ id: 'r1', stopReason: 'end_turn', parsed: out([{ slotKey: 'feed:0', caption: GOOD, evidenceBasis: 'katalog_gozlem' }]) })) as unknown as CopyModelCall;
    const r = await generateCopy(db, { callModel: call, policy: POLICY }, { tenantId: T, projectId: P, req: req([feedItem(0, 'a1')]) });
    const sent = (call as any).mock.calls[0][0];
    const all = `${sent.system}\n${sent.user}`;
    expect(all).toMatch(/konu:masada makarna tabağı/);
    expect(all).not.toMatch(/FUKSİYA|TURKUAZ|KOMPOZİSYON-BELİRSİZLİĞİ|koyu_ton|çekim:|konu_yeri|boş_alan/);
    expect(r.accepted).toHaveLength(1);
  });
});

describe('gözlem / caption / rationale AYRI alanlar ve doğrulama', () => {
  it('metin varsa observation zorunlu; caption/rationale kopyası olamaz; uzun olamaz; kabul edilince ayrı alan olarak döner', () => {
    expect(reasons(one({ observation: '' }))).toContain('observation_boş');
    expect(reasons(one({ observation: GOOD }))).toContain('observation_başka_alanın_kopyası');
    expect(reasons(one({ observation: 'Persona kanaati.', rationale: 'Persona kanaati.' }))).toContain('observation_başka_alanın_kopyası');
    expect(reasons(one({ observation: 'x'.repeat(301) }))).toContain('observation_uzun');
    const ok = one({ observation: 'Masada porselen tabakta makarna var.', rationale: 'Konu açıklamasına dayanır; ton sakin.' });
    expect(ok.rejected).toEqual([]);
    expect(ok.accepted[0]).toMatchObject({ observation: 'Masada porselen tabakta makarna var.', rationale: 'Konu açıklamasına dayanır; ton sakin.' });
    expect(ok.accepted[0].text.caption).toBe(GOOD);
  });

  it('gözlem alanına da kanıtsız yiyecek/malzeme adı giremez (uydurma gözlem reddedilir)', () => {
    expect(reasons(one({ observation: 'Tabakta karides ve mozzarella görünüyor.' }))).toEqual(expect.arrayContaining(['gözlem_kanıtsız_içerik:karides', 'gözlem_kanıtsız_içerik:mozzarella']));
  });

  it('ÖLÇÜM kanıtı reddedilir (her modda); kompozisyon terimleri caption\'a girmez', () => {
    expect(reasons(one({ evidenceBasis: 'olculen_gorsel' }))).toContain('olculen_gorsel_caption_kanıtı_değil');
    const v = validateCopyOutput(out([{ slotKey: 'feed:0', caption: GOOD, evidenceBasis: 'olculen_gorsel' }]), R([feed0]) as any, { ...ctx(), mode: 'bundle' });
    expect(v.rejected[0].reasons).toContain('olculen_gorsel_caption_kanıtı_değil');
    for (const t of ['Makarna tabağı, sakin kadraj.', 'Makarna için geniş boş alan.', 'Makarna tabağında renk paleti sıcak.', 'Makarna, odak noktası tabak.', 'Makarna tabağı yakın çekim.', 'Makarna tabağı, kompozisyon dengeli.']) {
      expect(reasons(one({ caption: t })), t).toContain('yasak:kompozisyon_terimi');
    }
    expect(one({ caption: 'Makarna tabağında sakin bir sofra.' }).rejected).toEqual([]);
  });

  it('semantik açıklama yoksa katalog_gozlem kanıtı yok; yalnız ölçümden uydurma yapılamaz', () => {
    const v = one({}, media({ catalog: null }));
    expect(reasons(v)).toContain('katalog_gozlem_kanıtı_yok');
    const unfounded = one({ caption: 'Taş fırında pizza gibi sıcak bir kare.', evidenceBasis: 'katalog_gozlem' }, media({ catalog: null }));
    expect(reasons(unfounded)).toEqual(expect.arrayContaining(['katalog_gozlem_kanıtı_yok', 'kanıtsız_içerik:pizza']));
  });
});
