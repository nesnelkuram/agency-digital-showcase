/**
 * Marka medya kütüphanesi — paylaşılmaya hazır FINAL fotoğraf/video kataloğu (docs/studio-media-library.md).
 * Dosya: Firebase Storage `brand-media/{tenantId}/{projectId}/{assetId}/…` (write-once).
 * Katalog: Firestore `brand_media/{assetId}`. Marka = markanın sosyal medya projesi (`projectId`).
 * Ham dosya, Drive bağı ve çekim tarihi bu modülün işi değildir.
 */

import type { MediaItem } from './socialMedia';
import { parseStorageDownloadUrl, type MediaSourcePolicy } from '../approval/approvalEngine';

export type { MediaSourcePolicy };

export const BRAND_MEDIA_COLLECTION = 'brand_media';
export const BRAND_MEDIA_STORAGE_ROOT = 'brand-media';

/**
 * Panel yükleme sınırı: dosya başına 1 GB = 1_000_000_000 bayt (ondalık; GiB değil).
 * storage.rules ve firestore.rules aynı sayıyı kullanır (tests/brandMediaRulesConstant.test.ts).
 * Bu bir Meta/Instagram kabul sınırı değildir; yayın uygunluğu instagramReadiness ile ayrıca kontrol edilir.
 */
export const LIBRARY_MAX_FILE_BYTES = 1_000_000_000;
/** Önizleme dosyası (aynı klasörde, write-once) */
export const LIBRARY_THUMB_FILE = 'thumb.jpg';
export const LIBRARY_THUMB_MAX_BYTES = 2_000_000;
export const BRAND_MEDIA_MAX_TAGS = 20;
export const BRAND_MEDIA_MAX_TAG_LENGTH = 40;
export const BRAND_MEDIA_MAX_TITLE_LENGTH = 200;
/** Bir post'ta en fazla medya (Instagram carousel: 10 öğe) — firestore.rules libraryAssetIds sınırı ile aynı */
export const POST_MAX_LIBRARY_ASSETS = 10;

export type BrandMediaKind = 'photo' | 'video';
export type BrandMediaStatus = 'active' | 'archived';

export interface BrandMediaFile {
  path: string;
  downloadUrl: string;
  contentType: string;
  size: number;
  width?: number;
  height?: number;
  /** saniye */
  duration?: number;
  thumbPath?: string;
  thumbUrl?: string;
}

export interface BrandMediaAsset {
  id: string;
  tenantId: string;
  projectId: string;
  kind: BrandMediaKind;
  title: string;
  fileName: string;
  tags: string[];
  status: BrandMediaStatus;
  storage: BrandMediaFile;
  createdBy: string;
  createdByName?: string;
  createdAt?: any;
  updatedAt?: any;
  archivedAt?: any;
}

// ── Biçim ve doğrulama ──

/** Ondalık birimlerle boyut (1 GB = 1_000_000_000 bayt) — kütüphane ekranlarında tek biçimleyici */
export function formatBytesDecimal(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = bytes;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  const s = i === 0 ? String(Math.round(v)) : v.toFixed(v >= 100 ? 0 : 1).replace(/\.0$/, '');
  return `${s.replace('.', ',')} ${units[i]}`;
}

/** Firestore/Storage yolunda kullanılacak kimlik güvenli mi (kurallar da aynı deseni ister) */
export function isSafePathId(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

export function kindFromMime(mime: string): BrandMediaKind | null {
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

/** Yüklemeden önce: boş, 1 GB üstü veya fotoğraf/video olmayan dosyayı reddeder */
export function validateLibraryFile(file: { size: number; type: string; name?: string }): string | null {
  if (!kindFromMime(file.type || '')) return 'Yalnızca fotoğraf veya video yüklenebilir.';
  if (!(file.size > 0)) return 'Dosya boş.';
  if (file.size > LIBRARY_MAX_FILE_BYTES) {
    return `Dosya çok büyük (${formatBytesDecimal(file.size)}). Panel yükleme sınırı dosya başına 1 GB.`;
  }
  return null;
}

const TR_ASCII: Record<string, string> = { ı: 'i', İ: 'I', ş: 's', Ş: 'S', ç: 'c', Ç: 'C', ö: 'o', Ö: 'O', ü: 'u', Ü: 'U', ğ: 'g', Ğ: 'G' };

/** Storage nesne adı: ASCII, boşluk/özel karakter yok, önizleme adıyla çakışmaz */
export function safeStorageFileName(name: string): string {
  const ascii = name
    .split('')
    .map((c) => TR_ASCII[c] ?? c)
    .join('')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/_+/g, '_')
    .replace(/^[._]+/, '')
    .slice(-100);
  const base = ascii || 'file';
  return base.toLowerCase() === LIBRARY_THUMB_FILE ? `file_${base}` : base;
}

export function brandMediaFolder(tenantId: string, projectId: string, assetId: string): string {
  return `${BRAND_MEDIA_STORAGE_ROOT}/${tenantId}/${projectId}/${assetId}`;
}

/** Etiket: küçük harf (tr), baştaki # yok, boşluk → tire, harf/rakam/-/_ dışı kaldırılır */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLocaleLowerCase('tr')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, BRAND_MEDIA_MAX_TAG_LENGTH);
}

