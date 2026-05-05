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

// ─── Task Category ───────────────────────────────────────────────────────────
// 'brand'    → markalarımız (her marka = bir Project, projectId ile bağlı)
// 'admin'    → idari işler (faturalandırma, ekip yönetimi, ofis vb.)
// 'personal' → kişisel işler (özel notlar, kişisel takvim)
export type TaskCategory = 'brand' | 'admin' | 'personal';
export type CategorySource = 'ai' | 'manual';

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

  // Category (markalarımız / idari / kişisel)
  category?: TaskCategory;
  categorySource?: CategorySource;
  categoryConfidence?: number;     // 0–1 (sadece AI atamalarında)

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

  // Reminder configuration
  reminderConfig?: {
    enabled: boolean;
    intervalMinutes: number;       // e.g. 60, 120, 240
    lastRemindedAt?: number;       // Date.now() epoch
    nextReminderAt?: number;       // Date.now() epoch
    channels: ('telegram' | 'email')[];
  };

  // Delegation AI scoring
  delegationScore?: number;        // 0–100
  delegationRationale?: string;
  delegationBlockers?: string[];

  // Source channel
  source?: 'web' | 'telegram' | 'intake' | 'workflow';
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
  projectId?: string;
  projectName?: string;
  clientName?: string;
  category?: TaskCategory;
  categorySource?: CategorySource;

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

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  brand: 'Markalarımız',
  admin: 'İdari İşler',
  personal: 'Kişisel İşler',
};

export const TASK_CATEGORY_COLORS: Record<TaskCategory, { dot: string; bg: string; text: string; border: string }> = {
  brand:    { dot: 'bg-indigo-500',  bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  admin:    { dot: 'bg-slate-500',   bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200' },
  personal: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
};
