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
  Timestamp,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  ContentPlan,
  ContentPlanSummary,
  ContentPlanComment,
  ContentPlanStatus,
  CreateContentPlanData,
} from '@/shared/types/socialMedia';

const COLLECTION_NAME = 'content_plans';

function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

// ============================================
// CRUD
// ============================================

export async function createContentPlan(
  tenantId: string,
  data: CreateContentPlanData,
  createdByUid: string,
  createdByName: string
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const now = Timestamp.now();

  const planData = {
    tenantId,
    projectId: data.projectId,
    title: data.title,
    description: data.description || '',
    platform: data.platform,
    postIds: data.postIds,
    weekStartDate: data.weekStartDate,
    weekEndDate: data.weekEndDate,
    status: 'draft' as ContentPlanStatus,
    shareToken: generateShareToken(),
    clientComments: [],
    createdAt: now,
    updatedAt: now,
    createdBy: createdByUid,
    createdByName,
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), planData);
  return docRef.id;
}

export async function getContentPlan(tenantId: string, id: string): Promise<ContentPlan | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));
  if (!docSnap.exists()) return null;

  return { id: docSnap.id, ...docSnap.data() } as ContentPlan;
}

export async function getContentPlanByShareToken(shareToken: string): Promise<ContentPlan | null> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, COLLECTION_NAME),
    where('shareToken', '==', shareToken),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as ContentPlan;
}

export async function getContentPlansForProject(
  tenantId: string,
  projectId: string
): Promise<ContentPlanSummary[]> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, COLLECTION_NAME),
    where('tenantId', '==', tenantId),
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title,
      platform: data.platform,
      postCount: data.postIds?.length || 0,
      weekStartDate: data.weekStartDate,
      weekEndDate: data.weekEndDate,
      status: data.status,
      createdAt: data.createdAt,
    };
  });
}

export async function updateContentPlan(
  tenantId: string,
  id: string,
  data: Partial<Pick<ContentPlan, 'title' | 'description' | 'postIds' | 'status' | 'weekStartDate' | 'weekEndDate'>>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const updateData: any = { ...data, updatedAt: serverTimestamp() };
  await updateDoc(doc(db, COLLECTION_NAME, id), updateData);
}

export async function deleteContentPlan(tenantId: string, id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

// ============================================
// ONAY SISTEMI
// ============================================

export async function submitForApproval(tenantId: string, id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  await updateDoc(doc(db, COLLECTION_NAME, id), {
    status: 'pending_approval',
    updatedAt: serverTimestamp(),
  });
}

export async function approveContentPlan(
  id: string,
  approvedBy: string,
  approvedByName: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  await updateDoc(doc(db, COLLECTION_NAME, id), {
    status: 'approved',
    approvedBy,
    approvedByName,
    approvedAt: Timestamp.now(),
    updatedAt: serverTimestamp(),
  });
}

export async function requestRevision(
  id: string,
  comment: string,
  createdBy: string,
  createdByName: string,
  isClient: boolean = true
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const newComment: ContentPlanComment = {
    id: crypto.randomUUID(),
    text: comment,
    createdBy,
    createdByName,
    createdAt: Timestamp.now(),
    isClient,
  };

  await updateDoc(doc(db, COLLECTION_NAME, id), {
    status: 'revision_requested',
    clientComments: arrayUnion(newComment),
    updatedAt: serverTimestamp(),
  });
}

export async function addClientComment(
  id: string,
  comment: string,
  postId: string | undefined,
  createdBy: string,
  createdByName: string,
  isClient: boolean = true
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const newComment: ContentPlanComment = {
    id: crypto.randomUUID(),
    postId,
    text: comment,
    createdBy,
    createdByName,
    createdAt: Timestamp.now(),
    isClient,
  };

  await updateDoc(doc(db, COLLECTION_NAME, id), {
    clientComments: arrayUnion(newComment),
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// ISTATISTIKLER
// ============================================

export async function getContentPlanStats(
  tenantId: string,
  projectId: string
): Promise<{ total: number; pendingApproval: number; approved: number; draft: number }> {
  if (!db) return { total: 0, pendingApproval: 0, approved: 0, draft: 0 };

  const q = query(
    collection(db, COLLECTION_NAME),
    where('tenantId', '==', tenantId),
    where('projectId', '==', projectId)
  );

  const snapshot = await getDocs(q);

  const stats = { total: 0, pendingApproval: 0, approved: 0, draft: 0 };

  snapshot.docs.forEach((d) => {
    const status = d.data().status;
    stats.total++;
    if (status === 'pending_approval') stats.pendingApproval++;
    else if (status === 'approved') stats.approved++;
    else if (status === 'draft') stats.draft++;
  });

  return stats;
}
