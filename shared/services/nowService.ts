/**
 * nowService — ŞİMDİ system status transitions.
 *
 * Wraps taskService.updateTask with the side-effects needed by Phase 1:
 *   - startTask:    status → in_progress, startedAt = now
 *   - completeTask: status → completed,   completedAt = now, actualMinutesSpent computed
 *   - skipTask:     skipCount++,          lastSkipReason, lastSkippedAt = now
 *
 * Phase 2 will add: isTodayHighlight reset, AI re-score signal, theme day metrics.
 */
import { Timestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { updateTask, getTask } from './taskService';
import type { Task } from '@/shared/types/task';

export type SkipReason = NonNullable<Task['lastSkipReason']>;

export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  blocked: 'Engellendi',
  wrong_time: 'Yanlış zaman',
  not_mine: 'Benim değil',
  dont_want: 'İstemiyorum',
};

export interface ActorInfo {
  uid: string;
  name: string;                       // displayName veya email
}

// Mevcut accumulated + (running segment varsa) = toplam saniye
function totalSecondsSoFar(existing: Task | null, atMs: number): number {
  if (!existing) return 0;
  const acc = existing.accumulatedSeconds ?? 0;
  // status='in_progress' ise startedAt'ten itibaren ek segment biriksin
  if (existing.status === 'in_progress' && existing.startedAt) {
    const segMs = Math.max(0, atMs - existing.startedAt.toMillis());
    return acc + Math.round(segMs / 1000);
  }
  return acc;
}

// BAŞLA — ilk kez başlat veya devam et
export async function startTask(
  tenantId: string,
  taskId: string,
  actor?: ActorInfo
): Promise<void> {
  const existing = await getTask(tenantId, taskId);
  const now = Timestamp.now();
  // Eğer hiç başlamamışsa accumulated sıfırlanır; paused'tan resume ise korunur
  const isFreshStart = !existing?.startedAt || existing.status === 'open';

  await updateTask(tenantId, taskId, {
    status: 'in_progress',
    startedAt: now,
    pausedAt: undefined,
    accumulatedSeconds: isFreshStart ? 0 : existing?.accumulatedSeconds ?? 0,
    ...(actor?.uid ? { startedBy: actor.uid } : {}),
    ...(actor?.name ? { startedByName: actor.name } : {}),
  });
}

// DURAKLAT — segment'i accumulated'a topla, status=paused
export async function pauseTask(
  tenantId: string,
  taskId: string
): Promise<void> {
  const existing = await getTask(tenantId, taskId);
  if (!existing || existing.status !== 'in_progress') return;
  const now = Timestamp.now();
  const accumulated = totalSecondsSoFar(existing, now.toMillis());

  await updateTask(tenantId, taskId, {
    status: 'paused',
    pausedAt: now,
    accumulatedSeconds: accumulated,
  });
}

export async function completeTask(
  tenantId: string,
  taskId: string,
  actor?: ActorInfo
): Promise<void> {
  const existing = await getTask(tenantId, taskId);
  const now = Timestamp.now();
  const totalSec = totalSecondsSoFar(existing, now.toMillis());

  const actualSecondsSpent = totalSec || undefined;
  const actualMinutesSpent =
    actualSecondsSpent !== undefined ? Math.max(1, Math.round(actualSecondsSpent / 60)) : undefined;

  await updateTask(tenantId, taskId, {
    status: 'completed',
    completedAt: now,
    pausedAt: undefined,
    ...(actor?.uid ? { completedBy: actor.uid } : {}),
    ...(actor?.name ? { completedByName: actor.name } : {}),
    ...(actualMinutesSpent !== undefined ? { actualMinutesSpent } : {}),
    ...(actualSecondsSpent !== undefined ? { actualSecondsSpent } : {}),
  });

  // Eğer bu görev bir SOP child'ıysa: tüm kardeşler bitti mi diye bak,
  // bittilerse parent'ı da tamamla
  if (existing?.parentTaskId && db) {
    try {
      const siblingsSnap = await getDocs(
        query(
          collection(db, 'tasks'),
          where('tenantId', '==', tenantId),
          where('parentTaskId', '==', existing.parentTaskId)
        )
      );
      const allDone = siblingsSnap.docs.every((d) => {
        if (d.id === taskId) return true;
        const s = d.data().status;
        return s === 'completed' || s === 'cancelled';
      });
      if (allDone) {
        await updateTask(tenantId, existing.parentTaskId, {
          status: 'completed',
          completedAt: now,
        });
      }
    } catch (err) {
      console.warn('[nowService] parent auto-complete failed:', err);
    }
  }
}

export async function restoreTask(
  tenantId: string,
  taskId: string
): Promise<void> {
  await updateTask(tenantId, taskId, {
    status: 'open',
    completedAt: undefined,
    completedBy: undefined,
    completedByName: undefined,
  });
}

export async function skipTask(
  tenantId: string,
  taskId: string,
  reason: SkipReason
): Promise<void> {
  const existing = await getTask(tenantId, taskId);
  const prevCount = existing?.skipCount ?? 0;

  await updateTask(tenantId, taskId, {
    skipCount: prevCount + 1,
    lastSkipReason: reason,
    lastSkippedAt: Timestamp.now(),
  });
}
