import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb, getAdminStorage } from '../_lib/firebaseAdmin.js';
import { mediaAnalysisState } from '../_lib/integrations/config.js';
import { enqueueAnalysis, processAnalysisJob, queueJobId } from '../_lib/mediaAnalysis/autoQueue.js';
import { loadEffectiveCatalog, loadLatestCatalog, saveCorrection } from '../_lib/mediaAnalysis/correctionStore.js';
import { CatalogCorrectionInputSchema } from '../_lib/mediaAnalysis/spec.js';
import { checkLibraryAccess } from '../_lib/integrations/libraryAccess.js';
import { analyzeBrandMedia, firestoreAnalysisStore, type BrandMediaLike } from '../_lib/mediaAnalysis/runner.js';
import { anthropicModelCall } from '../_lib/mediaAnalysis/anthropicCall.js';

/**
 * Tek Studio görseli için AI kataloglama (Haiku 5.5). Varsayılan KAPALI.
 * GET  ?projectId&assetId → son analiz kaydı + insan düzeltmesi + etkin katalog (çağrı yok)
 * POST { projectId, assetId } → tamamlanmış analiz varsa onu döndürür (ücretli çağrı yok); yoksa tek çağrı
 * POST { projectId, assetId, trigger: 'upload_complete' } → kalıcı analiz işi (kapalıysa yazma/çağrı yok);
 *      Canva senkronundan bağımsız. Bildirim kaybolsa da cron uzlaştırır.
 * POST { projectId, assetId, correction } → insan katalog düzeltmesi (bayraktan bağımsız; AI bunu ezmez)
 * Toplu analiz uç noktası yoktur. Erişim: kütüphane rol sınırı (müşteri/freelancer hariç).
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const feature = mediaAnalysisState();
  const src = req.method === 'GET' ? req.query : req.body || {};
  const { projectId, assetId } = src as { projectId?: unknown; assetId?: unknown };
  if (typeof assetId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(assetId)) return res.status(400).json({ error: 'assetId geçersiz' });

  try {
    const db = getAdminDb();
    const access = await checkLibraryAccess(db, req.userId, projectId);
    if (!access.ok) return res.status(access.httpStatus).json({ error: access.error });

    const pid = projectId as string;
    if (req.method === 'GET') {
      const latest = await db.collection('media_ai_analysis_latest').doc(`${req.tenantId}_${pid}_${assetId}`).get();
      const rec = latest.exists ? await db.collection('media_ai_analyses').doc(latest.data().key).get() : null;
      const analysis = rec?.exists && rec.data().tenantId === req.tenantId && rec.data().projectId === pid ? rec.data() : null;
      const effective = await loadEffectiveCatalog(db, req.tenantId, pid, assetId);
      return res.status(200).json({ enabled: feature.enabled, analysis, effective });
    }

    const isCorrection = req.body?.correction !== undefined;
    const autoTrigger = req.body?.trigger === 'upload_complete';
    // Kapalıyken: düz analiz 503, otomatik tetik sessizce atlanır — ikisinde de okuma/yazma/dış çağrı yok
    if (!isCorrection && !feature.enabled) {
      return autoTrigger
        ? res.status(200).json({ enabled: false, queued: false, reason: 'feature_disabled' })
        : res.status(503).json({ error: feature.reason, code: 'feature_disabled' });
    }

    const snap = await db.collection('brand_media').doc(assetId).get();
    const a = snap.exists ? snap.data() : null;
    if (!a || a.tenantId !== req.tenantId || a.projectId !== pid) return res.status(404).json({ error: 'Medya bulunamadı' });

    if (isCorrection) {
      const parsed = CatalogCorrectionInputSchema.safeParse(req.body.correction);
      if (!parsed.success) return res.status(400).json({ error: 'Düzeltme geçersiz', issues: parsed.error.issues.slice(0, 5).map((i) => i.path.join('.')) });
      const latest = await loadLatestCatalog(db, req.tenantId, pid, assetId);
      await saveCorrection(db, { tenantId: req.tenantId, projectId: pid, assetId, input: parsed.data, uid: req.userId, now: Date.now(), basedOnAnalysisKey: latest?.key || null });
      return res.status(200).json({ ok: true, effective: await loadEffectiveCatalog(db, req.tenantId, pid, assetId) });
    }

    if (autoTrigger) {
      const q = await enqueueAnalysis(db, { tenantId: req.tenantId, projectId: pid, assetId, featureEnabled: true, now: Date.now() });
      if (!q.queued) return res.status(200).json({ enabled: true, queued: false, reason: q.reason });
    }

    const storage = await getAdminStorage();
    const analysisDeps = (asset: BrandMediaLike) => ({
      store: firestoreAnalysisStore(db),
      readBytes: async (path: string) => {
        // Yalnız bu varlığın klasöründen okunur
        if (!path.startsWith(`brand-media/${asset.tenantId}/${asset.projectId}/${asset.id}/`)) throw new Error('Kaynak yolu varlığa ait değil');
        const [buf] = await storage.bucket(process.env.FIREBASE_STORAGE_BUCKET).file(path).download();
        return buf;
      },
      callModel: anthropicModelCall(),
    });
    if (autoTrigger) {
      // Hızlı yol: işi hemen ilerlet (kuyruk lease/fencing ile); kesilirse cron sürdürür
      const state = await processAnalysisJob(db, queueJobId(req.tenantId, pid, assetId), { analysisDeps, owner: `req:${req.userId}:${Date.now()}`, now: Date.now });
      return res.status(200).json({ enabled: true, queued: true, state });
    }
    const asset: BrandMediaLike = { id: assetId, tenantId: a.tenantId, projectId: a.projectId, kind: a.kind, status: a.status, storage: a.storage };
    const record = await analyzeBrandMedia(asset, analysisDeps(asset));
    return res.status(200).json({ enabled: true, analysis: record });
  } catch (error: any) {
    console.error('media/analyze error:', error?.message);
    return res.status(500).json({ error: 'Analiz yapılamadı' });
  }
});
