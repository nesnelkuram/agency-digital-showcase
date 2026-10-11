import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { planSuggestState } from '../_lib/integrations/config.js';
import { checkLibraryAccess } from '../_lib/integrations/libraryAccess.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';
import { getMediaSourcePolicy } from '../_lib/contentApprovalServer.js';
import { resolveHistorySettings, suggestWeeklyPlan, PLAN_POST_TYPES, type PlanPostType } from '../_lib/planSuggest/planSuggest.js';
import { anthropicPlanCall } from '../_lib/planSuggest/anthropicPlanCall.js';
import { resolveStudioTimeZone } from '../../shared/time/zonedTime.js';

/**
 * POST { projectId, weekStart: 'YYYY-MM-DD', count, postTypes?, history?: { lookbackDays, repeatGapDays, countPending } }
 *   → doğrulanmış TASLAK önerisi. Öneri kümesi yalnız ret sebebinin güvenilir referansı için saklanır (plan değildir).
 * İnsan, öneriyi mevcut Studio akışında draft post olarak ekler; plan oluşturma/onay/yayın mevcut akışta.
 * Varsayılan KAPALI (PLAN_AI_SUGGEST_ENABLED). Erişim: kütüphane rol sınırı (müşteri/freelancer hariç).
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { projectId, weekStart, count, postTypes, history } = req.body || {};
  if (typeof weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return res.status(400).json({ error: 'weekStart geçersiz' });
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > 14) return res.status(400).json({ error: 'count 1-14 olmalı' });
  const historySettings = resolveHistorySettings(history);
  if (!historySettings) return res.status(400).json({ error: 'Geçmiş ayarları geçersiz (geriye bakış 7-180, tekrar aralığı 0-90 gün)' });
  const types: PlanPostType[] | undefined = Array.isArray(postTypes) ? postTypes.filter((t: unknown): t is PlanPostType => (PLAN_POST_TYPES as readonly unknown[]).includes(t)) : undefined;
  try {
    const db = getAdminDb();
    const access = await checkLibraryAccess(db, req.userId, projectId);
    if (!access.ok) return res.status(access.httpStatus).json({ error: access.error });
    const feature = planSuggestState();
    if (!feature.enabled) return res.status(503).json({ error: feature.reason, code: 'feature_disabled' });
    if (!applyRateLimit(res, req.userUid, LIMITS.AI_ANALYSIS)) return;
    const tenant = await db.collection('tenants').doc(req.tenantId).get();
    const { timeZone } = resolveStudioTimeZone(tenant.exists ? tenant.data()?.settings?.timezone : undefined);
    const result = await suggestWeeklyPlan(
      db,
      { callModel: anthropicPlanCall(), policy: getMediaSourcePolicy() },
      { tenantId: req.tenantId, projectId, weekStart, timeZone, count: n, postTypes: types, history: historySettings, createdBy: req.userId }
    );
    return res.status(200).json({ ...result, timeZone, draftOnly: true });
  } catch (error: any) {
    if (error?.status === 400) return res.status(400).json({ error: error.message });
    console.error('studio/plan-suggest error:', error?.message);
    return res.status(500).json({ error: 'Plan önerisi üretilemedi' });
  }
});
