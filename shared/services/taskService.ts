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
  onSnapshot,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Task, TaskStatus } from '@/shared/types/task';

const COLLECTION = 'tasks';

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

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createTask(
  tenantId: string,
  data: Omit<Task, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');
  const now = Timestamp.now();
  const docRef = doc(collection(db, COLLECTION));
  const taskData: Task = {
    ...data,
    id: docRef.id,
    tenantId,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(docRef, stripUndefined(taskData));
  return docRef.id;
}

export async function getTask(tenantId: string, taskId: string): Promise<Task | null> {
  if (!db) throw new Error('Firebase not initialized');
  const docRef = doc(db, COLLECTION, taskId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.tenantId !== tenantId) return null;
  return { id: snap.id, ...data } as Task;
}

export async function getTasks(
  tenantId: string,
  filters?: { assigneeId?: string; status?: TaskStatus; projectId?: string }
): Promise<Task[]> {
  if (!db) throw new Error('Firebase not initialized');
  const constraints: QueryConstraint[] = [where('tenantId', '==', tenantId)];
  if (filters?.assigneeId) constraints.push(where('assigneeId', '==', filters.assigneeId));
  if (filters?.status) constraints.push(where('status', '==', filters.status));
  if (filters?.projectId) constraints.push(where('projectId', '==', filters.projectId));
  constraints.push(orderBy('aiPriorityScore', 'desc'));

  const q = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Task[];
}

export async function updateTask(
  tenantId: string,
  taskId: string,
  data: Partial<Task>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  const docRef = doc(db, COLLECTION, taskId);
  await updateDoc(docRef, {
    ...stripUndefined(data),
    updatedAt: Timestamp.now(),
  });
}

export async function deleteTask(tenantId: string, taskId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  const docRef = doc(db, COLLECTION, taskId);
  await deleteDoc(docRef);
}

// ─── Real-time ────────────────────────────────────────────────────────────────

// All tasks for a tenant (manager/admin view)
export function subscribeToAllTasks(
  tenantId: string,
  onData: (tasks: Task[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!db) {
    onData([]);
    return () => {};
  }

  const q = query(
    collection(db, COLLECTION),
    where('tenantId', '==', tenantId),
    where('status', 'in', ['open', 'in_progress', 'awaiting_review', 'blocked']),
    orderBy('aiPriorityScore', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => {
      const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Task[];
      onData(tasks);
    },
    (err) => {
      console.error('[taskService] all-tasks subscription error:', err);
      onError?.(err);
    }
  );
}

export function subscribeToTasks(
  tenantId: string,
  userId: string,
  onData: (tasks: Task[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!db) {
    onData([]);
    return () => {};
  }

  const q = query(
    collection(db, COLLECTION),
    where('tenantId', '==', tenantId),
    where('assigneeId', '==', userId),
    where('status', 'in', ['open', 'in_progress', 'awaiting_review', 'blocked']),
    orderBy('aiPriorityScore', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => {
      const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Task[];
      onData(tasks);
    },
    (err) => {
      console.error('[taskService] subscription error:', err);
      onError?.(err);
    }
  );
}
