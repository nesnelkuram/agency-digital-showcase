import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const st = vi.hoisted(() => ({ getBlob: vi.fn(), ref: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('firebase/storage', () => ({ getBlob: (...a: any[]) => st.getBlob(...a), ref: (...a: any[]) => st.ref(...a), getDownloadURL: (...a: any[]) => st.getDownloadURL(...a) }));
vi.mock('@/lib/firebase/config', () => ({ storage: { app: 'test-storage' }, db: {} }));
vi.mock('@/lib/firebase/apiClient', () => ({ authenticatedFetch: vi.fn() }));

import { AuthStorageImage, mediaStoragePath } from '@/studio/components/AuthStorageImage';
import StudioPostCard from '@/studio/components/StudioPostCard';

beforeEach(() => {
  st.getBlob.mockReset();
  st.ref.mockReset().mockImplementation((_s: any, p: string) => ({ path: p }));
  st.getDownloadURL.mockReset();
  (globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:test-1');
  (globalThis as any).URL.revokeObjectURL = vi.fn();
});
afterEach(() => cleanup());

const draftPost = {
  id: 'dsp_post1', tenantId: 't1', projectId: 'p1', title: 'Pazartesi · kare 1', caption: 'Loud outside.', postType: 'story', platforms: ['instagram'], status: 'draft',
  media: [{ id: 'MAG3jdKYG_8', url: '', type: 'image', mimeType: 'image/jpeg', size: 1, order: 0, storagePath: 'social-media-drafts/t1/p1/dieci-2026-10-12/MAG3jdKYG_8.jpg', previewStoragePath: 'social-media-drafts/t1/p1/dieci-2026-10-12/MAG3jdKYG_8.web.jpg' }],
} as any;

describe('Yetkili Storage görüntüsü (token yok)', () => {
  it('getBlob ile çözer, blob URL gösterir; getDownloadURL kullanmaz', async () => {
    st.getBlob.mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    const { container } = render(<AuthStorageImage path="social-media-drafts/t1/p1/x/a.web.jpg" alt="a" className="c" />);
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:test-1'));
    expect(st.getBlob).toHaveBeenCalledTimes(1);
    expect(st.ref.mock.calls[0][1]).toBe('social-media-drafts/t1/p1/x/a.web.jpg');
    expect(st.getDownloadURL).not.toHaveBeenCalled();
  });

  it('bileşen kapanınca blob URL serbest bırakılır', async () => {
    st.getBlob.mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    const { container, unmount } = render(<AuthStorageImage path="p" />);
    await waitFor(() => expect(container.querySelector('img')).toBeTruthy());
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-1');
  });

  it('okuma reddedilirse görüntü yerine boş yer tutucu kalır (sızıntı yok)', async () => {
    st.getBlob.mockRejectedValue(new Error('storage/unauthorized'));
    const { container } = render(<AuthStorageImage path="p" />);
    await waitFor(() => expect(st.getBlob).toHaveBeenCalled());
    expect(container.querySelector('img')).toBeNull();
  });

  it('mediaStoragePath: url doluysa yol kullanılmaz; url boşsa önizleme yolu', () => {
    expect(mediaStoragePath({ id: 'a', url: 'https://x/y.jpg', storagePath: 's/a.jpg' } as any)).toBeUndefined();
    expect(mediaStoragePath({ id: 'a', url: '', storagePath: 's/a.jpg', previewStoragePath: 's/a.web.jpg' } as any)).toBe('s/a.web.jpg');
    expect(mediaStoragePath({ id: 'a', url: '', storagePath: 's/a.jpg' } as any)).toBe('s/a.jpg');
  });

  it('taslak post kartı: önce yer tutucu, sonra yetkili önizleme; token yok', async () => {
    st.getBlob.mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    const { container } = render(<StudioPostCard post={draftPost} />);
    expect(screen.getByText('Taslak')).toBeTruthy();
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:test-1'));
    expect(st.ref.mock.calls[0][1]).toBe('social-media-drafts/t1/p1/dieci-2026-10-12/MAG3jdKYG_8.web.jpg');
    expect(st.getDownloadURL).not.toHaveBeenCalled();
  });

  it('gömülü önizleme (thumbnailUrl) varsa kart Storage\'a gitmeden onu gösterir', async () => {
    const post = { ...draftPost, media: [{ ...draftPost.media[0], thumbnailUrl: 'data:image/jpeg;base64,/9j/4AAQ' }] };
    const { container } = render(<StudioPostCard post={post} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/jpeg;base64,/9j/4AAQ');
    expect(st.getBlob).not.toHaveBeenCalled();
    expect(st.getDownloadURL).not.toHaveBeenCalled();
  });
});
