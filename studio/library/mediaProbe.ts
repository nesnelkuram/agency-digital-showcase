/**
 * Tarayıcıda metadata ve önizleme üretimi. Dosya belleğe okunmaz; object URL ile tarayıcı akıtır.
 * Ölçülemeyen değer boş bırakılır (uygunluk kontrolü bunu "doğrulanamadı" sayar).
 */

const PROBE_TIMEOUT_MS = 15_000;

function withObjectUrl<T>(file: File, fn: (url: string, done: (v: T) => void) => void, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    let settled = false;
    const done = (v: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(v);
    };
    const timer = setTimeout(() => done(fallback), PROBE_TIMEOUT_MS);
    try {
      fn(url, done);
    } catch {
      done(fallback);
    }
  });
}

const positive = (n: number) => (Number.isFinite(n) && n > 0 ? n : undefined);

export function readMediaMetadata(file: File): Promise<{ width?: number; height?: number; duration?: number }> {
  if (file.type.startsWith('image/')) {
    return withObjectUrl(
      file,
      (url, done) => {
        const img = new Image();
        img.onload = () => done({ width: positive(img.naturalWidth), height: positive(img.naturalHeight) });
        img.onerror = () => done({});
        img.src = url;
      },
      {}
    );
  }
  if (file.type.startsWith('video/')) {
    return withObjectUrl(
      file,
      (url, done) => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.muted = true;
        v.onloadedmetadata = () => done({ width: positive(v.videoWidth), height: positive(v.videoHeight), duration: positive(v.duration) });
        v.onerror = () => done({});
        v.src = url;
      },
      {}
    );
  }
  return Promise.resolve({});
}

function canvasToJpeg(source: CanvasImageSource, w: number, h: number, maxDim: number): Promise<Blob | undefined> {
  const ratio = Math.min(maxDim / w, maxDim / h, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * ratio));
  canvas.height = Math.max(1, Math.round(h * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(undefined);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b || undefined), 'image/jpeg', 0.82));
}

/** Küçük JPEG önizleme (görsel: 480px, video: ilk kare 720px). Üretilemezse undefined. */
export function makeThumbnail(file: File): Promise<Blob | undefined> {
  if (file.type.startsWith('image/')) {
    return withObjectUrl<Blob | undefined>(
      file,
      (url, done) => {
        const img = new Image();
        img.onload = () => canvasToJpeg(img, img.naturalWidth, img.naturalHeight, 480).then(done, () => done(undefined));
        img.onerror = () => done(undefined);
        img.src = url;
      },
      undefined
    );
  }
  if (file.type.startsWith('video/')) {
    return withObjectUrl<Blob | undefined>(
      file,
      (url, done) => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.muted = true;
        v.playsInline = true;
        v.onloadedmetadata = () => {
          v.currentTime = Math.min(0.1, (v.duration || 1) / 2);
        };
        v.onseeked = () => canvasToJpeg(v, v.videoWidth, v.videoHeight, 720).then(done, () => done(undefined));
        v.onerror = () => done(undefined);
        v.src = url;
      },
      undefined
    );
  }
  return Promise.resolve(undefined);
}
