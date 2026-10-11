/**
 * Marka medya kütüphanesi rol sınırı — sunucu tarafı (storage.rules canUseBrandLibrary ile aynı küme).
 * Genel checkProjectAccess müşteri/freelancer'ı da kapsayabildiği için Canva ve AI medya uçları bunu kullanır.
 *  - aynı tenant
 *  - rol: super_admin | admin | account_manager | staff | editor, ya da projeye ATANMIŞ brand_manager
 *  - proje var ve aynı tenant'a ait
 * Bağlantı/klasör eşleme gibi yönetim işlemleri ayrıca admin | super_admin ister.
 */

export const LIBRARY_ROLES = new Set(['super_admin', 'admin', 'account_manager', 'staff', 'editor']);
export const INTEGRATION_ADMIN_ROLES = new Set(['super_admin', 'admin']);

export interface AccessSubject {
  tenantId: string;
  role: string;
  assignedProjectIds?: unknown;
}

export type AccessResult = { ok: true } | { ok: false; httpStatus: 400 | 403 | 404; error: string };

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Saf karar fonksiyonu (test edilebilir) */
export function decideLibraryAccess(
  user: AccessSubject | null,
  projectId: unknown,
  project: { tenantId?: unknown } | null,
  opts: { adminOnly?: boolean } = {}
): AccessResult {
  if (typeof projectId !== 'string' || !SAFE_ID.test(projectId)) return { ok: false, httpStatus: 400, error: 'projectId geçersiz' };
  if (!user || !user.tenantId) return { ok: false, httpStatus: 403, error: 'Erişim reddedildi' };
  if (!project) return { ok: false, httpStatus: 404, error: 'Proje bulunamadı' };
  if (project.tenantId !== user.tenantId) return { ok: false, httpStatus: 403, error: 'Erişim reddedildi' };
  if (opts.adminOnly) {
    return INTEGRATION_ADMIN_ROLES.has(user.role) ? { ok: true } : { ok: false, httpStatus: 403, error: 'Bu işlem yalnız yöneticiye açık' };
  }
  if (LIBRARY_ROLES.has(user.role)) return { ok: true };
  if (user.role === 'brand_manager') {
    const assigned = Array.isArray(user.assignedProjectIds) ? user.assignedProjectIds : [];
    if (assigned.includes(projectId)) return { ok: true };
  }
  return { ok: false, httpStatus: 403, error: 'Bu markanın medya kütüphanesine erişim yetkiniz yok' };
}

/** Firestore'dan kullanıcı + proje okuyup karar verir (Admin SDK) */
export async function checkLibraryAccess(
  db: { collection: (name: string) => any },
  uid: string,
  projectId: unknown,
  opts: { adminOnly?: boolean } = {}
): Promise<AccessResult> {
  if (typeof projectId !== 'string' || !SAFE_ID.test(projectId)) return { ok: false, httpStatus: 400, error: 'projectId geçersiz' };
  const [userSnap, projectSnap] = await Promise.all([db.collection('users').doc(uid).get(), db.collection('projects').doc(projectId).get()]);
  const u = userSnap.exists ? userSnap.data() : null;
  const user: AccessSubject | null = u
    ? { tenantId: u.tenantId, role: u.role, assignedProjectIds: u.profile?.assignedProjectIds }
    : null;
  return decideLibraryAccess(user, projectId, projectSnap.exists ? projectSnap.data() : null, opts);
}
