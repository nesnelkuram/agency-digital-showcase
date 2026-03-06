import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getRoleConfig,
  saveRoleConfig,
  TenantRoleConfig,
  RoleMenuConfig,
} from '@/shared/services/roleConfigService';
import { ROLES } from '@/lib/rbac/roles';

export function useRoleConfig() {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const [config, setConfig] = useState<TenantRoleConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setLoading(true);
    getRoleConfig(tenantId).then((data) => {
      if (!cancelled) {
        setConfig(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [tenantId]);

  const save = useCallback(
    async (roles: Record<string, RoleMenuConfig>) => {
      if (!tenantId || !user?.uid) return;
      await saveRoleConfig(tenantId, roles, user.uid);
      setConfig({ tenantId, roles, updatedBy: user.uid });
    },
    [tenantId, user?.uid]
  );

  /** Get permissions for a role — Firestore override or hardcoded default */
  const getRolePermissions = useCallback(
    (role: string): string[] => {
      if (config?.roles?.[role]?.permissions) {
        return config.roles[role].permissions;
      }
      return ROLES[role]?.permissions ?? [];
    },
    [config]
  );

  /** Check if a menu path is visible for a role */
  const isMenuVisible = useCallback(
    (role: string, path: string): boolean => {
      if (config?.roles?.[role]?.hiddenMenuPaths) {
        return !config.roles[role].hiddenMenuPaths.includes(path);
      }
      return true; // visible by default if no config
    },
    [config]
  );

  return { config, loading, save, getRolePermissions, isMenuVisible };
}
