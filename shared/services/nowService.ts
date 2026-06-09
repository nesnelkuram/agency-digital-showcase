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
import type { Task, WorkSession } from '@/shared/types/task';

// Çok uzun süren görevlerde workSessions dizisinin sınırsız büyümesini önle
const MAX_SESSIONS = 300;

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

// Aktif (in_progress) segment'i `asOfMs` anına kadar kapatır.
// Boşta (idle) duraklatmada asOfMs = son aktivite anı olur; aradaki boşluk sayılmaz.
// Aktif segment yoksa null döner.
function closeActiveSegment(
  existing: Task | null,
  asOfMs: number,
  auto: boolean
): { session: WorkSession; accumulated: number } | null {
  if (!existing || existing.status !== 'in_progress' || !existing.startedAt) return null;
  const startMs = existing.startedAt.toMillis();
  const endMs = Math.max(startMs, asOfMs);
  const seconds = Math.round((endMs - startMs) / 1000);
  if (seconds <= 0) return null;
  const session: WorkSession = { startedAt: startMs, endedAt: endMs, seconds };
  if (auto) session.auto = true;
  return { session, accumulated: (existing.accumulatedSeconds ?? 0) + seconds };
}

function appendSession(existing: Task | null, session: WorkSession): WorkSession[] {
  const prev = existing?.workSessions ?? [];
  return [...prev, session].slice(-MAX_SESSIONS);
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
    autoPaused: false,
    accumulatedSeconds: isFreshStart ? 0 : existing?.accumulatedSeconds ?? 0,
    // Taze başlangıçta eski segment geçmişini temizle
    ...(isFreshStart ? { workSessions: [] } : {}),
    ...(actor?.uid ? { startedBy: actor.uid } : {}),
    ...(actor?.name ? { startedByName: actor.name } : {}),
  });
}

// DURAKLAT — aktif segment'i kapat (accumulated + workSessions), status=paused.
// opts.asOfMs : segment'in sayılacağı son an (idle'da = son aktivite anı)
// opts.auto   : true = bilgisayardan uzaklaşma nedeniyle otomatik duraklatma
export async function pauseTask(
  tenantId: string,
  taskId: string,
  opts?: { asOfMs?: number; auto?: boolean }
): Promise<void> {
  const existing = await getTask(tenantId, taskId);
  if (!existing || existing.status !== 'in_progress') return;
  const now = Timestamp.now();
  const auto = opts?.auto ?? false;
  const asOfMs = opts?.asOfMs ?? now.toMillis();
  const seg = closeActiveSegment(existing, asOfMs, auto);

  await updateTask(tenantId, taskId, {
    status: 'paused',
    pausedAt: now,
    autoPaused: auto,
    accumulatedSeconds: seg ? seg.accumulated : existing.accumulatedSeconds ?? 0,
    ...(seg ? { workSessions: appendSession(existing, seg.session) } : {}),
  });
}

export async function completeTask(
  tenantId: string,
  taskId: string,
  actor?: ActorInfo
): Promise<void> {
  const existing = await getTask(tenantId, taskId);
  const now = Timestamp.now();
  // BİTTİ bilinçli bir aksiyon — segment'i şu ana kadar say
  const seg = closeActiveSegment(existing, now.toMillis(), false);
  const totalSec = seg ? seg.accumulated : existing?.accumulatedSeconds ?? 0;

  const actualSecondsSpent = totalSec || undefined;
  const actualMinutesSpent =
    actualSecondsSpent !== undefined ? Math.max(1, Math.round(actualSecondsSpent / 60)) : undefined;

  await updateTask(tenantId, taskId, {
    status: 'completed',
    completedAt: now,
    pausedAt: undefined,
    autoPaused: false,
    accumulatedSeconds: totalSec,
    ...(seg ? { workSessions: appendSession(existing, seg.session) } : {}),
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
