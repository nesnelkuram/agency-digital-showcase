// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { fakeFirestore } from '../../helpers/fakeFirestore';
import { suggestWeeklyPlan, type PlanModelCall } from '@/api/_lib/planSuggest/planSuggest';
import { recordSuggestionFeedback, SuggestionFeedbackSchema, FEEDBACK_CATEGORIES, FEEDBACK_SCOPES } from '@/api/_lib/feedback/contentFeedback';
import { candidatesFromBrandMedia } from '@/studio/feedPlanner/integration/fromBrandMedia';
import { planFromSuggestion, localDay } from '@/studio/feedPlanner/integration/fromSuggestion';
import { buildSuggestionRejectBody, mapLocalAction, FEEDBACK_CATEGORIES as OUR_CATS, FEEDBACK_SCOPES as OUR_SCOPES } from '@/studio/feedPlanner/integration/feedbackContract';
import { detectLang } from '@/studio/feedPlanner/integration/language';
import type { Candidate } from '@/studio/feedPlanner/types';
import type { LiveSuggestionResponse, LiveValidatedPost } from '@/studio/feedPlanner/integration/liveTypes';
import { POLICY, T, P, REAL_STORY, assetsOf, seedAsset } from './liveFixtures';

const TZ = 'Europe/Istanbul';
const [S1, S2, S3] = REAL_STORY;

/**
 * KONTROLLÜ YEREL JSON — modelden GELMEDİ, elle yazıldı. PlanSuggestionSchema biçimindedir ve gerçek
 * suggestWeeklyPlan/validateSuggestion hattından geçer. Hiçbir model/API çağrısı yoktur.
 */
const HAND_AUTHORED_JSON = {
  posts: [
    { day: 0, time: '10:00', postType: 'static', mediaIds: ['f1'], captionDraft: 'Biz çoktan seçtik. Siz sadece masaya oturun.', rationale: 'r0' },
    { day: 1, time: '09:00', postType: 'story', mediaIds: [S1.id], captionDraft: 'Pazarlamada serseri, mutfakta beyefendi.', rationale: 'r1' },
    { day: 1, time: '12:00', postType: 'story', mediaIds: [S2.id], captionDraft: 'Bazı şeyler sabrınızı hak eder.', rationale: 'r2' },
    { day: 1, time: '15:00', postType: 'story', mediaIds: [S3.id], captionDraft: 'Standartlarını düşürme.', rationale: 'r3' },
    { day: 2, time: '18:00', postType: 'reels', mediaIds: ['vid1'], captionDraft: 'Reels taslağı', rationale: 'r4' },
    { day: 3, time: '11:00', postType: 'carousel', mediaIds: ['f2', 'f3'], captionDraft: 'Çoklu görsel', rationale: 'r5' },
    { day: 4, time: '12:00', postType: 'static', mediaIds: ['f4', 'f5'], captionDraft: 'iki foto', rationale: 'r6' },
    { day: 5, time: '10:00', postType: 'story', mediaIds: ['ghost-id'], captionDraft: 'uydurma', rationale: 'r7' },
    { day: 5, time: '11:00', postType: 'static', mediaIds: ['f1'], captionDraft: 'tekrar', rationale: 'r8' },
    { day: 6, time: '10:00', postType: 'reels', mediaIds: ['f5'], captionDraft: 'foto reels', rationale: 'r9' },
    { day: 6, time: '25:00', postType: 'story', mediaIds: ['f4'], captionDraft: 'saat yok', rationale: 'r10' },
    { day: 6, time: '10:00', postType: 'static', mediaIds: ['f4'], captionDraft: 'We already chose. You just take a seat.', rationale: 'r11' },
  ],
  shortages: [],
};

