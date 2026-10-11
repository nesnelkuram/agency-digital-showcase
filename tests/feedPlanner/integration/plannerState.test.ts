// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  suggestionHash, toPlannerStateDoc, validatePlannerStateDoc, validatePlannerStateShape, applyPlannerStateDoc, plannerStateDocId, MAX_DISMISSED, MAX_LOCKS, PROPOSAL_LIMITATIONS,
  type PlannerStateDoc,
} from '@/studio/feedPlanner/integration/plannerState';
import { planFromIds, type PlanState } from '@/studio/feedPlanner/planner';
import type { SlotText } from '@/studio/feedPlanner/types';

const tx = (o: Partial<SlotText> = {}): SlotText => ({ source: 'template', lang: 'tr', templateId: 't1', caption: 'Biz çoktan seçtik.', ...o });
const mk = (ids: (string | null)[], texts: (SlotText | null)[], lane: 'feed' | 'story' = 'feed'): PlanState => planFromIds(ids as string[], lane, texts);
const base = { tenantId: 't1', projectId: 'p1', planId: 'plan1', uid: 'u1', now: 1_000 };
const build = (feed: PlanState, story: PlanState, baseVersion: number | null = null) => {
  const r = toPlannerStateDoc({ ...base, feed, story, baseVersion });
  if (!r.ok) throw new Error(r.error);
  return r.doc;
};
const empty = () => mk([], []);
const lockedFeed = (): PlanState => ({ ...mk(['m1', 'm2'], [tx(), tx({ caption: 'İkinci' })]), locked: [true, true, ...Array(7).fill(false)] });

