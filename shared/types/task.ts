import type { Timestamp } from 'firebase/firestore';

// ─── Task Status ─────────────────────────────────────────────────────────────
export type TaskStatus =
  | 'draft'            // taslak — plana eklendi ama henüz aktif değil; akışta/kanban'da görünmez
  | 'open'
  | 'in_progress'
  | 'paused'
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

// ─── Work Session — tek bir çalışma segmenti (gün-gün döküm için) ─────────────
// Her BAŞLA→DURAKLAT/BİTTİ arası kapanan segment buraya eklenir.
// `seconds` boşta (idle) geçen süre çıkarılmış net çalışma süresidir.
export interface WorkSession {
  startedAt: number;   // segment başlangıcı (epoch ms)
  endedAt: number;     // segment bitişi (epoch ms)
  seconds: number;     // net sayılan saniye (idle trim'lenmiş)
  auto?: boolean;      // true = segment otomatik (idle) duraklatma ile kapandı
}

// ─── Task Note — zaman damgalı serbest not (görev günlüğü) ───────────────────
// Her not ayrı bir giriş: kim yazdı + ne zaman. Görevde birden fazla kişi
// çalışabildiği için yorum/günlük gibi alt alta birikir.
export interface TaskNote {
  id: string;            // crypto-based kısa id
  text: string;
  authorId: string;
  authorName: string;
  createdAt: number;     // epoch ms
  updatedAt?: number;    // düzenlendiyse epoch ms
}

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

  // Kullanıcı işaretleri
  flagged?: boolean;             // 🚩 kırmızı bayrak (kullanıcı manuel önemli işaretledi)
  manualOrder?: number;          // sütun içinde drag-reorder pozisyonu (boş = AI skoru kullan)

  // Eisenhower quadrant (UI'da gösterilmez — frog seçim mantığında kullanılır)
  // q1=acil+önemli, q2=önemli/acil değil, q3=acil/önemsiz, q4=hiçbiri
  eisenhowerQuadrant?: 'q1' | 'q2' | 'q3' | 'q4';

  // Assignment
  assigneeId?: string;
  assigneeName?: string;
  assigneeRole?: string;

  // Birden fazla kişi çalışıyorsa (görsel avatar stack için)
  collaboratorIds?: string[];
  // Denormalized cache — Firestore round-trip atlamak için
  collaborators?: Array<{ id: string; name: string; avatarUrl?: string }>;

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
  source?: 'web' | 'telegram' | 'intake' | 'workflow' | 'recurring';

  // Periyodik görev kaynağı (recurring_tasks şablonundan üretildiyse)
  recurringTemplateId?: string;

  // ŞİMDİ system (Phase 1) — execution telemetry
  startedAt?: Timestamp;             // en son DEVAM ettirildiği an (resume noktası)
  startedBy?: string;                // user.uid
  startedByName?: string;            // user.displayName/email
  pausedAt?: Timestamp;              // duraklatıldığı an (varsa = şu an paused)
  autoPaused?: boolean;              // true = bilgisayardan uzaklaşınca otomatik duraklatıldı (devam önerisi göster)
  accumulatedSeconds?: number;       // önceki çalışma segmentlerinden biriken toplam
  workSessions?: WorkSession[];      // her kapanan segment — gün-gün çalışma dökümü için
  completedAt?: Timestamp;           // when user pressed BİTTİ
  completedBy?: string;
  completedByName?: string;
  actualMinutesSpent?: number;       // computed total (yuvarlanmış dakika)
  actualSecondsSpent?: number;       // hassas saniye log
  skipCount?: number;                // how many times ATLA was pressed
  lastSkipReason?: 'blocked' | 'wrong_time' | 'not_mine' | 'dont_want';
  lastSkippedAt?: Timestamp;

  // Sub-task / SOP breakdown (Phase 2)
  parentTaskId?: string;             // bu görev başka bir görevin alt-adımıysa parent'ı
  sortOrder?: number;                // kardeşler arasında sıra (0, 1, 2…)
  subTaskCount?: number;             // bu görev parent ise alt-görev sayısı; 0/undef = leaf
  estimatedMinutes?: number;         // AI'nın tahmini süre (SOP adımları için)
  derivedFromSopId?: string;         // hangi SOP kalıbından türetildi
  derivedFromSopName?: string;       // chip'te göstermek için
  linkedTrainingResourceId?: string; // bu adım için eğitim videosu (training_resources/id)

  // Snooze — sürekli atlanan görevler için "sonra" kararı
  snoozedUntil?: Timestamp;

  // Notlar — zaman damgalı serbest not akışı (görev günlüğü)
  notes?: TaskNote[];
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
  draft: 'Taslak',
  open: 'Açık',
  in_progress: 'Devam Ediyor',
  paused: 'Duraklatıldı',
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
