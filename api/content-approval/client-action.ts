import type { VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { withAuthOptional, OptionalAuthRequest } from '../_lib/withAuth.js';

/**
 * Musteri onay endpoint'i — hem portal (auth'lu) hem public link (auth'suz) destekler.
 *
 * Auth varsa (portal): post bazinda onay/ret destegi
 * Auth yoksa (public link): sadece plan bazinda onay/ret, clientName zorunlu
 */
export default withAuthOptional(async (req: OptionalAuthRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shareToken, planId, postIds, action, comment, clientName } = req.body || {};

    if (!action || (action !== 'client_approve' && action !== 'client_reject')) {
      return res.status(400).json({ error: 'Gecerli action gerekli: client_approve veya client_reject' });
    }

    const isAuthenticated = !!req.userId;
    const db = getAdminDb();

    // Plan'i bul
    let planRef;
    let planDoc;

    if (planId) {
      planRef = db.collection('content_plans').doc(planId);
      planDoc = await planRef.get();
    } else if (shareToken) {
      const snap = await db.collection('content_plans')
        .where('shareToken', '==', shareToken)
        .limit(1)
        .get();
      if (snap.empty) {
        return res.status(404).json({ error: 'Icerik plani bulunamadi' });
      }
      planDoc = snap.docs[0];
      planRef = planDoc.ref;
    } else {
      return res.status(400).json({ error: 'planId veya shareToken gerekli' });
    }

    if (!planDoc || !planDoc.exists) {
      return res.status(404).json({ error: 'Icerik plani bulunamadi' });
    }

    const planData = planDoc.data()!;

    // Auth kontrolu: auth'lu kullanici tenant kontrolu yapar
    if (isAuthenticated && planData.tenantId !== req.tenantId) {
      // Client rolundeki kullanicilar farkli tenant'a ait olabilir — sadece uyari
      if (req.userRole !== 'client') {
        return res.status(403).json({ error: 'Erisim reddedildi' });
      }
    }

    // Auth'suz kullanici icin clientName zorunlu
    if (!isAuthenticated && !clientName) {
      return res.status(400).json({ error: 'Lutfen isminizi girin (clientName)' });
    }

    // Kimlik bilgileri
    const performedBy = isAuthenticated ? req.userId! : `anonymous:${clientName}`;
    const performedByName = isAuthenticated
      ? (planData.assignedClientName || req.userId)
      : clientName;
    const performedByRole = isAuthenticated ? (req.userRole || 'client') : 'client';

    // Post bazinda mi plan bazinda mi?
    const isPartialApproval = Array.isArray(postIds) && postIds.length > 0;

    // Auth'suz kullanici post bazinda onay yapamaz
    if (!isAuthenticated && isPartialApproval) {
      return res.status(400).json({
        error: 'Post bazinda onay icin portal uzerinden giris yapmaniz gerekmektedir',
      });
    }

    // Plan'in allowPartialApproval ayarini kontrol et
    const approvalConfig = planData.approvalConfig || {};
    if (isPartialApproval && approvalConfig.allowPartialApproval === false) {
      return res.status(400).json({ error: 'Bu plan icin post bazinda onay aktif degil' });
    }

    // Hedef post'lari belirle
    const targetPostIds: string[] = isPartialApproval
      ? postIds
      : (planData.postIds || []);

    if (targetPostIds.length === 0) {
      return res.status(400).json({ error: 'Planda post bulunamadi' });
    }

    const batch = db.batch();
    const now = new Date();
    const updatedPosts: { postId: string; newStatus: string }[] = [];

    // Post'lari isle (10'lu gruplar — Firestore 'in' limiti)
    for (let i = 0; i < targetPostIds.length; i += 10) {
      const chunk = targetPostIds.slice(i, i + 10);
      const postsSnap = await db.collection('social_media_posts')
        .where('__name__', 'in', chunk)
        .get();

      for (const postDocSnap of postsSnap.docs) {
        const postData = postDocSnap.data();

        // Sadece pending_approval durumundaki post'lar islenebilir
        if (postData.status !== 'pending_approval') continue;

        let toStatus: string;

        if (action === 'client_approve') {
          toStatus = 'approved';
          const postUpdate: Record<string, any> = {
            status: toStatus,
            approvedBy: performedBy,
            approvedByName: performedByName,
            approvedAt: now,
            updatedAt: now,
          };

          // Otomatik zamanlama
          if (approvalConfig.autoScheduleOnApproval !== false && postData.scheduledAt) {
            postUpdate.status = 'scheduled';
            toStatus = 'scheduled';
          }

          batch.update(postDocSnap.ref, postUpdate);
        } else {
          // client_reject
          toStatus = 'revision_requested';
          batch.update(postDocSnap.ref, {
            status: toStatus,
            revisionCount: (postData.revisionCount || 0) + 1,
            lastRevisionComment: comment || null,
            updatedAt: now,
          });
        }

        // Audit event
        const eventRef = planRef.collection('approval_events').doc();
        batch.set(eventRef, {
          postId: postDocSnap.id,
          action,
          fromStatus: 'pending_approval',
          toStatus,
          performedBy,
          performedByName,
          performedByRole,
          comment: comment || null,
          timestamp: now,
        });

        updatedPosts.push({ postId: postDocSnap.id, newStatus: toStatus });
      }
    }

    if (updatedPosts.length === 0) {
      return res.status(400).json({ error: 'Onay bekleyen post bulunamadi' });
    }

    // Yorum ekle (revizyon durumunda)
    if (action === 'client_reject' && comment) {
      const newComment = {
        id: `comment_${Date.now()}`,
        text: comment,
        createdBy: performedBy,
        createdByName: performedByName,
        createdByRole: performedByRole,
        createdAt: now,
        isClient: true,
        isInternal: false,
      };

      // arrayUnion Admin SDK ile
      const { FieldValue } = await import('firebase-admin/firestore');
      batch.update(planRef, {
        clientComments: FieldValue.arrayUnion(newComment),
      });
    }

    // Plan statusunu yeniden hesapla
    const allPostsSnap = await db.collection('social_media_posts')
      .where('contentPlanId', '==', planDoc.id)
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

    if (newPlanStatus === 'approved') {
      planUpdate.approvedBy = performedBy;
      planUpdate.approvedByName = performedByName;
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
    console.error('content-approval/client-action error:', error);
    return res.status(500).json({ error: String(error?.message || 'Islem basarisiz') });
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
  if (postStatuses.some((s) => s === 'internal_review')) return 'internal_review';

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
