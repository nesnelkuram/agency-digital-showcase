import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, render, screen, fireEvent, act, waitFor } from '@testing-library/react';

vi.mock('@/lib/firebase/config', () => ({ db: null, storage: null }));
const auth = vi.hoisted(() => ({ user: { uid: 'u1', displayName: 'Şeyma' } as any }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));

import { useLibraryUpload } from '@/studio/hooks/useLibraryUpload';
import { StudioUploadProvider, useUploadServiceOptional } from '@/studio/contexts/StudioUploadContext';
import { mkFile, multiDeps, until } from './helpers/uploadDeps';

function harness() {
  const m = multiDeps();
  let n = 0;
  const afterCreate = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <StudioUploadProvider deps={m.deps} newId={() => `a${++n}`} afterCreate={afterCreate}>
      {children}
    </StudioUploadProvider>
  );
  return { ...m, wrapper, afterCreate };
}

describe('useLibraryUpload (uygulama düzeyi kuyruk üzerinde ince kanca)', () => {
  it('1 GB üstü dosya kuyruğa alınmaz', () => {
    const h = harness();
    const { result } = renderHook(() => useLibraryUpload({ tenantId: 't1', projectId: 'projA' }), { wrapper: h.wrapper });
    let errors: string[] = [];
    act(() => {
      errors = result.current.enqueue([mkFile('buyuk.mp4', 1_000_000_001, 'video/mp4')], []);
    });
    expect(errors[0]).toMatch(/1 GB/);
    expect(result.current.items).toHaveLength(0);
  });

  it('marka değişimi yüklemeyi İPTAL ETMEZ; iş eski markaya yazılır, yeni marka eski satırları görmez', async () => {
    const h = harness();
    const created: string[] = [];
    const { result, rerender } = renderHook(
      (p: { projectId: string }) => useLibraryUpload({ tenantId: 't1', projectId: p.projectId, projectName: p.projectId, onAssetCreated: (id) => created.push(id) }),
      { wrapper: h.wrapper, initialProps: { projectId: 'projA' } }
    );
    act(() => {
      result.current.enqueue([mkFile('a.jpg')], []);
    });
    await until(() => h.deps.startUpload.mock.calls.length === 1);
    rerender({ projectId: 'projB' });
    expect(h.mainHandles()[0].h.cancel).not.toHaveBeenCalled();
    expect(result.current.items).toHaveLength(0); // projB yalnız kendi satırlarını görür
    await act(async () => h.mainHandles()[0].release());
    await until(() => h.deps.writeRecord.mock.calls.length === 1);
    expect(h.deps.writeRecord.mock.calls[0][0]).toMatchObject({ tenantId: 't1', projectId: 'projA', createdBy: 'u1' });
    expect(created).toEqual([]); // projB sayfası projA'nın bitişini tazeleme olarak almaz
    rerender({ projectId: 'projA' });
    await waitFor(() => expect(result.current.items[0]?.status).toBe('done'));
  });

  it('sayfa (kanca) unmount olsa da yükleme sürer ve kayıt yazılır; bildirim gider', async () => {
    const h = harness();
    const probe = renderHook(() => useUploadServiceOptional(), { wrapper: h.wrapper });
    const { result, unmount } = renderHook(() => useLibraryUpload({ tenantId: 't1', projectId: 'projA' }), { wrapper: h.wrapper });
    // aynı sağlayıcıyı paylaşmak için tek ağaçta kur
    unmount();
    probe.unmount();
    const both = renderHook(
      () => ({ page: useLibraryUpload({ tenantId: 't1', projectId: 'projA' }), svc: useUploadServiceOptional() }),
      { wrapper: h.wrapper }
    );
    act(() => {
      both.result.current.page.enqueue([mkFile('a.jpg')], ['urun']);
    });
    await until(() => h.deps.startUpload.mock.calls.length === 1);
    const svc = both.result.current.svc!;
    // sayfa kancası kaldırılır; sağlayıcı (uygulama) ayakta
    expect(result.current).toBeDefined();
    await act(async () => h.mainHandles()[0].release());
    await until(() => svc.getSnapshot().summary.done === 1);
    expect(h.deps.writeRecord.mock.calls[0][0]).toMatchObject({ projectId: 'projA', tags: ['urun'] });
    expect(h.afterCreate).toHaveBeenCalledWith({ tenantId: 't1', projectId: 'projA', assetId: 'a1' });
  });

  it('bu markada kayıt yazılınca sayfa onAssetCreated ile tazelenir', async () => {
    const h = harness();
    const onAssetCreated = vi.fn();
    const { result } = renderHook(() => useLibraryUpload({ tenantId: 't1', projectId: 'projA', onAssetCreated }), { wrapper: h.wrapper });
    act(() => {
      result.current.enqueue([mkFile('a.jpg')], []);
    });
    await until(() => h.deps.startUpload.mock.calls.length === 1);
    await act(async () => h.mainHandles()[0].release());
    await waitFor(() => expect(onAssetCreated).toHaveBeenCalledWith('a1'));
  });

  it('oturum açık değilse kuyruğa alınmaz', () => {
    const h = harness();
    auth.user = null;
    try {
      const { result } = renderHook(() => useLibraryUpload({ tenantId: 't1', projectId: 'projA' }), { wrapper: h.wrapper });
      expect(result.current.enqueue([mkFile('a.jpg')], [])[0]).toMatch(/Oturum/);
    } finally {
      auth.user = { uid: 'u1', displayName: 'Şeyma' };
    }
  });
});

