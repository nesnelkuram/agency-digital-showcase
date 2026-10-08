/**
 * Marka medya kütüphanesi — Firestore katalog erişimi (docs/studio-media-library.md).
 * Her sorgu tenantId + projectId taşır (kurallar filtre değildir). Okunan kayıtlar
 * isConsistentAsset ile yeniden doğrulanır; tutarsız kayıt listelenmez/seçilmez.
 */

import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  BRAND_MEDIA_COLLECTION,
  BRAND_MEDIA_MAX_TITLE_LENGTH,
  isConsistentAsset,
  normalizeTags,
  type BrandMediaAsset,
  type BrandMediaFile,
  type BrandMediaKind,
  type BrandMediaStatus,
} from '@/shared/types/brandMedia';
import type { SocialMediaPost } from '@/shared/types/socialMedia';
import { getClientMediaPolicy } from './library/mediaPolicy';

/** Bu sürümde sayfalama yok: en yeni 200 kayıt listelenir (UI bunu açıkça yazar) */
export const LIBRARY_PAGE_SIZE = 200;
/** Varlık başına gösterilen kullanım geçmişi üst sınırı */
export const ASSET_USAGE_LIMIT = 50;

function requireDb() {
  if (!db) throw new Error('Firebase hazır değil');
  return db;
}

/** Yeni varlık kimliği (Storage yolu ve katalog dokümanı aynı kimliği kullanır) */
export function newBrandMediaId(): string {
  return doc(collection(requireDb(), BRAND_MEDIA_COLLECTION)).id;
}

export async function listBrandMedia(
  tenantId: string,
  projectId: string,
  opts: { status?: BrandMediaStatus; tag?: string } = {}
): Promise<BrandMediaAsset[]> {
  const constraints = [
    where('tenantId', '==', tenantId),
    where('projectId', '==', projectId),
    where('status', '==', opts.status || 'active'),
    ...(opts.tag ? [where('tags', 'array-contains', opts.tag)] : []),
    orderBy('createdAt', 'desc'),
    limit(LIBRARY_PAGE_SIZE),
  ];
  const snap = await getDocs(query(collection(requireDb(), BRAND_MEDIA_COLLECTION), ...constraints));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as BrandMediaAsset)
    .filter((a) => isConsistentAsset(a, tenantId, projectId, getClientMediaPolicy()));
}

export async function brandMediaExists(assetId: string): Promise<boolean> {
  const snap = await getDoc(doc(requireDb(), BRAND_MEDIA_COLLECTION, assetId));
  return snap.exists();
}

export interface NewBrandMediaRecord {
  assetId: string;
  tenantId: string;
  projectId: string;
  kind: BrandMediaKind;
  title: string;
  fileName: string;
  tags: string[];
  storage: BrandMediaFile;
  createdBy: string;
  createdByName?: string;
}

/** Katalog kaydı — yalnız dosya(lar) tamamlandıktan sonra çağrılır */
export async function createBrandMediaRecord(r: NewBrandMediaRecord): Promise<void> {
  const storage: Record<string, unknown> = {
    path: r.storage.path,
    downloadUrl: r.storage.downloadUrl,
    contentType: r.storage.contentType,
    size: r.storage.size,
  };
  for (const k of ['width', 'height', 'duration'] as const) {
    const v = r.storage[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) storage[k] = k === 'duration' ? v : Math.round(v);
  }
  if (r.storage.thumbPath && r.storage.thumbUrl) {
    storage.thumbPath = r.storage.thumbPath;
    storage.thumbUrl = r.storage.thumbUrl;
  }
  await setDoc(doc(requireDb(), BRAND_MEDIA_COLLECTION, r.assetId), {
    tenantId: r.tenantId,
    projectId: r.projectId,
    kind: r.kind,
    title: r.title.slice(0, BRAND_MEDIA_MAX_TITLE_LENGTH),
    fileName: r.fileName.slice(0, 255),
    tags: normalizeTags(r.tags),
    status: 'active',
    storage,
    createdBy: r.createdBy,
    ...(r.createdByName ? { createdByName: r.createdByName.slice(0, 200) } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateBrandMediaInfo(assetId: string, info: { title: string; tags: string[] }): Promise<void> {
  await updateDoc(doc(requireDb(), BRAND_MEDIA_COLLECTION, assetId), {
    title: info.title.slice(0, BRAND_MEDIA_MAX_TITLE_LENGTH),
    tags: normalizeTags(info.tags),
    updatedAt: serverTimestamp(),
  });
}

export async function setBrandMediaArchived(assetId: string, archived: boolean): Promise<void> {
  await updateDoc(doc(requireDb(), BRAND_MEDIA_COLLECTION, assetId), {
    status: archived ? 'archived' : 'active',
    archivedAt: archived ? serverTimestamp() : deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export interface AssetUsage {
  postId: string;
  status: SocialMediaPost['status'];
  postType: SocialMediaPost['postType'];
  contentPlanId?: string;
  scheduledAt?: SocialMediaPost['scheduledAt'];
  publishedAt?: SocialMediaPost['publishedAt'];
}

/** Kullanım geçmişi: varlığı kaydedilmiş post'lardaki libraryAssetIds'den (seçili ama kaydedilmemiş seçim girmez) */
export async function getAssetUsage(tenantId: string, projectId: string, assetId: string): Promise<AssetUsage[]> {
  const snap = await getDocs(
    query(
      collection(requireDb(), 'social_media_posts'),
      where('tenantId', '==', tenantId),
      where('projectId', '==', projectId),
      where('libraryAssetIds', 'array-contains', assetId),
      limit(ASSET_USAGE_LIMIT)
    )
  );
  return snap.docs.map((d) => {
    const p = d.data() as SocialMediaPost;
    return {
      postId: d.id,
      status: p.status,
      postType: p.postType,
      contentPlanId: p.contentPlanId,
      scheduledAt: p.scheduledAt,
      publishedAt: p.publishedAt,
    };
  });
}

/** Firestore array-contains-any en fazla 30 değer kabul eder */
const ANY_CHUNK = 30;

/**
 * Verilen varlıklardan kaydedilmiş bir post'ta kullanılanlar — kesin sonuç (son-N post sınırı yok).
 * Her parça için ayrı sorgu; biri başarısız olursa hata fırlatır (çağıran "bilinmiyor" gösterir).
 */
export async function getUsedAssetIds(tenantId: string, projectId: string, assetIds: string[]): Promise<Set<string>> {
  const wanted = Array.from(new Set(assetIds));
  const used = new Set<string>();
  for (let i = 0; i < wanted.length; i += ANY_CHUNK) {
    const chunk = wanted.slice(i, i + ANY_CHUNK);
    const snap = await getDocs(
      query(
        collection(requireDb(), 'social_media_posts'),
        where('tenantId', '==', tenantId),
        where('projectId', '==', projectId),
        where('libraryAssetIds', 'array-contains-any', chunk)
      )
    );
    const inChunk = new Set(chunk);
    for (const d of snap.docs) for (const id of (d.data() as SocialMediaPost).libraryAssetIds || []) if (inChunk.has(id)) used.add(id);
  }
  return used;
}
