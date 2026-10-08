import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import {
  LIBRARY_MAX_FILE_BYTES,
  assetToMediaItem,
  deriveLibraryAssetIds,
  formatBytesDecimal,
  isConsistentAsset,
  normalizeTags,
  safeStorageFileName,
  validateLibraryFile,
  type BrandMediaAsset,
} from '@/shared/types/brandMedia';
import { isTrustedMediaUrl } from '@/shared/approval/approvalEngine';

const POLICY = { hosts: ['firebasestorage.googleapis.com'], buckets: ['intiba.appspot.com'] };
const ok = (a: BrandMediaAsset, t = 't1', p = 'projA') => isConsistentAsset(a, t, p, POLICY);

const url = (path: string, host = 'firebasestorage.googleapis.com', bucket = 'intiba.appspot.com') =>
  `https://${host}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=tok`;

function asset(over: Partial<BrandMediaAsset> = {}, storage: Partial<BrandMediaAsset['storage']> = {}): BrandMediaAsset {
  const path = 'brand-media/t1/projA/a1/final.jpg';
  return {
    id: 'a1',
    tenantId: 't1',
    projectId: 'projA',
    kind: 'photo',
    title: 'Final',
    fileName: 'final.jpg',
    tags: [],
    status: 'active',
    createdBy: 'u1',
    storage: {
      path,
      downloadUrl: url(path),
      contentType: 'image/jpeg',
      size: 1000,
      width: 1080,
      height: 1350,
      thumbPath: 'brand-media/t1/projA/a1/thumb.jpg',
      thumbUrl: url('brand-media/t1/projA/a1/thumb.jpg'),
      ...storage,
    },
    ...over,
  };
}

describe('panel yükleme sınırı: 1 GB = 1_000_000_000 bayt', () => {
  it('sabit ondalık GB', () => {
    expect(LIBRARY_MAX_FILE_BYTES).toBe(1_000_000_000);
    expect(formatBytesDecimal(LIBRARY_MAX_FILE_BYTES)).toBe('1 GB');
    expect(formatBytesDecimal(1_500_000)).toBe('1,5 MB');
  });
  it('tam sınır kabul, bir bayt fazlası red; boş ve medya dışı red', () => {
    expect(validateLibraryFile({ size: 1_000_000_000, type: 'video/mp4' })).toBeNull();
    expect(validateLibraryFile({ size: 1_000_000_001, type: 'video/mp4' })).toMatch(/1 GB/);
    expect(validateLibraryFile({ size: 0, type: 'image/jpeg' })).toMatch(/boş/);
    expect(validateLibraryFile({ size: 10, type: 'application/pdf' })).toMatch(/fotoğraf veya video/);
  });
  it('kurallar aynı bayt sayısını kullanır (GiB değil)', () => {
    const storage = readFileSync('storage.rules', 'utf8');
    const firestore = readFileSync('firestore.rules', 'utf8');
    const storageBlock = storage.slice(storage.indexOf('match /brand-media/'), storage.indexOf('// Eski sosyal medya yolu'));
    const firestoreBlock = firestore.slice(firestore.indexOf('match /brand_media/'), firestore.indexOf('// Pricing data'));
    expect(storageBlock).toContain(`request.resource.size <= ${LIBRARY_MAX_FILE_BYTES}`);
    expect(firestoreBlock).toContain(`st.size <= ${LIBRARY_MAX_FILE_BYTES}`);
    expect(storage + firestore).not.toContain('1073741824');
  });
});

