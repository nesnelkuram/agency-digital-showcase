import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

// ============================================
// TIPLER
// ============================================

export interface UTMLink {
  id: string;
  projectId?: string;
  baseUrl: string;
  source: string;      // utm_source
  medium: string;      // utm_medium
  campaign: string;    // utm_campaign
  term?: string;       // utm_term
  content?: string;    // utm_content
  fullUrl: string;     // computed full URL
  createdBy: string;
  createdAt: any;      // Timestamp
}

// ============================================
// KOLEKSIYON SABITI
// ============================================

const UTM_LINKS_COLLECTION = 'utm_links';

// ============================================
// YARDIMCI FONKSIYONLAR
// ============================================

/**
 * Verilen parametrelerden UTM'li tam URL olusturur.
 */
export function buildUTMUrl(
  baseUrl: string,
  params: {
    source: string;
    medium: string;
    campaign: string;
    term?: string;
    content?: string;
  }
): string {
  try {
    // Protokol yoksa ekle
    const urlStr = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
    const url = new URL(urlStr);

    url.searchParams.set('utm_source', params.source);
    url.searchParams.set('utm_medium', params.medium);
    url.searchParams.set('utm_campaign', params.campaign);

    if (params.term) {
      url.searchParams.set('utm_term', params.term);
    }
    if (params.content) {
      url.searchParams.set('utm_content', params.content);
    }

    return url.toString();
  } catch {
    // URL constructor basarisiz olursa fallback olarak string birlestirme kullan
    const separator = baseUrl.includes('?') ? '&' : '?';
    const parts = [
      `utm_source=${encodeURIComponent(params.source)}`,
      `utm_medium=${encodeURIComponent(params.medium)}`,
      `utm_campaign=${encodeURIComponent(params.campaign)}`,
    ];
    if (params.term) {
      parts.push(`utm_term=${encodeURIComponent(params.term)}`);
    }
    if (params.content) {
      parts.push(`utm_content=${encodeURIComponent(params.content)}`);
    }
    return `${baseUrl}${separator}${parts.join('&')}`;
  }
}

// ============================================
// CRUD FONKSIYONLARI
// ============================================

/**
 * Yeni bir UTM link'i Firestore'a kaydeder.
 * @returns Olusturulan belgenin ID'si
 */
export async function createUTMLink(
  tenantId: string,
  data: Omit<UTMLink, 'id' | 'createdAt'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const docData = {
    tenantId,
    projectId: data.projectId || null,
    baseUrl: data.baseUrl,
    source: data.source,
    medium: data.medium,
    campaign: data.campaign,
    term: data.term || null,
    content: data.content || null,
    fullUrl: data.fullUrl,
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(
    collection(db, UTM_LINKS_COLLECTION),
    docData
  );

  return docRef.id;
}

/**
 * UTM linklerini listeler, createdAt'e gore azalan sirali.
 * Opsiyonel projectId filtresi ve limit destekler.
 */
export async function getUTMLinks(
  tenantId: string,
  projectId?: string,
  limitCount: number = 20
): Promise<UTMLink[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints = [
    where('tenantId', '==', tenantId),
  ];

  if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(fbLimit(limitCount));

  const q = query(collection(db, UTM_LINKS_COLLECTION), ...constraints);

  try {
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as UTMLink[];
  } catch (err: any) {
    // Composite index henuz yoksa projectId olmadan dene
    if (projectId && err?.code === 'failed-precondition') {
      console.warn(
        '[getUTMLinks] Composite index eksik, filtresiz sorgu deneniyor'
      );
      const fallbackQ = query(
        collection(db, UTM_LINKS_COLLECTION),
        where('tenantId', '==', tenantId),
        where('projectId', '==', projectId)
      );
      const snapshot = await getDocs(fallbackQ);
      const links = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as UTMLink[];

      // Manuel olarak createdAt'e gore sirala ve limitle
      return links
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        })
        .slice(0, limitCount);
    }
    throw err;
  }
}

/**
 * Belirtilen ID'ye sahip UTM link'ini siler.
 */
export async function deleteUTMLink(tenantId: string, id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  await deleteDoc(doc(db, UTM_LINKS_COLLECTION, id));
}
