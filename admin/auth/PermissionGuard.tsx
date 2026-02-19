import React from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { usePermission } from '@/shared/hooks/usePermission';
import { Permission } from '@/lib/rbac/permissions';

interface PermissionGuardProps {
  /** At least one of these permissions is required */
  permission?: Permission;
  /** Multiple permissions — user needs ALL of them */
  permissions?: Permission[];
  /** Multiple permissions — user needs at least ONE */
  anyPermission?: Permission[];
  /** Roles that are explicitly blocked from this route */
  blockedRoles?: string[];
  /** Where to redirect if access denied. Defaults to /admin */
  redirectTo?: string;
  /** Show an inline "access denied" message instead of redirecting */
  showDenied?: boolean;
  children: React.ReactNode;
}

/**
 * Route-level permission guard.
 * Wraps a route and redirects unauthorized users to /admin (or custom path).
 *
 * Usage:
 * <PermissionGuard permission={PERMISSIONS.PRICING_VIEW_COST}>
 *   <CostEnginePage />
 * </PermissionGuard>
 */
const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  permissions,
  anyPermission,
  blockedRoles,
  redirectTo = '/admin',
  showDenied = false,
  children,
}) => {
  const { can, canAll, canAny, role } = usePermission();

  // Check blocked roles first
  if (blockedRoles && role && blockedRoles.includes(role)) {
    if (showDenied) return <AccessDenied />;
    return <Navigate to={redirectTo} replace />;
  }

  // Single permission check
  if (permission && !can(permission)) {
    if (showDenied) return <AccessDenied />;
    return <Navigate to={redirectTo} replace />;
  }

  // All permissions check
  if (permissions && !canAll(permissions)) {
    if (showDenied) return <AccessDenied />;
    return <Navigate to={redirectTo} replace />;
  }

  // Any permission check
  if (anyPermission && !canAny(anyPermission)) {
    if (showDenied) return <AccessDenied />;
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

const AccessDenied: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-64 gap-4">
    <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center">
      <ShieldOff className="w-7 h-7 text-neutral-400" />
    </div>
    <div className="text-center">
      <p className="font-grotesk font-semibold text-neutral-700">Erişim Yetkiniz Yok</p>
      <p className="font-grotesk text-sm text-neutral-400 mt-1">
        Bu sayfayı görüntülemek için gerekli yetki bulunmuyor.
      </p>
    </div>
  </div>
);

export default PermissionGuard;
