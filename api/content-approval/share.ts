import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { findPlanIdByShareToken, serializeForClient } from '../_lib/contentApprovalServer.js';
import { CLIENT_VISIBLE_PLAN_STATUSES, CLIENT_VISIBLE_POST_STATUSES } from '../../shared/approval/approvalEngine';

/**
 * Paylaşım linki ile içerik planı okuma (oturumsuz).
 * Token sunucuda doğrulanır; iç yorumlar ve iç inceleme alanları döndürülmez.
 *
 * GET ?token=...
 */
const PUBLIC_PLAN_FIELDS = [
  'tenantId', 'projectId', 'title', 'description', 'platform', 'postIds', 'weekStartDate', 'weekEndDate',
  'status', 'shareToken', 'approvedByName', 'approvedAt', 'approvalConfig', 'postApprovalSummary',
  'assignedClientName', 'reviewRequestId', 'createdAt', 'updatedAt', 'createdByName',
];

const PUBLIC_POST_FIELDS = [
  'projectId', 'title', 'caption', 'hashtags', 'mediaUrls', 'media', 'postType', 'platforms', 'status',
  'contentPlanId', 'gridPosition', 'scheduledAt', 'publishedAt', 'approvedByName', 'approvedAt',
  'revisionCount', 'tags', 'createdAt', 'updatedAt',
];

function pick(data: any, fields: string[]) {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (data[f] !== undefined) out[f] = data[f];
  return out;
}

/** Yalnızca müşteriden geldiği kesin revizyon notu (kaynağı bilinmeyen eski notlar iç not olabilir) */
function clientRevisionNote(p: any) {
  return p.lastRevisionCommentSource === 'client' && p.lastRevisionComment ? { lastRevisionComment: p.lastRevisionComment } : {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const planId = await findPlanIdByShareToken(token);
    if (!planId) return res.status(404).json({ error: 'İçerik planı bulunamadı' });

    const db = getAdminDb();
    const planDoc = await db.collection('content_plans').doc(planId).get();
    const plan = planDoc.data() || {};

    // Link yalnızca müşteriye açılmış bir tur varken içerik gösterir
    if (!CLIENT_VISIBLE_PLAN_STATUSES.has(plan.status)) {
      return res.status(404).json({ error: 'Bu plan şu anda incelemeye açık değil' });
    }

    // Plana bağlı post'lar (contentPlanId + eski postIds), proje uyumlu olanlar
    const linked = await db.collection('social_media_posts').where('contentPlanId', '==', planId).get();
    const byId = new Map<string, any>();
    for (const d of linked.docs) byId.set(d.id, d.data());
    const legacyIds = (Array.isArray(plan.postIds) ? plan.postIds : []).filter((id: unknown) => typeof id === 'string' && !byId.has(id as string));
    if (legacyIds.length > 0) {
      const docs = await db.getAll(...legacyIds.map((id: string) => db.collection('social_media_posts').doc(id)));
      for (const d of docs) if (d.exists) byId.set(d.id, d.data());
    }
    const posts = Array.from(byId.entries())
      .filter(([, p]) => p.projectId === plan.projectId && (!p.tenantId || p.tenantId === plan.tenantId))
      .filter(([, p]) => !p.contentPlanId || p.contentPlanId === planId)
      .map(([id, p]) => {
        if (CLIENT_VISIBLE_POST_STATUSES.has(p.status)) return { id, ...pick(p, PUBLIC_POST_FIELDS), ...clientRevisionNote(p) };
        // Revizyondaki post: içerik ekipte düzenleniyor olabilir — sadece durum ve müşteri notu
        if (p.status === 'revision_requested') {
          return { id, ...pick(p, ['projectId', 'postType', 'platforms', 'status', 'contentPlanId', 'scheduledAt', 'revisionCount']), ...clientRevisionNote(p), media: [], mediaUrls: [], caption: '', hashtags: [], tags: [], contentHidden: true };
        }
        return null;
      })
      .filter(Boolean);

    const clientComments = (Array.isArray(plan.clientComments) ? plan.clientComments : []).filter(
      (c: any) => !c?.isInternal
    );

    return res.status(200).json(
      serializeForClient({
        plan: { id: planId, ...pick(plan, PUBLIC_PLAN_FIELDS), clientComments },
        posts,
      })
    );
  } catch (error: any) {
    console.error('content-approval/share error:', error);
    return res.status(500).json({ error: 'Plan yüklenemedi' });
  }
}
