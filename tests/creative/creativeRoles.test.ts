// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CREATIVE_CACHE } from '@/api/_lib/creative/creative';
import { validateCreativeRequest, CREATIVE_PROMPT_VERSIONS, buildEvidence, fitBudget, BudgetExceeded } from '@/shared/planner/creativeContract';
import { bundle } from '../planner/helpers';
import { sha256Hex } from '@/shared/planner/sha256';
import { CAT, FULL, GUIDE, IDEA, DRAFT, CAPTION_OK, CAPTION_TEXT, CHECK_OK, IDEAS_OK, T, P, creativeCacheKey, ideasReq, captionReq, checkReq, run, catchErr, sentOf, mockDeps, seed, fresh, withBundle, withGuide, visual } from './fixtures';
import { ANALYSIS_LATEST, ANALYSES } from '@/api/_lib/mediaAnalysis/correctionStore';
import { fakeFirestore } from '../helpers/fakeFirestore';

const digestOf = async (db: any, over: Record<string, unknown> = {}) => (await run(db, mockDeps(), ideasReq(over))).evidence.digest;
const cacheDocs = (db: any) => [...db.data.keys()].filter((k: string) => k.startsWith(`${CREATIVE_CACHE}/`));

describe('istek sözleşmesi: seçimsiz caption/kontrol YOK', () => {
  const ok = (r: unknown) => validateCreativeRequest(r).ok;
  const dg = 'a'.repeat(32);
  it('ideas geçerli; caption/check SEÇİLMİŞ fikir (idea) olmadan geçersiz; ideas idea/caption taşıyamaz', () => {
    expect(ok(ideasReq())).toBe(true);
    expect(ok({ ...captionReq(dg), idea: undefined })).toBe(false);
    expect(ok({ ...checkReq(dg), idea: undefined })).toBe(false);
    expect(ok(captionReq(dg))).toBe(true);
    expect(ok(checkReq(dg))).toBe(true);
    expect(ok({ ...checkReq(dg), caption: undefined })).toBe(false);
    expect(ok({ ...ideasReq(), idea: IDEA })).toBe(false);
    expect(ok({ ...ideasReq(), evidenceDigest: dg })).toBe(false);
  });
  it('kırpım zorunlu (yalnız Post 4:5 son kırpım); aralık dışı/bilinmeyen alan/geçersiz kimlik reddedilir', () => {
    const r = ideasReq() as any;
    expect(ok({ ...r, crop: undefined })).toBe(false);
    for (const crop of [{ ...FULL, zoom: 3 }, { ...FULL, focus: { x: 2, y: 0 } }, { ...FULL, version: -1 }, { ...FULL, extra: 1 }]) expect(ok({ ...r, crop })).toBe(false);
    expect(ok({ ...r, extra: 1 })).toBe(false);
    expect(ok({ ...r, mediaId: '../x' })).toBe(false);
    expect(ok({ ...r, role: 'story' })).toBe(false);
    expect(ok({ ...captionReq(dg), evidenceDigest: 'zz' })).toBe(false);
    expect(ok({ ...captionReq(dg), idea: { ...IDEA, factIds: ['X1'] } })).toBe(false);
    expect(ok({ ...ideasReq(), intent: { kind: 'sat', text: '' } })).toBe(false);
    expect(ok({ ...ideasReq(), intent: { kind: 'hisset', text: 'x'.repeat(201) } })).toBe(false);
    expect(ok({ ...ideasReq(), recent: { ideas: Array(13).fill('a'), texts: [] } })).toBe(false);
    expect(ok({ ...checkReq(dg), caption: { ...DRAFT, sourceMap: Array(13).fill(DRAFT.sourceMap[0]) } })).toBe(false);
  });
});

