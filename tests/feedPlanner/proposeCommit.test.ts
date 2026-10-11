import { describe, it, expect } from 'vitest';
import { emptyPlan, generate, proposeSlot, commitSuggestion, setSlotText, rejectItem, toggleLock, type PlanCtx, type PlanState } from '@/studio/feedPlanner/planner';
import { seriesFrames } from '@/studio/feedPlanner/storyLayout';
import type { SlotText } from '@/studio/feedPlanner/types';
import { pool } from './helpers';

const modelText = (caption: string): SlotText => ({ caption, source: 'model', lang: 'tr' });
/** textFor YOK: normal üretim yolunu temsil eder (şablon sağlayıcısı verilmez) */
const ctxNoTemplate = (): PlanCtx => {
  const { ctx } = pool();
  const { textFor, ...rest } = ctx;
  void textFor;
  return rest;
};

describe('normal yolda şablon yok', () => {
  it('textFor verilmeden plan oluşturulur: görseller yerleşir ama HİÇBİR slotta metin yoktur', () => {
    const ctx = ctxNoTemplate();
    const { state } = generate(emptyPlan('feed'), ctx);
    expect(state.slots.filter(Boolean)).toHaveLength(9);
    expect(state.texts.every((t) => t === null)).toBe(true);
  });
});

describe('proposeSlot → (model metni) → commitSuggestion: görsel + metin tek sürüm', () => {
  const planned = () => {
    const ctx = ctxNoTemplate();
    const st = generate(emptyPlan('feed'), ctx).state;
    return { ctx, st: { ...st, texts: st.slots.map((_, i) => modelText(`eski ${i}`)) } as PlanState };
  };

  it('öneri durumu DEĞİŞTİRMEZ; commit aday + metni birlikte yazar, sürümü artırır, eleneni geçmişe koyar', () => {
    const { ctx, st } = planned();
    const snapshot = JSON.stringify(st);
    const p = proposeSlot(0, 'dismiss', st, ctx, st.versions[0]);
    expect(JSON.stringify(st)).toBe(snapshot);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.candidateId).not.toBe(st.slots[0]);
    const r = commitSuggestion(0, p.candidateId, modelText('yeni'), 'dismiss', st, ctx, p.version);
    expect(r.message).toBeUndefined();
    expect(r.state.slots[0]).toBe(p.candidateId);
    expect(r.state.texts[0]).toMatchObject({ caption: 'yeni', source: 'model' });
    expect(r.state.versions[0]).toBe(st.versions[0] + 1);
    expect(r.state.dismissed).toContain(st.slots[0]);
    expect(r.state.history.at(-1)).toMatchObject({ slot: 0, candidateId: st.slots[0], text: { caption: 'eski 0' } });
  });

  it('eski sürüm (araya başka işlem girdi) → commit hiçbir şey yazmaz', () => {
    const { ctx, st } = planned();
    const p = proposeSlot(0, 'replace', st, ctx, st.versions[0]);
    if (!p.ok) throw new Error('öneri beklenirdi');
    const changed = setSlotText(0, st.slots[0]!, modelText('araya giren'), st, st.versions[0]).state; // sürüm artar
    const r = commitSuggestion(0, p.candidateId, modelText('yeni'), 'replace', changed, ctx, p.version);
    expect(r.stale).toBe(true);
    expect(r.state).toBe(changed);
    expect(proposeSlot(0, 'replace', st, ctx, st.versions[0] - 1)).toMatchObject({ ok: false, stale: true });
  });

  it('Kalsın işaretli slot önerilemez ve yazılamaz (görsel + metin korunur)', () => {
    const { ctx, st } = planned();
    const locked = toggleLock(2, st, true, st.versions[2]).state;
    expect(proposeSlot(2, 'dismiss', locked, ctx)).toMatchObject({ ok: false });
    const r = commitSuggestion(2, 'p13', modelText('x'), 'replace', locked, ctx);
    expect(r.message).toMatch(/Kalsın/);
    expect(r.state.slots[2]).toBe(locked.slots[2]);
    expect(r.state.texts[2]).toEqual(locked.texts[2]);
  });

  it('metin yokken (role gerektiriyorsa) commit REDDEDİLİR: görsel tek başına değişmez', () => {
    const { ctx, st } = planned();
    const p = proposeSlot(0, 'replace', st, ctx);
    if (!p.ok) throw new Error('öneri beklenirdi');
    const r = commitSuggestion(0, p.candidateId, null, 'replace', st, ctx);
    expect(r.message).toMatch(/Metin üretilmeden görsel değiştirilemez/);
    expect(r.state.slots[0]).toBe(st.slots[0]);
  });

  it('alternatif kalmadığında öneri nedenle reddedilir (mevcut öneri korunur)', () => {
    const { ctx } = planned();
    const only = new Map([...ctx.byId].filter(([id]) => /^p[0-8]$/.test(id) || /^s\d$/.test(id)));
    const c2 = { ...ctx, byId: only };
    const st = generate(emptyPlan('feed'), c2).state;
    const p = proposeSlot(0, 'dismiss', st, c2);
    expect(p).toMatchObject({ ok: false });
    expect(!p.ok && p.message).toMatch(/Alternatif yok, mevcut öneri korundu/);
  });

  it('fill modu yalnız boş slotta; dolu slotta ve boş slotta replace/dismiss hata verir', () => {
    const { ctx, st } = planned();
    expect(proposeSlot(0, 'fill', st, ctx)).toMatchObject({ ok: false });
    const empty = { ...st, slots: st.slots.map((s, i) => (i === 4 ? null : s)) };
    expect(proposeSlot(4, 'fill', empty, ctx).ok).toBe(true);
    expect(proposeSlot(4, 'replace', empty, ctx)).toMatchObject({ ok: false });
  });

  it('reddetme (rejectItem fill=false) slotu boşaltır ama otomatik doldurmaz; model akışı doldurur', () => {
    const { ctx, st } = planned();
    const id = st.slots[3]!;
    const r = rejectItem(id, st, ctx, false);
    expect(r.state.slots[3]).toBeNull();
    expect(r.state.rejected).toContain(id);
    expect(proposeSlot(3, 'fill', r.state, ctx)).toMatchObject({ ok: true });
  });
});

