import {
  collection,
  doc,
  addDoc,
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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { ABTest, ABTestStatus } from '@/shared/types/abTest';

// ============================================
// KOLEKSIYON SABITI
// ============================================

const AB_TESTS_COLLECTION = 'ab_tests';

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
// A/B TEST CRUD
// ============================================

export async function createABTest(
  data: Omit<ABTest, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const testData = {
    ...stripUndefined(data),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(
    collection(db, AB_TESTS_COLLECTION),
    testData
  );
  return docRef.id;
}

export async function getABTests(
  filters?: {
    projectId?: string;
    campaignId?: string;
    status?: ABTestStatus;
  },
  pageSize: number = 20
): Promise<ABTest[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [];

  if (filters?.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }

  if (filters?.campaignId) {
    constraints.push(where('campaignId', '==', filters.campaignId));
  }

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(pageSize));

  const q = query(collection(db, AB_TESTS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ABTest[];
}

export async function getABTest(id: string): Promise<ABTest | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, AB_TESTS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as ABTest;
}

export async function updateABTest(
  id: string,
  data: Partial<ABTest>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, AB_TESTS_COLLECTION, id);
  await updateDoc(docRef, {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteABTest(id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await deleteDoc(doc(db, AB_TESTS_COLLECTION, id));
}

// ============================================
// TEST DURUM YONETIMI
// ============================================

export async function startTest(id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, AB_TESTS_COLLECTION, id);
  await updateDoc(docRef, {
    status: 'running',
    startDate: new Date().toISOString().split('T')[0],
    updatedAt: serverTimestamp(),
  });
}

export async function stopTest(id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, AB_TESTS_COLLECTION, id);
  await updateDoc(docRef, {
    status: 'stopped',
    endDate: new Date().toISOString().split('T')[0],
    updatedAt: serverTimestamp(),
  });
}

export async function declareWinner(
  id: string,
  winnerId: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, AB_TESTS_COLLECTION, id);
  await updateDoc(docRef, {
    winnerId,
    status: 'completed',
    endDate: new Date().toISOString().split('T')[0],
    updatedAt: serverTimestamp(),
  });
}
