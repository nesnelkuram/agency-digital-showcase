import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react';
import App, { type ReviewData } from '@/studio/feedPlanner/review/App';
import type { Candidate } from '@/studio/feedPlanner/types';
import { aest, pool } from './helpers';
import { reviewPorts, PortError, type CopyPort, type PlannerPorts } from '@/studio/feedPlanner/ports';
import type { CopyRequest } from '@/shared/planner/copyContract';

// Story serileri (YALNIZ açık seri kimliğinden): A = 3 kare (başlık, açıklama, metinsiz), B = 2 kare, C..F tek kare
const SERIES = ['A', 'A', 'A', 'B', 'B', 'C', 'D', 'E', 'F'];
const mkData = (over: (c: Candidate) => Candidate = (c) => c): ReviewData => {
  const { all, storyIds } = pool();
  const withFrames = (c: Candidate): Candidate => {
    const m = /^s(\d)$/.exec(c.id);
    if (!m) return over(c);
    const i = Number(m[1]);
    const first = i === 0 || SERIES[i] !== SERIES[i - 1];
    // Hepsi AYNI gün: gün seri kanıtı değildir; seri yalnız seriesKey'den gelir
    return over({ ...c, weekFrame: { day: 'Pazartesi', frame: i, copy: first ? `Metin ${c.id}` : i === 1 || i === 4 ? `Devam ${c.id}` : '', seriesKey: SERIES[i] } });
  };
  return {
    title: 'Dieci test', dateLabel: '12–18 Ekim 2026', archiveNote: 'arşiv', scope: 'kapsam', weeklyStory: storyIds,
    candidates: all.filter((c) => !c.published).map(withFrames),
    published: all.filter((c) => c.published && c.brand === 'dieci'),
  };
};
const measure = vi.fn(async () => aest());

/** TEST ÇİFTİ (gerçek model DEĞİL): sunucu sözleşmesine uygun yanıt şekli; her çağrıda benzersiz Türkçe metin */
let seq = 0;
const fakeCopy = (over: Partial<CopyPort> = {}): CopyPort & { calls: CopyRequest[] } => {
  const calls: CopyRequest[] = [];
  return {
    available: true,
    calls,
    generate: vi.fn(async (req: CopyRequest) => {
      calls.push(req);
      return {
        accepted: req.items.map((it) => {
          const v = `Test metni ${++seq} ${it.mediaId}`;
          const text = it.role === 'headline' ? { headline: v } : it.role === 'body' ? { body: v } : { caption: v };
          return { slotKey: it.slotKey, mediaId: it.mediaId, role: it.role, text, evidenceBasis: 'persona_kanaat' as const, rationale: 'test', contentHash: String(seq).padStart(32, '0'), warnings: [] };
        }),
        rejected: [], notes: [], model: 'test-double', promptVersion: 'plan-copy-v1', responseId: `resp-${seq}`,
      };
    }),
    ...over,
  } as CopyPort & { calls: CopyRequest[] };
};
const portsWith = (copy: CopyPort, persistence: PlannerPorts['persistence'] = null): PlannerPorts => ({ ...reviewPorts(), mode: 'studio', copy, persistence });
let copy: ReturnType<typeof fakeCopy>;
const renderApp = (props: Partial<React.ComponentProps<typeof App>> = {}) => render(<App data={mkData()} measure={measure} ports={portsWith(copy)} {...props} />);

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  copy = fakeCopy();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const feedIds = () =>
  Array.from({ length: 9 }, (_, i) => within(screen.getByTestId(`feed-slot-${i}`)).queryByRole('button', { name: /incele/ })?.getAttribute('aria-label')?.match(/: (\S+) incele/)?.[1] ?? null);
const generate = async () => {
  const btn = screen.getByText('Plan oluştur') as HTMLButtonElement;
  await waitFor(() => expect(btn.disabled).toBe(false));
  fireEvent.click(btn);
  await settle();
};
/** Üretim bitene kadar bekle: hiçbir slot meşgul değil */
const settle = () => waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
const filled = async () => { await waitFor(() => expect(screen.getAllByTestId(/^caption-\d$/)).toHaveLength(9)); };
const openMenu = (lane: 'feed' | 'story', n: number) => fireEvent.click(screen.getByLabelText(`${lane} slot ${n} menü`));
const choose = (name: string | RegExp) => fireEvent.click(screen.getByRole('menuitem', { name }));
const caption = (i: number) => screen.getByTestId(`caption-${i}`).textContent;
const roleOf = (n: number) => screen.getByTestId(`story-slot-${n}`).querySelector('[data-testid="story-canvas"]')!.getAttribute('data-role');

