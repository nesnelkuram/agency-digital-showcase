// Ana repodaki shared/types/task.ts'in companion için ihtiyaç duyulan alt kümesi.
// Firestore'dan okunan alanlar; Timestamp'ler epoch ms'e çevrilir.

export type TaskStatus =
  | "open"
  | "in_progress"
  | "paused"
  | "awaiting_review"
  | "blocked"
  | "completed"
  | "cancelled";

export type TaskPriority = "critical" | "high" | "medium" | "low";

// Companion'ın dürtme/listeleme için takip ettiği aktif statüler.
export const ACTIVE_STATUSES: TaskStatus[] = [
  "open",
  "in_progress",
  "paused",
  "awaiting_review",
  "blocked",
];

export interface TaskNote {
  id: string;
  text: string;
  authorName?: string;
  createdAt?: number;
}

export interface Task {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: TaskPriority;

  aiPriorityScore?: number; // 0–100
  aiScoreRationale?: string;
  aiRiskLevel?: string;
  flagged?: boolean;
  eisenhowerQuadrant?: "q1" | "q2" | "q3" | "q4";
  category?: string;

  projectName?: string;
  clientName?: string;
  assigneeName?: string;

  dueDateMs?: number;
  estimatedHours?: number;
  tags?: string[];
  notes?: TaskNote[];

  // hiyerarşi
  parentTaskId?: string;
  subTaskCount?: number;
  sortOrder?: number;

  // ── sayaç / çalışma takibi (nowService ile birebir) ──
  startedAtMs?: number;
  pausedAtMs?: number;
  autoPaused?: boolean;
  accumulatedSeconds?: number;
  actualMinutesSpent?: number;

  reminderEnabled?: boolean; // reminderConfig.enabled !== false
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  tenantId: string;
}

// ── etiketler ────────────────────────────────────────────────────────────
export const STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Açık",
  in_progress: "Devam ediyor",
  paused: "Duraklatıldı",
  awaiting_review: "İncelemede",
  blocked: "Engellendi",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: "Kritik",
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
};

export const QUADRANT_LABELS: Record<"q1" | "q2" | "q3" | "q4", string> = {
  q1: "Acil + Önemli",
  q2: "Önemli, acil değil",
  q3: "Acil, önemsiz",
  q4: "Ne acil ne önemli",
};
