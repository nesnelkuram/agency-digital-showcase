import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { copySuggestState } from '../_lib/integrations/config.js';
import { checkLibraryAccess } from '../_lib/integrations/libraryAccess.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';
import { getMediaSourcePolicy } from '../_lib/contentApprovalServer.js';
import { validateCopyRequest } from '../../shared/planner/copyContract.js';
import { generateCopy, CopyError, resolveCopyModel } from '../_lib/planCopy/planCopy.js';
import { openrouterCopyCall } from '../_lib/planCopy/openrouterCopyCall.js';

/**
 * POST { projectId, weekStart, items: [{ slotKey, mediaId, lane, role, seriesKey?, seriesPosition?, seriesSize? }], avoidTexts? }
 *   → doğrulanmış TÜRKÇE metin önerileri (taslak; yazım/onay/yayın yok).
 * Model çağrısı YALNIZ OpenRouter üzerinden (OPENROUTER_API_KEY, sunucuda); Anthropic'e doğrudan çağrı/yedek YOK.
 * Şablon fallback YOK: model/özellik/marka sesi yoksa açık hata. Varsayılan KAPALI (PLAN_COPY_AI_ENABLED).
 * Erişim: kütüphane rol sınırı (müşteri/freelancer hariç). Medya, katalog ve ürün bağlantısı sunucuda yüklenir.
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const parsed = validateCopyRequest(req.body);
  if (!parsed.ok) return res.status(400).json({ error: 'İstek geçersiz', code: 'bad_request', details: parsed.errors.slice(0, 10) });
  try {
    const db = getAdminDb();
    const access = await checkLibraryAccess(db, req.userId, parsed.req.projectId);
    if (!access.ok) return res.status(access.httpStatus).json({ error: access.error });
    const feature = copySuggestState();
    if (!feature.enabled) return res.status(503).json({ error: feature.reason, code: 'feature_disabled' });
    if (!applyRateLimit(res, req.userUid, LIMITS.AI_ANALYSIS)) return;
    const model = resolveCopyModel();
    if (!model.ok) return res.status(503).json({ error: model.reason, code: 'feature_disabled' });
    const result = await generateCopy(db, { callModel: openrouterCopyCall(), policy: getMediaSourcePolicy(), model: model.model }, { tenantId: req.tenantId, projectId: parsed.req.projectId, req: parsed.req, issuedBy: { uid: req.userUid, now: Date.now() } });
    return res.status(200).json({ ...result, draftOnly: true });
  } catch (error: any) {
    if (error instanceof CopyError) return res.status(error.status).json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) });
    console.error('studio/plan-copy error:', error?.message);
    return res.status(500).json({ error: 'Metin üretilemedi', code: 'internal' });
  }
});
