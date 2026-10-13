import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, cleanup } from '@testing-library/react';
import PostPlanner from '@/studio/feedPlanner/post/PostPlanner';
import { reviewPorts, type CopyPort, type PlannerPorts } from '@/studio/feedPlanner/ports';
import type { CopyRequest } from '@/shared/planner/copyContract';
import type { Candidate } from '@/studio/feedPlanner/types';
import { VISUAL_SCHEMA_VERSION } from '@/shared/planner/visualDecision';
import { visual } from '../helpers/visualFixture';
import { aest, cand } from './helpers';

// Gerçek bileşen + gerçek motor/puanlayıcı. Taklit: kırpılmış piksel ölçümü (measureCrop) ve metin portu (model YOK).
const pool = (n: number, extra: Partial<Candidate> = {}): Candidate[] =>
  Array.from({ length: n }, (_, i) => cand(`p${String(i).padStart(2, '0')}`, { brand: 'dieci', dims: { w: 1080, h: 1350 }, imageKey: `img-${i}`, group: ['pizza', 'makarna', 'mekan_atmosfer'][i % 3], ...extra }));
const measureCrop = vi.fn(async () => aest());
let seq = 0;
const fakeCopy = (over: Partial<CopyPort> = {}): CopyPort & { calls: CopyRequest[] } => {
  const calls: CopyRequest[] = [];
  return {
    available: true,
    calls,
    generate: vi.fn(async (req: CopyRequest) => {
      calls.push(req);
      return {
        accepted: req.items.map((it) => ({ slotKey: it.slotKey, mediaId: it.mediaId, role: it.role, text: { caption: `Test metni ${++seq} ${it.mediaId}` }, evidenceBasis: 'katalog_gozlem' as const, rationale: 'test', observation: 'gözlem', contentHash: String(seq).padStart(32, '0'), warnings: [], ...(it.crop ? { crop: { version: it.crop.version, facts: 'tam' as const } } : {}) })),
        rejected: [], notes: [], model: 'test', promptVersion: 'plan-copy-v1', responseId: `resp-${seq}`,
        voice: { source: 'approved_bundle' as const, tone: null, guideVersion: null, assumptions: [], tempToneIgnored: false },
      };
    }),
    ...over,
  } as CopyPort & { calls: CopyRequest[] };
};
let copy: ReturnType<typeof fakeCopy>;
const creativeRun = vi.fn();
const portsOf = (): PlannerPorts => ({ ...reviewPorts(), mode: 'studio', copy, creative: { available: true, run: creativeRun }, persistence: null });
let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy); copy = fakeCopy(); creativeRun.mockReset(); measureCrop.mockClear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const renderPlanner = (candidates: Candidate[], props: Partial<React.ComponentProps<typeof PostPlanner>> = {}) =>
  render(<PostPlanner candidates={candidates} ports={portsOf()} projectId="dieci" tenantId="t1" weekStart="2026-10-12" measureCrop={measureCrop} voice={{ approved: true }} {...props} />);
/** Boş yüzeyde sayı alanı yoktur: N, `initialCount` ile verilir; "Yeni post planı oluştur" tıklanır. */
const plan = async () => {
  const btn = screen.getByTestId('post-plan-btn') as HTMLButtonElement;
  await waitFor(() => expect(btn.disabled).toBe(false));
  fireEvent.click(btn);
};
const cells = () => Array.from(document.querySelectorAll('[data-testid^="post-cell-"]')) as HTMLElement[];
const cellIds = () => cells().map((c) => c.getAttribute('data-testid')!.replace('post-cell-', ''));
const assetsNow = () => cells().map((c) => c.getAttribute('data-asset')!);
/** Düzenleme düğmeleri YALNIZ seçili postta açılır: kullanıcı gibi önce postu seçer. */
const btn = (name: string | RegExp) => {
  const m = typeof name === 'string' ? /^(p\d+) / .exec(name) : null;
  if (m && !screen.queryByRole('button', { name })) fireEvent.click(within(cellOf(m[1])).getByLabelText(`${m[1]} incele`));
  return screen.getByRole('button', { name });
};
const cellOf = (id: string) => screen.getByTestId(`post-cell-${id}`);

