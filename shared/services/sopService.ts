import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { AgencySop, SopStep } from '@/shared/types/sop';

const COLLECTION = 'agency_sops';

export async function listSops(tenantId: string): Promise<AgencySop[]> {
  if (!db) return [];
  const q = query(
    collection(db, COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('usageCount', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as AgencySop[];
}

export async function getSop(sopId: string): Promise<AgencySop | null> {
  if (!db) return null;
  const { getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, COLLECTION, sopId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AgencySop;
}

export interface CreateSopInput {
  tenantId: string;
  name: string;
  description?: string;
  matchKeywords?: string[];
  steps: SopStep[];
  createdBy: string;
  createdByName: string;
}

export async function createSop(input: CreateSopInput): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');
  const ref = doc(collection(db, COLLECTION));
  const now = Timestamp.now();
  const sop: AgencySop = {
    id: ref.id,
    tenantId: input.tenantId,
    name: input.name,
    description: input.description || '',
    matchKeywords: input.matchKeywords || [],
    steps: input.steps,
    usageCount: 0,
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, sop);
  return ref.id;
}

export async function updateSop(sopId: string, patch: Partial<AgencySop>): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await updateDoc(doc(db, COLLECTION, sopId), {
    ...patch,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteSop(sopId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await deleteDoc(doc(db, COLLECTION, sopId));
}

// SOP kullanıldığında popülariteyi artır
export async function incrementUsage(sopId: string): Promise<void> {
  if (!db) return;
  const ref = doc(db, COLLECTION, sopId);
  // Read-then-write yerine FieldValue.increment kullanmak ideal ama
  // şimdilik basit tutuyoruz; ileride atomic counter'a çevrilebilir
  const { getDoc } = await import('firebase/firestore');
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const current = (snap.data().usageCount as number) || 0;
  await updateDoc(ref, {
    usageCount: current + 1,
    lastUsedAt: Timestamp.now(),
  });
}
