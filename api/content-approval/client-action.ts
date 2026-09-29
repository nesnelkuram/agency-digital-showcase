import type { VercelResponse } from '@vercel/node';
import { withAuthOptional, OptionalAuthRequest } from '../_lib/withAuth.js';
import {
  executeApproval,
  findPlanIdByShareToken,
  loadUserActor,
  sendApprovalResult,
} from '../_lib/contentApprovalServer.js';

/**
 * Müşteri kararı (onay / revizyon / yorum).
 *
 * - Oturumsuz: yalnızca geçerli paylaşım token'ı ile, plan bazında. `planId` ile oturumsuz işlem yapılamaz.
 * - Oturumlu: `planId` ile; tenant + atanmış proje kontrolü onay motorunda yapılır.
 *
 * Body: { shareToken? | planId?, action: client_approve|client_reject|comment, postIds?, comment?, clientName?, reviewRequestId? }
 */
const ALLOWED = new Set(['client_approve', 'client_reject', 'comment']);

export default withAuthOptional(async (req: OptionalAuthRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { shareToken, planId, postIds, action, comment, clientName, reviewRequestId } = req.body || {};
    if (!ALLOWED.has(action)) {
      return res.status(400).json({ error: 'Geçerli action gerekli: client_approve, client_reject veya comment', code: 'INVALID_ACTION' });
    }

    const request = {
      action,
      postIds, // doğrulama sunucu katmanında (geçersizse 400, sıfır yazma)
      comment: typeof comment === 'string' ? comment : undefined,
      reviewRequestId: typeof reviewRequestId === 'string' ? reviewRequestId : undefined,
    };

    if (req.userId && req.tenantId && req.userRole) {
      if (typeof planId !== 'string' || !planId) return res.status(400).json({ error: 'planId gerekli' });
      const actor = await loadUserActor({ userId: req.userId, tenantId: req.tenantId, userRole: req.userRole });
      return sendApprovalResult(res, await executeApproval({ planId, actor, request }));
    }

    // Oturumsuz → paylaşım token'ı zorunlu
    const resolvedPlanId = await findPlanIdByShareToken(shareToken);
    if (!resolvedPlanId) return res.status(404).json({ error: 'İçerik planı bulunamadı', code: 'NOT_FOUND' });

    const name = typeof clientName === 'string' ? clientName.trim().slice(0, 80) : '';
    return sendApprovalResult(
      res,
      await executeApproval({ planId: resolvedPlanId, actor: { kind: 'share', clientName: name }, request })
    );
  } catch (error: any) {
    console.error('content-approval/client-action error:', error);
    return res.status(500).json({ error: 'İşlem başarısız' });
  }
});
