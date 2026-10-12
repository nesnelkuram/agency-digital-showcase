import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { copySuggestState } from '../_lib/integrations/config.js';
import { checkLibraryAccess } from '../_lib/integrations/libraryAccess.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';
import { getMediaSourcePolicy } from '../_lib/contentApprovalServer.js';
import { validateCreativeRequest } from '../../shared/planner/creativeContract.js';
import { CopyError } from '../_lib/planCopy/planCopy.js';
import { openrouterCopyCall } from '../_lib/planCopy/openrouterCopyCall.js';
import { runCreative, resolveCreativeModels } from '../_lib/creative/creative.js';
import { CREATIVE_SCHEMAS } from '../_lib/creative/schemas.js';

/**
 * POST { role: 'ideas' | 'caption' | 'check', projectId, mediaId, crop, intent?, tempTone?, recent?, refresh?, idea?, caption?, evidenceDigest? }
 *   → TEK rol çıktısı (taslak; yayın/yazım yok). Her rol ayrı açık kullanıcı eylemidir; caption/check SEÇİLMİŞ fikir olmadan 400 döner.
 * Model çağrısı YALNIZ OpenRouter (OPENROUTER_API_KEY, sunucuda). Varsayılan KAPALI (PLAN_COPY_AI_ENABLED). Şablon fallback YOK.
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const parsed = validateCreativeRequest(req.body);
  if (!parsed.ok) return res.status(400).json({ error: 'İstek geçersiz', code: 'bad_request', details: parsed.errors.slice(0, 10) });
  try {
    const db = getAdminDb();
    const access = await checkLibraryAccess(db, req.userId, parsed.req.projectId);
    if (!access.ok) return res.status(access.httpStatus).json({ error: access.error });
    const feature = copySuggestState();
    if (!feature.enabled) return res.status(503).json({ error: feature.reason, code: 'feature_disabled' });
    if (!applyRateLimit(res, req.userUid, LIMITS.AI_CAPTION)) return;
    const models = resolveCreativeModels();
    if (!models.ok) return res.status(503).json({ error: models.reason, code: 'feature_disabled' });
    const result = await runCreative(
      db,
      { callModel: (role) => openrouterCopyCall({ schema: CREATIVE_SCHEMAS[role].schema, schemaName: CREATIVE_SCHEMAS[role].name, maxTokens: CREATIVE_SCHEMAS[role].maxTokens }), policy: getMediaSourcePolicy(), models: models.models },
      { tenantId: req.tenantId, projectId: parsed.req.projectId, uid: req.userUid, req: parsed.req }
    );
    return res.status(200).json(result);
  } catch (error: any) {
    if (error instanceof CopyError) return res.status(error.status).json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) });
    console.error('studio/plan-creative error:', error?.message);
    return res.status(500).json({ error: 'Üretilemedi', code: 'internal' });
  }
});
