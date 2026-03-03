import type { VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { ROLES } from '../../lib/rbac/roles.js';
import { PERMISSIONS } from '../../lib/rbac/permissions.js';

// ============================================
// Gecis kurallari: action -> { fromStatuses, toStatus, requiredPermission }
// ============================================

interface TransitionRule {
  fromStatuses: string[];
  toStatus: string;
  requiredPermission: string;
}

const TRANSITION_RULES: Record<string, TransitionRule> = {
  submit_for_review: {
    fromStatuses: ['draft', 'revision_requested_internal'],
    toStatus: 'internal_review',
    requiredPermission: PERMISSIONS.APPROVALS_SUBMIT,
  },
  submit_to_client: {
    fromStatuses: ['draft', 'internal_review'],
    toStatus: 'pending_approval',
    requiredPermission: PERMISSIONS.APPROVALS_SKIP_INTERNAL,
  },
  internal_approve: {
    fromStatuses: ['internal_review'],
    toStatus: 'pending_approval',
    requiredPermission: PERMISSIONS.APPROVALS_INTERNAL_REVIEW,
  },
  internal_reject: {
    fromStatuses: ['internal_review'],
    toStatus: 'revision_requested_internal',
    requiredPermission: PERMISSIONS.APPROVALS_INTERNAL_REVIEW,
  },
  resubmit: {
    fromStatuses: ['revision_requested', 'revision_requested_internal'],
    toStatus: '', // dynamic: revision_requested -> pending_approval, revision_requested_internal -> internal_review
    requiredPermission: PERMISSIONS.APPROVALS_SUBMIT,
  },
  client_approve: {
    fromStatuses: ['pending_approval'],
    toStatus: 'approved',
    requiredPermission: PERMISSIONS.APPROVALS_APPROVE,
  },
  client_reject: {
    fromStatuses: ['pending_approval'],
    toStatus: 'revision_requested',
    requiredPermission: PERMISSIONS.APPROVALS_APPROVE,
  },
};

function getResubmitTarget(fromStatus: string): string {
  if (fromStatus === 'revision_requested') return 'pending_approval';
  if (fromStatus === 'revision_requested_internal') return 'internal_review';
  return '';
}

function userHasPermission(role: string, permission: string): boolean {
  const roleConfig = ROLES[role];
  if (!roleConfig) return false;
  return roleConfig.permissions.includes(permission as any);
}

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { planId, postIds, action, comment } = req.body || {};

    if (!planId || typeof planId !== 'string') {
      return res.status(400).json({ error: 'planId gerekli' });
    }
    if (!action || typeof action !== 'string') {
      return res.status(400).json({ error: 'action gerekli' });
    }

    const rule = TRANSITION_RULES[action];
    if (!rule) {
      return res.status(400).json({ error: `Gecersiz aksiyon: ${action}` });
    }

    // Yetki kontrolu
    if (!userHasPermission(req.userRole, rule.requiredPermission)) {
      return res.status(403).json({ error: 'Bu islem icin yetkiniz yok' });
    }

    const db = getAdminDb();
    const planRef = db.collection('content_plans').doc(planId);
    const planDoc = await planRef.get();

    if (!planDoc.exists) {
      return res.status(404).json({ error: 'Icerik plani bulunamadi' });
    }

    const planData = planDoc.data()!;
    if (planData.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Erisim reddedildi' });
    }

    // Hedef post'lari belirle
    let targetPostIds: string[] = postIds && Array.isArray(postIds) && postIds.length > 0
      ? postIds
      : planData.postIds || [];

    if (targetPostIds.length === 0) {
      return res.status(400).json({ error: 'Planda post bulunamadi' });
    }

    // Post'lari getir
    const postsSnap = await db.collection('social_media_posts')
      .where('__name__', 'in', targetPostIds.slice(0, 10))  // Firestore 'in' limiti 10
      .get();

    const batch = db.batch();
    const now = new Date();
    const updatedPosts: { postId: string; fromStatus: string; newStatus: string }[] = [];

    for (const postDoc of postsSnap.docs) {
      const postData = postDoc.data();
      const fromStatus = postData.status;

      // Bu post icin gecis gecerli mi?
      if (!rule.fromStatuses.includes(fromStatus)) {
        continue; // Gecersiz durumdaki post'lari atla
      }

      let toStatus = rule.toStatus;
      if (action === 'resubmit') {
        toStatus = getResubmitTarget(fromStatus);
        if (!toStatus) continue;
      }

      const postUpdate: Record<string, any> = {
        status: toStatus,
        updatedAt: now,
      };

      // Dahili inceleme onayi
      if (action === 'internal_approve') {
        postUpdate.internalReviewedBy = req.userId;
        postUpdate.internalReviewedByName = req.userDisplayName || '';
        postUpdate.internalReviewedAt = now;
      }

      // Musteri onayi
      if (action === 'client_approve') {
        postUpdate.approvedBy = req.userId;
        postUpdate.approvedByName = req.userDisplayName || '';
        postUpdate.approvedAt = now;

        // Otomatik zamanlama
        const planConfig = planData.approvalConfig || {};
        if (planConfig.autoScheduleOnApproval !== false && postData.scheduledAt) {
          postUpdate.status = 'scheduled';
          toStatus = 'scheduled';
        }
      }

      // Revizyon sayaci
      if (toStatus === 'revision_requested' || toStatus === 'revision_requested_internal') {
        postUpdate.revisionCount = (postData.revisionCount || 0) + 1;
        if (comment) postUpdate.lastRevisionComment = comment;
      }

      batch.update(postDoc.ref, postUpdate);

      // Audit event
      const eventRef = planRef.collection('approval_events').doc();
      batch.set(eventRef, {
        postId: postDoc.id,
        action,
        fromStatus,
        toStatus,
        performedBy: req.userId,
        performedByName: req.userDisplayName || '',
        performedByRole: req.userRole,
        comment: comment || null,
        timestamp: now,
      });

      updatedPosts.push({ postId: postDoc.id, fromStatus, newStatus: toStatus });
    }

    if (updatedPosts.length === 0) {
      return res.status(400).json({ error: 'Bu aksiyon icin uygun durumda post bulunamadi' });
    }

    // Eger 10'dan fazla post varsa, geri kalanlari da isle (batch halinde)
    if (targetPostIds.length > 10) {
      const remainingIds = targetPostIds.slice(10);
      for (let i = 0; i < remainingIds.length; i += 10) {
        const chunk = remainingIds.slice(i, i + 10);
        const chunkSnap = await db.collection('social_media_posts')
          .where('__name__', 'in', chunk)
          .get();

        for (const postDoc of chunkSnap.docs) {
          const postData = postDoc.data();
          const fromStatus = postData.status;
          if (!rule.fromStatuses.includes(fromStatus)) continue;

          let toStatus = rule.toStatus;
          if (action === 'resubmit') {
            toStatus = getResubmitTarget(fromStatus);
            if (!toStatus) continue;
          }

          const postUpdate: Record<string, any> = { status: toStatus, updatedAt: now };

          if (action === 'internal_approve') {
            postUpdate.internalReviewedBy = req.userId;
            postUpdate.internalReviewedByName = req.userDisplayName || '';
            postUpdate.internalReviewedAt = now;
          }
          if (action === 'client_approve') {
            postUpdate.approvedBy = req.userId;
            postUpdate.approvedByName = req.userDisplayName || '';
            postUpdate.approvedAt = now;
            const planConfig = planData.approvalConfig || {};
            if (planConfig.autoScheduleOnApproval !== false && postData.scheduledAt) {
              postUpdate.status = 'scheduled';
              toStatus = 'scheduled';
            }
          }
          if (toStatus === 'revision_requested' || toStatus === 'revision_requested_internal') {
            postUpdate.revisionCount = (postData.revisionCount || 0) + 1;
            if (comment) postUpdate.lastRevisionComment = comment;
          }

          batch.update(postDoc.ref, postUpdate);
          const eventRef = planRef.collection('approval_events').doc();
          batch.set(eventRef, {
            postId: postDoc.id,
            action,
            fromStatus,
            toStatus,
            performedBy: req.userId,
            performedByName: req.userDisplayName || '',
            performedByRole: req.userRole,
            comment: comment || null,
            timestamp: now,
          });
          updatedPosts.push({ postId: postDoc.id, fromStatus, newStatus: toStatus });
        }
      }
    }

    // Plan statusunu yeniden hesapla
    const allPostsSnap = await db.collection('social_media_posts')
      .where('contentPlanId', '==', planId)
      .get();

    const postStatuses = allPostsSnap.docs.map((d) => {
      const updated = updatedPosts.find((u) => u.postId === d.id);
      return updated ? updated.newStatus : d.data().status;
    });

    const newPlanStatus = computePlanStatus(postStatuses);
    const summary = computeSummary(postStatuses);

    const planUpdate: Record<string, any> = {
      status: newPlanStatus,
      postApprovalSummary: summary,
      updatedAt: now,
    };

    // Dahili inceleme plan seviyesinde
    if (action === 'internal_approve') {
      planUpdate.internalReviewedBy = req.userId;
      planUpdate.internalReviewedByName = req.userDisplayName || '';
      planUpdate.internalReviewedAt = now;
    }

    // Musteri onayi plan seviyesinde (tum postlar onaylanmissa)
    if (newPlanStatus === 'approved') {
      planUpdate.approvedBy = req.userId;
      planUpdate.approvedByName = req.userDisplayName || '';
      planUpdate.approvedAt = now;
    }

    batch.update(planRef, planUpdate);

    await batch.commit();

    return res.status(200).json({
      success: true,
      updatedPosts,
      planStatus: newPlanStatus,
      postApprovalSummary: summary,
    });
  } catch (error: any) {
    console.error('content-approval/transition error:', error);
    return res.status(500).json({ error: String(error?.message || 'Gecis basarisiz') });
  }
});

