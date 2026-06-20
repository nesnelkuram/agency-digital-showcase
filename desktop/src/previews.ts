import { getThumb } from "./scannerApi";

// Önizleme önbelleği + eşzamanlılık sınırı.
const cache = new Map<string, string | null>();
let active = 0;
const MAX = 3;
const queue: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX) {
    active++;
    return Promise.resolve();
  }
  return new Promise((res) => queue.push(res));
}
function release() {
  active--;
  const next = queue.shift();
  if (next) {
    active++;
    next();
  }
}

// driveId + rel ile önbellekli önizleme. abs null ise (offline) sadece
// daha önce önbelleğe alınmış thumbnail döner.
export async function getPreview(
  driveId: string,
  rel: string,
  abs: string | null
): Promise<string | null> {
  const key = `${driveId}|${rel}`;
  if (cache.has(key)) return cache.get(key)!;
  await acquire();
  try {
    const url = await getThumb(driveId, rel, abs).catch(() => null);
    // sadece bulunan sonucu kalıcı önbelleğe al (null'ı tekrar denemeye bırak)
    if (url) cache.set(key, url);
    return url;
  } finally {
    release();
  }
}
