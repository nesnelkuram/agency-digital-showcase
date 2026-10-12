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
        voice: req.tempTone
          ? { source: 'temporary_tone' as const, tone: req.tempTone, guideVersion: null, assumptions: ['Geçici ton; onaylı marka hafızası değildir.'], tempToneIgnored: false }
          : { source: 'approved_bundle' as const, tone: null, guideVersion: null, assumptions: [], tempToneIgnored: false },
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
/** Yalnız GÖRSEL plan (model çağrılmaz) */
const makePlan = async () => {
  const btn = screen.getByTestId('make-plan') as HTMLButtonElement;
  await waitFor(() => expect(btn.disabled).toBe(false));
  fireEvent.click(btn);
  await settle();
};
/** Açık "Metinleri üret" */
const makeText = async () => {
  fireEvent.click(screen.getByTestId('gen-text'));
  await settle();
};
const generate = async () => { await makePlan(); await makeText(); };
/** Planda olmayan bir aday (atama denemeleri için) */
const spareId = () => Array.from({ length: 14 }, (_, k) => `p${k}`).find((id) => !feedIds().includes(id))!;
const status = (lane: string, i: number) => screen.getByTestId(`status-${lane}:${i}`);
/** Üretim bitene kadar bekle: hiçbir slot meşgul değil */
const settle = () => waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
const filled = async () => { await waitFor(() => expect(screen.getAllByTestId(/^caption-\d$/)).toHaveLength(9)); };
const openMenu = (lane: 'feed' | 'story', n: number) => fireEvent.click(screen.getByLabelText(`${lane} slot ${n} menü`));
const choose = (name: string | RegExp) => fireEvent.click(screen.getByRole('menuitem', { name }));
const caption = (i: number) => screen.getByTestId(`caption-${i}`).textContent;
const roleOf = (n: number) => screen.getByTestId(`story-slot-${n}`).querySelector('[data-testid="story-canvas"]')!.getAttribute('data-role');