describe('UploadTray (tek toplam çubuk)', () => {
  function Page({ projectId, name }: { projectId: string; name: string }) {
    const up = useLibraryUpload({ tenantId: 't1', projectId, projectName: name });
    return <button onClick={() => up.enqueue(Array.from({ length: 22 }, (_, i) => mkFile(`f${i}.jpg`, 1000, 'image/jpeg', i + 1)), [])}>ekle-{name}</button>;
  }

  it('22 dosya tek çubukta: varsayılanda satırlar gizli; Ayrıntı açılınca dosya durumları görünür', async () => {
    const h = harness();
    const { rerender } = render(
      <StudioUploadProvider deps={h.deps} newId={(() => { let n = 0; return () => `x${++n}`; })()} afterCreate={h.afterCreate}>
        <Page projectId="projA" name="HAL" />
      </StudioUploadProvider>
    );
    fireEvent.click(screen.getByText('ekle-HAL'));
    expect(await screen.findByTestId('upload-tray')).toBeTruthy();
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.getByTestId('upload-tray-count').textContent).toBe('0/22 dosya kütüphaneye eklendi');
    expect(screen.queryAllByTestId('upload-row')).toHaveLength(0);
    expect(screen.getByText(/yenilerseniz biten dosyalar kalır/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Dosya ayrıntıları'));
    expect(screen.getAllByTestId('upload-row')).toHaveLength(22);
    expect(screen.getAllByText(/HAL/).length).toBeGreaterThan(0);

    // marka değişimi (sayfa yeniden render) tepsiyi ve işi etkilemez
    rerender(
      <StudioUploadProvider deps={h.deps} afterCreate={h.afterCreate}>
        <Page projectId="projB" name="Rakle" />
      </StudioUploadProvider>
    );
    expect(screen.getByTestId('upload-tray')).toBeTruthy();
    expect(h.mainHandles()[0].h.cancel).not.toHaveBeenCalled();
  });

  it('Duraklat → "kuyruk duraklatıldı", Devam geri alır', async () => {
    const h = harness();
    render(
      <StudioUploadProvider deps={h.deps} newId={(() => { let n = 0; return () => `y${++n}`; })()} afterCreate={h.afterCreate}>
        <Page projectId="projA" name="HAL" />
      </StudioUploadProvider>
    );
    fireEvent.click(screen.getByText('ekle-HAL'));
    await screen.findByTestId('upload-tray');
    await until(() => h.mainHandles().length === 1);
    fireEvent.click(screen.getByText('Duraklat'));
    expect(screen.getByText(/kuyruk duraklatıldı/)).toBeTruthy();
    expect(h.mainHandles()[0].h.pause).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Devam'));
    expect(screen.queryByText(/kuyruk duraklatıldı/)).toBeNull();
  });
});
