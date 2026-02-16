import { useAuth } from '@/contexts/AuthContext';
import { hasPermission, hasAnyPermission, hasAllPermissions, isAdmin, isStaff, isSuperAdmin } from '@/lib/rbac/guards';
import { Permission } from '@/lib/rbac/permissions';

export function usePermission() {
  const { user } = useAuth();

  return {
    can: (permission: Permission) => hasPermission(user, permission),
    canAny: (permissions: Permission[]) => hasAnyPermission(user, permissions),
    canAll: (permissions: Permission[]) => hasAllPermissions(user, permissions),
    isAdmin: () => isAdmin(user),
    isStaff: () => isStaff(user),
    isSuperAdmin: () => isSuperAdmin(user),
    role: user?.role ?? null,
  };
}