describe('ekran: etiketler, sayılar, ölçüm kapısı', () => {
  it('kısa yerel etiket, uzun uyarılar ayrıntıda; aday ve arşiv ayrı sayılır; canlı çağrı yok', () => {
    const d = mkData();
    render(<App data={d} measure={measure} />);
    expect(screen.getByText(/Yerel snapshot · model çalışmadı · canlı kütüphane bağlı değil/)).toBeTruthy();
    expect(screen.getByText('Ayrıntılar').closest('details')).toBeTruthy();
    const counts = screen.getByTestId('counts').textContent!;
    expect(counts).toContain(`Aday havuzu ${d.candidates.length}`);
    expect(counts).toContain(`Arşiv (ayrı, havuza girmez) ${d.published.length}`);
    expect(counts).not.toMatch(new RegExp(`(Aday havuzu|Kütüphane|Arşiv[^0-9]*) ${d.candidates.length + d.published.length}\\b`));
    expect(counts).toMatch(new RegExp(`Ölçüm \\d+/${d.candidates.length + d.published.length}`));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Plan oluştur ölçümler bitene kadar kapalı ve nedeni söylenir', async () => {
    const resolvers: (() => void)[] = [];
    const slow = vi.fn(() => new Promise<ReturnType<typeof aest>>((res) => resolvers.push(() => res(aest()))));
    renderApp({ measure: slow });
    const btn = screen.getByText('Plan oluştur') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByTestId('counts').textContent).toMatch(/Ölçüm sürüyor/);
    for (let k = 0; k < 100 && btn.disabled; k++) {
      await waitFor(() => expect(resolvers.length > 0 || !btn.disabled).toBe(true));
      resolvers.splice(0).forEach((r) => r());
      await Promise.resolve();
    }
    await waitFor(() => expect(btn.disabled).toBe(false), { timeout: 3000 });
  });
});

