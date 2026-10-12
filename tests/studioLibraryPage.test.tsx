import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const studio = vi.hoisted(() => ({ project: { id: 'projA', name: 'Rakle' } }));
vi.mock('@/studio/StudioLayout', () => ({
  useStudio: () => ({ project: studio.project, tenantId: 't1', timeZone: 'Europe/Istanbul', timeZoneIsDefault: false, projects: [] }),
}));
// Panel açılışı yalnız OKUR (GET): yazan/model başlatan çağrılar ayrıca izlenir
const media = vi.hoisted(() => ({
  get: vi.fn(),
  run: vi.fn(),
  correct: vi.fn(),
  canvaGet: vi.fn(),
  canvaRun: vi.fn(),
}));
vi.mock('@/studio/mediaIntegrationsApi', async (orig) => ({
  ...(await orig<any>()),
  getMediaAnalysis: (...a: any[]) => media.get(...a),
  runMediaAnalysis: (...a: any[]) => media.run(...a),
  saveCatalogCorrection: (...a: any[]) => media.correct(...a),
  getCanvaSync: (...a: any[]) => media.canvaGet(...a),
  runCanvaSync: (...a: any[]) => media.canvaRun(...a),
}));
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: vi.fn() }));
vi.mock('@/studio/hooks/useLibraryUpload', () => ({
  useLibraryUpload: () => ({ items: [], busy: false, enqueue: vi.fn(() => []), pause: vi.fn(), resume: vi.fn(), cancel: vi.fn(), retry: vi.fn(), dismiss: vi.fn() }),
}));

const url = (p: string) => `https://firebasestorage.googleapis.com/v0/b/b/o/${encodeURIComponent(p)}?alt=media&token=t`;
const asset = (id: string) => ({
  id, tenantId: 't1', projectId: 'projA', kind: 'photo', title: `Görsel ${id}`, fileName: `${id}.jpg`, tags: [], status: 'active', createdBy: 'u',
  storage: { path: `brand-media/t1/projA/${id}/${id}.jpg`, downloadUrl: url(`brand-media/t1/projA/${id}/${id}.jpg`), contentType: 'image/jpeg', size: 10 },
});
const data = {
  list: vi.fn(async (..._a: any[]) => [asset('a1')] as any[]),
  used: vi.fn(async (..._a: any[]): Promise<Set<string>> => new Set()),
  usage: vi.fn(async (..._a: any[]): Promise<any[]> => []),
};
vi.mock('@/studio/brandMediaData', () => ({
  LIBRARY_PAGE_SIZE: 200,
  ASSET_USAGE_LIMIT: 50,
  listBrandMedia: (...a: any[]) => data.list(...a),
  getUsedAssetIds: (...a: any[]) => data.used(...a),
  getAssetUsage: (...a: any[]) => data.usage(...a),
  setBrandMediaArchived: vi.fn(),
  updateBrandMediaInfo: vi.fn(),
}));

import StudioLibraryPage from '@/studio/pages/StudioLibraryPage';

const view = () =>
  render(
    <MemoryRouter>
      <StudioLibraryPage />
    </MemoryRouter>
  );

const base = (projectId: string, assetId: string, over: any = {}) => ({
  enabled: true, scope: { tenantId: 't1', projectId, assetId }, serverNow: 1760000000000, analysis: null,
  queue: { state: 'ok', job: null }, correction: { state: 'ok', value: null }, effective: null, products: { state: 'none', items: [] }, ...over,
});

