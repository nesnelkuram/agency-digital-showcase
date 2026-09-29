/**
 * İçerik onayı — sunucu katmanı.
 * Onay motorunu (shared/approval/approvalEngine) tek bir Firestore transaction'ı içinde çalıştırır:
 * okuma → karar → yazma. Karar reddedilirse hiçbir şey yazılmaz.
 */

import { randomUUID } from 'crypto';
import { getAdminDb, getFieldValue, getAdminStorage } from './firebaseAdmin.js';
import {
  planApproval,
  computePlanStatus,
  computeApprovalSummary,
  planApprovedFields,
  validatePostIdsParam,
  storageObjectsToVerify,
  type ApprovalActor,
  type ApprovalRequest,
  type PlanSnapshot,
  type PostSnapshot,
  type MediaSourcePolicy,
} from '../../shared/approval/approvalEngine';

const PLANS = 'content_plans';
const POSTS = 'social_media_posts';

export interface ApprovalSuccess {
  ok: true;
  updatedPosts: { postId: string; fromStatus: string; newStatus: string }[];
  planStatus: string;
  postApprovalSummary: ReturnType<typeof computeApprovalSummary>;
  reviewRequestId: string | null;
}

export interface ApprovalFailure {
  ok: false;
  httpStatus: number;
  code: string;
  error: string;
}

// ============================================
// Aktör
// ============================================

export async function loadUserActor(auth: {
  userId: string;
  tenantId: string;
  userRole: string;
  userDisplayName?: string;
}): Promise<Extract<ApprovalActor, { kind: 'user' }>> {
  const db = getAdminDb();
  const snap = await db.collection('users').doc(auth.userId).get();
  const data: any = snap.exists ? snap.data() : {};
  const assigned = data?.profile?.assignedProjectIds;
  return {
    kind: 'user',
    uid: auth.userId,
    tenantId: auth.tenantId,
    role: auth.userRole,
    displayName: auth.userDisplayName || data?.displayName || '',
    email: (data?.email || '').toLowerCase() || undefined,
    assignedProjectIds: Array.isArray(assigned) ? assigned.filter((x: unknown) => typeof x === 'string') : [],
  };
}

// ============================================
// Paylaşım token'ı
// ============================================

const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function isValidShareToken(token: unknown): token is string {
  return typeof token === 'string' && SHARE_TOKEN_RE.test(token);
}

export async function findPlanIdByShareToken(token: string): Promise<string | null> {
  if (!isValidShareToken(token)) return null;
  const db = getAdminDb();
  const snap = await db.collection(PLANS).where('shareToken', '==', token).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

// ============================================
// Snapshot dönüşümleri
// ============================================

function toPlanSnapshot(id: string, data: any): PlanSnapshot {
  return {
    id,
    tenantId: data.tenantId || '',
    projectId: data.projectId || '',
    postIds: Array.isArray(data.postIds) ? data.postIds : [],
    status: data.status || 'draft',
    approvalConfig: data.approvalConfig,
    reviewRequestId: data.reviewRequestId || null,
    assignedClientId: data.assignedClientId,
    assignedClientEmail: data.assignedClientEmail,
  };
}

function collectMediaUrls(data: any): string[] {
  const urls: string[] = [];
  if (Array.isArray(data.media)) {
    for (const m of data.media) {
      if (m && typeof m.url === 'string' && m.url) urls.push(m.url);
      if (m && typeof m.thumbnailUrl === 'string' && m.thumbnailUrl) urls.push(m.thumbnailUrl);
    }
  }
  if (Array.isArray(data.mediaUrls)) for (const u of data.mediaUrls) if (typeof u === 'string' && u) urls.push(u);
  return urls;
}

/**
 * Güvenilen medya kaynağı: projenin Storage bucket'ı. Açık yapılandırma yoksa servis hesabının
 * projesinin varsayılan bucket adları kullanılır.
 */
export function getMediaSourcePolicy(): MediaSourcePolicy {
  const explicit = (process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim();
  let projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
  try {
    if (!projectId && process.env.FIREBASE_SERVICE_ACCOUNT) projectId = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT).project_id || '';
  } catch {
    // yok say
  }
  const buckets = explicit ? [explicit] : projectId ? [`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`] : [];
  const hosts = ['firebasestorage.googleapis.com'];
  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) hosts.push(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
  return { buckets, hosts };
}

function toPostSnapshot(id: string, data: any): PostSnapshot {
  return {
    mediaUrls: collectMediaUrls(data),
    id,
    tenantId: data.tenantId,
    projectId: data.projectId,
    contentPlanId: data.contentPlanId,
    status: data.status || 'draft',
    hasScheduledAt: !!data.scheduledAt,
    revisionCount: typeof data.revisionCount === 'number' ? data.revisionCount : 0,
  };
}

/** Nesne var mı ve indirme token'ı nesnenin metadata'sında kayıtlı mı? */
async function verifyStorageObject(storage: any, bucket: string, path: string, token: string | null): Promise<boolean> {
  try {
    const [metadata] = await storage.bucket(bucket).file(path).getMetadata();
    const tokens = String(metadata?.metadata?.firebaseStorageDownloadTokens || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return !!token && tokens.includes(token);
  } catch {
    return false; // yok veya okunamıyor
  }
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.filter((v): v is string => typeof v === 'string' && v.length > 0)));
}

