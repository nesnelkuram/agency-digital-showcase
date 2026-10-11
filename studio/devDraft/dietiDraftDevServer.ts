/**
 * Yalnız geliştirme sunucusu: yerel Dieci taslak kaynağını (plan JSON, manifest, 9 fotoğraf) salt okunur sunar.
 * - Vite configureServer'a takılır (apply: 'serve'); production build'e girmez.
 * - Yalnız loopback istemci + loopback Host (DNS rebinding'e karşı); yalnız GET.
 * - Yalnız manifest'te listelenen 9 varlık sunulur; Downloads klasörünün tamamı sunulmaz.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DIECI_DRAFT_BASE } from './draftPaths';

const LOOPBACK_ADDR = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOOPBACK_HOST = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

interface Req { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }
interface Res { statusCode: number; setHeader(k: string, v: string): void; end(body?: string | Buffer): void }

export interface DraftSourceOptions {
  planPath?: string;
  manifestPath?: string;
  previewDir?: string;
  originalsDir?: string;
}

export const draftOptionsFromEnv = (env: NodeJS.ProcessEnv): DraftSourceOptions => {
  const dir = env.DIECI_DRAFT_DIR;
  if (!dir) return {};
  return {
    planPath: path.join(dir, 'plan-2026-10-12-18.json'),
    manifestPath: path.join(dir, 'dieci-selected-originals', 'manifest.json'),
    previewDir: path.join(dir, 'web-previews'),
    originalsDir: env.DIECI_ORIGINALS_DIR || undefined,
  };
};

const send = (res: Res, status: number, body: string | Buffer, type = 'text/plain; charset=utf-8') => {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(body);
};

const isLoopback = (req: Req) => {
  const addr = req.socket.remoteAddress || '';
  const hostHeader = String(req.headers.host || '').toLowerCase();
  const host = hostHeader.startsWith('[') ? hostHeader.slice(0, hostHeader.indexOf(']') + 1) : hostHeader.split(':')[0];
  return LOOPBACK_ADDR.has(addr) && LOOPBACK_HOST.has(host);
};

export const createDietiDraftMiddleware = (opts: DraftSourceOptions) => (req: Req, res: Res, next: () => void) => {
  const url = (req.url || '').split('?')[0];
  if (!url.startsWith(DIECI_DRAFT_BASE + '/')) return next();
  if (!isLoopback(req)) return send(res, 403, 'Yalnız yerel (loopback) istemci.');
  if ((req.method || 'GET').toUpperCase() !== 'GET') return send(res, 405, 'Yalnız GET.');
  if (!opts.planPath || !opts.manifestPath || !opts.previewDir) return send(res, 404, 'Yerel taslak kaynağı tanımlı değil (DIECI_DRAFT_DIR).');

  const rel = url.slice(DIECI_DRAFT_BASE.length + 1);
  let manifest: any;
  try { manifest = JSON.parse(fs.readFileSync(opts.manifestPath, 'utf8')); } catch { return send(res, 404, 'Manifest okunamadı.'); }

  if (rel === 'plan.json') {
    try { return send(res, 200, fs.readFileSync(opts.planPath, 'utf8'), 'application/json; charset=utf-8'); } catch { return send(res, 404, 'Plan okunamadı.'); }
  }
  if (rel === 'manifest.json') return send(res, 200, JSON.stringify(manifest), 'application/json; charset=utf-8');

  const m = /^(preview|original)\/([A-Za-z0-9_-]{5,40})\.jpg$/.exec(rel);
  if (!m) return send(res, 404, 'Bulunamadı.');
  const [, kind, assetId] = m;
  const item = (manifest.items || []).find((x: any) => x.asset_id === assetId);
  if (!item) return send(res, 404, 'Bulunamadı.');
  let file: string;
  let base: string;
  if (kind === 'preview') { base = path.resolve(opts.previewDir); file = path.resolve(base, `${assetId}.jpg`); }
  else {
    if (!opts.originalsDir) return send(res, 404, 'Orijinal klasörü tanımlı değil (DIECI_ORIGINALS_DIR).');
    base = path.resolve(opts.originalsDir);
    file = path.resolve(base, path.basename(String(item.filename)));
  }
  if (!file.startsWith(base + path.sep)) return send(res, 400, 'Geçersiz yol.');
  if (!fs.existsSync(file)) return send(res, 404, 'Dosya yok.');
  return send(res, 200, fs.readFileSync(file), 'image/jpeg');
};
