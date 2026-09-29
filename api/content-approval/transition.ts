import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { executeApproval, loadUserActor, sendApprovalResult } from '../_lib/contentApprovalServer.js';
import { isApprovalAction } from '../../shared/approval/approvalEngine';

/**
 * İçerik planı onay geçişleri — tüm oturumlu roller (iç ekip, marka yöneticisi, müşteri portalı).
 * Yetki, plan erişimi, post–plan bağı ve inceleme turu kontrolü onay motorunda yapılır.
 *
 * Body: { planId, action, postIds?, comment?, reviewRequestId?, assignee?, approvalConfig? }
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { planId, action, postIds, comment, reviewRequestId, assignee, approvalConfig } = req.body || {};
    if (!isApprovalAction(action)) return res.status(400).json({ error: 'Geçersiz aksiyon', code: 'INVALID_ACTION' });

    const actor = await loadUserActor(req);
    const result = await executeApproval({
      planId,
      actor,
      request: {
        action,
        postIds, // doğrulama sunucu katmanında (geçersizse 400, sıfır yazma)
        comment: typeof comment === 'string' ? comment : undefined,
        reviewRequestId: typeof reviewRequestId === 'string' ? reviewRequestId : undefined,
        assignee: assignee && typeof assignee === 'object' ? assignee : undefined,
        approvalConfig: approvalConfig && typeof approvalConfig === 'object' ? approvalConfig : undefined,
      },
    });
    return sendApprovalResult(res, result);
  } catch (error: any) {
    console.error('content-approval/transition error:', error);
    return res.status(500).json({ error: 'Geçiş başarısız' });
  }
});
