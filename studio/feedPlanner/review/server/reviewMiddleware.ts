import fs from 'node:fs';
import path from 'node:path';

/**
 * Yerel inceleme sunucusu (yalnız geliştirme). Yalnız loopback, yalnız GET, yalnız fixture'daki
 * allowlist anahtarları. Dosya yolları istemciye verilmez; kök dizinler ortam değişkeninden gelir.
 */
export interface ReviewRoots {
  codex?: string;
  history?: string;
}

export interface ReviewServerOptions {
  roots: ReviewRoots;
  fixturePath: string;
}

interface AssetEntry {
  root: keyof ReviewRoots;
  rel: string;
}

const LOOPBACK_ADDR = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOOPBACK_HOST = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const KEY_RE = /^[a-z0-9-]{1,40}$/;
const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

interface Req {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
}
interface Res {
  statusCode: number;
  setHeader(k: string, v: string): void;
  end(body?: string | Buffer): void;
}

const send = (res: Res, status: number, body: string | Buffer, type = 'text/plain; charset=utf-8') => {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(body);
};

export const isLoopbackRequest = (req: Req): boolean => {
  const addr = req.socket.remoteAddress || '';
  const hostHeader = String(req.headers.host || '').toLowerCase();
  const host = hostHeader.startsWith('[') ? hostHeader.slice(0, hostHeader.indexOf(']') + 1) : hostHeader.split(':')[0];
  return LOOPBACK_ADDR.has(addr) && LOOPBACK_HOST.has(host);
};

export function createReviewMiddleware(opts: ReviewServerOptions) {
  // Fixture dosyası değişirse (yeniden üretildiğinde) sunucuyu yeniden başlatmadan güncel hâli okunur.
  let cache: { key: string; assets: Record<string, AssetEntry>; publicFixture: Record<string, unknown> } | null = null;
  const load = () => {
    const st = fs.statSync(opts.fixturePath);
    const key = `${st.mtimeMs}:${st.size}`;
    if (!cache || cache.key !== key) {
      const { assets, ...publicFixture } = JSON.parse(fs.readFileSync(opts.fixturePath, 'utf8')) as {
        assets: Record<string, AssetEntry>;
        [k: string]: unknown;
      };
      cache = { key, assets, publicFixture };
    }
    return cache;
  };
  return (req: Req, res: Res, next: () => void) => {
    const url = (req.url || '').split('?')[0];
    if (!url.startsWith('/__review/')) return next();
    if (!isLoopbackRequest(req)) return send(res, 403, 'Yalnız yerel (loopback) istemci.');
    if ((req.method || 'GET').toUpperCase() !== 'GET') return send(res, 405, 'Yalnız GET.');

    let fx: ReturnType<typeof load>;
    try {
      fx = load();
    } catch {
      return send(res, 500, 'Fixture okunamadı.');
    }
    if (url === '/__review/fixture') {
      return send(res, 200, JSON.stringify(fx.publicFixture), 'application/json; charset=utf-8');
    }
    const m = /^\/__review\/asset\/([a-z0-9-]{1,40})$/.exec(url);
    if (!m || !KEY_RE.test(m[1])) return send(res, 404, 'Bulunamadı.');
    const entry = Object.prototype.hasOwnProperty.call(fx.assets, m[1]) ? fx.assets[m[1]] : undefined;
    if (!entry) return send(res, 404, 'Bulunamadı.');
    const dir = opts.roots[entry.root];
    if (!dir) return send(res, 404, 'Kök dizin tanımlı değil.');
    const base = path.resolve(dir);
    const file = path.resolve(base, entry.rel);
    const type = TYPES[path.extname(file).toLowerCase()];
    if (!type || !file.startsWith(base + path.sep)) return send(res, 400, 'Geçersiz varlık.');
    if (!fs.existsSync(file)) return send(res, 404, 'Dosya yok.');
    return send(res, 200, fs.readFileSync(file), type);
  };
}
