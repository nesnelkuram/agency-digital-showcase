// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { candidateFromBrandMedia, candidatesFromBrandMedia, catalogCoverageNotice, LIVE_INVENTORY_LIMIT } from '@/studio/feedPlanner/integration/fromBrandMedia';
import { readinessByType } from '@/studio/feedPlanner/integration/readiness';
import type { LiveBrandMediaAsset, LiveCatalog } from '@/studio/feedPlanner/integration/liveTypes';
import { readinessFor } from '@/api/_lib/planSuggest/planSuggest';
import { assetToMediaItem, isConsistentAsset } from '@/shared/types/brandMedia';
import { dlUrl, POLICY, T, P } from './liveFixtures';

const mk = (over: Partial<LiveBrandMediaAsset> & { storage?: Partial<LiveBrandMediaAsset['storage']> } = {}): LiveBrandMediaAsset => {
  const p = `brand-media/${T}/${P}/a1/a1.jpg`;
  const { storage, ...rest } = over;
  return {
    id: 'a1', tenantId: T, projectId: P, kind: 'photo', title: 'a1', fileName: 'a1.jpg', tags: [], status: 'active', createdBy: 'u1',
    storage: { path: p, downloadUrl: dlUrl(p), contentType: 'image/jpeg', size: 1_000_000, width: 1080, height: 1350, ...storage },
    ...rest,
  };
};
const scope = { tenantId: T, projectId: P };
const CATALOG: LiveCatalog = {
  subject: 'masada makarna', description: 'd', tags: [], foodCategories: ['Makarna'], peoplePresent: false,
  composition: { shotType: 'yakın_çekim', orientation: 'dikey', hasTextOverlay: false, subjectPlacement: 'sol', negativeSpace: true },
  productIdentity: { status: 'genel_kategori', note: '' }, usageSuggestions: ['story'], overallConfidence: 'orta', uncertainties: [],
};

