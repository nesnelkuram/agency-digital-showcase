import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/studio/StudioLayout', () => ({
  useStudio: () => ({ project: { id: 'projA', name: 'Rakle' }, tenantId: 't1', timeZone: 'Europe/Istanbul', timeZoneIsDefault: false, projects: [] }),
}));
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

describe('StudioLibraryPage', () => {
  beforeEach(() => {
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
});