describe('ana ekran: Instagram düzeni, tek ana eylem, ayrıntılar katlı', () => {
  it('tek ana eylem "Post planı oluştur"; diğer eylemler "Gelişmiş ayarlar" içinde katlı; kütüphane/inceleme varsayılan kapalı', () => {
    const d = mkData();
    render(<App data={d} measure={measure} />);
    const primaries = Array.from(document.querySelectorAll('.top button.primary')).map((b) => b.textContent);
    expect(primaries).toEqual(['Post planı oluştur']);
    const adv = screen.getByTestId('advanced') as HTMLDetailsElement;
    expect(adv.open).toBe(false);
    for (const t of ['Kalanları yeniden öner', 'Story oluştur', 'Story: kalanları yeniden öner']) expect(within(adv).getByText(t)).toBeTruthy();
    expect(within(adv).getByText('Ayrıntılar').closest('details')).toBeTruthy();
    expect(screen.getByTestId('toggle-panels').getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('.cols')!.className).toMatch(/no-panels/);
    expect(screen.getByText(/Yerel snapshot · model çalışmadı · canlı kütüphane bağlı değil/)).toBeTruthy();
  });

  it('Story şeridi feed\'in ÜSTÜNDE; feed 3 sütunlu ızgara', () => {
    render(<App data={mkData()} measure={measure} />);
    const strip = screen.getByLabelText('Story serisi');
    const feedGrid = document.querySelector('.feed') as HTMLElement;
    expect(strip.compareDocumentPosition(feedGrid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(feedGrid.style.gridTemplateColumns).toMatch(/repeat\(3,/);
  });

  it('bir görsele tıklamak kütüphane/inceleme panellerini açar; düğmeyle tekrar kapanır', async () => {
    renderApp();
    await makePlan();
    fireEvent.click(within(screen.getByTestId('feed-slot-0')).getByRole('button', { name: /incele/ }));
    expect(document.querySelector('.cols')!.className).toMatch(/with-panels/);
    fireEvent.click(screen.getByTestId('toggle-panels'));
    expect(document.querySelector('.cols')!.className).toMatch(/no-panels/);
  });

  it('etiketler: aday ve arşiv ayrı sayılır (gelişmiş içinde); canlı çağrı yok', () => {
    const d = mkData();
    render(<App data={d} measure={measure} />);
    const counts = screen.getByTestId('counts').textContent!;
    expect(counts).toContain(`Aday havuzu ${d.candidates.length}`);
    expect(counts).toContain(`Arşiv (ayrı, havuza girmez) ${d.published.length}`);
    expect(counts).toMatch(new RegExp(`Ölçüm \\d+/${d.candidates.length + d.published.length}`));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Post planı oluştur ölçümler bitene kadar kapalı ve nedeni söylenir', async () => {
    const resolvers: (() => void)[] = [];
    const slow = vi.fn(() => new Promise<ReturnType<typeof aest>>((res) => resolvers.push(() => res(aest()))));
    renderApp({ measure: slow });
    const btn = screen.getByTestId('make-plan') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText(/Ölçüm sürüyor/)).toBeTruthy();
    for (let k = 0; k < 100 && btn.disabled; k++) {
      await waitFor(() => expect(resolvers.length > 0 || !btn.disabled).toBe(true));
      resolvers.splice(0).forEach((r) => r());
      await Promise.resolve();
    }
    await waitFor(() => expect(btn.disabled).toBe(false), { timeout: 3000 });
  });
});

describe('GÖRSEL ÖNCE: plan ve yerleşim modeli ÇAĞIRMAZ; metin ayrı eylem', () => {
  it('Post planı oluştur: 9 benzersiz görsel yerleşir, model HİÇ çağrılmaz, hiçbir slotta metin yok; durum "henüz üretilmedi" (hata değil)', async () => {
    renderApp();
    await makePlan();
    const ids = feedIds();
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(9);
    expect(ids.some((id) => /^s\d$/.test(id!))).toBe(false); // hikâye kareleri feed'de tekrar etmez
    expect(copy.calls).toHaveLength(0);
    expect(screen.queryAllByTestId(/^caption-\d$/)).toHaveLength(0);
    expect(status('feed', 0).getAttribute('data-kind')).toBe('pending');
    expect(status('feed', 0).textContent).toBe('Metin henüz üretilmedi');
    expect(screen.getByTestId('text-summary').textContent).toMatch(/görsel yerleşti · \d+ metin hazır · 9 görselin metni henüz üretilmedi/); // Story'deki plan metinleri sayılır, feed'in 9 görseli metinsiz
  });

  it('"Metinleri üret" açık eylemdir: tek partide, görsel yerinde; metin MODEL kaynaklı', async () => {
    renderApp();
    await makePlan();
    const ids = feedIds();
    await makeText();
    expect(feedIds()).toEqual(ids);
    for (let i = 0; i < 9; i++) expect(screen.getByTestId(`caption-${i}`).textContent).toMatch(/model · TR/);
    expect(copy.calls).toHaveLength(1);
    const feedItems = copy.calls[0].items.filter((it) => it.lane === 'feed');
    expect(feedItems).toHaveLength(9);
    expect(feedItems.map((it) => it.mediaId).sort()).toEqual([...ids].sort());
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('istek ÖLÇÜLEN gözlemi taşır (palet/parlaklık/boş alan…); yalnız sayılar ve renkler, anlam yok', async () => {
    renderApp();
    await makePlan();
    await makeText();
    const it0 = copy.calls[0].items.find((i) => i.slotKey === 'feed:0')!;
    expect(it0.observed).toMatchObject({ brightness: 0.5, warmth: 0.1, contrast: 0.2, density: 0.3, negativeSpace: 0.2, negativeZone: 'dağınık' });
    expect(it0.observed!.palette).toHaveLength(4);
  });

  it('manuel atama görseli HEMEN geçerli taslak olarak yerleştirir: model çağrısı sıfır, metin yok, kaydedilebilir', async () => {
    renderApp();
    fireEvent.click(screen.getByLabelText('Feed slot 5 seç'));
    fireEvent.click(screen.getByLabelText('p7 slota ata'));
    expect(within(screen.getByTestId('feed-slot-4')).getByRole('button', { name: /p7 incele/ })).toBeTruthy();
    expect(status('feed', 4).textContent).toBe('Metin henüz üretilmedi');
    expect(copy.calls).toHaveLength(0);
    // gezinme, seçim, biçim ve kırpma da model çağırmaz
    fireEvent.click(within(screen.getByTestId('feed-slot-4')).getByRole('button', { name: /incele/ }));
    fireEvent.click(screen.getByLabelText(/Reels kapağı 9:16/));
    fireEvent.change(screen.getByLabelText('Yakınlaştırma'), { target: { value: '1.4' } });
    expect(copy.calls).toHaveLength(0);
    expect(screen.queryAllByTestId(/^caption-\d$/)).toHaveLength(0);
  });

  it('aynı fotoğraf ikinci kez atanamaz; Kalsın işaretli slota atanamaz (anında, model yok)', () => {
    renderApp();
    fireEvent.click(screen.getByLabelText('Feed slot 5 seç'));
    fireEvent.click(screen.getByLabelText('p7 slota ata'));
    fireEvent.click(screen.getByLabelText('Feed slot 2 seç'));
    fireEvent.click(screen.getByLabelText('p7 slota ata'));
    expect(screen.getByText(/Atanamadı: planda\/hikâyede zaten var/)).toBeTruthy();
    expect(within(screen.getByTestId('feed-slot-1')).queryByRole('button', { name: /incele/ })).toBeNull();
    fireEvent.click(screen.getByLabelText('feed slot 5 kalsın'));
    fireEvent.click(screen.getByLabelText('Feed slot 5: p7 incele'));
    fireEvent.click(screen.getByLabelText('p8 slota ata'));
    expect(screen.getByText(/Kilitli slota atanamaz/)).toBeTruthy();
    expect(copy.calls).toHaveLength(0);
  });

  it('YENİ GÖRSELE ESKİ METİN TAŞINMAZ: metinli slota yeni görsel atanınca metin boşalır ("henüz üretilmedi")', async () => {
    renderApp();
    await generate();
    const old = caption(0);
    const spare = spareId();
    fireEvent.click(screen.getByLabelText('Feed slot 1: ' + feedIds()[0] + ' incele'));
    fireEvent.click(screen.getByLabelText(`${spare} slota ata`));
    expect(feedIds()[0]).toBe(spare);
    expect(screen.queryByTestId('caption-0')).toBeNull();
    expect(old).toBeTruthy();
    expect(status('feed', 0).textContent).toBe('Metin henüz üretilmedi');
  });

  it('tek slot "Metin üret" yalnız o slotu ister; "Metni yenile" yeni metin getirir', async () => {
    renderApp();
    await makePlan();
    fireEvent.click(screen.getByTestId('gen-feed:3'));
    await settle();
    expect(copy.calls).toHaveLength(1);
    expect(copy.calls[0].items.map((i) => i.slotKey)).toEqual(['feed:3']);
    expect(screen.getByTestId('caption-3')).toBeTruthy();
    expect(screen.queryByTestId('caption-2')).toBeNull();
    const first = caption(3);
    fireEvent.click(screen.getByTestId('gen-feed:3'));
    await settle();
    expect(copy.calls).toHaveLength(2);
    expect(caption(3)).not.toBe(first);
  });
});

describe('metin hatası görseli SİLMEZ: sağlayıcı kapalı (503) ile marka dili yokluğu (412) AYRI', () => {
  it('yerel inceleme (model bağlı değil): görseller yerleşir, "Metinleri üret" → sağlayıcı kapalı durumu; görseller korunur; model çağrısı yok; şablon metni yok', async () => {
    render(<App data={mkData()} measure={measure} />);
    expect(screen.getByTestId('copy-unavailable').textContent).toMatch(/Metin üretimi kapalı/);
    await makePlan();
    const ids = feedIds();
    expect(ids.every(Boolean)).toBe(true);
    fireEvent.click(screen.getByTestId('gen-text'));
    await settle();
    expect(feedIds()).toEqual(ids);
    expect(status('feed', 0).getAttribute('data-kind')).toBe('provider_off');
    expect(status('feed', 0).textContent).toMatch(/Görsel korundu/);
    expect(screen.queryAllByTestId(/^caption-\d$/)).toHaveLength(0);
    expect(screen.queryByText(/şablon \(test\)/)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('503 feature_disabled (üretim kapalı): görsel plan aynen kalır, durum "sağlayıcı yapılandırması", 412 metni YOK', async () => {
    renderApp();
    await makePlan();
    const ids = feedIds();
    (copy.generate as any).mockRejectedValue(new PortError('Plan metin üretimi kapalı (PLAN_COPY_AI_ENABLED).', 'feature_disabled', 503));
    await makeText();
    expect(feedIds()).toEqual(ids);
    const st = status('feed', 2);
    expect(st.getAttribute('data-kind')).toBe('provider_off');
    expect(st.textContent).toMatch(/Metin üretimi kapalı \(sağlayıcı yapılandırması\)\. Görsel korundu\./);
    expect(st.textContent).not.toMatch(/marka dili/i);
    // plan yeniden kurulabilir / slot değiştirilebilir (hata görsel akışı kilitlemez)
    openMenu('feed', 1);
    choose('Ele ve yenisini getir');
    expect(feedIds()[0]).not.toBe(ids[0]);
  });

  it('412 brand_voice_missing (sunucu): görsel korunur, durum "marka dili yok", 503 metni YOK', async () => {
    renderApp();
    await makePlan();
    const ids = feedIds();
    (copy.generate as any).mockRejectedValue(new PortError('Bu marka için onaylı marka dili yok.', 'brand_voice_missing', 412));
    await makeText();
    expect(feedIds()).toEqual(ids);
    const st = status('feed', 0);
    expect(st.getAttribute('data-kind')).toBe('needs_voice');
    expect(st.textContent).toMatch(/Onaylı marka dili yok/);
    expect(st.textContent).not.toMatch(/sağlayıcı yapılandırması/);
  });

  it('model hatası (502): görsel ve mevcut metinler korunur, hata nedeni görünür', async () => {
    renderApp();
    await generate();
    const ids = feedIds();
    const cap = caption(0);
    (copy.generate as any).mockRejectedValue(new PortError('Metin üretim modeli çağrısı başarısız; metin üretilmedi.', 'model_error', 502));
    fireEvent.click(screen.getByTestId('gen-feed:4')); // metni olan slot yenilenmek istenir
    await settle();
    expect(feedIds()).toEqual(ids);
    expect(caption(0)).toBe(cap);
    expect(caption(4)).toBeTruthy(); // eski metin silinmedi
    expect(status('feed', 4).textContent).toMatch(/Metin üretilemedi: Metin üretim modeli çağrısı başarısız.*Görsel korundu/);
  });

  it('sunucu metni reddederse (doğrulama): görsel yerinde, neden gösterilir; gözlem yoksa "gözlem yok" ayrı durumu', async () => {
    renderApp();
    await makePlan();
    const ids = feedIds();
    (copy.generate as any).mockResolvedValue({
      accepted: [], rejected: [{ slotKey: 'feed:0', reasons: ['kanıtsız_içerik:peynir'] }, { slotKey: 'feed:1', reasons: ['gorsel_gozlem_yok'] }],
      notes: [], model: 'x', promptVersion: 'v', responseId: 'r',
    });
    fireEvent.click(screen.getByTestId('gen-feed:0'));
    await settle();
    expect(feedIds()).toEqual(ids);
    expect(status('feed', 0).getAttribute('data-kind')).toBe('rejected');
    expect(status('feed', 0).textContent).toMatch(/kanıtsız_içerik:peynir/);
    (copy.generate as any).mockResolvedValue({ accepted: [], rejected: [{ slotKey: 'feed:1', reasons: ['gorsel_gozlem_yok'] }], notes: [], model: 'x', promptVersion: 'v', responseId: 'r' });
    fireEvent.click(screen.getByTestId('gen-feed:1'));
    await settle();
    expect(status('feed', 1).getAttribute('data-kind')).toBe('no_observation');
    expect(status('feed', 1).textContent).toMatch(/Bu görselde gözlem yok/);
  });

  it('BAYAT YANIT: metin beklerken görsel değişirse gelen metin YENİ görsele yazılmaz', async () => {
    renderApp();
    await makePlan();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const real = (copy.generate as any).getMockImplementation();
    (copy.generate as any).mockImplementation(async (req: CopyRequest) => { await gate; return real(req); });
    fireEvent.click(screen.getByTestId('gen-feed:0'));
    await waitFor(() => expect(screen.getByTestId('status-feed:0').textContent).toMatch(/üretiliyor/));
    // metin beklerken slotun görseli reddedilir (slot boşalır, sürüm artar): meşgul slot atamaya kapalıdır ama ret serbesttir
    const original = feedIds()[0]!;
    openMenu('feed', 1);
    choose('Gerekçeyle reddet…');
    fireEvent.change(screen.getByLabelText('Sebep kategorisi'), { target: { value: 'görsel' } });
    fireEvent.click(screen.getByText('Reddi kaydet'));
    await waitFor(() => expect(feedIds()[0]).toBeNull());
    release();
    await waitFor(() => expect(screen.getByText(/Slot beklerken değişti, gelen metin yok sayıldı: Feed slot 1/)).toBeTruthy());
    expect(screen.queryByTestId('caption-0')).toBeNull(); // eski görselin metni hiçbir yere YAZILMADI
    expect(feedIds()[0]).toBeNull();
    expect(original).toBeTruthy();
  });
});

describe('REHBERSİZ GEÇİCİ TON', () => {
  const renderNoGuide = (extra: Partial<React.ComponentProps<typeof App>> = {}) => render(<App data={mkData()} measure={measure} ports={portsWith(copy)} voice={{ approved: false }} {...extra} />);

  it('marka dili yok: ton paneli görünür, plan BLOKLANMAZ; ton seçilmeden "Metinleri üret" ağ çağrısı YAPMAZ ve net "marka dili yok" der (görsel korunur)', async () => {
    renderNoGuide();
    expect(screen.getByTestId('tone-panel').textContent).toMatch(/onaylı marka dili yok/);
    await makePlan();
    const ids = feedIds();
    expect(ids.every(Boolean)).toBe(true);
    fireEvent.click(screen.getByTestId('gen-text'));
    await settle();
    expect(copy.calls).toHaveLength(0);
    expect(status('feed', 0).getAttribute('data-kind')).toBe('needs_voice');
    expect(feedIds()).toEqual(ids);
  });

  it('ton etiketi seçilince istek tempTone taşır; metin "geçici ton taslağı" ve varsayım uyarısıyla gösterilir; onaylı gibi gösterilmez', async () => {
    renderNoGuide();
    await makePlan();
    fireEvent.click(screen.getByTestId('tone-chip-zarif'));
    expect(screen.getByTestId('tone-chip-zarif').getAttribute('aria-pressed')).toBe('true');
    await makeText();
    expect(copy.calls[0].tempTone).toEqual({ label: 'zarif' });
    expect(screen.getByTestId('caption-0').textContent).toMatch(/geçici ton taslağı/);
    expect(screen.getByTestId('caption-0').textContent).not.toMatch(/model · TR/);
    expect(screen.getByTestId('assume-feed:0').textContent).toMatch(/Varsayım: yalnız ölçülen görsel özellik ve seçilen geçici tondan türetildi; ürün\/içerik doğrulanmadı\. Onaylı marka dili değildir\./);
    expect(screen.getByTestId('tone-panel').textContent).toMatch(/GEÇİCİDİR; onaylı marka hafızası değildir ve kaydedilmez/);
  });

  it('serbest ton tarifi de gönderilir (kırpılmış); etiket tekrar tıklanınca kalkar', async () => {
    renderNoGuide();
    await makePlan();
    fireEvent.change(screen.getByTestId('tone-prompt'), { target: { value: '  sıcak,   kısa cümleler ' } });
    fireEvent.click(screen.getByTestId('tone-chip-samimi'));
    fireEvent.click(screen.getByTestId('tone-chip-samimi'));
    await makeText();
    expect(copy.calls[0].tempTone).toEqual({ prompt: 'sıcak, kısa cümleler' });
  });

  it('onaylı marka dili varsa ton paneli yok ve tempTone GÖNDERİLMEZ; sunucu ton yok sayarsa kullanıcı bilgilendirilir', async () => {
    render(<App data={mkData()} measure={measure} ports={portsWith(copy)} voice={{ approved: true }} />);
    expect(screen.queryByTestId('tone-panel')).toBeNull();
    expect(screen.getByTestId('voice-approved')).toBeTruthy();
    await makePlan();
    await makeText();
    expect(copy.calls[0].tempTone).toBeUndefined();
    cleanup();
    // bilinmiyor (null): ton gönderilir, sunucu onaylıyı seçip yok sayar
    renderApp({ voice: { approved: null } });
    await makePlan();
    fireEvent.click(screen.getByTestId('tone-chip-lüks'));
    (copy.generate as any).mockResolvedValueOnce({
      accepted: [{ slotKey: 'feed:0', mediaId: 'x', role: 'caption', text: { caption: 'Onaylı rehberle yazılmış metin.' }, evidenceBasis: 'marka_rehberi', rationale: 'r', contentHash: 'a'.repeat(32), warnings: [] }],
      rejected: [], notes: [], model: 'm', promptVersion: 'plan-copy-v2-guide', responseId: 'r1',
      voice: { source: 'approved_guide', tone: null, guideVersion: 2, assumptions: [], tempToneIgnored: true },
    });
    fireEvent.click(screen.getByTestId('gen-feed:0'));
    await settle();
    expect(screen.getByText(/Onaylı marka dili kullanıldı; seçtiğiniz geçici ton yok sayıldı/)).toBeTruthy();
    expect(screen.getByTestId('caption-0').textContent).toMatch(/marka rehberi · TR/);
  });

  it('"Marka dilini birlikte oluştur" yalnız onStartGuide verilince görünür ve çağırır', () => {
    const onStartGuide = vi.fn();
    renderNoGuide({ onStartGuide });
    fireEvent.click(screen.getByTestId('start-guide'));
    expect(onStartGuide).toHaveBeenCalledTimes(1);
    cleanup();
    renderNoGuide();
    expect(screen.queryByTestId('start-guide')).toBeNull();
  });

  it('geçici ton metni taslağa voiceSource ile kaydedilir ve yeniden yüklemede "geçici ton taslağı" olarak döner', async () => {
    const { st, persistence } = memoryStoreFactory();
    render(<App data={mkData()} measure={measure} ports={portsWith(copy, persistence)} projectId="dieci" weekStart="2026-10-12" voice={{ approved: false }} />);
    await makePlan();
    fireEvent.click(screen.getByTestId('tone-chip-enerjik'));
    await makeText();
    await waitFor(() => expect((screen.getByTestId('save-draft') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('save-draft'));
    await waitFor(() => expect(screen.getByTestId('persist-status').textContent).toMatch(/Sunucuda kayıtlı sürüm 1/));
    expect(st.draft.feed[0].text).toMatchObject({ source: 'model', voiceSource: 'temporary_tone' });
    expect(st.draft.feed[0].text.assumptions).toBeUndefined(); // varsayım listesi kalıcı alan değil
    cleanup();
    render(<App data={mkData()} measure={measure} ports={portsWith(copy, persistence)} projectId="dieci" weekStart="2026-10-12" voice={{ approved: false }} />);
    await waitFor(() => expect(screen.getByTestId('persist-status').textContent).toMatch(/Kayıtlı taslak yüklendi/));
    expect(screen.getByTestId('caption-0').textContent).toMatch(/geçici ton taslağı/);
    expect(screen.getByTestId('assume-feed:0')).toBeTruthy();
  });
});

describe('Kalsın ve yeniden öner (görsel plan; metin ayrı)', () => {
  it('Kalsın: yeniden önerde görsel VE metin sabit kalır; kalanlar görselce yenilenir ve metinsiz kalır; model çağrılmaz', async () => {
    renderApp();
    await generate();
    const before = feedIds();
    const caps = Array.from({ length: 9 }, (_, i) => caption(i));
    const calls = copy.calls.length;
    fireEvent.click(screen.getByLabelText('feed slot 1 kalsın'));
    fireEvent.click(screen.getByText('Kalanları yeniden öner'));
    const after = feedIds();
    expect(after[0]).toBe(before[0]);
    expect(caption(0)).toBe(caps[0]);
    expect(after.every(Boolean)).toBe(true);
    expect(new Set(after).size).toBe(9);
    // görsel değiştiyse eski metin taşınmadı; değişmediyse metin aynen duruyor
    for (let i = 1; i < 9; i++) {
      if (after[i] !== before[i]) expect(screen.queryByTestId(`caption-${i}`)).toBeNull();
      else expect(caption(i)).toBe(caps[i]);
    }
    expect(copy.calls.length).toBe(calls);
  });

  it('"Metinleri üret" Kalsın işaretli ve metni olan çifte dokunmaz; tek slot yenileme de kilitliyi değiştirmez', async () => {
    renderApp();
    await generate();
    const cap = caption(0);
    fireEvent.click(screen.getByLabelText('feed slot 1 kalsın'));
    const calls = copy.calls.length;
    expect((screen.getByTestId('gen-feed:0') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('gen-feed:0'));
    await settle();
    expect(caption(0)).toBe(cap);
    expect(copy.calls.length).toBe(calls);
  });

  it('YENİDEN ÖNER: tohumlu varyasyon dahil kilitli slot, sert kısıtlar ve benzersizlik korunur (tekrar tekrar)', async () => {
    renderApp();
    await makePlan();
    fireEvent.click(screen.getByLabelText('feed slot 3 kalsın'));
    const locked = feedIds()[2];
    for (let k = 0; k < 4; k++) {
      fireEvent.click(screen.getByText('Kalanları yeniden öner'));
      const ids = feedIds();
      expect(ids[2]).toBe(locked);
      expect(new Set(ids).size).toBe(9);
      expect(ids.some((id) => /^(s\d|video1|wide1|other1|hist1)$/.test(id!))).toBe(false);
    }
    expect(copy.calls).toHaveLength(0);
  });
});

describe('menü: sağ tık, üç nokta, klavye, düğme', () => {
  it('sağ tık menüyü açar; üç nokta düğmesi aria özellikleriyle aynı menüyü açar', async () => {
    renderApp();
    await makePlan();
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
    await makePlan();
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

describe('Ele ve yenisini getir (görsel; metin taşınmaz, model yok)', () => {
  it('menüden: slot yeni görselle ANINDA değişir; eleneni yerel geçmişe (özgün metniyle) yazar; yeni görsel metinsiz; model çağrılmaz', async () => {
    renderApp();
    await generate();
    const oldId = feedIds()[0]!;
    const oldCaption = caption(0);
    const calls = copy.calls.length;
    openMenu('feed', 1);
    choose('Ele ve yenisini getir');
    expect(feedIds()[0]).not.toBe(oldId);
    expect(screen.queryByTestId('caption-0')).toBeNull(); // eski metin yeni görsele taşınmadı
    expect(status('feed', 0).textContent).toBe('Metin henüz üretilmedi');
    expect(new Set(feedIds()).size).toBe(9);
    expect(within(screen.getByTestId('history')).getByLabelText(`geri getir ${oldId}`)).toBeTruthy();
    expect(within(screen.getByTestId('history')).getByText(new RegExp(oldCaption.replace(/^model · TR\s*/, '').slice(0, 14)))).toBeTruthy();
    expect(screen.getByLabelText(`${oldId} incele`)).toBeTruthy(); // kütüphaneden silinmedi
    expect(copy.calls.length).toBe(calls);
  });

  it('DÜĞME ALTERNATİFİ ("Yenisini getir") ve klavye (odak + Enter) aynı sonucu verir', async () => {
    renderApp();
    await makePlan();
    const oldId = feedIds()[4]!;
    const btn = screen.getByLabelText('feed slot 5 ele ve yenisini getir') as HTMLButtonElement;
    btn.focus();
    expect(document.activeElement).toBe(btn);
    fireEvent.click(btn); // klavyede odaktaki düğmede Enter/Boşluk = click
    expect(feedIds()[4]).not.toBe(oldId);
    expect(within(screen.getByTestId('history')).getByLabelText(`geri getir ${oldId}`)).toBeTruthy();
    // Kalsın işaretli slotta düğme kapalı
    fireEvent.click(screen.getByLabelText('feed slot 2 kalsın'));
    expect((screen.getByLabelText('feed slot 2 ele ve yenisini getir') as HTMLButtonElement).disabled).toBe(true);
  });

  it('elenen aday arka arkaya eleme ve yeniden önerde geri gelmez', async () => {
    renderApp();
    await makePlan();
    const seen: string[] = [feedIds()[0]!];
    for (let k = 0; k < 3; k++) {
      const prev = feedIds()[0];
      openMenu('feed', 1);
      choose('Ele ve yenisini getir');
      expect(feedIds()[0]).not.toBe(prev);
      const id = feedIds()[0]!;
      expect(seen).not.toContain(id);
      seen.push(id);
    }
    fireEvent.click(screen.getByText('Kalanları yeniden öner'));
    const planned = feedIds();
    for (const dropped of seen.slice(0, -1)) expect(planned).not.toContain(dropped);
  });

  it('Kalsın işaretli öneri elenemez; neden gösterilir; görsel ve metin korunur; model çağrılmaz', async () => {
    renderApp();
    await generate();
    const id = feedIds()[2]!;
    const cap = caption(2);
    fireEvent.click(screen.getByLabelText('feed slot 3 kalsın'));
    const calls = copy.calls.length;
    openMenu('feed', 3);
    choose('Ele ve yenisini getir');
    expect(screen.getByText(/Kalsın işaretli öneri elenemez/)).toBeTruthy();
    expect(feedIds()[2]).toBe(id);
    expect(caption(2)).toBe(cap);
    expect(copy.calls.length).toBe(calls);
  });

  it('geçmişten geri getir: aday ve ÖZGÜN metniyle döner; geçmişten çıkar', async () => {
    renderApp();
    await generate();
    const oldId = feedIds()[0]!;
    const oldCaption = caption(0);
    openMenu('feed', 1);
    choose('Ele ve yenisini getir');
    const replacement = feedIds()[0]!;
    fireEvent.click(screen.getByLabelText(`geri getir ${oldId}`));
    expect(feedIds()[0]).toBe(oldId);
    expect(caption(0)).toBe(oldCaption);
    expect(screen.queryByLabelText(`geri getir ${oldId}`)).toBeNull();
    expect(screen.getByLabelText(`geri getir ${replacement}`)).toBeTruthy();
  });

  it('çift tıklama güvenli: aynı menü öğesine iki kez basmak yalnız bir eleme yazar (sürüm koruması)', async () => {
    renderApp();
    await makePlan();
    openMenu('feed', 1);
    const item = screen.getByRole('menuitem', { name: 'Ele ve yenisini getir' });
    fireEvent.click(item);
    fireEvent.click(item);
    expect(within(screen.getByTestId('history')).getAllByText('Geri getir').length).toBe(1);
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

  it('GERÇEK ÜRÜN kimliği (productId) seri kurar; aynı ürünle değişen kare seriyi korur; model ÇAĞRILMAZ, "Metin üret" isteği seri kimliği/konum/boyut taşır', async () => {
    const d = mkData((c) => (/^(s[012]|p\d+)$/.test(c.id) ? { ...c, productId: 'the-ghosting', ...(c.weekFrame ? { weekFrame: { ...c.weekFrame, seriesKey: undefined } } : {}) } : c));
    render(<App data={d} measure={measure} ports={portsWith(copy)} />);
    await waitFor(() => expect(screen.getByTestId('seri-1').textContent).toMatch(/seri: the-ghosting \(2\/3\)/));
    expect([0, 1, 2].map(roleOf)).toEqual(['headline', 'body', 'none']);
    await waitFor(() => expect((screen.getByTestId('make-plan') as HTMLButtonElement).disabled).toBe(false));
    openMenu('story', 2);
    choose('Başka adayla değiştir');
    expect(copy.calls).toHaveLength(0);
    expect(roleOf(1)).toBe('body'); // seri korundu: yine açıklama, başlık değil
    expect(status('story', 1).textContent).toBe('Metin henüz üretilmedi'); // eski metin taşınmadı
    fireEvent.click(screen.getByTestId('gen-story:1'));
    await settle();
    const req = copy.calls.at(-1)!.items.find((it) => it.slotKey === 'story:1')!;
    expect(req).toMatchObject({ lane: 'story', role: 'body', seriesKey: 'the-ghosting', seriesPosition: 1, seriesSize: 3 });
    expect(screen.getByTestId('story-slot-1').querySelector('.storytext .h')).toBeNull();
    expect(screen.getByTestId('story-slot-1').querySelector('.storytext .b')).toBeTruthy();
  });

  it('seriyi bölen değişim: kimliksiz aday BAĞIMSIZ başlık olur, uymayan metinler BOŞALIR (model çağrılmaz); "Metinleri üret" başlık ister', async () => {
    renderApp();
    await waitFor(() => expect(screen.getByTestId('story-slot-0')).toBeTruthy());
    expect([0, 1, 2, 3, 4, 5].map(roleOf)).toEqual(['headline', 'body', 'none', 'headline', 'body', 'headline']);
    await waitFor(() => expect((screen.getByTestId('make-plan') as HTMLButtonElement).disabled).toBe(false));
    openMenu('story', 2);
    choose('Başka adayla değiştir');
    expect(copy.calls).toHaveLength(0);
    expect(roleOf(1)).toBe('headline');
    expect(roleOf(2)).toBe('headline'); // eski "metinsiz" kare artık bağımsız
    expect(screen.getByTestId('story-slot-1').querySelector('.storytext .h')).toBeNull(); // metni boşaldı
    fireEvent.click(screen.getByTestId('gen-text'));
    await settle();
    const story = copy.calls.flatMap((r) => r.items).filter((it) => it.lane === 'story');
    expect(story.length).toBeGreaterThan(0);
    expect(story.every((it) => it.role === 'headline' && it.seriesKey === null)).toBe(true);
    await waitFor(() => expect(screen.getByTestId('story-slot-2').querySelector('.storytext .h')).toBeTruthy());
  });

  it('metin fotoğrafın üstünde: zemin/bant/panel stili yok; yazı sakin bölgeye yerleşir', async () => {
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
  it('gerekçeli ret: kategori olmadan kaydedilmez; kaydedilince seçimden dışlanır, slot yeni GÖRSELLE (metinsiz) dolar ve gerekçe saklanır', async () => {
    renderApp();
    await generate();
    const victim = feedIds()[3]!;
    openMenu('feed', 4);
    choose('Gerekçeyle reddet…');
    const save = screen.getByText('Reddi kaydet') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Sebep kategorisi'), { target: { value: 'tekrar' } });
    fireEvent.change(screen.getByLabelText('Sebep açıklaması'), { target: { value: 'geçen haftaya benziyor' } });
    const calls = copy.calls.length;
    fireEvent.click(save);
    await waitFor(() => expect(feedIds()).not.toContain(victim));
    expect(feedIds().every(Boolean)).toBe(true);
    expect(screen.queryByTestId('caption-3')).toBeNull(); // yeni görsel metinsiz
    expect(copy.calls.length).toBe(calls);
    fireEvent.click(screen.getByText('Kalanları yeniden öner'));
    expect(feedIds()).not.toContain(victim);
    fireEvent.click(screen.getByLabelText(`${victim} incele`));
    expect(screen.getByText(/Reddedildi · Tekrar: geçen haftaya benziyor/)).toBeTruthy();
  });

  it('yakınlaştırma feed hücresine ve önizlemeye aynı kırpmayı uygular', async () => {
    renderApp();
    await makePlan();
    fireEvent.click(within(screen.getByTestId('feed-slot-0')).getByRole('button', { name: /incele/ }));
    const before = within(screen.getByTestId('feed-slot-0')).getByTestId('cropped').getAttribute('data-crop');
    fireEvent.change(screen.getByLabelText('Yakınlaştırma'), { target: { value: '2' } });
    const after = within(screen.getByTestId('feed-slot-0')).getByTestId('cropped').getAttribute('data-crop');
    expect(after).not.toBe(before);
    expect(screen.getByLabelText('Seçili öğe').querySelector('.previewcol [data-testid="cropped"]')?.getAttribute('data-crop')).toBe(after);
  });

  it('biçim değişimi slot plan durumuna yazılır: Reels kapağında fotoğraf kalır', async () => {
    renderApp();
    await makePlan();
    const idBefore = feedIds()[1];
    fireEvent.click(within(screen.getByTestId('feed-slot-1')).getByRole('button', { name: /incele/ }));
    fireEvent.click(screen.getByLabelText(/Reels kapağı 9:16/));
    expect(within(screen.getByTestId('feed-slot-1')).getByText(/Reels kapağı 9:16/)).toBeTruthy();
    expect(feedIds()[1]).toBe(idBefore);
    fireEvent.click(screen.getByText('Kalanları yeniden öner'));
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
    expect(within(screen.getByTestId('story-slot-5')).queryByRole('button', { name: /s5 incele/ })).toBeNull();
    fireEvent.click(screen.getByText('Haftalık plana dön'));
    expect(within(screen.getByTestId('story-slot-5')).getByRole('button', { name: /s5 incele/ })).toBeTruthy();
    expect(JSON.stringify(data.weeklyStory)).toBe(snapshot);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

function memoryStoreFactory() {
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
}

describe('kalıcı taslak (port): kaydet, yeniden yükle, çakışma', () => {
  const memoryStore = memoryStoreFactory;
  const WEEK = '2026-10-12';
  const mount = (persistence: PlannerPorts['persistence']) => render(<App data={mkData()} measure={measure} ports={portsWith(copy, persistence)} projectId="dieci" weekStart={WEEK} />);

  it('METİNSİZ taslak kaydedilir: görsel plan + Kalsın + kırpma yeterlidir; metin alanları null; model çağrılmaz', async () => {
    const { st, persistence } = memoryStore();
    mount(persistence);
    await makePlan();
    fireEvent.click(screen.getByLabelText('feed slot 1 kalsın'));
    await waitFor(() => expect((screen.getByTestId('save-draft') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('save-draft'));
    await waitFor(() => expect(screen.getByTestId('persist-status').textContent).toMatch(/Sunucuda kayıtlı sürüm 1/));
    expect(st.draft.feed.every((s: any) => s && s.text === null)).toBe(true);
    expect(st.draft.feed[0]).toMatchObject({ locked: true, text: null });
    expect(copy.calls).toHaveLength(0);
    // "kaydedildi" metin üretildi anlamına gelmez
    expect(status('feed', 0).textContent).toBe('Metin henüz üretilmedi');
  });

  it('METİNSİZ taslak YENİDEN YÜKLENİR: aynı görseller/Kalsın/kırpma, metin yok ("henüz üretilmedi"), otomatik model çağrısı yok', async () => {
    const { persistence } = memoryStore();
    const first = mount(persistence);
    await makePlan();
    fireEvent.click(screen.getByLabelText('feed slot 2 kalsın'));
    const ids = feedIds();
    await waitFor(() => expect((screen.getByTestId('save-draft') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('save-draft'));
    await waitFor(() => expect(screen.getByTestId('persist-status').textContent).toMatch(/Sunucuda kayıtlı sürüm 1/));
    first.unmount();
    cleanup();
    mount(persistence);
    await waitFor(() => expect(screen.getByTestId('persist-status').textContent).toMatch(/Kayıtlı taslak yüklendi \(sürüm 1\)/));
    expect(feedIds()).toEqual(ids);
    expect(within(screen.getByTestId('feed-slot-1')).getByText(/kalsın/)).toBeTruthy();
    expect(screen.queryAllByTestId(/^caption-\d$/)).toHaveLength(0);
    expect(status('feed', 0).textContent).toBe('Metin henüz üretilmedi');
    expect(copy.calls).toHaveLength(0);
    // yüklenmiş metinsiz taslağa sonradan metin üretilebilir
    await makeText();
    expect(screen.getAllByTestId(/^caption-\d$/)).toHaveLength(9);
  });

  it('"Taslağı kaydet" yalnız değişiklik varken açık; kaydedince sürüm görünür; istek tam kapsam taşır (kilit, model metni, kırpma, Story serisi)', async () => {
    const { st, persistence } = memoryStore();
    mount(persistence);
    const save = screen.getByTestId('save-draft') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await generate();
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
    expect(st.draft.feed[0]).toMatchObject({ locked: true, text: { source: 'model', lang: 'tr', responseId: expect.any(String), contentHash: expect.any(String), voiceSource: 'approved_bundle' }, crop: { zoom: 1.5 } });
    expect(st.draft.story[0]).toMatchObject({ format: 'story', seriesKey: 'A' });
    expect(st.draft.story[3]).toMatchObject({ seriesKey: 'B' });
    expect(st.draft.story[5].seriesKey).toBeNull();
    expect(st.draft.story[1].text).toMatchObject({ source: 'plan' });
    expect(save.disabled).toBe(true);
  });

  it('YENİDEN YÜKLEME: yeni oturum kayıtlı taslağı otomatik yükler; slotlar, model metinleri, Kalsın ve kırpma BİREBİR döner; model çağrılmaz', async () => {
    const { persistence } = memoryStore();
    const first = mount(persistence);
    await generate();
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
    await makePlan();
    st.version = 5;
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
    await makePlan();
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

describe('KALSIN YARIŞI: metin isteği sürerken kilitleme (async UI)', () => {
  /** copy.generate'i bir kapıya bağlar: kapı açılana kadar yanıt gelmez */
  const gateCopy = () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const real = (copy.generate as any).getMockImplementation();
    (copy.generate as any).mockImplementation(async (req: CopyRequest) => { await gate; return real(req); });
    return release;
  };

  it('metinsiz slot: istek sürerken Kalsın → geç yanıt kilitli slota YAZILMAZ; görsel, kilit korunur; neden söylenir', async () => {
    renderApp();
    await makePlan();
    const release = gateCopy();
    const image = feedIds()[0];
    fireEvent.click(screen.getByTestId('gen-feed:0'));
    await waitFor(() => expect(status('feed', 0).textContent).toMatch(/üretiliyor/));
    fireEvent.click(screen.getByLabelText('feed slot 1 kalsın'));
    expect(screen.getByLabelText('feed slot 1 kalsın işaretini kaldır').getAttribute('aria-pressed')).toBe('true');
    release();
    await waitFor(() => expect(screen.getByText(/Slot beklerken değişti, gelen metin yok sayıldı: Feed slot 1/)).toBeTruthy());
    await settle();
    expect(screen.queryByTestId('caption-0')).toBeNull();
    expect(feedIds()[0]).toBe(image);
    expect(screen.getByLabelText('feed slot 1 kalsın işaretini kaldır').getAttribute('aria-pressed')).toBe('true');
  });

  it('kilit istek sürerken AÇILIP KAPANSA bile eski yanıt geri yazamaz', async () => {
    renderApp();
    await makePlan();
    const release = gateCopy();
    fireEvent.click(screen.getByTestId('gen-feed:0'));
    await waitFor(() => expect(status('feed', 0).textContent).toMatch(/üretiliyor/));
    fireEvent.click(screen.getByLabelText('feed slot 1 kalsın'));
    fireEvent.click(screen.getByLabelText('feed slot 1 kalsın işaretini kaldır'));
    expect(screen.getByLabelText('feed slot 1 kalsın').getAttribute('aria-pressed')).toBe('false');
    release();
    await waitFor(() => expect(screen.getByText(/Slot beklerken değişti, gelen metin yok sayıldı: Feed slot 1/)).toBeTruthy());
    await settle();
    expect(screen.queryByTestId('caption-0')).toBeNull();
  });

  it('METİNLİ slot: "Metni yenile" sürerken Kalsın → geç yanıt mevcut kilitli metni EZMEZ', async () => {
    renderApp();
    await generate();
    const cap = caption(0);
    const release = gateCopy();
    fireEvent.click(screen.getByTestId('gen-feed:0')); // "Metni yenile"
    await waitFor(() => expect(status('feed', 0).textContent).toMatch(/üretiliyor/));
    fireEvent.click(screen.getByLabelText('feed slot 1 kalsın'));
    release();
    await waitFor(() => expect(screen.getByText(/Slot beklerken değişti, gelen metin yok sayıldı: Feed slot 1/)).toBeTruthy());
    await settle();
    expect(caption(0)).toBe(cap);
    expect(screen.getByLabelText('feed slot 1 kalsın işaretini kaldır')).toBeTruthy();
  });

  it('yarış yalnız kilitlenen slotu etkiler: aynı partideki kilitsiz slot metnini alır', async () => {
    renderApp();
    await makePlan();
    const release = gateCopy();
    fireEvent.click(screen.getByTestId('gen-text'));
    await waitFor(() => expect(status('feed', 0).textContent).toMatch(/üretiliyor/));
    fireEvent.click(screen.getByLabelText('feed slot 1 kalsın'));
    release();
    await settle();
    expect(screen.queryByTestId('caption-0')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('caption-1')).toBeTruthy());
    expect(screen.getByTestId('caption-8')).toBeTruthy();
  });

  it('kilit sonrası açık "Metin üret" (yeni sürümle) kilitli ama metinsiz slota yazar', async () => {
    renderApp();
    await makePlan();
    fireEvent.click(screen.getByLabelText('feed slot 1 kalsın'));
    fireEvent.click(screen.getByTestId('gen-feed:0'));
    await settle();
    await waitFor(() => expect(screen.getByTestId('caption-0')).toBeTruthy());
    expect(screen.getByLabelText('feed slot 1 kalsın işaretini kaldır').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Story: seri değişimi Kalsın işaretli karenin metnini SİLMEZ', () => {
  const storyText = (n: number) => screen.getByTestId(`story-slot-${n}`).querySelector('.storytext')?.textContent ?? '';

  it('kilitsiz kare: rol uymayınca metni boşalır (mevcut davranış korunur)', async () => {
    renderApp();
    await waitFor(() => expect(screen.getByTestId('story-slot-0')).toBeTruthy());
    expect(storyText(1)).toMatch(/Devam/);
    await waitFor(() => expect((screen.getByTestId('make-plan') as HTMLButtonElement).disabled).toBe(false));
    openMenu('story', 1);
    choose('Başka adayla değiştir');
    expect(roleOf(1)).toBe('headline');
    expect(storyText(1)).not.toMatch(/Devam/);
  });

  it('Kalsın işaretli kare: seri değişse de metni KORUNUR ve uyumsuzluk açıkça söylenir; kilitsiz komşu etkilenmez', async () => {
    renderApp();
    await waitFor(() => expect(screen.getByTestId('story-slot-0')).toBeTruthy());
    await waitFor(() => expect((screen.getByTestId('make-plan') as HTMLButtonElement).disabled).toBe(false));
    const before = storyText(1);
    expect(before).toMatch(/Devam/);
    fireEvent.click(screen.getByLabelText('story slot 2 kalsın'));
    openMenu('story', 1);
    choose('Başka adayla değiştir');
    expect(roleOf(1)).toBe('headline');
    expect(storyText(1)).toBe(before);
    expect(screen.getByText(/Kalsın işaretli karenin metni korundu/)).toBeTruthy();
    expect(screen.getByLabelText('story slot 2 kalsın işaretini kaldır').getAttribute('aria-pressed')).toBe('true');
    expect(copy.calls).toHaveLength(0);
  });
});
