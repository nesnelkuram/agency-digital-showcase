/**
 * useChronicallySkipped — sürekli atlanan görevleri ayrı bir kuyruğa al.
 * Kullanıcı 3+ kez atladıysa demek ki yapmayacak; karar talep et.
 */
import { useMemo } from 'react';
import { useUnifiedTasks } from './useUnifiedTasks';
import type { Task, UnifiedTaskItem } from '@/shared/types/task';

const MIN_SKIPS = 3;

export interface UseChronicallySkippedReturn {
  items: UnifiedTaskItem[];
  count: number;
}

export function useChronicallySkipped(scope: 'mine' | 'all' = 'mine'): UseChronicallySkippedReturn {
  const { items } = useUnifiedTasks({ mode: scope });

  return useMemo(() => {
    const filtered = items.filter((it) => {
      if (it.source !== 'standalone') return false;
      const t = it.task as Task | undefined;
      if (!t) return false;
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      if ((t.skipCount ?? 0) < MIN_SKIPS) return false;
      // Snooze altındaysa bant'ta gösterme — kullanıcı zaten karar vermiş
      if (t.snoozedUntil && t.snoozedUntil.toMillis() > Date.now()) return false;
      return true;
    });
    return { items: filtered, count: filtered.length };
  }, [items]);
}