describe('setSlotText: yalnız slot hâlâ aynı görseli tutuyorsa', () => {
  it('yazar ve sürümü artırır; slot değiştiyse metni yok sayar (gecikmiş yanıt)', () => {
    const ctx = ctxNoTemplate();
    const st = generate(emptyPlan('feed'), ctx).state;
    const id = st.slots[1]!;
    const ok = setSlotText(1, id, modelText('t'), st, st.versions[1]);
    expect(ok.state.texts[1]).toMatchObject({ caption: 't' });
    expect(ok.state.versions[1]).toBe(st.versions[1] + 1);
    const late = setSlotText(1, 'baska-gorsel', modelText('t'), st);
    expect(late.stale).toBe(true);
    expect(late.state.texts[1]).toBeNull();
    expect(setSlotText(1, id, modelText('t'), st, st.versions[1] - 1).stale).toBe(true);
  });
});

describe('Story rolü ADAY slota konmuş gibi hesaplanır (seri sınırı adayın kimliğine bağlı)', () => {
  it('seri ortasına kimliksiz aday → o kare başlık rolü ister; metin yoksa commit reddedilir', () => {
    const { ctx, storyIds } = pool();
    const story: PlanState = { ...emptyPlan('story'), slots: [...storyIds] };
    const keys = (slots: (string | null)[]) => slots.map((s) => (s && /^s[012]$/.test(s) ? 'A' : null));
    const c2: PlanCtx = { ...ctx, roleOf: (i, slots) => seriesFrames(keys(slots))[i].role };
    // s1 (orta kare) seridedir: body; yerine p3 (kimliksiz) → headline
    const r = commitSuggestion(1, 'p3', { body: 'devam', source: 'model', lang: 'tr' }, 'replace', story, c2);
    expect(r.state.slots[1]).toBe('p3'); // commit metni role göre doğrulamaz (App.reconcileStory yapar) ama yazar
    const none = commitSuggestion(1, 'p3', null, 'replace', story, c2);
    expect(none.message).toMatch(/Metin üretilmeden/);
  });
});
