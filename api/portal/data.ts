import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { loadUserActor, serializeForClient } from '../_lib/contentApprovalServer.js';
import {
  userCanAccessPlan,
  CLIENT_VISIBLE_PLAN_STATUSES,
  CLIENT_VISIBLE_POST_STATUSES,
  INTERNAL_ROLES,
} from '../../shared/approval/approvalEngine';

/**
 * Müşteri portalı verisi — projeler, içerik planları ve post'lar tek yerden, sunucuda filtrelenmiş.
 * Müşteri rolü bu koleksiyonları Firestore'dan doğrudan okumaz (kurallar kapalı); görünürlük burada uygulanır:
 * - Plan: tenant + (atanmış proje | plana uid/e-posta ile atanmış) + müşteriye açık durum
 * - Post: yalnızca müşteriye açık durumlar (revizyondaki içerik ekipte düzenlenir, gösterilmez)
 * İç roller (portal önizlemesi) tenant içindeki tüm verileri aynı filtrelerle görür.
 *
 * GET ?planId=... (opsiyonel: tek plan)
 */
const PROJECT_FIELDS = ['name', 'status', 'clientName', 'clientId', 'startDate', 'endDate', 'createdAt', 'updatedAt', 'description'];
const PLAN_FIELDS = [
  'tenantId', 'projectId', 'title', 'description', 'platform', 'postIds', 'weekStartDate', 'weekEndDate', 'status',
  'shareToken', 'approvedByName', 'approvedAt', 'approvalConfig', 'postApprovalSummary', 'assignedClientId',
  'assignedClientName', 'assignedClientEmail', 'reviewRequestId', 'sentToClientAt', 'createdAt', 'updatedAt', 'createdByName',
];
const POST_FIELDS = [
  'projectId', 'title', 'caption', 'hashtags', 'mediaUrls', 'media', 'postType', 'platforms', 'status', 'contentPlanId',
  'gridPosition', 'scheduledAt', 'publishedAt', 'approvedBy', 'approvedByName', 'approvedAt', 'revisionCount',
  'tags', 'createdAt', 'updatedAt',
];

function pick(data: any, fields: string[]) {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (data?.[f] !== undefined) out[f] = data[f];
  return out;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const actor = await loadUserActor(req);
    if (actor.role !== 'client' && !INTERNAL_ROLES.has(actor.role)) {
      return res.status(403).json({ error: 'Portal erişiminiz yok' });
    }
    const db = getAdminDb();
    const onlyPlanId = typeof req.query.planId === 'string' ? req.query.planId : '';

    // ── Planlar ──
    const planDocs = new Map<string, any>();
    if (onlyPlanId) {
      const d = await db.collection('content_plans').doc(onlyPlanId).get();
      if (d.exists) planDocs.set(d.id, d.data());
    } else if (actor.role === 'client') {
      const queries = [
        ...chunk(actor.assignedProjectIds, 30).map((ids) =>
          db.collection('content_plans').where('tenantId', '==', actor.tenantId).where('projectId', 'in', ids).get()
        ),
        db.collection('content_plans').where('tenantId', '==', actor.tenantId).where('assignedClientId', '==', actor.uid).get(),
        ...(actor.email
          ? [db.collection('content_plans').where('tenantId', '==', actor.tenantId).where('assignedClientEmail', '==', actor.email).get()]
          : []),
      ];
      for (const snap of await Promise.all(queries)) for (const d of snap.docs) planDocs.set(d.id, d.data());
    } else {
      const snap = await db.collection('content_plans').where('tenantId', '==', actor.tenantId).get();
      for (const d of snap.docs) planDocs.set(d.id, d.data());
    }

    const plans = Array.from(planDocs.entries())
      .filter(([, p]) => CLIENT_VISIBLE_PLAN_STATUSES.has(p.status))
      .filter(([id, p]) =>
        userCanAccessPlan(actor, {
          tenantId: p.tenantId,
          projectId: p.projectId,
          assignedClientId: p.assignedClientId,
          assignedClientEmail: p.assignedClientEmail,
        }) && (!onlyPlanId || id === onlyPlanId)
      )
      .map(([id, p]) => ({ id, ...pick(p, PLAN_FIELDS) })) as Array<Record<string, any>>;

    if (onlyPlanId && plans.length === 0) return res.status(404).json({ error: 'Plan bulunamadı veya erişim yetkiniz yok' });

    // ── Post'lar (yalnızca görünür planlara bağlı ve müşteriye açık durumdakiler) ──
    const posts: Array<Record<string, any>> = [];
    await Promise.all(
      plans.map(async (plan) => {
        const byId = new Map<string, any>();
        const linked = await db.collection('social_media_posts').where('contentPlanId', '==', plan.id).get();
        for (const d of linked.docs) byId.set(d.id, d.data());
        const legacy = (plan.postIds || []).filter((id: unknown) => typeof id === 'string' && !byId.has(id as string));
        if (legacy.length > 0) {
          const docs = await db.getAll(...legacy.map((id: string) => db.collection('social_media_posts').doc(id)));
          for (const d of docs) if (d.exists) byId.set(d.id, d.data());
        }
        for (const [id, p] of byId) {
          if (p.projectId !== plan.projectId) continue;
          if (p.tenantId && p.tenantId !== plan.tenantId) continue;
          if (p.contentPlanId && p.contentPlanId !== plan.id) continue;
          if (!CLIENT_VISIBLE_POST_STATUSES.has(p.status)) continue;
          // Revizyon notu yalnızca müşteriden geldiği kesinse (iç not asla)
          const note = p.lastRevisionCommentSource === 'client' && p.lastRevisionComment ? { lastRevisionComment: p.lastRevisionComment } : {};
          // Eski kayıtlarda contentPlanId olmayabilir (plan.postIds bağı) — hangi plana ait olduğu açık dönsün
          posts.push({ id, ...pick(p, POST_FIELDS), ...note, contentPlanId: plan.id });
        }
      })
    );

    // ── Projeler (atanmış + görünür planların projeleri) ──
    const projectIds = Array.from(new Set([...(actor.role === 'client' ? actor.assignedProjectIds : []), ...plans.map((p) => p.projectId)])).filter(
      (id): id is string => typeof id === 'string' && id.length > 0
    );
    const projects: Array<Record<string, any>> = [];
    if (projectIds.length > 0) {
      const docs = await db.getAll(...projectIds.map((id) => db.collection('projects').doc(id)));
      for (const d of docs) {
        if (!d.exists) continue;
        const data = d.data();
        if (data.tenantId !== actor.tenantId) continue;
        projects.push({ id: d.id, ...pick(data, PROJECT_FIELDS) });
      }
    }

    return res.status(200).json(serializeForClient({ projects, plans, posts }));
  } catch (error: any) {
    console.error('portal/data error:', error);
    return res.status(500).json({ error: 'Portal verisi yüklenemedi' });
  }
});
