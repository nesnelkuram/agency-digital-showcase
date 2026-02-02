import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  Competitor,
  CompetitorAnalysis,
  CompetitorStatus,
  CreateCompetitorData,
} from '@/shared/types/competitor';

// ============================================
// KOLEKSIYON SABITLERI
// ============================================

const COMPETITORS_COLLECTION = 'competitors';
const ANALYSES_COLLECTION = 'competitor_analyses';

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
// RAKIP CRUD
// ============================================

/**
 * Yeni rakip olustur.
 */
export async function createCompetitor(
  data: CreateCompetitorData,
  userId: string
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const competitorData: Omit<Competitor, 'id'> = {
    projectId: data.projectId,
    name: data.name,
    website: data.website,
    sector: data.sector,
    platforms: data.platforms,
    frequency: data.frequency,
    status: 'active',
    createdAt: Timestamp.now(),
    createdBy: userId,
  };

  const docRef = await addDoc(
    collection(db, COMPETITORS_COLLECTION),
    stripUndefined(competitorData)
  );
  return docRef.id;
}

/**
 * Tum rakipleri getir, olusturma tarihine gore siralama (en yeni en ustte).
 */
export async function getCompetitors(
  projectId?: string
): Promise<Competitor[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [];

  if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, COMPETITORS_COLLECTION), ...constraints);

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Competitor[];
  } catch (err: any) {
    // Composite index olmayabilir — fallback
    if (projectId && err?.code === 'failed-precondition') {
      console.warn(
        '[getCompetitors] Index missing, falling back to unordered query'
      );
      const fallbackQ = query(
        collection(db, COMPETITORS_COLLECTION),
        where('projectId', '==', projectId)
      );
      const snapshot = await getDocs(fallbackQ);
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Competitor[];
      // Client-side sort
      return docs.sort(
        (a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
      );
    }
    throw err;
  }
}

/**
 * Tek bir rakip getir.
 */
export async function getCompetitor(id: string): Promise<Competitor | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COMPETITORS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as Competitor;
}

/**
 * Rakibi guncelle (partial update).
 */
export async function updateCompetitor(
  id: string,
  data: Partial<Omit<Competitor, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COMPETITORS_COLLECTION, id);
  await updateDoc(docRef, stripUndefined(data));
}

/**
 * Rakibi sil.
 */
export async function deleteCompetitor(id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  await deleteDoc(doc(db, COMPETITORS_COLLECTION, id));
}

/**
 * Rakip durumunu guncelle (aktif/duraklatildi/arsivlendi).
 */
export async function toggleCompetitorStatus(
  id: string,
  status: CompetitorStatus
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COMPETITORS_COLLECTION, id);
  await updateDoc(docRef, { status });
}

// ============================================
// ANALIZ ISLEMLERI
// ============================================

/**
 * Analiz sonucunu kaydet.
 */
export async function saveAnalysis(
  data: Omit<CompetitorAnalysis, 'id'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = await addDoc(
    collection(db, ANALYSES_COLLECTION),
    stripUndefined(data)
  );
  return docRef.id;
}

/**
 * Bir rakip icin tum analizleri getir (en yeni en ustte).
 */
export async function getAnalyses(
  competitorId: string,
  maxResults: number = 10
): Promise<CompetitorAnalysis[]> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, ANALYSES_COLLECTION),
    where('competitorId', '==', competitorId),
    orderBy('analyzedAt', 'desc'),
    limit(maxResults)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as CompetitorAnalysis[];
}

/**
 * Bir rakip icin en son analizi getir.
 */
export async function getLatestAnalysis(
  competitorId: string
): Promise<CompetitorAnalysis | null> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, ANALYSES_COLLECTION),
    where('competitorId', '==', competitorId),
    orderBy('analyzedAt', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  } as CompetitorAnalysis;
}

/**
 * Her rakip icin en son analizi getir (toplu).
 * Her competitor icin tek tek getLatestAnalysis cagirarak toplar.
 */
export async function getAllLatestAnalyses(
  projectId?: string
): Promise<Map<string, CompetitorAnalysis>> {
  if (!db) throw new Error('Firebase not initialized');

  // Once tum rakipleri al
  const competitors = await getCompetitors(projectId);

  // Her biri icin en son analizi paralel getir
  const analysisMap = new Map<string, CompetitorAnalysis>();

  const promises = competitors.map(async (comp) => {
    const analysis = await getLatestAnalysis(comp.id);
    if (analysis) {
      analysisMap.set(comp.id, analysis);
    }
  });

  await Promise.all(promises);
  return analysisMap;
}
