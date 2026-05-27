import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb, getFieldValue } from '../_lib/firebaseAdmin.js';

/**
 * Müşterinin (veya iç ekibin) tek bir postu onaylaması/revizyon istemesi için.
 *
 * Yetki kuralları:
 * - client rolü: sadece assignedProjectIds içindeki projeye ait post'u onaylayabilir
 *   VE o post'un planı kendisine atanmış olmalı (plan.assignedClientId === uid
 *   veya profile.assignedProjectIds içinde post.projectId var)
 * - admin/account_manager/super_admin: her postu onaylayabilir (iç onay için)
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { postId, action, comment } = req.body as {
    postId?: string;
    action?: 'approve' | 'revise' | 'undo';
    comment?: string;
  };

  if (!postId || !action) {
    return res.status(400).json({ error: 'postId ve action gerekli' });
  }
  if (!['approve', 'revise', 'undo'].includes(action)) {
    return res.status(400).json({ error: `Geçersiz action: ${action}` });
  }
  if (action === 'revise' && (!comment || !comment.trim())) {
    return res.status(400).json({ error: 'Revizyon için yorum gerekli' });
  }

  const adminDb = getAdminDb();
  const FieldValue = getFieldValue();

  try {
    console.info('[client-review-post] Request:', {
      userUid: req.userUid,
      userRole: req.userRole,
      tenantId: req.tenantId,
      postId,
      action,
    });

    // 1) Post'u yükle + tenant kontrolü
    const postRef = adminDb.collection('social_media_posts').doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) {
      console.warn('[client-review-post] Post bulunamadı:', postId);
      return res.status(404).json({ error: 'Post bulunamadı' });
    }
    const post = postDoc.data();
    console.info('[client-review-post] Post data:', {
      postId,
      postTenantId: post.tenantId,
      projectId: post.projectId,
      contentPlanId: post.contentPlanId,
      status: post.status,
    });

    if (post.tenantId !== req.tenantId) {
      console.warn('[client-review-post] Tenant uyumsuzluğu:', {
        postTenant: post.tenantId,
        userTenant: req.tenantId,
      });
      return res.status(403).json({ error: 'Bu post farklı bir tenant\'a ait' });
    }

    const isInternal = ['admin', 'account_manager', 'super_admin', 'staff'].includes(
      req.userRole
    );
    const isClient = req.userRole === 'client';

    if (!isInternal && !isClient) {
      console.warn('[client-review-post] Rol izni yok:', req.userRole);
      return res.status(403).json({ error: `Rolünüz (${req.userRole}) onay yetkisi vermiyor` });
    }

    // Client için genişletilmiş yetki kontrolü — 3 yol:
    //   a) users.profile.assignedProjectIds içinde post.projectId var
    //   b) plan.assignedClientId == user.uid
    //   c) plan.assignedClientEmail == user.email (lowercase)
    if (isClient) {
      const userDoc = await adminDb.collection('users').doc(req.userUid).get();
      const userData: any = userDoc.exists ? userDoc.data() : null;
      const userEmail = (userData?.email || '').toLowerCase();
      const assignedProjects: string[] = userData?.profile?.assignedProjectIds || [];
      const canSeeProject =
        post.projectId && assignedProjects.includes(post.projectId);

      let planAssignedToMe = false;
      if (post.contentPlanId) {
        const planDoc = await adminDb.collection('content_plans').doc(post.contentPlanId).get();
        if (planDoc.exists) {
          const planData = planDoc.data();
          planAssignedToMe =
            planData?.assignedClientId === req.userUid ||
            (planData?.assignedClientEmail || '').toLowerCase() === userEmail;
        }
      }

      console.info('[client-review-post] Client yetki kontrolü:', {
        userEmail,
        assignedProjects,
        postProjectId: post.projectId,
        canSeeProject,
        planAssignedToMe,
      });

      if (!canSeeProject && !planAssignedToMe) {
        return res.status(403).json({
          error:
            'Bu postu onaylama yetkiniz yok. Ajans sizinle bu projeyi paylaşmamış olabilir.',
        });
      }
    }

    // 3) Post'u güncelle
    const patch: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (action === 'approve') {
      patch.status = 'approved';
      patch.approvedBy = req.userUid;
      patch.approvedByName = req.userDisplayName || 'Müşteri';
      patch.approvedAt = FieldValue.serverTimestamp();
    } else if (action === 'revise') {
      patch.status = 'revision_requested';
      patch.lastRevisionComment = comment!.trim();
      patch.revisionCount = FieldValue.increment(1);
    } else if (action === 'undo') {
      // Daha önceki onay/revizyon kararını geri al
      patch.status = 'pending_approval';
      patch.approvedBy = FieldValue.delete();
      patch.approvedByName = FieldValue.delete();
      patch.approvedAt = FieldValue.delete();
    }
    await postRef.update(patch);

    // 4) İlgili plana per-post yorum ekle (audit/iletişim için)
    if (post.contentPlanId) {
      const planRef = adminDb.collection('content_plans').doc(post.contentPlanId);
      const commentText =
        action === 'approve'
          ? '✓ Onaylandı'
          : action === 'revise'
          ? (comment || '').trim()
          : '↩ Onay kaldırıldı';
      const newComment = {
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        postId,
        text: commentText,
        createdBy: req.userUid,
        createdByName: req.userDisplayName || 'Müşteri',
        createdByRole: req.userRole,
        createdAt: new Date(),
        isClient: req.userRole === 'client',
        isInternal: isInternal,
      };
      await planRef.update({
        clientComments: FieldValue.arrayUnion(newComment),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return res.status(200).json({ success: true, action, postId });
  } catch (err: any) {
    console.error('[client-review-post] Error:', err);
    return res.status(500).json({ error: err?.message || 'Sunucu hatası' });
  }
});