describe('MODEL YOK: şablon fallback ile başarı iddia edilmez', () => {
  it('yerel inceleme (model bağlı değil): görseller yerleşir ama metin ÜRETİLMEZ; açık hata ve "TAMAMLANMADI" gösterilir, hiçbir slotta şablon metni yok', async () => {
    render(<App data={mkData()} measure={measure} />);
    expect(screen.getByTestId('copy-unavailable').textContent).toMatch(/Metin üretimi kapalı/);
    await generate();
    expect(feedIds().every(Boolean)).toBe(true);
    expect(new Set(feedIds()).size).toBe(9);
    expect(screen.queryAllByTestId(/^caption-\d$/)).toHaveLength(0); // hiçbir feed slotunda metin yok
    expect(screen.queryByText(/şablon \(test\)/)).toBeNull();
    expect(document.querySelector('.caption .tag')).toBeNull();
    expect(screen.getByTestId('incomplete').textContent).toMatch(/TAMAMLANMADI/);
    expect(screen.getByTestId('feed-slot-0').textContent).toMatch(/Metin üretilemedi: Metin üretim modeli bağlı değil/);
    expect(screen.getAllByText(/Metin üretilemedi: Metin üretim modeli bağlı değil/).length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('model hata verirse (502 benzeri): görsel değişmez, hata nedeni görünür, mevcut öneri ve metni korunur', async () => {
    renderApp();
    await generate();
    await filled();
    const ids = feedIds();
    const cap = caption(0);
    (copy.generate as any).mockRejectedValue(new PortError('Metin üretim modeli çağrısı başarısız; metin üretilmedi.', 'model_error', 502));
    openMenu('feed', 1);
    choose('Ele ve yenisini getir');
    await waitFor(() => expect(screen.getByText(/Görsel ve metin birlikte yenilenemedi, mevcut öneri korundu: Metin üretim modeli çağrısı başarısız/)).toBeTruthy());
    expect(feedIds()).toEqual(ids);
    expect(caption(0)).toBe(cap);
    expect(screen.getByText('Henüz elenen yok.')).toBeTruthy();
  });

  it('sunucu metni reddederse (doğrulama): aday atanmaz; neden gösterilir', async () => {
    renderApp();
    (copy.generate as any).mockResolvedValue({ accepted: [], rejected: [{ slotKey: 'feed:4', reasons: ['kanıtsız_içerik:peynir'] }], notes: [], model: 'x', promptVersion: 'v', responseId: 'r' });
    fireEvent.click(screen.getByLabelText('Feed slot 5 seç'));
    fireEvent.click(screen.getByLabelText('p7 slota ata'));
    await waitFor(() => expect(screen.getByText(/Atama yapılamadı \(görsel ve metin birlikte yazılır\): kanıtsız_içerik:peynir/)).toBeTruthy());
    expect(within(screen.getByTestId('feed-slot-4')).queryByRole('button', { name: /incele/ })).toBeNull();
  });
});

describe('plan, Kalsın, yeniden öner (görsel + metin tek sürüm)', () => {
  it('Plan oluştur: 9 benzersiz öğe; her feed slotunun metni MODEL kaynaklı; hikâye kareleri feed\'de tekrar etmez; istek tek partide', async () => {
    renderApp();
    await generate();
    await filled();
    const ids = feedIds();
    expect(new Set(ids).size).toBe(9);
    expect(ids.some((id) => /^s\d$/.test(id!))).toBe(false);
    for (let i = 0; i < 9; i++) expect(screen.getByTestId(`caption-${i}`).textContent).toMatch(/model · TR/);
    const feedReq = copy.calls.find((r) => r.items.some((it) => it.lane === 'feed'))!;
    expect(feedReq.items).toHaveLength(9);
    expect(feedReq.items.map((it) => it.mediaId).sort()).toEqual([...ids].sort());
    expect(feedReq.items.every((it) => it.role === 'caption')).toBe(true);
    expect(screen.queryByTestId('incomplete')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Kalsın: yeniden önerde görsel VE metin sabit kalır; kalanlar birlikte yenilenir', async () => {
    renderApp();
    await generate();
    await filled();
    const before = feedIds();
    const caps = Array.from({ length: 9 }, (_, i) => caption(i));
    fireEvent.click(screen.getByLabelText('feed slot 1 kalsın'));
    fireEvent.click(screen.getByText('Kalanları yeniden öner'));
    await settle();
    const after = feedIds();
    expect(after[0]).toBe(before[0]);
    expect(caption(0)).toBe(caps[0]);
    expect(after.every(Boolean)).toBe(true);
    expect(new Set(after).size).toBe(9);
    // kilitsiz slotlarda görsel değiştiyse metni de birlikte değişmiştir (eski görsel + yeni metin karışımı yok)
    for (let i = 1; i < 9; i++) expect(after[i] !== before[i]).toBe(caption(i) !== caps[i]);
    const req = copy.calls.at(-1)!;
    expect(req.items.map((it) => it.slotKey)).not.toContain('feed:0');
  });

  it('yeniden öner sırasında model hata verirse: TÜM eski görsel+metinler korunur', async () => {
    renderApp();
    await generate();
    await filled();
    const before = feedIds();
    const caps = Array.from({ length: 9 }, (_, i) => caption(i));
    (copy.generate as any).mockRejectedValue(new PortError('model kapalı', 'model_unavailable'));
    fireEvent.click(screen.getByText('Kalanları yeniden öner'));
    await waitFor(() => expect(screen.getAllByText(/Görsel ve metin birlikte yenilenemedi, mevcut öneri korundu/).length).toBeGreaterThan(0));
    expect(feedIds()).toEqual(before);
    for (let i = 0; i < 9; i++) expect(caption(i)).toBe(caps[i]);
  });
});

describe('menü: sağ tık, üç nokta, klavye', () => {
  it('sağ tık menüyü açar; üç nokta düğmesi aria özellikleriyle aynı menüyü açar', async () => {
    renderApp();
    await generate();
    fireEvent.contextMenu(screen.getByTestId('feed-slot-2'));
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Kalsın', 'Ele ve yenisini getir', 'Başka adayla değiştir', 'Gerekçeyle reddet…']);
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    const trigger = screen.getByLabelText('feed slot 3 menü');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('klavye: açılışta ilk öğeye odak, ok tuşları gezinir, Escape kapatır ve odak tetikleyiciye döner', async () => {
    renderApp();
    await generate();
    const trigger = screen.getByLabelText('feed slot 1 menü');
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[3]);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe('Ele ve yenisini getir', () => {
  it('slotu yeni öneriyle (aday + model metni TEK adımda) değiştirir; eleneni yerel geçmişe yazar, kütüphaneden silmez', async () => {
    renderApp();
    await generate();
    await filled();
    const oldId = feedIds()[0]!;
    const oldCaption = caption(0);
    openMenu('feed', 1);
    choose('Ele ve yenisini getir');
    await waitFor(() => expect(feedIds()[0]).not.toBe(oldId));
    const newId = feedIds()[0]!;
    expect(caption(0)).not.toBe(oldCaption);
    expect(caption(0)).toContain(newId); // metin YENİ görsel için üretildi
    expect(new Set(feedIds()).size).toBe(9);
    expect(within(screen.getByTestId('history')).getByLabelText(`geri getir ${oldId}`)).toBeTruthy();
    expect(screen.getByLabelText(`${oldId} incele`)).toBeTruthy();
    const last = copy.calls.at(-1)!;
    expect(last.items).toEqual([{ slotKey: 'feed:0', mediaId: newId, lane: 'feed', role: 'caption' }]);
    expect(last.avoidTexts?.length).toBeGreaterThan(0); // diğer slotların metinleri tekrar önleme için gönderilir
  });

  it('elenen aday arka arkaya eleme ve yeniden önerde geri gelmez', async () => {
    renderApp();
    await generate();
    await filled();
    const seen: string[] = [feedIds()[0]!];
    for (let k = 0; k < 3; k++) {
      const prev = feedIds()[0];
      openMenu('feed', 1);
      choose('Ele ve yenisini getir');
      await waitFor(() => expect(feedIds()[0]).not.toBe(prev));
      const id = feedIds()[0]!;
      expect(seen).not.toContain(id);
      seen.push(id);
    }
    fireEvent.click(screen.getByText('Kalanları yeniden öner'));
    await settle();
    const planned = feedIds();
    for (const dropped of seen.slice(0, -1)) expect(planned).not.toContain(dropped);
  });

  it('Kalsın işaretli öneri elenemez; neden gösterilir; görsel ve metin korunur; model çağrılmaz', async () => {
    renderApp();
    await generate();
    await filled();
    const id = feedIds()[2]!;
    const cap = caption(2);
    fireEvent.click(screen.getByLabelText('feed slot 3 kalsın'));
    const calls = copy.calls.length;
    openMenu('feed', 3);
    choose('Ele ve yenisini getir');
    expect(screen.getByText(/Kalsın işaretli öneri yenilenemez/)).toBeTruthy();
    expect(feedIds()[2]).toBe(id);
    expect(caption(2)).toBe(cap);
    expect(copy.calls.length).toBe(calls);
  });

  it('geçmişten geri getir: aday ve ÖZGÜN metniyle döner; geçmişten çıkar', async () => {
    renderApp();
    await generate();
    await filled();
    const oldId = feedIds()[0]!;
    const oldCaption = caption(0);
    openMenu('feed', 1);
    choose('Ele ve yenisini getir');
    await waitFor(() => expect(feedIds()[0]).not.toBe(oldId));
    const replacement = feedIds()[0]!;
    fireEvent.click(screen.getByLabelText(`geri getir ${oldId}`));
    expect(feedIds()[0]).toBe(oldId);
    expect(caption(0)).toBe(oldCaption);
    expect(screen.queryByLabelText(`geri getir ${oldId}`)).toBeNull();
    expect(screen.getByLabelText(`geri getir ${replacement}`)).toBeTruthy();
  });

  it('çift tıklama güvenli: aynı menü öğesine iki kez basmak yalnız bir eleme ve bir model çağrısı yazar', async () => {
    renderApp();
    await generate();
    await filled();
    const calls = copy.calls.length;
    openMenu('feed', 1);
    const item = screen.getByRole('menuitem', { name: 'Ele ve yenisini getir' });
    fireEvent.click(item);
    fireEvent.click(item);
    await settle();
    expect(within(screen.getByTestId('history')).getAllByText('Geri getir').length).toBe(1);
    expect(copy.calls.length).toBe(calls + 1);
    expect(new Set(feedIds()).size).toBe(9);
  });
});

describe('QA senaryoları (yalnız ?qa=..., açık etiketli)', () => {
  it('normal akışta QA etiketi yok', () => {
    renderApp();
    expect(screen.queryByTestId('qa-banner')).toBeNull();
  });
  it('exhausted: yalnız 9 uygun aday; eleme "alternatif yok" der ve mevcut öneri aynen kalır; model çağrılmaz', async () => {
    renderApp({ qa: 'exhausted' });
    expect(screen.getByTestId('qa-banner').textContent).toMatch(/alternatif yok/);
    await generate();
    await filled();
    expect(feedIds().every(Boolean)).toBe(true);
    const id = feedIds()[0];
    const cap = caption(0);
    const calls = copy.calls.length;
    openMenu('feed', 1);
    choose('Ele ve yenisini getir');
    expect(screen.getByText(/Alternatif yok, mevcut öneri korundu/)).toBeTruthy();
    expect(feedIds()[0]).toBe(id);
    expect(caption(0)).toBe(cap);
    expect(copy.calls.length).toBe(calls);
    expect(screen.getByText('Henüz elenen yok.')).toBeTruthy();
  });
  it('error: hata durumunda mevcut öneri korunur ve açıklama gösterilir', async () => {
    renderApp({ qa: 'error' });
    await generate();
    await filled();
    const id = feedIds()[0];
    openMenu('feed', 1);
    choose('Ele ve yenisini getir');
    expect(screen.getByText(/Beklenmeyen hata; mevcut öneri korundu/)).toBeTruthy();
    expect(feedIds()[0]).toBe(id);
  });
});

describe('Story: gerçek seri kimliği, başlık hiyerarşisi, bant yok', () => {
  it('başlangıç Story sürümü planın Türkçe metnini gösterir (source: plan, lang: tr); kaynak kayıt değişmez', async () => {
    const d = mkData();
    render(<App data={d} measure={measure} ports={portsWith(copy)} />);
    await waitFor(() => expect(within(screen.getByTestId('story-slot-0')).getByTestId('storytext')).toBeTruthy());
    expect(within(screen.getByTestId('story-slot-0')).getByText('Metin s0')).toBeTruthy();
    expect(screen.queryByText(/English/)).toBeNull();
    fireEvent.click(screen.getByLabelText('Story slot 1: s0 incele'));
    expect(screen.getByText(/Plan metni \(değişmez\): Metin s0/)).toBeTruthy();
    expect(d.candidates.find((c) => c.id === 's0')!.weekFrame!.copy).toBe('Metin s0');
  });

  it('seri YALNIZ açık kimlikten: aynı gün olsa da farklı seri/kimliksiz kareler ayrı başlık alır; roller seriesKey\'e göre', async () => {
    renderApp();
    await waitFor(() => expect(screen.getByTestId('story-slot-0')).toBeTruthy());
    // dokuz kare de "Pazartesi": gün seri kanıtı olsaydı hepsi tek seri olurdu
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(roleOf)).toEqual(['headline', 'body', 'none', 'headline', 'body', 'headline', 'headline', 'headline', 'headline']);
    expect(screen.getByTestId('seri-0').textContent).toMatch(/seri: A \(1\/3\)/);
    expect(screen.getByTestId('seri-5').textContent).toMatch(/tek kare/);
  });

  it('seri kimliği olmayan Story (fixture\'da seri anahtarı yok): tüm kareler tek karelik seri → hepsi başlık alır', async () => {
    const d = mkData((c) => (c.weekFrame ? { ...c, weekFrame: { ...c.weekFrame, seriesKey: undefined } } : c));
    render(<App data={d} measure={measure} ports={portsWith(copy)} />);
    await waitFor(() => expect(screen.getByTestId('story-slot-0')).toBeTruthy());
    expect([0, 1, 2, 3, 4].map(roleOf)).toEqual(['headline', 'headline', 'headline', 'headline', 'headline']);
  });

  it('GERÇEK ÜRÜN kimliği (productId) seri kurar; aynı ürünle değişen kare seriyi korur ve model isteği seri kimliği/konum/boyut taşır', async () => {
    // s0-s2 ve havuzdaki tüm p* adaylar aynı doğrulanmış ürüne bağlı; planın kendi seri adı yok
    const d = mkData((c) => (/^(s[012]|p\d+)$/.test(c.id) ? { ...c, productId: 'the-ghosting', ...(c.weekFrame ? { weekFrame: { ...c.weekFrame, seriesKey: undefined } } : {}) } : c));
    render(<App data={d} measure={measure} ports={portsWith(copy)} />);
    await waitFor(() => expect(screen.getByTestId('seri-1').textContent).toMatch(/seri: the-ghosting \(2\/3\)/));
    expect([0, 1, 2].map(roleOf)).toEqual(['headline', 'body', 'none']);
    await waitFor(() => expect((screen.getByText('Plan oluştur') as HTMLButtonElement).disabled).toBe(false));
    openMenu('story', 2);
    choose('Başka adayla değiştir');
    await settle();
    const req = copy.calls.at(-1)!.items.find((it) => it.slotKey === 'story:1')!;
    expect(req).toMatchObject({ lane: 'story', role: 'body', seriesKey: 'the-ghosting', seriesPosition: 1, seriesSize: 3 });
    expect(roleOf(1)).toBe('body'); // seri korundu: yine açıklama, başlık değil
    expect(screen.getByTestId('story-slot-1').querySelector('.storytext .h')).toBeNull();
    expect(screen.getByTestId('story-slot-1').querySelector('.storytext .b')).toBeTruthy();
  });

  it('başlık yalnız serinin ilk karesinde; seriyi bölen değişim kimlikli olmayan adayı BAĞIMSIZ başlık yapar ve metni yeniden üretir', async () => {
    renderApp();
    await waitFor(() => expect(screen.getByTestId('story-slot-0')).toBeTruthy());
    expect([0, 1, 2, 3, 4, 5].map(roleOf)).toEqual(['headline', 'body', 'none', 'headline', 'body', 'headline']);
    await waitFor(() => expect((screen.getByText('Plan oluştur') as HTMLButtonElement).disabled).toBe(false));
    openMenu('story', 2);
    choose('Başka adayla değiştir');
    await settle();
    // yeni aday seri kimliği taşımıyor → A serisi bölündü: her kare bağımsız ve başlıklı; model başlık üretti
    await waitFor(() => expect(roleOf(1)).toBe('headline'));
    const c1 = screen.getByTestId('story-slot-1');
    expect(c1.querySelector('.storytext .h')).toBeTruthy();
    expect(c1.querySelector('.storytext .b')).toBeNull();
    expect(roleOf(2)).toBe('headline'); // eski "metinsiz" kare artık bağımsız → başlık gerekir
    await waitFor(() => expect(screen.getByTestId('story-slot-2').querySelector('.storytext .h')).toBeTruthy());
    const last = copy.calls.flatMap((r) => r.items).filter((it) => it.lane === 'story');
    expect(last.every((it) => it.role === 'headline' && it.seriesKey === null)).toBe(true);
  });

  it('metin fotoğrafın üstünde: zemin/bant/panel stili yok; yazı sakin bölgeye ve gerekirse gölgeyle yerleşir', async () => {
    renderApp();
    await waitFor(() => expect(screen.getByTestId('story-slot-0')).toBeTruthy());
    const canvas = screen.getByTestId('story-slot-0').querySelector('[data-testid="story-canvas"]')!;
    const text = canvas.querySelector('[data-testid="storytext"]') as HTMLElement;
    expect(text.style.background).toBe('');
    expect(text.style.backgroundColor).toBe('');
    expect(canvas.querySelectorAll('[style*="background"]').length).toBe(0);
    expect(['üst', 'orta', 'alt']).toContain(text.getAttribute('data-zone'));
    expect(canvas.querySelector('img')).toBeTruthy();
  });
});

describe('önceki davranışlar korunur', () => {
  it('gerekçeli ret: kategori olmadan kaydedilmez; kaydedilince seçimden dışlanır, slot yenisiyle (model metniyle) dolar ve gerekçe saklanır', async () => {
    renderApp();
    await generate();
    await filled();
    const victim = feedIds()[3]!;
    openMenu('feed', 4);
    choose('Gerekçeyle reddet…');
    const save = screen.getByText('Reddi kaydet') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Sebep kategorisi'), { target: { value: 'tekrar' } });
    fireEvent.change(screen.getByLabelText('Sebep açıklaması'), { target: { value: 'geçen haftaya benziyor' } });
    fireEvent.click(save);
    await waitFor(() => expect(feedIds()).not.toContain(victim));
    await settle();
    expect(feedIds().every(Boolean)).toBe(true);
    expect(caption(3)).toContain(feedIds()[3]!);
    fireEvent.click(screen.getByText('Kalanları yeniden öner'));
    await settle();
    expect(feedIds()).not.toContain(victim);
    fireEvent.click(screen.getByLabelText(`${victim} incele`));
    expect(screen.getByText(/Reddedildi · Tekrar: geçen haftaya benziyor/)).toBeTruthy();
  });

  it('kütüphaneden boş slota ata (görsel+model metni birlikte); aynı fotoğraf ikinci kez atanamaz; Kalsın işaretli slota atanamaz', async () => {
    renderApp();
    fireEvent.click(screen.getByLabelText('Feed slot 5 seç'));
    fireEvent.click(screen.getByLabelText('p7 slota ata'));
    await waitFor(() => expect(within(screen.getByTestId('feed-slot-4')).getByRole('button', { name: /p7 incele/ })).toBeTruthy());
    expect(screen.getByTestId('caption-4').textContent).toMatch(/model · TR/);
    fireEvent.click(screen.getByLabelText('Feed slot 2 seç'));
    fireEvent.click(screen.getByLabelText('p7 slota ata'));
    await waitFor(() => expect(screen.getByText(/Atanamadı: planda\/hikâyede zaten var/)).toBeTruthy());
    expect(within(screen.getByTestId('feed-slot-1')).queryByRole('button', { name: /incele/ })).toBeNull();
    fireEvent.click(screen.getByLabelText('feed slot 5 kalsın'));
    fireEvent.click(screen.getByLabelText('Feed slot 5: p7 incele'));
    fireEvent.click(screen.getByLabelText('p8 slota ata'));
    await waitFor(() => expect(screen.getByText(/Kilitli slota atanamaz/)).toBeTruthy());
  });

  it('yakınlaştırma feed hücresine ve önizlemeye aynı kırpmayı uygular', async () => {
    renderApp();
    await generate();
    fireEvent.click(within(screen.getByTestId('feed-slot-0')).getByRole('button', { name: /incele/ }));
    const before = within(screen.getByTestId('feed-slot-0')).getByTestId('cropped').getAttribute('data-crop');
    fireEvent.change(screen.getByLabelText('Yakınlaştırma'), { target: { value: '2' } });
    const after = within(screen.getByTestId('feed-slot-0')).getByTestId('cropped').getAttribute('data-crop');
    expect(after).not.toBe(before);
    expect(screen.getByLabelText('Seçili öğe').querySelector('.previewcol [data-testid="cropped"]')?.getAttribute('data-crop')).toBe(after);
  });

  it('biçim değişimi slot plan durumuna yazılır: Reels kapağında fotoğraf kalır', async () => {
    renderApp();
    await generate();
    await filled();
    const idBefore = feedIds()[1];
    fireEvent.click(within(screen.getByTestId('feed-slot-1')).getByRole('button', { name: /incele/ }));
    fireEvent.click(screen.getByLabelText(/Reels kapağı 9:16/));
    expect(within(screen.getByTestId('feed-slot-1')).getByText(/Reels kapağı 9:16/)).toBeTruthy();
    expect(feedIds()[1]).toBe(idBefore);
    fireEvent.click(screen.getByText('Kalanları yeniden öner'));
    await settle();
    expect(within(screen.getByTestId('feed-slot-1')).getByText(/Reels kapağı 9:16/)).toBeTruthy();
  });

  it('Story bellekte düzenlenir: Kalsın, değiştir, haftalığa dön; kaynak değişmez', async () => {
    const data = mkData();
    const snapshot = JSON.stringify(data.weeklyStory);
    render(<App data={data} measure={measure} ports={portsWith(copy)} />);
    await waitFor(() => expect(screen.getByTestId('story-slot-0')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('story slot 1 kalsın'));
    expect(within(screen.getByTestId('story-slot-0')).getByText(/kalsın/)).toBeTruthy();
    openMenu('story', 6);
    choose('Başka adayla değiştir');
    await settle();
    expect(within(screen.getByTestId('story-slot-5')).queryByRole('button', { name: /s5 incele/ })).toBeNull();
    fireEvent.click(screen.getByText('Haftalık plana dön'));
    expect(within(screen.getByTestId('story-slot-5')).getByRole('button', { name: /s5 incele/ })).toBeTruthy();
    expect(JSON.stringify(data.weeklyStory)).toBe(snapshot);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('kalıcı taslak (port): kaydet, yeniden yükle, çakışma', () => {
  const memoryStore = () => {
    const st: { version: number; draft: any } = { version: 0, draft: null };
    const persistence: NonNullable<PlannerPorts['persistence']> = {
      load: vi.fn(async () => (st.draft ? { version: st.version, draft: JSON.parse(JSON.stringify(st.draft)) } : null)),
      save: vi.fn(async (a: any) => {
        if (a.expectedVersion !== st.version) throw new PortError('Taslak başka bir yerde değişmiş.', 'version_conflict', 409);
        st.version += 1;
        st.draft = JSON.parse(JSON.stringify(a.draft));
        return { version: st.version, replayed: false };
      }),
    };
    return { st, persistence };
  };
  const WEEK = '2026-10-12';
  const mount = (persistence: PlannerPorts['persistence']) => render(<App data={mkData()} measure={measure} ports={portsWith(copy, persistence)} projectId="dieci" weekStart={WEEK} />);

  it('"Taslağı kaydet" yalnız değişiklik varken açık; kaydedince sürüm görünür; istek tam kapsam taşır (kilit, model metni, kırpma, Story serisi)', async () => {
    const { st, persistence } = memoryStore();
    mount(persistence);
    const save = screen.getByTestId('save-draft') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await generate();
    await filled();
    fireEvent.click(screen.getByLabelText('feed slot 1 kalsın'));
    fireEvent.click(within(screen.getByTestId('feed-slot-0')).getByRole('button', { name: /incele/ }));
    fireEvent.change(screen.getByLabelText('Yakınlaştırma'), { target: { value: '1.5' } });
    await waitFor(() => expect(save.disabled).toBe(false));
    expect(screen.getByTestId('persist-status').textContent).toMatch(/Kaydedilmemiş değişiklik/);
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByTestId('persist-status').textContent).toMatch(/Sunucuda kayıtlı sürüm 1/));
    const sent = (persistence.save as any).mock.calls[0][0];
    expect(sent).toMatchObject({ weekStart: WEEK, expectedVersion: 0 });
    expect(sent.idempotencyKey).toMatch(/^[A-Za-z0-9-]{16,64}$/);
    expect(st.draft.feed[0]).toMatchObject({ locked: true, text: { source: 'model', lang: 'tr', responseId: expect.any(String), contentHash: expect.any(String) }, crop: { zoom: 1.5 } });
    expect(st.draft.story[0]).toMatchObject({ format: 'story', seriesKey: 'A' });
    expect(st.draft.story[3]).toMatchObject({ seriesKey: 'B' });
    expect(st.draft.story[5].seriesKey).toBeNull(); // tek kare: seri yok
    expect(st.draft.story[1].text).toMatchObject({ source: 'plan' }); // plan metni model metni gibi işaretlenmez
    expect(save.disabled).toBe(true);
  });

  it('YENİDEN YÜKLEME: yeni oturum kayıtlı taslağı otomatik yükler; slotlar, model metinleri, Kalsın ve kırpma BİREBİR döner; model çağrılmaz', async () => {
    const { persistence } = memoryStore();
    const first = mount(persistence);
    await generate();
    await filled();
    fireEvent.click(screen.getByLabelText('feed slot 2 kalsın'));
    const ids = feedIds();
    const caps = Array.from({ length: 9 }, (_, i) => caption(i));
    await waitFor(() => expect((screen.getByTestId('save-draft') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('save-draft'));
    await waitFor(() => expect(screen.getByTestId('persist-status').textContent).toMatch(/Sunucuda kayıtlı sürüm 1/));
    first.unmount();
    cleanup();

    const calls = copy.calls.length;
    mount(persistence);
    await waitFor(() => expect(screen.getByTestId('persist-status').textContent).toMatch(/Kayıtlı taslak yüklendi \(sürüm 1\)/));
    expect(feedIds()).toEqual(ids);
    for (let i = 0; i < 9; i++) expect(caption(i)).toBe(caps[i]);
    expect(within(screen.getByTestId('feed-slot-1')).getByText(/kalsın/)).toBeTruthy();
    expect(copy.calls.length).toBe(calls);
    expect((screen.getByTestId('save-draft') as HTMLButtonElement).disabled).toBe(true);
  });

  it('SÜRÜM ÇAKIŞMASI: başka yerde değişmiş taslakta kayıt reddedilir, çakışma açıkça gösterilir ve güncel sürüm yüklenebilir', async () => {
    const { st, persistence } = memoryStore();
    mount(persistence);
    await generate();
    await filled();
    st.version = 5; // başka bir oturum yazdı
    st.draft = null;
    fireEvent.click(screen.getByLabelText('feed slot 1 kalsın'));
    await waitFor(() => expect((screen.getByTestId('save-draft') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('save-draft'));
    await waitFor(() => expect(screen.getByTestId('persist-status').textContent).toMatch(/başka bir yerde değişmiş/));
    expect(screen.getByText('Güncel sürümü yükle')).toBeTruthy();
    expect(st.version).toBe(5);
  });

  it('sunucu kaydı reddederse (ör. şema/medya) hata görünür, "kaydedildi" denmez', async () => {
    const { persistence } = memoryStore();
    (persistence.save as any).mockRejectedValue(new PortError('Taslaktaki medya bu marka kütüphanesinde geçerli değil.', 'media_invalid', 422));
    mount(persistence);
    await generate();
    await filled();
    fireEvent.click(screen.getByLabelText('feed slot 1 kalsın'));
    await waitFor(() => expect((screen.getByTestId('save-draft') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('save-draft'));
    await waitFor(() => expect(screen.getByTestId('persist-status').textContent).toMatch(/Kaydedilemedi: Taslaktaki medya/));
    expect(screen.getByTestId('persist-status').textContent).not.toMatch(/Sunucuda kayıtlı/);
  });

  it('kalıcılık portu yoksa (yerel inceleme) kaydet düğmesi yok ve "kalıcılık yok" açıkça yazar', () => {
    render(<App data={mkData()} measure={measure} />);
    expect(screen.queryByTestId('save-draft')).toBeNull();
    expect(screen.getByTestId('persist-status').textContent).toMatch(/Kalıcılık yok/);
  });
});
