import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { checkLibraryAccess } from '../_lib/integrations/libraryAccess.js';
import { getMediaSourcePolicy } from '../_lib/contentApprovalServer.js';
import { listInventoryPage, InventoryError } from '../_lib/plannerInventory/plannerInventory.js';

/**
 * GET ?projectId[&cursor][&limit≤100] → { items, nextCursor, excluded, pageSize }
 * Sayfalı planlayıcı envanteri: istemci nextCursor null olana kadar sayfa ister (sessiz 200 kırpması yok).
 * Erişim: kütüphane rol sınırı. İndirme URL'si/token dönmez; yalnız Storage yolu.
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const q: any = req.query || {};
  try {
    const db = getAdminDb();
    const access = await checkLibraryAccess(db, req.userId, q.projectId);
    if (!access.ok) return res.status(access.httpStatus).json({ error: access.error });
    let makeCursorValue: ((sec: number, nanos: number) => unknown) | undefined;
    if (q.cursor) {
      const { Timestamp } = await import('firebase-admin/firestore');
      makeCursorValue = (sec: number, nanos: number) => new Timestamp(sec, nanos);
    }
    const page = await listInventoryPage(db, {
      tenantId: req.tenantId, projectId: q.projectId, policy: getMediaSourcePolicy(),
      cursor: typeof q.cursor === 'string' ? q.cursor : null, limit: q.limit, makeCursorValue,
    });
    return res.status(200).json(page);
  } catch (error: any) {
    if (error instanceof InventoryError) return res.status(error.status).json({ error: error.message, code: error.code });
    console.error('studio/planner-inventory error:', error?.message);
    return res.status(500).json({ error: 'Envanter yüklenemedi', code: 'internal' });
  }
});
