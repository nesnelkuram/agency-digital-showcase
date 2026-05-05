import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useTenant } from './useTenant';

export interface ActiveProjectOption {
  id: string;
  name: string;
  clientName?: string;
  clientCompany?: string;
}

/**
 * Real-time list of non-archived projects (status in active/paused).
 * Used for category/brand selectors on tasks.
 */
export function useActiveProjects(): {
  projects: ActiveProjectOption[];
  loading: boolean;
} {
  const { tenantId } = useTenant();
  const [projects, setProjects] = useState<ActiveProjectOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId || !db) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'projects'),
      where('tenantId', '==', tenantId),
      where('status', 'in', ['active', 'paused'])
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ActiveProjectOption[] = snap.docs.map((d) => {
          const v = d.data();
          return {
            id: d.id,
            name: v.name || 'İsimsiz Proje',
            clientName: v.clientName,
            clientCompany: v.clientCompany,
          };
        });
        list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
        setProjects(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [tenantId]);

  return { projects, loading };
}
