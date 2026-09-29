/**
 * Davetten kullanıcı hesabı oluşturma — sunucu tarafı, tek kaynak.
 * Rol, tenant ve proje atamaları yalnızca davet kaydından alınır; istemci bunları belirleyemez.
 */

import { getAdminDb, getFieldValue } from './firebaseAdmin.js';
import { ROLES } from '../../lib/rbac/roles.js';

/** Davet eden rolün davet edebileceği roller */
const INVITABLE_BY: Record<string, string[]> = {
  super_admin: ['admin', 'account_manager', 'editor', 'staff', 'client', 'freelancer', 'brand_manager'],
  admin: ['admin', 'account_manager', 'editor', 'staff', 'client', 'freelancer', 'brand_manager'],
};

export function canInviteRole(inviterRole: string, targetRole: string): boolean {
  return (INVITABLE_BY[inviterRole] || []).includes(targetRole) && !!ROLES[targetRole];
}

export interface ProvisionResult {
  ok: boolean;
  httpStatus: number;
  error?: string;
  role?: string;
  alreadyProvisioned?: boolean;
}

function fail(httpStatus: number, error: string): ProvisionResult {
  return { ok: false, httpStatus, error };
}

const PROFILE_FIELDS = ['phone', 'title', 'department', 'skills', 'hourlyRate', 'hourlyCurrency', 'clientCompany', 'billingEmail', 'managerId'];

/**
 * Daveti tüketip kullanıcı dokümanını oluşturur (idempotent).
 * - Davet bekliyor, iptal/süresi dolmuş değil
 * - Hesabın e-postası davet e-postasıyla aynı
 * - Davet eden hâlâ aynı tenant'ta ve bu rolü davet etmeye yetkili
 * - Atanmış projeler aynı tenant'a ait olanlarla sınırlı
 * Aynı kullanıcı tekrar çağırırsa (yarım kalan akış) başarı döner.
 */
export async function provisionUserFromInvitation(params: {
  invitationId: string;
  uid: string;
  email: string;
  displayName: string;
}): Promise<ProvisionResult> {
  const db = getAdminDb();
  const FieldValue = getFieldValue();
  const { invitationId, uid } = params;
  const email = (params.email || '').trim().toLowerCase();
  const displayName = (params.displayName || '').trim().slice(0, 120);

  if (typeof invitationId !== 'string' || !/^[A-Za-z0-9_-]{10,64}$/.test(invitationId)) {
    return fail(400, 'Geçersiz davet');
  }
  if (!email) return fail(400, 'Hesabın e-postası yok');

  const invRef = db.collection('invitations').doc(invitationId);
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx: any) => {
    const invDoc = await tx.get(invRef);
    if (!invDoc.exists) return fail(404, 'Davet bulunamadı');
    const inv = invDoc.data();

    if ((inv.email || '').toLowerCase() !== email) return fail(403, 'Bu davet başka bir e-posta adresi için');

    const userDoc = await tx.get(userRef);

    // Yarım kalan / tekrar eden çağrı: aynı kullanıcı zaten oluşturulmuş
    if (inv.status === 'accepted') {
      if (inv.acceptedByUid === uid && userDoc.exists && userDoc.data().tenantId === inv.tenantId) {
        return { ok: true, httpStatus: 200, role: inv.role, alreadyProvisioned: true };
      }
      return fail(409, 'Bu davet zaten kullanılmış');
    }
    if (inv.status !== 'pending') return fail(410, 'Bu davet iptal edilmiş');
    const expiresAt = inv.expiresAt?.toDate?.();
    if (expiresAt && expiresAt < new Date()) return fail(410, 'Bu davetin süresi dolmuş');

    if (userDoc.exists) return fail(409, 'Bu hesap zaten bir kullanıcıya bağlı');

    // Davet eden: aynı tenant'ta, aktif ve bu rolü davet etmeye yetkili
    const inviterDoc = inv.invitedBy ? await tx.get(db.collection('users').doc(inv.invitedBy)) : null;
    const inviter = inviterDoc?.exists ? inviterDoc.data() : null;
    if (!inviter || inviter.status === 'suspended') return fail(403, 'Davet geçersiz (davet eden bulunamadı)');
    if (inviter.role !== 'super_admin' && inviter.tenantId !== inv.tenantId) return fail(403, 'Davet geçersiz');
    if (!canInviteRole(inviter.role, inv.role)) return fail(403, 'Davet geçersiz (rol yetkisi yok)');

    // Proje atamaları: yalnızca aynı tenant'taki projeler
    const extras = inv.extraFields || {};
    const requestedProjects: string[] = Array.isArray(extras.assignedProjectIds)
      ? extras.assignedProjectIds.filter((x: unknown) => typeof x === 'string' && x)
      : [];
    const projectDocs = requestedProjects.length > 0
      ? await tx.getAll(...requestedProjects.map((id) => db.collection('projects').doc(id)))
      : [];
    const assignedProjectIds = projectDocs.filter((d: any) => d.exists && d.data().tenantId === inv.tenantId).map((d: any) => d.id);

    const profile: Record<string, unknown> = {};
    for (const key of PROFILE_FIELDS) {
      if (extras[key] !== undefined && extras[key] !== '') profile[key] = extras[key];
    }
    if (assignedProjectIds.length > 0) profile.assignedProjectIds = assignedProjectIds;

    const now = new Date();
    tx.set(userRef, {
      email,
      displayName: displayName || inv.displayName || email,
      role: inv.role,
      tenantId: inv.tenantId,
      permissions: ROLES[inv.role]?.permissions || [],
      status: 'active',
      metadata: { createdAt: now, updatedAt: now, invitedBy: inv.invitedBy || null },
      profile,
      settings: { notifications: { email: true, push: true, approvalReminders: true } },
    });
    tx.update(invRef, { status: 'accepted', acceptedAt: now, acceptedByUid: uid });

    const member = { uid, name: displayName || inv.displayName || email, role: inv.role };
    for (const projectId of assignedProjectIds) {
      tx.update(db.collection('projects').doc(projectId), {
        teamMembers: FieldValue.arrayUnion(member),
        updatedAt: now,
      });
    }

    return { ok: true, httpStatus: 200, role: inv.role };
  });
}
