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
  writeBatch,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Task, TaskStatus, TaskNote } from '@/shared/types/task';

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

/**
 * Bir parent task + tüm child'larını tek batch'te siler.
 * Standalone task'larda da güvenli — child yoksa sadece parent silinir.
 */
export async function deleteTaskCascade(tenantId: string, taskId: string): Promise<number> {
  if (!db) throw new Error('Firebase not initialized');
  const childrenSnap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('tenantId', '==', tenantId),
      where('parentTaskId', '==', taskId)
    )
  );
  const batch = writeBatch(db);
  childrenSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, COLLECTION, taskId));
  await batch.commit();
  return childrenSnap.size;
}

// ─── Notlar (zaman damgalı not akışı) ────────────────────────────────────────
// notes bir dizi alan olarak task dokümanında tutulur (workSessions gibi).
// Tek bir notu düzenlemek/silmek için read-modify-write yapıyoruz; eşzamanlı
// yarışlara karşı taze diziyi sunucudan okuyup yeniden yazıyoruz.

function genNoteId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export async function addTaskNote(
  tenantId: string,
  taskId: string,
  note: { text: string; authorId: string; authorName: string }
): Promise<void> {
  const text = note.text.trim();
  if (!text) return;
  const existing = await getTask(tenantId, taskId);
  if (!existing) throw new Error('Görev bulunamadı');
  const entry: TaskNote = {
    id: genNoteId(),
    text,
    authorId: note.authorId,
    authorName: note.authorName,
    createdAt: Date.now(),
  };
  const notes = [...(existing.notes || []), entry];
  await updateTask(tenantId, taskId, { notes });
}

export async function updateTaskNote(
  tenantId: string,
  taskId: string,
  noteId: string,
  text: string
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const existing = await getTask(tenantId, taskId);
  if (!existing) throw new Error('Görev bulunamadı');
  const notes = (existing.notes || []).map((n) =>
    n.id === noteId ? { ...n, text: trimmed, updatedAt: Date.now() } : n
  );
  await updateTask(tenantId, taskId, { notes });
}

export async function deleteTaskNote(
  tenantId: string,
  taskId: string,
  noteId: string
): Promise<void> {
  const existing = await getTask(tenantId, taskId);
  if (!existing) throw new Error('Görev bulunamadı');
  const notes = (existing.notes || []).filter((n) => n.id !== noteId);
  await updateTask(tenantId, taskId, { notes });
}

// ─── SOP breakdown — atomic write of children + parent counter ───────────────
export interface BreakdownChildInput {
  title: string;
  estimatedMinutes: number;
  alreadyDone?: boolean;                // başlangıçta status='completed' yaz
  trainingResourceId?: string;          // checkpoint videosu
}

export async function saveBreakdown(
  tenantId: string,
  parentTaskId: string,
  steps: BreakdownChildInput[],
  meta: {
    createdBy: string;
    createdByName: string;
    inheritedProjectId?: string;
    inheritedProjectName?: string;
    inheritedCategory?: Task['category'];
    parentPriorityScore: number;
    sopId?: string;                  // mevcut SOP'tan türetildiyse
    sopName?: string;
    asDraft?: boolean;               // true → tamamlanmamış adımlar status='draft' (taslak) yazılır
  }
): Promise<string[]> {
  if (!db) throw new Error('Firebase not initialized');
  if (steps.length === 0) return [];

  // Mevcut alt görev sayısı — tekrar çağrılırsa sıra/say bozulmasın (append davranışı)
  const existingSnap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('tenantId', '==', tenantId),
      where('parentTaskId', '==', parentTaskId)
    )
  );
  const offset = existingSnap.size;

  const batch = writeBatch(db);
  const now = Timestamp.now();
  const childIds: string[] = [];

  steps.forEach((step, index) => {
    const childRef = doc(collection(db!, COLLECTION));
    childIds.push(childRef.id);

    const isAlreadyDone = Boolean(step.alreadyDone);

    const child: Record<string, any> = {
      id: childRef.id,
      tenantId,
      title: step.title,
      status: isAlreadyDone ? 'completed' : meta.asDraft ? 'draft' : 'open',
      priority: 'medium',
      aiPriorityScore: meta.parentPriorityScore,
      aiRiskLevel: 'none',
      aiAnalyzed: true,
      parentTaskId,
      sortOrder: offset + index,
      estimatedMinutes: step.estimatedMinutes,
      createdBy: meta.createdBy,
      createdByName: meta.createdByName,
      createdAt: now,
      updatedAt: now,
      categorySource: 'ai',
      ...(isAlreadyDone ? { completedAt: now } : {}),
    };

    if (meta.inheritedProjectId) child.projectId = meta.inheritedProjectId;
    if (meta.inheritedProjectName) child.projectName = meta.inheritedProjectName;
    if (meta.inheritedCategory) child.category = meta.inheritedCategory;
    if (meta.sopId) child.derivedFromSopId = meta.sopId;
    if (meta.sopName) child.derivedFromSopName = meta.sopName;
    if (step.trainingResourceId) child.linkedTrainingResourceId = step.trainingResourceId;

    batch.set(childRef, child);
  });

  const parentRef = doc(db, COLLECTION, parentTaskId);
  const parentPatch: Record<string, any> = {
    subTaskCount: offset + steps.length,
    updatedAt: now,
  };
  if (meta.sopId) parentPatch.derivedFromSopId = meta.sopId;
  if (meta.sopName) parentPatch.derivedFromSopName = meta.sopName;
  batch.update(parentRef, parentPatch);

  await batch.commit();
  return childIds;
}

/**
 * Bir parent task'ın tüm alt görevlerini sortOrder'a göre döndürür.
 * Taslak (draft) child'lar da dahil — aktif akış sorguları bunları hariç tutar,
 * ama parent detayında hepsini göstermemiz gerekir.
 */
export async function getSubtasks(tenantId: string, parentTaskId: string): Promise<Task[]> {
  if (!db) throw new Error('Firebase not initialized');
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('tenantId', '==', tenantId),
      where('parentTaskId', '==', parentTaskId)
    )
  );
  const children = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Task[];
  children.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return children;
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
    where('status', 'in', ['open', 'in_progress', 'paused', 'awaiting_review', 'blocked']),
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

  // Sadece tenant + statü filtresi sunucuda. "Bana ait mi" istemcide:
  // görev kişiye tekil `assigneeId`, `createdBy` veya çoklu `collaboratorIds`
  // ile bağlı olabilir; Firestore bunları tek sorguda OR'layamaz.
  const q = query(
    collection(db, COLLECTION),
    where('tenantId', '==', tenantId),
    where('status', 'in', ['open', 'in_progress', 'paused', 'awaiting_review', 'blocked']),
    orderBy('aiPriorityScore', 'desc')
  );

  const isMine = (data: any): boolean =>
    data.assigneeId === userId ||
    data.createdBy === userId ||
    (Array.isArray(data.collaboratorIds) && data.collaboratorIds.includes(userId));

  return onSnapshot(
    q,
    (snap) => {
      const tasks: Task[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (!isMine(data)) return;
        tasks.push({ id: d.id, ...data } as Task);
      });
      onData(tasks);
    },
    (err) => {
      console.error('[taskService] subscription error:', err);
      onError?.(err);
    }
  );
}
