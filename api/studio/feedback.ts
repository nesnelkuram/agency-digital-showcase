import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { checkLibraryAccess } from '../_lib/integrations/libraryAccess.js';
import { SuggestionFeedbackSchema, recordSuggestionFeedback } from '../_lib/feedback/contentFeedback.js';

/**
 * POST { target: { kind: 'suggestion', suggestionSetId, index }, category, note, scope, idempotencyKey, expectedContentHash }
 *   → AI öneri reddi sebebi. Post ret/revizyon sebebi burada DEĞİL: onay geçişiyle aynı transaction'da
 *   (api/content-approval/transition `feedback`). Actor/zaman sunucudan; öneri saklanmış kümeden doğrulanır;
 *   erişim kümenin gerçek projesiyle mevcut kütüphane rol sınırına göre. Aynı gönderim tekrarı yeni kayıt üretmez.
 *   Marka hafızasına yazmaz.
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const parsed = SuggestionFeedbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Geri bildirim geçersiz', issues: parsed.error.issues.slice(0, 5).map((i) => i.path.join('.') || i.code) });
  try {
    const db = getAdminDb();
    const result = await recordSuggestionFeedback(db, {
      actor: { uid: req.userId, name: req.userDisplayName || '', role: req.userRole, tenantId: req.tenantId },
      input: parsed.data,
      now: Date.now(),
      checkAccess: (projectId) => checkLibraryAccess(db, req.userId, projectId),
    });
    if (!result.ok) return res.status(result.httpStatus).json({ error: result.error, code: result.code });
    const f = result.feedback;
    return res.status(result.created ? 201 : 200).json({ ok: true, duplicate: !result.created, feedback: { id: f.id, category: f.category, scope: f.scope, contentVersion: f.contentVersion, createdAt: f.createdAt } });
  } catch (error: any) {
    console.error('studio/feedback error:', error?.message);
    return res.status(500).json({ error: 'Geri bildirim kaydedilemedi' });
  }
});
