import { useState, useEffect } from 'react';
import { useTenantId } from '@/shared/hooks/useTenant';
import { subscribeToInvoices } from '@/shared/services/invoiceService';
import type { Invoice } from '@/shared/types/invoice';

interface UseInvoicesReturn {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
}

export function useInvoices(): UseInvoicesReturn {
  const tenantId = useTenantId();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    // Defer — React 18 StrictMode double-mount (useTasks ile aynı pattern)
    let cancelled = false;
    let unsubFn: (() => void) | undefined;

    const timer = setTimeout(() => {
      if (cancelled) return;
      unsubFn = subscribeToInvoices(
        tenantId,
        (data) => {
          setInvoices(data);
          setLoading(false);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        }
      );
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubFn?.();
    };
  }, [tenantId]);

  return { invoices, loading, error };
}
