// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeFirestore } from './helpers/fakeFirestore';
import { sha256Hex } from '@/shared/planner/sha256';
import { validateBrief, validateBrandGuide, assembleGuideDraft, groundFacts, guideContentKey, type BrandBrief, type BrandGuide } from '@/shared/planner/brandGuide';
import { generateDraft, saveDraftEdit, approveDraft, loadGuideState, GuideError, GUIDE_DRAFTS, GUIDE_VERSIONS, GUIDE_LOCKS, GUIDE_REQUESTS, GENERATE_LEASE_MS } from '@/api/_lib/brandGuide/brandGuide';
import { BRAND_GUIDE_COLLECTION, brandGuideDocId, BRAND_VOICE_COLLECTION, brandVoiceDocId, type CopyModelCall } from '@/api/_lib/planCopy/planCopy';
import { bundle } from './planner/helpers';

const T = 't1';
const P = 'p1';
const BRIEF: BrandBrief = { brandName: 'HAL', whatTheyDo: 'Mahalle fırını ve kahvaltı mekanı.', audience: 'Semt sakinleri ve ofis çalışanları', tone: 'Sıcak ve samimi, abartısız', examples: 'Sabah ekmeği kokusuyla uyan semt. Bugün de sıcak.', avoid: 'indirim vaadi; sağlık iddiası', free: '' };
const MODEL_OUT = { toneLabels: ['samimi', 'zarif'], toneNotes: 'Sıcak, abartısız.', avoid: ['indirim vaadi'], facts: ['Mahalle fırını ve kahvaltı mekanı'], openQuestions: ['Çalışma saatleri neler?'] };
const model = (parsed: unknown = MODEL_OUT, extra: Record<string, unknown> = {}): CopyModelCall & ReturnType<typeof vi.fn> =>
  vi.fn(async () => ({ id: 'gen-1', stopReason: 'end_turn', parsed, provider: 'openrouter', modelUsed: 'm/x', requestId: 'rq-1', usageDetail: { inputTokens: 100, outputTokens: 50, totalTokens: 150, cachedTokens: 0, reasoningTokens: 0, costUsd: 0.002 }, ...extra })) as any;
const KEY = (n: number) => `key-${String(n).padStart(16, '0')}`;
const gen = (db: any, call: CopyModelCall, over: Record<string, unknown> = {}) =>
  generateDraft(db, { callModel: call, model: 'anthropic/claude-sonnet-5.5' }, { tenantId: T, projectId: P, uid: 'u1', brief: BRIEF, expectedDraftVersion: 0, idempotencyKey: KEY(1), now: 100, ...over } as any);
const catchErr = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as GuideError; } throw new Error('hata beklendi'); };
const keys = (db: any) => [...db.data.keys()] as string[];

