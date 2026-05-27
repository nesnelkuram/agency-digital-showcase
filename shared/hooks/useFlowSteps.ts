/**
 * useFlowSteps — bir SOP parent'ı altındaki TÜM child task'ları çeker
 * (tamamlanan + iptal edilen dahil). useUnifiedTasks'tan farklı —
 * çünkü o sadece aktif statüleri çekiyor; flow görselinde geçmiş adımları
 * silik görmek istiyoruz.
 */
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Task } from '@/shared/types/task';

export function useFlowSteps(tenantId: string, parentTaskId: string | null | undefined): Task[] {
  const [steps, setSteps] = useState<Task[]>([]);

  useEffect(() => {
    if (!db || !tenantId || !parentTaskId) {
      setSteps([]);
      return;
    }
    const q = query(
      collection(db, 'tasks'),
      where('tenantId', '==', tenantId),
      where('parentTaskId', '==', parentTaskId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Task[];
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setSteps(list);
    });
    return () => unsub();
  }, [tenantId, parentTaskId]);

  return steps;
}
