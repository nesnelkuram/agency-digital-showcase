import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';

vi.mock('@/lib/firebase/config', () => ({ db: {}, storage: {} }));
vi.mock('firebase/firestore', () => ({ Timestamp: { fromDate: (d: Date) => ({ ts: d.toISOString() }) }, doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn(), serverTimestamp: () => ({ server: true }) }));
vi.mock('firebase/storage', () => ({ getMetadata: vi.fn(), ref: vi.fn(), uploadBytes: vi.fn() }));

import { importDieciDraft, ImportConflictError, type ImportDeps } from '@/studio/devDraft/importDraft';

const bytes = (n: number) => new Uint8Array(n).fill(n % 251);
const sha = (b: Uint8Array) => crypto.createHash('sha256').update(b).digest('hex');
const ASSETS = ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8', 'I9'].map((s, i) => `${s}_ASSET${i}`);
const FILES = new Map(ASSETS.map((id, i) => [id, bytes(20 + i)]));
const manifest = { items: ASSETS.map((id, i) => ({ asset_id: id, filename: `F${i}.jpg`, sha256: sha(FILES.get(id)!), file_size_bytes: FILES.get(id)!.length, width_px: 3840, height_px: 5760 })) };
const mk = (gun: string, items: any[]) => ({ gun, seri: 's', items });
const item = (frame: number, id: string, txt: string) => ({ frame, asset_id: id, cover_text_tr: txt, register: 'Harry Dry', note_tr: 'k', secim_gerekcesi: 's', belirsizlik_onay: 'b', dokuz_kapi_oneri: [] });
const plan = { tarih_araligi: '2026-10-12 — 2026-10-18', days: [
  mk('Pazartesi 12 Ekim 2026', [item(1, ASSETS[0], 'Pazarlamada serseri, mutfakta beyefendi.')]), mk('Salı 13 Ekim 2026', [item(1, ASSETS[1], 'Bazı şeyler sabrınızı hak eder.')]),
  mk('Çarşamba 14 Ekim 2026', [item(1, ASSETS[2], 'Biz susacağız... tabaklar konuşacak.'), item(2, ASSETS[3], '')]), mk('Perşembe 15 Ekim 2026', [item(1, ASSETS[4], 'Standartlarınızın yeri masadır.')]),
  mk('Cuma 16 Ekim 2026', [item(1, ASSETS[5], 'Beni özleyeceksin.')]), mk('Cumartesi 17 Ekim 2026', [item(1, ASSETS[6], 'Mükemmellik terlemez. Sadece fısıldar.'), item(2, ASSETS[7], '')]),
  mk('Pazar 18 Ekim 2026', [item(1, ASSETS[8], 'Biz çoktan seçtik. Siz sadece masaya oturun.')]),
] };

const makeDeps = () => {
  const docs = new Map<string, any>(); const files = new Set<string>(); const order: string[] = []; const uploads: string[] = []; const updates: string[] = [];
  const deps: ImportDeps = {
    fetchJson: async (p) => (p === 'plan.json' ? plan : manifest),
    fetchBytes: async (p) => { const id = p.split('/')[1].replace('.jpg', ''); const b = FILES.get(id); if (!b) throw new Error('404'); return b; },
    listProjectDocs: async (c, tenantId, projectId, extra) => {
      const m = new Map<string, any>();
      for (const [k, v] of docs) {
        if (!k.startsWith(`${c}/`)) continue;
        if (v.tenantId !== tenantId || v.projectId !== projectId) continue;
        if (extra && v[extra.field] !== extra.value) continue;
        m.set(k.slice(c.length + 1), v);
      }
      return m;
    },
    setDocData: async (c, id, d) => { docs.set(`${c}/${id}`, d); order.push(`${c}/${id}`); },
    updateDocData: async (c, id, d) => { docs.set(`${c}/${id}`, { ...docs.get(`${c}/${id}`), ...d }); updates.push(`${c}/${id}:${Object.keys(d).sort().join(',')}`); },
    storageExists: async (p) => files.has(p),
    storageUpload: async (p) => { files.add(p); uploads.push(p); },
    makeTimestamp: (iso) => ({ ts: iso }),
    serverNow: () => ({ server: true }),
  };
  return { deps, docs, files, order, uploads, updates };
};
const P = (deps: ImportDeps, uid = 'u1') => ({ tenantId: 't1', projectId: 'p1', uid, userName: 'Kullanıcı', deps });

