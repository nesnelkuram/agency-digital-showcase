// @vitest-environment node
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { buildNativeRecords, validateNative, contentHashOf, parseWeek, planKeyOf, sha256Hex } from '../scripts/lib/dietiDraftImport.mjs';

const days = [
  { gun: 'Pazartesi 12 Ekim 2026', seri: 'Marka', items: [{ frame: 1, asset_id: 'AAAAA_1', cover_text_tr: 'Pazarlamada serseri, mutfakta beyefendi.', register: 'Harry Dry', note_tr: 'k', secim_gerekcesi: 's', belirsizlik_onay: 'b', dokuz_kapi_oneri: ['1. geçer'] }] },
  { gun: 'Salı 13 Ekim 2026', seri: 'Hamur', items: [{ frame: 1, asset_id: 'BBBBB_2', cover_text_tr: 'Bazı şeyler sabrınızı hak eder.', register: 'Gastro-şairane', note_tr: 'k', secim_gerekcesi: 's', belirsizlik_onay: 'b', dokuz_kapi_oneri: [] }] },
  { gun: 'Çarşamba 14 Ekim 2026', seri: 'Midye', items: [{ frame: 1, asset_id: 'CCCCC_3', cover_text_tr: "Biz susacağız... tabaklar konuşacak.", register: 'Menefreghista', note_tr: 'k', secim_gerekcesi: 's', belirsizlik_onay: 'b', dokuz_kapi_oneri: [] }] },
  { gun: 'Perşembe 15 Ekim 2026', seri: 'Pizza', items: [{ frame: 1, asset_id: 'DDDDD_4', cover_text_tr: 'Standartlarınızın yeri masadır.', register: 'Harry Dry', note_tr: 'k', secim_gerekcesi: 's', belirsizlik_onay: 'b', dokuz_kapi_oneri: [] }] },
  { gun: 'Cuma 16 Ekim 2026', seri: 'Paket', items: [{ frame: 1, asset_id: 'EEEEE_5', cover_text_tr: "Beni özleyeceksin.", register: 'Menefreghista', note_tr: 'k', secim_gerekcesi: 's', belirsizlik_onay: 'b', dokuz_kapi_oneri: [] }] },
  { gun: 'Cumartesi 17 Ekim 2026', seri: 'Focaccia', items: [
    { frame: 1, asset_id: 'FFFFF_6', cover_text_tr: "Mükemmellik terlemez. Sadece fısıldar.", register: 'Gastro-şairane', note_tr: 'k', secim_gerekcesi: 's', belirsizlik_onay: 'b', dokuz_kapi_oneri: [] },
    { frame: 2, asset_id: 'GGGGG_7', cover_text_tr: '', register: 'Gastro-şairane', note_tr: 'k', secim_gerekcesi: 's', belirsizlik_onay: 'b', dokuz_kapi_oneri: [] }] },
  { gun: 'Pazar 18 Ekim 2026', seri: 'Mekân', items: [{ frame: 1, asset_id: 'HHHHH_8', cover_text_tr: "Biz çoktan seçtik. Siz sadece masaya oturun.", register: 'Menefreghista', note_tr: 'k', secim_gerekcesi: 's', belirsizlik_onay: 'b', dokuz_kapi_oneri: [] }] },
];
const plan = { tarih_araligi: '2026-10-12 — 2026-10-18', days: days.map((d) => ({ ...d, items: d.items })) } as any;
const manifest = { items: ['AAAAA_1', 'BBBBB_2', 'CCCCC_3', 'DDDDD_4', 'EEEEE_5', 'FFFFF_6', 'GGGGG_7', 'HHHHH_8'].map((id, i) => ({ asset_id: id, filename: `F${i}.jpg`, sha256: 'a'.repeat(64), file_size_bytes: 100, width_px: 3840, height_px: 5760 })) } as any;
// 9. kare: bir gün daha eklemek yerine mevcut 8 asset + 1 tekrar kare değil; test için 9 kareyi toplamak amacıyla 7 gün + Pazartesi 2. kare yok → 8 kare; tam 9 için Pazartesi'ye ek kare
plan.days[0].items.push({ frame: 2, asset_id: 'IIIII_9', cover_text_tr: '', register: 'Harry Dry', note_tr: 'k', secim_gerekcesi: 's', belirsizlik_onay: 'b', dokuz_kapi_oneri: [] });
manifest.items.push({ asset_id: 'IIIII_9', filename: 'F8.jpg', sha256: 'a'.repeat(64), file_size_bytes: 100, width_px: 3840, height_px: 5760 });