// ============================================
// Yardimci fonksiyonlar
// ============================================

function computePlanStatus(postStatuses: string[]): string {
  if (postStatuses.length === 0) return 'draft';

  const allApproved = postStatuses.every(
    (s) => s === 'approved' || s === 'scheduled' || s === 'published'
  );
  if (allApproved) return 'approved';

  const hasRevision = postStatuses.some(
    (s) => s === 'revision_requested' || s === 'revision_requested_internal'
  );
  if (hasRevision) return 'revision_requested';

  const hasApproved = postStatuses.some(
    (s) => s === 'approved' || s === 'scheduled' || s === 'published'
  );
  const hasPending = postStatuses.some((s) => s === 'pending_approval');
  if (hasApproved && (hasPending || postStatuses.some((s) => s === 'internal_review' || s === 'draft'))) {
    return 'partially_approved';
  }

  if (hasPending) return 'pending_approval';

  const hasInternal = postStatuses.some((s) => s === 'internal_review');
  if (hasInternal) return 'internal_review';

  return 'draft';
}

function computeSummary(postStatuses: string[]) {
  const summary = {
    total: postStatuses.length,
    draft: 0,
    internalReview: 0,
    pendingApproval: 0,
    approved: 0,
    revisionRequested: 0,
  };

  for (const s of postStatuses) {
    switch (s) {
      case 'draft': summary.draft++; break;
      case 'internal_review': summary.internalReview++; break;
      case 'pending_approval': summary.pendingApproval++; break;
      case 'approved':
      case 'scheduled':
      case 'published':
        summary.approved++; break;
      case 'revision_requested':
      case 'revision_requested_internal':
        summary.revisionRequested++; break;
    }
  }

  return summary;
}