describe('Dieci taslak içe aktarma (oturumla, servis hesabı yok)', () => {
  it('1 plan + 9 taslak post yazar; plan önce; token/scheduledAt yok; dosyalar özel yola yüklenir', async () => {
    const t = makeDeps();
    const r = await importDieciDraft(P(t.deps));
    expect(r.createdPlan).toBe(true);
    expect(r.createdPosts.length).toBe(9);
    expect(r.uploaded).toBe(18);
    expect(r.backfilled).toBe(0);
    expect(t.order[0].startsWith('content_plans/')).toBe(true);
    const plan0 = t.docs.get(t.order[0]);
    expect(plan0).toMatchObject({ status: 'draft', shareToken: '', tenantId: 't1', projectId: 'p1', platform: 'instagram', createdBy: 'u1' });
    expect(plan0.postIds.length).toBe(9);
    for (const k of t.order.slice(1)) {
      const p = t.docs.get(k);
      expect(p).toMatchObject({ status: 'draft', postType: 'story', platforms: ['instagram'], tenantId: 't1', projectId: 'p1', contentPlanId: r.planId });
      expect(p).not.toHaveProperty('scheduledAt');
      expect(p.media[0].url).toBe('');
      expect(p.media[0].thumbnailUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect(p.media[0].storagePath.startsWith('social-media-drafts/t1/p1/dieci-2026-10-12/')).toBe(true);
    }
    expect(t.uploads.every((u) => u.startsWith('social-media-drafts/t1/p1/'))).toBe(true);
    expect(JSON.stringify([...t.docs.values()])).not.toMatch(/https?:\/\/|token=|csig=/);
  });

  it('Türkçe metin caption olarak yazılır; metinsiz kare boş kalır', async () => {
    const t = makeDeps();
    await importDieciDraft(P(t.deps));
    const caps = t.order.slice(1).map((k) => t.docs.get(k).caption);
    expect(caps).toContain('Pazarlamada serseri, mutfakta beyefendi.');
    expect(caps).toContain('Biz çoktan seçtik. Siz sadece masaya oturun.');
    expect(caps.filter((c) => c === '').length).toBe(2);
  });

  it('idempotent: ikinci çalıştırma hiçbir şey yazmaz/yüklemez; başka kullanıcıyla da aynı', async () => {
    const t = makeDeps();
    await importDieciDraft(P(t.deps));
    const before = t.order.length; const up = t.uploads.length;
    const r2 = await importDieciDraft(P(t.deps, 'u2'));
    expect(r2.createdPlan).toBe(false);
    expect(r2.createdPosts).toEqual([]);
    expect(r2.alreadyPresent).toBe(9);
    expect(t.order.length).toBe(before); expect(t.uploads.length).toBe(up);
  });

  it('önizlemesi olmayan eski aktarım: yalnız media alanı tamamlanır (başka alan değişmez), yinelenen kayıt yok', async () => {
    const t = makeDeps();
    await importDieciDraft(P(t.deps));
    for (const k of t.order.slice(1)) { const d = t.docs.get(k); t.docs.set(k, { ...d, media: [{ ...d.media[0], thumbnailUrl: undefined }] }); delete t.docs.get(k).media[0].thumbnailUrl; }
    const before = t.order.length;
    const r = await importDieciDraft(P(t.deps, 'u2'));
    expect(r.backfilled).toBe(9);
    expect(r.createdPosts).toEqual([]);
    expect(t.order.length).toBe(before);
    expect(new Set(t.updates.map((u) => u.split(':')[1]))).toEqual(new Set(['media,updatedAt']));
    expect(t.docs.get(t.order[1]).media[0].thumbnailUrl).toMatch(/^data:image\/jpeg/);
    const r3 = await importDieciDraft(P(t.deps));
    expect(r3.backfilled).toBe(0);
  });

  it('kısmi önceki aktarımdan devam eder: yalnız eksik postu yazar', async () => {
    const t = makeDeps();
    await importDieciDraft(P(t.deps));
    const missing = t.order[3]; t.docs.delete(missing);
    const r = await importDieciDraft(P(t.deps));
    expect(r.createdPlan).toBe(false);
    expect(r.createdPosts.length).toBe(1);
  });

  it('farklı içerikli mevcut kayıt varsa HİÇBİR ŞEY yazılmaz (ezme yok)', async () => {
    const t = makeDeps();
    await importDieciDraft(P(t.deps));
    const key = t.order[2]; t.docs.set(key, { ...t.docs.get(key), contentHash: 'baska' });
    const w = t.order.length; const up = t.uploads.length;
    await expect(importDieciDraft(P(t.deps))).rejects.toBeInstanceOf(ImportConflictError);
    expect(t.order.length).toBe(w); expect(t.uploads.length).toBe(up);
  });

  it('SHA-256 uyuşmazsa hiçbir kayıt yazılmaz', async () => {
    const t = makeDeps();
    const bad = { ...t.deps, fetchBytes: async (p: string) => (p.includes(ASSETS[2]) && p.startsWith('original') ? bytes(999) : t.deps.fetchBytes(p)) };
    await expect(importDieciDraft(P(bad))).rejects.toThrow(/SHA-256/);
    expect(t.order.length).toBe(0);
  });

  it('izin hatası hangi adımda olduğunu söyler', async () => {
    const t = makeDeps();
    const denied = { ...t.deps, listProjectDocs: async () => { throw Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' }); } };
    await expect(importDieciDraft(P(denied))).rejects.toThrow(/\[plan kayıtları okunuyor\] permission-denied/);
    expect(t.order.length).toBe(0);
  });

  it('sorgu yalnız kendi tenant/proje kayıtlarını görür (başka tenant\'ın aynı kimlikli kaydı çakışma sayılmaz)', async () => {
    const t = makeDeps();
    await importDieciDraft({ ...P(t.deps), tenantId: 't2' });
    const r = await importDieciDraft(P(t.deps));
    expect(r.createdPlan).toBe(true);
    expect(r.createdPosts.length).toBe(9);
  });

  it('oturum, tenant veya proje eksikse yazmaz', async () => {
    const t = makeDeps();
    await expect(importDieciDraft({ ...P(t.deps), uid: '' })).rejects.toThrow();
    await expect(importDieciDraft({ ...P(t.deps), tenantId: '' })).rejects.toThrow();
    expect(t.order.length).toBe(0);
  });

  it('farklı tenant/proje farklı kimlik üretir (izolasyon)', async () => {
    const a = makeDeps(); const b = makeDeps();
    const ra = await importDieciDraft(P(a.deps));
    const rb = await importDieciDraft({ ...P(b.deps), tenantId: 't2' });
    expect(ra.planId).not.toBe(rb.planId);
    expect(a.uploads[0]).not.toBe(b.uploads[0]);
  });
});
