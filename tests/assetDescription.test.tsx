import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

const api = vi.hoisted(() => ({ getMediaAnalysis: vi.fn(), runMediaAnalysis: vi.fn(), getCanvaSync: vi.fn(), runCanvaSync: vi.fn(), saveCatalogCorrection: vi.fn(), notifyMediaUploadComplete: vi.fn() }));
vi.mock('@/studio/mediaIntegrationsApi', async (orig) => ({ ...(await orig<any>()), ...Object.fromEntries(Object.entries(api).map(([k, f]) => [k, (...a: any[]) => (f as any)(...a)])) }));
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: vi.fn() }));

import { AssetDescription } from '@/studio/components/AssetDescription';
import { visual as visualFixture, unknownVisual } from './helpers/visualFixture';

const NOW = 1_760_000_000_000;
const catalog = {
  subject: 'masada tatlı tabağı',
  description: 'Beyaz tabakta çikolatalı bir tatlı görünüyor.',
  tags: ['tatlı', 'çikolata'],
  visibleObjects: ['tabak', 'çatal'],
  foodCategories: ['tatlı'],
  composition: { shotType: 'yakın_çekim', orientation: 'yatay', hasTextOverlay: false, subjectPlacement: 'merkez', negativeSpace: true },
  productIdentity: { status: 'genel_kategori', note: 'Yalnız tatlı kategorisi görünüyor' },
  usageSuggestions: ['feed', 'ürün_tanıtımı'],
  peoplePresent: false,
  uncertainties: ['içerik görünmüyor'],
  planningNotes: ['Üst kısım yazıya uygun'],
  overallConfidence: 'orta',
};
const record = (over: any = {}) => ({
  key: 'k1', tenantId: 't1', projectId: 'p1', sourceId: 'a1', status: 'done', model: 'claude-haiku-5-5', promptVersion: 'media-catalog-v2', schemaVersion: '2',
  sourceQuality: 'original', createdAt: 1760000000000, updatedAt: 1760000100000, result: catalog, ...over,
});
const job = (over: any = {}) => ({ state: 'pending', attempts: 0, maxAttempts: 3, nextAttemptAt: NOW - 1000, leaseActive: false, leaseUntil: null, lastError: null, analysisKey: null, createdAt: NOW - 5000, updatedAt: NOW - 4000, ...over });
/** Sunucu GET yanıt biçimi (tüm alanlar); `over` ile durum başına ezilir */
const resp = (over: any = {}, scope = { tenantId: 't1', projectId: 'p1', assetId: 'a1' }) => ({
  enabled: true, scope, serverNow: NOW, analysis: null,
  queue: { state: 'ok', job: null }, correction: { state: 'ok', value: null }, effective: null, products: { state: 'none', items: [] },
  ...over,
});
const human = (over: any = {}) => ({ overrides: { subject: 'İnsan konusu', description: 'İnsan açıklaması' }, verifiedProductIds: [], note: 'Şef doğruladı', correctedAt: 1760000200000, ...over });
const view = (p = 'p1', a = 'a1', t = 't1') => render(<AssetDescription tenantId={t} projectId={p} assetId={a} />);

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
afterEach(() => cleanup());
const noWrites = () => {
  expect(api.runMediaAnalysis).not.toHaveBeenCalled();
  expect(api.runCanvaSync).not.toHaveBeenCalled();
  expect(api.saveCatalogCorrection).not.toHaveBeenCalled();
  expect(api.notifyMediaUploadComplete).not.toHaveBeenCalled();
};

