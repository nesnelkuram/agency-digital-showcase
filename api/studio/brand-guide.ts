import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { copySuggestState } from '../_lib/integrations/config.js';
import { checkLibraryAccess } from '../_lib/integrations/libraryAccess.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';
import { resolveCopyModel } from '../_lib/planCopy/planCopy.js';
import { openrouterCopyCall } from '../_lib/planCopy/openrouterCopyCall.js';
import { loadGuideState, generateDraft, saveDraftEdit, approveDraft, GuideError, GuideDraftOutputSchema, GUIDE_SCHEMA_NAME } from '../_lib/brandGuide/brandGuide.js';

/**
 * Konuşmayla marka rehberi (YAZI dili; ses/audio değil).
 *   GET  ?projectId                              → { approved, draft, bundleExists, aiEnabled } (kütüphane rol sınırı)
 *   POST { projectId, action:'generate', brief, expectedDraftVersion, idempotencyKey }  → AI TASLAK (OpenRouter; kapalıysa 503)
 *   POST { projectId, action:'save', guide, expectedDraftVersion, idempotencyKey }      → insan düzenlemesi (AI yok)
 *   POST { projectId, action:'approve', confirm:true, expectedDraftVersion, contentKey, expectedApprovedVersion, idempotencyKey } → YALNIZ yönetici
 * AI taslak üretir, ONAYLI rehbere yazamaz. Kapsam (tenant) kimlik doğrulamasından; proje erişimi sunucuda denetlenir.
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const src: any = req.method === 'GET' ? req.query : req.body || {};
  const action = req.method === 'GET' ? 'get' : src.action;
  if (!['get', 'generate', 'save', 'approve'].includes(action)) return res.status(400).json({ error: 'action geçersiz', code: 'bad_request' });
  try {
    const db = getAdminDb();
    const access = await checkLibraryAccess(db, req.userId, src.projectId, { adminOnly: action === 'approve' });
    if (!access.ok) return res.status(access.httpStatus).json({ error: access.error });
    const scope = { tenantId: req.tenantId, projectId: src.projectId as string };
    const now = Date.now();
    if (action === 'get') {
      const st = await loadGuideState(db, scope);
      return res.status(200).json({ ...st, aiEnabled: copySuggestState().enabled });
    }
    if (action === 'generate') {
      const feature = copySuggestState();
      if (!feature.enabled) return res.status(503).json({ error: feature.reason, code: 'feature_disabled' });
      if (!applyRateLimit(res, req.userUid, LIMITS.AI_ANALYSIS)) return;
      const model = resolveCopyModel();
      if (!model.ok) return res.status(503).json({ error: model.reason, code: 'feature_disabled' });
      const r = await generateDraft(db, { callModel: openrouterCopyCall({ schema: GuideDraftOutputSchema, schemaName: GUIDE_SCHEMA_NAME, maxTokens: 3000 }), model: model.model }, { ...scope, uid: req.userUid, brief: src.brief, expectedDraftVersion: src.expectedDraftVersion, idempotencyKey: src.idempotencyKey, now });
      return res.status(200).json({ ...r, draftOnly: true });
    }
    if (action === 'save') {
      const r = await saveDraftEdit(db, { ...scope, uid: req.userUid, guide: src.guide, expectedDraftVersion: src.expectedDraftVersion, idempotencyKey: src.idempotencyKey, now });
      return res.status(200).json(r);
    }
    const r = await approveDraft(db, { ...scope, uid: req.userUid, confirm: src.confirm, expectedDraftVersion: src.expectedDraftVersion, contentKey: src.contentKey, expectedApprovedVersion: src.expectedApprovedVersion === undefined ? null : src.expectedApprovedVersion, idempotencyKey: src.idempotencyKey, now });
    return res.status(200).json(r);
  } catch (error: any) {
    if (error instanceof GuideError) return res.status(error.status).json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) });
    console.error('studio/brand-guide error:', error?.message);
    return res.status(500).json({ error: 'Marka rehberi işlenemedi', code: 'internal' });
  }
});
