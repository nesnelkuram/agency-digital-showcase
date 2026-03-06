import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, isAdmin, isStaff, isSuperAdmin } from '@/lib/rbac/guards';
import { Permission } from '@/lib/rbac/permissions';
import { useRoleConfig } from './useRoleConfig';

export function usePermission() {
  const { user } = useAuth();
  const { getRolePermissions } = useRoleConfig();

  // Get dynamic permissions for current user's role (Firestore override or hardcoded default)
  const dynamicPerms = user?.role ? getRolePermissions(user.role) : null;

  return {
    can: (permission: Permission) => hasPermission(user, permission, dynamicPerms),
    canAny: (permissions: Permission[]) => permissions.some((p) => hasPermission(user, p, dynamicPerms)),
    canAll: (permissions: Permission[]) => permissions.every((p) => hasPermission(user, p, dynamicPerms)),
    isAdmin: () => isAdmin(user),
    isStaff: () => isStaff(user),
    isSuperAdmin: () => isSuperAdmin(user),
    role: user?.role ?? null,
  };
}