describe('kalıcı kilit/eleme ÖNERİ sözleşmesi (yerel; dağıtılmadı)', () => {
  it('suggestionHash: alan sırasından bağımsız, medya veya metin değişince değişir', () => {
    const a = suggestionHash('m1', tx());
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(suggestionHash('m1', { caption: 'Biz çoktan seçtik.', templateId: 't1', lang: 'tr', source: 'template' })).toBe(a);
    expect(suggestionHash('m2', tx())).not.toBe(a);
    expect(suggestionHash('m1', tx({ caption: 'başka' }))).not.toBe(a);
    expect(suggestionHash('m1', null)).not.toBe(a);
    expect(suggestionHash('m1', tx({ lang: 'unknown' }))).not.toBe(a);
  });

  it('belge: kilitler medya + öneri hash\'i taşır, sürüm = temel + 1, kimlik tenant_proje_plan', () => {
    const doc = build(lockedFeed(), empty());
    expect(doc.version).toBe(1);
    expect(doc.locks).toEqual([
      { lane: 'feed', slot: 0, mediaId: 'm1', suggestionHash: suggestionHash('m1', tx()) },
      { lane: 'feed', slot: 1, mediaId: 'm2', suggestionHash: suggestionHash('m2', tx({ caption: 'İkinci' })) },
    ]);
    expect(build(lockedFeed(), empty(), 4).version).toBe(5);
    expect(plannerStateDocId('t1', 'p1', 'plan1')).toBe('t1_p1_plan1');
    expect(validatePlannerStateDoc(doc, null)).toEqual([]);
  });

  it('SESSİZ UNUTMA YOK: tam kapasite kabul, kapasite aşımı açık hata (eski eleneni geri getirmez)', () => {
    const many = (n: number): PlanState => ({ ...empty(), dismissed: Array.from({ length: n }, (_, i) => `m${i}`) });
    const ok = toPlannerStateDoc({ ...base, feed: many(MAX_DISMISSED), story: empty(), baseVersion: null });
    expect(ok.ok && ok.doc.dismissed).toHaveLength(MAX_DISMISSED);
    const over = toPlannerStateDoc({ ...base, feed: many(MAX_DISMISSED + 1), story: empty(), baseVersion: null });
    expect(over).toEqual({ ok: false, error: 'dismissed_capacity', count: MAX_DISMISSED + 1, max: MAX_DISMISSED });
    // iki şeritte aynı kimlik ayrı kayıt sayılır
    const both = toPlannerStateDoc({ ...base, feed: many(MAX_DISMISSED), story: { ...empty(), lane: 'story', dismissed: ['m0'] }, baseVersion: null });
    expect(both).toMatchObject({ ok: false, error: 'dismissed_capacity', count: MAX_DISMISSED + 1 });
    // en eski kayıt (m0) hiçbir yolla düşmedi
    expect(ok.ok && ok.doc.dismissed[0]).toEqual({ lane: 'feed', mediaId: 'm0' });
    expect(MAX_LOCKS).toBe(18);
  });

  it('doğrulama: şekil, eleman, yinelenen slot, eski sürüm', () => {
    const doc = build(lockedFeed(), empty());
    expect(validatePlannerStateDoc(doc, { version: 1 })).toContain('version, önceki sürüm + 1 olmalı (eski sürüm yazımı reddedilir)');
    expect(validatePlannerStateDoc({ ...doc, version: 2 }, { version: 1 })).toEqual([]);
    expect(validatePlannerStateDoc({ ...doc, version: 3 }, { version: 1 }).length).toBeGreaterThan(0); // atlama
    expect(validatePlannerStateDoc({ ...doc, version: 0 }, null).join()).toMatch(/version >= 1/);
    expect(validatePlannerStateShape({ ...doc, extra: 1 } as any).join()).toMatch(/bilinmeyen alan: extra/);
    expect(validatePlannerStateShape({ ...doc, planId: '../x' }).join()).toMatch(/planId güvenli/);
    expect(validatePlannerStateShape({ ...doc, locks: [{ ...doc.locks[0], suggestionHash: 'xyz' }] }).join()).toMatch(/kilit\[0\] geçersiz/);
    expect(validatePlannerStateShape({ ...doc, locks: [{ ...doc.locks[0], slot: 9 }] }).join()).toMatch(/kilit\[0\] geçersiz/);
    expect(validatePlannerStateShape({ ...doc, locks: [doc.locks[0], { ...doc.locks[0] }] }).join()).toMatch(/aynı slot iki kez kilitli/);
    expect(validatePlannerStateShape({ ...doc, dismissed: [{ lane: 'x' as any, mediaId: 'm1' }] }).join()).toMatch(/eleme\[0\] geçersiz/);
    expect(validatePlannerStateShape({ ...doc, locks: null as any }).join()).toMatch(/liste olmalı/);
  });

  it('YETKİLİ UYGULAMA: sunucuda kaldırılan kilit yerelde de kalkar (merge yok), kilitsizler raporlanır', () => {
    const local = lockedFeed(); // yerelde m1 ve m2 kilitli
    const doc: PlannerStateDoc = { ...build(lockedFeed(), empty()), locks: [build(lockedFeed(), empty()).locks[0]] }; // yalnız m1 kilitli
    const r = applyPlannerStateDoc(doc, local, empty());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.feed.locked.slice(0, 3)).toEqual([true, false, false]);
    expect(r.unlockedByServer).toEqual([{ lane: 'feed', slot: 1, mediaId: 'm2' }]);
    // hiç kilidi olmayan yetkili belge tüm yerel kilitleri temizler
    const none = applyPlannerStateDoc({ ...doc, locks: [] }, local, empty());
    expect(none.ok && none.feed.locked.every((l) => !l)).toBe(true);
    expect(local.locked.slice(0, 2)).toEqual([true, true]); // girdi değişmez
  });

  it('KİLİT METİN HASH\'İNE BAĞLI: aynı medyanın metni değişmişse eski kilit YANLIŞ kilitlemez', () => {
    const doc = build(lockedFeed(), empty());
    const changed = mk(['m1', 'm2'], [tx({ caption: 'Yeni metin' }), tx({ caption: 'İkinci' })]); // m1 metni değişti
    const r = applyPlannerStateDoc(doc, changed, empty());
    if (!r.ok) throw new Error('beklenmedik');
    expect(r.feed.locked.slice(0, 2)).toEqual([false, true]);
    expect(r.dropped).toEqual([{ lane: 'feed', slot: 0, mediaId: 'm1', reason: 'text_changed' }]);
    // başka medya aynı slota gelirse
    const swapped = mk(['mX', 'm2'], [tx(), tx({ caption: 'İkinci' })]);
    const r2 = applyPlannerStateDoc(doc, swapped, empty());
    expect(r2.ok && r2.dropped).toEqual([{ lane: 'feed', slot: 0, mediaId: 'm1', reason: 'slot_changed' }]);
    expect(r2.ok && r2.feed.locked[0]).toBe(false);
    // metin yokken (null) de eşleşmez
    const noText = mk(['m1', 'm2'], [null, tx({ caption: 'İkinci' })]);
    const r3 = applyPlannerStateDoc(doc, noText, empty());
    expect(r3.ok && r3.dropped[0].reason).toBe('text_changed');
  });

  it('Story şeridi bağımsız: kilit ve eleme şerit anahtarıyla uygulanır', () => {
    const story: PlanState = { ...mk(['s1'], [tx({ headline: 'Başlık', caption: undefined })], 'story'), locked: [true, ...Array(8).fill(false)], dismissed: ['sx'] };
    const doc = build(empty(), story);
    expect(doc.locks[0]).toMatchObject({ lane: 'story', slot: 0, mediaId: 's1' });
    const fresh = mk(['s1'], [tx({ headline: 'Başlık', caption: undefined })], 'story');
    const r = applyPlannerStateDoc(doc, empty(), fresh);
    expect(r.ok && r.story.locked[0]).toBe(true);
    expect(r.ok && r.story.dismissed).toEqual(['sx']);
    expect(r.ok && r.feed.dismissed).toEqual([]);
  });

  it('elemeler yetkili belgeyle DEĞİŞTİRİLİR; yerelde yalnız olan raporlanır (sessiz birleştirme yok)', () => {
    const local: PlanState = { ...empty(), dismissed: ['a', 'b'] };
    const doc: PlannerStateDoc = { ...build(empty(), empty()), dismissed: [{ lane: 'feed', mediaId: 'b' }, { lane: 'feed', mediaId: 'c' }] };
    const r = applyPlannerStateDoc(doc, local, empty());
    expect(r.ok && r.feed.dismissed).toEqual(['b', 'c']);
    expect(r.ok && r.localOnlyDismissed).toEqual([{ lane: 'feed', mediaId: 'a' }]);
    expect(local.dismissed).toEqual(['a', 'b']);
  });

  it('geçersiz belge uygulanmaz', () => {
    const r = applyPlannerStateDoc({ ...build(lockedFeed(), empty()), planId: '../x' }, lockedFeed(), empty());
    expect(r.ok).toBe(false);
  });
});

