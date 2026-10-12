import { describe, it, expect } from 'vitest';
import { emptyPlan, generate, planFromIds, setSlotText, toggleLock } from '@/studio/feedPlanner/planner';
import type { SlotText } from '@/studio/feedPlanner/types';
import { pool } from './helpers';

const txt = (caption: string): SlotText => ({ caption, source: 'model', lang: 'tr' });

describe('Kalsın yarışı: metin isteği sürerken kilitleme (state)', () => {
  it('REPRO: sürüm yakalanır, Kalsın yapılır, geç yanıt aynı sürümle gelir → KİLİTLİ metin ezilmez (stale)', () => {
    const base = planFromIds(['p0', 'p1', 'p2'], 'feed', [txt('özgün 0'), txt('özgün 1'), txt('özgün 2')]);
    const captured = base.versions[1];
    const locked = toggleLock(1, base, true, captured);
    expect(locked.stale).toBeFalsy();
    expect(locked.state.locked[1]).toBe(true);
    expect(locked.state.versions[1]).toBe(captured + 1);
    const late = setSlotText(1, 'p1', txt('GEÇ YANIT'), locked.state, captured);
    expect(late.stale).toBe(true);
    expect(late.state).toBe(locked.state);
    expect(late.state.texts[1]).toMatchObject({ caption: 'özgün 1' });
    expect(late.state.slots[1]).toBe('p1');
  });

  it('kilit SONRADAN AÇILSA bile eski istek geri yazamaz (kilit açma da sürümü artırır)', () => {
    const base = planFromIds(['p0', 'p1'], 'feed', [txt('a'), txt('b')]);
    const captured = base.versions[1];
    const locked = toggleLock(1, base, true, captured).state;
    const unlocked = toggleLock(1, locked, false, locked.versions[1]).state;
    expect(unlocked.locked[1]).toBe(false);
    expect(unlocked.versions[1]).toBe(captured + 2);
    const late = setSlotText(1, 'p1', txt('ESKİ İSTEK'), unlocked, captured);
    expect(late.stale).toBe(true);
    expect(late.state.texts[1]).toMatchObject({ caption: 'b' });
  });

  it('sürümsüz çağrı bile kilitli ve metni olan çifti ezmez (savunma katmanı)', () => {
    const locked = toggleLock(0, planFromIds(['p0'], 'feed', [txt('kalsın')]), true).state;
    const r = setSlotText(0, 'p0', txt('yeni'), locked);
    expect(r.stale).toBe(true);
    expect(r.message).toMatch(/Kalsın işaretli metin değişmez/);
    expect(r.state.texts[0]).toMatchObject({ caption: 'kalsın' });
  });

  it('kilitli ama metni OLMAYAN slota, kilitten SONRA yakalanan sürümle açık "Metin üret" yazabilir', () => {
    const imgOnly = planFromIds(['p0', 'p1'], 'feed', [null, null]);
    const locked = toggleLock(1, imgOnly, true, imgOnly.versions[1]).state;
    const ok = setSlotText(1, 'p1', txt('yeni metin'), locked, locked.versions[1]);
    expect(ok.stale).toBeFalsy();
    expect(ok.state.texts[1]).toMatchObject({ caption: 'yeni metin' });
    expect(ok.state.locked[1]).toBe(true);
    // Kilitten ÖNCE başlamış istek ise yok sayılır
    const stale = setSlotText(1, 'p1', txt('eski'), locked, imgOnly.versions[1]);
    expect(stale.stale).toBe(true);
    expect(stale.state.texts[1]).toBeNull();
  });

  it('tekrarlı Kalsın tıklaması idempotent: değişim yoksa sürüm ARTMAZ ve bekleyen geçerli istek bozulmaz', () => {
    const base = planFromIds(['p0'], 'feed', [txt('a')]);
    const a = toggleLock(0, base, true);
    const again = toggleLock(0, a.state, true);
    expect(again.state).toBe(a.state);
    expect(again.state.versions[0]).toBe(base.versions[0] + 1);
  });

  it('yarış diğer slotlara yayılmaz: yalnız kilitlenen slotun sürümü değişir', () => {
    const base = planFromIds(['p0', 'p1', 'p2'], 'feed', [txt('a'), txt('b'), txt('c')]);
    const locked = toggleLock(1, base, true).state;
    expect(locked.versions[0]).toBe(base.versions[0]);
    expect(locked.versions[2]).toBe(base.versions[2]);
    const ok = setSlotText(2, 'p2', txt('c2'), locked, base.versions[2]);
    expect(ok.stale).toBeFalsy();
    expect(ok.state.texts[2]).toMatchObject({ caption: 'c2' });
  });

  it('gerçek aday havuzuyla: plan → Kalsın → geç yanıt → görsel, kilit ve metin korunur', () => {
    const { ctx } = pool();
    const { textFor, ...noTpl } = ctx;
    void textFor;
    const st = generate(emptyPlan('feed'), noTpl).state;
    const i = st.slots.findIndex(Boolean);
    const id = st.slots[i]!;
    const first = setSlotText(i, id, txt('ilk'), st, st.versions[i]).state;
    const captured = first.versions[i];
    const locked = toggleLock(i, first, true, captured).state;
    const late = setSlotText(i, id, txt('geç'), locked, captured);
    expect(late.stale).toBe(true);
    expect(late.state.slots[i]).toBe(id);
    expect(late.state.locked[i]).toBe(true);
    expect(late.state.texts[i]).toMatchObject({ caption: 'ilk' });
  });
});
