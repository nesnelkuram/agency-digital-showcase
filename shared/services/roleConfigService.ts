import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export interface RoleMenuConfig {
  /** Menu paths that are HIDDEN for this role */
  hiddenMenuPaths: string[];
  /** Permission strings this role has */
  permissions: string[];
}

export interface TenantRoleConfig {
  tenantId: string;
  roles: Record<string, RoleMenuConfig>;
  updatedAt?: any;
  updatedBy?: string;
}

const COLLECTION = 'role_configs';

export async function getRoleConfig(tenantId: string): Promise<TenantRoleConfig | null> {
  if (!db || !tenantId) return null;
  try {
    const snap = await getDoc(doc(db, COLLECTION, tenantId));
    if (!snap.exists()) return null;
    return snap.data() as TenantRoleConfig;
  } catch {
    return null;
  }
}

export async function saveRoleConfig(
  tenantId: string,
  roles: Record<string, RoleMenuConfig>,
  userId: string
): Promise<void> {
  if (!db || !tenantId) return;
  await setDoc(doc(db, COLLECTION, tenantId), {
    tenantId,
    roles,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}
