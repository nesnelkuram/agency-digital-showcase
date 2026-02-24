import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
  Timestamp,
  QueryConstraint,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { WorkflowInstance, StepInstance } from '@/shared/types/workflow/instance';

const COLLECTION_NAME = 'workflow_instances';

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
// CRUD OPERATIONS
// ============================================

export async function getWorkflowInstances(
  tenantId: string,
  filters?: { projectId?: string; status?: string }
): Promise<WorkflowInstance[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [where('tenantId', '==', tenantId)];

  if (filters?.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, COLLECTION_NAME), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as WorkflowInstance[];
}

export async function getWorkflowInstance(
  tenantId: string,
  instanceId: string
): Promise<WorkflowInstance | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, instanceId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as WorkflowInstance;
}

export async function createWorkflowInstance(
  tenantId: string,
  data: Omit<WorkflowInstance, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'auditLog'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const now = Timestamp.now();
  const docRef = doc(collection(db, COLLECTION_NAME));

  const instanceData: Omit<WorkflowInstance, 'id'> = {
    tenantId,
    status: 'pending',
    progress: 0,
    activeAssigneeIds: [],
    activeStepLabels: [],
    lastActivityAt: now,
    auditLog: [],
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, stripUndefined(instanceData));
  return docRef.id;
}

export async function updateWorkflowInstance(
  tenantId: string,
  instanceId: string,
  data: Partial<WorkflowInstance>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, instanceId);
  const current = await getWorkflowInstance(tenantId, instanceId);
  if (!current) throw new Error('Workflow instance not found');

  await updateDoc(docRef, {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  });
}

export async function updateStepStatus(
  tenantId: string,
  instanceId: string,
  nodeId: string,
  stepUpdate: Partial<StepInstance>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, instanceId);
  const current = await getWorkflowInstance(tenantId, instanceId);
  if (!current) throw new Error('Workflow instance not found');

  // Build update object with dot notation for nested fields
  const updateObj: Record<string, any> = {};

  for (const [key, value] of Object.entries(stepUpdate)) {
    if (value !== undefined) {
      updateObj[`steps.${nodeId}.${key}`] = stripUndefined(value);
    }
  }

  updateObj.updatedAt = serverTimestamp();

  await updateDoc(docRef, updateObj);
}

export async function addAuditLogEntry(
  tenantId: string,
  instanceId: string,
  entry: { action: string; description: string; userId: string }
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, instanceId);
  const current = await getWorkflowInstance(tenantId, instanceId);
  if (!current) throw new Error('Workflow instance not found');

  const now = Timestamp.now();
  const auditEntry = {
    id: `audit-${Date.now()}`,
    ...entry,
    timestamp: now,
  };

  // Write to subcollection for permanent storage (no size limit)
  const subcollectionRef = collection(db, COLLECTION_NAME, instanceId, 'audit_log');
  await addDoc(subcollectionRef, auditEntry);

  // Keep rolling window of last 20 entries on the main doc for quick display
  const currentLog = current.auditLog || [];
  const updatedLog = [...currentLog, auditEntry].slice(-20);

  await updateDoc(docRef, {
    auditLog: updatedLog,
    lastActivityAt: now,
    updatedAt: serverTimestamp(),
  });
}

export async function getAuditLog(
  instanceId: string,
  limitCount = 50
): Promise<Array<{ id: string; action: string; description: string; userId: string; timestamp: Timestamp }>> {
  if (!db) throw new Error('Firebase not initialized');

  const subcollectionRef = collection(db, COLLECTION_NAME, instanceId, 'audit_log');
  const q = query(subcollectionRef, orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.slice(0, limitCount).map((d) => ({
    id: d.id,
    ...d.data(),
  })) as any[];
}

export async function getInstancesByProject(
  tenantId: string,
  projectId: string
): Promise<WorkflowInstance[]> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, COLLECTION_NAME),
    where('tenantId', '==', tenantId),
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as WorkflowInstance[];
}

/**
 * Kanban query: fetches active instances where the user has ready/in_progress steps.
 * Uses denormalized activeAssigneeIds for a single indexed Firestore query.
 */
export async function getInstancesByAssignee(
  tenantId: string,
  userId: string
): Promise<WorkflowInstance[]> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, COLLECTION_NAME),
    where('tenantId', '==', tenantId),
    where('status', 'in', ['active', 'pending']),
    where('activeAssigneeIds', 'array-contains', userId),
    orderBy('lastActivityAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as WorkflowInstance[];
}

export async function getActiveStepsForUser(
  tenantId: string,
  userId: string
): Promise<Array<{ instance: WorkflowInstance; nodeId: string; step: StepInstance }>> {
  if (!db) throw new Error('Firebase not initialized');

  // Query all active instances for the tenant
  const q = query(
    collection(db, COLLECTION_NAME),
    where('tenantId', '==', tenantId),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  const activeSteps: Array<{ instance: WorkflowInstance; nodeId: string; step: StepInstance }> = [];

  // Filter steps in JavaScript
  snapshot.docs.forEach((d) => {
    const instance = {
      id: d.id,
      ...d.data(),
    } as WorkflowInstance;

    // Iterate through steps to find ones assigned to this user
    for (const [nodeId, stepData] of Object.entries(instance.steps)) {
      const step = stepData as StepInstance;
      if (
        step.assignment?.userId === userId &&
        (step.status === 'ready' || step.status === 'in_progress')
      ) {
        activeSteps.push({
          instance,
          nodeId,
          step,
        });
      }
    }
  });

  return activeSteps;
}
