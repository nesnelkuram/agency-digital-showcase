// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { seriesRoles, seriesFrames, validateHierarchy, placeText, MAX_SERIES_FRAMES } from '@/studio/feedPlanner/storyLayout';
import { suggestionFor, templateIdsOf, templateIds, TEMPLATE_LABEL, templateTextFor } from '@/studio/feedPlanner/suggestionText';
import { emptyPlan, generate, dismissSlot, restoreFromHistory, toggleLock, replaceSlot, assignToSlot, planFromIds, FEED_SLOTS, type PlanCtx } from '@/studio/feedPlanner/planner';
import { exhaustedPool, parseQa, ThrowingMap } from '@/studio/feedPlanner/qaScenario';
import { aest, cand, pool } from './helpers';

describe('Story seri rolleri (yalnız AÇIK seri kimliğinden)', () => {
  it('seri üst sınırı 3 kare: 4. ve 7. kare yeni başlık olur; tek kalan kare tek karelik seridir', () => {
    expect(MAX_SERIES_FRAMES).toBe(3);
    expect(seriesRoles(['A', 'A', 'A', 'A', 'A', 'A', 'A'])).toEqual(['headline', 'body', 'none', 'headline', 'body', 'none', 'headline']);
    expect(seriesFrames(['A', 'A', 'A', 'A']).map((f) => [f.key, f.position, f.size])).toEqual([['A', 0, 3], ['A', 1, 3], ['A', 2, 3], [null, 0, 1]]);
  });
  it('2 kareli seri, tek kareli seri ve kimlik değişimi', () => {
    expect(seriesRoles(['A', 'A', 'B', 'C', 'C', 'C', 'D'])).toEqual(['headline', 'body', 'headline', 'headline', 'body', 'none', 'headline']);
    expect(seriesFrames(['A', 'A']).map((f) => [f.key, f.position, f.size])).toEqual([['A', 0, 2], ['A', 1, 2]]);
    expect(seriesRoles([])).toEqual([]);
  });
  it('KİMLİKSİZ kareler (null/undefined/boş) ASLA seri olmaz: her biri tek karelik seri, başlık alır', () => {
    expect(seriesRoles([undefined, undefined])).toEqual(['headline', 'headline']);
    expect(seriesRoles([null, null, null])).toEqual(['headline', 'headline', 'headline']);
    expect(seriesRoles(['', '', ''])).toEqual(['headline', 'headline', 'headline']);
    expect(seriesFrames([null, null]).every((f) => f.key === null && f.size === 1 && f.position === 0)).toBe(true);
    // aynı gün farklı ürün: kimlikleri farklı → seri değil
    expect(seriesRoles(['urun-a', 'urun-b'])).toEqual(['headline', 'headline']);
  });
  it('ardışık olmayan aynı kimlik tek seri sayılmaz', () => {
    expect(seriesRoles(['A', 'B', 'A'])).toEqual(['headline', 'headline', 'headline']);
  });
});

describe('Story hiyerarşisi ve yerleşim', () => {
  const en = (o: object) => ({ source: 'template' as const, lang: 'en' as const, ...o });
  it('başlık yalnız ilk karede; metinsiz karede hiçbir metin yok', () => {
    const roles = seriesRoles(['A', 'A', 'A']);
    expect(validateHierarchy([en({ headline: 'H' }), en({ body: 'b' }), null], roles)).toEqual([]);
    expect(validateHierarchy([en({ headline: 'H' }), en({ headline: 'Slogan' }), null], roles).join(' ')).toMatch(/Kare 2: başlık yalnız/);
    expect(validateHierarchy([en({ headline: 'H' }), null, en({ body: 'x' })], roles).join(' ')).toMatch(/Kare 3: bu kare metinsiz/);
    expect(validateHierarchy([en({ body: 'b' })], ['headline']).join(' ')).toMatch(/ilk karede başlık/);
  });
  it('metin ölçülmüş sakin bölgeye; bölge parlaklığına göre mürekkep; ölçüm yoksa üstte + gölge + uyarı', () => {
    const dark = aest({ negativeSpace: 0.4, negativeZone: 'alt', zoneBrightness: [0.6, 0.5, 0.2] });
    expect(placeText(dark)).toEqual({ zone: 'alt', calm: true, ink: 'cream', shadow: false });
    const bright = aest({ negativeSpace: 0.4, negativeZone: 'üst', zoneBrightness: [0.8, 0.5, 0.2] });
    expect(placeText(bright)).toMatchObject({ zone: 'üst', ink: 'burgundy' });
    expect(placeText(undefined)).toEqual({ zone: 'üst', calm: false, ink: 'cream', shadow: true });
    expect(placeText(aest({ negativeSpace: 0.05, negativeZone: 'dağınık' }))).toMatchObject({ calm: false, shadow: true });
  });
});