/** Motorun '__now__' / null işaretlerini Firestore değerlerine çevirir */
function materialize(fields: Record<string, unknown>, now: Date, FieldValue: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === '__now__') out[key] = now;
    else if (value === null) out[key] = FieldValue.delete();
    else out[key] = value;
  }
  return out;
}

// ============================================
// Ana işlem
// ============================================

export async function executeApproval(params: {
  planId: string;
  actor: ApprovalActor;
  request: ApprovalRequest;
}): Promise<ApprovalSuccess | ApprovalFailure> {
  const db = getAdminDb();
  const FieldValue = getFieldValue();
  const { planId, actor, request } = params;

  if (!planId || typeof planId !== 'string') {
    return { ok: false, httpStatus: 400, code: 'BAD_REQUEST', error: 'planId gerekli' };
  }
  const postIdsCheck = validatePostIdsParam(request.postIds);
  if (!postIdsCheck.ok) {
    return { ok: false, httpStatus: 400, code: 'BAD_REQUEST', error: postIdsCheck.message };
  }
  const explicitIds = postIdsCheck.ids ?? [];
  request.postIds = postIdsCheck.ids;

  const planRef = db.collection(PLANS).doc(planId);
  let notifyContext: { tenantId: string; title: string; recipients: string[]; projectId: string; planId: string } | null = null;

  const outcome = await db.runTransaction(async (tx: any) => {
    // ── Okumalar (transaction'da tüm okumalar yazmalardan önce) ──
    const planDoc = await tx.get(planRef);
    if (!planDoc.exists) {
      return { ok: false, httpStatus: 404, code: 'NOT_FOUND', error: 'İçerik planı bulunamadı' } as ApprovalFailure;
    }
    const planData = planDoc.data();
    const plan = toPlanSnapshot(planDoc.id, planData);

    const projectDoc = plan.projectId ? await tx.get(db.collection('projects').doc(plan.projectId)) : null;
    // Studio politikası: proje açıkça işaretliyse ya da projeye bir marka yöneticisi atanmışsa
    // (iç inceleme zorunlu, onayda otomatik zamanlama yok)
    let studioManaged = !!projectDoc?.data()?.studioManaged;
    if (!studioManaged && plan.projectId) {
      const managers = await tx.get(
        db
          .collection('users')
          .where('tenantId', '==', plan.tenantId)
          .where('role', '==', 'brand_manager')
          .where('profile.assignedProjectIds', 'array-contains', plan.projectId)
          .limit(1)
      );
      studioManaged = !managers.empty;
    }
    const policy = { studioManaged };

    // Planın tüm post'ları: contentPlanId bağı + plan.postIds (eski kayıtlar)
    const linkedSnap = await tx.get(db.collection(POSTS).where('contentPlanId', '==', plan.id));
    const postsById = new Map<string, PostSnapshot | null>();
    for (const d of linkedSnap.docs) postsById.set(d.id, toPostSnapshot(d.id, d.data()));

    const missingIds = uniqueStrings([...plan.postIds, ...explicitIds]).filter((id) => !postsById.has(id));
    if (missingIds.length > 0) {
      const docs = await tx.getAll(...missingIds.map((id) => db.collection(POSTS).doc(id)));
      for (const d of docs) postsById.set(d.id, d.exists ? toPostSnapshot(d.id, d.data()) : null);
    }

    // Plan üyesi post'lar (durum hesabı için): gerçekten plana bağlı olanlar
    const planPostIds = uniqueStrings([...linkedSnap.docs.map((d: any) => d.id), ...plan.postIds]).filter((id) => {
      const p = postsById.get(id);
      return !!p && p.projectId === plan.projectId && (!p.contentPlanId || p.contentPlanId === plan.id);
    });

    const targetIds = explicitIds.length > 0 ? explicitIds : planPostIds;
    const targetPosts = targetIds.map((id) => postsById.get(id) ?? null);

    const grantUid = ['submit_to_client', 'internal_approve', 'assign_client'].includes(request.action)
      ? request.assignee?.clientId
      : undefined;
    const grantUserDoc = grantUid ? await tx.get(db.collection('users').doc(grantUid)) : null;

    // ── Karar ──
    const result = planApproval({
      actor,
      request,
      plan,
      policy,
      targetPosts,
      newId: () => randomUUID(),
      mediaPolicy: getMediaSourcePolicy(),
    });
    if (!result.ok) {
      return { ok: false, httpStatus: result.httpStatus, code: result.code, error: result.message } as ApprovalFailure;
    }

    // Müşteriye açılacak medya: Storage nesnesi gerçekten var olmalı ve URL token'ı ona ait olmalı
    if (request.action !== 'client_undo') {
      const targets = storageObjectsToVerify(result.postChanges, targetPosts.filter((p): p is PostSnapshot => !!p));
      if (targets.length > 0) {
        const storage = await getAdminStorage();
        for (const t of targets) {
          const verified = await verifyStorageObject(storage, t.bucket, t.path, t.token);
          if (!verified) {
            return {
              ok: false,
              httpStatus: 409,
              code: 'MEDIA_SOURCE_INVALID',
              error: 'Bir medya dosyası bulunamadı veya doğrulanamadı. Lütfen medyayı post düzenleyiciden yeniden yükleyin.',
            } as ApprovalFailure;
          }
        }
      }
    }

    // Atanacak müşteri aynı tenant'ta bir client olmalı
    if (grantUid) {
      const u = grantUserDoc?.exists ? grantUserDoc.data() : null;
      if (!u || u.tenantId !== plan.tenantId || u.role !== 'client') {
        return { ok: false, httpStatus: 400, code: 'BAD_REQUEST', error: 'Seçilen müşteri bu ajansa ait bir müşteri hesabı değil' } as ApprovalFailure;
      }
    }

    // ── Yazmalar ──
    const now = new Date();

    for (const change of result.postChanges) {
      tx.update(db.collection(POSTS).doc(change.postId), {
        ...materialize(change.fields, now, FieldValue),
        status: change.toStatus,
        updatedAt: now,
      });
      tx.set(planRef.collection('approval_events').doc(), {
        postId: change.postId,
        action: request.action,
        fromStatus: change.fromStatus,
        toStatus: change.toStatus,
        performedBy: result.performedBy,
        performedByName: result.performedByName,
        performedByRole: result.performedByRole,
        comment: request.comment?.trim() || null,
        reviewRequestId: result.newReviewRequestId || plan.reviewRequestId || null,
        timestamp: now,
      });
    }

    const changed = new Map(result.postChanges.map((c) => [c.postId, c.toStatus]));
    const statuses = planPostIds.map((id) => changed.get(id) ?? postsById.get(id)!.status);
    const planStatus = computePlanStatus(statuses);
    const summary = computeApprovalSummary(statuses);

    const planUpdate: Record<string, unknown> = {
      ...materialize(result.planFields, now, FieldValue),
      updatedAt: now,
    };
    if (result.postChanges.length > 0) {
      planUpdate.status = planStatus;
      planUpdate.postApprovalSummary = summary;
      Object.assign(
        planUpdate,
        materialize(planApprovedFields(planStatus, result.performedBy, result.performedByName, plan.status), now, FieldValue)
      );
    }
    if (result.comments.length > 0) {
      const isClient = result.performedByRole === 'client';
      planUpdate.clientComments = FieldValue.arrayUnion(
        ...result.comments.map((c) => ({
          id: randomUUID(),
          ...(c.postId ? { postId: c.postId } : {}),
          text: c.text,
          createdBy: result.performedBy,
          createdByName: result.performedByName,
          createdByRole: result.performedByRole,
          createdAt: now,
          isClient,
          isInternal: !isClient,
        }))
      );
    }
    tx.update(planRef, planUpdate);

    if (grantUid) {
      tx.update(db.collection('users').doc(grantUid), {
        'profile.assignedProjectIds': FieldValue.arrayUnion(plan.projectId),
      });
    }

    if (['client_approve', 'client_reject', 'comment'].includes(request.action) && result.performedByRole === 'client') {
      notifyContext = {
        tenantId: plan.tenantId,
        title: planData.title || 'İçerik planı',
        recipients: uniqueStrings([planData.createdBy, planData.sentToClientBy]),
        projectId: plan.projectId,
        planId: plan.id,
      };
    }

    return {
      ok: true,
      updatedPosts: result.postChanges.map((c) => ({ postId: c.postId, fromStatus: c.fromStatus, newStatus: c.toStatus })),
      planStatus: result.postChanges.length > 0 ? planStatus : plan.status,
      postApprovalSummary: summary,
      reviewRequestId: (result.planFields.reviewRequestId as string) || plan.reviewRequestId || null,
    } as ApprovalSuccess;
  });

  if (outcome.ok && notifyContext) {
    await notifyTeam(notifyContext, request, actor).catch((err) =>
      console.error('[contentApproval] Bildirim yazılamadı:', err)
    );
  }
  return outcome;
}