describe('StudioLibraryPage', () => {
  beforeEach(() => {
    studio.project = { id: 'projA', name: 'Rakle' };
    Object.values(media).forEach((f) => f.mockReset());
    media.get.mockImplementation(async (projectId: string, assetId: string) => base(projectId, assetId));
    media.canvaGet.mockResolvedValue({ enabled: false, job: null });
    data.list.mockResolvedValue([asset('a1')]);
    data.used.mockResolvedValue(new Set());
    data.usage.mockResolvedValue([]);
  });

  it('kullanım bilgisi alınamazsa "kullanılmamış" denmez; filtreler kapalı', async () => {
    data.used.mockRejectedValue(new Error('index'));
    view();
    await waitFor(() => expect(screen.getByText(/Kullanım bilgisi alınamadı/)).toBeTruthy());
    expect((screen.getByText('Kullanılmamış') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('Kullanılmış') as HTMLButtonElement).disabled).toBe(true);
  });

  it('kullanım geçmişi hatasında "henüz kullanılmadı" yerine bilinmiyor gösterilir', async () => {
    data.usage.mockRejectedValue(new Error('perm'));
    view();
    await waitFor(() => expect(screen.getByText('Görsel a1')).toBeTruthy());
    fireEvent.click(screen.getByText('Görsel a1'));
    await waitFor(() => expect(screen.getByText(/Kullanım geçmişi alınamadı/)).toBeTruthy());
    expect(screen.queryByText(/Henüz bir içerikte kullanılmadı/)).toBeNull();
  });

  it('kesin kullanım bilgisiyle kullanılmamış filtresi çalışır', async () => {
    data.list.mockResolvedValue([asset('a1'), asset('a2')]);
    data.used.mockResolvedValue(new Set(['a1']));
    view();
    await waitFor(() => expect(screen.getByText('Görsel a2')).toBeTruthy());
    fireEvent.click(screen.getByText('Kullanılmamış'));
    expect(screen.queryByText('Görsel a1')).toBeNull();
    expect(screen.getByText('Görsel a2')).toBeTruthy();
    expect(data.used).toHaveBeenCalledWith('t1', 'projA', ['a1', 'a2']);
  });

  it('200 kayıt sınırı açıkça belirtilir', async () => {
    data.list.mockResolvedValue(Array.from({ length: 200 }, (_, i) => asset(`x${i}`)));
    view();
    await waitFor(() => expect(screen.getByText(/En yeni 200 dosya gösteriliyor/)).toBeTruthy());
  });

  it('panel sınırı 1 GB olarak yazılır', async () => {
    view();
    await waitFor(() => expect(screen.getByText(/Dosya başına yükleme sınırı 1 GB/)).toBeTruthy());
  });

  describe('fotoğraf detayı: kayıtlı görsel tanımı varsayılan görünür (yalnız okuma)', () => {
    const rec = (id: string, description: string) => ({
      key: `k-${id}`, projectId: 'projA', sourceId: id, status: 'done', model: 'claude-haiku-5-5', promptVersion: 'media-catalog-v2', schemaVersion: '2', sourceQuality: 'original', createdAt: 1760000000000,
      result: { subject: 's', description, tags: [], uncertainties: [] },
    });
    const resp = (id: string, description: string, projectId = 'projA') => base(projectId, id, { analysis: rec(id, description) });

    it('tıklayınca tanım HEMEN görünür (açılır bölüm gerekmez); yalnız GET; analiz/Canva/düzeltme çağrısı YOK', async () => {
      media.get.mockResolvedValue(resp('a1', 'Tabakta tatlı var.'));
      view();
      await waitFor(() => expect(screen.getByText('Görsel a1')).toBeTruthy());
      fireEvent.click(screen.getByText('Görsel a1'));
      await waitFor(() => expect(screen.getByText('Tabakta tatlı var.')).toBeTruthy());
      expect(media.get).toHaveBeenCalledWith('projA', 'a1');
      expect(media.run).not.toHaveBeenCalled();
      expect(media.correct).not.toHaveBeenCalled();
      expect(media.canvaRun).not.toHaveBeenCalled();
      expect(media.canvaGet).not.toHaveBeenCalled(); // Canva bölümü katlı: açılmadan istek yok
    });

    it('okuma hatası "kayıt yok"tan ayrıdır; kütüphane ve kullanım geçmişi çalışmaya devam eder', async () => {
      media.get.mockRejectedValue(new Error('Ağ hatası'));
      view();
      await waitFor(() => expect(screen.getByText('Görsel a1')).toBeTruthy());
      fireEvent.click(screen.getByText('Görsel a1'));
      await waitFor(() => expect(screen.getByTestId('desc-read-error')).toBeTruthy());
      expect(screen.queryByTestId('desc-missing')).toBeNull();
      await waitFor(() => expect(screen.getByText(/Henüz bir içerikte kullanılmadı/)).toBeTruthy());
    });

    it('SAYFA+PANEL: AI yokken insan açıklaması, bekleyen kuyruk ve çözülen ürün adı görünür; yazan/model çağrısı yok', async () => {
      media.get.mockResolvedValue(base('projA', 'a1', {
        queue: { state: 'ok', job: { state: 'pending', attempts: 0, maxAttempts: 3, nextAttemptAt: 1759999999000, leaseActive: false, leaseUntil: null, lastError: null, analysisKey: null, createdAt: 1, updatedAt: 1 } },
        correction: { state: 'ok', value: { overrides: { description: 'İnsan yazdı.' }, verifiedProductIds: ['lovebombing'], correctedAt: 1760000000000 } },
        products: { state: 'bundle', items: [{ id: 'lovebombing', name: 'Lovebombing' }] },
      }));
      view();
      await waitFor(() => expect(screen.getByText('Görsel a1')).toBeTruthy());
      fireEvent.click(screen.getByText('Görsel a1'));
      await waitFor(() => expect(screen.getByTestId('desc-human')).toBeTruthy());
      expect(screen.getByTestId('desc-human').textContent).toMatch(/İnsan yazdı\./);
      expect(screen.getByTestId('desc-queue').getAttribute('data-state')).toBe('queued');
      expect(screen.getByTestId('desc-verified').textContent).toMatch(/Lovebombing \(kimlik: lovebombing\)/);
      expect(media.run).not.toHaveBeenCalled();
      expect(media.correct).not.toHaveBeenCalled();
      expect(media.canvaRun).not.toHaveBeenCalled();
    });

    it('sunucu başka tenant kapsamıyla yanıt verirse sayfa bunu göstermez (okuma hatası)', async () => {
      media.get.mockResolvedValue({ ...base('projA', 'a1', { analysis: rec('a1', 'Başka tenant') }), scope: { tenantId: 'tX', projectId: 'projA', assetId: 'a1' } });
      view();
      await waitFor(() => expect(screen.getByText('Görsel a1')).toBeTruthy());
      fireEvent.click(screen.getByText('Görsel a1'));
      await waitFor(() => expect(screen.getByTestId('desc-read-error')).toBeTruthy());
      expect(screen.queryByText('Başka tenant')).toBeNull();
    });

    it('video için tanım istenmez (AI kataloglama fotoğraf içindir)', async () => {
      data.list.mockResolvedValue([{ ...asset('v1'), kind: 'video' }]);
      view();
      await waitFor(() => expect(screen.getByText('Görsel v1')).toBeTruthy());
      fireEvent.click(screen.getByText('Görsel v1'));
      await waitFor(() => expect(screen.getByTestId('asset-description-video')).toBeTruthy());
      expect(media.get).not.toHaveBeenCalled();
    });

    it('başka fotoğrafa geçince eski geç yanıt yeni panele yazılmaz', async () => {
      data.list.mockResolvedValue([asset('a1'), asset('a2')]);
      let late: (v: any) => void = () => {};
      media.get.mockImplementationOnce(() => new Promise((r) => { late = r; }));
      view();
      await waitFor(() => expect(screen.getByText('Görsel a1')).toBeTruthy());
      fireEvent.click(screen.getByText('Görsel a1'));
      await waitFor(() => expect(media.get).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByLabelText('Kapat'));
      media.get.mockResolvedValueOnce(resp('a2', 'İkinci görselin tanımı.'));
      fireEvent.click(screen.getByText('Görsel a2'));
      await waitFor(() => expect(screen.getByText('İkinci görselin tanımı.')).toBeTruthy());
      late(resp('a1', 'BİRİNCİNİN GEÇ TANIMI'));
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByText(/BİRİNCİNİN GEÇ/)).toBeNull();
      expect(screen.getByText('İkinci görselin tanımı.')).toBeTruthy();
    });

    it('marka değişince açık ayrıntı kapanır; geç gelen eski marka yanıtı görünmez', async () => {
      let late: (v: any) => void = () => {};
      media.get.mockImplementationOnce(() => new Promise((r) => { late = r; }));
      const ui = (
        <MemoryRouter>
          <StudioLibraryPage />
        </MemoryRouter>
      );
      const { rerender } = render(ui);
      await waitFor(() => expect(screen.getByText('Görsel a1')).toBeTruthy());
      fireEvent.click(screen.getByText('Görsel a1'));
      await waitFor(() => expect(media.get).toHaveBeenCalledTimes(1));
      studio.project = { id: 'projB', name: 'Diğer' };
      data.list.mockResolvedValue([]);
      rerender(<MemoryRouter><StudioLibraryPage /></MemoryRouter>);
      await waitFor(() => expect(screen.queryByTestId('asset-description')).toBeNull());
      late(resp('a1', 'ESKİ MARKA TANIMI'));
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByText(/ESKİ MARKA TANIMI/)).toBeNull();
    });
  });
});
