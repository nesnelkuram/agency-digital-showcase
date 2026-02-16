import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from './AuthContext';
import { Tenant } from '@/shared/types/tenant';

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  loading: boolean;
  error: string | null;
  isSuperAdmin: boolean;
  switchTenant: (tenantId: string) => Promise<void>;
  activeTenantId: string | null;
}

const TenantContext = createContext<TenantContextType | null>(null);

const TENANT_STORAGE_KEY = 'super_admin_active_tenant';

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(() => {
    return localStorage.getItem(TENANT_STORAGE_KEY);
  });

  const isSuperAdmin = user?.role === 'super_admin';

  const fetchTenant = useCallback(async (id: string): Promise<Tenant | null> => {
    if (!db || !id) return null;
    try {
      const tenantDoc = await getDoc(doc(db, 'tenants', id));
      if (tenantDoc.exists()) {
        return { id: tenantDoc.id, ...tenantDoc.data() } as Tenant;
      }
      return null;
    } catch (err) {
      console.error('Error fetching tenant:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setTenant(null);
      setLoading(false);
      return;
    }

    const loadTenant = async () => {
      setLoading(true);
      setError(null);

      // Determine which tenant to load
      const targetTenantId = isSuperAdmin
        ? activeTenantId || user.tenantId
        : user.tenantId;

      if (!targetTenantId && !isSuperAdmin) {
        setError('Hesabiniz bir organizasyona bagli degil.');
        setLoading(false);
        return;
      }

      if (targetTenantId) {
        const tenantData = await fetchTenant(targetTenantId);
        if (tenantData) {
          if (tenantData.status === 'suspended' && !isSuperAdmin) {
            setError('Organizasyonunuz askiya alinmis.');
            setTenant(null);
          } else {
            setTenant(tenantData);
          }
        } else if (!isSuperAdmin) {
          setError('Organizasyon bulunamadi.');
        }
      }

      setLoading(false);
    };

    loadTenant();
  }, [user, activeTenantId, isSuperAdmin, fetchTenant]);

  const switchTenant = useCallback(async (newTenantId: string) => {
    if (!isSuperAdmin) {
      throw new Error('Only super admins can switch tenants');
    }
    setActiveTenantId(newTenantId);
    localStorage.setItem(TENANT_STORAGE_KEY, newTenantId);
  }, [isSuperAdmin]);

  const effectiveTenantId = isSuperAdmin
    ? activeTenantId || user?.tenantId || null
    : user?.tenantId || null;

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantId: effectiveTenantId,
        loading,
        error,
        isSuperAdmin,
        switchTenant,
        activeTenantId,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenantContext must be used within a TenantProvider');
  }
  return context;
}

export default TenantContext;