describe('Rol 1 — fikir ajanı', () => {
  it('TEK model çağrısı; tam üç fikir, her birinin kaynak alanları kanıt kimlikleriyle doğrulanmış; kanıt görünür gerçekleri taşır', async () => {
    const db = fresh();
    const m = mockDeps();
    const r = await run(db, m, ideasReq({ intent: { kind: 'hisset', text: 'sakinlik' } }));
    expect(m.ideas).toHaveBeenCalledTimes(1);
    expect(m.caption).not.toHaveBeenCalled();
    expect(m.check).not.toHaveBeenCalled();
    expect(r.role).toBe('ideas');
    if (r.role !== 'ideas') throw 0;
    expect(r.status).toBe('ok');
    expect(r.ideas.map((i) => i.id)).toEqual(['i1', 'i2', 'i3']);
    const ids = new Set(r.evidence.facts.map((f) => f.id));
    for (const i of r.ideas) {
      expect(i.basis.factIds.length).toBeGreaterThan(0);
      for (const f of i.basis.factIds) expect(ids.has(f)).toBe(true);
      expect(i.interpretation).toBeTruthy(); // yaratıcı yorum olgudan AYRI alan
      expect(i.mainMessage).not.toBe(i.creativeAngle);
    }
    expect(r.evidence.facts.map((f) => `${f.id}:${f.kind}`)).toEqual(['F1:konu', 'F2:açıklama', 'F3:nesne', 'F4:nesne', 'F5:kategori']);
    expect(r.evidence.visibility).toEqual({ cropped: false, facts: 'tam' });
    expect(r.meta).toMatchObject({ requestedModel: 'mock/ideas', promptVersion: CREATIVE_PROMPT_VERSIONS.ideas, responseId: 'r-ideas' });
    expect(r.cached).toBe(false);
    expect(r.draftOnly).toBe(true);
    const s = sentOf(m.ideas);
    expect(s.user).toMatch(/F1 \[konu \| AI_gözlemi\]: masada makarna tabağı/);
    expect(s.user).toMatch(/niyet türü: hisset \| sakinlik/);
    expect(s.system).toMatch(/TAM ÜÇ/);
    expect(s.system).toMatch(/Caption YAZMAZSIN/);
    expect(s.user + s.system).not.toMatch(/olculen|ölçülen_görsel|baskın renkler|sıcak renk dengesi/);
  });

  it('bozuk üretim REDDEDİLİR ve önbelleğe YAZILMAZ: 2 fikir, aynı mesaj, bilinmeyen/boş dayanak, kanıtsız içerik, fiyat, İngilizce, kompozisyon terimi, yorum=mesaj', async () => {
    const mut = (f: (o: any) => void) => { const o = IDEAS_OK(); f(o); return o; };
    const cases: Array<[string, any, RegExp]> = [
      ['iki fikir', mut((o) => o.ideas.pop()), /fikir_sayısı_2/],
      ['aynı ana mesaj', mut((o) => { o.ideas[1].mainMessage = o.ideas[0].mainMessage; }), /yeterince_farklı_değil/],
      ['aynı açı', mut((o) => { o.ideas[2].creativeAngle = o.ideas[0].creativeAngle; }), /yeterince_farklı_değil/],
      ['bilinmeyen dayanak', mut((o) => { o.ideas[0].basisFactIds = ['F99']; }), /bilinmeyen_dayanak/],
      ['gerçeğe dayanmıyor', mut((o) => { o.ideas[0].basisFactIds = []; }), /görünür_gerçeğe_dayanmıyor/],
      ['kanıtsız içerik', mut((o) => { o.ideas[0].mainMessage = 'Taze mozzarella ile hazırlanan makarna'; }), /kanıtsız_içerik:mozzarella/],
      ['fiyat', mut((o) => { o.ideas[0].creativeAngle = 'Bugüne özel 120 TL fırsat'; }), /yasak:fiyat_para/],
      ['kompozisyon terimi', mut((o) => { o.ideas[0].visualLink = 'Kadraj ve renk paleti güzel'; }), /yasak:kompozisyon_terimi/],
      ['İngilizce', mut((o) => { o.ideas[0].interpretation = 'This is the best table for you and your friends'; }), /dil_türkçe_değil/],
      ['yorum = ana mesaj', mut((o) => { o.ideas[0].interpretation = o.ideas[0].mainMessage; }), /yorum_ana_mesajın_kopyası/],
      ['durum geçersiz', { status: 'belki', missingInfo: null, ideas: [] }, /status_geçersiz/],
    ];
    for (const [name, out, re] of cases) {
      const db = fresh();
      const m = mockDeps({ ideas: out });
      const e = await catchErr(run(db, m, ideasReq()));
      expect(e, name).toMatchObject({ status: 422, code: 'invalid_output' });
      expect(JSON.stringify(e.details), name).toMatch(re);
      expect(cacheDocs(db), name).toEqual([]);
    }
  });

  it('veri yetersizse UYDURMA YOK: kırpımda konu doğrulanamıyorsa model ÇAĞRILMAZ, açık "bilgi yetersiz" döner; caption/kontrol yapılamaz', async () => {
    const db = fresh({ w: 4000, h: 3000 }); // kompozisyon kararı yok → kırpımda konu doğrulanamaz
    const m = mockDeps();
    const r = await run(db, m, ideasReq());
    expect(m.total()).toBe(0);
    expect(r).toMatchObject({ role: 'ideas', status: 'bilgi_yetersiz', ideas: [], blockReason: 'kirpimda_gorunur_olgu_yok' });
    if (r.role === 'ideas') expect(r.missingInfo).toMatch(/doğrulanamadı/);
    const e = await catchErr(run(db, m, captionReq(r.evidence.digest)));
    expect(e).toMatchObject({ status: 422, code: 'evidence_insufficient' });
    const e2 = await catchErr(run(db, m, checkReq(r.evidence.digest)));
    expect(e2).toMatchObject({ status: 422, code: 'evidence_insufficient' });
    expect(m.total()).toBe(0);
  });

  it('konu açıklaması hiç yoksa (analiz/insan açıklaması yok) model çağrılmaz; sebep "semantik_aciklama_yok"', async () => {
    const db = fakeFirestore();
    const { seedAsset } = await import('../feedPlanner/integration/liveFixtures');
    seedAsset(db, 'a1');
    const m = mockDeps();
    const r = await run(db, m, ideasReq());
    expect(m.total()).toBe(0);
    expect(r).toMatchObject({ status: 'bilgi_yetersiz', blockReason: 'semantik_aciklama_yok' });
  });

  it('kırpılmış + ana konu görünür ("yalnız_konu"): kanıt YALNIZ ana konu; açıklama/nesne/kategori (kırpım dışı olabilir) kanıta ve prompta GİRMEZ', async () => {
    const db = fresh({ w: 4000, h: 3000, vis: visual() });
    const m = mockDeps({ ideas: { status: 'ok', missingInfo: null, ideas: IDEAS_OK().ideas.map((i: any, k: number) => ({ ...i, mainMessage: ['Sade bir masada makarna keyfi', 'Paylaşılan sofranın sıcaklığı', 'Bugün öğle yemeğini kendine ayır'][k], basisFactIds: ['F1'], visualLink: 'Masadaki tabak' })) } });
    const r = await run(db, m, ideasReq());
    if (r.role !== 'ideas') throw 0;
    expect(r.evidence.visibility).toEqual({ cropped: true, facts: 'yalnız_konu' });
    expect(r.evidence.facts.map((f) => f.id)).toEqual(['F1']);
    const s = sentOf(m.ideas);
    expect(s.user).toMatch(/görünür olgu kapsamı: yalnız_konu/);
    expect(s.user).not.toMatch(/zeytin kasesi|porselen|Beyaz örtülü/);
    expect(JSON.stringify(r.evidence.uncertainties)).toMatch(/yalnız ana konunun görünür olduğu doğrulandı/);
    // F4 (zeytin kasesi) artık kanıtta yok → ona dayanan fikir reddedilir
    const m2 = mockDeps();
    const e = await catchErr(run(db, m2, ideasReq({ refresh: true })));
    expect(e).toMatchObject({ code: 'invalid_output' });
    expect(JSON.stringify(e.details)).toMatch(/bilinmeyen_dayanak/);
  });

  it('model "bilgi_yetersiz" derse (ideas boş + eksik bilgi notu) kabul edilir; tutarsızı reddedilir', async () => {
    const db = fresh();
    const r = await run(db, mockDeps({ ideas: { status: 'bilgi_yetersiz', missingInfo: 'Ürünün adı ve içeriği bilinmiyor.', ideas: [] } }), ideasReq());
    expect(r).toMatchObject({ status: 'bilgi_yetersiz', ideas: [], missingInfo: 'Ürünün adı ve içeriği bilinmiyor.' });
    for (const bad of [{ status: 'bilgi_yetersiz', missingInfo: '', ideas: [] }, { status: 'bilgi_yetersiz', missingInfo: 'x', ideas: IDEAS_OK().ideas }]) {
      const e = await catchErr(run(fresh(), mockDeps({ ideas: bad }), ideasReq()));
      expect(e).toMatchObject({ code: 'invalid_output' });
    }
  });

  it('insan açıklaması (AI analizi YOK) doğru kullanılır: kaynak "insan_açıklaması" etiketi taşır; ölçüm kanıtı değildir', async () => {
    const db = fakeFirestore();
    const { seedAsset, POLICY } = await import('../feedPlanner/integration/liveFixtures');
    void POLICY;
    seedAsset(db, 'a1');
    db.data.set(`media_catalog_corrections/${T}_${P}_a1`, { tenantId: T, projectId: P, assetId: 'a1', overrides: { subject: 'zeytinyağlı ekmek', description: 'Tahta tahtada dilimlenmiş ekmek ve zeytinyağı.' }, updatedBy: 'u', updatedAt: 1, version: 1 });
    const m = mockDeps({ ideas: { status: 'ok', missingInfo: null, ideas: IDEAS_OK().ideas.map((i: any, k: number) => ({ ...i, mainMessage: ['Ekmeğin yanında zeytinyağı', 'Tahta tahtada sofra', 'Dilimlenmiş ekmeğe davet'][k], creativeAngle: ['Sade ve sıcak tat çağrışımı', 'El emeği ve doğallık hissi', 'Doğrudan davet'][k], visualLink: 'Tahta tahtadaki ekmek', basisFactIds: ['F1'] })) } });
    const r = await run(db, m, ideasReq());
    if (r.role !== 'ideas') throw new Error(JSON.stringify(r).slice(0, 300));
    expect(r.evidence.sourceKind).toBe('human');
    expect(r.evidence.facts.every((f) => f.source === 'insan_açıklaması')).toBe(true);
    expect(sentOf(m.ideas).user).toMatch(/F1 \[konu \| insan_açıklaması\]: zeytinyağlı ekmek/);
  });
});