describe('şablon metinler (deterministik, demo)', () => {
  it('aynı girdi aynı metin; Türkçe, şablon etiketli; rol yalnız ilgili alanı verir', () => {
    const c = cand('x1', { group: 'pizza' });
    const a = suggestionFor(c, 'caption')!;
    expect(suggestionFor(c, 'caption')).toEqual(a);
    expect(a).toMatchObject({ source: 'template', lang: 'tr' });
    expect(a.caption).not.toMatch(/\b(the|and|you|we)\b/i); // İngilizce değil
    expect(suggestionFor(c, 'headline')).toMatchObject({ headline: expect.any(String) });
    expect(suggestionFor(c, 'headline')!.body).toBeUndefined();
    expect(suggestionFor(c, 'body')!.headline).toBeUndefined();
    expect(suggestionFor(c, 'none')).toBeNull();
    expect(TEMPLATE_LABEL).toMatch(/Şablon metni · demo/);
  });
  it('kaçınılan şablon seçilmez: tüm gruplar ve kimlikler için farklı şablon çıkar', () => {
    for (const group of ['pizza', 'makarna', 'mekan_atmosfer', 'bilinmeyen_grup']) {
      for (let k = 0; k < 20; k++) {
        const c = cand(`id-${k}`, { group });
        const first = suggestionFor(c, 'caption')!;
        const second = suggestionFor(c, 'caption', templateIdsOf(first))!;
        expect(second.templateId).not.toBe(first.templateId);
        expect(second.caption).not.toBe(first.caption);
      }
    }
  });
  it('metinsiz rol ve video kapağı (feed dışı) metin üretmez; ürün iddiası içeren kelime yok', () => {
    expect(suggestionFor(cand('v', { kind: 'video_cover' }), 'headline')).toBeNull();
    const captions = templateIds().map((id) => suggestionFor(cand(id, { group: 'pizza' }), 'caption')!.caption!);
    expect(captions.length).toBeGreaterThan(0);
    expect(captions.join(' ')).not.toMatch(/\d|%|\bTL\b|\bmenü\b|Ghosting|Lovebombing|Michelin/i);
  });
});

const setup = () => {
  const p = pool();
  return { ...p, state: generate(emptyPlan(), p.ctx).state };
};
const aligned = (s: ReturnType<typeof emptyPlan>) => s.slots.every((id, i) => (id === null) === (s.texts[i] === null));

