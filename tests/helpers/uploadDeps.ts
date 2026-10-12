import { vi } from 'vitest';
import type { UploadDeps } from '@/studio/library/uploadRunner';

export const mkFile = (name: string, size = 100, type = 'image/jpeg', lastModified = 1) => {
  const f = new File(['x'], name, { type, lastModified });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

/** Her startUpload çağrısı kendi tutamacını üretir; test tek tek tamamlar/hata verir (gerçek Storage yok) */
export function multiDeps() {
  const handles: Array<{ path: string; release: () => void; fail: (e: unknown) => void; progress: (f: number) => void; h: any }> = [];
  const deps: UploadDeps & { writeRecord: ReturnType<typeof vi.fn>; startUpload: ReturnType<typeof vi.fn> } = {
    startUpload: vi.fn((path: string, _d: Blob, _c: string, onProgress: (f: number) => void) => {
      let release!: () => void;
      let fail!: (e: unknown) => void;
      const done = new Promise<void>((res, rej) => {
        release = res;
        fail = rej;
      });
      const h = {
        done,
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(() => fail(Object.assign(new Error('canceled'), { code: 'storage/canceled' }))),
      };
      handles.push({ path, release, fail, progress: onProgress, h });
      return h;
    }),
    getUrl: vi.fn<(p: string) => Promise<string>>(async (p: string) => `https://firebasestorage.googleapis.com/v0/b/b/o/${encodeURIComponent(p)}?alt=media&token=t`),
    readMetadata: vi.fn(async () => ({})),
    makeThumbnail: vi.fn(async () => undefined),
    recordExists: vi.fn(async () => false),
    writeRecord: vi.fn(async () => {}),
  };
  return { deps, handles, mainHandles: () => handles.filter((h) => !h.path.endsWith('thumb.jpg')) };
}

export const tick = () => new Promise((r) => setTimeout(r, 0));
export async function until(cond: () => boolean, ms = 1500) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('until: zaman aşımı');
    await tick();
  }
}