describe('Rol 2 — metin yazarı (yalnız SEÇİLMİŞ fikirden)', () => {
  it('seçilmiş fikir + aynı kanıt özetiyle TEK çağrı; caption, rationale, gözlem ve kaynak eşlemesi AYRI alanlar; kanıt temeli eşlemeden türetilir', async () => {
    const db = fresh();
    const digest = await digestOf(db);
    const m = mockDeps();
    const r = await run(db, m, captionReq(digest, { idea: { ...IDEA, note: 'daha kısa tut', edited: true, mainMessage: 'Düzenlenmiş ana mesaj: sade masa' } }));
    expect(m.caption).toHaveBeenCalledTimes(1);
    expect(m.ideas).not.toHaveBeenCalled();
    expect(m.check).not.toHaveBeenCalled();
    if (r.role !== 'caption') throw 0;
    expect(r.caption.text).toBe(CAPTION_TEXT);
    expect(r.caption.rationale).not.toBe(r.caption.text);
    expect(r.caption.observation).not.toBe(r.caption.rationale);
    expect(r.caption.evidenceBasis).toBe('katalog_gozlem');
    expect(r.caption.sourceMap.map((s) => s.source)).toEqual(['gorunur_gercek', 'gorunur_gercek', 'yaratici_yorum']);
    expect(r.caption.warnings).toContain('gecici_ton_taslak');
    const s = sentOf(m.caption);
    expect(s.user).toMatch(/<selected_idea>[\s\S]*ana mesaj: Düzenlenmiş ana mesaj: sade masa[\s\S]*kullanıcı notu: daha kısa tut[\s\S]*kullanıcı düzenledi: evet/);
    expect(s.system).toMatch(/METİN YAZARISIN/);
    expect(s.system).toMatch(/Fikir bir OLGU KAYNAĞI DEĞİLDİR/);
  });

  it('YAPISAL ret: bilinmeyen kimlik, metinde olmayan parça, olgusal bağ yok, yaratıcı yorumda kimlik, boş eşleme, kopya alan, çok kısa', async () => {
    const db = fresh();
    const digest = await digestOf(db);
    const sm = CAPTION_OK().sourceMap;
    const cases: Array<[string, any, RegExp]> = [
      ['bilinmeyen gerçek', CAPTION_OK({ sourceMap: [{ ...sm[0], ref: 'F77' }, sm[1]] }), /bilinmeyen_gerçek/],
      ['metinde yok', CAPTION_OK({ sourceMap: [{ ...sm[0], segment: 'metinde olmayan bir cümle' }, sm[1]] }), /metinde_yok/],
      ['olgusal bağ yok', CAPTION_OK({ sourceMap: [sm[2]] }), /görünür_gerçeğe_bağ_yok/],
      ['yorumda kimlik', CAPTION_OK({ sourceMap: [sm[0], { ...sm[2], ref: 'F1' }] }), /yaratıcı_yorum_dayanak_taşıyamaz/],
      ['boş eşleme', CAPTION_OK({ sourceMap: [] }), /kaynak_eşlemesi_yok/],
      ['ürün (pakette yok)', CAPTION_OK({ sourceMap: [{ ...sm[0], source: 'dogrulanmis_urun', ref: 'P1' }] }), /bilinmeyen_ürün|doğrulanmış_ürün_bu_modda_yok/],
      ['kopya alan', CAPTION_OK({ observation: CAPTION_TEXT }), /alanlar_birbirinin_kopyası/],
      ['çok kısa', CAPTION_OK({ caption: 'Kısa.', sourceMap: [{ segment: 'Kısa', source: 'gorunur_gercek', ref: 'F1' }] }), /caption_çok_kısa/],
    ];
    for (const [name, out, re] of cases) {
      const d = fresh();
      const e = await catchErr(run(d, mockDeps({ caption: out }), captionReq(digest)));
      expect(e, name).toMatchObject({ status: 422, code: 'invalid_output' });
      expect(JSON.stringify(e.details), name).toMatch(re);
      expect(cacheDocs(d), name).toEqual([]);
    }
  });

  it('KURAL ret (validateCopyOutput): fiyat/saat/kanıtsız içerik/yasak sıfat/tekrar/İngilizce caption reddedilir; hesap gönderisine benzerlik (paket modu) yakalanır', async () => {
    const db = fresh();
    const digest = await digestOf(db);
    const withText = (caption: string, seg = 'Beyaz örtülü masada porselen tabakta makarna') => CAPTION_OK({ caption: `${caption} ${seg}.`, sourceMap: [{ segment: seg, source: 'gorunur_gercek', ref: 'F2' }] });
    const cases: Array<[string, any, RegExp, any?]> = [
      ['fiyat', withText('Bugüne özel 150 TL kampanya.'), /yasak:fiyat_para/],
      ['saat', withText('Akşam 19:30 da sofradayız.'), /yasak:saat/],
      ['kanıtsız içerik', withText('Taze mozzarella ve fesleğenle servis edilir.'), /kanıtsız_içerik:(mozzarella|fesleğen)/],
      ['kanıtsız sıfat', withText('Enfes bir öğle yemeği.'), /yasak:kanıtsız_sıfat/],
      ['kompozisyon', withText('Kadraj ve boş alan çok güzel.'), /yasak:kompozisyon_terimi/],
      ['İngilizce', withText('This is the best table for you and your friends'), /dil_türkçe_değil/],
    ];
    for (const [name, out, re] of cases) {
      const e = await catchErr(run(fresh(), mockDeps({ caption: out }), captionReq(digest)));
      expect(e, name).toMatchObject({ status: 422, code: 'invalid_output' });
      expect(JSON.stringify(e.details), name).toMatch(re);
    }
    // yakın geçmiş metinle tekrar (avoid): aynı caption recent.texts içinde
    const e2 = await catchErr(run(fresh(), mockDeps(), captionReq(digest, { recent: { ideas: [], texts: [CAPTION_TEXT] } })));
    expect(JSON.stringify(e2.details)).toMatch(/diğer_slotla_çok_benzer/);
  });

  it('KANIT ZİNCİRİ: fikir üretildikten sonra analiz/insan düzeltmesi değişirse 409 evidence_changed (model çağrılmaz); fikrin dayandığı kimlik kırpımda yoksa 422', async () => {
    const db = fresh();
    const digest = await digestOf(db);
    db.data.set(`media_catalog_corrections/${T}_${P}_a1`, { tenantId: T, projectId: P, assetId: 'a1', overrides: { description: 'İnsanın düzelttiği açıklama: tabakta makarna.' }, updatedBy: 'u', updatedAt: 2, version: 1 });
    const m = mockDeps();
    const e = await catchErr(run(db, m, captionReq(digest)));
    expect(e).toMatchObject({ status: 409, code: 'evidence_changed' });
    const e2 = await catchErr(run(db, m, checkReq(digest)));
    expect(e2).toMatchObject({ status: 409, code: 'evidence_changed' });
    expect(m.total()).toBe(0);
    const db2 = fresh();
    const d2 = await digestOf(db2);
    const e3 = await catchErr(run(db2, mockDeps(), captionReq(d2, { idea: { ...IDEA, factIds: ['F1', 'F9'] } })));
    expect(e3).toMatchObject({ status: 422, code: 'idea_basis_invalid' });
  });
});

