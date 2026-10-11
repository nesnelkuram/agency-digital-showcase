// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { emptyPlan, generate, replaceSlot, rejectItem, toggleLock, setSlotFormat, FEED_SLOTS } from '@/studio/feedPlanner/planner';
import { cand, pool } from './helpers';

const filled = (s: (string | null)[]) => s.filter(Boolean) as string[];

describe('plan oluştur', () => {
  it('9 benzersiz gerçek aday; hikâye, video, yatay, başka marka, yayımlanmış asla girmez', () => {
    const { ctx, storyIds } = pool();
    const { state, messages } = generate(emptyPlan(), ctx);
    const ids = filled(state.slots);
    expect(ids.length).toBe(FEED_SLOTS);
    expect(new Set(ids).size).toBe(FEED_SLOTS);
    expect(messages).toEqual([]);
    for (const id of ids) {
      expect(storyIds).not.toContain(id);
      expect(id).toMatch(/^p\d+$/);
    }
  });
  it('aday yetersizse boş slotlar için açık neden; sessiz mükerrer yok', () => {
    const { all } = pool();
    const small = all.filter((c) => !/^p([3-9]|1\d)$/.test(c.id)); // p0..p2 kalır
    const ctx = { brand: 'dieci', byId: new Map(small.map((c) => [c.id, c])), storyIds: pool().storyIds };
    const { state, messages } = generate(emptyPlan(), ctx);
    const ids = filled(state.slots);
    expect(ids.length).toBe(3);
    expect(new Set(ids).size).toBe(3);
    expect(messages.length).toBe(6);
    expect(messages[0].text).toMatch(/Uygun aday yok \(havuz/);
    expect(messages[0].text).toMatch(/planda\/hikâyede zaten var/);
    expect(messages[0].text).toMatch(/format sığmıyor/);
  });
});

describe('kilit, değiştir, ret, yeniden öner', () => {
  it('kilitli öğe değiştirilemez; kilit açılınca değişir ve yalnız o slot', () => {
    const { ctx } = pool();
    let { state } = generate(emptyPlan(), ctx);
    state = toggleLock(2, state).state;
    const before = [...state.slots];
    const r = replaceSlot(2, state, ctx);
    expect(r.state.slots).toEqual(before);
    expect(r.message).toMatch(/Kilitli/);
    state = toggleLock(2, state).state;
    const r2 = replaceSlot(2, state, ctx);
    expect(r2.state.slots[2]).not.toBe(before[2]);
    expect(r2.state.slots.filter((_, i) => i !== 2)).toEqual(before.filter((_, i) => i !== 2));
    expect(new Set(filled(r2.state.slots)).size).toBe(9);
  });
  it('boş slot kilitlenemez', () => {
    const r = toggleLock(0, emptyPlan());
    expect(r.state.locked[0]).toBe(false);
    expect(r.message).toMatch(/Boş/);
  });
  it('ret öğeyi çıkarır, kilidini açar ve bir daha hiçbir yolla dönmez', () => {
    const { ctx } = pool();
    let { state } = generate(emptyPlan(), ctx);
    const victim = state.slots[4]!;
    state = toggleLock(4, state).state;
    const r = rejectItem(victim, state, ctx);
    expect(r.state.slots).not.toContain(victim);
    expect(r.state.locked[4]).toBe(false);
    expect(r.state.rejected).toContain(victim);
    let s = r.state;
    for (let k = 0; k < 4; k++) {
      s = generate(s, ctx, true).state;
      s = replaceSlot(k, s, ctx).state;
      expect(s.slots).not.toContain(victim);
    }
    expect(generate(emptyPlan(), ctx).state.slots).toContain(victim); // yeni plan state'inde red yok: bellek-içi durum
    expect(generate({ ...emptyPlan(), rejected: [victim] }, ctx).state.slots).not.toContain(victim);
  });
  it('yeniden öner: kilitler korunur, plan boşalmaz, yeni aday yoksa eski öğe nedenle korunur', () => {
    const { ctx } = pool();
    let { state } = generate(emptyPlan(), ctx);
    state = toggleLock(0, state).state;
    const locked = state.slots[0];
    const prev = [...state.slots];
    const r = generate(state, ctx, true);
    expect(r.state.slots[0]).toBe(locked);
    expect(filled(r.state.slots).length).toBe(9);
    expect(new Set(filled(r.state.slots)).size).toBe(9);
    // havuzda 14 uygun, 9 yerleşik: en çok 5 yeni aday var → en az bir slot eskisini korur
    expect(r.messages.some((m) => /Önceki öğe korundu/.test(m.text))).toBe(true);
    // en az bir slot gerçekten yeni aday aldı
    expect(r.state.slots.some((id, i) => i !== 0 && id !== prev[i])).toBe(true);
  });
  it('yeniden öner: reddedilen eski öğe geçerli olmadığı için korunmaz', () => {
    const { ctx } = pool();
    const { state } = generate(emptyPlan(), ctx);
    const victim = state.slots[5]!;
    const r = generate({ ...state, rejected: [victim] }, ctx, true);
    expect(r.state.slots).not.toContain(victim);
  });
});

describe('format slot durumuna yansır', () => {
  it('Reels kapağına geçiş: fotoğraf kalır (video iddiası yok), format plan durumunda', () => {
    const { ctx } = pool();
    let { state } = generate(emptyPlan(), ctx);
    const id = state.slots[1];
    const r = setSlotFormat(1, 'reels-cover', state, ctx);
    expect(r.state.formats[1]).toBe('reels-cover');
    expect(r.state.slots[1]).toBe(id);
    expect(r.state.formats[0]).toBe('feed-4x5');
    state = r.state;
    const again = generate(state, ctx, true).state;
    expect(again.formats[1]).toBe('reels-cover');
  });
  it('yeni formata uymayan kilitsiz öğe değişir; kilitliyse kalır ve neden söylenir', () => {
    const { ctx } = pool();
    // yatay (3:1) öğe 4:5'e %27 sığar; sert kuralda 4:5 için 0.267<0.5 → zaten girmez. 1:1'e de girmez.
    const wide = cand('wide2', { dims: { w: 1500, h: 1000 } }); // 4:5 → 0.533 (geçer), 9:16 → 0.375 (geçmez)
    const byId = new Map(ctx.byId);
    byId.set(wide.id, wide);
    const c2 = { ...ctx, byId };
    let state = emptyPlan();
    state = { ...state, slots: state.slots.map((_, i) => (i === 0 ? wide.id : null)) };
    const r = setSlotFormat(0, 'story', state, c2);
    expect(r.state.slots[0]).not.toBe(wide.id);
    expect(r.state.formats[0]).toBe('story');
    const lockedState = { ...state, locked: state.locked.map((_, i) => i === 0) };
    const r2 = setSlotFormat(0, 'story', lockedState, c2);
    expect(r2.state.slots[0]).toBe(wide.id);
    expect(r2.message).toMatch(/Kilitli öğe bu formata uymuyor/);
  });
});

describe('kapsam: yayımlanmış/bağlam adayları da marka kapsamında', () => {
  it('başka markanın yayımlanmış görseli tekrar puanını etkilemez', () => {
    const { all } = pool();
    const noOther = all.filter((c) => c.id !== 'histOther');
    const mk = (list: typeof all) => ({ brand: 'dieci', byId: new Map(list.map((c) => [c.id, c])), storyIds: pool().storyIds });
    const a = generate(emptyPlan(), mk(all)).state.slots;
    const b = generate(emptyPlan(), mk(noOther)).state.slots;
    expect(a).toEqual(b);
  });
});