describe('etiket ve dosya adı', () => {
  it('etiketler normalize, tekil, en fazla 20', () => {
    expect(normalizeTags('#Ürün, Yeni Sezon ,ürün,  ')).toEqual(['ürün', 'yeni-sezon']);
    expect(normalizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(20);
  });
  it('Storage adı ASCII ve önizleme adıyla çakışmaz', () => {
    expect(safeStorageFileName('Çay Bardağı Ön.JPG')).toBe('Cay_Bardagi_On.JPG');
    expect(safeStorageFileName('thumb.jpg')).toBe('file_thumb.jpg');
    expect(safeStorageFileName('../../x.png')).not.toContain('/');
    expect(safeStorageFileName('photo..jpg')).toBe('photo.jpg');
    expect(safeStorageFileName('a...b..c.mp4')).toBe('a.b.c.mp4');
  });
  it('regresyon: çift noktalı dosya adı yüklenince katalogda görünür', () => {
    const path = `brand-media/t1/projA/a1/${safeStorageFileName('photo..jpg')}`;
    expect(ok(asset({}, { path, downloadUrl: url(path) }))).toBe(true);
  });
});

describe('katalog ↔ medya tutarlılığı', () => {
  it('doğru tenant/proje ve aynı nesneyi gösteren URL kabul', () => {
    expect(ok(asset())).toBe(true);
  });
  it('başka tenant/proje, klasör dışı yol, URL–yol uyuşmazlığı, tür uyuşmazlığı red', () => {
    expect(ok(asset(), 't2', 'projA')).toBe(false);
    expect(ok(asset(), 't1', 'projB')).toBe(false);
    expect(ok(asset({}, { path: 'brand-media/t1/projA/other/final.jpg', downloadUrl: url('brand-media/t1/projA/other/final.jpg') }))).toBe(false);
    expect(ok(asset({}, { downloadUrl: url('brand-media/t1/projA/a1/baska.jpg') }))).toBe(false);
    expect(ok(asset({}, { downloadUrl: url('social-media-drafts/t1/projA/x.jpg') }))).toBe(false);
    expect(ok(asset({ kind: 'video' }))).toBe(false);
    expect(ok(asset({}, { thumbUrl: url('brand-media/t1/projA/a2/thumb.jpg') }))).toBe(false);
    expect(ok(asset({}, { path: 'brand-media/t1/projA/a1/thumb.jpg', downloadUrl: url('brand-media/t1/projA/a1/thumb.jpg') }))).toBe(false);
  });
});

describe('güvenilen host/bucket (ana dosya ve önizleme)', () => {
  it('başka host, başka bucket veya HTTP reddedilir', () => {
    const p = 'brand-media/t1/projA/a1/final.jpg';
    expect(ok(asset({}, { downloadUrl: url(p, 'evil.example.com') }))).toBe(false);
    expect(ok(asset({}, { downloadUrl: url(p, undefined, 'evil.appspot.com') }))).toBe(false);
    expect(ok(asset({}, { downloadUrl: url(p).replace('https://', 'http://') }))).toBe(false);
    expect(ok(asset({}, { thumbUrl: url('brand-media/t1/projA/a1/thumb.jpg', 'evil.example.com') }))).toBe(false);
    expect(ok(asset({}, { thumbUrl: url('brand-media/t1/projA/a1/thumb.jpg', undefined, 'evil.appspot.com') }))).toBe(false);
  });
  it('bucket yapılandırılmamışsa hiçbir kayıt kabul edilmez (fail-closed)', () => {
    expect(isConsistentAsset(asset(), 't1', 'projA', { hosts: POLICY.hosts, buckets: [] })).toBe(false);
  });
  it('önizleme yolu ve URL\'si birlikte olmalı', () => {
    expect(ok(asset({}, { thumbUrl: undefined }))).toBe(false);
    expect(ok(asset({}, { thumbUrl: undefined, thumbPath: undefined }))).toBe(true);
  });
});

describe('post medyası ve libraryAssetIds', () => {
  it('varlıktan MediaItem kaynağını taşır', () => {
    const m = assetToMediaItem(asset(), 2);
    expect(m).toMatchObject({ libraryAssetId: 'a1', type: 'image', order: 2, url: asset().storage.downloadUrl, thumbnailUrl: asset().storage.thumbUrl });
  });
  it('seç/çıkar/sırala sonrası kimlikler medyadan türetilir', () => {
    const a = assetToMediaItem(asset(), 0);
    const b = assetToMediaItem(asset({ id: 'a2' }), 1);
    const upload = { libraryAssetId: undefined };
    expect(deriveLibraryAssetIds([a, upload, b])).toEqual(['a1', 'a2']);
    expect(deriveLibraryAssetIds([b, a])).toEqual(['a2', 'a1']);
    expect(deriveLibraryAssetIds([upload, b])).toEqual(['a2']);
    expect(deriveLibraryAssetIds([a, a])).toEqual(['a1']);
    expect(deriveLibraryAssetIds([{ libraryAssetId: '../x' }])).toEqual([]);
  });
});

describe('onay motoru: kütüphane yolu güvenilir kaynak', () => {
  const policy = { buckets: ['intiba.appspot.com'], hosts: ['firebasestorage.googleapis.com'] };
  it('aynı tenant/proje kabul, başka proje/tenant red', () => {
    expect(isTrustedMediaUrl(url('brand-media/t1/projA/a1/final.jpg'), 't1', 'projA', policy)).toBe(true);
    expect(isTrustedMediaUrl(url('brand-media/t1/projB/a1/final.jpg'), 't1', 'projA', policy)).toBe(false);
    expect(isTrustedMediaUrl(url('brand-media/t2/projA/a1/final.jpg'), 't1', 'projA', policy)).toBe(false);
    expect(isTrustedMediaUrl(url('brand-media/t1/projA/../../avatars/x.png'), 't1', 'projA', policy)).toBe(false);
  });
});
