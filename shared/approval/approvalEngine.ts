/**
 * İçerik onay motoru — saf (I/O yok), sunucu ve testler tarafından kullanılır.
 *
 * Tüm onay durumu değişiklikleri buradan geçer:
 * - Aktörün plana erişimi (tenant + rol + proje ataması)
 * - Hedef post'ların gerçekten plana ait olması (tek uyumsuz post → hiçbir şey yazılmaz)
 * - Geçiş kuralları ve etkin onay politikası
 * - Müşteri inceleme turu (reviewRequestId): eski ekrandan gelen karar reddedilir
 */

import { ROLES } from '../../lib/rbac/roles';
import { PERMISSIONS } from '../../lib/rbac/permissions';

// ============================================
// Tipler
// ============================================

export type ApprovalActionName =
  | 'submit_for_review'
  | 'internal_approve'
  | 'internal_reject'
  | 'submit_to_client'
  | 'resubmit'
  | 'reopen'
  | 'client_approve'
  | 'client_reject'
  | 'client_undo'
  | 'comment'
  | 'update_approval_config';

export type ApprovalActor =
  | {
      kind: 'user';
      uid: string;
      tenantId: string;
      role: string;
      displayName: string;
      email?: string;
      assignedProjectIds: string[];
    }
  | {
      kind: 'share';
      clientName: string;
    };

export interface ApprovalConfigShape {
  requireInternalReview: boolean;
  autoScheduleOnApproval: boolean;
  allowPartialApproval: boolean;
}

export interface PlanSnapshot {
  id: string;
  tenantId: string;
  projectId: string;
  postIds: string[];
  status: string;
  approvalConfig?: Partial<ApprovalConfigShape>;
  reviewRequestId?: string | null;
  assignedClientId?: string;
  assignedClientEmail?: string;
}

export interface PostSnapshot {
  id: string;
  tenantId?: string;
  projectId?: string;
  contentPlanId?: string;
  status: string;
  hasScheduledAt: boolean;
  revisionCount?: number;
}

export interface ProjectPolicy {
  /** Studio'dan yönetilen projeler: iç inceleme zorunlu, onayda otomatik zamanlama yok */
  studioManaged?: boolean;
}

export interface ClientAssignee {
  clientId?: string;
  clientName: string;
  clientEmail: string;
}

export interface ApprovalRequest {
  action: ApprovalActionName;
  /** Verilmemiş → plandaki tüm post'lar. Verilmişse validatePostIdsParam ile doğrulanır. */
  postIds?: string[];
  comment?: string;
  /** Müşteri kararlarında zorunlu (plan bir tur kimliği taşıyorsa) */
  reviewRequestId?: string;
  assignee?: ClientAssignee;
  approvalConfig?: Partial<ApprovalConfigShape>;
}

export type ApprovalErrorCode =
  | 'INVALID_ACTION'
  | 'FORBIDDEN'
  | 'NOT_IN_PLAN'
  | 'POST_NOT_FOUND'
  | 'STALE_REVIEW'
  | 'INTERNAL_REVIEW_REQUIRED'
  | 'PARTIAL_NOT_ALLOWED'
  | 'COMMENT_REQUIRED'
  | 'NO_ELIGIBLE_POSTS'
  | 'BAD_REQUEST';

export interface ApprovalError {
  ok: false;
  code: ApprovalErrorCode;
  message: string;
  httpStatus: number;
}

export interface PostChange {
  postId: string;
  fromStatus: string;
  toStatus: string;
  /** Post dokümanına yazılacak alanlar; `null` değer alan silme anlamına gelir */
  fields: Record<string, unknown>;
}

export interface PlanCommentDraft {
  postId?: string;
  text: string;
}

export interface ApprovalPlan {
  ok: true;
  postChanges: PostChange[];
  /** Plan dokümanına yazılacak alanlar (status/özet hariç — onlar sonradan hesaplanır) */
  planFields: Record<string, unknown>;
  /** Yeni müşteri inceleme turu açıldıysa kimliği */
  newReviewRequestId?: string;
  comments: PlanCommentDraft[];
  /** Müşteri projeye erişebilsin diye assignedProjectIds'e eklenecek kullanıcı */
  grantProjectToClientUid?: string;
  performedBy: string;
  performedByName: string;
  performedByRole: string;
}

