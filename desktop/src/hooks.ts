import { useEffect, useRef, useState } from "react";
import { AppUser, Task } from "./types";
import { subscribeSubtasks, subscribeTasks, watchAuth } from "./tasks";

// ── Auth ────────────────────────────────────────────────────────────────
export function useAuthUser(): { user: AppUser | null; ready: boolean } {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unsub = watchAuth((u) => {
      setUser(u);
      setReady(true);
    });
    return unsub;
  }, []);
  return { user, ready };
}

// ── Aktif görevler ─────────────────────────────────────────────────────
export function useTasks(tenantId: string | undefined): {
  tasks: Task[];
  error: string | null;
} {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!tenantId) return;
    const unsub = subscribeTasks(
      tenantId,
      setTasks,
      (e) => setError(e.message)
    );
    return unsub;
  }, [tenantId]);
  return { tasks, error };
}

// ── Alt görevler ────────────────────────────────────────────────────────
export function useSubtasks(
  tenantId: string | undefined,
  parentTaskId: string | undefined,
  enabled: boolean
): Task[] {
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  useEffect(() => {
    if (!enabled || !tenantId || !parentTaskId) {
      setSubtasks([]);
      return;
    }
    const unsub = subscribeSubtasks(tenantId, parentTaskId, setSubtasks);
    return unsub;
  }, [tenantId, parentTaskId, enabled]);
  return subtasks;
}

// ── Canlı saniye sayacı (in_progress görev varken her saniye tetikler) ──
export function useTick(active: boolean): number {
  const [, setN] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      ref.current += 1;
      setN(ref.current);
    }, 1000);
    return () => clearInterval(id);
  }, [active]);
  return ref.current;
}
