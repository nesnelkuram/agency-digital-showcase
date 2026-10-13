import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb, getAdminStorage } from '../_lib/firebaseAdmin.js';
import { mediaAnalysisState, storageBucketName } from '../_lib/integrations/config.js';
import { enqueueAnalysis, processAnalysisJob, queueJobId, readQueueView } from '../_lib/mediaAnalysis/autoQueue.js';
import { loadEffectiveCatalog, loadCorrection, loadLatestCatalog, saveCorrection, toCorrectionView } from '../_lib/mediaAnalysis/correctionStore.js';
import { resolveVerifiedProductNames } from '../_lib/mediaAnalysis/productNames.js';
import { CatalogCorrectionInputSchema, effectiveCatalog } from '../_lib/mediaAnalysis/spec.js';
import { checkLibraryAccess } from '../_lib/integrations/libraryAccess.js';
import { analyzeBrandMedia, firestoreAnalysisStore, type BrandMediaLike } from '../_lib/mediaAnalysis/runner.js';
import { openrouterVisionCall } from '../_lib/mediaAnalysis/openrouterVisionCall.js';
import { resolveMediaModel } from '../_lib/mediaAnalysis/spec.js';
import { safeRequestId, sanitizeStoredError } from '../../shared/mediaAnalysisError.js';

/** Yanıta giden kayıtta hata YALNIZ allowlist'li alanlarla (eski kayıtlardaki serbest metin dahil) çıkar */
const withSafeError = <T extends { error?: unknown; requestId?: unknown } | null>(rec: T): T => {
  if (!rec) return rec;
  const out: any = { ...rec };
  if (rec.error) out.error = sanitizeStoredError(rec.error);
  if ('requestId' in rec) out.requestId = safeRequestId(rec.requestId); // eski kayıttaki belgesiz/serbest kimlik yanıta çıkmaz
  return out;
};

/**
 * Tek Studio görseli için AI analizi (OpenRouter: konu kataloğu + kompozisyon kararı; varsayılan Haiku 5.5). Varsayılan KAPALI.
 * Yapılandırma eksikse (OPENROUTER_API_KEY, geçersiz MEDIA_AI_MODEL) dürüstçe devre dışı; başka sağlayıcıya sessiz yedek yoktur.
 * GET  ?projectId&assetId → SALT OKUNUR: son analiz kaydı, kuyruk işi görünümü (media_ai_queue), insan düzeltmesi (güvenli alanlar),
 *      etkin katalog ve insan doğrulamalı ürün adları. Önce yetki + brand_media aidiyeti (tenant+proje) doğrulanır, sonra metadata
 *      okunur. Hiçbir enqueue/process/retry/yazma/model/Canva çağrısı yoktur. İkincil okumalar (kuyruk, düzeltme, ürün adı)
 *      ayrı ayrı hata verebilir: hata `state:'unavailable'` olarak döner, "kayıt yok" anlamına GELMEZ.
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
      // Aidiyet: varlık bu tenant+projeye ait değilse hiçbir metadata (analiz, kuyruk, düzeltme, ürün adı) okunmaz/sızmaz
      const own = await db.collection('brand_media').doc(assetId).get();
      const o = own.exists ? own.data() : null;
      if (!o || o.tenantId !== req.tenantId || o.projectId !== pid) return res.status(404).json({ error: 'Medya bulunamadı' });
      const now = Date.now();
      const latest = await db.collection('media_ai_analysis_latest').doc(`${req.tenantId}_${pid}_${assetId}`).get();
      const rec = latest.exists ? await db.collection('media_ai_analyses').doc(latest.data().key).get() : null;
      const analysis = rec?.exists && rec.data().tenantId === req.tenantId && rec.data().projectId === pid ? withSafeError(rec.data()) : null;
      const [queueR, corrR] = await Promise.allSettled([readQueueView(db, req.tenantId, pid, assetId, now), loadCorrection(db, req.tenantId, pid, assetId)]);
      const queue = queueR.status === 'fulfilled' ? { state: 'ok' as const, job: queueR.value } : { state: 'unavailable' as const };
      if (queueR.status === 'rejected') console.error('media/analyze queue read error:', (queueR.reason as any)?.message);
      let correction: { state: 'ok'; value: ReturnType<typeof toCorrectionView> } | { state: 'unavailable' };
      let effective: any = null;
      let products: { state: string; items: Array<{ id: string; name: string | null }> } = { state: 'none', items: [] };
      if (corrR.status === 'fulfilled') {
        const view = toCorrectionView(corrR.value);
        correction = { state: 'ok', value: view };
        // Etkin katalog: AI sonucu + insan alanları. AI yoksa catalog:null kalır (insan alanlarından tam katalog UYDURULMAZ)
        effective = { ...effectiveCatalog(analysis?.status === 'done' ? analysis.result || null : null, corrR.value), analysisKey: analysis?.key || null, sourceQuality: analysis?.sourceQuality || null };
        if (view && view.verifiedProductIds.length) {
          const r = await resolveVerifiedProductNames(db, req.tenantId, pid, view.verifiedProductIds);
          products = { state: r.source, items: r.items };
        }
      } else {
        console.error('media/analyze correction read error:', (corrR.reason as any)?.message);
        correction = { state: 'unavailable' };
      }
      return res.status(200).json({
        enabled: feature.enabled,
        scope: { tenantId: req.tenantId, projectId: pid, assetId },
        serverNow: now,
        analysis,
        queue,
        correction,
        effective,
        products,
      });
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

    const modelSel = resolveMediaModel();
    if (!modelSel.ok) return res.status(503).json({ error: modelSel.reason, code: 'model_config_invalid' });
    const storage = await getAdminStorage();
    const analysisDeps = (asset: BrandMediaLike) => ({
      store: firestoreAnalysisStore(db),
      readBytes: async (path: string) => {
        // Yalnız bu varlığın klasöründen okunur
        if (!path.startsWith(`brand-media/${asset.tenantId}/${asset.projectId}/${asset.id}/`)) throw new Error('Kaynak yolu varlığa ait değil');
        const [buf] = await storage.bucket(storageBucketName()).file(path).download();
        return buf;
      },
      callModel: openrouterVisionCall(),
    });
    if (autoTrigger) {
      // Hızlı yol: işi hemen ilerlet (kuyruk lease/fencing ile); kesilirse cron sürdürür
      const state = await processAnalysisJob(db, queueJobId(req.tenantId, pid, assetId), { analysisDeps, model: modelSel.model, owner: `req:${req.userId}:${Date.now()}`, now: Date.now });
      return res.status(200).json({ enabled: true, queued: true, state });
    }
    const asset: BrandMediaLike = { id: assetId, tenantId: a.tenantId, projectId: a.projectId, kind: a.kind, status: a.status, storage: a.storage };
    const record = await analyzeBrandMedia(asset, analysisDeps(asset), modelSel.model);
    return res.status(200).json({ enabled: true, analysis: withSafeError(record) });
  } catch (error: any) {
    console.error('media/analyze error:', error?.message);
    return res.status(500).json({ error: 'Analiz yapılamadı' });
  }
});
