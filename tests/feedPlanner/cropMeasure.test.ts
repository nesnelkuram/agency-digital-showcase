// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { CropMeasurer, measureKey, postWindow, windowKey } from '@/studio/feedPlanner/post/cropMeasure';
import { emptyPostPlan, setCrop, type PostPlan } from '@/studio/feedPlanner/post/postPlan';
import { aest, cand } from './helpers';

const deferred = <T,>() => { let res!: (v: T) => void; const p = new Promise<T>((r) => (res = r)); return { p, res }; };
const plan0 = (): PostPlan => ({ ...emptyPostPlan(), posts: [{ id: 'p1', assetId: 'a', assetLock: false, posLock: false, version: 1, text: null }] });

describe('nihai kırpım ölçümü: anahtar, geç eski yanıt reddi, yalnız kırpıma bağlı yeniden ölçüm', () => {
  const a = cand('a', { dims: { w: 3000, h: 2000 }, imageKey: 'img-a' });
  const b = cand('b', { dims: { w: 3000, h: 2000 }, imageKey: 'img-b' });

  it('pencere 4:5 ve kırpıma bağlıdır; anahtar kaynak kimliği/boyutu ve pencereyi ayırır', () => {
    const w1 = postWindow(plan0(), a);
    expect((w1.w * 3000) / (w1.h * 2000)).toBeCloseTo(0.8, 6);
    const w2 = postWindow(setCrop(plan0(), 'a', { focus: { x: 0.1, y: 0.5 }, zoom: 1.5 }).plan, a);
    expect(windowKey(w2)).not.toBe(windowKey(w1));
    expect(measureKey(a, w1)).not.toBe(measureKey(a, w2));
    expect(measureKey(a, w1)).not.toBe(measureKey({ ...a, imageKey: 'baska' }, w1));
    expect(measureKey(a, w1)).not.toBe(measureKey({ ...a, dims: { w: 3000, h: 2001 } }, w1));
    expect(measureKey(a, null)).toBe(`?|dieci|a|img-a|?|3000x2000|full`);
  });

  it('GEÇ ESKİ KIRPIM YANITI reddedilir: A isteği sürerken B istenirse A\'nın sonucu yazılmaz; B kalır', async () => {
    const dA = deferred<any>();
    const dB = deferred<any>();
    const measure = vi.fn(async (_u: string, w: any) => (w.x < 0.2 ? dA.p : dB.p));
    const change = vi.fn();
    const m = new CropMeasurer(measure, (c) => `/src/${c.id}`, change);
    const wA = { x: 0.1, y: 0, w: 0.5, h: 1 };
    const wB = { x: 0.4, y: 0, w: 0.5, h: 1 };
    m.request(a, wA);
    m.request(a, wB); // kullanıcı kırpımı değiştirdi
    dB.res(aest({ brightness: 0.9 }));
    await new Promise((r) => setTimeout(r, 0));
    dA.res(aest({ brightness: 0.1 })); // geç gelen eski yanıt
    await new Promise((r) => setTimeout(r, 0));
    expect(m.get(a, wB)?.brightness).toBe(0.9);
    expect(m.get(a, wA)).toBeUndefined(); // eski kırpım sonucu KAYDEDİLMEDİ
    expect(m.staleDropped).toBe(1);
    expect(m.isCurrent(a, wB)).toBe(true);
    expect(m.isCurrent(a, wA)).toBe(false);
  });

  it('YALNIZ kırpıma bağlı yeniden ölçüm: aynı pencere tekrar ölçülmez; kırpım değişen varlık yeniden ölçülür, diğerleri DOKUNULMAZ', async () => {
    const measure = vi.fn(async () => aest());
    const m = new CropMeasurer(measure, (c) => `/src/${c.id}`, () => undefined);
    const p0 = plan0();
    for (const c of [a, b]) m.request(c, postWindow(p0, c));
    await new Promise((r) => setTimeout(r, 0));
    expect(measure).toHaveBeenCalledTimes(2);
    for (const c of [a, b]) m.request(c, postWindow(p0, c)); // aynı pencere: yeniden ölçüm yok
    await new Promise((r) => setTimeout(r, 0));
    expect(measure).toHaveBeenCalledTimes(2);
    const p1 = setCrop(p0, 'a', { zoom: 2 }).plan;
    for (const c of [a, b]) m.request(c, postWindow(p1, c));
    await new Promise((r) => setTimeout(r, 0));
    expect(measure).toHaveBeenCalledTimes(3); // yalnız 'a'
    expect((measure.mock.calls[2] as unknown[])[0]).toBe('/src/a');
    expect(m.get(b, postWindow(p1, b))).toBeDefined();
  });

  it('ölçüm hatası null olarak saklanır (bilinmiyor); orijinal tüm-kare ölçümü kırpılmış anahtarla karışmaz; eşzamanlılık sınırlanır', async () => {
    let active = 0;
    let peak = 0;
    const measure = vi.fn(async (_u: string, w: any) => { active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 2)); active--; return w ? null : aest(); });
    const m = new CropMeasurer(measure, (c) => `/s/${c.id}`, () => undefined, 2);
    const cs = Array.from({ length: 6 }, (_, i) => cand(`c${i}`, { dims: { w: 3000, h: 2000 } }));
    for (const c of cs) m.request(c, postWindow(plan0(), c));
    m.request(a, null);
    await new Promise((r) => setTimeout(r, 40));
    expect(peak).toBeLessThanOrEqual(2);
    expect(m.get(cs[0], postWindow(plan0(), cs[0]))).toBeNull();
    expect(m.get(a, null)).not.toBeNull();
    expect(m.get(a, postWindow(plan0(), a))).toBeUndefined(); // tüm-kare ölçümü kırpılmış görünümün yerine KULLANILMAZ
  });
});
