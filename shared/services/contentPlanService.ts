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
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  ContentPlan,
  ContentPlanSummary,
  ContentPlanComment,
  ContentPlanStatus,
  CreateContentPlanData,
  ApprovalEvent,
  ApprovalAction,
  PostStatus,
  PostApprovalSummary,
  SocialMediaPost,
} from '@/shared/types/socialMedia';
import { DEFAULT_APPROVAL_CONFIG, VALID_POST_TRANSITIONS } from '@/shared/types/socialMedia';

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

/**
 * Plan'ı belirli bir müşteri temsilcisine atar ve onay için gönderir.
 * Bu işlem status'ü pending_approval'a çevirir ve müşteri bilgilerini işaretler.
 * E-posta normalize edilir (trim + lowercase). clientId varsa atanır.
 */
export async function assignAndSubmitToClient(
  id: string,
  payload: {
    clientId?: string;
    clientName: string;
    clientEmail: string;
    sentByUid: string;
    sentByName: string;
  }
): Promise<{ assignedClientId?: string; assignedClientEmail: string }> {
  if (!db) throw new Error('Firebase not initialized');
  const normalizedEmail = (payload.clientEmail || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('assignAndSubmitToClient: clientEmail zorunlu');

  const patch: Record<string, any> = {
    status: 'pending_approval',
    assignedClientName: (payload.clientName || '').trim(),
    assignedClientEmail: normalizedEmail,
    sentToClientAt: serverTimestamp(),
    sentToClientBy: payload.sentByUid,
    sentToClientByName: payload.sentByName,
    updatedAt: serverTimestamp(),
  };
  if (payload.clientId) patch.assignedClientId = payload.clientId;
  await updateDoc(doc(db, COLLECTION_NAME, id), patch);
  return { assignedClientId: payload.clientId, assignedClientEmail: normalizedEmail };
}

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
  isClient: boolean = true,
  createdByRole: string = 'client'
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const newComment: ContentPlanComment = {
    id: crypto.randomUUID(),
    text: comment,
    createdBy,
    createdByName,
    createdByRole,
    createdAt: Timestamp.now(),
    isClient,
    isInternal: !isClient,
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
  isClient: boolean = true,
  createdByRole: string = 'client',
  isInternal: boolean = false
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const newComment: ContentPlanComment = {
    id: crypto.randomUUID(),
    postId,
    text: comment,
    createdBy,
    createdByName,
    createdByRole,
    createdAt: Timestamp.now(),
    isClient,
    isInternal,
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

const POSTS_COLLECTION = 'social_media_posts';
const APPROVAL_EVENTS_SUBCOLLECTION = 'approval_events';

/**
 * Post'larin durumlarindan plan statusunu yeniden hesaplar
 */
export function computePlanStatusFromPosts(postStatuses: PostStatus[]): ContentPlanStatus {
  if (postStatuses.length === 0) return 'draft';

  const allApprovedOrBeyond = postStatuses.every(
    (s) => s === 'approved' || s === 'scheduled' || s === 'published'
  );
  if (allApprovedOrBeyond) return 'approved';

  const hasRevision = postStatuses.some(
    (s) => s === 'revision_requested' || s === 'revision_requested_internal'
  );
  if (hasRevision) return 'revision_requested';

  const hasApproved = postStatuses.some((s) => s === 'approved' || s === 'scheduled' || s === 'published');
  const hasPending = postStatuses.some((s) => s === 'pending_approval');
  if (hasApproved && (hasPending || postStatuses.some((s) => s === 'internal_review' || s === 'draft'))) {
    return 'partially_approved';
  }

  if (hasPending) return 'pending_approval';

  const hasInternalReview = postStatuses.some((s) => s === 'internal_review');
  if (hasInternalReview) return 'internal_review';

  return 'draft';
}

/**
 * Post onay ozetini hesaplar
 */
export function computePostApprovalSummary(postStatuses: PostStatus[]): PostApprovalSummary {
  const summary: PostApprovalSummary = {
    total: postStatuses.length,
    draft: 0,
    internalReview: 0,
    pendingApproval: 0,
    approved: 0,
    revisionRequested: 0,
  };

  for (const status of postStatuses) {
    switch (status) {
      case 'draft':
        summary.draft++;
        break;
      case 'internal_review':
        summary.internalReview++;
        break;
      case 'pending_approval':
        summary.pendingApproval++;
        break;
      case 'approved':
      case 'scheduled':
      case 'published':
        summary.approved++;
        break;
      case 'revision_requested':
      case 'revision_requested_internal':
        summary.revisionRequested++;
        break;
    }
  }

  return summary;
}

/**
 * Bir gecis gecerli mi kontrol eder
 */
export function isValidTransition(fromStatus: PostStatus, toStatus: PostStatus): boolean {
  const key = `${fromStatus}->${toStatus}`;
  return key in VALID_POST_TRANSITIONS;
}

/**
 * Bir gecis icin gerekli aksiyonu dondurur
 */
export function getTransitionAction(fromStatus: PostStatus, toStatus: PostStatus): ApprovalAction | null {
  const key = `${fromStatus}->${toStatus}`;
  return VALID_POST_TRANSITIONS[key] || null;
}

/**
 * Plan'in post'larinin durum ozetini gunceller
 */
export async function recomputePlanStatus(tenantId: string, planId: string): Promise<ContentPlanStatus> {
  if (!db) throw new Error('Firebase not initialized');

  const plan = await getContentPlan(tenantId, planId);
  if (!plan) throw new Error('Plan not found');

  // Plan'a ait post'lari getir
  const postsQuery = query(
    collection(db, POSTS_COLLECTION),
    where('contentPlanId', '==', planId)
  );
  const postsSnap = await getDocs(postsQuery);
  const postStatuses = postsSnap.docs.map((d) => d.data().status as PostStatus);

  const newPlanStatus = computePlanStatusFromPosts(postStatuses);
  const postApprovalSummary = computePostApprovalSummary(postStatuses);

  await updateDoc(doc(db, COLLECTION_NAME, planId), {
    status: newPlanStatus,
    postApprovalSummary,
    updatedAt: serverTimestamp(),
  });

  return newPlanStatus;
}

/**
 * Onay olayini audit log'a ekler (subcollection)
 */
export async function addApprovalEvent(
  planId: string,
  event: Omit<ApprovalEvent, 'id' | 'timestamp'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const eventData = {
    ...event,
    timestamp: Timestamp.now(),
  };

  const docRef = await addDoc(
    collection(db, COLLECTION_NAME, planId, APPROVAL_EVENTS_SUBCOLLECTION),
    eventData
  );
  return docRef.id;
}

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

/**
 * Post durum gecisi yapar: status gunceller, audit log yazar, plan statusunu yeniden hesaplar
 */
export async function transitionPostStatus(
  tenantId: string,
  planId: string,
  postId: string,
  toStatus: PostStatus,
  userId: string,
  userName: string,
  userRole: string,
  comment?: string
): Promise<{ newPlanStatus: ContentPlanStatus }> {
  if (!db) throw new Error('Firebase not initialized');

  // Post'u getir
  const postDoc = await getDoc(doc(db, POSTS_COLLECTION, postId));
  if (!postDoc.exists()) throw new Error('Post not found');

  const postData = postDoc.data() as SocialMediaPost;
  const fromStatus = postData.status;

  // Gecis gecerli mi?
  if (!isValidTransition(fromStatus, toStatus)) {
    throw new Error(`Invalid transition: ${fromStatus} -> ${toStatus}`);
  }

  const action = getTransitionAction(fromStatus, toStatus)!;
  const batch = writeBatch(db);
  const now = Timestamp.now();

  // Post statusunu guncelle
  const postUpdate: Record<string, any> = {
    status: toStatus,
    updatedAt: serverTimestamp(),
  };

  // Dahili inceleme onayi
  if (toStatus === 'pending_approval' && fromStatus === 'internal_review') {
    postUpdate.internalReviewedBy = userId;
    postUpdate.internalReviewedByName = userName;
    postUpdate.internalReviewedAt = now;
  }

  // Musteri onayi
  if (toStatus === 'approved') {
    postUpdate.approvedBy = userId;
    postUpdate.approvedByName = userName;
    postUpdate.approvedAt = now;

    // Otomatik zamanlama: approvedAt ve scheduledAt varsa scheduled'a gec
    if (postData.scheduledAt) {
      postUpdate.status = 'scheduled';
    }
  }

  // Revizyon sayaci
  if (toStatus === 'revision_requested' || toStatus === 'revision_requested_internal') {
    postUpdate.revisionCount = (postData.revisionCount || 0) + 1;
    if (comment) {
      postUpdate.lastRevisionComment = comment;
    }
  }

  batch.update(doc(db, POSTS_COLLECTION, postId), postUpdate);

  // Audit event
  const eventRef = doc(collection(db, COLLECTION_NAME, planId, APPROVAL_EVENTS_SUBCOLLECTION));
  batch.set(eventRef, {
    postId,
    action,
    fromStatus,
    toStatus: postUpdate.status || toStatus,
    performedBy: userId,
    performedByName: userName,
    performedByRole: userRole,
    comment: comment || null,
    timestamp: now,
  });

  await batch.commit();

  // Plan statusunu yeniden hesapla
  const newPlanStatus = await recomputePlanStatus(tenantId, planId);

  return { newPlanStatus };
}

/**
 * Birden fazla post'un durumunu ayni anda degistirir (bulk transition)
 */
export async function bulkTransitionPostStatus(
  tenantId: string,
  planId: string,
  postIds: string[],
  toStatus: PostStatus,
  userId: string,
  userName: string,
  userRole: string,
  comment?: string
): Promise<{ updatedPosts: { postId: string; newStatus: PostStatus }[]; newPlanStatus: ContentPlanStatus }> {
  if (!db) throw new Error('Firebase not initialized');

  const updatedPosts: { postId: string; newStatus: PostStatus }[] = [];
  const batch = writeBatch(db);
  const now = Timestamp.now();

  for (const postId of postIds) {
    const postDoc = await getDoc(doc(db, POSTS_COLLECTION, postId));
    if (!postDoc.exists()) continue;

    const postData = postDoc.data() as SocialMediaPost;
    const fromStatus = postData.status;

    if (!isValidTransition(fromStatus, toStatus)) continue;

    const action = getTransitionAction(fromStatus, toStatus)!;

    const postUpdate: Record<string, any> = {
      status: toStatus,
      updatedAt: serverTimestamp(),
    };

    if (toStatus === 'pending_approval' && fromStatus === 'internal_review') {
      postUpdate.internalReviewedBy = userId;
      postUpdate.internalReviewedByName = userName;
      postUpdate.internalReviewedAt = now;
    }

    if (toStatus === 'approved') {
      postUpdate.approvedBy = userId;
      postUpdate.approvedByName = userName;
      postUpdate.approvedAt = now;
      if (postData.scheduledAt) {
        postUpdate.status = 'scheduled';
      }
    }

    if (toStatus === 'revision_requested' || toStatus === 'revision_requested_internal') {
      postUpdate.revisionCount = (postData.revisionCount || 0) + 1;
      if (comment) postUpdate.lastRevisionComment = comment;
    }

    batch.update(doc(db, POSTS_COLLECTION, postId), postUpdate);

    const eventRef = doc(collection(db, COLLECTION_NAME, planId, APPROVAL_EVENTS_SUBCOLLECTION));
    batch.set(eventRef, {
      postId,
      action,
      fromStatus,
      toStatus: postUpdate.status || toStatus,
      performedBy: userId,
      performedByName: userName,
      performedByRole: userRole,
      comment: comment || null,
      timestamp: now,
    });

    updatedPosts.push({ postId, newStatus: postUpdate.status || toStatus });
  }

  await batch.commit();

  const newPlanStatus = await recomputePlanStatus(tenantId, planId);

  return { updatedPosts, newPlanStatus };
}

/**
 * Plan'in approvalConfig'ini gunceller
 */
export async function updateApprovalConfig(
  tenantId: string,
  planId: string,
  config: Partial<import('@/shared/types/socialMedia').ApprovalConfig>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const plan = await getContentPlan(tenantId, planId);
  if (!plan) throw new Error('Plan not found');

  const currentConfig = plan.approvalConfig || DEFAULT_APPROVAL_CONFIG;

  await updateDoc(doc(db, COLLECTION_NAME, planId), {
    approvalConfig: { ...currentConfig, ...config },
    updatedAt: serverTimestamp(),
  });
}
