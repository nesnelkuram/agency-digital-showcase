import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('@/lib/firebase/config', () => ({ db: null, storage: { app: { options: { storageBucket: 'b' } } } }));

import LibraryPicker from '@/studio/components/LibraryPicker';
import type { BrandMediaAsset } from '@/shared/types/brandMedia';

const url = (p: string) => `https://firebasestorage.googleapis.com/v0/b/b/o/${encodeURIComponent(p)}?alt=media&token=t`;
const asset = (id: string, projectId: string, title = id): BrandMediaAsset => ({
  id, tenantId: 't1', projectId, kind: 'photo', title, fileName: `${id}.jpg`, tags: ['urun'], status: 'active', createdBy: 'u',
  storage: { path: `brand-media/t1/${projectId}/${id}/${id}.jpg`, downloadUrl: url(`brand-media/t1/${projectId}/${id}/${id}.jpg`), contentType: 'image/jpeg', size: 10 },
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('LibraryPicker', () => {
  it('marka değişince eski markanın geç gelen listesi ve seçimi sızmaz', async () => {
    const a = deferred<BrandMediaAsset[]>();
    const b = deferred<BrandMediaAsset[]>();
    const load = vi.fn((_t: string, p: string) => (p === 'projA' ? a.promise : b.promise));
    const onConfirm = vi.fn();
    const { rerender } = render(
      <LibraryPicker open tenantId="t1" projectId="projA" maxSelect={10} onClose={() => {}} onConfirm={onConfirm} loadAssets={load as any} />
    );
    rerender(<LibraryPicker open tenantId="t1" projectId="projB" maxSelect={10} onClose={() => {}} onConfirm={onConfirm} loadAssets={load as any} />);
    await act(async () => {
      b.resolve([asset('b1', 'projB', 'B görsel')]);
      a.resolve([asset('a1', 'projA', 'A görsel')]);
    });
    await waitFor(() => expect(screen.getByTitle('B görsel')).toBeTruthy());
    expect(screen.queryByTitle('A görsel')).toBeNull();
  });

  it('başka projeye ait veya tutarsız kayıt gösterilmez ve onaylanmaz', async () => {
    const wrong = asset('x1', 'projB', 'Yanlış');
    const broken = { ...asset('x2', 'projA', 'Bozuk'), storage: { ...asset('x2', 'projA').storage, downloadUrl: url('avatars/u/x.png') } };
    const load = vi.fn(async () => [asset('a1', 'projA', 'Doğru'), wrong, broken]);
    const onConfirm = vi.fn();
    render(<LibraryPicker open tenantId="t1" projectId="projA" maxSelect={10} onClose={() => {}} onConfirm={onConfirm} loadAssets={load as any} />);
    await waitFor(() => expect(screen.getByTitle('Doğru')).toBeTruthy());
    expect(screen.queryByTitle('Yanlış')).toBeNull();
    expect(screen.queryByTitle('Bozuk')).toBeNull();
    fireEvent.click(screen.getByTitle('Doğru'));
    fireEvent.click(screen.getByText('Ekle (1)'));
    expect(onConfirm.mock.calls[0][0].map((x: BrandMediaAsset) => x.id)).toEqual(['a1']);
  });

  it('güvenilmeyen host veya bucket\'tan gelen kayıt listelenmez', async () => {
    const evilHost = { ...asset('e1', 'projA', 'Kötü host'), storage: { ...asset('e1', 'projA').storage, downloadUrl: asset('e1', 'projA').storage.downloadUrl.replace('firebasestorage.googleapis.com', 'evil.example.com') } };
    const evilBucket = { ...asset('e2', 'projA', 'Kötü bucket'), storage: { ...asset('e2', 'projA').storage, downloadUrl: asset('e2', 'projA').storage.downloadUrl.replace('/v0/b/b/', '/v0/b/other/') } };
    const load = vi.fn(async () => [asset('a1', 'projA', 'Doğru'), evilHost, evilBucket]);
    render(<LibraryPicker open tenantId="t1" projectId="projA" maxSelect={10} onClose={() => {}} onConfirm={() => {}} loadAssets={load as any} />);
    await waitFor(() => expect(screen.getByTitle('Doğru')).toBeTruthy());
    expect(screen.queryByTitle('Kötü host')).toBeNull();
    expect(screen.queryByTitle('Kötü bucket')).toBeNull();
  });

  it('post\'ta olan varlık tekrar seçilemez; kalan medya sınırı uygulanır', async () => {
    const load = vi.fn(async () => [asset('a1', 'projA', 'Bir'), asset('a2', 'projA', 'İki'), asset('a3', 'projA', 'Üç')]);
    const onConfirm = vi.fn();
    render(
      <LibraryPicker open tenantId="t1" projectId="projA" excludeAssetIds={['a1']} maxSelect={1} onClose={() => {}} onConfirm={onConfirm} loadAssets={load as any} />
    );
    await waitFor(() => expect(screen.getByTitle('Bir')).toBeTruthy());
    expect((screen.getByTitle('Bir') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTitle('İki'));
    fireEvent.click(screen.getByTitle('Üç'));
    fireEvent.click(screen.getByText('Ekle (1)'));
    expect(onConfirm.mock.calls[0][0].map((x: BrandMediaAsset) => x.id)).toEqual(['a2']);
  });
});