describe('Rol 3 — bağımsız kontrol', () => {
  it('AYRI system promptu ve AYRI model; yazarın rationale/eşlemesi DOĞRULANMAMIŞ iddia olarak girer; yazar promptu girmez; uygun sonuç + insan/kilit bulgusu', async () => {
    const db = fresh();
    const digest = await digestOf(db);
    const m = mockDeps();
    await run(db, m, captionReq(digest));
    const r = await run(db, m, checkReq(digest, { caption: { ...DRAFT, humanEdited: true, locked: true } }));
    if (r.role !== 'check') throw 0;
    const cap = sentOf(m.caption);
    const chk = sentOf(m.check);
    expect(chk.system).toMatch(/BAĞIMSIZ bir metin denetçisisin; metni SEN yazmadın/);
    expect(chk.system).not.toBe(cap.system);
    expect(chk.system).not.toMatch(/METİN YAZARISIN/);
    expect(chk.model).toBe('mock/check');
    expect(cap.model).toBe('mock/caption');
    expect(chk.user).toMatch(/yazarın iddiası \(rationale — DOĞRULANMAMIŞ\)/);
    expect(chk.user).toMatch(/yazarın eşlemesi \(DOĞRULANMAMIŞ\)/);
    expect(chk.user).toMatch(/insan düzenlemesi: evet \| kilitli: evet/);
    expect(r.verdict).toBe('uygun');
    expect(r.captionHash).toMatch(/^[0-9a-f]{24}$/);
    const dims = r.findings.map((f) => f.dimension).sort();
    expect(dims).toEqual(['gorsel_uyum', 'insan_kilit', 'kanitsiz_iddia', 'marka_dili', 'niyet', 'tekrar']);
    const lock = r.findings.find((f) => f.dimension === 'insan_kilit')!;
    expect(lock.origin).toBe('kod');
    expect(lock.reason).toMatch(/insan düzenlemesi/);
    expect(lock.reason).toMatch(/DEĞİŞTİRMEZ/);
    expect(r.meta?.promptVersion).toBe(CREATIVE_PROMPT_VERSIONS.check);
  });

  it('YAKALAMA: modelin bulduğu kanıtsız iddia → düzeltme_gerekli (iddia + gerekçe + kaynak); metin DEĞİŞTİRİLMEZ', async () => {
    const db = fresh();
    const digest = await digestOf(db);
    const out = CHECK_OK();
    out.verdict = 'düzeltme_gerekli';
    out.summary = 'Bir iddia kanıtsız.';
    out.findings[4] = { dimension: 'kanitsiz_iddia', status: 'sorun', claim: 'yanında zeytin kasesi', reason: 'Kasenin içeriği belirsiz olarak kayıtlı.', sourceRef: 'F4' };
    const r = await run(db, mockDeps({ check: out }), checkReq(digest));
    if (r.role !== 'check') throw 0;
    expect(r.verdict).toBe('düzeltme_gerekli');
    const f = r.findings.find((x) => x.dimension === 'kanitsiz_iddia')!;
    expect(f).toMatchObject({ status: 'sorun', claim: 'yanında zeytin kasesi', sourceRef: 'F4', origin: 'model' });
    expect(Object.keys(r)).not.toContain('caption'); // kontrol yeni metin üretmez
    expect(JSON.stringify(r.findings)).not.toMatch(/"text":/);
  });

  it('KOD DENETİMİ BAĞIMSIZDIR: model "uygun" dese de fiyat/kanıtsız içerik/tekrar varsa sonuç UYGUN OLAMAZ (kod bulgusu, boyut eşlemeli)', async () => {
    const db = fresh();
    const digest = await digestOf(db);
    const bad = { ...DRAFT, text: 'Bugüne özel 120 TL; taze mozzarella ile servis. Beyaz örtülü masada porselen tabakta makarna.' };
    const r = await run(db, mockDeps(), checkReq(digest, { caption: bad }));
    if (r.role !== 'check') throw 0;
    expect(r.verdict).toBe('düzeltme_gerekli');
    expect(r.codeReasons.join(' ')).toMatch(/yasak:fiyat_para/);
    expect(r.codeReasons.join(' ')).toMatch(/kanıtsız_içerik:mozzarella/);
    const code = r.findings.filter((f) => f.origin === 'kod' && f.status === 'sorun');
    expect(code.length).toBeGreaterThanOrEqual(2);
    expect(r.summary).toMatch(/“uygun” OLAMAZ/);
    // tekrar: yakın geçmiş metinle aynı → tekrar boyutunda kod bulgusu
    const rep = await run(fresh(), mockDeps(), checkReq(digest, { recent: { ideas: [], texts: [CAPTION_TEXT] } }));
    if (rep.role !== 'check') throw 0;
    expect(rep.verdict).toBe('düzeltme_gerekli');
    expect(rep.findings.some((f) => f.dimension === 'tekrar' && f.origin === 'kod' && f.status === 'sorun')).toBe(true);
  });

  it('tutarsız/eksik kontrol çıktısı REDDEDİLİR (uygun ama sorun var, eksik boyut, bilinmeyen dayanak, yinelenen boyut); önbelleğe yazılmaz', async () => {
    const db = fresh();
    const digest = await digestOf(db);
    const mk = (f: (o: any) => void) => { const o = CHECK_OK(); f(o); return o; };
    const cases: Array<[string, any, RegExp]> = [
      ['uygun ama sorun', mk((o) => { o.findings[0].status = 'sorun'; o.findings[0].claim = 'x'; }), /uygun_ama_bulgu_var/],
      ['eksik boyut', mk((o) => o.findings.pop()), /bulgu_eksik:kanitsiz_iddia/],
      ['bilinmeyen dayanak', mk((o) => { o.verdict = 'düzeltme_gerekli'; o.findings[1] = { ...o.findings[1], status: 'sorun', claim: 'x', sourceRef: 'F88' }; }), /bulgu_bilinmeyen_dayanak/],
      ['yinelenen boyut', mk((o) => { o.findings[1].dimension = 'marka_dili'; }), /bulgu_yinelenmiş:marka_dili/],
      ['sorun ama iddia yok', mk((o) => { o.verdict = 'düzeltme_gerekli'; o.findings[2].status = 'sorun'; }), /sorunlu_bulguda_iddia_yok/],
      ['düzeltme ama sorun yok', mk((o) => { o.verdict = 'düzeltme_gerekli'; }), /düzeltme_gerekli_ama_sorun_yok/],
    ];
    for (const [name, out, re] of cases) {
      const d = fresh();
      const e = await catchErr(run(d, mockDeps({ check: out }), checkReq(digest)));
      expect(e, name).toMatchObject({ status: 422, code: 'invalid_output' });
      expect(JSON.stringify(e.details), name).toMatch(re);
      expect(cacheDocs(d), name).toEqual([]);
    }
  });

  it('bilgi_yetersiz kontrol: model belirsiz derse sonuç "uygun" sayılmaz', async () => {
    const db = fresh();
    const digest = await digestOf(db);
    const o = CHECK_OK();
    o.verdict = 'bilgi_yetersiz';
    o.findings[3] = { dimension: 'gorsel_uyum', status: 'belirsiz', claim: 'masada makarna', reason: 'Görsel bilgisi sınırlı.', sourceRef: null };
    const r = await run(db, mockDeps({ check: o }), checkReq(digest));
    if (r.role !== 'check') throw 0;
    expect(r.verdict).toBe('bilgi_yetersiz');
  });
});

