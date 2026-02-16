import { useTenantContext } from '@/contexts/TenantContext';

export function useTenant() {
  return useTenantContext();
}

export function useTenantId(): string {
  const { tenantId, activeTenantId, isSuperAdmin } = useTenantContext();
  const effectiveId = isSuperAdmin ? (activeTenantId || tenantId) : tenantId;
  return effectiveId || 'default';
}
