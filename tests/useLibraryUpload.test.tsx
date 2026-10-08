import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/lib/firebase/config', () => ({ db: null, storage: null }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1', displayName: 'Şeyma' } }) }));

import { useLibraryUpload } from '@/studio/hooks/useLibraryUpload';
import type { UploadDeps } from '@/studio/library/uploadRunner';

const file = (name: string, size = 100, type = 'image/jpeg') => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

function controllableDeps() {
  let release: (() => void) | null = null;
  const cancel = vi.fn(() => {
    const r = reject;
    r?.(Object.assign(new Error('canceled'), { code: 'storage/canceled' }));
  });
  let reject: ((e: Error) => void) | null = null;
  const deps: UploadDeps & { writeRecord: ReturnType<typeof vi.fn> } = {
    startUpload: vi.fn(() => ({
      done: new Promise<void>((res, rej) => {
        release = res;
        reject = rej;
      }),
      pause: vi.fn(),
      resume: vi.fn(),
      cancel,
    })),
    getUrl: vi.fn(async (p: string) => `https://firebasestorage.googleapis.com/v0/b/b/o/${encodeURIComponent(p)}?alt=media&token=t`),
    readMetadata: vi.fn(async () => ({})),
    makeThumbnail: vi.fn(async () => undefined),
    recordExists: vi.fn(async () => false),
    writeRecord: vi.fn(async () => {}),
  };
  return { deps, release: () => release?.(), cancel };
}

