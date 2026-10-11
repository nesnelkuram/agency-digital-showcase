import type { VercelResponse } from '@vercel/node';
import { createHash } from 'crypto';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb, getAdminStorage } from '../_lib/firebaseAdmin.js';
import { canvaSyncState } from '../_lib/integrations/config.js';
import { checkLibraryAccess, INTEGRATION_ADMIN_ROLES } from '../_lib/integrations/libraryAccess.js';
import { CANVA_IMAGE_MAX_BYTES, CANVA_SYNC_MIME, CanvaClient } from '../_lib/canva/client.js';
import { COL, firestoreSyncStore, getAccessToken, loadConnection, mappingDocId, type CanvaFolderMapping } from '../_lib/canva/firestoreStores.js';
import { newSyncJob, runSyncJob, syncJobId, type SyncCommand } from '../_lib/canva/syncEngine.js';
import { enqueueForAsset } from '../_lib/canva/autoSync.js';

export const config = { maxDuration: 60 };

/**
 * Studio → Canva fotoğraf kopyası (orijinal baytlar). Studio kaydının başarısı buna bağlı DEĞİL.
 * GET  ?projectId&assetId                       → iş durumu
 * POST { projectId, assetId }                   → iş yoksa oluşturur ve ilerletir; varsa ilerletir (tekrar yükleme yok)
 * POST { projectId, assetId, command }          → yalnız admin: reupload | link_existing{canvaAssetId} | retry_move
 * POST { projectId, assetId, trigger: 'upload_complete' } → OTOMATİK: koşullar sağlanırsa kalıcı iş açılır ve
 *      ilerletilir; sağlanmazsa 200 { queued:false, reason } ve dış çağrı yok. İstek kaybolsa da cron uzlaştırır.
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  const src = req.method === 'GET' ? req.query : req.body || {};
  const { projectId, assetId } = src as { projectId?: unknown; assetId?: unknown };
  if (typeof assetId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(assetId)) return res.status(400).json({ error: 'assetId geçersiz' });
  const feature = canvaSyncState();
  try {
    const db = getAdminDb();
    const access = await checkLibraryAccess(db, req.userId, projectId);
    if (!access.ok) return res.status(access.httpStatus).json({ error: access.error });
    const conn = feature.enabled ? await loadConnection(db, req.tenantId) : null;
    const jobId = conn ? syncJobId({ tenantId: req.tenantId, projectId: projectId as string, connectionId: conn.connectionId, assetId }) : null;
    const store = firestoreSyncStore(db);

    if (req.method === 'GET') {
      const job = jobId ? await store.get(jobId) : null;
      return res.status(200).json({ enabled: feature.enabled, job: job ? publicJob(job) : null });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const autoTrigger = req.body?.trigger === 'upload_complete';
    if (autoTrigger) {
      // Otomatik yol: kapalı/eşlemesiz durumda sessizce atla (Studio yüklemesi etkilenmez, dış çağrı yok)
      const q = await enqueueForAsset(db, { tenantId: req.tenantId, projectId: projectId as string, assetId, featureEnabled: feature.enabled, now: Date.now() });
      if (!q.queued) return res.status(200).json({ enabled: feature.enabled, queued: false, reason: q.reason });
    }
    if (!feature.enabled) return res.status(503).json({ error: feature.reason, code: 'feature_disabled' });
    if (!conn || conn.status !== 'connected') return res.status(409).json({ error: 'Canva bağlantısı yok', code: 'not_connected' });
    const mapSnap = await db.collection(COL.mappings).doc(mappingDocId(req.tenantId, projectId as string)).get();
    const mapping = mapSnap.exists ? (mapSnap.data() as CanvaFolderMapping) : null;
    if (!mapping || !mapping.toCanva) return res.status(409).json({ error: 'Bu marka için Studio → Canva kopyalama açık değil', code: 'no_mapping' });
    if (mapping.connectionId !== conn.connectionId) return res.status(409).json({ error: 'Klasör eşlemesi eski Canva bağlantısına ait; yeniden eşleyin', code: 'mapping_stale_connection' });

    const assetSnap = await db.collection('brand_media').doc(assetId).get();
    const a = assetSnap.exists ? assetSnap.data() : null;
    if (!a || a.tenantId !== req.tenantId || a.projectId !== projectId) return res.status(404).json({ error: 'Medya bulunamadı' });

    const command: SyncCommand = parseCommand(req.body?.command);
    if (command.type !== 'run' && !INTEGRATION_ADMIN_ROLES.has(req.userRole)) return res.status(403).json({ error: 'Bu işlem yalnız yöneticiye açık' });
    // Arşivlenmiş/aktif olmayan medya Canva'ya aktarılmaz (yalnız mevcut Canva asset'ini bağlama serbest)
    if (a.status !== 'active' && command.type !== 'link_existing') return res.status(409).json({ error: 'Medya aktif değil; Canva\'ya aktarılmaz', code: 'asset_not_active' });

    const now = Date.now;
    await store.createIfAbsent(
      newSyncJob({ tenantId: req.tenantId, projectId: projectId as string, connectionId: conn.connectionId, assetId, fileName: a.fileName || `${assetId}.jpg`, canvaFolderId: mapping.canvaFolderId }, now())
    );
    const storage = await getAdminStorage();
    const client = new CanvaClient(
      () => getAccessToken(db, req.tenantId, { clientId: process.env.CANVA_CLIENT_ID!, clientSecret: process.env.CANVA_CLIENT_SECRET!, fetchImpl: fetch, expectedConnectionId: conn.connectionId }),
      fetch as any
    );
    const job = await runSyncJob(
      jobId!,
      {
        store,
        canva: client,
        now,
        owner: `${req.userId}:${now()}`,
        maxPolls: 8,
        pollDelayMs: 2000,
        readSource: async () => {
          // Kayıttaki tür/boyut desteklenmiyorsa indirme yapılmaz (ör. 1 GB video)
          if (!CANVA_SYNC_MIME.has(a.storage?.contentType) || !(a.storage?.size < CANVA_IMAGE_MAX_BYTES)) {
            return { bytes: Buffer.alloc(0), sha256: '', contentType: String(a.storage?.contentType || ''), size: Number(a.storage?.size) || 0 };
          }
          const path: string = a.storage?.path || '';
          if (!path.startsWith(`brand-media/${a.tenantId}/${a.projectId}/${assetId}/`)) throw new Error('Kaynak yolu varlığa ait değil');
          const [bytes] = await storage.bucket(process.env.FIREBASE_STORAGE_BUCKET).file(path).download();
          return { bytes, sha256: createHash('sha256').update(bytes).digest('hex'), contentType: a.storage.contentType, size: bytes.length };
        },
      },
      command
    );
    return res.status(200).json({ enabled: true, job: publicJob(job) });
  } catch (error: any) {
    console.error('canva/sync error:', error?.code || error?.message);
    return res.status(500).json({ error: 'Canva senkronu işlenemedi', code: error?.code || 'error' });
  }
});

function parseCommand(c: any): SyncCommand {
  if (c?.type === 'reupload') return { type: 'reupload' };
  if (c?.type === 'retry_move') return { type: 'retry_move' };
  if (c?.type === 'link_existing' && typeof c.canvaAssetId === 'string') return { type: 'link_existing', canvaAssetId: c.canvaAssetId };
  return { type: 'run' };
}

function publicJob(j: any) {
  return {
    state: j.state,
    canvaAssetId: j.canvaAssetId || null,
    canvaFolderId: j.canvaFolderId || null,
    uploadAttempts: j.uploadAttempts,
    moveAttempts: j.moveAttempts,
    lastError: j.lastError || null,
    nextAttemptAt: j.nextAttemptAt || null,
    updatedAt: j.updatedAt,
  };
}
