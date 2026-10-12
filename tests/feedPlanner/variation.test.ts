// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { emptyPlan, generate, replaceSlot, dismissSlot, toggleLock, assignToSlot, FEED_SLOTS, VARIATION_BAND, type PlanCtx } from '@/studio/feedPlanner/planner';
import { scoreCandidate } from '@/studio/feedPlanner/scorer';
import { cand, aest } from './helpers';
import type { Candidate } from '@/studio/feedPlanner/types';

const ctxOf = (all: Candidate[], seed?: number, storyIds: string[] = []): PlanCtx => ({ brand: 'dieci', byId: new Map(all.map((c) => [c.id, c])), storyIds, seed });
const ids = (s: (string | null)[]) => s.filter(Boolean) as string[];

/** 16 fotoğraf, görsel olarak birbirine çok yakın (neredeyse eşit puan) → seed varyasyonu görünür */
const closePool = (): Candidate[] => Array.from({ length: 16 }, (_, i) => cand(`c${i}`, { group: 'pizza', aesthetics: aest({ brightness: 0.5 + (i % 3) * 0.002 }) }));

describe('görsel plan: tohumlu varyasyon', () => {
  it('tohum yoksa deterministik (aynı girdi, aynı plan); tohumla aynı tohum aynı planı verir', () => {
    const all = closePool();
    const a = generate(emptyPlan(), ctxOf(all)).state.slots;
    expect(generate(emptyPlan(), ctxOf(all)).state.slots).toEqual(a);
    expect(generate(emptyPlan(), ctxOf(all, 7)).state.slots).toEqual(generate(emptyPlan(), ctxOf(all, 7)).state.slots);
  });

  it('farklı tohumlar eşit/çok yakın puanlı adaylardan FARKLI planlar üretir (rastgele yeniden öneri çeşitlilik verir)', () => {
    const all = closePool();
    const plans = new Set(Array.from({ length: 8 }, (_, s) => JSON.stringify(generate(emptyPlan(), ctxOf(all, s)).state.slots)));
    expect(plans.size).toBeGreaterThan(2);
  });

  it('SERT KISITLAR hiçbir tohumda bozulmaz: yayımlanmış, başka marka, hikâye, video, yatay, tekrar asla seçilmez; 9 benzersiz slot', () => {
    const all = [
      ...closePool(),
      cand('hist1', { published: true, origin: 'history' }),
      cand('other1', { brand: 'baska' }),
      cand('video1', { kind: 'video_cover', dims: { w: 114, h: 200 } }),
      cand('wide1', { dims: { w: 3000, h: 1000 } }),
      cand('st0'),
      cand('notready', { readiness: { static: 'error', story: 'error', reels: 'error', carousel: 'error' } }),
    ];
    for (let seed = 0; seed < 25; seed++) {
      const { state } = generate(emptyPlan(), ctxOf(all, seed, ['st0']));
      const got = ids(state.slots);
      expect(got).toHaveLength(FEED_SLOTS);
      expect(new Set(got).size).toBe(FEED_SLOTS);
      for (const bad of ['hist1', 'other1', 'video1', 'wide1', 'st0', 'notready']) expect(got, `seed ${seed}`).not.toContain(bad);
    }
  });

  it('YAYIN GEÇMİŞİ: yayımlanmış bir görsele neredeyse aynı görünen aday, benzersiz alternatifler varken hiçbir tohumda seçilmez', () => {
    const hist = cand('hist1', { published: true, origin: 'history', aesthetics: aest({ palette: ['#112233', '#445566', '#778899', '#aabbcc'], warmth: -0.3, brightness: 0.8 }) });
    const dup = cand('dup', { aesthetics: aest({ palette: ['#112233', '#445566', '#778899', '#aabbcc'], warmth: -0.3, brightness: 0.8 }) });
    const others = Array.from({ length: 12 }, (_, i) => cand(`o${i}`, { aesthetics: aest({ palette: ['#aa5533', '#eeddcc', '#331100', '#887766'], warmth: 0.1, brightness: 0.5 + i * 0.001 }) }));
    const all = [hist, dup, ...others];
    // sezgisel puan farkı varyasyon bandından büyük olmalı (aksi hâlde test bir şey kanıtlamaz)
    const sOther = scoreCandidate(others[0], 'feed-4x5', [], [], [hist]).total;
    const sDup = scoreCandidate(dup, 'feed-4x5', [], [], [hist]).total;
    expect(sOther - sDup).toBeGreaterThan(VARIATION_BAND);
    for (let seed = 0; seed < 25; seed++) expect(ids(generate(emptyPlan(), ctxOf(all, seed)).state.slots), `seed ${seed}`).not.toContain('dup');
  });

  it('KOMŞU UYUMU: komşularıyla görsel olarak uyumsuz aday, uyumlu alternatifler varken hiçbir tohumda seçilmez (slot değiştirme)', () => {
    const calm = (id: string, i: number) => cand(id, { aesthetics: aest({ palette: ['#aa5533', '#eeddcc', '#331100', '#887766'], warmth: 0.1, brightness: 0.5 + i * 0.001, density: 0.3, negativeSpace: 0.2 }) });
    const neighbors = Array.from({ length: 4 }, (_, i) => calm(`n${i}`, i));
    const good = Array.from({ length: 5 }, (_, i) => calm(`g${i}`, i + 10));
    const clash = cand('clash', { aesthetics: aest({ palette: ['#00ff00', '#ff00ff', '#0000ff', '#ffff00'], warmth: -0.9, brightness: 0.05, density: 0.95, negativeSpace: 0.9 }) });
    const all = [...neighbors, ...good, clash, calm('cur', 99)];
    // slot 4 (ortada) 4 komşuyla çevrili: 1, 3, 5, 7
    let st = emptyPlan();
    st = { ...st, slots: ['n0', 'n0x', 'n1', 'n2', 'cur', 'n3', null, null, null].map((x) => (x === 'n0x' ? null : x)) as (string | null)[] };
    st.slots[1] = 'n0'; st.slots[0] = null; st.slots[2] = null;
    const ref = scoreCandidate(good[0], 'feed-4x5', [all[0], all[1], all[2], all[3]], [], []).total;
    const bad = scoreCandidate(clash, 'feed-4x5', [all[0], all[1], all[2], all[3]], [], []).total;
    expect(ref - bad).toBeGreaterThan(VARIATION_BAND);
    for (let seed = 0; seed < 25; seed++) {
      const r = replaceSlot(4, { ...st, slots: [null, 'n0', null, 'n1', 'cur', 'n2', null, 'n3', null] }, ctxOf(all, seed));
      expect(r.message).toBeUndefined();
      expect(r.state.slots[4], `seed ${seed}`).not.toBe('clash');
      expect(r.state.slots[4]).not.toBe('cur');
    }
  });

  it('KİLİTLER: tohumlu yeniden öneride Kalsın işaretli slotun görseli ve sürümü DEĞİŞMEZ; kalanlar yenilenir ve kilitliyle çakışmaz', () => {
    const all = closePool();
    const first = generate(emptyPlan(), ctxOf(all, 1)).state;
    let st = toggleLock(2, first).state;
    st = toggleLock(5, st).state;
    for (let seed = 2; seed < 20; seed++) {
      const r = generate(st, ctxOf(all, seed), true).state;
      expect(r.slots[2]).toBe(first.slots[2]);
      expect(r.slots[5]).toBe(first.slots[5]);
      expect(r.versions[2]).toBe(st.versions[2]);
      expect(r.versions[5]).toBe(st.versions[5]);
      expect(r.locked[2] && r.locked[5]).toBe(true);
      const got = ids(r.slots);
      expect(new Set(got).size).toBe(got.length);
    }
  });

  it('ELE ve yenisini getir: eleneni tohum ne olursa olsun geri getirmez; görsel değişir, METİN eskiden TAŞINMAZ (yeni görsel metinsiz)', () => {
    const all = closePool();
    const text = { caption: 'Eski metin', source: 'model' as const, lang: 'tr' as const };
    for (let seed = 0; seed < 10; seed++) {
      const base = generate(emptyPlan(), ctxOf(all, 0)).state;
      const withText = { ...base, texts: base.texts.map((t, i) => (i === 3 ? text : t)) };
      const r = dismissSlot(3, withText, ctxOf(all, seed), withText.versions[3]);
      expect(r.message).toBeUndefined();
      expect(r.state.slots[3]).not.toBe(base.slots[3]);
      expect(r.state.dismissed).toContain(base.slots[3]);
      expect(r.state.texts[3]).toBeNull();
      expect(r.state.history.at(-1)).toMatchObject({ slot: 3, candidateId: base.slots[3], text });
    }
  });

  it('manuel atama görseli HEMEN taslak olarak yazar (metin null, model/textFor yok); eski metin yeni görsele taşınmaz', () => {
    const all = closePool();
    const base = generate(emptyPlan(), ctxOf(all)).state;
    const withText = { ...base, texts: base.texts.map((t, i) => (i === 0 ? { caption: 'Önceki', source: 'model' as const, lang: 'tr' as const } : t)) };
    const spare = all.find((c) => !base.slots.includes(c.id))!;
    const r = assignToSlot(spare.id, 0, withText, ctxOf(all), withText.versions[0]);
    expect(r.message).toBeUndefined();
    expect(r.state.slots[0]).toBe(spare.id);
    expect(r.state.texts[0]).toBeNull();
    expect(r.state.versions[0]).toBe(withText.versions[0] + 1);
  });
});