describe('ses kaynağı: onaylı paket / onaylı rehber / geçici ton', () => {
  it('rehber/paket/ton YOK → 412 brand_voice_missing (model çağrılmaz); sağlayıcı kapalı bundan ayrı', async () => {
    const db = fresh();
    const m = mockDeps();
    const e = await catchErr(run(db, m, ideasReq({ tempTone: undefined })));
    expect(e).toMatchObject({ status: 412, code: 'brand_voice_missing' });
    expect(m.total()).toBe(0);
  });
  it('ONAYLI REHBER her zaman geçici tona üstün: istemde <brand_guide> + G olguları, <tone> YOK, tempToneIgnored işaretli; rehber olgusu kanıt kimliği taşır', async () => {
    const db = fresh();
    withGuide(db);
    const m = mockDeps();
    const r = await run(db, m, ideasReq({ tempTone: { label: 'lüks' } }));
    if (r.role !== 'ideas') throw 0;
    const s = sentOf(m.ideas);
    expect(s.system).toMatch(/<brand_guide>/);
    expect(s.system).not.toMatch(/<tone>/);
    expect(s.system).toMatch(/Ses kaynağı: onaylı marka rehberi/);
    expect(s.user).toMatch(/<brand_facts>\nG1: Masalar her gün özenle kurulur/);
    expect(r.voice).toMatchObject({ source: 'approved_guide', guideVersion: 2, tempToneIgnored: true });
    expect(r.evidence.brandFacts).toEqual([{ id: 'G1', text: 'Masalar her gün özenle kurulur' }]);
  });
  it('GEÇİCİ TON açıkça etiketli: onaylı marka hafızası gibi sunulmaz; varsayım notu döner', async () => {
    const db = fresh();
    const m = mockDeps();
    const r = await run(db, m, ideasReq({ tempTone: { label: 'zarif', prompt: 'ölçülü' } }));
    if (r.role !== 'ideas') throw 0;
    expect(sentOf(m.ideas).system).toMatch(/GEÇİCİ ton \(onaylı marka hafızası DEĞİL\)/);
    expect(sentOf(m.ideas).system).toMatch(/etiket: zarif/);
    expect(r.voice).toMatchObject({ source: 'temporary_tone', tempToneIgnored: false });
    expect(r.voice.assumptions.join(' ')).toMatch(/GEÇİCİ plan tonudur, onaylı marka hafızası değildir/);
  });
  it('PAKET modu: personası/dil rehberi + hesap gönderileri (bütçeli) girer; doğrulanmış ürün P kimliğiyle kanıta girer', async () => {
    const db = fresh();
    withBundle(db);
    db.data.set('media_catalog_corrections/t1_p1_a1', { tenantId: T, projectId: P, assetId: 'a1', overrides: { verifiedProductIds: ['lovebombing'] }, updatedBy: 'u', updatedAt: 1, version: 1 });
    const m = mockDeps();
    const r = await run(db, m, ideasReq({ tempTone: undefined }));
    if (r.role !== 'ideas') throw new Error(JSON.stringify(r).slice(0, 200));
    const s = sentOf(m.ideas);
    expect(s.system).toMatch(/<guides>[\s\S]*Marka Personası[\s\S]*Dil Rehberi[\s\S]*Paylaşım Stilleri/);
    expect(s.user).toMatch(/<account_posts>\n\[P01 · 2026-10-04\]/);
    expect(r.voice.source).toBe('approved_bundle');
    void r;
  });
});

describe('önbellek: anahtar boyutları ve izolasyon', () => {
  it('aynı girdi → ikinci çağrı ÖNBELLEKTEN (model çağrılmaz); açık "yenile" TEK yeni çağrı; hata/ret ASLA önbelleğe yazılmaz', async () => {
    const db = fresh();
    const m = mockDeps();
    const a = await run(db, m, ideasReq());
    const b = await run(db, m, ideasReq());
    expect(m.ideas).toHaveBeenCalledTimes(1);
    expect(a.cached).toBe(false);
    expect(b.cached).toBe(true);
    if (a.role === 'ideas' && b.role === 'ideas') expect(b.ideas).toEqual(a.ideas);
    await run(db, m, ideasReq({ refresh: true }));
    expect(m.ideas).toHaveBeenCalledTimes(2);
    const d2 = fresh();
    const bad = mockDeps({ ideas: { status: 'ok', missingInfo: null, ideas: [] } });
    await catchErr(run(d2, bad, ideasReq()));
    await catchErr(run(d2, bad, ideasReq()));
    expect(bad.ideas).toHaveBeenCalledTimes(2); // hata önbelleğe alınmadı: her tekrar AÇIK eylem + yeni çağrı
    expect(cacheDocs(d2)).toEqual([]);
  });

  it('anahtar boyutları: niyet, kırpım sürümü/odak/zoom, yakın geçmiş, ton, kaynak analizi, insan düzeltmesi, rol/model/istem sürümü değişince ÖNBELLEK ISKALAR', async () => {
    const db = fresh();
    const m = mockDeps();
    await run(db, m, ideasReq());
    let calls = 1;
    const miss = async (req: any, label: string, d = db, mm = m) => { await run(d, mm, req); calls++; expect(mm.ideas, label).toHaveBeenCalledTimes(calls); };
    await miss(ideasReq({ intent: { kind: 'yap', text: 'rezerve et' } }), 'niyet');
    await miss(ideasReq({ crop: { ...FULL, version: 2 } }), 'kırpım sürümü');
    await miss(ideasReq({ crop: { ...FULL, focus: { x: 0.4, y: 0.5 } } }), 'odak');
    await miss(ideasReq({ recent: { ideas: ['önceki fikir'], texts: [] } }), 'yakın geçmiş');
    await miss(ideasReq({ tempTone: { label: 'zarif' } }), 'ton');
    // aynı girdiler tekrarında isabet
    await run(db, m, ideasReq({ intent: { kind: 'yap', text: 'rezerve et' } }));
    expect(m.ideas).toHaveBeenCalledTimes(calls);
    // farklı model → ıska
    const other = mockDeps({}, { ideas: 'mock/ideas-v2', caption: 'mock/caption', check: 'mock/check' });
    await run(db, other, ideasReq());
    expect(other.ideas).toHaveBeenCalledTimes(1);
    // kaynak analizi (analiz anahtarı) değişti → ıska
    const d2 = fresh();
    const m2 = mockDeps();
    await run(d2, m2, ideasReq());
    seed(d2, 'a1', { key: 'k-yeni' });
    await run(d2, m2, ideasReq());
    expect(m2.ideas).toHaveBeenCalledTimes(2);
    // insan düzeltmesi (kanıt özeti değişir) → ıska
    const d3 = fresh();
    const m3 = mockDeps();
    await run(d3, m3, ideasReq());
    d3.data.set(`media_catalog_corrections/${T}_${P}_a1`, { tenantId: T, projectId: P, assetId: 'a1', overrides: { description: 'Düzeltilmiş açıklama: tabakta makarna.' }, updatedBy: 'u', updatedAt: 3, version: 1 });
    await run(d3, m3, ideasReq());
    expect(m3.ideas).toHaveBeenCalledTimes(2);
  });

  it('caption/kontrol anahtarı: seçilen fikir düzenlemesi, caption metni/eşlemesi ve insan/kilit bayrakları ayırt edilir', async () => {
    const db = fresh();
    const digest = await digestOf(db);
    const m = mockDeps();
    await run(db, m, captionReq(digest));
    await run(db, m, captionReq(digest));
    expect(m.caption).toHaveBeenCalledTimes(1);
    await run(db, m, captionReq(digest, { idea: { ...IDEA, mainMessage: 'Başka bir ana mesaj', edited: true } }));
    expect(m.caption).toHaveBeenCalledTimes(2);
    await run(db, m, captionReq(digest, { idea: { ...IDEA, sourceIdeaId: 'i2', factIds: ['F4'] } }));
    expect(m.caption).toHaveBeenCalledTimes(3);
    await run(db, m, checkReq(digest));
    await run(db, m, checkReq(digest));
    expect(m.check).toHaveBeenCalledTimes(1);
    await run(db, m, checkReq(digest, { caption: { ...DRAFT, text: `${CAPTION_TEXT} Gel.` } }));
    expect(m.check).toHaveBeenCalledTimes(2);
    await run(db, m, checkReq(digest, { caption: { ...DRAFT, humanEdited: true } }));
    expect(m.check).toHaveBeenCalledTimes(3);
    await run(db, m, checkReq(digest, { caption: { ...DRAFT, locked: true } }));
    expect(m.check).toHaveBeenCalledTimes(4);
  });

  it('TENANT/PROJE/ROL izolasyonu: anahtar tenant/proje/varlık/rol içerir; başka kiracı veya rolün zehirli kaydı KULLANILMAZ', async () => {
    const parts: any = { role: 'ideas', tenantId: 't1', projectId: 'p1', mediaId: 'a1', sourceSha256: 's', analysisKey: 'k', evidenceDigest: 'd', crop: { fx: '0.5', fy: '0.5', zoom: '1.000', version: 1 }, intent: null, voice: { mode: 'tone', ref: 'x' }, recentDigest: 'r', model: 'm', promptVersion: 'p', schemaVersion: 's' };
    const k0 = creativeCacheKey(parts);
    for (const over of [{ tenantId: 't2' }, { projectId: 'p2' }, { mediaId: 'a2' }, { role: 'caption' }, { sourceSha256: 's2' }, { analysisKey: 'k2' }, { evidenceDigest: 'd2' }, { model: 'm2' }, { promptVersion: 'p2' }, { schemaVersion: 's2' }, { voice: { mode: 'guide', ref: 'x' } }, { crop: { ...parts.crop, version: 2 } }, { intent: { kind: 'yap', text: '' } }]) {
      expect(creativeCacheKey({ ...parts, ...over }), JSON.stringify(over)).not.toBe(k0);
    }
    const db = fresh();
    const m = mockDeps();
    const r0 = await run(db, m, ideasReq());
    const [key] = cacheDocs(db).map((k: string) => k.split('/')[1]);
    // başka kiracının kaydı aynı anahtara yazılmış (zehirli): kullanılmaz → yeni model çağrısı
    db.data.set(`${CREATIVE_CACHE}/${key}`, { ...db.data.get(`${CREATIVE_CACHE}/${key}`), tenantId: 'baska' });
    await run(db, m, ideasReq());
    expect(m.ideas).toHaveBeenCalledTimes(2);
    expect(r0.cached).toBe(false);
    // başka tenant için aynı medya: kütüphanede yok → media_invalid, model çağrılmaz
    const e = await catchErr(run(db, m, ideasReq(), 'baska'));
    expect(e).toMatchObject({ status: 422, code: 'media_invalid' });
    expect(m.ideas).toHaveBeenCalledTimes(2);
  });
});

