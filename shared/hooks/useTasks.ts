import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import { subscribeToTasks } from '@/shared/services/taskService';
import type { Task } from '@/shared/types/task';

interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
}

export function useTasks(): UseTasksReturn {
  const { user } = useAuth();
  const tenantId = useTenantId();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid || !tenantId) {
      setLoading(false);
      return;
    }

    // Defer to avoid React 18 StrictMode double-mount issues (same pattern as useNotifications)
    let cancelled = false;
    let unsubFn: (() => void) | undefined;

    const timer = setTimeout(() => {
      if (cancelled) return;
      unsubFn = subscribeToTasks(
        tenantId,
        user.uid,
        (data) => {
          setTasks(data);
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
  }, [user?.uid, tenantId]);

  return { tasks, loading, error };
}
