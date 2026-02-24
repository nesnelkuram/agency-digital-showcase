import type { Timestamp } from 'firebase/firestore';

// ─── Task Status ─────────────────────────────────────────────────────────────
export type TaskStatus =
  | 'open'
  | 'in_progress'
  | 'awaiting_review'
  | 'blocked'
  | 'completed'
  | 'cancelled';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskRiskLevel = 'none' | 'low' | 'medium' | 'high';

// ─── Main Task Document (Firestore: `tasks`) ─────────────────────────────────
export interface Task {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;

  // AI scoring
  aiPriorityScore: number;       // 0–100
  aiScoreRationale?: string;
  aiRiskLevel: TaskRiskLevel;
  aiRiskFlags?: string[];

  // Assignment
  assigneeId?: string;
  assigneeName?: string;
  assigneeRole?: string;

  // Suggested delegation (AI)
  suggestedAssigneeId?: string;
  suggestedAssigneeName?: string;
  suggestedAssigneeRole?: string;
  delegationApproved?: boolean;
  delegationApprovedBy?: string;

  // Project / client context
  projectId?: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;

  // Time
  dueDate?: Timestamp;
  estimatedHours?: number;

  // Misc
  tags?: string[];
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  intakeSessionId?: string;

  // AI analysis state
  aiAnalyzed?: boolean;   // false = analysis pending, true = done
}

// ─── UnifiedTaskItem — client-only, aggregated view ──────────────────────────
export interface UnifiedTaskItem {
  source: 'standalone' | 'workflow_step';
  id: string;          // taskId or `instanceId::nodeId`
  title: string;
  status: string;
  dueDate?: Date;
  aiPriorityScore: number;
  aiRiskLevel: TaskRiskLevel;
  aiRiskFlags?: string[];
  assigneeId?: string;
  assigneeName?: string;
  projectName?: string;
  clientName?: string;

  // Standalone fields
  task?: Task;

  // Workflow step fields
  instanceId?: string;
  nodeId?: string;
  templateName?: string;
  isAiTask?: boolean;
}

// ─── TaskIntakeSession (Firestore: `task_intake_sessions`) ───────────────────
export interface IntakeMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface TaskIntakeSession {
  id: string;
  tenantId: string;
  createdBy: string;
  status: 'in_progress' | 'complete' | 'abandoned';
  messages: IntakeMessage[];
  taskDraft?: Partial<Task>;
  createdTaskId?: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Label / color maps ───────────────────────────────────────────────────────
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Açık',
  in_progress: 'Devam Ediyor',
  awaiting_review: 'İnceleme Bekliyor',
  blocked: 'Engellendi',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: 'Kritik',
  high: 'Yüksek',
  medium: 'Orta',
  low: 'Düşük',
};

export const TASK_RISK_LABELS: Record<TaskRiskLevel, string> = {
  none: 'Risk Yok',
  low: 'Düşük Risk',
  medium: 'Orta Risk',
  high: 'Yüksek Risk',
};