export type ApprovalResult = ApprovalPlan | ApprovalError;

// ============================================
// Roller ve izinler
// ============================================

/** Bu roller tenant içinde yalnızca atanmış projelere erişir */
export const PROJECT_SCOPED_ROLES = new Set(['client', 'brand_manager', 'freelancer']);

/** Bu roller tenant içindeki tüm projelere erişir */
export const INTERNAL_ROLES = new Set(['super_admin', 'admin', 'account_manager', 'staff', 'editor']);

export function roleHasPermission(role: string, permission: string): boolean {
  const config = ROLES[role];
  if (!config) return false;
  return (config.permissions as string[]).includes(permission);
}

const APPROVED_LIKE = new Set(['approved', 'scheduled', 'published']);

/** Müşterinin içeriğini görebileceği post durumları (revizyondaki içerik ekipte düzenlenir, gösterilmez) */
export const CLIENT_VISIBLE_POST_STATUSES = new Set(['pending_approval', 'approved', 'scheduled', 'published']);

/** Müşteriye açılmış plan durumları */
export const CLIENT_VISIBLE_PLAN_STATUSES = new Set(['pending_approval', 'partially_approved', 'approved', 'revision_requested']);

const INTERNAL_ACTIONS = new Set<ApprovalActionName>([
  'submit_for_review',
  'internal_approve',
  'internal_reject',
  'submit_to_client',
  'resubmit',
  'reopen',
  'update_approval_config',
]);

const CLIENT_DECISION_ACTIONS = new Set<ApprovalActionName>(['client_approve', 'client_reject', 'client_undo']);

const ACTION_PERMISSION: Record<ApprovalActionName, string> = {
  submit_for_review: PERMISSIONS.APPROVALS_SUBMIT,
  internal_approve: PERMISSIONS.APPROVALS_INTERNAL_REVIEW,
  internal_reject: PERMISSIONS.APPROVALS_INTERNAL_REVIEW,
  submit_to_client: PERMISSIONS.APPROVALS_SKIP_INTERNAL,
  resubmit: PERMISSIONS.APPROVALS_SUBMIT,
  reopen: PERMISSIONS.APPROVALS_SUBMIT,
  client_approve: PERMISSIONS.APPROVALS_APPROVE,
  client_reject: PERMISSIONS.APPROVALS_APPROVE,
  client_undo: PERMISSIONS.APPROVALS_APPROVE,
  comment: PERMISSIONS.APPROVALS_COMMENT,
  update_approval_config: PERMISSIONS.APPROVALS_SKIP_INTERNAL,
};

// ============================================
// Yardımcılar
// ============================================

function fail(code: ApprovalErrorCode, message: string, httpStatus = 400): ApprovalError {
  return { ok: false, code, message, httpStatus };
}

/**
 * postIds parametresini doğrular. Verilmemişse (undefined) → tüm plan.
 * Verilmişse: dizi, boş olmayan, her öğe boş olmayan string. Geçersiz tek öğe → hata (kapsam genişletilmez).
 */