describe('sade yüzey: boş ekran tek eylem; düzenleme yalnız seçili postta', () => {
  it('boş Post ekranı yalnız "Yeni post planı oluştur" gösterir (sayı, hafta, rehber, ton, Metin üret, teknik duvar YOK); plan sonrası Metin üret ve sayı kontrolü çıkar', async () => {
    renderPlanner(pool(10), { initialCount: 4 });
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Yeni post planı oluştur']);
    for (const id of ['post-count', 'bulk-open', 'post-tone-panel', 'post-visual-done', 'post-text-panel', 'post-capacity', 'post-plan-score']) expect(screen.queryByTestId(id), id).toBeNull();
    expect(screen.queryByText(/hafta|rehber|SNAPSHOT|rubric|sürüm/i)).toBeNull();
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(4));
    expect(screen.getByTestId('bulk-open').textContent).toBe('Metin üret');
    expect(screen.getByTestId('post-count')).toBeTruthy();
  });

  it('düzenleme düğmeleri (kilit/değiştir/ele/sil/sırala) seçili değilken YOKTUR; postu seçince yalnız o postta açılır', async () => {
    renderPlanner(pool(10), { initialCount: 4 });
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(4));
    expect(screen.queryByRole('button', { name: 'p1 sil' })).toBeNull();
    expect(screen.queryByTestId('post-actions-p1')).toBeNull();
    fireEvent.click(within(cellOf('p1')).getByLabelText('p1 incele'));
    expect(screen.getByRole('button', { name: 'p1 sil' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'p2 sil' })).toBeNull();
    fireEvent.click(within(cellOf('p2')).getByLabelText('p2 incele'));
    expect(screen.queryByRole('button', { name: 'p1 sil' })).toBeNull();
    expect(screen.getByRole('button', { name: 'p2 sil' })).toBeTruthy();
  });
});

describe('N post, kısmi satır, kapasite, marka izolasyonu (UI)', () => {
  it('N=7: 7 post, son sıra kısmi (1/3); planlama model ve ağ çağırmaz; metin yok', async () => {
    renderPlanner(pool(14), { initialCount: 7 });
    expect((screen.getByTestId('post-plan-btn') as HTMLButtonElement).textContent).toBe('Yeni post planı oluştur');
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(7));
    expect(screen.getByText(/Plan düzeni · profil sırası \(yeni → eski\) · 7 post · son sıra kısmi \(1\/3\)/)).toBeTruthy();
    expect(new Set(assetsNow()).size).toBe(7);
    expect(copy.generate).not.toHaveBeenCalled();
    expect(creativeRun).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryAllByTestId(/^post-text-p\d+$/)).toHaveLength(0);
    expect(screen.getByTestId('post-plan-score').textContent).toMatch(/Plan uyumu/);
  });

  it('N=9: tam satırlar (kısmi uyarısı yok); aday azlığı: 4 aday / N=7 → 4 post ve açık kapasite bilgisi, tekrar yok', async () => {
    renderPlanner(pool(14), { initialCount: 9 });
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(9));
    expect(screen.getByText(/9 post$/)).toBeTruthy();
    cleanup();
    renderPlanner(pool(4), { initialCount: 7 });
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(4));
    expect(new Set(assetsNow()).size).toBe(4);
    expect(screen.getByTestId('post-capacity').textContent).toMatch(/İstenen 7 post; yalnız 4 uygun görsel var\. Eksik 3 post sahte veya tekrarlı görselle DOLDURULMADI/);
    expect(screen.getByTestId('post-messages').textContent).toMatch(/DOLDURULMADI/);
  });

  it('MARKA İZOLASYONU: başka marka / yayımlanmış adaylar plana girmez; geçmiş yalnız aynı markadan', async () => {
    const own = pool(3);
    const foreign = pool(4).map((c) => ({ ...c, id: `x-${c.id}`, brand: 'baska' }));
    const pub = [cand('h1', { brand: 'dieci', published: true, origin: 'history', date: '2026-09-01' }), cand('h2', { brand: 'baska', published: true, origin: 'history', date: '2026-09-02' })];
    renderPlanner([...own, ...foreign], { published: pub, initialCount: 9 });
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(3));
    expect(assetsNow().sort()).toEqual(['p00', 'p01', 'p02']);
    const profile = screen.getByTestId('view-profile');
    expect(profile.querySelector('[data-asset="h1"]')).toBeTruthy();
    expect(profile.querySelector('[data-asset="h2"]')).toBeNull();
  });

  it('ölçüm bitmeden plan düğmesi KAPALI; ölçüm NİHAİ 4:5 pencereyle istenir (tam kare değil), geçmiş tam kareyle', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow = vi.fn(async (_u: string, w: any) => { await gate; return aest({ brightness: w ? 0.3 : 0.7 }); });
    renderPlanner(pool(3), { measureCrop: slow, published: [cand('h1', { brand: 'dieci', published: true, origin: 'history' })] });
    expect((screen.getByTestId('post-plan-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('post-measure-progress').textContent).toMatch(/\(0\/4\)/);
    release();
    await waitFor(() => expect((screen.getByTestId('post-plan-btn') as HTMLButtonElement).disabled).toBe(false));
    const calls = slow.mock.calls as unknown as Array<[string, any]>;
    const crops = calls.filter(([u]) => u.includes('img-'));
    expect(crops.length).toBe(3);
    for (const [, w] of crops) expect((w.w * 1080) / (w.h * 1350)).toBeCloseTo(0.8, 5); // 4:5 pencere
    expect(calls.filter(([, w]) => w === null)).toHaveLength(1); // yalnız mevcut yayın tam karede
  });
});

