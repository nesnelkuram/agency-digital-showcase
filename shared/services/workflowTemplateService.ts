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
  serverTimestamp,
  QueryConstraint,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  WorkflowTemplate,
  WorkflowNodeTemplate,
  WorkflowEdgeTemplate,
} from '@/shared/types/workflow/template';
import type { ServiceCategory } from '@/shared/types/pricing/services';

const COLLECTION_NAME = 'workflow_templates';

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

export async function getWorkflowTemplates(
  tenantId: string,
  filters?: { serviceCategory?: string; status?: string }
): Promise<WorkflowTemplate[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('tenantId', '==', tenantId),
    where('isLatest', '==', true),
  ];

  if (filters?.serviceCategory) {
    constraints.push(where('serviceCategory', '==', filters.serviceCategory));
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
  })) as WorkflowTemplate[];
}

export async function getWorkflowTemplate(
  tenantId: string,
  templateId: string
): Promise<WorkflowTemplate | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, templateId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as WorkflowTemplate;
}

export async function createWorkflowTemplate(
  tenantId: string,
  data: Omit<WorkflowTemplate, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'version' | 'isLatest'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const now = Timestamp.now();
  const docRef = doc(collection(db, COLLECTION_NAME));

  const templateData: Omit<WorkflowTemplate, 'id'> = {
    ...data,
    tenantId,
    depth: data.depth ?? 0,
    version: 1,
    isLatest: true,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(docRef, stripUndefined(templateData));
  return docRef.id;
}

/**
 * Returns only root-level templates (depth=0)
 */
export async function getRootTemplates(
  tenantId: string,
  filters?: { serviceCategory?: string; status?: string }
): Promise<WorkflowTemplate[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('tenantId', '==', tenantId),
    where('depth', '==', 0),
    where('isLatest', '==', true),
  ];

  if (filters?.serviceCategory) {
    constraints.push(where('serviceCategory', '==', filters.serviceCategory));
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
  })) as WorkflowTemplate[];
}

/**
 * Returns child templates for a given parent template
 */
export async function getChildTemplates(
  tenantId: string,
  parentTemplateId: string
): Promise<WorkflowTemplate[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('tenantId', '==', tenantId),
    where('parentTemplateId', '==', parentTemplateId),
    where('isLatest', '==', true),
    orderBy('createdAt', 'asc'),
  ];

  const q = query(collection(db, COLLECTION_NAME), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as WorkflowTemplate[];
}

export async function updateWorkflowTemplate(
  tenantId: string,
  templateId: string,
  data: Partial<WorkflowTemplate>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, templateId);
  const current = await getWorkflowTemplate(tenantId, templateId);
  if (!current) throw new Error('Template not found');

  await updateDoc(docRef, {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  });
}

export async function publishWorkflowTemplate(
  tenantId: string,
  templateId: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, templateId);
  const current = await getWorkflowTemplate(tenantId, templateId);
  if (!current) throw new Error('Template not found');

  await updateDoc(docRef, {
    status: 'published',
    updatedAt: serverTimestamp(),
  });
}

export async function archiveWorkflowTemplate(
  tenantId: string,
  templateId: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, COLLECTION_NAME, templateId);
  const current = await getWorkflowTemplate(tenantId, templateId);
  if (!current) throw new Error('Template not found');

  await updateDoc(docRef, {
    status: 'archived',
    updatedAt: serverTimestamp(),
  });
}

export async function deleteWorkflowTemplate(
  tenantId: string,
  templateId: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  await deleteDoc(doc(db, COLLECTION_NAME, templateId));
}

export async function findLatestTemplate(
  tenantId: string,
  serviceCategory: string,
  serviceSubType?: string
): Promise<WorkflowTemplate | null> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('tenantId', '==', tenantId),
    where('serviceCategory', '==', serviceCategory),
    where('status', '==', 'published'),
    where('isLatest', '==', true),
  ];

  if (serviceSubType) {
    constraints.push(where('serviceSubType', '==', serviceSubType));
  }

  constraints.push(orderBy('version', 'desc'));

  const q = query(collection(db, COLLECTION_NAME), ...constraints);
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const firstDoc = snapshot.docs[0];
  return {
    id: firstDoc.id,
    ...firstDoc.data(),
  } as WorkflowTemplate;
}

// ============================================
// BUILD FROM SUBTASKS — alt görev listesi → düz Workflow Template
// ============================================

export interface SubtaskStepInput {
  title: string;
  estimatedMinutes?: number;
  assigneeRole?: string;
}

/**
 * Bir görevin alt görevlerini (düz, sıralı liste) geçerli bir Workflow
 * Template'ine çevirip kaydeder: start → task → task → … → end.
 *
 * Alt görevler doğrusal olduğu için her adım basit bir `task` düğümü olur,
 * ardışık `default` oklarla bağlanır. Sonradan builder'da dallanma/onay/AI
 * eklenebilir. Taslak (`draft`) statüsüyle kaydedilir; Workflows menüsünde
 * hemen görünür.
 *
 * @returns oluşturulan template'in id'si
 */
export async function createTemplateFromSubtasks(
  tenantId: string,
  params: {
    name: string;
    description?: string;
    serviceCategory?: ServiceCategory;
    steps: SubtaskStepInput[];
    createdBy: string;
    createdByName: string;
  }
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');
  const steps = params.steps.filter((s) => s.title.trim().length > 0);
  if (steps.length === 0) throw new Error('En az bir adım gerekli');

  const COL_X = 300;
  const Y_GAP = 120;
  let y = 50;

  const nodes: WorkflowNodeTemplate[] = [];
  const edges: WorkflowEdgeTemplate[] = [];

  // start
  nodes.push({
    id: 'node_start',
    type: 'start',
    label: 'Başla',
    position: { x: COL_X, y },
    sopResources: [],
  });
  y += Y_GAP;

  let totalMinutes = 0;
  let prevId = 'node_start';
  steps.forEach((step, i) => {
    const id = `node_${i + 1}`;
    const minutes = step.estimatedMinutes && step.estimatedMinutes > 0 ? step.estimatedMinutes : 30;
    totalMinutes += minutes;
    nodes.push({
      id,
      type: 'task',
      label: step.title.trim(),
      position: { x: COL_X, y },
      estimatedDurationHours: Math.round((minutes / 60) * 100) / 100,
      sopResources: [],
      ...(step.assigneeRole ? { assigneeRole: step.assigneeRole } : {}),
    });
    edges.push({
      id: `edge_${i}`,
      source: prevId,
      target: id,
      type: 'default',
    });
    prevId = id;
    y += Y_GAP;
  });

  // end
  nodes.push({
    id: 'node_end',
    type: 'end',
    label: 'Bitti',
    position: { x: COL_X, y },
    sopResources: [],
  });
  edges.push({
    id: `edge_${steps.length}`,
    source: prevId,
    target: 'node_end',
    type: 'default',
  });

  // Toplam süre → gün (8 saatlik iş günü), en az 1 gün
  const estimatedDays = Math.max(1, Math.ceil(totalMinutes / 60 / 8));

  return createWorkflowTemplate(tenantId, {
    name: params.name,
    description: params.description || `"${params.name}" görevinden iş akışı olarak kaydedildi`,
    serviceCategory: params.serviceCategory || 'video_production',
    nodes,
    edges,
    phases: [],
    defaultEstimatedDays: estimatedDays,
    status: 'draft',
    depth: 0,
    workflowType: 'on_demand',
    createdBy: params.createdBy,
    createdByName: params.createdByName,
  });
}