describe('Dieci native import (saf mantık)', () => {
  it('saf JS SHA-256 Node crypto ile aynı sonucu verir (metin ve bayt)', () => {
    for (const x of ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'Türkçe: şığçöü — test'.repeat(9)]) {
      expect(sha256Hex(x)).toBe(crypto.createHash('sha256').update(x).digest('hex'));
    }
    const b = Buffer.alloc(150000, 3);
    expect(sha256Hex(new Uint8Array(b))).toBe(crypto.createHash('sha256').update(b).digest('hex'));
  });

  it('hafta anahtarı ve tarih aralığı doğru çözülür', () => {
    expect(parseWeek(plan.tarih_araligi)).toEqual({ weekStart: '2026-10-12', weekEnd: '2026-10-18' });
    expect(planKeyOf('2026-10-12')).toBe('dieci-2026-10-12');
  });

  it('kimlikler deterministik: aynı girdi aynı kimlik; farklı tenant/proje farklı kimlik', () => {
    const a = buildNativeRecords({ plan, manifest, tenantId: 't1', projectId: 'p1' });
    const b = buildNativeRecords({ plan, manifest, tenantId: 't1', projectId: 'p1' });
    const c = buildNativeRecords({ plan, manifest, tenantId: 't2', projectId: 'p1' });
    expect(a.posts.map((p) => p.id)).toEqual(b.posts.map((p) => p.id));
    expect(a.planId).toBe(b.planId);
    expect(a.planId).not.toBe(c.planId);
    expect(a.posts[0].id).not.toBe(c.posts[0].id);
    expect(new Set(a.posts.map((p) => p.id)).size).toBe(a.posts.length);
  });

  it('native şekil: taslak statü, paylaşım tokenı yok, scheduledAt yok, media.url boş, depolama yolu tenant/proje kapsamlı', () => {
    const r = buildNativeRecords({ plan, manifest, tenantId: 't1', projectId: 'p1' });
    expect(r.planDoc.status).toBe('draft');
    expect(r.planDoc.shareToken).toBe('');
    expect(r.planDoc.platform).toBe('instagram');
    for (const p of r.posts) {
      expect(p.status).toBe('draft');
      expect(p.contentPlanId).toBe(r.planId);
      expect(p).not.toHaveProperty('scheduledAt');
      expect(p.media[0].url).toBe('');
      expect(p.media[0].storagePath.startsWith('social-media-drafts/t1/p1/dieci-2026-10-12/')).toBe(true);
      expect(p.media[0].previewStoragePath.endsWith('.web.jpg')).toBe(true);
      expect(p.libraryAssetIds).toEqual([]);
    }
    expect(r.planDoc.postIds).toEqual(r.posts.map((p) => p.id));
  });

  it('doğrulama: geçerli plan geçer; yayın/saat/token/Türkçe copy/yasaklı kalıp yakalanır', () => {
    const r = buildNativeRecords({ plan, manifest, tenantId: 't1', projectId: 'p1' });
    expect(validateNative({ plan, manifest, planDoc: r.planDoc, posts: r.posts }).ok).toBe(true);

    const bad = (mutate: (p: any) => void) => {
      const posts = JSON.parse(JSON.stringify(r.posts));
      mutate(posts[0]);
      return validateNative({ plan, manifest, planDoc: r.planDoc, posts }).ok;
    };
    expect(bad((p) => { p.status = 'approved'; })).toBe(false);
    expect(bad((p) => { p.scheduledAt = 'x'; })).toBe(false);
    expect(bad((p) => { p.media[0].url = 'https://x'; })).toBe(false);
    expect(bad((p) => { p.caption = 'Ürün fiyatı 100 TL'; })).toBe(false);
    expect(bad((p) => { p.caption = 'Rezervasyon için arayın'; })).toBe(false);
    expect(bad((p) => { p.caption = 'Saat 19:30 kapıda'; })).toBe(false);
    expect(bad((p) => { p.caption = 'Ghosting menu'; })).toBe(false);
  });

  it('gömülü önizleme: yalnız data:image/jpeg kabul edilir; içerik parmak izini değiştirmez', () => {
    const base = buildNativeRecords({ plan, manifest, tenantId: 't1', projectId: 'p1' });
    const withT = buildNativeRecords({ plan, manifest, tenantId: 't1', projectId: 'p1', thumbnails: { AAAAA_1: 'data:image/jpeg;base64,/9j/4AAQ' } });
    expect(withT.posts[0].media[0].thumbnailUrl).toBe('data:image/jpeg;base64,/9j/4AAQ');
    expect(withT.posts[0].contentHash).toBe(base.posts[0].contentHash);
    expect(validateNative({ plan, manifest, planDoc: withT.planDoc, posts: withT.posts }).ok).toBe(true);
    const bad = JSON.parse(JSON.stringify(withT.posts)); bad[0].media[0].thumbnailUrl = 'https://x/y.jpg';
    expect(validateNative({ plan, manifest, planDoc: withT.planDoc, posts: bad }).ok).toBe(false);
  });

  it('içerik parmak izi: copy değişince değişir; zaman damgası ve kullanıcı etkilemez', () => {
    const r = buildNativeRecords({ plan, manifest, tenantId: 't1', projectId: 'p1' });
    const h1 = contentHashOf(r.posts[0]);
    expect(contentHashOf({ ...r.posts[0], createdAt: 'x', contentHash: 'y', createdBy: 'u2', createdByName: 'n' })).toBe(h1);
    expect(contentHashOf({ ...r.posts[0], caption: 'changed' })).not.toBe(h1);
  });
});