describe('fotoğraf detayı: kayıtlı görsel tanımı (yalnız okuma)', () => {
  it('tamamlanmış analiz: AI gözlemi etiketli; ürün, belirsizlik, kadraj ve kaynak AYRI bölümlerde; yalnız GET', async () => {
    api.getMediaAnalysis.mockResolvedValue(resp({ analysis: record() }));
    view();
    await waitFor(() => expect(screen.getByTestId('desc-semantic')).toBeTruthy());
    const sem = screen.getByTestId('desc-semantic');
    expect(sem.textContent).toMatch(/Beyaz tabakta çikolatalı bir tatlı görünüyor\./);
    expect(sem.querySelector('[data-source="human"]')).toBeNull();
    expect(screen.getByTestId('desc-uncertainty').textContent).toMatch(/içerik görünmüyor/);
    expect(screen.getByTestId('desc-product').textContent).toMatch(/AI'nın ürün gözlemi \(görüntüden\): Yalnız genel kategori görünüyor/);
    expect(screen.getByTestId('desc-no-verified').textContent).toMatch(/AI ürün adı tahmin etmez/);
    expect(screen.getByTestId('desc-measure').textContent).toMatch(/AI kadraj gözlemi \(sayısal ölçüm değil\): yakın çekim/);
    expect(screen.getByTestId('desc-measure').textContent).toMatch(/caption\) görsel tanımı değildir/);
    expect(screen.getByTestId('desc-provenance').textContent).toMatch(/claude-haiku-5-5 · istem media-catalog-v2 · şema 2 · orijinal dosyadan/);
    expect(screen.queryByTestId('desc-human')).toBeNull();
    expect(api.getMediaAnalysis).toHaveBeenCalledTimes(1);
    expect(api.getMediaAnalysis).toHaveBeenCalledWith('p1', 'a1');
    noWrites();
    expect(screen.queryByRole('button', { name: /analiz et/i })).toBeNull();
  });

  describe('AÇIK 1: gerçek kuyruk durumu', () => {
    it('PENDING kuyruk + analiz kaydı YOK: "kuyrukta, işlenmeyi bekliyor" der; "kayıt ve kuyruk işi yok" DEMEZ', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp({ queue: { state: 'ok', job: job() } }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-queue')).toBeTruthy());
      const q = screen.getByTestId('desc-queue');
      expect(q.getAttribute('data-state')).toBe('queued');
      expect(q.textContent).toMatch(/kuyrukta, işlenmeyi bekliyor \(deneme 0\/3\)/);
      expect(q.textContent).toMatch(/AI analiz kaydı henüz yok/);
      expect(screen.queryByTestId('desc-missing')).toBeNull();
      noWrites();
    });

    it('LEASE geçerli: "şu anda işleniyor" (kilit zamanıyla); sonuç yok', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp({ queue: { state: 'ok', job: job({ attempts: 1, leaseActive: true, leaseUntil: NOW + 60_000 }) } }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-queue').getAttribute('data-state')).toBe('processing'));
      expect(screen.getByTestId('desc-queue').textContent).toMatch(/şu anda işleniyor \(deneme 1\/3; kilit .* tarihine kadar\)/);
      expect(screen.queryByTestId('desc-semantic')).toBeNull();
    });

    it('lease süresi dolmuş + sonraki deneme zamanı gelecekte: "yeniden deneme bekleniyor" (işleniyor DEĞİL)', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp({ queue: { state: 'ok', job: job({ attempts: 1, nextAttemptAt: NOW + 300_000, lastError: { code: 'http_529', message: 'Model meşgul' } }) } }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-queue').getAttribute('data-state')).toBe('retry_wait'));
      expect(screen.getByTestId('desc-queue').textContent).toMatch(/Yeniden deneme bekleniyor.*Model meşgul \(http_529\)/);
    });

    it('kuyruk FAILED: başarısız, otomatik yeniden deneme yok, hata gösterilir', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp({ queue: { state: 'ok', job: job({ state: 'failed', attempts: 3, lastError: { code: 'source_error', message: 'Kaynak okunamadı' } }) } }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-queue').getAttribute('data-state')).toBe('failed'));
      expect(screen.getByTestId('desc-queue').textContent).toMatch(/başarısız oldu \(deneme 3\/3\); otomatik yeniden deneme yok.*Kaynak okunamadı \(source_error\)/);
      expect(screen.queryByRole('button', { name: /analiz|yeniden dene/i })).toBeNull();
    });

    it('kuyruk SKIPPED: atlandı (başarısızlık değil)', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp({ queue: { state: 'ok', job: job({ state: 'skipped', lastError: { code: 'not_active_photo', message: 'Varlık analize uygun değil' } }) } }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-queue').getAttribute('data-state')).toBe('skipped'));
      expect(screen.getByTestId('desc-queue').textContent).toMatch(/atlandı.*Varlık analize uygun değil/);
    });

    it('kuyruk DONE ama analiz kaydı yok: tutarsızlık dürüstçe söylenir (başarı gösterilmez)', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp({ queue: { state: 'ok', job: job({ state: 'done', analysisKey: null }) } }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-queue').getAttribute('data-state')).toBe('done'));
      expect(screen.getByTestId('desc-queue').textContent).toMatch(/AI analiz kaydı henüz yok/);
      expect(screen.queryByTestId('desc-semantic')).toBeNull();
    });

    it('kuyruk OKUNAMADI + kayıt yok: "iş yok" DENMEZ; okunamadı uyarısı; kesin-yok metni görünmez', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp({ queue: { state: 'unavailable' } }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-queue-unavailable')).toBeTruthy());
      expect(screen.getByTestId('desc-queue-unavailable').textContent).toMatch(/Kuyruk durumu okunamadı/);
      expect(screen.queryByTestId('desc-missing')).toBeNull();
    });

    it('kuyruk iş YOK (kesin) + kayıt yok → "kayıt ve kuyruk işi yok"', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp());
      view();
      await waitFor(() => expect(screen.getByTestId('desc-missing')).toBeTruthy());
      expect(screen.getByTestId('desc-missing').textContent).toMatch(/kayıtlı AI analizi ve kuyruk işi yok/);
      expect(screen.queryByTestId('desc-queue')).toBeNull();
    });

    it('analiz KAPALI ve kuyrukta bekleyen iş: kapalıyken işlenmeyeceği söylenir', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp({ enabled: false, queue: { state: 'ok', job: job() } }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-queue')).toBeTruthy());
      expect(screen.getByTestId('desc-disabled')).toBeTruthy();
      expect(screen.getByTestId('desc-queue').textContent).toMatch(/kapalı olduğu sürece işlenmez/);
    });

    it('kayıt VAR ve kuyruk bekliyor (ör. yeniden deneme): mevcut kayıt gösterilir + kuyruk notu ayrıca durur', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp({ analysis: record({ status: 'failed', result: null, retryable: true, error: { code: 'http_529', message: 'Model meşgul' } }), queue: { state: 'ok', job: job({ attempts: 1, nextAttemptAt: NOW + 60_000 }) } }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-failed')).toBeTruthy());
      expect(screen.getByTestId('desc-queue').textContent).toMatch(/Kuyruk: Yeniden deneme bekleniyor/);
    });

    it('"Yeniden oku" yalnız GET tekrarlar (kuyruk işleme/analiz başlatma yok)', async () => {
      api.getMediaAnalysis.mockResolvedValueOnce(resp({ queue: { state: 'ok', job: job({ leaseActive: true, leaseUntil: NOW + 1000 }) } }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-queue')).toBeTruthy());
      api.getMediaAnalysis.mockResolvedValueOnce(resp({ analysis: record(), queue: { state: 'ok', job: job({ state: 'done', analysisKey: 'k1' }) } }));
      fireEvent.click(screen.getByRole('button', { name: 'Yeniden oku' }));
      await waitFor(() => expect(screen.getByTestId('desc-semantic')).toBeTruthy());
      expect(api.getMediaAnalysis).toHaveBeenCalledTimes(2);
      noWrites();
    });
  });

  describe('AÇIK 2: insan açıklaması AI yokken de görünür', () => {
    it('AI analizi YOK: insan konu/açıklama/not/tarih görünür; AI bölümü ve AI tanımı UYDURULMAZ', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp({ correction: { state: 'ok', value: human() }, effective: { catalog: null, sources: { subject: 'human', description: 'human' }, verifiedProductIds: [] } }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-human')).toBeTruthy());
      const h = screen.getByTestId('desc-human');
      expect(h.textContent).toMatch(/Konu: İnsan konusu/);
      expect(h.textContent).toMatch(/Açıklama: İnsan açıklaması/);
      expect(h.textContent).toMatch(/Not: Şef doğruladı/);
      expect(h.textContent).toMatch(/Düzeltme tarihi:/);
      expect(h.querySelectorAll('[data-source="human"]').length).toBe(2);
      expect(h.querySelector('[data-source="ai"]')).toBeNull();
      expect(screen.queryByTestId('desc-semantic')).toBeNull();
      expect(screen.getByTestId('desc-missing')).toBeTruthy(); // AI tarafı hâlâ "yok": insan bilgisi onu doldurmaz
      expect(screen.getByTestId('desc-measure').textContent).toMatch(/Kayıtlı AI kadraj gözlemi yok/);
    });

    it('AI + insan: insan bölümü ayrı; AI ham değeri korunur ve "insan düzeltmesi geçerli" notu alır; sınır açık', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp({ analysis: record(), correction: { state: 'ok', value: human() } }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-human')).toBeTruthy());
      const ai = screen.getByTestId('desc-semantic');
      expect(ai.textContent).toMatch(/Beyaz tabakta çikolatalı bir tatlı görünüyor\./); // ham AI değeri
      expect(ai.textContent).toMatch(/masada tatlı tabağı/);
      expect(ai.textContent).toMatch(/\(insan düzeltmesi geçerli\)/);
      expect(ai.querySelector('[data-source="human"]')).toBeNull();
      expect(screen.getByTestId('desc-human').textContent).toMatch(/İnsan açıklaması/);
      expect(ai.textContent).not.toMatch(/İnsan açıklaması/);
      // düzeltilmeyen alan (etiketler) insan notu almaz
      const tagsRow = screen.getByText(/#tatlı #çikolata/).closest('p')!;
      expect(tagsRow.textContent).not.toMatch(/insan düzeltmesi geçerli/);
    });

    it('insan düzeltmesi OKUNAMADI: "okunamadı, olmadığı anlamına gelmez"; "düzeltme yok" DENMEZ', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp({ analysis: record(), correction: { state: 'unavailable' } }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-correction-unavailable')).toBeTruthy());
      expect(screen.getByTestId('desc-correction-unavailable').textContent).toMatch(/olmadığı anlamına gelmez/);
      expect(screen.queryByTestId('desc-human')).toBeNull();
      expect(screen.queryByTestId('desc-no-verified')).toBeNull(); // düzeltme okunamadıkça "doğrulanmış ürün yok" denmez
    });

    it('insan tür/ürün alanları ve yalnız-not düzeltmesi görünür', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp({ correction: { state: 'ok', value: human({ overrides: { productIdentity: { status: 'okunaklı_etiket', note: 'etikette yazıyor' }, shotType: 'üstten', peoplePresent: false }, note: undefined }) } }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-human')).toBeTruthy());
      const t = screen.getByTestId('desc-human').textContent!;
      expect(t).toMatch(/Okunaklı etiket var — etikette yazıyor/);
      expect(t).toMatch(/Kadraj türü: üstten/);
      expect(t).toMatch(/İnsan görünüyor mu: hayır/);
    });
  });

  describe('AÇIK 3: doğrulanmış ürün adı', () => {
    const withProducts = (state: string, items: any[], extra: any = {}) =>
      resp({ analysis: record(), correction: { state: 'ok', value: human({ overrides: {}, verifiedProductIds: items.map((i) => i.id), note: undefined }) }, products: { state, items }, ...extra });

    it('çözülen ad "İnsan doğrulamalı ürün" olarak insan etiketiyle, kimlikle birlikte gösterilir', async () => {
      api.getMediaAnalysis.mockResolvedValue(withProducts('bundle', [{ id: 'lovebombing', name: 'Lovebombing' }]));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-verified')).toBeTruthy());
      const v = screen.getByTestId('desc-verified');
      expect(v.textContent).toMatch(/İnsan doğrulamalı ürün: Lovebombing \(kimlik: lovebombing\)/);
      expect(v.querySelector('[data-source="human"]')).toBeTruthy();
      expect(screen.queryByTestId('desc-no-verified')).toBeNull();
    });

    it('pakette olmayan kimlik: ad UYDURULMAZ — "Ad çözülemedi" + "ad bilinmiyor"', async () => {
      api.getMediaAnalysis.mockResolvedValue(withProducts('bundle', [{ id: 'lovebombing', name: 'Lovebombing' }, { id: 'bilinmeyen-urun', name: null }]));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-verified')).toBeTruthy());
      expect(screen.getByTestId('desc-verified').textContent).toMatch(/Ad çözülemedi \(kimlik: bilinmeyen-urun\)/);
      expect(screen.getByTestId('desc-verified').textContent).toMatch(/ad bilinmiyor/);
    });

    it.each([
      ['no_bundle', /marka sesi paketi yüklü değil; ürün adları çözülemedi/],
      ['invalid_bundle', /paketi geçersiz; ürün adları gösterilmedi/],
      ['unavailable', /Ürün adları okunamadı/],
    ])('paket durumu %s: adlar yok, nedeni söylenir, kimlik tek başına gösterilir', async (state, re) => {
      api.getMediaAnalysis.mockResolvedValue(withProducts(state, [{ id: 'lovebombing', name: null }]));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-verified')).toBeTruthy());
      expect(screen.getByTestId('desc-verified').textContent).toMatch(re);
      expect(screen.getByTestId('desc-verified').textContent).toMatch(/Ad çözülemedi \(kimlik: lovebombing\)/);
      expect(screen.getByTestId('desc-verified').textContent).not.toMatch(/Lovebombing\b(?! )/);
    });
  });

  it('kayıt YOK (kuyruk da yok), analiz KAPALI: kapalı notu + kayıt yok; kapalı olmak başarı sayılmaz', async () => {
    api.getMediaAnalysis.mockResolvedValue(resp({ enabled: false }));
    view();
    await waitFor(() => expect(screen.getByTestId('desc-disabled')).toBeTruthy());
    expect(screen.getByTestId('desc-missing')).toBeTruthy();
    noWrites();
  });

  it('analiz KAPALI ama eski kayıt var: kayıtlı veri gösterilir ve kapalı notu ayrıca durur', async () => {
    api.getMediaAnalysis.mockResolvedValue(resp({ enabled: false, analysis: record() }));
    view();
    await waitFor(() => expect(screen.getByTestId('desc-semantic')).toBeTruthy());
    expect(screen.getByTestId('desc-disabled').textContent).toMatch(/yeni analiz başlatılmaz/);
  });

  it('running kaydı: sonuç yok der; failed: neden/kod; unsupported: ayrı; ayrıca tanınmayan durum', async () => {
    api.getMediaAnalysis.mockResolvedValueOnce(resp({ analysis: record({ status: 'running', result: null }) }));
    const a = view();
    await waitFor(() => expect(screen.getByTestId('desc-running')).toBeTruthy());
    a.unmount();
    api.getMediaAnalysis.mockResolvedValueOnce(resp({ analysis: record({ status: 'failed', result: null, retryable: true, error: { code: 'http_529', message: 'Model meşgul' } }) }));
    const b = view();
    await waitFor(() => expect(screen.getByTestId('desc-failed').textContent).toMatch(/Model meşgul \(http_529\).*bu panel analiz başlatmaz/));
    expect(screen.queryByTestId('desc-missing')).toBeNull();
    b.unmount();
    api.getMediaAnalysis.mockResolvedValueOnce(resp({ analysis: record({ status: 'unsupported', result: null, error: { code: 'unsupported', message: 'Arşivlenmiş dosya analiz edilmez' } }) }));
    const c = view();
    await waitFor(() => expect(screen.getByTestId('desc-unsupported').textContent).toMatch(/Arşivlenmiş dosya analiz edilmez/));
    expect(screen.queryByTestId('desc-failed')).toBeNull();
    c.unmount();
    api.getMediaAnalysis.mockResolvedValueOnce(resp({ analysis: record({ status: 'weird', result: null }) }));
    view();
    await waitFor(() => expect(screen.getByTestId('desc-unknown')).toBeTruthy());
    noWrites();
  });

  it('OKUMA HATASI: "okunamadı, olmadığı anlamına gelmez"; kapalı/yok metni DEĞİL; "Yeniden oku" yalnız GET tekrarlar', async () => {
    api.getMediaAnalysis.mockRejectedValueOnce(new Error('Ağ hatası'));
    view();
    await waitFor(() => expect(screen.getByTestId('desc-read-error')).toBeTruthy());
    expect(screen.getByTestId('desc-read-error').textContent).toMatch(/okunamadı \(Ağ hatası\).*olmadığı anlamına gelmez/);
    expect(screen.queryByTestId('desc-missing')).toBeNull();
    expect(screen.queryByTestId('desc-disabled')).toBeNull();
    api.getMediaAnalysis.mockResolvedValueOnce(resp({ analysis: record() }));
    fireEvent.click(screen.getByRole('button', { name: 'Yeniden oku' }));
    await waitFor(() => expect(screen.getByTestId('desc-semantic')).toBeTruthy());
    expect(api.getMediaAnalysis).toHaveBeenCalledTimes(2);
    noWrites();
  });

  it('eski sürüm kaydı (yalnız description/tags/uncertainties) çökmez; olmayan alan uydurulmaz', async () => {
    const old = { description: 'Bir tabak tatlı.', tags: ['tatlı'], uncertainties: ['içerik görünmüyor'] };
    api.getMediaAnalysis.mockResolvedValue(resp({ analysis: record({ promptVersion: 'media-catalog-v1', schemaVersion: undefined, result: old }) }));
    view();
    await waitFor(() => expect(screen.getByTestId('desc-semantic')).toBeTruthy());
    expect(screen.getByTestId('desc-semantic').textContent).not.toMatch(/Konu:|İnsan görünüyor|Önerilen kullanım/);
    expect(screen.getByTestId('desc-measure').textContent).toMatch(/Kayıtlı AI kadraj gözlemi yok/);
  });

  describe('kapsam değişiminde eski yanıt/hata yeni ekrana taşınmaz', () => {
    it('yanıtın kapsamı (tenant/proje/varlık) farklıysa YAZILMAZ ve "yok" gibi gösterilmez', async () => {
      for (const scope of [{ tenantId: 'tX', projectId: 'p1', assetId: 'a1' }, { tenantId: 't1', projectId: 'p2', assetId: 'a1' }, { tenantId: 't1', projectId: 'p1', assetId: 'baska' }]) {
        api.getMediaAnalysis.mockResolvedValueOnce(resp({ analysis: record() }, scope));
        const r = view();
        await waitFor(() => expect(screen.getByTestId('desc-read-error').textContent).toMatch(/kapsamı doğrulanamadı/));
        expect(screen.queryByTestId('desc-semantic')).toBeNull();
        r.unmount();
      }
    });

    it('kapsam alanı hiç yoksa (doğrulanamaz) gösterilmez', async () => {
      const { scope, ...noScope } = resp({ analysis: record() });
      void scope;
      api.getMediaAnalysis.mockResolvedValue(noScope);
      view();
      await waitFor(() => expect(screen.getByTestId('desc-read-error')).toBeTruthy());
    });

    it('yanıtın analiz kaydı başka varlığa aitse YAZILMAZ', async () => {
      api.getMediaAnalysis.mockResolvedValue(resp({ analysis: record({ sourceId: 'baska' }) }));
      view();
      await waitFor(() => expect(screen.getByTestId('desc-read-error')).toBeTruthy());
      expect(screen.queryByTestId('desc-semantic')).toBeNull();
    });

    it('GEÇ YANIT: varlık/marka değişince eski yanıt yeni görünüme yazılmaz', async () => {
      let resolveOld: (v: any) => void = () => {};
      api.getMediaAnalysis.mockImplementationOnce(() => new Promise((r) => { resolveOld = r; }));
      const { rerender } = view('p1', 'a1');
      api.getMediaAnalysis.mockResolvedValueOnce(resp({ analysis: record({ projectId: 'p2', sourceId: 'a2', result: { ...catalog, description: 'Yeni görselin açıklaması.' } }) }, { tenantId: 't1', projectId: 'p2', assetId: 'a2' }));
      rerender(<AssetDescription tenantId="t1" projectId="p2" assetId="a2" />);
      await waitFor(() => expect(screen.getByText('Yeni görselin açıklaması.')).toBeTruthy());
      resolveOld(resp({ analysis: record({ result: { ...catalog, description: 'ESKİ MARKANIN AÇIKLAMASI' } }), correction: { state: 'ok', value: human({ overrides: { description: 'ESKİ İNSAN' } }) }, queue: { state: 'ok', job: job() } }));
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByText(/ESKİ/)).toBeNull();
      expect(screen.queryByTestId('desc-human')).toBeNull();
      expect(screen.getByText('Yeni görselin açıklaması.')).toBeTruthy();
      expect(api.getMediaAnalysis).toHaveBeenNthCalledWith(2, 'p2', 'a2');
    });

    it('TENANT/KULLANICI değişimi: aynı proje+varlıkta tenant değişince panel yeniden kurulur; eski tenant yanıtı yazılmaz', async () => {
      let resolveOld: (v: any) => void = () => {};
      api.getMediaAnalysis.mockImplementationOnce(() => new Promise((r) => { resolveOld = r; }));
      const { rerender } = view('p1', 'a1', 't1');
      api.getMediaAnalysis.mockResolvedValueOnce(resp({ analysis: record({ tenantId: 't2', result: { ...catalog, description: 'T2 açıklaması.' } }) }, { tenantId: 't2', projectId: 'p1', assetId: 'a1' }));
      rerender(<AssetDescription tenantId="t2" projectId="p1" assetId="a1" />);
      await waitFor(() => expect(screen.getByText('T2 açıklaması.')).toBeTruthy());
      resolveOld(resp({ analysis: record({ result: { ...catalog, description: 'T1 ESKİ' } }) }));
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByText(/T1 ESKİ/)).toBeNull();
    });

    it('GEÇ HATA: eski isteğin hatası yeni görünümü bozmaz', async () => {
      let rejectOld: (e: any) => void = () => {};
      api.getMediaAnalysis.mockImplementationOnce(() => new Promise((_r, j) => { rejectOld = j; }));
      const { rerender } = view('p1', 'a1');
      api.getMediaAnalysis.mockResolvedValueOnce(resp({ analysis: record({ sourceId: 'a2' }) }, { tenantId: 't1', projectId: 'p1', assetId: 'a2' }));
      rerender(<AssetDescription tenantId="t1" projectId="p1" assetId="a2" />);
      await waitFor(() => expect(screen.getByTestId('desc-semantic')).toBeTruthy());
      rejectOld(new Error('eski hata'));
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByTestId('desc-read-error')).toBeNull();
      expect(screen.getByTestId('desc-semantic')).toBeTruthy();
    });

    it('eski hata ekranı yeni varlığa taşınmaz: hata sonrası başka varlığa geçince yükleniyor → yeni veri', async () => {
      api.getMediaAnalysis.mockRejectedValueOnce(new Error('birinci hata'));
      const { rerender } = view('p1', 'a1');
      await waitFor(() => expect(screen.getByTestId('desc-read-error')).toBeTruthy());
      api.getMediaAnalysis.mockResolvedValueOnce(resp({ analysis: record({ sourceId: 'a2' }) }, { tenantId: 't1', projectId: 'p1', assetId: 'a2' }));
      rerender(<AssetDescription tenantId="t1" projectId="p1" assetId="a2" />);
      await waitFor(() => expect(screen.getByTestId('desc-semantic')).toBeTruthy());
      expect(screen.queryByTestId('desc-read-error')).toBeNull();
      expect(screen.queryByText(/birinci hata/)).toBeNull();
    });
  });
});