describe('Ele ve yenisini getir (saf mantık)', () => {
  it('atomik: aday + metin tek adımda değişir, sürüm bir artar, geçmiş ve elenenler yazılır', () => {
    const { ctx, state } = setup();
    const old = state.slots[3]!;
    const oldText = state.texts[3]!;
    const v = state.versions[3];
    const r = dismissSlot(3, state, ctx, v);
    expect(r.message).toBeUndefined();
    expect(r.state.slots[3]).not.toBe(old);
    expect(r.state.versions[3]).toBe(v + 1);
    expect(r.state.history).toEqual([{ seq: 1, slot: 3, candidateId: old, text: oldText }]);
    expect(r.state.dismissed).toContain(old);
    expect(r.state.texts[3]!.templateId).not.toBe(oldText.templateId);
    expect(aligned(r.state)).toBe(true);
    // diğer slotlara dokunmaz
    expect(r.state.slots.filter((_, i) => i !== 3)).toEqual(state.slots.filter((_, i) => i !== 3));
    expect(r.state.versions.filter((_, i) => i !== 3)).toEqual(state.versions.filter((_, i) => i !== 3));
  });
  it('elenen aday hemen geri gelmez: art arda elemeler ve yeniden önerler hiç tekrar getirmez', () => {
    const { ctx, state } = setup();
    let s = state;
    const gone = new Set<string>();
    for (let k = 0; k < 4; k++) {
      const cur = s.slots[0]!;
      const r = dismissSlot(0, s, ctx, s.versions[0]);
      if (r.message) break;
      gone.add(cur);
      s = r.state;
      expect(gone.has(s.slots[0]!)).toBe(false);
    }
    expect(gone.size).toBeGreaterThan(0);
    const re = generate(s, ctx, true).state;
    for (const id of gone) expect(re.slots).not.toContain(id);
    const fresh = generate({ ...emptyPlan(), dismissed: [...gone] }, ctx).state;
    for (const id of gone) expect(fresh.slots).not.toContain(id);
  });
  it('komşuluk skoru hesaba katılır: seçilen aday komşularla ritim/uyum puanı en yüksek olandır', () => {
    // 3 aday: biri komşuyla aynı doku (düşük ritim), biri farklı doku (yüksek ritim); renkler aynı
    const mk = (id: string, d: number, n: number) => cand(id, { group: 'pizza', aesthetics: aest({ density: d, negativeSpace: n }) });
    const base = [mk('nb', 0.1, 0), mk('same', 0.1, 0), mk('diff', 0.7, 0.5)];
    const byId = new Map(base.map((c) => [c.id, c]));
    const ctx: PlanCtx = { brand: 'dieci', byId, storyIds: [] };
    let st = emptyPlan();
    st = { ...st, slots: st.slots.map((_, i) => (i === 0 ? 'nb' : null)), locked: st.locked.map((_, i) => i === 0), texts: st.texts.map((_, i) => (i === 0 ? suggestionFor(base[0], 'caption') : null)) };
    const r = generate(st, ctx, false);
    expect(r.state.slots[1]).toBe('diff'); // komşusu nb olan slot 1: ritim kazanan
  });
  it('kilitli ve boş slot elenemez; geçmişe hiçbir şey yazılmaz', () => {
    const { ctx, state } = setup();
    const locked = toggleLock(2, state, true).state;
    const r1 = dismissSlot(2, locked, ctx);
    expect(r1.message).toMatch(/Kalsın işaretli/);
    expect(r1.state).toBe(locked);
    const r2 = dismissSlot(0, emptyPlan(), ctx);
    expect(r2.message).toMatch(/Boş slot/);
    expect(r2.state.history).toEqual([]);
  });
  it('eski sürüm ve tekrarlı tıklama: ikinci işlem yok sayılır, yalnız bir geçmiş kaydı', () => {
    const { ctx, state } = setup();
    const v = state.versions[1];
    const first = dismissSlot(1, state, ctx, v);
    const second = dismissSlot(1, first.state, ctx, v); // aynı (artık eski) sürümle
    expect(second.stale).toBe(true);
    expect(second.state).toBe(first.state);
    expect(first.state.history.length).toBe(1);
    expect(replaceSlot(1, first.state, ctx, v).stale).toBe(true);
    expect(assignToSlot('p0', 1, first.state, ctx, v).stale).toBe(true);
    expect(toggleLock(1, first.state, true, v).stale).toBe(true);
  });
  it('Kalsın tekrarlı tıklamada idempotent (desired verilince)', () => {
    const { state } = setup();
    const a = toggleLock(4, state, true);
    const b = toggleLock(4, a.state, true);
    expect(b.state.locked[4]).toBe(true);
    expect(toggleLock(4, b.state, false).state.locked[4]).toBe(false);
  });
  it('alternatif yok: mevcut öneri aynen kalır (durum nesnesi bile aynı), geçmişe yazılmaz, neden söylenir', () => {
    const { all, storyIds } = pool();
    const { ctx } = { ctx: { brand: 'dieci', byId: new Map(exhaustedPool(all, storyIds).map((c) => [c.id, c])), storyIds } as PlanCtx };
    const state = generate(emptyPlan(), ctx).state;
    expect(state.slots.filter(Boolean).length).toBe(FEED_SLOTS);
    const r = dismissSlot(0, state, ctx, state.versions[0]);
    expect(r.state).toBe(state);
    expect(r.message).toMatch(/Alternatif yok, mevcut öneri korundu/);
    expect(r.message).toMatch(/Uygun aday yok \(havuz/);
    expect(state.history).toEqual([]);
    expect(state.dismissed).toEqual([]);
  });
  it('hata durumu: mevcut öneri korunur, hata yutulur ve açıklama verilir', () => {
    const { ctx, state } = setup();
    const bad: PlanCtx = { ...ctx, byId: new ThrowingMap(ctx.byId) };
    const r = dismissSlot(0, state, bad, state.versions[0]);
    expect(r.state).toBe(state);
    expect(r.message).toMatch(/Beklenmeyen hata; mevcut öneri korundu/);
    expect(replaceSlot(0, state, bad).state).toBe(state);
  });
  it('geri getir: aday özgün metniyle döner, yerine geçen öneri geçmişe gider; kilitli slota ve eksik kayda karşı güvenli', () => {
    const { ctx, state } = setup();
    const old = state.slots[5]!;
    const oldText = state.texts[5];
    const d = dismissSlot(5, state, ctx, state.versions[5]).state;
    const replacement = d.slots[5]!;
    const back = restoreFromHistory(1, d, ctx, d.versions[5]);
    expect(back.state.slots[5]).toBe(old);
    expect(back.state.texts[5]).toEqual(oldText);
    expect(back.state.history.map((h) => h.candidateId)).toEqual([replacement]);
    expect(back.state.dismissed).not.toContain(old);
    expect(aligned(back.state)).toBe(true);
    // aynı kaydı tekrar geri getirmek güvenli
    expect(restoreFromHistory(1, back.state, ctx).stale).toBe(true);
    // kilitli slot
    const locked = toggleLock(5, d, true).state;
    expect(restoreFromHistory(1, locked, ctx).message).toMatch(/Kalsın işaretli/);
  });
  it('elenen taslak öneri kaynak havuzdan silinmez: ctx.byId aynen kalır, elle atama mümkündür', () => {
    const { ctx, state } = setup();
    const size = ctx.byId.size;
    const old = state.slots[0]!;
    const d = dismissSlot(0, state, ctx).state;
    expect(ctx.byId.size).toBe(size);
    expect(ctx.byId.has(old)).toBe(true);
    const manual = assignToSlot(old, 0, d, ctx);
    expect(manual.state.slots[0]).toBe(old);
    expect(manual.state.dismissed).not.toContain(old);
  });
});

describe('Story bellek kopyası ve seri rolleri ile metin', () => {
  it('yeni öneri rolüne göre: 1. kare başlık, 2. küçük açıklama, 3. metinsiz; kaynak kimlik listesi değişmez', () => {
    const { all, storyIds } = pool();
    const roles = seriesRoles(['A', 'A', 'A', 'B', 'B', 'C', 'D', 'E', 'F']);
    const ctx: PlanCtx = { brand: 'dieci', byId: new Map(all.map((c) => [c.id, c])), storyIds: [], roleOf: (i) => roles[i], textFor: templateTextFor };
    const src = [...storyIds];
    const story = planFromIds(storyIds, 'story');
    const out = [0, 1, 2].map((i) => replaceSlot(i, story, ctx).state.texts[i]);
    expect(out[0]).toMatchObject({ headline: expect.any(String) });
    expect(out[0]!.body).toBeUndefined();
    expect(out[1]).toMatchObject({ body: expect.any(String) });
    expect(out[1]!.headline).toBeUndefined();
    expect(out[2]).toBeNull();
    expect(storyIds).toEqual(src);
    expect(validateHierarchy([out[0], out[1], out[2]], roles.slice(0, 3))).toEqual([]);
  });
});

describe('QA senaryosu havuzu', () => {
  it('yalnız loopback ve açık değerlerde etkin', () => {
    expect(parseQa('?qa=exhausted', '127.0.0.1')).toBe('exhausted');
    expect(parseQa('?qa=error', 'localhost')).toBe('error');
    expect(parseQa('?qa=exhausted', 'example.com')).toBeNull();
    expect(parseQa('?qa=baska', '127.0.0.1')).toBeNull();
    expect(parseQa('', '127.0.0.1')).toBeNull();
  });
  it('hikâye kareleri + TAM 9 uygun gerçek aday; video, yatay, başka marka ve yayımlanmış hariç; girdi değişmez', () => {
    const { all, storyIds } = pool();
    const before = all.length;
    const sub = exhaustedPool(all, storyIds);
    expect(all.length).toBe(before);
    const story = new Set(storyIds);
    const feed = sub.filter((c) => !story.has(c.id));
    expect(feed.length).toBe(9);
    expect(sub.length).toBe(18);
    for (const c of feed) expect(c.kind === 'photo' && c.brand === 'dieci' && !c.published).toBe(true);
    expect(feed.map((c) => c.id)).not.toContain('wide1');
  });
});
