// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'studio/feedPlanner/review/fixture.json'), 'utf8'));

describe('fixture kapsamı', () => {
  it('gerçek envanterin tamamı: 447 kayıt; hikâye 9 kare haftalık plandan', () => {
    expect(fixture.counts.inventory).toBe(447);
    expect(fixture.candidates.length).toBe(447);
    expect(fixture.weeklyStory.length).toBe(9);
    const ids = new Set(fixture.candidates.map((c: any) => c.id));
    expect(ids.size).toBe(447);
    for (const id of fixture.weeklyStory) expect(ids.has(id)).toBe(true);
    expect(fixture.candidates.filter((c: any) => c.kind === 'video_cover').length).toBe(2);
  });
  it('9 yüksek çözünürlüklü kaynak yalnız kalite avantajı: gerçek boyut; diğerleri önizleme boyutu', () => {
    const story = new Set(fixture.weeklyStory);
    for (const c of fixture.candidates) {
      if (story.has(c.id)) { expect(c.dimsSource).toBe('kaynak'); expect(c.dims.w).toBeGreaterThan(3000); }
      else expect(c.dimsSource).toBe('önizleme');
    }
  });
  it('arşiv yalnız diecimoda: P10 (idfineporcelain) yok; P01 görseli olmadığı için atlandı; kapsam açık', () => {
    expect(fixture.published.length).toBe(9);
    expect(fixture.published.map((p: any) => p.id)).not.toContain('hist-P10');
    expect(fixture.archiveScope.owner).toBe('diecimoda');
    expect(fixture.archiveScope.ownerExcluded).toContain('P10');
    expect(fixture.archiveScope.skipped.join(' ')).toMatch(/P01/);
    for (const p of fixture.published) {
      expect(p.published).toBe(true);
      expect(p.brand).toBe('dieci');
      expect(p.date <= '2026-10-04').toBe(true);
      expect(p.provenance).toMatch(/canlı senkron değil/);
    }
    expect(fixture.archiveNote).toMatch(/canlı senkron değil/);
  });
  it('gizlilik: mutlak yol, caption ve görsel baytı yok; varlık anahtarları allowlist\'te', () => {
    const text = JSON.stringify(fixture);
    expect(text).not.toMatch(/\/Users\//);
    expect(text).not.toMatch(/"caption"/);
    expect(text).not.toMatch(/data:image/);
    const keys = new Set(Object.keys(fixture.assets));
    for (const c of [...fixture.candidates, ...fixture.published]) expect(keys.has(c.imageKey)).toBe(true);
  });
  it('anlamsal alanlar yalnız nottan veya bilinmiyor', () => {
    for (const c of fixture.candidates) {
      expect(['nottan', 'bilinmiyor']).toContain(c.semantic.source);
      if (c.semantic.source === 'bilinmiyor') {
        expect(c.semantic.shotScale).toBe('bilinmiyor');
        expect(c.semantic.subjectPos).toBe('bilinmiyor');
      }
    }
  });
});

describe('izolasyon kapısı', () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx|html|css)$/.test(e.name)) files.push(p);
    }
  };
  walk(path.join(root, 'studio/feedPlanner'));
  // live/ YALNIZ yetkili Studio sayfasının bağımlılığıdır (Firebase oturumu, Storage). Yerel inceleme paketi oradan hiçbir şey içe aktaramaz (aşağıdaki test).
  const LIVE = path.join(root, 'studio/feedPlanner/live') + path.sep;
  const src = files.filter((f) => !f.startsWith(LIVE)).map((f) => ({ f, t: fs.readFileSync(f, 'utf8') }));
  const liveFiles = files.filter((f) => f.startsWith(LIVE));
  it('canlı portlar (live/) ayrık tutulur: yerel inceleme kodundan HİÇBİR dosya live/ içe aktarmaz; live/ yalnız Studio sayfasından içe aktarılır', () => {
    expect(liveFiles.length).toBeGreaterThan(0);
    for (const { f, t } of src) expect(t, f).not.toMatch(/from ['"][^'"]*\/live(\/[^'"]*)?['"]/);
    const importers = [] as string[];
    const scan = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== 'node_modules') scan(p); }
        else if (/\.(ts|tsx)$/.test(e.name) && !p.startsWith(LIVE) && /feedPlanner\/live\//.test(fs.readFileSync(p, 'utf8'))) importers.push(path.relative(root, p));
      }
    };
    for (const d of ['studio', 'admin', 'shared', 'api']) scan(path.join(root, d));
    expect(importers.filter((p) => !p.startsWith('tests/'))).toEqual(['studio/pages/StudioPlannerPage.tsx']);
    // review girişi (main.tsx → App → ...) ve vite.review.config live/'a hiç başvurmaz
    expect(fs.readFileSync(path.join(root, 'vite.review.config.ts'), 'utf8')).not.toMatch(/feedPlanner\/live|StudioPlannerPage/);
  });
  it('Firebase, auth, ağ üstü çağrı ve .env bağımlılığı yok', () => {
    for (const { f, t } of src) {
      expect(t, f).not.toMatch(/from ['"]firebase|lib\/firebase|AuthContext|firebase-admin/);
      expect(t, f).not.toMatch(/https?:\/\/(?!127\.0\.0\.1|localhost)/);
      expect(t, f).not.toMatch(/process\.env|import\.meta\.env|loadEnv/);
    }
  });
  it('fetch yalnız yerel fixture yoluna', () => {
    for (const { f, t } of src) {
      for (const m of t.matchAll(/fetch\(([^)]*)\)/g)) expect(m[1], f).toMatch(/'\/__review\/fixture'/);
    }
  });
  it('ayrı Vite yapılandırması: envDir kapalı, loopback, publicDir kapalı, gerçek Studio\'ya dokunmaz', () => {
    const cfg = fs.readFileSync(path.join(root, 'vite.review.config.ts'), 'utf8');
    expect(cfg).toMatch(/envDir: false/);
    expect(cfg).toMatch(/host: '127\.0\.0\.1'/);
    expect(cfg).toMatch(/publicDir: false/);
    expect(cfg).toMatch(/apply: 'serve'/);
    const main = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
    expect(main).not.toMatch(/feedPlanner|reviewMiddleware/);
  });
});