describe('iki kilit, değiştir/ele, sil (UI)', () => {
  it('İKİ AYRI KİLİT: "Görseli koru" yalnız görseli tutar (konum serbest); "Yerini de koru" ikisini tutar; kilitliyken değiştir/ele/sil kapalı', async () => {
    renderPlanner(pool(10), { initialCount: 4 });
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(4));
    const id = cellIds()[1];
    expect(screen.getByTestId(`post-lockstate-${id}`).textContent).toBe('Kilit yok');
    fireEvent.click(btn(`${id} görseli koru`));
    expect(screen.getByTestId(`post-lockstate-${id}`).textContent).toBe('Görsel kilitli · konum serbest');
    expect(cellOf(id).getAttribute('data-asset-lock')).toBe('true');
    expect(cellOf(id).getAttribute('data-pos-lock')).toBe('false');
    for (const name of ['değiştir', 'ele ve yenisini getir', 'sil']) expect((btn(`${id} ${name}`) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn(`${id} yerini de koru`));
    expect(screen.getByTestId(`post-lockstate-${id}`).textContent).toBe('Görsel + konum kilitli');
    expect(cellOf(id).getAttribute('data-pos-lock')).toBe('true');
    // görsel kilidi kalkınca konum kilidi de kalkar
    fireEvent.click(btn(`${id} görseli koru`));
    expect(screen.getByTestId(`post-lockstate-${id}`).textContent).toBe('Kilit yok');
  });

  it('DEĞİŞTİR ve ELE post sayısını korur; kimlik aynı, görsel farklı; Geri al eski görseli döndürür; sıfır model çağrısı', async () => {
    renderPlanner(pool(10), { initialCount: 4 });
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(4));
    const before = assetsNow();
    const id = cellIds()[2];
    fireEvent.click(btn(`${id} değiştir`));
    expect(cells()).toHaveLength(4);
    expect(cellIds()[2]).toBe(id);
    expect(assetsNow()[2]).not.toBe(before[2]);
    fireEvent.click(btn(`${id} ele ve yenisini getir`));
    expect(cells()).toHaveLength(4);
    expect(new Set(assetsNow()).size).toBe(4);
    expect(screen.getByTestId('post-lastchange').textContent).toMatch(/Son işlem: Ele ve yenisini getir/);
    fireEvent.click(screen.getByTestId('post-undo'));
    fireEvent.click(screen.getByTestId('post-undo'));
    expect(assetsNow()).toEqual(before);
    expect(copy.generate).not.toHaveBeenCalled();
    expect(creativeRun).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('SİL post sayısını düşürür ve kendiliğinden yeni görsel EKLEMEZ; önce/sonra önizlemesi ve Geri al', async () => {
    renderPlanner(pool(10), { initialCount: 5 });
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(5));
    const ids0 = cellIds();
    fireEvent.click(btn(`${ids0[1]} sil`));
    expect(cells()).toHaveLength(4);
    expect(cellIds()).toEqual([ids0[0], ids0[2], ids0[3], ids0[4]]);
    const last = screen.getByTestId('post-lastchange');
    expect(within(last).getByTestId('lastchange-before').querySelectorAll('[data-kind="plan"]')).toHaveLength(5);
    expect(within(last).getByTestId('lastchange-after').querySelectorAll('[data-kind="plan"]')).toHaveLength(4);
    expect(screen.getByTestId('post-capacity').textContent).toMatch(/planda 4/);
    fireEvent.click(screen.getByTestId('post-undo'));
    expect(cellIds()).toEqual(ids0);
  });

  it('SİLME ↔ KONUM KİLİDİ ÇATIŞMASI: önizleme + seçenekler; Vazgeç hiçbir şeyi değiştirmez; onay konum kilidini kaldırıp siler; Geri al kilidi döndürür', async () => {
    renderPlanner(pool(10), { initialCount: 4 });
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(4));
    const ids0 = cellIds();
    fireEvent.click(btn(`${ids0[3]} görseli koru`));
    fireEvent.click(btn(`${ids0[3]} yerini de koru`));
    fireEvent.click(btn(`${ids0[0]} sil`));
    const dlg = screen.getByTestId('post-conflict');
    expect(dlg.textContent).toMatch(/Silme, konum kilidiyle çatışıyor/);
    expect(dlg.textContent).toMatch(/Hiçbir şey değişmedi/);
    expect(within(dlg).getByTestId('conflict-before').querySelectorAll('[data-kind="plan"]')).toHaveLength(4);
    expect(within(dlg).getByTestId('conflict-after').querySelectorAll('[data-kind="plan"]')).toHaveLength(3);
    expect(cells()).toHaveLength(4); // henüz değişmedi
    fireEvent.click(screen.getByTestId('conflict-cancel'));
    expect(screen.queryByTestId('post-conflict')).toBeNull();
    expect(cellIds()).toEqual(ids0);
    expect(cellOf(ids0[3]).getAttribute('data-pos-lock')).toBe('true');
    // yeniden başlat ve onayla
    fireEvent.click(btn(`${ids0[0]} sil`));
    fireEvent.click(screen.getByTestId('conflict-release'));
    expect(screen.queryByTestId('post-conflict')).toBeNull();
    expect(cells()).toHaveLength(3);
    expect(cellOf(ids0[3]).getAttribute('data-pos-lock')).toBe('false');
    expect(cellOf(ids0[3]).getAttribute('data-asset-lock')).toBe('true'); // görsel kilidi korundu
    fireEvent.click(screen.getByTestId('post-undo'));
    expect(cellIds()).toEqual(ids0);
    expect(cellOf(ids0[3]).getAttribute('data-pos-lock')).toBe('true');
  });

  it('çatışma YOKSA önizleme sorulmaz: konum kilitli post başka yerde kalır', async () => {
    renderPlanner(pool(10), { initialCount: 5 });
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(5));
    const ids0 = cellIds();
    fireEvent.click(btn(`${ids0[1]} görseli koru`));
    fireEvent.click(btn(`${ids0[1]} yerini de koru`));
    fireEvent.click(btn(`${ids0[4]} sil`));
    expect(screen.queryByTestId('post-conflict')).toBeNull();
    expect(cells()).toHaveLength(4);
    expect(cellIds()[1]).toBe(ids0[1]);
  });

  it('Post ekle sayıyı artırır (sona); sıra butonları kilitli olmayanı taşır; Sırayı iyileştir kilitliyi sabit tutar', async () => {
    renderPlanner(pool(10), { initialCount: 3 });
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(3));
    const ids0 = cellIds();
    fireEvent.click(screen.getByTestId('post-add'));
    expect(cells()).toHaveLength(4);
    expect(cellIds().slice(0, 3)).toEqual(ids0);
    fireEvent.click(btn(`${ids0[1]} öne al`));
    expect(cellIds().slice(0, 2)).toEqual([ids0[1], ids0[0]]);
    fireEvent.click(btn(`${ids0[1]} görseli koru`));
    fireEvent.click(btn(`${ids0[1]} yerini de koru`));
    fireEvent.click(btn(`${ids0[0]} öne al`));
    expect(screen.getByTestId('post-messages').textContent).toMatch(/Konum kilitli post yerinden oynatılamaz/);
  });
});