const setup = () => {
  const db = fakeFirestore();
  for (const s of REAL_STORY.slice(0, 3)) seedAsset(db, s.id, { w: s.w, h: s.h, createdAt: 3_000 });
  for (const id of ['f1', 'f2', 'f3', 'f4', 'f5']) seedAsset(db, id, { createdAt: 2_000 });
  seedAsset(db, 'vid1', { kind: 'video', w: 1080, h: 1920, createdAt: 1_000 });
  return db;
};
const stub: PlanModelCall = vi.fn(async () => ({ id: 'local-json', stopReason: 'end_turn', parsed: HAND_AUTHORED_JSON, usage: undefined }));
const run = async (db: any) =>
  suggestWeeklyPlan(db, { callModel: stub, policy: POLICY, newId: () => 'set0001' }, { tenantId: T, projectId: P, weekStart: '2026-10-12', timeZone: TZ, count: 14, createdBy: 'u1' });

describe('kontrollü yerel JSON → gerçek doğrulama hattı', () => {
  it('geçerli öneriler kabul, kuralları ihlal edenler nedenle reddedilir (model çağrısı yok)', async () => {
    const db = setup();
    const r = await run(db);
    expect(stub).toHaveBeenCalledTimes(1);
    expect(r.suggestionSetId).toBe('set0001');
    expect(r.accepted.map((a) => a.index)).toEqual([0, 1, 2, 3, 4, 5, 11]);
    const why = (i: number) => r.rejected.find((x) => x.index === i)!.reasons.join(',');
    expect(why(6)).toMatch(/static_needs_one_photo/);
    expect(why(7)).toMatch(/unknown_media:ghost-id/);
    expect(why(8)).toMatch(/reused_media:f1/);
    expect(why(9)).toMatch(/reels_needs_one_video/); // fotoğraf Reels kapağı canlı şemada kaydedilemez
    expect(why(10)).toMatch(/invalid_time/);
  });

  it('BULGU: sunucu dili denetlemez — İngilizce captionDraft kabul edilir; adaptör dili işaretler', async () => {
    const r = await run(setup());
    const eng = r.accepted.find((a) => a.index === 11)!;
    expect(eng.captionDraft).toMatch(/We already chose/);
    expect(detectLang(eng.captionDraft)).toBe('en');
    expect(detectLang('Biz çoktan seçtik. Siz sadece masaya oturun.')).toBe('tr');
    expect(detectLang('Reels')).toBe('unknown');
  });

  it('kabul edilen öneri planlayıcı durumuna: ızgara zaman sırasıyla, carousel yerleşmez, Story caption olarak, seri DESTEKLENMİYOR', async () => {
    const db = setup();
    const resp = (await run(db)) as unknown as LiveSuggestionResponse;
    const conv = candidatesFromBrandMedia(assetsOf(db), { tenantId: T, projectId: P }, { policy: POLICY });
    const byId = new Map(conv.candidates.map((c) => [c.id, c]));
    const r = planFromSuggestion(resp, byId, { timeZone: TZ });
    expect(r.feed.slots.slice(0, 3)).toEqual(['f1', 'vid1', 'f4']);
    expect(r.feed.formats.slice(0, 3)).toEqual(['feed-4x5', 'reels-cover', 'feed-4x5']);
    expect(r.story.slots.slice(0, 4)).toEqual([S1.id, S2.id, S3.id, null]);
    expect(r.unplaced).toEqual([{ index: 5, reason: 'carousel_multi_media' }]);
    // Story metni caption olarak taşınır; başlık/gövde dağıtılmaz
    for (const i of [0, 1, 2]) expect(r.story.texts[i]).toMatchObject({ source: 'suggestion', caption: expect.any(String) });
    // Dil sezgisi tutucudur: Türkçe harf/sözcük kanıtı yoksa 'unknown' (ilk cümlede kanıt yok, diğerlerinde ı/ü var)
    expect(r.story.texts.slice(0, 3).map((t) => t!.lang)).toEqual(['unknown', 'tr', 'tr']);
    expect(r.story.texts[0]!.headline).toBeUndefined();
    expect(r.series).toMatchObject({ supported: false, basis: 'inferred_same_local_day', inferredRoles: ['headline', 'body', 'none'] });
    expect(r.series.caveat).toMatch(/farklı ürünler/);
    expect(r.feed.texts[2]).toMatchObject({ lang: 'en' }); // dil doğrulanamaz, işaretli
    expect(r.refs['feed:0']).toMatchObject({ suggestionSetId: 'set0001', index: 0 });
    expect(r.meta['story:0'].scheduledAt).toMatch(/^2026-10-13T/);
  });

  it('gerçek sürüm: slot başına sürüm 1; öneri kümesi yoksa ret bağlanamaz notu', async () => {
    const db = setup();
    const resp = { ...(await run(db)), suggestionSetId: null } as unknown as LiveSuggestionResponse;
    const conv = candidatesFromBrandMedia(assetsOf(db), { tenantId: T, projectId: P }, { policy: POLICY });
    const r = planFromSuggestion(resp, new Map(conv.candidates.map((c) => [c.id, c])), { timeZone: TZ });
    expect(r.refs).toEqual({});
    expect(r.notes.join(' ')).toMatch(/suggestionSetId yok/);
    expect(r.feed.versions[0]).toBe(1);
  });
});

