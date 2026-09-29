import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { executeApproval, loadUserActor, sendApprovalResult } from '../_lib/contentApprovalServer.js';

/**
 * Tek bir post için müşteri kararı (portal). Onay motoruna delege eder:
 * approve → client_approve, revise → client_reject, undo → client_undo.
 * Post'un bir içerik planına bağlı olması gerekir; erişim ve tur kontrolü plan üzerinden yapılır.
 *
 * Body: { postId, action: 'approve'|'revise'|'undo', comment?, reviewRequestId?, planId? }
 * planId: post'ta contentPlanId yoksa (eski plan.postIds bağı) portalın gördüğü plan; üyelik transaction'da doğrulanır.
 */
const ACTION_MAP = { approve: 'client_approve', revise: 'client_reject', undo: 'client_undo' } as const;

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { postId, action, comment, reviewRequestId, planId: requestedPlanId } = (req.body || {}) as {
    postId?: string;
    action?: keyof typeof ACTION_MAP;
    comment?: string;
    reviewRequestId?: string;
    planId?: string;
  };

  if (!postId || typeof postId !== 'string' || !action || !(action in ACTION_MAP)) {
    return res.status(400).json({ error: 'postId ve geçerli action gerekli' });
  }

  try {
    const postDoc = await getAdminDb().collection('social_media_posts').doc(postId).get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Post bulunamadı', code: 'POST_NOT_FOUND' });
    // Post'un kendi bağı önceliklidir; yoksa istekteki plan (üyelik motor tarafından doğrulanır)
    const planId = postDoc.data()?.contentPlanId || (typeof requestedPlanId === 'string' ? requestedPlanId : undefined);
    if (!planId) {
      return res.status(409).json({ error: 'Bu post bir içerik planına bağlı değil', code: 'NOT_IN_PLAN' });
    }

    const actor = await loadUserActor(req);
    const result = await executeApproval({
      planId,
      actor,
      request: {
        action: ACTION_MAP[action],
        postIds: [postId],
        comment: typeof comment === 'string' ? comment : undefined,
        reviewRequestId: typeof reviewRequestId === 'string' ? reviewRequestId : undefined,
      },
    });
    return sendApprovalResult(res, result);
  } catch (err: any) {
    console.error('[client-review-post] Error:', err);
    return res.status(500).json({ error: 'Sunucu hatası' });
  }
});