describe('hata durumları ayrışır ve otomatik tekrar/rol zinciri YOK', () => {
  it('model hatası 502 model_error; ret 422 model_refusal; çıktı yok 422 invalid_output — her biri TEK çağrı, sonuç yazılmaz', async () => {
    const db = fresh();
    const boom = mockDeps();
    boom.ideas.mockImplementation(async () => { throw Object.assign(new Error('x'), { status: 500 }); });
    expect(await catchErr(run(db, boom, ideasReq()))).toMatchObject({ status: 502, code: 'model_error' });
    expect(boom.ideas).toHaveBeenCalledTimes(1); // yeniden deneme YOK
    const ref = mockDeps();
    ref.ideas.mockImplementation(async () => ({ id: 'r', stopReason: 'refusal', parsed: null }));
    expect(await catchErr(run(db, ref, ideasReq()))).toMatchObject({ status: 422, code: 'model_refusal' });
    const none = mockDeps({ ideas: null });
    expect(await catchErr(run(db, none, ideasReq()))).toMatchObject({ status: 422, code: 'invalid_output' });
    expect(cacheDocs(db)).toEqual([]);
  });

  it('başarısız kontrol sonrası OTOMATİK yeniden üretim/ikinci rol çağrısı YOK; her rol çağrısı tam olarak bir model çağrısıdır', async () => {
    const db = fresh();
    const digest = await digestOf(db);
    const failing = CHECK_OK();
    failing.verdict = 'düzeltme_gerekli';
    failing.findings[0] = { dimension: 'marka_dili', status: 'sorun', claim: 'Telaşı kapıda bırak', reason: 'Ton uyumsuz.', sourceRef: null };
    const m = mockDeps({ check: failing });
    const r = await run(db, m, checkReq(digest));
    expect(r.role === 'check' && r.verdict).toBe('düzeltme_gerekli');
    expect(m.check).toHaveBeenCalledTimes(1);
    expect(m.caption).not.toHaveBeenCalled();
    expect(m.ideas).not.toHaveBeenCalled();
  });

  it('bütçe: kırpılabilir bağlam (yakın geçmiş/hesap gönderisi/uzun rehber) KIRPILIR ve eksiklik rapora YAZILIR; zorunlu girdi sığmazsa açık hata', async () => {
    const big = bundle();
    big.guides.persona = 'P'.repeat(20000);
    big.guideHashes.persona = sha256Hex(big.guides.persona);
    const db = fresh();
    withBundle(db, big);
    const m = mockDeps();
    const r = await run(db, m, ideasReq({ tempTone: undefined, recent: { ideas: Array(12).fill('i'.repeat(200)), texts: Array(20).fill('t'.repeat(400)) } }));
    expect(r.budget?.truncated).toBe(true);
    expect(r.budget?.notes.join(' ')).toMatch(/Marka personası: bir öğe 20000 → 3500 karaktere kırpıldı/);
    expect(r.budget!.usedChars).toBeLessThanOrEqual(r.budget!.maxChars);
    const sent = sentOf(m.ideas);
    expect(sent.system.length + sent.user.length).toBeLessThanOrEqual(r.budget!.maxChars + 400);
    // zorunlu bölüm sığmaz → BudgetExceeded (sessiz kırpma yok)
    expect(() => fitBudget('ideas', [{ key: 'k', label: 'Kanıt', items: ['x'.repeat(1000)], itemCap: 5000, maxItems: 1, priority: 9, essential: true }], 14000)).toThrow(BudgetExceeded);
    const ev = buildEvidence({ catalog: { subject: 's', description: '', tags: [], foodCategories: [], visibleObjects: [], uncertainties: [], source: 'ai' }, visibility: { cropped: false, facts: 'tam' } });
    expect(ev.facts).toHaveLength(1);
  });
});

/* ───────── Ara inceleme düzeltmeleri: UID izolasyonu, kanıt zinciri, idempotency, Firestore yazılabilirliği ───────── */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('yetkili UID: önbellek ve kanıt zinciri kullanıcıya bağlı', () => {
  it('aynı tenant+proje+istek, farklı UID → ikinci kullanıcı birinci kullanıcının sonucunu ALAMAZ (yeni çağrı); aynı UID tekrarında isabet', async () => {
    const db = fresh();
    const m = mockDeps();
    const a = await run(db, m, ideasReq(), T, 'u1');
    const b = await run(db, m, ideasReq(), T, 'u2');
    expect(b.cached).toBe(false);
    expect(m.ideas).toHaveBeenCalledTimes(2);
    const c = await run(db, m, ideasReq(), T, 'u1');
    expect(c.cached).toBe(true);
    expect(m.ideas).toHaveBeenCalledTimes(2);
    expect(a.evidence.digest).not.toBe(b.evidence.digest); // zincir kullanıcıya bağlı
    const docs = cacheDocs(db).map((k: string) => db.data.get(k).uid).sort();
    expect(docs).toEqual(['u1', 'u2']);
  });
  it('başka UID\'nin kanıt özetiyle caption/kontrol isteği model ÖNCESİ reddedilir; başka UID\'nin zehirli önbellek kaydı kullanılmaz', async () => {
    const db = fresh();
    const m = mockDeps();
    const a = await run(db, m, ideasReq(), T, 'u1');
    for (const mk of [captionReq, checkReq]) {
      const e = await catchErr(run(db, m, mk(a.evidence.digest), T, 'u2'));
      expect(e).toMatchObject({ status: 409, code: 'evidence_changed' });
    }
    expect(m.caption).not.toHaveBeenCalled();
    expect(m.check).not.toHaveBeenCalled();
    const [k] = cacheDocs(db);
    db.data.set(k, { ...db.data.get(k), uid: 'u2' });
    await run(db, m, ideasReq(), T, 'u1');
    expect(m.ideas).toHaveBeenCalledTimes(2);
  });
  it('UID yoksa 401 (istemci iddiası/kimliksiz çağrı model çağırmaz)', async () => {
    const m = mockDeps();
    const e = await catchErr(run(fresh(), m, ideasReq(), T, ''));
    expect(e).toMatchObject({ status: 401, code: 'uid_required' });
    expect(m.total()).toBe(0);
  });
});