describe('geri bildirim: gerçek şema ve gerçek kayıt mantığı', () => {
  it('kategori/kapsam sabitleri gerçekle aynı', () => {
    expect([...OUR_CATS]).toEqual([...FEEDBACK_CATEGORIES]);
    expect([...OUR_SCOPES]).toEqual([...FEEDBACK_SCOPES]);
  });

  it('inşa edilen gövde gerçek SuggestionFeedbackSchema ve recordSuggestionFeedback tarafından kabul edilir; idempotent; yanlış hash 409', async () => {
    const db = setup();
    const resp = (await run(db)) as unknown as LiveSuggestionResponse;
    const conv = candidatesFromBrandMedia(assetsOf(db), { tenantId: T, projectId: P }, { policy: POLICY });
    const plan = planFromSuggestion(resp, new Map(conv.candidates.map((c) => [c.id, c])), { timeZone: TZ });
    const map = mapLocalAction('reject_with_reason', plan.refs['feed:0'], { category: 'tekrar', note: 'geçen haftaya benziyor', scope: 'content_only', idempotencyKey: 'abcdefghijklmnop0001' });
    expect(map.kind).toBe('request');
    if (map.kind !== 'request') return;
    expect(SuggestionFeedbackSchema.safeParse(map.body).success).toBe(true);
    const actor = { uid: 'u1', name: 'U', role: 'admin', tenantId: T };
    const args = { actor, input: map.body, now: 5_000, checkAccess: async () => ({ ok: true as const }) };
    const first: any = await recordSuggestionFeedback(db, args);
    expect(first).toMatchObject({ ok: true, created: true });
    expect(first.feedback).toMatchObject({ projectId: P, action: 'suggestion_reject', scope: 'content_only' });
    expect(((await recordSuggestionFeedback(db, args)) as any).created).toBe(false); // tekrar aynı kayıt
    const stale: any = await recordSuggestionFeedback(db, { ...args, input: { ...map.body, idempotencyKey: 'abcdefghijklmnop0002', expectedContentHash: 'f'.repeat(32) } });
    expect(stale).toMatchObject({ ok: false, httpStatus: 409, code: 'CONTENT_VERSION_CHANGED' });
  });

  it('adaptör doğrulaması gerçek şemayla aynı kararı verir (geçerli/geçersiz örnek matrisi)', () => {
    const base = { suggestionSetId: 'set0001', index: 2, category: 'görsel', note: 'x', scope: 'brand_context', idempotencyKey: 'abcdefghijklmnop0001', expectedContentHash: 'a'.repeat(32) };
    const cases: Array<Partial<typeof base>> = [
      {}, { category: 'yok' }, { scope: 'x' }, { index: -1 }, { index: 51 }, { index: 1.5 as any }, { suggestionSetId: 'a b' }, { suggestionSetId: '' },
      { idempotencyKey: 'kisa' }, { idempotencyKey: 'abcdefghijklmnop_001' }, { expectedContentHash: 'A'.repeat(32) }, { expectedContentHash: 'a'.repeat(31) }, { note: 'x'.repeat(501) }, { note: 'x'.repeat(500) }, { note: undefined },
    ];
    for (const c of cases) {
      const input = { ...base, ...c } as any;
      const ours = buildSuggestionRejectBody(input);
      const real = SuggestionFeedbackSchema.safeParse({
        target: { kind: 'suggestion', suggestionSetId: input.suggestionSetId, index: input.index }, category: input.category, note: input.note ?? '', scope: input.scope,
        idempotencyKey: input.idempotencyKey, expectedContentHash: input.expectedContentHash,
      });
      expect(ours.ok, JSON.stringify(c)).toBe(real.success);
    }
  });

  it('karşılığı olmayan eylemler uydurma istek üretmez: açık "gap"', () => {
    expect(mapLocalAction('lock', undefined)).toMatchObject({ kind: 'gap', gap: 'lock_not_persisted' });
    expect(mapLocalAction('unlock', undefined)).toMatchObject({ kind: 'gap', gap: 'lock_not_persisted' });
    expect(mapLocalAction('dismiss', undefined)).toMatchObject({ kind: 'gap', gap: 'dismiss_not_persisted' });
    expect(mapLocalAction('reject_with_reason', undefined, { category: 'tekrar', scope: 'content_only', idempotencyKey: 'abcdefghijklmnop0001' })).toMatchObject({ kind: 'gap', gap: 'no_stored_suggestion' });
    expect(mapLocalAction('reject_with_reason', { suggestionSetId: 'a b', index: 0, contentHash: 'x' }, { category: 'tekrar', scope: 'content_only', idempotencyKey: 'abcdefghijklmnop0001' })).toMatchObject({ kind: 'invalid' });
  });
});

