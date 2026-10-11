// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createReviewMiddleware } from '@/studio/feedPlanner/review/server/reviewMiddleware';

let dir: string;
let mw: ReturnType<typeof createReviewMiddleware>;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-'));
  fs.mkdirSync(path.join(dir, 'codex', 'previews'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'codex', 'previews', 'a.jpg'), Buffer.from([1, 2, 3]));
  fs.writeFileSync(path.join(dir, 'codex', 'secret.txt'), 'gizli');
  fs.writeFileSync(path.join(dir, 'codex', 'previews', 'n.txt'), 'x');
  fs.writeFileSync(path.join(dir, 'fixture.json'), JSON.stringify({
    candidates: [], assets: {
      a001: { root: 'codex', rel: 'previews/a.jpg' }, a002: { root: 'codex', rel: '../secret.txt' }, a003: { root: 'codex', rel: 'previews/n.txt' },
      a004: { root: 'history', rel: 'x.jpg' }, a005: { root: 'codex', rel: 'previews/yok.jpg' },
    },
  }));
  mw = createReviewMiddleware({ roots: { codex: path.join(dir, 'codex') }, fixturePath: path.join(dir, 'fixture.json') });
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const call = (o: { url: string; method?: string; remote?: string; host?: string }) =>
  new Promise<{ status: number; body: string; type: string }>((resolve) => {
    const h: Record<string, string> = {};
    const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { h[k.toLowerCase()] = v; }, end: (b?: any) => resolve({ status: res.statusCode, body: b ? b.toString() : '', type: h['content-type'] || '' }) };
    mw({ url: o.url, method: o.method ?? 'GET', headers: { host: o.host ?? '127.0.0.1:5175' }, socket: { remoteAddress: o.remote ?? '127.0.0.1' } }, res, () => resolve({ status: 999, body: 'NEXT', type: '' }));
  });

describe('inceleme sunucusu: loopback + allowlist', () => {
  it('fixture yolları sızdırmaz; allowlist anahtarı görseli verir', async () => {
    const f = await call({ url: '/__review/fixture' });
    expect(f.status).toBe(200);
    expect(JSON.parse(f.body).assets).toBeUndefined();
    const a = await call({ url: '/__review/asset/a001' });
    expect(a.status).toBe(200);
    expect(a.type).toBe('image/jpeg');
  });
  it('allowlist dışı, kök dışı, yanlış uzantı, tanımsız kök ve olmayan dosya reddedilir', async () => {
    expect((await call({ url: '/__review/asset/zzz' })).status).toBe(404);
    expect((await call({ url: '/__review/asset/a002' })).status).toBe(400); // ../secret.txt
    expect((await call({ url: '/__review/asset/a003' })).status).toBe(400); // .txt
    expect((await call({ url: '/__review/asset/a004' })).status).toBe(404); // history kökü tanımsız
    expect((await call({ url: '/__review/asset/a005' })).status).toBe(404);
    expect((await call({ url: '/__review/asset/..%2Fsecret' })).status).toBe(404);
    expect((await call({ url: '/__review/asset/constructor' })).status).toBe(404);
  });
  it('loopback dışı istemci, yabancı Host ve yazma yöntemleri reddedilir; diğer yollar geçer', async () => {
    expect((await call({ url: '/__review/fixture', remote: '10.0.0.7' })).status).toBe(403);
    expect((await call({ url: '/__review/fixture', host: 'evil.example.com' })).status).toBe(403);
    expect((await call({ url: '/__review/fixture', method: 'POST' })).status).toBe(405);
    expect((await call({ url: '/__review/fixture', method: 'DELETE' })).status).toBe(405);
    expect((await call({ url: '/index.html' })).status).toBe(999);
  });

  it('fixture dosyası değişince sunucu yeniden başlatılmadan güncel hâli sunar (önbellek değişim zamanına bağlı)', async () => {
    const fx = path.join(dir, 'fixture.json');
    const original = fs.readFileSync(fx, 'utf8');
    try {
      const a = JSON.parse((await call({ url: '/__review/fixture' })).body);
      expect(a.marker).toBeUndefined();
      fs.writeFileSync(fx, JSON.stringify({ ...JSON.parse(original), marker: 'yeni-copyEn' }));
      const future = new Date(Date.now() + 5000);
      fs.utimesSync(fx, future, future);
      const b = JSON.parse((await call({ url: '/__review/fixture' })).body);
      expect(b.marker).toBe('yeni-copyEn');
      expect(b.assets).toBeUndefined();
      // varlık allowlist'i de güncel dosyadan okunur
      fs.writeFileSync(fx, JSON.stringify({ candidates: [], assets: { a001: { root: 'codex', rel: 'previews/n.txt' } } }));
      fs.utimesSync(fx, new Date(Date.now() + 9000), new Date(Date.now() + 9000));
      expect((await call({ url: '/__review/asset/a001' })).status).toBe(400);
    } finally {
      fs.writeFileSync(fx, original);
    }
  });
});
