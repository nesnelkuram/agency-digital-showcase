import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { canvaSyncState } from '../_lib/integrations/config.js';
import { checkLibraryAccess } from '../_lib/integrations/libraryAccess.js';
import { CanvaClient } from '../_lib/canva/client.js';
import { COL, getAccessToken, loadConnection, mappingDocId, publicConnection, type CanvaFolderMapping } from '../_lib/canva/firestoreStores.js';

/**
 * Marka/proje ↔ Canva klasörü (açık eşleme; otomatik eşleme yok).
 * GET  ?projectId                     → durum: özellik açık mı, bağlantı, eşleme (token yok)
 * GET  ?projectId&list=1[&cursor]     → eşlenen klasördeki GÖRSELLER (metadata + 15 dk'lık önizleme; URL saklanmaz)
 * POST { projectId, canvaFolderId, toCanva, fromCanva } → yalnız admin; klasör okunabilirliği doğrulanır
 * Canva-only kayıtlar Studio orijinali DEĞİLDİR: takvime/posta eklenemez (orijinal indirme yolu yok).
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const feature = canvaSyncState();
  const src = req.method === 'GET' ? req.query : req.body || {};
  const projectId = (src as any).projectId;
  try {
    const db = getAdminDb();
    const adminOnly = req.method === 'POST';
    const access = await checkLibraryAccess(db, req.userId, projectId, { adminOnly });
    if (!access.ok) return res.status(access.httpStatus).json({ error: access.error });
    const conn = feature.enabled ? await loadConnection(db, req.tenantId) : null;
    const mapSnap = await db.collection(COL.mappings).doc(mappingDocId(req.tenantId, projectId)).get();
    const mapping = mapSnap.exists ? (mapSnap.data() as CanvaFolderMapping) : null;

    if (req.method === 'GET' && !req.query.list) {
      return res.status(200).json({
        enabled: feature.enabled,
        ...(feature.enabled ? {} : { reason: feature.reason }),
        connection: publicConnection(conn),
        mapping: mapping ? { canvaFolderId: mapping.canvaFolderId, toCanva: mapping.toCanva, fromCanva: mapping.fromCanva, folderUrl: folderUrl(mapping.canvaFolderId) } : null,
      });
    }
    if (!feature.enabled) return res.status(503).json({ error: feature.reason, code: 'feature_disabled' });
    if (!conn || conn.status !== 'connected') return res.status(409).json({ error: 'Canva bağlantısı yok veya yeniden yetki gerekiyor', code: 'not_connected' });
    const client = new CanvaClient(
      () => getAccessToken(db, req.tenantId, { clientId: process.env.CANVA_CLIENT_ID!, clientSecret: process.env.CANVA_CLIENT_SECRET!, fetchImpl: fetch, expectedConnectionId: conn.connectionId }),
      fetch as any
    );

    if (req.method === 'GET') {
      if (!mapping || !mapping.fromCanva) return res.status(409).json({ error: 'Bu marka için Canva klasörü eşlenmemiş', code: 'no_mapping' });
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const page = await client.listFolderImages(mapping.canvaFolderId, cursor);
      return res.status(200).json({
        folderUrl: folderUrl(mapping.canvaFolderId),
        previewOnly: true,
        items: page.items.map((i) => ({ ...i, source: 'canva', quality: 'canva_preview', canBeScheduled: false })),
        nextCursor: page.continuation || null,
        note: 'Videolar Canva API tarafından listelenmez.',
      });
    }

    if (req.method === 'POST') {
      const { canvaFolderId, toCanva, fromCanva } = req.body || {};
      if (typeof canvaFolderId !== 'string' || !/^[A-Za-z0-9_-]{1,50}$/.test(canvaFolderId) || canvaFolderId === 'root') {
        return res.status(400).json({ error: 'Geçersiz Canva klasör kimliği' });
      }
      await client.listFolderImages(canvaFolderId); // okunabilir mi (yazma izni ayrıca ilk taşımada görülür)
      const now = Date.now();
      const keepSince = mapping?.toCanva && mapping.connectionId === conn.connectionId && mapping.canvaFolderId === canvaFolderId ? (mapping as any).toCanvaSince : null;
      const m: CanvaFolderMapping & { toCanvaSince: number | null } = {
        tenantId: req.tenantId,
        projectId,
        connectionId: conn.connectionId,
        canvaFolderId,
        toCanva: toCanva === true,
        fromCanva: fromCanva !== false,
        // Otomatik senkron yalnız bu andan SONRA yüklenen fotoğraflar için (eski medya backfill yok)
        toCanvaSince: toCanva === true ? keepSince || now : null,
        verifiedAt: now,
        createdBy: req.userId,
        updatedAt: now,
      };
      await db.collection(COL.mappings).doc(mappingDocId(req.tenantId, projectId)).set(m);
      return res.status(200).json({ ok: true, mapping: { canvaFolderId, toCanva: m.toCanva, fromCanva: m.fromCanva, folderUrl: folderUrl(canvaFolderId) } });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    const status = typeof error?.status === 'number' && error.status < 500 ? 502 : 500;
    console.error('canva/folder error:', error?.code || error?.message);
    return res.status(status).json({ error: 'Canva klasörü işlenemedi', code: error?.code || 'error' });
  }
});

/** Asset düzeyinde "Canva'da aç" bağlantısı API'de belgelenmediği için yalnız klasör bağlantısı */
const folderUrl = (id: string) => `https://www.canva.com/folder/${encodeURIComponent(id)}`;