async function notifyTeam(
  ctx: { tenantId: string; title: string; recipients: string[]; projectId: string; planId: string },
  request: ApprovalRequest,
  actor: ApprovalActor
) {
  if (ctx.recipients.length === 0) return;
  const db = getAdminDb();
  const who = actor.kind === 'share' ? actor.clientName : actor.displayName || 'Müşteri';
  const comment = request.comment?.trim();
  const { title, message } =
    request.action === 'client_approve'
      ? { title: 'İçerik Planı Onaylandı', message: `"${ctx.title}" içerik planını ${who} onayladı.` }
      : request.action === 'client_reject'
        ? { title: 'Revizyon İstendi', message: `"${ctx.title}" için ${who} revizyon istedi.${comment ? ` Not: ${comment}` : ''}` }
        : { title: 'Yeni Müşteri Yorumu', message: `"${ctx.title}" için ${who}: ${comment || ''}` };
  // Hedef, alıcının panelinde: marka yöneticisi → Studio planı, iç ekip → admin plan sayfası
  const userDocs = await db.getAll(...ctx.recipients.map((uid) => db.collection('users').doc(uid)));
  const roleOf = new Map<string, string>(userDocs.map((d: any) => [d.id, d.exists ? d.data().role : '']));
  const batch = db.batch();
  for (const userId of ctx.recipients) {
    const link =
      roleOf.get(userId) === 'brand_manager'
        ? `/studio/${ctx.projectId}/planlar/${ctx.planId}`
        : `/admin/projects/${ctx.projectId}/social-media/plans/${ctx.planId}`;
    batch.set(db.collection('notifications').doc(), {
      tenantId: ctx.tenantId,
      userId,
      type: 'social_media',
      title,
      message,
      link,
      projectId: ctx.projectId,
      planId: ctx.planId,
      read: false,
      createdAt: new Date(),
    });
  }
  await batch.commit();
}

// ============================================
// İstemciye güvenli serileştirme (Timestamp → {__ts})
// ============================================

export function serializeForClient(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  const v: any = value;
  if (typeof v.toMillis === 'function') return { __ts: v.toMillis() };
  if (v instanceof Date) return { __ts: v.getTime() };
  if (Array.isArray(v)) return v.map(serializeForClient);
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) out[k] = serializeForClient(val);
  return out;
}

export function sendApprovalResult(res: any, result: ApprovalSuccess | ApprovalFailure) {
  if (result.ok) return res.status(200).json({ success: true, ...result });
  return res.status(result.httpStatus).json({ error: result.error, code: result.code });
}
