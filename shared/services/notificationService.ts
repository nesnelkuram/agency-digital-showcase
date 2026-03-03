import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { NotificationType } from '@/shared/hooks/useNotifications';

export interface CreateNotificationData {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Creates a notification document in Firestore for a specific user.
 * Call from API endpoints or service functions after significant events.
 */
export async function createNotification(data: CreateNotificationData): Promise<void> {
  if (!db) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      tenantId: data.tenantId,
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link ?? null,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[notificationService] createNotification error:', err);
  }
}

/**
 * Creates notifications for multiple recipients at once.
 */
export async function createNotifications(
  recipients: string[],
  data: Omit<CreateNotificationData, 'userId'>
): Promise<void> {
  await Promise.all(
    recipients.map((userId) => createNotification({ ...data, userId }))
  );
}

// =============================================
// Convenience helpers for common events
// =============================================

/** Notify when a content plan is sent for approval */
export async function notifyContentPlanPendingApproval(params: {
  tenantId: string;
  recipientUserId: string;
  planTitle: string;
  planId: string;
}): Promise<void> {
  await createNotification({
    tenantId: params.tenantId,
    userId: params.recipientUserId,
    type: 'social_media',
    title: 'İçerik Planı Onay Bekliyor',
    message: `"${params.planTitle}" içerik planı onayınızı bekliyor.`,
    link: `/admin/social-media`,
  });
}

/** Notify when a client approves a content plan */
export async function notifyContentPlanApproved(params: {
  tenantId: string;
  recipientUserIds: string[];
  planTitle: string;
  approvedByName: string;
}): Promise<void> {
  await createNotifications(params.recipientUserIds, {
    tenantId: params.tenantId,
    type: 'social_media',
    title: 'İçerik Planı Onaylandı',
    message: `"${params.planTitle}" içerik planını ${params.approvedByName} onayladı.`,
    link: `/admin/social-media`,
  });
}

/** Notify when a client requests revision on a content plan */
export async function notifyContentPlanRevisionRequested(params: {
  tenantId: string;
  recipientUserIds: string[];
  planTitle: string;
  requestedByName: string;
  comment?: string;
}): Promise<void> {
  await createNotifications(params.recipientUserIds, {
    tenantId: params.tenantId,
    type: 'social_media',
    title: 'Revizyon İstendi',
    message: `"${params.planTitle}" için ${params.requestedByName} revizyon istedi.${params.comment ? ` Not: ${params.comment}` : ''}`,
    link: `/admin/social-media`,
  });
}

/** Notify when a workflow step becomes ready for a user */
export async function notifyWorkflowStepReady(params: {
  tenantId: string;
  recipientUserId: string;
  workflowName: string;
  stepName: string;
  instanceId: string;
}): Promise<void> {
  await createNotification({
    tenantId: params.tenantId,
    userId: params.recipientUserId,
    type: 'workflow_step',
    title: 'Workflow Adımı Sıranda',
    message: `"${params.workflowName}" workflow'unda "${params.stepName}" adımı sıra sende.`,
    link: `/admin/workflows/instances/${params.instanceId}`,
  });
}

/** Notify when a new lead is assigned */
export async function notifyNewLeadAssigned(params: {
  tenantId: string;
  recipientUserId: string;
  leadName: string;
  leadId: string;
}): Promise<void> {
  await createNotification({
    tenantId: params.tenantId,
    userId: params.recipientUserId,
    type: 'new_lead',
    title: 'Yeni Lead Atandı',
    message: `"${params.leadName}" lead'i sana atandı.`,
    link: `/admin/leads/${params.leadId}`,
  });
}

/** Notify when an approval is needed */
export async function notifyApprovalPending(params: {
  tenantId: string;
  recipientUserId: string;
  title: string;
  link?: string;
}): Promise<void> {
  await createNotification({
    tenantId: params.tenantId,
    userId: params.recipientUserId,
    type: 'approval_pending',
    title: 'Onay Bekleniyor',
    message: params.title,
    link: params.link,
  });
}

// =============================================
// Cok seviyeli onay sistemi bildirimleri
// =============================================

/** Editor icerigi dahili incelemeye gonderdiyse AM'e bildirim */
export async function notifyInternalReviewNeeded(params: {
  tenantId: string;
  recipientUserIds: string[];
  planTitle: string;
  planId: string;
  submittedByName: string;
}): Promise<void> {
  await createNotifications(params.recipientUserIds, {
    tenantId: params.tenantId,
    type: 'approval_pending',
    title: 'Dahili Inceleme Bekliyor',
    message: `"${params.planTitle}" icin ${params.submittedByName} dahili inceleme talep etti.`,
    link: `/admin/social-media`,
  });
}

/** AM dahili incelemeyi onayladiysa editor'e bildirim */
export async function notifyInternalApproved(params: {
  tenantId: string;
  recipientUserIds: string[];
  planTitle: string;
  approvedByName: string;
}): Promise<void> {
  await createNotifications(params.recipientUserIds, {
    tenantId: params.tenantId,
    type: 'social_media',
    title: 'Dahili Inceleme Onaylandi',
    message: `"${params.planTitle}" dahili incelemesi ${params.approvedByName} tarafindan onaylandi. Icerik musteriye gonderildi.`,
    link: `/admin/social-media`,
  });
}

/** AM dahili incelemede revizyon istediyse editor'e bildirim */
export async function notifyInternalRevisionRequested(params: {
  tenantId: string;
  recipientUserIds: string[];
  planTitle: string;
  requestedByName: string;
  comment?: string;
}): Promise<void> {
  await createNotifications(params.recipientUserIds, {
    tenantId: params.tenantId,
    type: 'social_media',
    title: 'Dahili Revizyon Istendi',
    message: `"${params.planTitle}" icin ${params.requestedByName} dahili revizyon istedi.${params.comment ? ` Not: ${params.comment}` : ''}`,
    link: `/admin/social-media`,
  });
}

/** Musteri kismi onay verdiyse ekibe bildirim */
export async function notifyPartialApproval(params: {
  tenantId: string;
  recipientUserIds: string[];
  planTitle: string;
  approvedByName: string;
  approvedCount: number;
  totalCount: number;
}): Promise<void> {
  await createNotifications(params.recipientUserIds, {
    tenantId: params.tenantId,
    type: 'social_media',
    title: 'Kismi Onay Verildi',
    message: `"${params.planTitle}" icin ${params.approvedByName} ${params.approvedCount}/${params.totalCount} postu onayladi.`,
    link: `/admin/social-media`,
  });
}
