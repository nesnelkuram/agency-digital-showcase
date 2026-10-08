import { describe, it, expect, vi } from 'vitest';
import { prepareItem, runUploadItem, type UploadDeps, type UploadHandle, type UploadItem } from '@/studio/library/uploadRunner';

vi.mock('@/lib/firebase/config', () => ({ db: null, storage: null }));

const file = (name = 'final.mp4', type = 'video/mp4', size = 1234) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

function handle(result: 'ok' | Error = 'ok'): UploadHandle {
  return {
    done: result === 'ok' ? Promise.resolve() : Promise.reject(result),
    pause: vi.fn(),
    resume: vi.fn(),
    cancel: vi.fn(),
  };
}

function deps(over: Partial<UploadDeps> = {}) {
  const d = {
    startUpload: vi.fn((_p: string) => handle()),
    getUrl: vi.fn(async (p: string) => `https://firebasestorage.googleapis.com/v0/b/b/o/${encodeURIComponent(p)}?alt=media&token=t`),
    readMetadata: vi.fn(async () => ({ width: 1080, height: 1920, duration: 20 })),
    makeThumbnail: vi.fn(async () => new Blob(['j'], { type: 'image/jpeg' })),
    recordExists: vi.fn(async () => false),
    writeRecord: vi.fn(async () => {}),
    ...over,
  };
  return d as typeof d & UploadDeps;
}

function item(f = file()): UploadItem {
  const r = prepareItem(f, { tenantId: 't1', projectId: 'projA', assetId: 'a1', tags: ['urun'] });
  if (!r.ok) throw new Error(r.error);
  return r.item;
}

const run = (it: UploadItem, d: UploadDeps, aborted = () => false) =>
  runUploadItem(it, d, { uid: 'u1', displayName: 'Şeyma' }, { update: () => {}, isAborted: aborted, setHandle: () => {} });

describe('prepareItem', () => {
  it('1 GB sınırı ve güvenli kimlikler', () => {
    expect(prepareItem(file('a.mp4', 'video/mp4', 1_000_000_001), { tenantId: 't1', projectId: 'p', assetId: 'a', tags: [] }).ok).toBe(false);
    expect(prepareItem(file('a.mp4', 'video/mp4', 1_000_000_000), { tenantId: 't1', projectId: 'p', assetId: 'a', tags: [] }).ok).toBe(true);
    expect(prepareItem(file(), { tenantId: 't1', projectId: '../x', assetId: 'a', tags: [] }).ok).toBe(false);
  });
  it('yol varlık klasöründe', () => {
    expect(item().mainPath).toBe('brand-media/t1/projA/a1/final.mp4');
  });
});

describe('runUploadItem', () => {
  it('kayıt yalnız dosyalar tamamlandıktan sonra ve tutarlı alanlarla yazılır', async () => {
    const d = deps();
    const order: string[] = [];
    d.startUpload.mockImplementation((p: string) => {
      order.push(`upload:${p.split('/').pop()}`);
      return handle();
    });
    d.writeRecord.mockImplementation(async () => {
      order.push('record');
    });
    const res = await run(item(), d);
    expect(res.status).toBe('done');
    expect(order).toEqual(['upload:final.mp4', 'upload:thumb.jpg', 'record']);
    const rec = d.writeRecord.mock.calls[0][0];
    expect(rec).toMatchObject({
      assetId: 'a1', tenantId: 't1', projectId: 'projA', kind: 'video', tags: ['urun'], createdBy: 'u1',
      storage: { path: 'brand-media/t1/projA/a1/final.mp4', thumbPath: 'brand-media/t1/projA/a1/thumb.jpg', contentType: 'video/mp4', size: 1234, duration: 20 },
    });
  });

  it('ana yükleme iptal edilirse kayıt yazılmaz', async () => {
    const d = deps({ startUpload: vi.fn(() => handle(Object.assign(new Error('c'), { code: 'storage/canceled' }))) });
    const res = await run(item(), d);
    expect(res.status).toBe('canceled');
    expect(d.writeRecord).not.toHaveBeenCalled();
  });

  it('dosya bittikten sonra iptal / sayfadan çıkış: kayıt yazılmaz', async () => {
    let abort = false;
    const d = deps({ makeThumbnail: vi.fn(async () => { abort = true; return undefined; }) });
    const res = await run(item(), d, () => abort);
    expect(res.status).toBe('canceled');
    expect(d.writeRecord).not.toHaveBeenCalled();
  });

  it('kayıt hatası → tekrar dene: dosya yeniden yüklenmez, kayıt bir kez yazılır', async () => {
    const d = deps({ writeRecord: vi.fn().mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' })).mockResolvedValue(undefined) });
    const first = await run(item(), d);
    expect(first.status).toBe('error');
    expect(first.error).toMatch(/Tekrar dene/);
    const uploadsBefore = d.startUpload.mock.calls.length;
    const second = await run({ ...first, status: 'queued' }, d);
    expect(second.status).toBe('done');
    expect(d.startUpload.mock.calls.length).toBe(uploadsBefore);
    expect(d.writeRecord).toHaveBeenCalledTimes(2);
  });

  it('kayıt yazılmış ama yanıt kaybolmuş: tekrar denemede ikinci kayıt yazılmaz', async () => {
    const d = deps({ writeRecord: vi.fn().mockRejectedValueOnce(new Error('timeout')) });
    const first = await run(item(), d);
    d.recordExists.mockResolvedValue(true);
    const second = await run({ ...first, status: 'queued' }, d);
    expect(second.status).toBe('done');
    expect(d.writeRecord).toHaveBeenCalledTimes(1);
  });

  it('ana dosya sunucuda tamamlanmış ama istemci hata almışsa tekrar denemede yeniden yüklenmez (write-once)', async () => {
    const d = deps();
    d.startUpload.mockReturnValueOnce(handle(new Error('network')));
    const first = await run(item(), d);
    expect(first.status).toBe('error');
    const second = await run({ ...first, status: 'queued' }, d);
    expect(second.status).toBe('done');
    const mainUploads = d.startUpload.mock.calls.filter((c) => !String(c[0]).endsWith('thumb.jpg'));
    expect(mainUploads).toHaveLength(1);
  });

  it('önizleme üretilemezse önizlemesiz kayıt', async () => {
    const d = deps({ makeThumbnail: vi.fn(async () => { throw new Error('canvas'); }) });
    const res = await run(item(), d);
    expect(res.status).toBe('done');
    expect(d.writeRecord.mock.calls[0][0].storage).not.toHaveProperty('thumbPath');
  });

  it('yetki hatası anlaşılır mesajla döner', async () => {
    const d = deps({ startUpload: vi.fn(() => handle(Object.assign(new Error('x'), { code: 'storage/unauthorized' }))) });
    const res = await run(item(), d);
    expect(res.status).toBe('error');
    expect(res.error).toMatch(/yetkiniz yok/);
  });
});
