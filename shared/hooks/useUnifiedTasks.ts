import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant, useTenantId } from '@/shared/hooks/useTenant';
import { subscribeToTasks, subscribeToAllTasks } from '@/shared/services/taskService';
import { getInstancesByAssignee } from '@/shared/services/workflowInstanceService';
import type { Task, UnifiedTaskItem, TaskRiskLevel } from '@/shared/types/task';
import type { WorkflowInstance, StepInstance } from '@/shared/types/workflow/instance';

// ─── Priority score derivation for workflow steps ─────────────────────────────
function deriveStepPriorityScore(step: StepInstance, instance: WorkflowInstance): number {
  let score = 50;

  // Deadline proximity
  if (step.dueDate) {
    const msLeft = step.dueDate.toDate().getTime() - Date.now();
    const daysLeft = msLeft / (1000 * 60 * 60 * 24);
    if (daysLeft <= 1) score += 40;
    else if (daysLeft <= 3) score += 25;
    else if (daysLeft <= 7) score += 10;
  }

  // Revision needed — urgent
  if (step.status === 'revision_needed') score += 15;

  // Blocked — flag
  if (step.status === 'blocked') score += 10;

  // Client-facing projects get a bump (detect by projectName containing "client" or "müşteri")
  const name = (instance.projectName || '').toLowerCase();
  if (name.includes('client') || name.includes('müşteri')) score += 15;

  return Math.min(100, score);
}

function deriveStepRiskLevel(score: number): TaskRiskLevel {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'none';
}

// ─── Normalize a workflow StepInstance to UnifiedTaskItem ─────────────────────
function normalizeStep(
  instance: WorkflowInstance,
  nodeId: string,
  step: StepInstance,
  userId: string
): UnifiedTaskItem | null {
  if (!step.assignment?.userId || step.assignment.userId !== userId) return null;

  const activeStatuses: StepInstance['status'][] = [
    'ready', 'in_progress', 'ai_processing', 'ai_review',
    'awaiting_review', 'revision_needed', 'blocked',
  ];
  if (!activeStatuses.includes(step.status)) return null;

  const score = deriveStepPriorityScore(step, instance);

  return {
    source: 'workflow_step',
    id: `${instance.id}::${nodeId}`,
    title: step.label || nodeId,
    status: step.status,
    dueDate: step.dueDate ? step.dueDate.toDate() : undefined,
    aiPriorityScore: score,
    aiRiskLevel: deriveStepRiskLevel(score),
    assigneeId: step.assignment?.userId,
    assigneeName: step.assignment?.userName,
    projectName: instance.projectName,
    instanceId: instance.id,
    nodeId,
    templateName: instance.templateName,
    isAiTask: Array.isArray(step.aiExecutions) && step.aiExecutions.length > 0,
  };
}

// ─── Normalize a standalone Task to UnifiedTaskItem ───────────────────────────
function normalizeTask(task: Task): UnifiedTaskItem {
  return {
    source: 'standalone',
    id: task.id,
    title: task.title,
    status: task.status,
    dueDate: task.dueDate ? task.dueDate.toDate() : undefined,
    aiPriorityScore: task.aiPriorityScore,
    aiRiskLevel: task.aiRiskLevel,
    aiRiskFlags: task.aiRiskFlags,
    assigneeId: task.assigneeId,
    assigneeName: task.assigneeName,
    projectId: task.projectId,
    projectName: task.projectName,
    clientName: task.clientName,
    category: task.category,
    categorySource: task.categorySource,
    task,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
interface UseUnifiedTasksReturn {
  items: UnifiedTaskItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

interface UseUnifiedTasksOptions {
  /** 'all' = all tenant tasks (manager/admin view), 'mine' = only assigned to current user (default) */
  mode?: 'all' | 'mine';
}

export function useUnifiedTasks(options: UseUnifiedTasksOptions = {}): UseUnifiedTasksReturn {
  const { mode = 'mine' } = options;
  const { user } = useAuth();
  const { tenantId: rawTenantId } = useTenant(); // can be null while loading
  const tenantId = useTenantId();                // 'default' fallback — only use for actual queries

  const [standaloneTasks, setStandaloneTasks] = useState<Task[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingSteps, setLoadingSteps] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Subscribe to standalone tasks
  useEffect(() => {
    // rawTenantId is null while TenantContext is loading — don't query with 'default' fallback
    if (!rawTenantId) {
      setLoadingTasks(false);
      return;
    }
    if (mode === 'mine' && !user?.uid) {
      setLoadingTasks(false);
      return;
    }

    let cancelled = false;
    let unsubFn: (() => void) | undefined;

    const timer = setTimeout(() => {
      if (cancelled) return;
      if (mode === 'all') {
        unsubFn = subscribeToAllTasks(
          tenantId,
          (data) => {
            setStandaloneTasks(data);
            setLoadingTasks(false);
          },
          () => setLoadingTasks(false)
        );
      } else {
        unsubFn = subscribeToTasks(
          tenantId,
          user!.uid,
          (data) => {
            setStandaloneTasks(data);
            setLoadingTasks(false);
          },
          () => setLoadingTasks(false)
        );
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubFn?.();
    };
  }, [user?.uid, rawTenantId, mode]);

  // Fetch workflow instances (one-time, refreshable)
  useEffect(() => {
    if (!user?.uid || !rawTenantId) {
      setLoadingSteps(false);
      return;
    }

    setLoadingSteps(true);
    getInstancesByAssignee(tenantId, user.uid)
      .then(setInstances)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingSteps(false));
  }, [user?.uid, rawTenantId, refreshKey]);

  // Aggregate and sort
  const items: UnifiedTaskItem[] = [];

  // Add standalone tasks
  standaloneTasks.forEach((t) => items.push(normalizeTask(t)));

  // Add workflow steps
  if (user?.uid) {
    instances.forEach((instance) => {
      Object.entries(instance.steps || {}).forEach(([nodeId, step]) => {
        const item = normalizeStep(instance, nodeId, step as StepInstance, user.uid!);
        if (item) items.push(item);
      });
    });
  }

  // Sort: aiPriorityScore DESC, then dueDate ASC
  items.sort((a, b) => {
    if (b.aiPriorityScore !== a.aiPriorityScore) {
      return b.aiPriorityScore - a.aiPriorityScore;
    }
    if (a.dueDate && b.dueDate) {
      return a.dueDate.getTime() - b.dueDate.getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  return {
    items,
    loading: loadingTasks || loadingSteps,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}
