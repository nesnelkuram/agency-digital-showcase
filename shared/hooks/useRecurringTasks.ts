/**
 * useRecurringTasks — periyodik görev şablonlarının canlı listesi.
 */
import { useEffect, useState } from 'react';
import { useTenantId } from './useTenant';
import { subscribeToRecurringTasks } from '@/shared/services/recurringTaskService';
import type { RecurringTaskTemplate } from '@/shared/types/recurringTask';

export function useRecurringTasks() {
  const tenantId = useTenantId();
  const [items, setItems] = useState<RecurringTaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    const unsub = subscribeToRecurringTasks(
      tenantId,
      (list) => {
        setItems(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [tenantId]);

  return { items, loading, error };
}