describe('kompozisyon kararı bölümü (konu açıklamasından AYRI; kaynak etiketli)', () => {
  const v3 = (over: any = {}) => record({ promptVersion: 'media-catalog-v3', schemaVersion: '3', provider: 'openrouter', visualSchemaVersion: 'visual-decision-3', visualPromptVersion: 'visual-decision-prompt-3', visualStatus: 'ok', visual: visualFixture(), ...over });
  const viewDims = () => render(<AssetDescription tenantId="t1" projectId="p1" assetId="a1" dims={{ w: 4000, h: 3000 }} />);

  it('karar varsa: konum/alan KOD hesabı, anlamsal alanlar AI gözlemi etiketiyle; sürüm bilgisi; konu bölümü kompozisyon alanı içermez', async () => {
    api.getMediaAnalysis.mockResolvedValue(resp({ analysis: v3() }));
    viewDims();
    await waitFor(() => expect(screen.getByTestId('desc-visual')).toBeTruthy());
    expect(screen.getByTestId('desc-visual-subject').textContent).toMatch(/orta, kareyi yaklaşık %16 kaplıyor/);
    expect(screen.getByTestId('desc-visual-subject').querySelector('[data-source="code"]')).toBeTruthy();
    expect(screen.getByTestId('desc-visual-weight').querySelector('[data-source="ai"]')).toBeTruthy();
    expect(screen.getByTestId('desc-visual-version').textContent).toMatch(/Görsel şema visual-decision-3/);
    expect(screen.getByTestId('desc-visual').textContent).toMatch(/kesin ölçüm değildir/);
    expect(screen.getByTestId('desc-visual-crops').querySelectorAll('[data-crop]')).toHaveLength(3);
    expect(screen.getByTestId('desc-semantic').textContent).not.toMatch(/ağırlık|kompozisyon|negatif/i);
    noWrites();
  });

  it('boyut bilinmiyorsa kırpım HESAPLANMAZ ve bunu söyler; önizleme kaynağında "oran aynı varsayıldı" uyarısı', async () => {
    api.getMediaAnalysis.mockResolvedValue(resp({ analysis: v3({ sourceQuality: 'studio_preview' }) }));
    view();
    await waitFor(() => expect(screen.getByTestId('desc-visual')).toBeTruthy());
    expect(screen.queryByTestId('desc-visual-crops')).toBeNull();
    expect(screen.getByTestId('desc-visual').textContent).toMatch(/Kırpım hesabı için kaynak boyutu bilinmiyor; hesaplanmadı/);
    expect(screen.getByTestId('desc-visual').textContent).toMatch(/Kutu önizlemeden tahmin edildi; asıl kare oranının aynı olduğu varsayıldı/);
  });

  it('model karar verdi ama doğrulanamadı → "kullanılmıyor" (sahte kompozisyon gösterilmez); eski kayıt → "eski sürüm"; eski görsel şema → gösterilmez', async () => {
    api.getMediaAnalysis.mockResolvedValue(resp({ analysis: v3({ visual: null, visualStatus: 'invalid', visualIssue: 'konu_kutusu_geçersiz' }) }));
    const a = view();
    await waitFor(() => expect(screen.getByTestId('desc-visual-missing')).toBeTruthy());
    expect(screen.getByTestId('desc-visual-missing').textContent).toMatch(/doğrulamadan geçmedi \(konu_kutusu_geçersiz\); kullanılmıyor/);
    a.unmount();
    api.getMediaAnalysis.mockResolvedValue(resp({ analysis: record() }));
    const b = view();
    await waitFor(() => expect(screen.getByTestId('desc-visual-missing').textContent).toMatch(/eski sürüm/));
    expect(screen.queryByTestId('desc-visual')).toBeNull();
    b.unmount();
    api.getMediaAnalysis.mockResolvedValue(resp({ analysis: v3({ visualSchemaVersion: 'visual-decision-0' }) }));
    view();
    await waitFor(() => expect(screen.getByTestId('desc-visual-stale')).toBeTruthy());
    expect(screen.queryByTestId('desc-visual')).toBeNull();
    noWrites();
  });

  it('v2 ayrıntıları: negatif alan ORANI (bölgelerden, kod), ışık yönü/patlama-ezilme, alan bazında güven, alan notları, gürültü/sıkıştırma, kırpım çözünürlüğü, platform kenarı varsayımı doğrulanmadı', async () => {
    const vis = visualFixture({
      negativeSpace: { zone: 'üst', amount: 'geniş', regions: [{ x: 0, y: 0, w: 1, h: 0.25 }] },
      lighting: { direction: 'sol', brightZone: 'sol', darkZone: 'sağ', blownHighlights: 'var', crushedShadows: 'yok' },
      technical: { sharpness: 'hafif_bulanık', exposure: 'dengeli', noise: 'hafif', compression: 'belirgin', issues: ['köşe vinyet'] },
      fieldConfidence: { ...visualFixture().fieldConfidence, lighting: 'düşük', weight: 'yüksek' },
      fieldNotes: [{ field: 'directions', note: 'hareket yönü için kanıt yok' }],
      focus: { competition: 'rekabet', competingElements: ['yan tabak'] },
    });
    api.getMediaAnalysis.mockResolvedValue(resp({ analysis: v3({ visual: vis }) }));
    viewDims();
    await waitFor(() => expect(screen.getByTestId('desc-visual')).toBeTruthy());
    expect(screen.getByTestId('desc-visual-negative').textContent).toMatch(/geniş, üst/);
    expect(screen.getByTestId('desc-visual-negative-ratio').textContent).toMatch(/yaklaşık %25/);
    expect(screen.getByTestId('desc-visual-negative').querySelector('[data-source="code"]')).toBeTruthy();
    expect(screen.getByTestId('desc-visual-lighting').textContent).toMatch(/yön sol · en aydınlık sol · en karanlık sağ · patlamış parlak bölge var · ezilmiş koyu bölge yok/);
    expect(screen.getByTestId('desc-visual-lighting').textContent).toMatch(/güven: düşük/);
    expect(screen.getByTestId('desc-visual-weight').textContent).toMatch(/güven: yüksek/);
    expect(screen.getByTestId('desc-visual-technical').textContent).toMatch(/gürültü hafif · sıkıştırma belirgin · köşe vinyet/);
    expect(screen.getByTestId('desc-visual-notes').textContent).toMatch(/directions: hareket yönü için kanıt yok/);
    expect(screen.getByTestId('desc-visual').textContent).toMatch(/odak rekabet \(yan tabak\)/);
    expect(screen.getByTestId('desc-visual-crops').textContent).toMatch(/Story 9:16:.*kırpım \d+×\d+ px → 1080×1920/);
    expect(screen.getByTestId('desc-visual-safe-note').textContent).toMatch(/VARSAYIM, Meta resmi belgesiyle doğrulanmadı/);
    noWrites();
  });

  it('negatif alan bölgesi/piksel yoksa oran "ölçülmedi" der (model bandı oran sayılmaz)', async () => {
    api.getMediaAnalysis.mockResolvedValue(resp({ analysis: v3({ visual: visualFixture({ negativeSpace: { zone: 'üst', amount: 'geniş', regions: [] } }) }) }));
    viewDims();
    await waitFor(() => expect(screen.getByTestId('desc-visual-negative-ratio')).toBeTruthy());
    expect(screen.getByTestId('desc-visual-negative-ratio').textContent).toMatch(/ölçülmedi/);
  });

  it('kutu BİLİNMİYOR: panel "BİLİNMİYOR" der, kırpım hesaplamaz, kısmi kayıt uyarısı gösterir; diğer alanlar yine görünür', async () => {
    api.getMediaAnalysis.mockResolvedValue(resp({ analysis: v3({ visualStatus: 'partial', visualIssue: 'konu_kutusu_bilinmiyor', visual: unknownVisual({ density: 'sakin', color: { main: 'bej', accents: [], attention: 'belirsiz', temperature: 'sıcak' } }) }) }));
    viewDims();
    await waitFor(() => expect(screen.getByTestId('desc-visual')).toBeTruthy());
    expect(screen.getByTestId('desc-visual-subject').textContent).toMatch(/BİLİNMİYOR/);
    expect(screen.getByTestId('desc-visual-subject').textContent).not.toMatch(/kaplıyor/);
    expect(screen.getByTestId('desc-visual-partial').textContent).toMatch(/konu_kutusu_bilinmiyor.*eksik geometri uydurulmadı/);
    expect(screen.queryByTestId('desc-visual-crops')).toBeNull();
    expect(screen.getByTestId('desc-visual').textContent).toMatch(/Kırpım hesabı için konu kutusu bilinmiyor/);
    expect(screen.getByTestId('desc-visual').textContent).toMatch(/ana bej/);
  });

  it('analiz sürüyor/başarısız kayıtta kompozisyon bölümü hiç görünmez (veri yok)', async () => {
    api.getMediaAnalysis.mockResolvedValue(resp({ analysis: v3({ status: 'failed', visual: null, result: null, error: { code: 'http_429', message: 'x' } }) }));
    view();
    await waitFor(() => expect(screen.getByTestId('desc-failed')).toBeTruthy());
    expect(screen.queryByTestId('desc-visual')).toBeNull();
    expect(screen.queryByTestId('desc-visual-missing')).toBeNull();
  });
});