describe('brief ve taslak birleştirme (saf)', () => {
  it('ad ve "ne yapar" (ya da serbest brief) olmadan brief geçersiz; temizlenir', () => {
    expect(validateBrief({}).ok).toBe(false);
    expect(validateBrief({ brandName: 'HAL' }).ok).toBe(false);
    expect(validateBrief({ brandName: 'HAL', free: 'Mahalle fırını' }).ok).toBe(true);
    const r = validateBrief({ ...BRIEF, whatTheyDo: 'Fırın\n<script>x</script>' });
    expect(r.ok && r.brief.whatTheyDo).toBe('Fırın script x /script');
    expect(validateBrief({ ...BRIEF, tone: 5 }).ok).toBe(false);
  });

  it('olgular brief\'e dayandırılır: dayanaksız olgu DÜŞER ve açık soruya çevrilir', () => {
    const g = groundFacts(['Mahalle fırını ve kahvaltı mekanı', 'Michelin yıldızlı şef', '1923 yılında kuruldu'], BRIEF);
    expect(g.kept).toEqual(['Mahalle fırını ve kahvaltı mekanı']);
    expect(g.dropped).toEqual(['Michelin yıldızlı şef', '1923 yılında kuruldu']);
    const a = assembleGuideDraft(BRIEF, { ...MODEL_OUT, facts: ['Mahalle fırını ve kahvaltı mekanı', 'Michelin yıldızlı şef'] });
    expect(a.guide.facts).toEqual(['Mahalle fırını ve kahvaltı mekanı']);
    expect(a.droppedFacts).toEqual(['Michelin yıldızlı şef']);
    expect(a.guide.openQuestions.join(' ')).toMatch(/Doğrulanamadı, olgu olarak eklenmedi: "Michelin yıldızlı şef"/);
    expect(a.assumptions.join(' ')).toMatch(/1 olgu brief'te dayanağı bulunmadığı için eklenmedi/);
  });

  it('ad/ne yapar/hedef kitle/örnekler kullanıcının sözleridir (model değiştiremez); geçersiz ton etiketi düşer; eksik alanlar SORULUR', () => {
    const a = assembleGuideDraft({ ...BRIEF, audience: '', examples: '', tone: '' }, { ...MODEL_OUT, toneLabels: ['agresif', 'samimi'] });
    expect(a.guide).toMatchObject({ brandName: 'HAL', whatTheyDo: BRIEF.whatTheyDo, audience: '', toneLabels: ['samimi'], examples: [] });
    const q = a.guide.openQuestions.join(' | ');
    expect(q).toMatch(/Hedef kitle kim/);
    expect(q).toMatch(/örnek cümleler/);
    expect(validateBrandGuide(a.guide).ok).toBe(true);
  });

  it('rehber şeması: bilinmeyen alan, uzun metin, geçersiz etiket, fazla öğe reddedilir', () => {
    const ok: BrandGuide = { brandName: 'HAL', whatTheyDo: 'x', audience: '', toneLabels: [], toneNotes: '', examples: [], avoid: [], facts: [], openQuestions: [] };
    expect(validateBrandGuide(ok).ok).toBe(true);
    for (const bad of [{ ...ok, extra: 1 }, { ...ok, brandName: '' }, { ...ok, toneLabels: ['x'] }, { ...ok, facts: Array(21).fill('a') }, { ...ok, whatTheyDo: 'y'.repeat(601) }, { ...ok, examples: 'x' }, null]) {
      expect(validateBrandGuide(bad as any).ok, JSON.stringify(bad)?.slice(0, 40)).toBe(false);
    }
  });
});

describe('generateDraft: AI yalnız TASLAK üretir', () => {
  it('eksik brief: 422, model ÇAĞRILMAZ, hiçbir şey yazılmaz', async () => {
    const db = fakeFirestore();
    const call = model();
    const e = await catchErr(gen(db, call, { brief: { brandName: 'HAL' } }));
    expect(e).toMatchObject({ status: 422, code: 'brief_incomplete' });
    expect(call).not.toHaveBeenCalled();
    expect(keys(db)).toEqual([]);
  });

  it('mutlu yol: taslak v1 (origin ai); model/maliyet meta saklanır; ONAYLI rehber ve sürüm koleksiyonu OLUŞMAZ', async () => {
    const db = fakeFirestore();
    const call = model();
    const { draft, replayed } = await gen(db, call);
    expect(replayed).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
    const sent = (call.mock.calls[0] as any)[0];
    expect(sent.model).toBe('anthropic/claude-sonnet-5.5');
    expect(sent.system).toMatch(/OLGU UYDURMA/);
    expect(sent.user).toMatch(/<brief>[\s\S]*marka: HAL[\s\S]*<\/brief>/);
    expect(draft).toMatchObject({ version: 1, origin: 'ai', baseApprovedVersion: null });
    expect(draft.guide.brandName).toBe('HAL');
    expect(draft.ai).toMatchObject({ provider: 'openrouter', requestedModel: 'anthropic/claude-sonnet-5.5', modelUsed: 'm/x', requestId: 'rq-1', responseId: 'gen-1', usage: { costUsd: 0.002 } });
    expect(keys(db).some((k) => k.startsWith(`${BRAND_GUIDE_COLLECTION}/`) || k.startsWith(`${GUIDE_VERSIONS}/`))).toBe(false);
    expect((await loadGuideState(db, { tenantId: T, projectId: P })).approved).toBeNull();
  });

  it('modelin uydurduğu olgu taslağa girmez', async () => {
    const db = fakeFirestore();
    const { draft } = await gen(db, model({ ...MODEL_OUT, facts: ['Mahalle fırını ve kahvaltı mekanı', '2019\'da Michelin aldı'] }));
    expect(draft.guide.facts).toEqual(['Mahalle fırını ve kahvaltı mekanı']);
    expect(draft.droppedFacts).toEqual(['2019\'da Michelin aldı']);
  });

  it('IDEMPOTENCY: aynı anahtar+yük → önceki taslak, model YENİDEN çağrılmaz; farklı yük → 409', async () => {
    const db = fakeFirestore();
    const call = model();
    await gen(db, call);
    const again = await gen(db, call);
    expect(again.replayed).toBe(true);
    expect(call).toHaveBeenCalledTimes(1);
    const e = await catchErr(gen(db, call, { brief: { ...BRIEF, brandName: 'BAŞKA' } }));
    expect(e).toMatchObject({ status: 409, code: 'idempotency_conflict' });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('SÜRÜM ÇAKIŞMASI: bayat expectedDraftVersion 409 (model çağrılmaz); insan düzenlemesi sessizce ezilmez', async () => {
    const db = fakeFirestore();
    await gen(db, model());
    const edited = (await saveDraftEdit(db, { tenantId: T, projectId: P, uid: 'u1', guide: { ...(await loadGuideState(db, { tenantId: T, projectId: P })).draft!.guide, toneNotes: 'Elle yazdım' }, expectedDraftVersion: 1, idempotencyKey: KEY(2), now: 200 })).draft;
    expect(edited).toMatchObject({ version: 2, origin: 'human' });
    const call = model();
    const e = await catchErr(gen(db, call, { expectedDraftVersion: 1, idempotencyKey: KEY(3) }));
    expect(e).toMatchObject({ status: 409, code: 'draft_conflict', details: { currentVersion: 2 } });
    expect(call).not.toHaveBeenCalled();
    expect((await loadGuideState(db, { tenantId: T, projectId: P })).draft!.guide.toneNotes).toBe('Elle yazdım');
  });

  it('model hatası 502 / ret 422 / geçersiz çıktı 422: taslak YAZILMAZ', async () => {
    for (const [call, status, code] of [
      [vi.fn(async () => { throw new Error('boom'); }) as any, 502, 'model_error'],
      [model(MODEL_OUT, { stopReason: 'refusal' }), 422, 'model_refusal'],
      [model({ toneLabels: ['x'] }), 422, 'model_no_output'],
      [model(null), 422, 'model_no_output'],
    ] as const) {
      const db = fakeFirestore();
      const e = await catchErr(gen(db, call));
      expect(e, code).toMatchObject({ status, code });
      expect(keys(db).filter((k) => k.startsWith(`${GUIDE_DRAFTS}/`) || k.startsWith(`${BRAND_GUIDE_COLLECTION}/`))).toEqual([]);
      expect(keys(db).some((k) => k.startsWith(`${GUIDE_LOCKS}/`))).toBe(false); // kilit bırakıldı
    }
  });

  it('idempotencyKey ve expectedDraftVersion biçimi doğrulanır', async () => {
    const db = fakeFirestore();
    expect(await catchErr(gen(db, model(), { idempotencyKey: 'kisa' }))).toMatchObject({ status: 400 });
    expect(await catchErr(gen(db, model(), { expectedDraftVersion: -1 }))).toMatchObject({ status: 400 });
    expect(await catchErr(gen(db, model(), { expectedDraftVersion: 'x' }))).toMatchObject({ status: 400 });
  });
});

describe('generateDraft: eşzamanlılık — model çağrısından ÖNCE atomik rezervasyon', () => {
  /** Barrier'lı model: serbest bırakılana kadar bekler (eşzamanlı çağrıları yakalamak için) */
  function barrierModel() {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const call = vi.fn(async () => { await gate; return { id: 'gen-b', stopReason: 'end_turn', parsed: MODEL_OUT, provider: 'openrouter', modelUsed: 'm/x', requestId: null }; }) as any as CopyModelCall & ReturnType<typeof vi.fn>;
    return { call, release };
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const reqDocs = (db: any) => keys(db).filter((k) => k.startsWith(`${GUIDE_REQUESTS}/`));

  it('AYNI anahtar+yük eşzamanlı iki istek → TAM 1 model çağrısı; ikincisi model çağırmadan request_pending; bitince completed replay yine 1', async () => {
    const db = fakeFirestore();
    const { call, release } = barrierModel();
    const a = gen(db, call);
    await tick();
    const e = await catchErr(gen(db, call)); // A modelde beklerken
    expect(e).toMatchObject({ status: 409, code: 'request_pending', details: { retryAfterMs: expect.any(Number) } });
    expect(call).toHaveBeenCalledTimes(1);
    release();
    const done = await a;
    expect(done).toMatchObject({ replayed: false, draft: { version: 1 } });
    expect(call).toHaveBeenCalledTimes(1);
    const again = await gen(db, call);
    expect(again.replayed).toBe(true);
    expect(again.draft.version).toBe(1);
    expect(call).toHaveBeenCalledTimes(1);
    expect(keys(db).filter((k) => k.startsWith(`${GUIDE_DRAFTS}/`))).toHaveLength(1);
    expect(keys(db).some((k) => k.startsWith(`${GUIDE_LOCKS}/`))).toBe(false);
  });

  it('N paralel aynı-anahtar istek: yalnız 1 model çağrısı, 1 taslak belgesi', async () => {
    const db = fakeFirestore();
    const { call, release } = barrierModel();
    const all = Array.from({ length: 6 }, () => gen(db, call).then((r) => ({ ok: r }), (e) => ({ err: e as GuideError })));
    await tick();
    release();
    const rs = await Promise.all(all);
    expect(call).toHaveBeenCalledTimes(1);
    expect(rs.filter((r: any) => r.ok)).toHaveLength(1);
    expect(rs.filter((r: any) => r.err).every((r: any) => ['request_pending', 'idempotency_conflict'].includes(r.err.code))).toBe(true);
    expect(keys(db).filter((k) => k.startsWith(`${GUIDE_DRAFTS}/`))).toHaveLength(1);
  });

  it('aynı anahtar FARKLI yük (süren istek varken) → idempotency_conflict, model çağrısı YOK', async () => {
    const db = fakeFirestore();
    const { call, release } = barrierModel();
    const a = gen(db, call);
    await tick();
    const e = await catchErr(gen(db, call, { brief: { ...BRIEF, brandName: 'BAŞKA' } }));
    expect(e).toMatchObject({ status: 409, code: 'idempotency_conflict' });
    expect(call).toHaveBeenCalledTimes(1);
    release();
    await a;
  });

  it('BAŞKA anahtarla aynı projede süren üretim varken ikinci ücretli çağrı yapılmaz (proje kilidi)', async () => {
    const db = fakeFirestore();
    const { call, release } = barrierModel();
    const a = gen(db, call);
    await tick();
    const e = await catchErr(gen(db, call, { idempotencyKey: KEY(2) }));
    expect(e).toMatchObject({ status: 409, code: 'request_pending' });
    expect(call).toHaveBeenCalledTimes(1);
    release();
    await a;
    // kilit bırakıldı: sonraki (bilinçli) üretim sürüm 1'den devam eder
    const next = await gen(db, model(), { idempotencyKey: KEY(3), expectedDraftVersion: 1 });
    expect(next.draft.version).toBe(2);
  });

  it('FARKLI proje/uid aynı anda bağımsızdır (kilit proje başınadır); aynı anahtar başka projeyle kullanılırsa idempotency_conflict, model yok', async () => {
    const db = fakeFirestore();
    const { call, release } = barrierModel();
    const a = gen(db, call);
    const other = model();
    await tick();
    const b = await gen(db, other, { projectId: 'p2', uid: 'u2', idempotencyKey: KEY(9) });
    expect(b.draft.version).toBe(1);
    expect(other).toHaveBeenCalledTimes(1);
    const c = model();
    expect(await catchErr(gen(db, c, { projectId: 'p3' }))).toMatchObject({ code: 'idempotency_conflict' }); // aynı uid+anahtar, farklı proje
    expect(c).not.toHaveBeenCalled();
    release();
    await a;
  });

  it('BAŞARISIZ deneme kalıcıdır: aynı anahtarla tekrar model ÇAĞIRMAZ, aynı hatayı döner; kilit bırakılır; yeni anahtar bilinçli yeni deneme', async () => {
    const db = fakeFirestore();
    const bad = vi.fn(async () => { throw new Error('boom'); }) as any;
    expect(await catchErr(gen(db, bad))).toMatchObject({ status: 502, code: 'model_error' });
    expect(bad).toHaveBeenCalledTimes(1);
    expect(await catchErr(gen(db, bad))).toMatchObject({ status: 502, code: 'model_error' });
    expect(bad).toHaveBeenCalledTimes(1);
    expect(keys(db).some((k) => k.startsWith(`${GUIDE_LOCKS}/`))).toBe(false);
    const ok = model();
    const r = await gen(db, ok, { idempotencyKey: KEY(4) });
    expect(r.draft.version).toBe(1);
    expect(ok).toHaveBeenCalledTimes(1);
    expect(keys(db).some((k) => k.startsWith(`${BRAND_GUIDE_COLLECTION}/`))).toBe(false); // sahte onaylı başarı yok
  });

  it('SÜRESİ DOLMUŞ pending: kör yeniden deneme YOK (request_expired, model çağrılmaz); bilinçli yeni anahtar ilerler ve eski kilidi aşar', async () => {
    const db = fakeFirestore();
    const { call, release } = barrierModel();
    void gen(db, call, { now: 1000 }).catch(() => {});
    await tick();
    const later = 1000 + GENERATE_LEASE_MS + 1;
    const probe = model();
    expect(await catchErr(gen(db, probe, { now: later }))).toMatchObject({ status: 409, code: 'request_expired' });
    expect(probe).not.toHaveBeenCalled();
    // aynı anahtarla sormaya devam etmek de modele gitmez
    expect(await catchErr(gen(db, probe, { now: later + 10 }))).toMatchObject({ code: 'request_expired' });
    expect(probe).not.toHaveBeenCalled();
    // kullanıcı bilinçli olarak YENİ anahtar kullanır: süresi dolmuş kilit engel olmaz
    const fresh = await gen(db, probe, { now: later, idempotencyKey: KEY(5) });
    expect(fresh.draft.version).toBe(1);
    expect(probe).toHaveBeenCalledTimes(1);
    release();
    await tick();
  });

  it('üretim sırasında insan taslağı değiştirirse sonuç YAZILMAZ (draft_conflict), insan düzenlemesi korunur, kayıt failed olur', async () => {
    const db = fakeFirestore();
    // v1 taslağı hazırla
    const first = await gen(db, model());
    const { call, release } = barrierModel();
    const a = gen(db, call, { expectedDraftVersion: 1, idempotencyKey: KEY(6) }).then(() => null, (e) => e as GuideError);
    await tick();
    await saveDraftEdit(db, { tenantId: T, projectId: P, uid: 'u1', guide: { ...first.draft.guide, toneNotes: 'Elle yazdım' }, expectedDraftVersion: 1, idempotencyKey: KEY(7), now: 500 });
    release();
    expect(await a).toMatchObject({ status: 409, code: 'draft_conflict', details: { currentVersion: 2 } });
    const st = await loadGuideState(db, { tenantId: T, projectId: P });
    expect(st.draft).toMatchObject({ version: 2, origin: 'human' });
    expect(st.draft!.guide.toneNotes).toBe('Elle yazdım');
    expect(await catchErr(gen(db, model(), { expectedDraftVersion: 1, idempotencyKey: KEY(6) }))).toMatchObject({ code: 'draft_conflict' }); // kalıcı başarısız
    expect(keys(db).some((k) => k.startsWith(`${GUIDE_LOCKS}/`))).toBe(false);
  });

  it('kapsam: istek kaydı tenant+uid+eylem+anahtardır; başka uid aynı anahtarı ayrı kullanır (kimlik kapsamı korunur)', async () => {
    const db = fakeFirestore();
    const c1 = model();
    await gen(db, c1);
    const c2 = model();
    const r = await gen(db, c2, { uid: 'u2', projectId: 'p2' });
    expect(r.replayed).toBe(false);
    expect(c2).toHaveBeenCalledTimes(1);
    expect(reqDocs(db)).toHaveLength(2);
  });
});

describe('approveDraft: YALNIZ açık insan onayı onaylı rehber olur', () => {
  async function withDraft() {
    const db = fakeFirestore();
    const { draft } = await gen(db, model());
    return { db, draft };
  }
  const approve = (db: any, over: Record<string, unknown>) =>
    approveDraft(db, { tenantId: T, projectId: P, uid: 'admin1', confirm: true, expectedDraftVersion: 1, contentKey: '', expectedApprovedVersion: null, idempotencyKey: KEY(10), now: 300, ...over } as any);

  it('confirm:true olmadan reddedilir; taslak onaylı olmaz', async () => {
    const { db, draft } = await withDraft();
    for (const confirm of [undefined, false, 'true', 1]) {
      expect(await catchErr(approve(db, { confirm, contentKey: draft.contentKey }))).toMatchObject({ status: 400, code: 'confirm_required' });
    }
    expect(keys(db).some((k) => k.startsWith(`${BRAND_GUIDE_COLLECTION}/`))).toBe(false);
  });

  it('onay: onaylı v1 + değişmez sürüm kopyası; AI kökenli taslak da yalnız bu yolla; tekrar aynı anahtar → replay', async () => {
    const { db, draft } = await withDraft();
    const r = await approve(db, { contentKey: draft.contentKey });
    expect(r.replayed).toBe(false);
    expect(r.approved).toMatchObject({ version: 1, approvedBy: 'admin1', contentKey: draft.contentKey });
    expect(db.data.get(`${BRAND_GUIDE_COLLECTION}/${brandGuideDocId(T, P)}`)).toMatchObject({ version: 1, sourceDraftVersion: 1, draftOrigin: 'ai', approvedBy: 'admin1' });
    expect(db.data.get(`${GUIDE_VERSIONS}/${brandGuideDocId(T, P)}_v1`)).toMatchObject({ version: 1 });
    expect((await approve(db, { contentKey: draft.contentKey })).replayed).toBe(true);
    expect(await catchErr(approve(db, { contentKey: draft.contentKey, expectedDraftVersion: 1, idempotencyKey: KEY(10), expectedApprovedVersion: 5 }))).toMatchObject({ code: 'idempotency_conflict' });
  });

  it('onay ekranından sonra taslak değişirse (sürüm veya içerik) onay REDDEDİLİR', async () => {
    const { db, draft } = await withDraft();
    const g = (await loadGuideState(db, { tenantId: T, projectId: P })).draft!.guide;
    await saveDraftEdit(db, { tenantId: T, projectId: P, uid: 'u2', guide: { ...g, avoid: [...g.avoid, 'yeni madde'] }, expectedDraftVersion: 1, idempotencyKey: KEY(11), now: 250 });
    expect(await catchErr(approve(db, { contentKey: draft.contentKey, expectedDraftVersion: 1 }))).toMatchObject({ status: 409, code: 'draft_conflict' });
    expect(await catchErr(approve(db, { contentKey: draft.contentKey, expectedDraftVersion: 2, idempotencyKey: KEY(12) }))).toMatchObject({ status: 409, code: 'content_mismatch' });
    expect(keys(db).some((k) => k.startsWith(`${BRAND_GUIDE_COLLECTION}/`))).toBe(false);
  });

  it('VAR OLAN onaylı rehber korunur: yeni onay expectedApprovedVersion ister; sürüm +1, eski sürüm kopyası kalır; bayat sürüm 409', async () => {
    const { db, draft } = await withDraft();
    await approve(db, { contentKey: draft.contentKey });
    const g = (await loadGuideState(db, { tenantId: T, projectId: P })).draft!.guide;
    const v2 = (await saveDraftEdit(db, { tenantId: T, projectId: P, uid: 'u1', guide: { ...g, toneNotes: 'Yeni ton' }, expectedDraftVersion: 1, idempotencyKey: KEY(13), now: 400 })).draft;
    expect(v2.baseApprovedVersion).toBe(1);
    // onaylı sürüm bilgisi olmadan (null) üzerine yazılamaz
    expect(await catchErr(approve(db, { contentKey: v2.contentKey, expectedDraftVersion: 2, expectedApprovedVersion: null, idempotencyKey: KEY(14) }))).toMatchObject({ status: 409, code: 'approved_version_conflict', details: { currentApprovedVersion: 1 } });
    expect((db.data.get(`${BRAND_GUIDE_COLLECTION}/${brandGuideDocId(T, P)}`) as any).version).toBe(1);
    const r = await approve(db, { contentKey: v2.contentKey, expectedDraftVersion: 2, expectedApprovedVersion: 1, idempotencyKey: KEY(15) });
    expect(r.approved.version).toBe(2);
    expect((db.data.get(`${GUIDE_VERSIONS}/${brandGuideDocId(T, P)}_v1`) as any).guide.toneNotes).toBe('Sıcak, abartısız.');
    expect((db.data.get(`${GUIDE_VERSIONS}/${brandGuideDocId(T, P)}_v2`) as any).guide.toneNotes).toBe('Yeni ton');
  });

  it('AI taslak üretimi ONAYLI rehberi değiştirmez (onaylı sürüm ve içerik aynen kalır)', async () => {
    const { db, draft } = await withDraft();
    await approve(db, { contentKey: draft.contentKey });
    const before = JSON.stringify(db.data.get(`${BRAND_GUIDE_COLLECTION}/${brandGuideDocId(T, P)}`));
    await gen(db, model({ ...MODEL_OUT, toneNotes: 'Tamamen farklı' }), { brief: { ...BRIEF, brandName: 'YENİ' }, expectedDraftVersion: 1, idempotencyKey: KEY(16) });
    expect(JSON.stringify(db.data.get(`${BRAND_GUIDE_COLLECTION}/${brandGuideDocId(T, P)}`))).toBe(before);
  });

  it('yüklü marka sesi paketi varsa konuşmalı rehber onaylanamaz (paket öncelikli)', async () => {
    const { db, draft } = await withDraft();
    db.data.set(`${BRAND_VOICE_COLLECTION}/${brandVoiceDocId(T, P)}`, { tenantId: T, projectId: P, bundle: bundle(), updatedBy: 'a', updatedAt: 1 });
    expect(await catchErr(approve(db, { contentKey: draft.contentKey }))).toMatchObject({ status: 409, code: 'bundle_guide_exists' });
  });

  it('taslak yok → 404; başka proje/tenant taslağı kullanılmaz', async () => {
    const db = fakeFirestore();
    expect(await catchErr(approve(db, { contentKey: 'a'.repeat(32) }))).toMatchObject({ status: 404, code: 'draft_missing' });
    const { db: db2, draft } = await withDraft();
    const e = await catchErr(approveDraft(db2, { tenantId: T, projectId: 'p2', uid: 'admin1', confirm: true, expectedDraftVersion: 1, contentKey: draft.contentKey, expectedApprovedVersion: null, idempotencyKey: KEY(17), now: 1 } as any));
    expect(e).toMatchObject({ status: 404 });
    const e2 = await catchErr(approveDraft(db2, { tenantId: 't2', projectId: P, uid: 'admin1', confirm: true, expectedDraftVersion: 1, contentKey: draft.contentKey, expectedApprovedVersion: null, idempotencyKey: KEY(18), now: 1 } as any));
    expect(e2).toMatchObject({ status: 404 });
  });
});

describe('saveDraftEdit', () => {
  it('geçersiz rehber 422; bayat sürüm 409; replay aynı sonuç', async () => {
    const db = fakeFirestore();
    const { draft } = await gen(db, model());
    const save = (over: Record<string, unknown>) => saveDraftEdit(db, { tenantId: T, projectId: P, uid: 'u1', guide: draft.guide, expectedDraftVersion: 1, idempotencyKey: KEY(20), now: 5, ...over } as any);
    expect(await catchErr(save({ guide: { ...draft.guide, brandName: '' } }))).toMatchObject({ status: 422, code: 'guide_invalid' });
    expect(await catchErr(save({ expectedDraftVersion: 0 }))).toMatchObject({ status: 409, code: 'draft_conflict' });
    const a = await save({ guide: { ...draft.guide, toneNotes: 'a' } });
    const b = await save({ guide: { ...draft.guide, toneNotes: 'a' } });
    expect([a.replayed, b.replayed]).toEqual([false, true]);
    expect(b.draft.version).toBe(2);
    expect(await catchErr(save({ guide: { ...draft.guide, toneNotes: 'farklı' } }))).toMatchObject({ code: 'idempotency_conflict' });
  });
});

// ── uç nokta ──
const authUser: { current: any } = { current: null };
vi.mock('@/api/_lib/withAuth', () => ({ withAuth: (h: any) => (r: any, s: any) => h(Object.assign(r, authUser.current), s) }));
const endpointDb: { current: any } = { current: null };
vi.mock('@/api/_lib/firebaseAdmin', () => ({ getAdminDb: () => endpointDb.current }));
vi.mock('@/api/_lib/rateLimit', async (orig) => ({ ...(await orig<any>()), applyRateLimit: () => true }));
const endpointModel: { current: CopyModelCall } = { current: model() };
vi.mock('@/api/_lib/planCopy/openrouterCopyCall', () => ({ openrouterCopyCall: () => (...a: any[]) => (endpointModel.current as any)(...a) }));
import handler from '@/api/studio/brand-guide';

const res = () => {
  const r: any = { statusCode: 0, body: null, headers: {} };
  r.setHeader = (k: string, v: string) => ((r.headers[k] = v), r);
  r.status = (s: number) => ((r.statusCode = s), r);
  r.json = (b: any) => ((r.body = b), r);
  return r;
};
const call = async (body: any, method = 'POST') => { const r = res(); await (handler as any)({ method, body: method === 'POST' ? body : undefined, query: method === 'GET' ? body : {} }, r); return r; };
const as = (uid: string, role: string, tenantId = 't1') => (authUser.current = { userId: uid, userUid: uid, tenantId, userRole: role });

describe('/api/studio/brand-guide', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    const db = fakeFirestore();
    db.data.set('projects/p1', { tenantId: 't1' });
    db.data.set('users/admin1', { tenantId: 't1', role: 'admin' });
    db.data.set('users/bm1', { tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['p1'] } });
    db.data.set('users/bm2', { tenantId: 't1', role: 'brand_manager', profile: { assignedProjectIds: ['p2'] } });
    db.data.set('users/client1', { tenantId: 't1', role: 'client', profile: { assignedProjectIds: ['p1'] } });
    db.data.set('users/fl1', { tenantId: 't1', role: 'freelancer', profile: { assignedProjectIds: ['p1'] } });
    db.data.set('users/other', { tenantId: 't2', role: 'admin' });
    endpointDb.current = db;
    as('admin1', 'admin');
    process.env.PLAN_COPY_AI_ENABLED = 'true';
    process.env.OPENROUTER_API_KEY = 'test-anahtar-gercek-degil';
    delete process.env.PLAN_COPY_MODEL;
    endpointModel.current = model();
  });
  afterEach(() => { process.env = { ...saved }; });
  const gbody = (o: any = {}) => ({ projectId: 'p1', action: 'generate', brief: BRIEF, expectedDraftVersion: 0, idempotencyKey: KEY(30), ...o });

  it('yöntem/action doğrulaması: 405, 400', async () => {
    expect((await call({}, 'PUT')).statusCode).toBe(405);
    expect((await call({ projectId: 'p1', action: 'sil' })).statusCode).toBe(400);
  });

  it('rol sınırı: müşteri/freelancer/başka tenant/atanmamış marka yöneticisi reddedilir; model çağrılmaz', async () => {
    for (const [uid, role, tenant] of [['client1', 'client', 't1'], ['fl1', 'freelancer', 't1'], ['other', 'admin', 't2'], ['bm2', 'brand_manager', 't1']] as const) {
      as(uid, role, tenant);
      const r = await call(gbody());
      expect(r.statusCode, uid).toBe(403);
    }
    expect(endpointModel.current).not.toHaveBeenCalled();
  });

  it('atanmış marka yöneticisi taslak üretir/düzenler ama ONAYLAYAMAZ (yalnız yönetici)', async () => {
    as('bm1', 'brand_manager');
    const g = await call(gbody());
    expect(g.statusCode).toBe(200);
    expect(g.body).toMatchObject({ draftOnly: true, replayed: false, draft: { version: 1, origin: 'ai' } });
    const s = await call({ projectId: 'p1', action: 'save', guide: g.body.draft.guide, expectedDraftVersion: 1, idempotencyKey: KEY(31) });
    expect(s.statusCode).toBe(200);
    const a = await call({ projectId: 'p1', action: 'approve', confirm: true, expectedDraftVersion: 2, contentKey: s.body.draft.contentKey, expectedApprovedVersion: null, idempotencyKey: KEY(32) });
    expect(a.statusCode).toBe(403);
    expect(keysOf()).not.toContain(`${BRAND_GUIDE_COLLECTION}/${brandGuideDocId('t1', 'p1')}`);
  });
  const keysOf = () => [...endpointDb.current.data.keys()] as string[];

  it('tam akış (yönetici): taslak → onay; GET durumu onaylı rehberi ve taslağı gösterir; plan-copy bu rehberi görür (approved_guide)', async () => {
    const g = await call(gbody());
    const a = await call({ projectId: 'p1', action: 'approve', confirm: true, expectedDraftVersion: 1, contentKey: g.body.draft.contentKey, expectedApprovedVersion: null, idempotencyKey: KEY(33) });
    expect(a.statusCode).toBe(200);
    expect(a.body.approved).toMatchObject({ version: 1, approvedBy: 'admin1' });
    const st = await call({ projectId: 'p1' }, 'GET');
    expect(st.body).toMatchObject({ aiEnabled: true, bundleExists: false, approved: { version: 1 }, draft: { version: 1 } });
    const { findApprovedGuide } = await import('@/api/_lib/planCopy/planCopy');
    expect(await findApprovedGuide(endpointDb.current, 't1', 'p1')).toMatchObject({ version: 1, guide: { brandName: 'HAL' } });
  });

  it('SAĞLAYICI KAPALI: generate 503 feature_disabled (model çağrılmaz) — insan düzenlemesi ve GET çalışır', async () => {
    delete process.env.PLAN_COPY_AI_ENABLED;
    const r = await call(gbody());
    expect(r.statusCode).toBe(503);
    expect(r.body).toMatchObject({ code: 'feature_disabled' });
    expect(endpointModel.current).not.toHaveBeenCalled();
    const st = await call({ projectId: 'p1' }, 'GET');
    expect(st.statusCode).toBe(200);
    expect(st.body.aiEnabled).toBe(false);
    const guide = { brandName: 'HAL', whatTheyDo: 'Fırın', audience: '', toneLabels: [], toneNotes: '', examples: [], avoid: [], facts: [], openQuestions: [] };
    expect((await call({ projectId: 'p1', action: 'save', guide, expectedDraftVersion: 0, idempotencyKey: KEY(34) })).statusCode).toBe(200);
  });

  it('geçersiz model kimliği 503; eksik brief 422 (model çağrılmaz); çakışma 409', async () => {
    process.env.PLAN_COPY_MODEL = 'claude-sonnet-5-5';
    expect((await call(gbody())).statusCode).toBe(503);
    delete process.env.PLAN_COPY_MODEL;
    const bad = await call(gbody({ brief: { brandName: 'HAL' }, idempotencyKey: KEY(35) }));
    expect(bad.statusCode).toBe(422);
    expect(bad.body.code).toBe('brief_incomplete');
    expect(endpointModel.current).not.toHaveBeenCalled();
    expect((await call(gbody({ idempotencyKey: KEY(36) }))).statusCode).toBe(200);
    expect((await call(gbody({ idempotencyKey: KEY(37) }))).statusCode).toBe(409);
  });
});

it('guideContentKey içerik değişince değişir', () => {
  const g: BrandGuide = { brandName: 'A', whatTheyDo: 'x', audience: '', toneLabels: [], toneNotes: '', examples: [], avoid: [], facts: [], openQuestions: [] };
  expect(guideContentKey(g, sha256Hex)).not.toBe(guideContentKey({ ...g, toneNotes: 'y' }, sha256Hex));
  expect(guideContentKey(g, sha256Hex)).toMatch(/^[0-9a-f]{32}$/);
});
void GUIDE_DRAFTS;