export function validatePostIdsParam(value: unknown): { ok: true; ids: string[] | undefined } | { ok: false; message: string } {
  if (value === undefined) return { ok: true, ids: undefined };
  if (!Array.isArray(value) || value.length === 0) return { ok: false, message: 'postIds boş olmayan bir dizi olmalı' };
  if (value.length > 200) return { ok: false, message: 'Tek istekte en fazla 200 post' };
  if (!value.every((v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 128)) {
    return { ok: false, message: 'postIds geçersiz öğe içeriyor' };
  }
  return { ok: true, ids: Array.from(new Set(value as string[])) };
}

export function isApprovalAction(value: unknown): value is ApprovalActionName {
  return typeof value === 'string' && value in ACTION_PERMISSION;
}

export const DEFAULT_CONFIG: ApprovalConfigShape = {
  requireInternalReview: false,
  autoScheduleOnApproval: true,
  allowPartialApproval: true,
};

/** Plan ayarı + proje politikası → etkin ayar. Studio projelerinde politika plan ayarını ezer. */
export function effectiveApprovalConfig(
  planConfig: Partial<ApprovalConfigShape> | undefined,
  policy: ProjectPolicy | undefined
): ApprovalConfigShape {
  const merged = { ...DEFAULT_CONFIG, ...(planConfig || {}) };
  if (policy?.studioManaged) {
    merged.requireInternalReview = true;
    merged.autoScheduleOnApproval = false;
  }
  return merged;
}

/**
 * Kullanıcının bu plana erişimi var mı?
 * - Tenant her zaman eşleşmeli.
 * - İç roller: tenant yeterli.
 * - Proje kapsamlı roller: plan.projectId atanmış olmalı.
 *   Müşteri için ek olarak plan doğrudan kendisine atanmışsa (uid) erişir.
 */
export function userCanAccessPlan(
  actor: Extract<ApprovalActor, { kind: 'user' }>,
  plan: Pick<PlanSnapshot, 'tenantId' | 'projectId' | 'assignedClientId' | 'assignedClientEmail'>
): boolean {
  if (!actor.tenantId || actor.tenantId !== plan.tenantId) return false;
  if (INTERNAL_ROLES.has(actor.role)) return true;
  if (PROJECT_SCOPED_ROLES.has(actor.role)) {
    if (plan.projectId && actor.assignedProjectIds.includes(plan.projectId)) return true;
    if (actor.role === 'client') {
      if (plan.assignedClientId && plan.assignedClientId === actor.uid) return true;
      if (plan.assignedClientEmail && actor.email && plan.assignedClientEmail.toLowerCase() === actor.email) return true;
    }
    return false;
  }
  return false;
}

/** Post plana ait mi? (tenant, proje ve plan bağı birlikte) */
export function postBelongsToPlan(post: PostSnapshot, plan: PlanSnapshot): boolean {
  if (post.tenantId && post.tenantId !== plan.tenantId) return false;
  if (!post.projectId || post.projectId !== plan.projectId) return false;
  if (post.contentPlanId) return post.contentPlanId === plan.id;
  return plan.postIds.includes(post.id);
}

// ============================================
// Plan durum hesaplama (post'lardan)
// ============================================

export function computePlanStatus(postStatuses: string[]): string {
  if (postStatuses.length === 0) return 'draft';
  if (postStatuses.every((s) => APPROVED_LIKE.has(s))) return 'approved';
  if (postStatuses.some((s) => s === 'revision_requested' || s === 'revision_requested_internal')) {
    return 'revision_requested';
  }
  const hasApproved = postStatuses.some((s) => APPROVED_LIKE.has(s));
  const hasPending = postStatuses.some((s) => s === 'pending_approval');
  if (hasApproved && (hasPending || postStatuses.some((s) => s === 'internal_review' || s === 'draft'))) {
    return 'partially_approved';
  }
  if (hasPending) return 'pending_approval';
  if (postStatuses.some((s) => s === 'internal_review')) return 'internal_review';
  return 'draft';
}

export function computeApprovalSummary(postStatuses: string[]) {
  const summary = { total: postStatuses.length, draft: 0, internalReview: 0, pendingApproval: 0, approved: 0, revisionRequested: 0 };
  for (const s of postStatuses) {
    if (s === 'draft') summary.draft++;
    else if (s === 'internal_review') summary.internalReview++;
    else if (s === 'pending_approval') summary.pendingApproval++;
    else if (APPROVED_LIKE.has(s)) summary.approved++;
    else if (s === 'revision_requested' || s === 'revision_requested_internal') summary.revisionRequested++;
  }
  return summary;
}

// ============================================
// Ana fonksiyon
// ============================================

export interface PlanApprovalInput {
  actor: ApprovalActor;
  request: ApprovalRequest;
  plan: PlanSnapshot;
  policy?: ProjectPolicy;
  /** request.postIds verildiyse o post'lar, yoksa plandaki tüm post'lar (bulunamayanlar null) */
  targetPosts: Array<PostSnapshot | null>;
  /** Yeni tur kimliği üretici (test edilebilirlik için dışarıdan) */
  newId: () => string;
}

export function planApproval(input: PlanApprovalInput): ApprovalResult {
  const { actor, request, plan, policy, targetPosts } = input;
  const { action } = request;

  if (!isApprovalAction(action)) return fail('INVALID_ACTION', 'Geçersiz aksiyon');
  const postIdsCheck = validatePostIdsParam(request.postIds);
  if (!postIdsCheck.ok) return fail('BAD_REQUEST', postIdsCheck.message);

  const config = effectiveApprovalConfig(plan.approvalConfig, policy);
  const comment = typeof request.comment === 'string' ? request.comment.trim() : '';
  const explicitPosts = Array.isArray(request.postIds) && request.postIds.length > 0;

  // ── 1. Aktör ve yetki ─────────────────────────────────────
  let performedBy: string;
  let performedByName: string;
  let performedByRole: string;

  if (actor.kind === 'share') {
    // Paylaşım linki: yalnızca plan bazında müşteri kararı ve yorum
    if (!['client_approve', 'client_reject', 'comment'].includes(action)) {
      return fail('FORBIDDEN', 'Bu işlem paylaşım linkiyle yapılamaz', 403);
    }
    if (explicitPosts && action !== 'comment') {
      return fail('FORBIDDEN', 'Post bazında onay için portal üzerinden giriş yapmanız gerekir', 403);
    }
    const name = (actor.clientName || '').trim();
    if (!name) return fail('BAD_REQUEST', 'Lütfen isminizi girin');
    performedBy = `anonymous:${name}`;
    performedByName = name;
    performedByRole = 'client';
  } else {
    if (!userCanAccessPlan(actor, plan)) return fail('FORBIDDEN', 'Bu plana erişim yetkiniz yok', 403);
    if (!roleHasPermission(actor.role, ACTION_PERMISSION[action])) {
      return fail('FORBIDDEN', 'Bu işlem için yetkiniz yok', 403);
    }
    // Müşteri iç akış işlemi yapamaz; iç roller müşteri adına karar veremez (brand_manager dahil)
    if (INTERNAL_ACTIONS.has(action) && actor.role === 'client') {
      return fail('FORBIDDEN', 'Bu işlem için yetkiniz yok', 403);
    }
    if (CLIENT_DECISION_ACTIONS.has(action) && actor.role === 'brand_manager') {
      return fail('FORBIDDEN', 'Müşteri adına onay verilemez', 403);
    }
    performedBy = actor.uid;
    performedByName = actor.displayName || '';
    performedByRole = actor.role;
  }

  // ── 2. Onay ayarı güncelleme (post'a dokunmaz) ─────────────
  if (action === 'update_approval_config') {
    const next = { ...DEFAULT_CONFIG, ...(plan.approvalConfig || {}), ...(request.approvalConfig || {}) };
    const clean: ApprovalConfigShape = {
      requireInternalReview: !!next.requireInternalReview,
      autoScheduleOnApproval: !!next.autoScheduleOnApproval,
      allowPartialApproval: !!next.allowPartialApproval,
    };
    return {
      ok: true,
      postChanges: [],
      planFields: { approvalConfig: clean },
      comments: [],
      performedBy,
      performedByName,
      performedByRole,
    };
  }

  // ── 3. Hedef post'lar: hepsi bulunmalı ve plana ait olmalı ──
  if (explicitPosts && targetPosts.some((p) => p === null)) {
    return fail('POST_NOT_FOUND', 'Post bulunamadı', 404);
  }
  const posts = targetPosts.filter((p): p is PostSnapshot => p !== null);
  if (posts.some((p) => !postBelongsToPlan(p, plan))) {
    return fail('NOT_IN_PLAN', 'Gönderilen post bu plana ait değil', 400);
  }

  // ── 4. Yorum ────────────────────────────────────────────────
  if (action === 'comment') {
    if (!comment) return fail('COMMENT_REQUIRED', 'Yorum boş olamaz');
    return {
      ok: true,
      postChanges: [],
      planFields: {},
      comments: [{ postId: explicitPosts ? posts[0]?.id : undefined, text: comment }],
      performedBy,
      performedByName,
      performedByRole,
    };
  }

  // ── 5. Müşteri kararlarında tur ve kısmi onay kontrolleri ─────
  if (CLIENT_DECISION_ACTIONS.has(action)) {
    // Plan tur kimliği taşıyorsa istek aynı turu göstermeli (eski ekran reddedilir).
    // Tur kimliği olmayan eski planlar geriye dönük uyumluluk için kabul edilir.
    if (plan.reviewRequestId && request.reviewRequestId !== plan.reviewRequestId) {
      return fail('STALE_REVIEW', 'Bu içerik siz incelerken güncellendi. Lütfen sayfayı yenileyin.', 409);
    }
    if (explicitPosts && !config.allowPartialApproval && actor.kind === 'user' && actor.role === 'client') {
      return fail('PARTIAL_NOT_ALLOWED', 'Bu plan için post bazında onay aktif değil');
    }
    if (action === 'client_reject' && !comment && (actor.kind === 'share' || actor.role === 'client')) {
      return fail('COMMENT_REQUIRED', 'Revizyon için açıklama gerekli');
    }
  }

  if (action === 'internal_reject' && !comment) {
    return fail('COMMENT_REQUIRED', 'Revizyon için açıklama gerekli');
  }

  // ── 6. Geçişler ─────────────────────────────────────────────
  const postChanges: PostChange[] = [];
  let opensClientRound = false;

  for (const post of posts) {
    const from = post.status;
    let to: string | null = null;
    const fields: Record<string, unknown> = {};

    switch (action) {
      case 'submit_for_review':
        if (from === 'draft' || from === 'revision_requested_internal') to = 'internal_review';
        break;

      case 'internal_approve':
        if (from === 'internal_review') {
          to = 'pending_approval';
          fields.internalReviewedBy = performedBy;
          fields.internalReviewedByName = performedByName;
          fields.internalReviewedAt = '__now__';
        }
        break;

      case 'internal_reject':
        if (from === 'internal_review') to = 'revision_requested_internal';
        break;

      case 'submit_to_client':
        if (from === 'draft' || from === 'internal_review') to = 'pending_approval';
        break;

      case 'resubmit':
        if (from === 'revision_requested_internal') to = 'internal_review';
        else if (from === 'revision_requested') to = config.requireInternalReview ? 'internal_review' : 'pending_approval';
        break;

      case 'reopen':
        if (from === 'pending_approval' || from === 'approved' || from === 'scheduled') {
          to = 'internal_review';
          Object.assign(fields, clearedApprovalFields());
        }
        break;

      case 'client_approve':
        if (from === 'pending_approval') {
          to = config.autoScheduleOnApproval && post.hasScheduledAt ? 'scheduled' : 'approved';
          fields.approvedBy = performedBy;
          fields.approvedByName = performedByName;
          fields.approvedAt = '__now__';
        }
        break;

      case 'client_reject':
        if (from === 'pending_approval') to = 'revision_requested';
        break;

      case 'client_undo':
        // Yalnızca kendi onayını geri alma. Revizyon kararı geri alınamaz: revizyon sırasında
        // içerik değişmiş olabilir; yeniden müşteriye gitmesi iç akıştan (resubmit) geçer.
        if (from === 'approved') {
          to = 'pending_approval';
          Object.assign(fields, { approvedBy: null, approvedByName: null, approvedAt: null });
        }
        break;
    }

    if (!to) continue;

    if (to === 'revision_requested' || to === 'revision_requested_internal') {
      fields.revisionCount = (post.revisionCount || 0) + 1;
    }
    // İç ve müşteri revizyon notları ayrı alanlarda: iç not müşteriye hiçbir yoldan gitmez
    if (to === 'revision_requested_internal' && comment) {
      fields.lastInternalRevisionComment = comment;
    }
    if (to === 'revision_requested' && comment) {
      fields.lastRevisionComment = comment;
      fields.lastRevisionCommentSource = 'client';
    }
    if (to === 'pending_approval' && action !== 'client_undo') opensClientRound = true;

    postChanges.push({ postId: post.id, fromStatus: from, toStatus: to, fields });
  }

  // Studio / iç inceleme zorunlu: taslaktan doğrudan müşteriye gidilemez
  if (action === 'submit_to_client' && config.requireInternalReview && postChanges.some((c) => c.fromStatus === 'draft')) {
    return fail('INTERNAL_REVIEW_REQUIRED', 'Bu plan için önce iç inceleme gerekli', 409);
  }

  const planFields: Record<string, unknown> = {};
  let grantProjectToClientUid: string | undefined;

  // Müşteriye gönderimde atama bilgisi (post zaten müşterideyse sadece atama güncellenir)
  if (action === 'submit_to_client') {
    const assignee = request.assignee;
    if (assignee) {
      const email = (assignee.clientEmail || '').trim().toLowerCase();
      if (!email) return fail('BAD_REQUEST', 'Müşteri e-postası gerekli');
      planFields.assignedClientName = (assignee.clientName || '').trim();
      planFields.assignedClientEmail = email;
      if (assignee.clientId) {
        planFields.assignedClientId = assignee.clientId;
        grantProjectToClientUid = assignee.clientId;
      }
      planFields.sentToClientAt = '__now__';
      planFields.sentToClientBy = performedBy;
      planFields.sentToClientByName = performedByName;
    }
    if (postChanges.length === 0) {
      const allAlreadyWithClient = posts.length > 0 && posts.every((p) => p.status === 'pending_approval');
      if (!assignee || !allAlreadyWithClient) {
        return fail('NO_ELIGIBLE_POSTS', 'Müşteriye gönderilecek uygun durumda post yok', 409);
      }
      if (!plan.reviewRequestId) opensClientRound = true;
    }
  } else if (postChanges.length === 0) {
    return fail('NO_ELIGIBLE_POSTS', 'Bu işlem için uygun durumda post bulunamadı', 409);
  }

  if (action === 'internal_approve') {
    planFields.internalReviewedBy = performedBy;
    planFields.internalReviewedByName = performedByName;
    planFields.internalReviewedAt = '__now__';
  }

  // Yeni müşteri turu ya da revizyona alma → eski müşteri ekranları geçersiz
  let newReviewRequestId: string | undefined;
  if (opensClientRound || action === 'reopen') {
    newReviewRequestId = input.newId();
    planFields.reviewRequestId = newReviewRequestId;
  }
  if (action === 'reopen') {
    Object.assign(planFields, clearedApprovalFields());
  }

  const comments: PlanCommentDraft[] = [];
  if (CLIENT_DECISION_ACTIONS.has(action)) {
    const text =
      action === 'client_approve'
        ? comment || '✓ Onaylandı'
        : action === 'client_reject'
          ? comment
          : '↩ Onay kaldırıldı';
    if (text) {
      if (explicitPosts) {
        for (const change of postChanges) comments.push({ postId: change.postId, text });
      } else {
        comments.push({ text });
      }
    }
  }

  return {
    ok: true,
    postChanges,
    planFields,
    newReviewRequestId,
    comments,
    grantProjectToClientUid,
    performedBy,
    performedByName,
    performedByRole,
  };
}

function clearedApprovalFields(): Record<string, null> {
  return {
    approvedBy: null,
    approvedByName: null,
    approvedAt: null,
    internalReviewedBy: null,
    internalReviewedByName: null,
    internalReviewedAt: null,
  };
}

/** Plan dokümanına yazılacak onay alanları (tüm post'lar onaylandıysa) */
export function planApprovedFields(newPlanStatus: string, performedBy: string, performedByName: string) {
  if (newPlanStatus !== 'approved') return {};
  return { approvedBy: performedBy, approvedByName: performedByName, approvedAt: '__now__' };
}