describe('Story slot/rol hizası, marka yerel günü ve seri belirsizliği (saf)', () => {
  const post = (index: number, scheduledAt: string, mediaId: string, postType: LiveValidatedPost['postType'] = 'story', media: string[] = [mediaId]): LiveValidatedPost => ({
    index, day: 0, time: '00:00', scheduledAt, postType, mediaIds: media, media: [], captionDraft: `metin ${index}`, rationale: '', readinessWarnings: false, contentHash: 'a'.repeat(32), warnings: [],
  });
  const cands = (ids: string[]) =>
    new Map(ids.map((id) => [id, { id, brand: P } as unknown as Candidate]));
  const resp = (accepted: LiveValidatedPost[], suggestionSetId: string | null = 'set0001'): LiveSuggestionResponse => ({ weekStart: '2026-10-12', suggestionSetId, accepted, rejected: [], shortages: [] });

  it('yerleştirilemeyen kare slotları/rolleri KAYDIRMAZ: roller yalnız yerleşenlerden, slotlarla hizalı', () => {
    const r = planFromSuggestion(
      resp([post(0, '2026-10-12T07:00:00Z', 'a'), post(1, '2026-10-12T08:00:00Z', 'MISSING'), post(2, '2026-10-12T09:00:00Z', 'c'), post(3, '2026-10-13T07:00:00Z', 'd')]),
      cands(['a', 'c', 'd']),
      { timeZone: TZ },
    );
    expect(r.story.slots.slice(0, 4)).toEqual(['a', 'c', 'd', null]);
    expect(r.series.inferredRoles).toHaveLength(3);
    expect(r.series.inferredRoles).toEqual(['headline', 'body', 'headline']);
    expect(r.series.localDays).toEqual(['2026-10-12', '2026-10-12', '2026-10-13']);
    expect(r.unplaced).toEqual([{ index: 1, reason: 'candidate_missing' }]);
    expect(r.refs['story:1']).toMatchObject({ index: 2 }); // ref doğru karede
    expect(r.refs['story:2']).toMatchObject({ index: 3 });
    expect(r.notes.join(' ')).toMatch(/Yerleştirilemeyen story/);
  });

  it('gece yarısı +03: UTC günü aynı olsa da marka yerel günü farklıysa farklı seri', () => {
    // 23:30 (+03, 12 Ekim) ve 00:30 (+03, 13 Ekim): UTC'de ikisi de 12 Ekim
    const a = post(0, '2026-10-12T20:30:00.000Z', 'a');
    const b = post(1, '2026-10-12T21:30:00.000Z', 'b');
    expect(localDay(a.scheduledAt, TZ)).toBe('2026-10-12');
    expect(localDay(b.scheduledAt, TZ)).toBe('2026-10-13');
    expect(planFromSuggestion(resp([a, b]), cands(['a', 'b']), { timeZone: TZ }).series.inferredRoles).toEqual(['headline', 'headline']);
    // aynı veri UTC'de tek gün sayılır: sonuç saat dilimine bağlıdır (UTC günü kullanılsaydı yanlış gruplanırdı)
    expect(planFromSuggestion(resp([a, b]), cands(['a', 'b']), { timeZone: 'UTC' }).series.inferredRoles).toEqual(['headline', 'body']);
  });

  it('ters örnek: UTC günleri farklı, yerel gün aynı → aynı çıkarımsal grup', () => {
    const a = post(0, '2026-10-12T21:30:00.000Z', 'a'); // 13 Ekim 00:30 +03
    const b = post(1, '2026-10-13T08:00:00.000Z', 'b'); // 13 Ekim 11:00 +03
    expect(planFromSuggestion(resp([a, b]), cands(['a', 'b']), { timeZone: TZ }).series.inferredRoles).toEqual(['headline', 'body']);
  });

  it('aynı gün FARKLI ürünler gerçek seri değildir: seri desteklenmiyor, metin başlık/gövdeye dağıtılmaz', () => {
    const r = planFromSuggestion(resp([post(0, '2026-10-12T07:00:00Z', 'a'), post(1, '2026-10-12T08:00:00Z', 'b')]), cands(['a', 'b']), { timeZone: TZ });
    expect(r.series.supported).toBe(false);
    expect(r.series.basis).toBe('inferred_same_local_day');
    expect(r.story.texts.slice(0, 2).every((t) => t && t.headline === undefined && t.body === undefined && t.caption)).toBe(true);
  });

  it('seri üst sınırı: aynı yerel günde 4. ve 7. kare yeni çıkarımsal başlangıç', () => {
    const ps = Array.from({ length: 7 }, (_, i) => post(i, `2026-10-12T0${i + 1}:00:00Z`, `m${i}`));
    const r = planFromSuggestion(resp(ps), cands(ps.map((p) => p.mediaIds[0])), { timeZone: TZ });
    expect(r.series.inferredRoles).toEqual(['headline', 'body', 'none', 'headline', 'body', 'none', 'headline']);
  });

  it('geçersiz saat dilimi veya tarih açık hata; UTC\'ye sessiz düşülmez', () => {
    expect(() => planFromSuggestion(resp([post(0, '2026-10-12T07:00:00Z', 'a')]), cands(['a']), { timeZone: 'Mars/Olympus' })).toThrow();
    expect(() => planFromSuggestion(resp([post(0, 'bozuk-tarih', 'a')]), cands(['a']), { timeZone: TZ })).toThrow(/scheduledAt geçersiz/);
  });

  it('slot sınırı ve çok medya: 10 feed öneri → 9 yerleşir, fazlası slot_limit; carousel ayrı neden', () => {
    const ps = Array.from({ length: 10 }, (_, i) => post(i, `2026-10-1${2 + (i % 5)}T0${i % 9}:00:00Z`, `m${i}`, 'static'));
    const r = planFromSuggestion(resp([...ps, post(20, '2026-10-12T05:00:00Z', 'x', 'carousel', ['m0', 'm1'])]), cands(ps.map((p) => p.mediaIds[0])), { timeZone: TZ });
    expect(r.feed.slots.filter(Boolean)).toHaveLength(9);
    expect(r.unplaced.map((u) => u.reason).sort()).toEqual(['carousel_multi_media', 'slot_limit']);
  });
});
