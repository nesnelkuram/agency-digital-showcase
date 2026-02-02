import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  QueryConstraint,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  CreativeAsset,
  CreativeType,
  CreativeStatus,
} from '@/shared/types/creative';
import type { AdPlatform } from '@/shared/types/marketing';

// ============================================
// KOLEKSIYON SABITI
// ============================================

const CREATIVES_COLLECTION = 'creatives';

// ============================================
// YARDIMCI FONKSIYONLAR
// ============================================

function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Timestamp) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        result[key] = stripUndefined(val);
      }
    }
    return result;
  }
  return obj;
}

// ============================================
// DOSYA YUKLEME (Vercel Blob API uzerinden)
// ============================================

/**
 * Kreatif dosyasini /api/marketing/upload-creative endpoint'ine yukler.
 * Client tarafinda @vercel/blob dogrudan import edilmez.
 */
export async function uploadCreativeFile(
  file: File
): Promise<{ url: string; thumbnailUrl?: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/marketing/upload-creative', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Dosya yukleme basarisiz');
  }

  return { url: data.url, thumbnailUrl: data.thumbnailUrl };
}

// ============================================
// KREATIF OLUSTURMA
// ============================================

/**
 * Yeni bir kreatif asset olusturur.
 * id, createdAt ve updatedAt otomatik atanir.
 */
export async function createCreative(
  data: Omit<CreativeAsset, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  if (!db) throw new Error('Firebase baglantisi yok');

  const creativeData = {
    ...stripUndefined(data),
    platforms: data.platforms || [],
    tags: data.tags || [],
    campaignIds: data.campaignIds || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(
    collection(db, CREATIVES_COLLECTION),
    creativeData
  );
  return docRef.id;
}

// ============================================
// TEK KREATIF GETIRME
// ============================================

/**
 * ID'ye gore tek bir kreatif dondurur.
 * Bulunamazsa null doner.
 */
export async function getCreative(id: string): Promise<CreativeAsset | null> {
  if (!db) throw new Error('Firebase baglantisi yok');

  const docRef = doc(db, CREATIVES_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as CreativeAsset;
}

// ============================================
// KREATIF LISTELEME VE FILTRELEME
// ============================================

/**
 * Filtrelere gore kreatif listesi dondurur.
 * Firestore text-search desteklemedigi icin name araması client-side yapilir.
 * Varsayilan siralamasi: updatedAt desc.
 */
export async function getCreatives(
  filters?: {
    projectId?: string;
    type?: CreativeType;
    status?: CreativeStatus;
    platform?: AdPlatform;
    search?: string;
  },
  pageSize: number = 50
): Promise<CreativeAsset[]> {
  if (!db) throw new Error('Firebase baglantisi yok');

  const constraints: QueryConstraint[] = [];

  // Proje filtresi
  if (filters?.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }

  // Tip filtresi
  if (filters?.type) {
    constraints.push(where('type', '==', filters.type));
  }

  // Durum filtresi
  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  // Platform filtresi (array-contains)
  if (filters?.platform) {
    constraints.push(where('platforms', 'array-contains', filters.platform));
  }

  // Siralama: en son guncellenen en basta
  constraints.push(orderBy('updatedAt', 'desc'));
  constraints.push(limit(pageSize));

  const q = query(collection(db, CREATIVES_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  let results: CreativeAsset[] = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as CreativeAsset[];

  // Client-side text araması (Firestore full-text search desteklemiyor)
  if (filters?.search) {
    const searchLower = filters.search.toLowerCase();
    results = results.filter(
      (c) =>
        c.name.toLowerCase().includes(searchLower) ||
        c.headline?.toLowerCase().includes(searchLower) ||
        c.primaryText?.toLowerCase().includes(searchLower) ||
        c.tags.some((t) => t.toLowerCase().includes(searchLower))
    );
  }

  return results;
}

// ============================================
// KREATIF GUNCELLEME
// ============================================

/**
 * Mevcut bir kreatifi kismı verilerle gunceller.
 * updatedAt otomatik olarak serverTimestamp ile set edilir.
 */
export async function updateCreative(
  id: string,
  data: Partial<CreativeAsset>
): Promise<void> {
  if (!db) throw new Error('Firebase baglantisi yok');

  const docRef = doc(db, CREATIVES_COLLECTION, id);
  await updateDoc(docRef, {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// KREATIF SILME
// ============================================

/**
 * Kreatif dokumanini Firestore'dan siler.
 * Dosya silimi (Blob) ayri olarak handle edilmelidir.
 */
export async function deleteCreative(id: string): Promise<void> {
  if (!db) throw new Error('Firebase baglantisi yok');

  await deleteDoc(doc(db, CREATIVES_COLLECTION, id));
}

// ============================================
// KREATIF-KAMPANYA BAGLAMA
// ============================================

/**
 * Bir kreatifi bir kampanyaya baglar.
 * Firestore arrayUnion ile campaignIds'e ekleme yapar (tekrar eklemez).
 */
export async function linkCreativeToCampaign(
  creativeId: string,
  campaignId: string
): Promise<void> {
  if (!db) throw new Error('Firebase baglantisi yok');

  const docRef = doc(db, CREATIVES_COLLECTION, creativeId);
  await updateDoc(docRef, {
    campaignIds: arrayUnion(campaignId),
    updatedAt: serverTimestamp(),
  });
}