describe('kanıt zinciri: kaynak/analiz/kırpım sürümü değişimi model ÇAĞRISINDAN ÖNCE reddedilir', () => {
  const chain = async (mutate: (db: any) => void, mk: (d: string, o?: any) => any, over: (d: string) => any = () => ({})) => {
    const db = fresh();
    db.data.get(`${ANALYSES}/k-a1`).sourceSha256 = 'sha1';
    const m = mockDeps();
    const a = await run(db, m, ideasReq());
    mutate(db);
    const e = await catchErr(run(db, m, mk(a.evidence.digest, over(a.evidence.digest))));
    return { e, m };
  };
  it('AYNI görünür metinle: yalnız kaynak SHA-256 değişti → 409 (caption ve kontrol), model çağrılmaz', async () => {
    for (const mk of [captionReq, checkReq]) {
      const { e, m } = await chain((db) => { db.data.get(`${ANALYSES}/k-a1`).sourceSha256 = 'sha2'; }, mk);
      expect(e).toMatchObject({ status: 409, code: 'evidence_changed' });
      expect(m.caption).not.toHaveBeenCalled();
      expect(m.check).not.toHaveBeenCalled();
    }
  });
  it('AYNI görünür metinle: analiz anahtarı değişti (k→k2) → 409', async () => {
    const { e, m } = await chain((db) => { db.data.set(`${ANALYSES}/k2`, { ...db.data.get(`${ANALYSES}/k-a1`), key: 'k2' }); db.data.set(`${ANALYSIS_LATEST}/${T}_${P}_a1`, { key: 'k2' }); }, captionReq);
    expect(e).toMatchObject({ status: 409, code: 'evidence_changed' });
    expect(m.caption).not.toHaveBeenCalled();
  });
  it('AYNI görünür kapsamla: kırpım SÜRÜMÜ / odak / zoom değişti → 409; model çağrılmaz', async () => {
    for (const crop of [{ ...FULL, version: 2 }, { ...FULL, focus: { x: 0.45, y: 0.5 } }]) {
      for (const mk of [captionReq, checkReq]) {
        const { e, m } = await chain(() => {}, mk, () => ({ crop }));
        expect(e, JSON.stringify(crop)).toMatchObject({ status: 409, code: 'evidence_changed' });
        expect(m.caption).not.toHaveBeenCalled();
        expect(m.check).not.toHaveBeenCalled();
      }
    }
  });
  it('NEGATİF: hiçbir şey değişmediyse zincir geçerlidir (caption ve kontrol çalışır); niyet/yakın geçmiş değişimi zinciri bozmaz', async () => {
    const db = fresh();
    db.data.get(`${ANALYSES}/k-a1`).sourceSha256 = 'sha1';
    const m = mockDeps();
    const a = await run(db, m, ideasReq());
    const c = await run(db, m, captionReq(a.evidence.digest, { intent: { kind: 'yap', text: 'yeni niyet' }, recent: { ideas: ['x'], texts: [] } }));
    expect(c.role).toBe('caption');
    const v = await run(db, m, checkReq(a.evidence.digest));
    expect(v.role).toBe('check');
  });
});

describe('idempotency: eşzamanlı aynı istek TEK sağlayıcı çağrısı', () => {
  const gated = (m: ReturnType<typeof mockDeps>) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    m.ideas.mockImplementation(async () => { await gate; return { id: 'i', stopReason: 'end_turn', parsed: IDEAS_OK() }; });
    return release;
  };
  it('iki eşzamanlı aynı istek → sağlayıcı 1 kez; ikincisi sonucu bekler ve ÖNBELLEKTEN gelir; talep serbest bırakılır', async () => {
    const db = fresh();
    const m = mockDeps();
    const release = gated(m);
    const a = run(db, m, ideasReq());
    const b = run(db, m, ideasReq());
    await wait(30);
    expect(m.ideas).toHaveBeenCalledTimes(1);
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(m.ideas).toHaveBeenCalledTimes(1);
    expect([ra.cached, rb.cached].sort()).toEqual([false, true]);
    expect([...db.data.keys()].filter((k: string) => k.startsWith('planner_creative_claims/'))).toEqual([]);
  });
  it('beş eşzamanlı istek → yine TEK çağrı', async () => {
    const db = fresh();
    const m = mockDeps();
    const release = gated(m);
    const all = Array.from({ length: 5 }, () => run(db, m, ideasReq()));
    await wait(30);
    release();
    await Promise.all(all);
    expect(m.ideas).toHaveBeenCalledTimes(1);
  });
  it('farklı UID / farklı girdi eşzamanlı istekleri BİRLEŞMEZ (kapsamlı talep)', async () => {
    const db = fresh();
    const m = mockDeps();
    const release = gated(m);
    const all = [run(db, m, ideasReq(), T, 'u1'), run(db, m, ideasReq(), T, 'u2'), run(db, m, ideasReq({ intent: { kind: 'yap', text: 'x' } }), T, 'u1')];
    await wait(30);
    release();
    await Promise.all(all);
    expect(m.ideas).toHaveBeenCalledTimes(3);
  });
  it('sahibi HATA alırsa bekleyen istek otomatik YENİ ücretli çağrı açmaz: 409 in_flight_failed; talep temizlenir; açık yeniden deneme çalışır', async () => {
    const db = fresh();
    const m = mockDeps();
    let fail!: () => void;
    const gate = new Promise<void>((_, rej) => (fail = () => rej(new Error('boom'))));
    m.ideas.mockImplementationOnce(async () => { await gate; return { id: 'i', stopReason: 'end_turn', parsed: IDEAS_OK() }; });
    const a = run(db, m, ideasReq());
    const b = run(db, m, ideasReq());
    await wait(30);
    fail();
    const [ra, rb] = await Promise.allSettled([a, b]);
    expect(ra.status).toBe('rejected');
    expect((ra as any).reason).toMatchObject({ code: 'model_error' });
    expect((rb as any).reason).toMatchObject({ status: 409, code: 'in_flight_failed' });
    expect(m.ideas).toHaveBeenCalledTimes(1);
    expect([...db.data.keys()].filter((k: string) => k.startsWith('planner_creative_claims/'))).toEqual([]);
    const again = await run(db, m, ideasReq());
    expect(again.role).toBe('ideas');
    expect(m.ideas).toHaveBeenCalledTimes(2);
  });
  it('uçuştaki talep süresi dolmadan başka istek çağrı AÇMAZ (zaman aşımı → 409 in_progress); süre dolmuşsa (sahibi öldü) devralınır', async () => {
    const db = fresh();
    const m = mockDeps();
    m.deps.waitMs = 120;
    m.deps.pollMs = 20;
    const probe = await run(db, mockDeps(), ideasReq()); // anahtarı öğrenmek için önbellek belgesini oku
    const [ck] = cacheDocs(db);
    const key = ck.split('/')[1];
    db.data.delete(ck);
    expect(probe.role).toBe('ideas');
    db.data.set(`planner_creative_claims/${key}`, { key, owner: 'baska-istek', expiresAt: Date.now() + 60_000, createdAt: Date.now(), tenantId: T, projectId: P, uid: 'u1', role: 'ideas' });
    const e = await catchErr(run(db, m, ideasReq()));
    expect(e).toMatchObject({ status: 409, code: 'in_progress' });
    expect(m.ideas).not.toHaveBeenCalled();
    db.data.set(`planner_creative_claims/${key}`, { ...db.data.get(`planner_creative_claims/${key}`), expiresAt: Date.now() - 1 });
    const r = await run(db, m, ideasReq());
    expect(r.role).toBe('ideas');
    expect(m.ideas).toHaveBeenCalledTimes(1);
  });
  it('açık YENİLE eylemi uçuştaki aynı çağrıyı beklerken ikinci çağrı açmaz; tek başına yenile TEK çağrıdır', async () => {
    const db = fresh();
    const m = mockDeps();
    const release = gated(m);
    const a = run(db, m, ideasReq());
    const b = run(db, m, ideasReq({ refresh: true }));
    await wait(30);
    release();
    await Promise.all([a, b]);
    expect(m.ideas).toHaveBeenCalledTimes(1);
    const m2 = mockDeps();
    await run(db, m2, ideasReq({ refresh: true }));
    expect(m2.ideas).toHaveBeenCalledTimes(1);
  });
  it('doğrulama hatası da talebi serbest bırakır ve önbelleğe yazmaz', async () => {
    const db = fresh();
    const m = mockDeps({ ideas: { status: 'ok', missingInfo: null, ideas: [] } });
    await catchErr(run(db, m, ideasReq()));
    expect([...db.data.keys()].filter((k: string) => k.startsWith('planner_creative_claims/') || k.startsWith(`${CREATIVE_CACHE}/`))).toEqual([]);
  });
});