describe('sağlamlık: bozuk/eksik/yanlış tipli kayıtlar FIRLATMAZ, kontrollü hata verir', () => {
  const good = () => build(lockedFeed(), empty());
  const bad: Array<[string, (d: any) => any]> = [
    ['locks:[null]', (d) => ({ ...d, locks: [null] })],
    ['locks:[undefined]', (d) => ({ ...d, locks: [undefined] })],
    ['locks:[42]', (d) => ({ ...d, locks: [42] })],
    ['locks:["x"]', (d) => ({ ...d, locks: ['x'] })],
    ['locks:[[]]', (d) => ({ ...d, locks: [[]] })],
    ['locks:[{}]', (d) => ({ ...d, locks: [{}] })],
    ['kilit alanları eksik (hash yok)', (d) => ({ ...d, locks: [{ lane: 'feed', slot: 0, mediaId: 'm1' }] })],
    ['kilit mediaId sayı', (d) => ({ ...d, locks: [{ ...d.locks[0], mediaId: 5 }] })],
    ['kilit mediaId tanımsız', (d) => ({ ...d, locks: [{ ...d.locks[0], mediaId: undefined }] })],
    ['kilit bilinmeyen alan', (d) => ({ ...d, locks: [{ ...d.locks[0], x: 1 }] })],
    ['kilit slot metin', (d) => ({ ...d, locks: [{ ...d.locks[0], slot: '0' }] })],
    ['dismissed:[null]', (d) => ({ ...d, dismissed: [null] })],
    ['dismissed:[undefined]', (d) => ({ ...d, dismissed: [undefined] })],
    ['dismissed:["m1"]', (d) => ({ ...d, dismissed: ['m1'] })],
    ['dismissed:[{}]', (d) => ({ ...d, dismissed: [{}] })],
    ['dismissed lane eksik', (d) => ({ ...d, dismissed: [{ mediaId: 'x' }] })],
    ['dismissed mediaId eksik', (d) => ({ ...d, dismissed: [{ lane: 'feed' }] })],
    ['dismissed mediaId sayı', (d) => ({ ...d, dismissed: [{ lane: 'feed', mediaId: 7 }] })],
    ['dismissed bilinmeyen alan', (d) => ({ ...d, dismissed: [{ lane: 'feed', mediaId: 'x', y: 1 }] })],
    ['tenantId sayı', (d) => ({ ...d, tenantId: 123 })],
    ['planId tanımsız', (d) => ({ ...d, planId: undefined })],
    ['updatedBy yok', (d) => ({ ...d, updatedBy: undefined })],
    ['updatedAt NaN', (d) => ({ ...d, updatedAt: NaN })],
    ['locks null', (d) => ({ ...d, locks: null })],
    ['dismissed metin', (d) => ({ ...d, dismissed: 'x' })],
    ['belge null', () => null],
    ['belge undefined', () => undefined],
    ['belge dizi', () => []],
    ['belge metin', () => 'x'],
    ['belge sayı', () => 5],
  ];
  it.each(bad)('%s', (_n, mutate) => {
    const doc = mutate(good());
    let shape: string[] = [];
    let full: string[] = [];
    expect(() => { shape = validatePlannerStateShape(doc); }).not.toThrow();
    expect(() => { full = validatePlannerStateDoc(doc, null); }).not.toThrow();
    expect(shape.length).toBeGreaterThan(0);
    expect(full.length).toBeGreaterThan(0);
    let applied: ReturnType<typeof applyPlannerStateDoc> | undefined;
    expect(() => { applied = applyPlannerStateDoc(doc, lockedFeed(), empty()); }).not.toThrow();
    expect(applied!.ok).toBe(false); // geçersiz belge plana uygulanmaz; yerel durum değişmez
    expect(lockedFeed().locked.slice(0, 2)).toEqual([true, true]);
  });

  it('geçerli belge hata vermez (yanlış pozitif yok)', () => {
    expect(validatePlannerStateShape(good())).toEqual([]);
    expect(validatePlannerStateDoc(good(), null)).toEqual([]);
  });

  it('kısıt açıkça yazılı: kural üretime hazır/tam güvenli kalıcılık değil', () => {
    expect(PROPOSAL_LIMITATIONS).toMatch(/liste ELEMANLARINI doğrulayamaz/);
    expect(PROPOSAL_LIMITATIONS).toMatch(/zorunlu sunucu doğrulaması/);
    expect(PROPOSAL_LIMITATIONS).toMatch(/üretime hazır veya tam güvenli kalıcılık olarak sunulamaz/);
    const rules = readFileSync(path.resolve(__dirname, '../../../docs/proposals/planner-state.rules'), 'utf8');
    expect(rules).toMatch(/DAĞITILMADI/);
    expect(rules).toMatch(/ÜRETİME HAZIR DEĞİL/);
    expect(rules).toMatch(/liste ELEMANLARINI doğrulayamaz/);
  });
});
