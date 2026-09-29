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
  Timestamp,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  ContentPlan,
  ContentPlanSummary,
  ContentPlanStatus,
  CreateContentPlanData,
  ApprovalEvent,
} from '@/shared/types/socialMedia';
import { DEFAULT_APPROVAL_CONFIG } from '@/shared/types/socialMedia';

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
    approvalConfig: DEFAULT_APPROVAL_CONFIG,
    createdAt: now,
    updatedAt: now,
    createdBy: createdByUid,
    createdByName,
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), planData);

  // Her post'un contentPlanId'sini güncelle (geriye bağlantı)
  if (data.postIds.length > 0) {
    try {
      const batch = writeBatch(db);
      for (const postId of data.postIds) {
        batch.update(doc(db, 'social_media_posts', postId), {
          contentPlanId: docRef.id,
          updatedAt: now,
        });
      }
      await batch.commit();
    } catch (err) {
      console.warn('[createContentPlan] Post contentPlanId update failed:', err);
    }
  }

  return docRef.id;
}

export async function getContentPlan(tenantId: string, id: string): Promise<ContentPlan | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docSnap = await getDoc(doc(db, COLLECTION_NAME, id));
  if (!docSnap.exists()) return null;

  return { id: docSnap.id, ...docSnap.data() } as ContentPlan;
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
  data: Partial<Pick<ContentPlan, 'title' | 'description' | 'postIds' | 'weekStartDate' | 'weekEndDate'>>
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
// Durum değişiklikleri yalnızca sunucudan: shared/services/contentApprovalApi.ts
// ============================================

/**
 * E-postadan tenant içinde kayıtlı kullanıcı bulur (lookup).
 * Manuel e-posta girildiğinde uid bulmak için kullanılır.
 */
export async function findTenantUserByEmail(
  tenantId: string,
  email: string
): Promise<{ uid: string; displayName: string; role: string } | null> {
  if (!db) return null;
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return null;
  const snap = await getDocs(
    query(
      collection(db, 'users'),
      where('tenantId', '==', tenantId),
      where('email', '==', normalized)
    )
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    uid: d.id,
    displayName: data.displayName || data.email,
    role: data.role,
  };
}

// ============================================
// ISTATISTIKLER
// ============================================

export async function getContentPlanStats(
  tenantId: string,
  projectId: string
): Promise<{ total: number; pendingApproval: number; approved: number; draft: number; internalReview: number }> {
  if (!db) return { total: 0, pendingApproval: 0, approved: 0, draft: 0, internalReview: 0 };

  const q = query(
    collection(db, COLLECTION_NAME),
    where('tenantId', '==', tenantId),
    where('projectId', '==', projectId)
  );

  const snapshot = await getDocs(q);

  const stats = { total: 0, pendingApproval: 0, approved: 0, draft: 0, internalReview: 0 };

  snapshot.docs.forEach((d) => {
    const status = d.data().status;
    stats.total++;
    if (status === 'pending_approval') stats.pendingApproval++;
    else if (status === 'approved') stats.approved++;
    else if (status === 'draft') stats.draft++;
    else if (status === 'internal_review') stats.internalReview++;
  });

  return stats;
}

// ============================================
// COK SEVIYELI ONAY SISTEMI
// ============================================

const APPROVAL_EVENTS_SUBCOLLECTION = 'approval_events';

/**
 * Bir plan icin onay gecmisini getirir
 */
export async function getApprovalEvents(
  planId: string,
  postId?: string
): Promise<ApprovalEvent[]> {
  if (!db) throw new Error('Firebase not initialized');

  let q;
  if (postId) {
    q = query(
      collection(db, COLLECTION_NAME, planId, APPROVAL_EVENTS_SUBCOLLECTION),
      where('postId', '==', postId),
      orderBy('timestamp', 'desc')
    );
  } else {
    q = query(
      collection(db, COLLECTION_NAME, planId, APPROVAL_EVENTS_SUBCOLLECTION),
      orderBy('timestamp', 'desc')
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ApprovalEvent));
}

