import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  QueryConstraint,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { AIAgent } from '@/shared/types/agent';

const COLLECTION = 'ai_agents';

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

export async function getAgents(
  tenantId: string,
  filters?: { agentType?: string; status?: string }
): Promise<AIAgent[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('tenantId', '==', tenantId),
  ];

  if (filters?.agentType) {
    constraints.push(where('agentType', '==', filters.agentType));
  }

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as AIAgent[];
}

export async function getAgent(
  tenantId: string,
  agentId: string
): Promise<AIAgent | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION, agentId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data() as Omit<AIAgent, 'id'>;
  if (data.tenantId !== tenantId) return null;

  return { id: docSnap.id, ...data };
}

export async function createAgent(
  tenantId: string,
  data: Omit<AIAgent, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const now = Date.now();
  const docRef = doc(collection(db, COLLECTION));

  const agentData: Omit<AIAgent, 'id'> = {
    ...data,
    tenantId,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, stripUndefined(agentData));
  return docRef.id;
}

export async function updateAgent(
  tenantId: string,
  agentId: string,
  data: Partial<Omit<AIAgent, 'id' | 'tenantId' | 'createdAt'>>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const current = await getAgent(tenantId, agentId);
  if (!current) throw new Error('Agent not found or access denied');

  const docRef = doc(db, COLLECTION, agentId);
  await updateDoc(docRef, {
    ...stripUndefined(data),
    updatedAt: Date.now(),
  });
}

export async function deleteAgent(
  tenantId: string,
  agentId: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const current = await getAgent(tenantId, agentId);
  if (!current) throw new Error('Agent not found or access denied');

  await deleteDoc(doc(db, COLLECTION, agentId));
}