describe('Firestore varsayılan semantiği: undefined değer REDDEDİLİR — yükler temiz', () => {
  const strict = (db: any) => {
    const scan = (v: any): boolean => v === undefined || (!!v && typeof v === 'object' && Object.values(v).some(scan));
    const col = db.collection.bind(db);
    db.collection = ((name: string) => { const c = col(name); return { ...c, doc: (id: string) => { const ref = c.doc(id); return { ...ref, set: async (v: any, o?: any) => { if (scan(v)) throw new Error(`Firestore undefined value (${name})`); return ref.set(v, o); } }; } }; }) as any;
    const tx = db.runTransaction.bind(db);
    db.runTransaction = ((fn: any) => tx((t: any) => fn({ ...t, set: (r: any, v: any, o?: any) => { if (scan(v)) throw new Error('Firestore undefined value (tx)'); return t.set(r, v, o); } }))) as any;
    return db;
  };
  it('üç rolün önbellek yükü ve talep belgesi undefined içermez (niyetsiz istek dahil)', async () => {
    const db = strict(fresh());
    const m = mockDeps();
    const a = await run(db, m, ideasReq({ intent: undefined, tempTone: { label: 'samimi' } }));
    expect(a.role).toBe('ideas');
    const c = await run(db, m, captionReq(a.evidence.digest));
    expect(c.role).toBe('caption');
    const v = await run(db, m, checkReq(a.evidence.digest));
    expect(v.role).toBe('check');
    expect(cacheDocs(db)).toHaveLength(3);
  });
});

describe('takip düzeltmeleri: geçmiş içeriği anahtarda, yenileme nesli, görünür kanıt kırpma', () => {
  it('AYNI kimlikli hesap gönderisinin metni/tarihi değişince önbellek ISKALAR (yalnız kimlik listesi yetmez); değişmeyince isabet', async () => {
    const b1 = bundle();
    const db = fresh();
    withBundle(db, b1);
    const m = mockDeps();
    await run(db, m, ideasReq({ tempTone: undefined }));
    await run(db, m, ideasReq({ tempTone: undefined }));
    expect(m.ideas).toHaveBeenCalledTimes(1);
    const b2 = bundle();
    b2.captions[0] = { ...b2.captions[0], caption: `${b2.captions[0].caption} Yeni cümle.` };
    withBundle(db, b2);
    await run(db, m, ideasReq({ tempTone: undefined }));
    expect(m.ideas).toHaveBeenCalledTimes(2);
    const b3 = bundle();
    b3.captions[1] = { ...b3.captions[1], date: '2026-10-09' };
    withBundle(db, b3);
    await run(db, m, ideasReq({ tempTone: undefined }));
    expect(m.ideas).toHaveBeenCalledTimes(3);
  });

  it('eşzamanlı iki YENİLE: ikisi de YENİ nesli alır (eski önbellek sonucu yenileme sonucu gibi sunulmaz); toplam tek ek çağrı', async () => {
    const db = fresh();
    const m = mockDeps();
    await run(db, m, ideasReq());
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    m.ideas.mockImplementation(async () => { await gate; return { id: 'refreshed', stopReason: 'end_turn', parsed: IDEAS_OK() }; });
    const a = run(db, m, ideasReq({ refresh: true }));
    const b = run(db, m, ideasReq({ refresh: true }));
    await wait(30);
    release();
    const rs = await Promise.all([a, b]);
    expect(m.ideas).toHaveBeenCalledTimes(2);
    for (const r of rs) expect(r.meta?.responseId).toBe('refreshed');
  });

  it('yenileme sahibi hata alırsa bekleyen yenileme ESKİ önbelleği yeni sonuç diye DÖNMEZ (409 in_flight_failed)', async () => {
    const db = fresh();
    const m = mockDeps();
    await run(db, m, ideasReq());
    let fail!: () => void;
    const gate = new Promise<void>((_, rej) => (fail = () => rej(new Error('x'))));
    m.ideas.mockImplementationOnce(async () => { await gate; return { id: 'x', stopReason: 'end_turn', parsed: IDEAS_OK() }; });
    const a = run(db, m, ideasReq({ refresh: true }));
    const b = run(db, m, ideasReq({ refresh: true }));
    await wait(30);
    fail();
    const [ra, rb] = await Promise.allSettled([a, b]);
    expect((ra as any).reason).toMatchObject({ code: 'model_error' });
    expect((rb as any).reason).toMatchObject({ status: 409, code: 'in_flight_failed' });
    expect(m.ideas).toHaveBeenCalledTimes(2);
  });

  it('uzun açıklama / çok nesne / uzun belirsizlik SESSİZCE kırpılmaz: evidence.truncated + uncertainties + prompt + yanıtta görünür', async () => {
    const long = 'Tahta masada ' + 'ayrıntılı '.repeat(60) + 'bir tabak.';
    const cat = { ...CAT, description: long, visibleObjects: Array.from({ length: 15 }, (_, k) => `nesne${k}`), uncertainties: ['u'.repeat(400)] };
    const db = fresh({ catalog: cat });
    const m = mockDeps({ ideas: { status: 'ok', missingInfo: null, ideas: IDEAS_OK().ideas.map((i: any, k: number) => ({ ...i, mainMessage: ['Sade bir masada keyif', 'Paylaşılan sofranın sıcaklığı', 'Bugün öğle yemeğini kendine ayır'][k], visualLink: 'Masadaki tabak', basisFactIds: ['F1'] })) } });
    const r = await run(db, m, ideasReq());
    expect(r.evidence.truncated.join(' ')).toMatch(/“açıklama” kaynağı \d+ → 300 karaktere kısaltıldı/);
    expect(r.evidence.truncated.join(' ')).toMatch(/nesne listesinden 3 öğe alınmadı/);
    expect(r.evidence.truncated.join(' ')).toMatch(/belirsizlik notu 400 → 240/);
    expect(r.evidence.uncertainties.some((u) => /kırpıldı/.test(u))).toBe(true);
    expect(sentOf(m.ideas).user).toMatch(/Kanıt kırpıldı: “açıklama”/);
    const cut = r.evidence.facts.find((f) => f.kind === 'açıklama')!.text;
    expect(cut.length).toBe(300);
    // kırpma olmayan kanıtta not yok
    const ok = await run(fresh(), mockDeps(), ideasReq());
    expect(ok.evidence.truncated).toEqual([]);
  });
});
void CAT; void GUIDE;
