import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const updateDoc = vi.fn(async (..._args: any[]) => {});
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<any>()),
  doc: vi.fn(() => ({})),
  updateDoc: (...args: any[]) => updateDoc(...args),
  serverTimestamp: () => 'ts',
}));
vi.mock('@/lib/firebase/config', () => ({ db: {}, storage: { app: { options: { storageBucket: 'b' } } } }));
vi.mock('@/shared/hooks/useMediaUpload', () => ({
  useMediaUpload: () => ({ uploadFiles: vi.fn(async () => []), uploading: false, error: null }),
}));

const url = (p: string) => `https://firebasestorage.googleapis.com/v0/b/b/o/${encodeURIComponent(p)}?alt=media&token=t`;
const libAsset = (id: string) => ({
  id, tenantId: 't1', projectId: 'projA', kind: 'photo', title: `Görsel ${id}`, fileName: `${id}.jpg`, tags: [], status: 'active', createdBy: 'u',
  storage: { path: `brand-media/t1/projA/${id}/${id}.jpg`, downloadUrl: url(`brand-media/t1/projA/${id}/${id}.jpg`), contentType: 'image/jpeg', size: 10, width: 1080, height: 1350 },
});
const listBrandMedia = vi.fn(async (..._a: any[]) => [libAsset('a1'), libAsset('a2')]);
vi.mock('@/studio/brandMediaData', () => ({ listBrandMedia: (...a: any[]) => listBrandMedia(...a) }));

import StudioPostDetail from '@/studio/components/StudioPostDetail';

const uploaded = { id: 'u1', url: url('social-media-drafts/t1/projA/u1.jpg'), type: 'image', mimeType: 'image/jpeg', size: 10, order: 0 };
const post: any = {
  id: 'p1', projectId: 'projA', status: 'draft', postType: 'carousel', platforms: ['instagram'],
  caption: 'metin', media: [uploaded], mediaUrls: [uploaded.url], tags: [],
};

async function pick(...titles: string[]) {
  fireEvent.click(screen.getByText('Kütüphaneden seç'));
  for (const t of titles) {
    await waitFor(() => expect(screen.getByTitle(t)).toBeTruthy());
    fireEvent.click(screen.getByTitle(t));
  }
  fireEvent.click(screen.getByText(`Ekle (${titles.length})`));
}

describe('StudioPostDetail — kütüphaneden seçim', () => {
  beforeEach(() => {
    updateDoc.mockClear();
    listBrandMedia.mockClear();
  });

  it('seçim kaydedilmeden hiçbir yere yazılmaz; kütüphane bu post\'un projesinden okunur', async () => {
    render(<StudioPostDetail tenantId="t1" post={post} onClose={() => {}} onSaved={() => {}} />);
    await pick('Görsel a1');
    expect(listBrandMedia).toHaveBeenCalledWith('t1', 'projA', { status: 'active' });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('kaydedince libraryAssetIds medyayla aynı; çıkarılan varlık listeden düşer', async () => {
    render(<StudioPostDetail tenantId="t1" post={post} onClose={() => {}} onSaved={() => {}} />);
    await pick('Görsel a1', 'Görsel a2');
    // a1 (2. medya) seçili hale getirilip çıkarılır
    fireEvent.click(screen.getAllByText('2')[0]);
    fireEvent.click(screen.getByText('Çıkar'));
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    const patch = (updateDoc.mock.calls[0] as any[])[1];
    expect(patch.libraryAssetIds).toEqual(['a2']);
    expect(patch.media.map((m: any) => m.libraryAssetId ?? null)).toEqual([null, 'a2']);
    expect(patch.mediaUrls).toEqual(patch.media.map((m: any) => m.url));
  });

  it('sıralama değişince de kimlikler medyadan türetilir', async () => {
    render(<StudioPostDetail tenantId="t1" post={post} onClose={() => {}} onSaved={() => {}} />);
    await pick('Görsel a1', 'Görsel a2');
    fireEvent.click(screen.getAllByText('3')[0]);
    fireEvent.click(screen.getByLabelText('Sola taşı'));
    fireEvent.click(screen.getByText('Kaydet'));
    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
    expect((updateDoc.mock.calls[0] as any[])[1].libraryAssetIds).toEqual(['a2', 'a1']);
  });

  it('başka post\'a geçince açık seçim ve kaydedilmemiş medya taşınmaz', async () => {
    const { rerender } = render(<StudioPostDetail tenantId="t1" post={post} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByText('Kütüphaneden seç'));
    await waitFor(() => expect(screen.getByTitle('Görsel a1')).toBeTruthy());
    rerender(<StudioPostDetail tenantId="t1" post={{ ...post, id: 'p2', media: [], mediaUrls: [] }} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.queryByRole('dialog', { name: 'Kütüphaneden seç' })).toBeNull();
    expect(screen.getByText('Medya yok')).toBeTruthy();
  });

  it('Instagram ön kontrolü gösterilir', () => {
    render(<StudioPostDetail tenantId="t1" post={{ ...post, postType: 'static' }} onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByText(/Instagram ön kontrolü/)).toBeTruthy();
  });
});