describe('useLibraryUpload', () => {
  it('1 GB üstü dosya kuyruğa alınmaz', () => {
    const { deps } = controllableDeps();
    const { result } = renderHook(() => useLibraryUpload({ tenantId: 't1', projectId: 'projA', deps, newId: () => 'a1' }));
    let errors: string[] = [];
    act(() => {
      errors = result.current.enqueue([file('buyuk.mp4', 1_000_000_001, 'video/mp4')], []);
    });
    expect(errors[0]).toMatch(/1 GB/);
    expect(result.current.items).toHaveLength(0);
  });

  it('marka değişince süren yükleme iptal edilir, kuyruk temizlenir ve kayıt yazılmaz', async () => {
    const { deps, cancel } = controllableDeps();
    let n = 0;
    const { result, rerender } = renderHook((p: { projectId: string }) =>
      useLibraryUpload({ tenantId: 't1', projectId: p.projectId, deps, newId: () => `a${++n}` }), { initialProps: { projectId: 'projA' } });
    act(() => {
      result.current.enqueue([file('a.jpg')], []);
    });
    await waitFor(() => expect(deps.startUpload).toHaveBeenCalledTimes(1));
    rerender({ projectId: 'projB' });
    expect(cancel).toHaveBeenCalled();
    expect(result.current.items).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.writeRecord).not.toHaveBeenCalled();
  });

  it('unmount süren yüklemeyi iptal eder; kayıt yazılmaz', async () => {
    const { deps, cancel } = controllableDeps();
    const { result, unmount } = renderHook(() => useLibraryUpload({ tenantId: 't1', projectId: 'projA', deps, newId: () => 'a1' }));
    act(() => {
      result.current.enqueue([file('a.jpg')], []);
    });
    await waitFor(() => expect(deps.startUpload).toHaveBeenCalled());
    unmount();
    expect(cancel).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.writeRecord).not.toHaveBeenCalled();
  });

  it('tamamlanınca katalog kaydı yazılır ve onAssetCreated çağrılır', async () => {
    const { deps, release } = controllableDeps();
    const onAssetCreated = vi.fn();
    const { result } = renderHook(() => useLibraryUpload({ tenantId: 't1', projectId: 'projA', deps, newId: () => 'a1', onAssetCreated }));
    act(() => {
      result.current.enqueue([file('a.jpg')], ['urun']);
    });
    await waitFor(() => expect(deps.startUpload).toHaveBeenCalled());
    await act(async () => release());
    await waitFor(() => expect(result.current.items[0].status).toBe('done'));
    expect(deps.writeRecord).toHaveBeenCalledTimes(1);
    expect(deps.writeRecord.mock.calls[0][0]).toMatchObject({ projectId: 'projA', tags: ['urun'] });
    expect(onAssetCreated).toHaveBeenCalled();
  });

  it('kullanıcı iptali: kayıt yazılmaz', async () => {
    const { deps } = controllableDeps();
    const { result } = renderHook(() => useLibraryUpload({ tenantId: 't1', projectId: 'projA', deps, newId: () => 'a1' }));
    act(() => {
      result.current.enqueue([file('a.jpg')], []);
    });
    await waitFor(() => expect(deps.startUpload).toHaveBeenCalled());
    await act(async () => result.current.cancel('a1'));
    await waitFor(() => expect(result.current.items[0].status).toBe('canceled'));
    expect(deps.writeRecord).not.toHaveBeenCalled();
  });

  it('duraklat/devam yükleme tutamacına iletilir; ilerleme olayı duraklatmayı ezmez', async () => {
    const { deps } = controllableDeps();
    const { result } = renderHook(() => useLibraryUpload({ tenantId: 't1', projectId: 'projA', deps, newId: () => 'a1' }));
    act(() => {
      result.current.enqueue([file('a.jpg')], []);
    });
    await waitFor(() => expect(deps.startUpload).toHaveBeenCalled());
    const h = (deps.startUpload as any).mock.results[0].value;
    const onProgress = (deps.startUpload as any).mock.calls[0][3];
    act(() => result.current.pause('a1'));
    expect(h.pause).toHaveBeenCalled();
    act(() => onProgress(0.5));
    expect(result.current.items[0].status).toBe('paused');
    act(() => result.current.resume('a1'));
    expect(h.resume).toHaveBeenCalled();
    expect(result.current.items[0].status).toBe('uploading');
  });

  it('kayıt yazılırken iptal kabul edilmez ve "iptal edildi" denmez', async () => {
    const { deps, release } = controllableDeps();
    let finish!: () => void;
    deps.writeRecord.mockImplementation(() => new Promise<void>((r) => (finish = r)));
    const { result } = renderHook(() => useLibraryUpload({ tenantId: 't1', projectId: 'projA', deps, newId: () => 'a1' }));
    act(() => {
      result.current.enqueue([file('a.jpg')], []);
    });
    await waitFor(() => expect(deps.startUpload).toHaveBeenCalled());
    await act(async () => release());
    await waitFor(() => expect(result.current.items[0].status).toBe('saving'));
    act(() => result.current.cancel('a1'));
    expect(result.current.items[0].status).toBe('saving');
    await act(async () => finish());
    await waitFor(() => expect(result.current.items[0].status).toBe('done'));
    expect(deps.writeRecord).toHaveBeenCalledTimes(1);
  });

  it('kayıt yazılırken marka değişirse: kayıt tamamlanır ama yeni markada onAssetCreated/durum güncellemesi olmaz', async () => {
    const { deps, release } = controllableDeps();
    let finish!: () => void;
    deps.writeRecord.mockImplementation(() => new Promise<void>((r) => (finish = r)));
    const onAssetCreated = vi.fn();
    const { result, rerender } = renderHook((p: { projectId: string }) =>
      useLibraryUpload({ tenantId: 't1', projectId: p.projectId, deps, newId: () => 'a1', onAssetCreated }), { initialProps: { projectId: 'projA' } });
    act(() => {
      result.current.enqueue([file('a.jpg')], []);
    });
    await waitFor(() => expect(deps.startUpload).toHaveBeenCalled());
    await act(async () => release());
    await waitFor(() => expect(result.current.items[0]?.status).toBe('saving'));
    rerender({ projectId: 'projB' });
    expect(result.current.items).toHaveLength(0);
    await act(async () => finish());
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.writeRecord).toHaveBeenCalledTimes(1);
    expect(deps.writeRecord.mock.calls[0][0].projectId).toBe('projA');
    expect(onAssetCreated).not.toHaveBeenCalled();
    expect(result.current.items).toHaveLength(0);
  });

  it('hata sonrası tekrar dene: kalan adımdan devam eder', async () => {
    const { deps, release } = controllableDeps();
    deps.writeRecord.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    const { result } = renderHook(() => useLibraryUpload({ tenantId: 't1', projectId: 'projA', deps, newId: () => 'a1' }));
    act(() => {
      result.current.enqueue([file('a.jpg')], []);
    });
    await waitFor(() => expect(deps.startUpload).toHaveBeenCalled());
    await act(async () => release());
    await waitFor(() => expect(result.current.items[0].status).toBe('error'));
    await act(async () => result.current.retry('a1'));
    await waitFor(() => expect(result.current.items[0].status).toBe('done'));
    expect(deps.startUpload).toHaveBeenCalledTimes(1);
    expect(deps.writeRecord).toHaveBeenCalledTimes(2);
  });
});
