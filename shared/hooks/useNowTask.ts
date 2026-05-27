/**
 * useNowTask — ŞİMDİ system Phase 1.
 *
 * Picks the single "now" task from the unified backlog using a simple
 * scoring heuristic. Phase 2 will move this to an API endpoint with
 * Gemini-based theme-day + time-of-day awareness.
 *
 * Phase 1 algorithm (deliberately simple, fully client-side):
 *   1. Filter to standalone tasks assigned to user (skip workflow steps for now)
 *   2. Hide blocked/completed/cancelled
 *   3. Sort by: aiPriorityScore DESC, dueDate ASC
 *   4. Apply skipCount penalty: subtract skipCount * 10 from effective score
 *   5. Take top 1 = now, top 2-4 = next
 *
 * Real-time via useUnifiedTasks subscription. Re-derives on every task change.
 */
import { useMemo } from 'react';
import { useUnifiedTasks } from './useUnifiedTasks';
import { getTodayTheme, matchesTheme } from '@/shared/utils/dayTheme';
import type { UnifiedTaskItem } from '@/shared/types/task';

export interface UseNowTaskOptions {
  pinnedId?: string | null;         // tıkla→getir: bu task'ı frog yap (varsa)
  scope?: 'mine' | 'all';           // admin tüm görevleri, diğerleri sadece kendine atananları
}

export interface UseNowTaskReturn {
  now: UnifiedTaskItem | null;
  next: UnifiedTaskItem[];          // up to 3 candidates after `now`
  wipUsed: number;                  // count of in_progress tasks
  totalActive: number;              // count of all active tasks (sanity / inbox indicator)
  // SOP flow context — if `now` is a child of a parent task
  parentFlow: UnifiedTaskItem | null;
  flowSteps: UnifiedTaskItem[];     // tüm kardeşler, sortOrder sıralı (completed dahil)
  loading: boolean;
  error: string | null;
}

// Eisenhower quadrant → score adjustment. Q4 (önemsiz + acil değil) frog'a alınmaz.
const QUADRANT_BOOST: Record<'q1' | 'q2' | 'q3' | 'q4', number> = {
  q1: 20,
  q2: 5,
  q3: -10,
  q4: -30,
};

function effectiveScore(item: UnifiedTaskItem, themeBoost: number): number {
  // Kullanıcı manuel sıraladıysa onun manualOrder'ı taban olur (skoru ezer)
  if (typeof item.task?.manualOrder === 'number') {
    return item.task.manualOrder;
  }
  const base = item.aiPriorityScore ?? 50;
  const skipPenalty = (item.task?.skipCount ?? 0) * 10;
  const q = item.task?.eisenhowerQuadrant;
  const quadrantBoost = q ? QUADRANT_BOOST[q] : 0;
  const flagBoost = item.task?.flagged ? 50 : 0;
  return base - skipPenalty + quadrantBoost + themeBoost + flagBoost;
}

export function useNowTask(options: UseNowTaskOptions = {}): UseNowTaskReturn {
  const { pinnedId, scope = 'mine' } = options;
  const { items, loading, error } = useUnifiedTasks({ mode: scope });

  return useMemo(() => {
    // Standalone only for Phase 1 — workflow steps need their own handling later.
    // Parent task'lar (subTaskCount > 0) frog değil — onların child'ları sırayla gelir.
    const eligible = items.filter((it) => {
      if (it.source !== 'standalone') return false;
      if (it.status === 'blocked') return false;
      const t = it.task;
      if (t && typeof t.subTaskCount === 'number' && t.subTaskCount > 0) return false;
      // Q4 = ne acil ne önemli — frog'a alma, backlog'da kalsın
      if (t?.eisenhowerQuadrant === 'q4') return false;
      // Snoozed tasks (Faz 3 — "sonra" dedik) — geçici olarak gizle
      if (t?.snoozedUntil && t.snoozedUntil.toMillis() > Date.now()) return false;
      return true;
    });

    const wipUsed = eligible.filter((it) => it.status === 'in_progress').length;

    // Bugünün teması — eşleşen görevlere +10 boost (Faz 6)
    const theme = getTodayTheme();
    const themeBoostFor = (it: UnifiedTaskItem) =>
      matchesTheme(theme, it.projectName, it.task?.tags) ? 10 : 0;

    // Sort by effective score; sortOrder tie-breaker keeps SOP adımlarını sıralı
    const sorted = [...eligible].sort((a, b) => {
      const scoreDiff = effectiveScore(b, themeBoostFor(b)) - effectiveScore(a, themeBoostFor(a));
      if (scoreDiff !== 0) return scoreDiff;
      const orderA = a.task?.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.task?.sortOrder ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });

    // Pin (kullanıcı Kanban'dan tıkladı) > in_progress > paused > en yüksek skor
    const pinned = pinnedId ? sorted.find((it) => it.id === pinnedId) : null;
    const inProgress = sorted.find((it) => it.status === 'in_progress');
    const paused = sorted.find((it) => it.status === 'paused');
    const now = pinned ?? inProgress ?? paused ?? sorted[0] ?? null;
    const next = sorted.filter((it) => it.id !== now?.id).slice(0, 3);

    // SOP flow context — eğer now bir parent'a aitse parent ve siblings'i bul
    let parentFlow: UnifiedTaskItem | null = null;
    let flowSteps: UnifiedTaskItem[] = [];
    const parentId = now?.task?.parentTaskId;
    if (parentId) {
      // Parent items'tan bulunur (parent'lar eligible'da filtrelendi ama hâlâ items içinde)
      parentFlow = items.find((it) => it.id === parentId) || null;
      flowSteps = items
        .filter((it) => it.source === 'standalone' && it.task?.parentTaskId === parentId)
        .sort((a, b) => {
          const oA = a.task?.sortOrder ?? Number.MAX_SAFE_INTEGER;
          const oB = b.task?.sortOrder ?? Number.MAX_SAFE_INTEGER;
          return oA - oB;
        });
    }

    return {
      now,
      next,
      wipUsed,
      totalActive: eligible.length,
      parentFlow,
      flowSteps,
      loading,
      error,
    };
  }, [items, loading, error, pinnedId]);
}
