// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDietiDraftMiddleware, draftOptionsFromEnv } from '@/studio/devDraft/dietiDraftDevServer';
import { DIECI_DRAFT_BASE } from '@/studio/devDraft/draftPaths';

let dir: string; let orig: string; let opts: any;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dieci-src-'));
  orig = path.join(dir, 'orig'); fs.mkdirSync(orig);
  fs.mkdirSync(path.join(dir, 'web-previews')); fs.mkdirSync(path.join(dir, 'dieci-selected-originals'));
  fs.writeFileSync(path.join(dir, 'plan-2026-10-12-18.json'), JSON.stringify({ baslik: 'x' }));
  fs.writeFileSync(path.join(dir, 'dieci-selected-originals', 'manifest.json'), JSON.stringify({ items: [{ asset_id: 'ABCDE_1', filename: 'WEDD1.jpg' }] }));
  fs.writeFileSync(path.join(dir, 'web-previews', 'ABCDE_1.jpg'), Buffer.from([1, 2, 3]));
  fs.writeFileSync(path.join(orig, 'WEDD1.jpg'), Buffer.from([9, 9, 9, 9]));
  fs.writeFileSync(path.join(orig, 'SECRET.jpg'), Buffer.from([7]));
  opts = draftOptionsFromEnv({ DIECI_DRAFT_DIR: dir, DIECI_ORIGINALS_DIR: orig } as any);
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const call = (o: { url: string; method?: string; remote?: string; host?: string; mw?: any }): Promise<{ status: number; body: string; type: string }> =>
  new Promise((resolve) => {
    const mw = o.mw ?? createDietiDraftMiddleware(opts);
    const h: Record<string, string> = {};
    const req: any = { url: o.url, method: o.method ?? 'GET', headers: { host: o.host ?? 'localhost:5173' }, socket: { remoteAddress: o.remote ?? '127.0.0.1' } };
    const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { h[k.toLowerCase()] = v; }, end: (b?: any) => resolve({ status: res.statusCode, body: b ? b.toString() : '', type: h['content-type'] || '' }) };
    mw(req, res, () => resolve({ status: 999, body: 'NEXT', type: '' }));
  });

describe('Dieci yerel kaynak sunucusu (salt okunur, loopback)', () => {
  it('plan, manifest, önizleme ve orijinali yalnız loopback istemciye verir', async () => {
    expect((await call({ url: `${DIECI_DRAFT_BASE}/plan.json` })).status).toBe(200);
    expect((await call({ url: `${DIECI_DRAFT_BASE}/manifest.json` })).status).toBe(200);
    expect((await call({ url: `${DIECI_DRAFT_BASE}/preview/ABCDE_1.jpg` })).type).toBe('image/jpeg');
    expect((await call({ url: `${DIECI_DRAFT_BASE}/original/ABCDE_1.jpg` })).status).toBe(200);
  });
  it('loopback dışı istemci, yabancı Host ve POST reddedilir', async () => {
    expect((await call({ url: `${DIECI_DRAFT_BASE}/plan.json`, remote: '10.0.0.5' })).status).toBe(403);
    expect((await call({ url: `${DIECI_DRAFT_BASE}/plan.json`, host: 'evil.example.com' })).status).toBe(403);
    expect((await call({ url: `${DIECI_DRAFT_BASE}/plan.json`, method: 'POST' })).status).toBe(405);
  });
  it('yalnız manifest\'teki varlıklar sunulur; Downloads\'taki diğer dosyalar ve yol geçişi reddedilir', async () => {
    for (const u of [`${DIECI_DRAFT_BASE}/original/SECRET.jpg`, `${DIECI_DRAFT_BASE}/original/QQQQQ_9.jpg`, `${DIECI_DRAFT_BASE}/original/..%2FSECRET.jpg`, `${DIECI_DRAFT_BASE}/preview/../../x.jpg`]) {
      const r = await call({ url: u });
      expect([400, 404]).toContain(r.status);
      expect(r.body).not.toBe('\u0007');
    }
  });
  it('kaynak tanımlı değilse açık 404; diğer URL\'leri geçirir', async () => {
    const r = await call({ url: `${DIECI_DRAFT_BASE}/plan.json`, mw: createDietiDraftMiddleware({}) });
    expect(r.status).toBe(404); expect(r.body).toContain('DIECI_DRAFT_DIR');
    expect((await call({ url: '/studio/x' })).status).toBe(999);
  });
});
