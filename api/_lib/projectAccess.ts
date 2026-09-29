/**
 * Proje erişim kontrolü — sunucu endpoint'leri için.
 * Tenant + rol + (proje kapsamlı rollerde) atanmış proje kontrolü birlikte yapılır.
 */

import { getAdminDb } from './firebaseAdmin.js';
import { loadUserActor } from './contentApprovalServer.js';
import { INTERNAL_ROLES, PROJECT_SCOPED_ROLES, roleHasPermission } from '../../shared/approval/approvalEngine';

export interface ProjectAccessOk {
  ok: true;
  project: Record<string, any>;
}
export interface ProjectAccessDenied {
  ok: false;
  httpStatus: number;
  error: string;
}

export async function checkProjectAccess(
  auth: { userId: string; tenantId: string; userRole: string; userDisplayName?: string },
  projectId: unknown,
  requiredPermission?: string
): Promise<ProjectAccessOk | ProjectAccessDenied> {
  if (typeof projectId !== 'string' || !projectId) {
    return { ok: false, httpStatus: 400, error: 'projectId gerekli' };
  }
  if (requiredPermission && !roleHasPermission(auth.userRole, requiredPermission)) {
    return { ok: false, httpStatus: 403, error: 'Bu işlem için yetkiniz yok' };
  }

  const snap = await getAdminDb().collection('projects').doc(projectId).get();
  if (!snap.exists) return { ok: false, httpStatus: 404, error: 'Proje bulunamadı' };
  const project = snap.data() || {};
  if (!auth.tenantId || project.tenantId !== auth.tenantId) {
    return { ok: false, httpStatus: 403, error: 'Erişim reddedildi' };
  }

  if (INTERNAL_ROLES.has(auth.userRole)) return { ok: true, project };
  if (PROJECT_SCOPED_ROLES.has(auth.userRole)) {
    const actor = await loadUserActor(auth);
    if (actor.assignedProjectIds.includes(projectId)) return { ok: true, project };
  }
  return { ok: false, httpStatus: 403, error: 'Bu projeye erişim yetkiniz yok' };
}