export function normalizeTags(input: string | string[]): string[] {
  const parts = Array.isArray(input) ? input : input.split(/[,\n]+|\s+(?=#)/);
  const out: string[] = [];
  for (const p of parts) {
    const t = normalizeTag(p);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= BRAND_MEDIA_MAX_TAGS) break;
  }
  return out;
}

/** HTTPS + güvenilen host + güvenilen bucket'ta bir Firebase Storage indirme URL'si; nesne yolunu döndürür */
function trustedObjectPath(url: string | undefined, policy: MediaSourcePolicy): string | null {
  if (!url || !url.startsWith('https://')) return null;
  const parsed = parseStorageDownloadUrl(url);
  if (!parsed || !policy.hosts.includes(parsed.host) || !policy.buckets.includes(parsed.bucket)) return null;
  return parsed.path;
}

/**
 * Katalog kaydı ile medya dosyası tutarlı mı ve bu marka projesine mi ait?
 * tenant/proje eşleşmesi, yolun varlık klasöründe olması ve indirme URL'lerinin (ana dosya + önizleme)
 * güvenilen host/bucket'ta aynı nesneleri göstermesi.
 */
export function isConsistentAsset(
  asset: BrandMediaAsset | null | undefined,
  tenantId: string,
  projectId: string,
  policy: MediaSourcePolicy
): boolean {
  if (!asset || asset.tenantId !== tenantId || asset.projectId !== projectId) return false;
  if (!isSafePathId(asset.id) || !isSafePathId(tenantId) || !isSafePathId(projectId)) return false;
  const folder = `${brandMediaFolder(tenantId, projectId, asset.id)}/`;
  const s = asset.storage;
  if (!s || typeof s.path !== 'string' || !s.path.startsWith(folder) || s.path.includes('..')) return false;
  if (s.path.slice(folder.length).includes('/') || s.path.endsWith(`/${LIBRARY_THUMB_FILE}`)) return false;
  if (trustedObjectPath(s.downloadUrl, policy) !== s.path) return false;
  if (kindFromMime(s.contentType || '') !== asset.kind) return false;
  if (s.thumbUrl || s.thumbPath) {
    const thumbPath = trustedObjectPath(s.thumbUrl, policy);
    if (!thumbPath || thumbPath !== `${folder}${LIBRARY_THUMB_FILE}` || s.thumbPath !== thumbPath) return false;
  }
  return true;
}

/** Kütüphane varlığından post medyası (kaynağı libraryAssetId ile işaretli) */
export function assetToMediaItem(asset: BrandMediaAsset, order: number): MediaItem {
  return {
    id: `lib_${asset.id}`,
    url: asset.storage.downloadUrl,
    ...(asset.storage.thumbUrl ? { thumbnailUrl: asset.storage.thumbUrl } : {}),
    type: asset.kind === 'video' ? 'video' : 'image',
    mimeType: asset.storage.contentType,
    size: asset.storage.size,
    ...(asset.storage.width ? { width: asset.storage.width } : {}),
    ...(asset.storage.height ? { height: asset.storage.height } : {}),
    ...(asset.storage.duration ? { duration: asset.storage.duration } : {}),
    order,
    libraryAssetId: asset.id,
  };
}

/**
 * Post'un `libraryAssetIds` alanı her zaman medyadan türetilir (seç/çıkar/sırala sonrası tutarlı kalır).
 * Kullanım geçmişi yalnızca kaydedilmiş post'taki bu alandan okunur.
 */
export function deriveLibraryAssetIds(media: Array<Pick<MediaItem, 'libraryAssetId'>>): string[] {
  const out: string[] = [];
  for (const m of media) {
    if (m.libraryAssetId && isSafePathId(m.libraryAssetId) && !out.includes(m.libraryAssetId)) out.push(m.libraryAssetId);
  }
  return out;
}