describe('yayın sırası ve profil görünümü (UI)', () => {
  const hist = () => [
    cand('h-a', { brand: 'dieci', published: true, origin: 'history', date: '2026-09-30', imageKey: 'ha' }),
    cand('h-b', { brand: 'dieci', published: true, origin: 'history', date: '2026-08-01', imageKey: 'hb' }),
    cand('h-c', { brand: 'dieci', published: true, origin: 'history', imageKey: 'hc' }),
  ];

  it('kronolojik sıra profil sırasının tersidir; profil görünümü plan + SNAPSHOT geçmişi birleştirir; yeni gönderi başa gelir; snapshot etiketi tarihli', async () => {
    renderPlanner(pool(8), { published: hist(), historySource: "Instagram arşivi snapshot'ı", initialCount: 4 });
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(4));
    const planAssets = assetsNow();
    const chrono = Array.from(screen.getByTestId('view-chrono').querySelectorAll('.item')).map((e) => [e.getAttribute('data-order'), e.getAttribute('data-asset')]);
    expect(chrono.map(([o]) => o)).toEqual(['1', '2', '3', '4']);
    expect(chrono.map(([, a]) => a)).toEqual([...planAssets].reverse()); // ilk yayın = profil sırasının sonu
    const prof = () => Array.from(screen.getByTestId('view-profile').querySelectorAll('[role="listitem"]')).map((e) => e.getAttribute('data-asset'));
    expect(prof()).toEqual([...planAssets, 'h-a', 'h-b', 'h-c']); // geçmiş en yeni önce, tarihsiz sonda
    expect(screen.getByTestId('profile-shape').textContent).toMatch(/Profil: 7 hücre, 3 sıra; son sıra kısmi \(1\/3\)/);
    expect(screen.getByTestId('profile-shape').textContent).toMatch(/Plan bloğu: 2 sıra, son sıra kısmi \(1\/3\) — mevcut yayınlar bu sırayı tamamlar/);
    expect(screen.getByTestId('snapshot-label').textContent).toMatch(/Mevcut yayınlar = geçmiş SNAPSHOT\. Instagram arşivi snapshot'ı: 3 gönderi, bilinen en yeni tarih 2026-09-30\. CANLI veri değildir/);
    expect(screen.getByTestId('view-profile').querySelector('[data-asset="h-a"]')!.getAttribute('title')).toMatch(/snapshot · 2026-09-30/);
    expect(screen.getByTestId('view-profile').querySelector('[data-asset="h-c"]')!.getAttribute('title')).toMatch(/tarih bilinmiyor/);
    // yayın adımı: ilk 2 post yayınlandıktan sonra profil
    fireEvent.change(screen.getByTestId('profile-step'), { target: { value: '2' } });
    const chronoAssets = chrono.map(([, a]) => a);
    expect(prof()).toEqual([chronoAssets[1], chronoAssets[0], 'h-a', 'h-b', 'h-c']); // yeni gönderi BAŞTA, öncekiler kaydı
    fireEvent.change(screen.getByTestId('profile-step'), { target: { value: '0' } });
    expect(prof()).toEqual(['h-a', 'h-b', 'h-c']);
    expect(screen.getByTestId('views-explain').textContent).toMatch(/yayın sırası KRONOLOJİKTİR.*profil gridinde ise her yeni gönderi BAŞA/i);
  });

  it('geçmiş yoksa dürüst not: "mevcut yayın geçmişi bağlı değil"; önizleme canlıya hiçbir şey göndermez', async () => {
    renderPlanner(pool(5), { initialCount: 3 });
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(3));
    expect(screen.getByTestId('snapshot-label').textContent).toMatch(/mevcut yayın geçmişi bağlı değil/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('kırpım paneli: sürümlü manuel kırpım, orijinal korunur, görünür olgular (UI)', () => {
  const landscape = (n: number) => pool(n, { dims: { w: 4000, h: 3000 } });
  const withVisual = (c: Candidate): Candidate => ({
    ...c,
    visual: {
      decision: visual({ subject: { box: { x: 0.7, y: 0.3, w: 0.2, h: 0.4 }, boxConfidence: 'yüksek', scale: 'orta' } }),
      provenance: { tenantId: 't1', projectId: 'dieci', assetId: c.id, analysisKey: `k-${c.id}`, sourceSha256: 's', analyzedAt: 1, model: 'm', promptVersion: 'p', schemaVersion: '3', visualSchemaVersion: VISUAL_SCHEMA_VERSION, visualPromptVersion: 'v', sourceQuality: 'original', geometryBasis: 'original' },
    },
  });

  it('kırpım sürümü artar, yalnız o varlık yeniden ölçülür (diğerleri dokunulmaz); orijinal kaynak boyutu değişmez; çıktı 1080×1350', async () => {
    renderPlanner(landscape(6), { initialCount: 3 });
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(3));
    const first = measureCrop.mock.calls.length;
    const ids0 = cellIds();
    fireEvent.click(within(cellOf(ids0[0])).getByLabelText(`${ids0[0]} incele`));
    const panel = screen.getByTestId('post-crop-panel');
    expect(panel.textContent).toMatch(/Kaynak: 4000×3000 \(değişmez\) → çıktı 1080×1350 \(4:5\)/);
    expect(screen.getByTestId('post-crop-version').textContent).toMatch(/Kırpım sürümü: 0 · otomatik/);
    fireEvent.change(screen.getByLabelText('Yakınlaştırma'), { target: { value: '1.8' } });
    expect(screen.getByTestId('post-crop-version').textContent).toMatch(/Kırpım sürümü: 1/);
    await waitFor(() => expect(measureCrop.mock.calls.length).toBe(first + 1)); // yalnız seçili varlık
    const urls = (measureCrop.mock.calls as unknown as Array<[string, any]>).slice(first).map(([u]) => u);
    expect(urls).toHaveLength(1);
    fireEvent.click(screen.getByTestId('post-crop-auto'));
    expect(screen.getByTestId('post-crop-version').textContent).toMatch(/Kırpım sürümü: 2 · otomatik \(sıfırlandı\)/);
    expect(cellOf(ids0[0]).querySelector('[data-testid="cropped"]')).toBeTruthy();
  });

  it('caption için görünür olgu kapsamı: konu kırpımda görünürse "yalnız ana konu"; manuel kırpım konuyu dışarıda bırakırsa "görünür olgu yok" ve nedeni', async () => {
    renderPlanner(landscape(4).map(withVisual), { initialCount: 2 });
    await plan();
    await waitFor(() => expect(cells()).toHaveLength(2));
    const id = cellIds()[0];
    fireEvent.click(within(cellOf(id)).getByLabelText(`${id} incele`));
    expect(screen.getByTestId('post-visibility').textContent).toMatch(/yalnız ana konu.*ana konu kırpımda görünür; kırpım dışında kalan ayrıntılar görünen gerçek sayılmaz/);
    const frame = screen.getByTestId('post-cropframe');
    frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    fireEvent.click(frame, { clientX: 5, clientY: 50 }); // odak sol kenara → pencere [0, 0.6]; konu (x 0.7–0.9) dışarıda
    expect(screen.getByTestId('post-visibility').textContent).toMatch(/görünür olgu yok.*ana konu kırpım dışında/);
    expect(screen.getByTestId('post-crop-version').textContent).toMatch(/Kırpım sürümü: 1 · manuel/);
  });
});
