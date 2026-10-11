import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { checkLibraryAccess } from '../_lib/integrations/libraryAccess.js';
import { loadDraft, saveDraft, DraftError } from '../_lib/plannerDraft/plannerDraft.js';

/**
 * Kalıcı planlayıcı taslağı (hafta başına tek belge). Yalnız sunucu yazar; kural: istemci erişimi yok.
 *   GET ?projectId&weekStart            → { exists, version, draft?, updatedAt? }
 *   PUT { projectId, weekStart, expectedVersion, idempotencyKey, draft } → { version, replayed }
 * tenant kimlik doğrulamasından gelir; taslak şeması (liste elemanları dahil), medya kimlikleri, sürüm ve
 * idempotency sunucuda doğrulanır. Yayın/onay/müşteri bildirimi YOK.
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
  const src: any = req.method === 'GET' ? req.query : req.body || {};
  try {
    const db = getAdminDb();
    const access = await checkLibraryAccess(db, req.userId, src.projectId);
    if (!access.ok) return res.status(access.httpStatus).json({ error: access.error });
    if (req.method === 'GET') {
      const d = await loadDraft(db, { tenantId: req.tenantId, projectId: src.projectId, weekStart: String(src.weekStart ?? '') });
      return res.status(200).json(d ? { exists: true, ...d } : { exists: false, version: 0 });
    }
    const r = await saveDraft(db, {
      tenantId: req.tenantId, projectId: src.projectId, uid: req.userId, weekStart: String(src.weekStart ?? ''),
      expectedVersion: src.expectedVersion, idempotencyKey: src.idempotencyKey, draft: src.draft, now: Date.now(),
    });
    return res.status(200).json(r);
  } catch (error: any) {
    if (error instanceof DraftError) return res.status(error.status).json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) });
    console.error('studio/planner-draft error:', error?.message);
    return res.status(500).json({ error: 'Taslak işlenemedi', code: 'internal' });
  }
});