describe('brand_media → aday (gerçek şema)', () => {
  it('ilkeyle doğrulanmış medya: katalogdan anlamsal alanlar, kapsam, kaynak boyut, hazırlık', () => {
    const r = candidateFromBrandMedia(mk(), scope, { catalog: CATALOG, policy: POLICY });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.verification).toBe('verified');
    const c = r.candidate;
    expect(c).toMatchObject({ id: 'a1', brand: P, origin: 'studio', kind: 'photo', dimsSource: 'kaynak', group: 'makarna', storageVerified: true, humanPresence: 'hayır' });
    expect(c.dims).toEqual({ w: 1080, h: 1350 });
    expect(c.semantic).toEqual({ shotScale: 'yakın', subjectPos: 'sol', source: 'katalog' });
    expect(c.readiness).toEqual(readinessFor(assetToMediaItem(mk() as any, 0)));
    expect(r.mediaItem.libraryAssetId).toBe('a1');
  });

  it('kamera açısı/odak türü çekim ölçeği sayılmaz; dağınık konu konumu bilinmiyor olur; katalog yoksa her şey bilinmiyor', () => {
    for (const shot of ['üstten', 'ürün_odaklı', 'diğer'] as const) {
      const r = candidateFromBrandMedia(mk(), scope, { catalog: { ...CATALOG, composition: { ...CATALOG.composition, shotType: shot, subjectPlacement: 'dağınık' } }, policy: POLICY });
      expect(r.ok && r.candidate.semantic).toEqual({ shotScale: 'bilinmiyor', subjectPos: 'bilinmiyor', source: 'katalog' });
    }
    const none = candidateFromBrandMedia(mk(), scope, { policy: POLICY });
    expect(none.ok && none.candidate.semantic).toEqual({ shotScale: 'bilinmiyor', subjectPos: 'bilinmiyor', source: 'bilinmiyor' });
  });

  it('FAIL-CLOSED: güvenilen host/bucket ilkesi yoksa aday döndürülmez', () => {
    const r = candidateFromBrandMedia(mk(), scope);
    expect(r).toMatchObject({ ok: false, reason: 'storage_policy_unverified' });
  });

  it('açık opt-in ile doğrulanmamış sonuç: verification=unverified, storageVerified=false, sağlayıcı notu', () => {
    const r = candidateFromBrandMedia(mk(), scope, { allowUnverified: true });
    expect(r.ok && r.verification).toBe('unverified');
    expect(r.ok && r.candidate.storageVerified).toBe(false);
    expect(r.ok && r.candidate.provenance).toMatch(/DOĞRULANMADI/);
  });

  it('ilke verilince gerçek isConsistentAsset çalışır: yanlış host/bucket reddedilir', () => {
    const bad = mk({ storage: { downloadUrl: `https://evil.example.com/v0/b/${POLICY.buckets[0]}/o/x?alt=media` } });
    expect(candidateFromBrandMedia(bad, scope, { policy: POLICY })).toMatchObject({ ok: false, reason: 'inconsistent_storage' });
    const wrongBucket = mk();
    wrongBucket.storage.downloadUrl = wrongBucket.storage.downloadUrl.replace(POLICY.buckets[0], 'baska.appspot.com');
    expect(candidateFromBrandMedia(wrongBucket, scope, { policy: POLICY })).toMatchObject({ ok: false, reason: 'inconsistent_storage' });
  });

  it.each([
    ['NaN', NaN, 1350], ['Infinity', Infinity, 1350], ['sıfır', 0, 1350], ['negatif', 1080, -5], ['tanımsız', undefined as any, 1350], ['metin', '1080' as any, 1350],
  ])('kaynak boyut sonlu ve > 0 olmalı (%s)', (_n, w, h) => {
    const r = candidateFromBrandMedia(mk({ storage: { width: w, height: h } }), scope, { policy: POLICY });
    expect(r).toMatchObject({ ok: false, reason: 'dimensions_invalid' });
  });

  it.each([
    ['yalnız klasör yolu', `brand-media/${T}/${P}/a1/`],
    ['klasör (eğik çizgisiz)', `brand-media/${T}/${P}/a1`],
    ['iç içe yol', `brand-media/${T}/${P}/a1/x/y.jpg`],
    ['üst dizin', `brand-media/${T}/${P}/a1/../a2/y.jpg`],
    ['önizleme dosyası', `brand-media/${T}/${P}/a1/thumb.jpg`],
    ['başka varlık klasörü', `brand-media/${T}/${P}/a2/a2.jpg`],
    ['başka proje klasörü', `brand-media/${T}/p2/a1/a1.jpg`],
    ['nokta dosya adı', `brand-media/${T}/${P}/a1/.`],
  ])('depolama yolu: %s reddedilir', (_n, p) => {
    const r = candidateFromBrandMedia(mk({ storage: { path: p, downloadUrl: dlUrl(p) } }), scope, { policy: POLICY });
    expect(r).toMatchObject({ ok: false, reason: 'inconsistent_storage' });
  });

  it('BULGU: gerçek isConsistentAsset boş dosya adlı klasör yolunu kabul ediyor; adaptör bunu ayrıca reddediyor', () => {
    const p = `brand-media/${T}/${P}/a1/`;
    const a = mk({ storage: { path: p, downloadUrl: dlUrl(p) } });
    expect(isConsistentAsset(a as any, T, P, POLICY)).toBe(true); // canlı sistemdeki boşluk (düzeltilmedi; yalnız bildirildi)
    expect(candidateFromBrandMedia(a, scope, { policy: POLICY }).ok).toBe(false);
  });

  it('tür uyuşmazlığı, arşiv, başka tenant/proje ve güvensiz kimlik', () => {
    expect(candidateFromBrandMedia(mk({ kind: 'video' }), scope, { policy: POLICY })).toMatchObject({ reason: 'inconsistent_storage' });
    expect(candidateFromBrandMedia(mk({ status: 'archived' }), scope, { policy: POLICY })).toMatchObject({ reason: 'archived' });
    expect(candidateFromBrandMedia(mk({ tenantId: 't2' }), scope, { policy: POLICY })).toMatchObject({ reason: 'scope_mismatch' });
    expect(candidateFromBrandMedia(mk({ projectId: 'p2' }), scope, { policy: POLICY })).toMatchObject({ reason: 'scope_mismatch' });
    expect(candidateFromBrandMedia(mk({ id: '../x' }), scope, { policy: POLICY })).toMatchObject({ reason: 'unsafe_id' });
  });

  it('video kaydı video kapağı adayı olur; Reels dışında kullanılamaz', () => {
    const p = `brand-media/${T}/${P}/v1/v1.jpg`;
    const r = candidateFromBrandMedia(mk({ id: 'v1', kind: 'video', storage: { path: p, downloadUrl: dlUrl(p), contentType: 'video/mp4', width: 1080, height: 1920, duration: 20 } }), scope, { policy: POLICY });
    expect(r.ok && r.candidate.kind).toBe('video_cover');
  });

  it('toplu dönüşüm: hariç tutulanlar nedenle raporlanır', () => {
    const out = candidatesFromBrandMedia([mk(), mk({ id: 'a2', status: 'archived' }), mk({ id: 'a3', tenantId: 't9' })], scope, { policy: POLICY });
    expect(out.candidates.map((c) => c.id)).toEqual(['a1']);
    expect(out.excluded).toEqual([{ id: 'a2', reason: 'archived' }, { id: 'a3', reason: 'scope_mismatch' }]);
    expect(out.mediaItems.get('a1')?.libraryAssetId).toBe('a1');
  });

  it('hazırlık denetimi gerçek planSuggest.readinessFor ile aynı (özgün, önizleme ve kare boyutlar)', () => {
    for (const [w, h] of [[3697, 5546], [1080, 1350], [1080, 1920], [133, 200], [2000, 1000]]) {
      const item = assetToMediaItem(mk({ storage: { width: w, height: h } }) as any, 0);
      expect(readinessByType(item)).toEqual(readinessFor(item));
    }
  });

  it('GERÇEK BOYUTLAR: özgün 3697×5546 feed için error, Story için ok; 133×200 önizleme feed için error', () => {
    const o = readinessByType(assetToMediaItem(mk({ storage: { width: 3697, height: 5546 } }) as any, 0));
    expect(o).toMatchObject({ static: 'error', story: 'ok', reels: 'error' });
    expect(readinessByType(assetToMediaItem(mk({ storage: { width: 133, height: 200 } }) as any, 0)).static).toBe('error');
  });

  it('envanter kırpma bildirimi', () => {
    expect(LIVE_INVENTORY_LIMIT).toBe(200);
    expect(catalogCoverageNotice({ eligible: 200, truncated: true })).toMatch(/yalnız en yeni 200/);
    expect(catalogCoverageNotice({ eligible: 150, truncated: false })).toBeNull();
  });
});
