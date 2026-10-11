import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const api = vi.hoisted(() => ({
  getCanvaStatus: vi.fn(),
  listCanvaFolder: vi.fn(),
  getCanvaSync: vi.fn(),
  runCanvaSync: vi.fn(),
  getMediaAnalysis: vi.fn(),
  runMediaAnalysis: vi.fn(),
}));
vi.mock('@/studio/mediaIntegrationsApi', async (orig) => ({ ...(await orig<any>()), ...Object.fromEntries(Object.entries(api).map(([k, f]) => [k, (...a: any[]) => (f as any)(...a)])) }));
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: vi.fn() }));

import { AssetIntegrations, CanvaFolderPanel } from '@/studio/components/MediaIntegrations';

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));

describe('Canva paneli', () => {
  it('özellik kapalıyken yalnız nedeni gösterir, listelemez', async () => {
    api.getCanvaStatus.mockResolvedValue({ enabled: false, reason: 'Canva senkronu kapalı (CANVA_SYNC_ENABLED).' });
    render(<CanvaFolderPanel projectId="p1" />);
    await waitFor(() => expect(screen.getByText(/Canva entegrasyonu kapalı/)).toBeTruthy());
    expect(api.listCanvaFolder).not.toHaveBeenCalled();
  });

  it('eşlenmiş klasör: "yalnız önizleme" uyarısı, klasör bağlantısı; takvime ekleme yok', async () => {
    api.getCanvaStatus.mockResolvedValue({ enabled: true, connection: { connected: true }, mapping: { canvaFolderId: 'F', folderUrl: 'https://www.canva.com/folder/F' } });
    api.listCanvaFolder.mockResolvedValue({ items: [{ id: 'A1', name: 'WEDD5280.jpg', thumbnail: { url: 'https://t/1' } }], nextCursor: null });
    render(<CanvaFolderPanel projectId="p1" />);
    await waitFor(() => expect(screen.getByText(/Yalnız önizleme/)).toBeTruthy());
    expect((screen.getByText(/Canva klasörünü aç/) as HTMLAnchorElement).closest('a')!.getAttribute('href')).toBe('https://www.canva.com/folder/F');
    fireEvent.click(screen.getByText('Canva görsellerini göster'));
    await waitFor(() => expect(screen.getByTitle('WEDD5280.jpg')).toBeTruthy());
    expect(screen.queryByText(/takvime ekle/i)).toBeNull();
  });
});

describe('görsel entegrasyon bölümü', () => {
  it('AI kapalıysa analiz düğmesi pasif; çağrı yapılmaz', async () => {
    api.getMediaAnalysis.mockResolvedValue({ enabled: false, analysis: null });
    api.getCanvaSync.mockResolvedValue({ enabled: false, job: null });
    render(<AssetIntegrations projectId="p1" assetId="a1" kind="photo" />);
    await waitFor(() => expect((screen.getByText('Bu görseli analiz et') as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getByText(/Canva entegrasyonu kapalı/)).toBeTruthy();
    expect(api.runMediaAnalysis).not.toHaveBeenCalled();
  });

  it('önizlemeden üretilmiş analiz açıkça "orijinal kalite DEĞİL" olarak etiketlenir; belirsizlik gösterilir', async () => {
    api.getMediaAnalysis.mockResolvedValue({
      enabled: true,
      analysis: { status: 'done', model: 'claude-haiku-5-5', promptVersion: 'media-catalog-v1', sourceQuality: 'studio_preview', result: { description: 'Bir tabak tatlı.', tags: ['tatlı'], uncertainties: ['içerik görünmüyor'] } },
    });
    api.getCanvaSync.mockResolvedValue({ enabled: true, job: { state: 'needs_review', lastError: { message: 'Sonuç belirsiz' } } });
    render(<AssetIntegrations projectId="p1" assetId="a1" kind="photo" />);
    await waitFor(() => expect(screen.getByText(/orijinal kalite DEĞİL/)).toBeTruthy());
    expect(screen.getByText(/Belirsiz: içerik görünmüyor/)).toBeTruthy();
    expect(screen.getByText(/otomatik yeniden yükleme yapılmaz/)).toBeTruthy();
    expect(screen.queryByText("Canva'ya kopyala")).toBeNull();
  });

  it('varlık değişince eski varlığın geç gelen sonucu yeni varlıkta görünmez', async () => {
    let resolveA!: (v: any) => void;
    api.getMediaAnalysis.mockImplementation((_p: string, id: string) =>
      id === 'a1'
        ? new Promise((r) => (resolveA = r))
        : Promise.resolve({ enabled: true, analysis: { status: 'done', model: 'claude-haiku-5-5', promptVersion: 'v', sourceQuality: 'original', result: { description: 'B açıklaması', tags: [], uncertainties: [] } } })
    );
    api.getCanvaSync.mockResolvedValue({ enabled: false, job: null });
    const { rerender } = render(<AssetIntegrations projectId="p1" assetId="a1" kind="photo" />);
    rerender(<AssetIntegrations projectId="p1" assetId="a2" kind="photo" />);
    await waitFor(() => expect(screen.getByText('B açıklaması')).toBeTruthy());
    resolveA({ enabled: true, analysis: { status: 'done', model: 'm', promptVersion: 'v', sourceQuality: 'original', result: { description: 'A ESKİ', tags: [], uncertainties: [] } } });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('A ESKİ')).toBeNull();
    expect(screen.getByText('B açıklaması')).toBeTruthy();
  });

  it('işlem sürerken varlık değişirse sonuç yeni varlığa yazılmaz', async () => {
    let resolveRun!: (v: any) => void;
    api.getMediaAnalysis.mockResolvedValue({ enabled: true, analysis: null });
    api.getCanvaSync.mockResolvedValue({ enabled: false, job: null });
    api.runMediaAnalysis.mockImplementation(() => new Promise((r) => (resolveRun = r)));
    const { rerender } = render(<AssetIntegrations projectId="p1" assetId="a1" kind="photo" />);
    await waitFor(() => expect((screen.getByText('Bu görseli analiz et') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByText('Bu görseli analiz et'));
    rerender(<AssetIntegrations projectId="p1" assetId="a2" kind="photo" />);
    resolveRun({ enabled: true, analysis: { status: 'done', model: 'm', promptVersion: 'v', sourceQuality: 'original', result: { description: 'A SONUCU', tags: [], uncertainties: [] } } });
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('A SONUCU')).toBeNull();
  });
});
