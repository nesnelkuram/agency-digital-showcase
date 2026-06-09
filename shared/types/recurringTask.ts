import type { Timestamp } from 'firebase/firestore';
import type { TaskCategory, TaskPriority } from './task';

// ─── Recurring Task Template (Firestore: `recurring_tasks`) ──────────────────
// Periyodik olarak `tasks` koleksiyonuna yeni bir Task spawn eden şablon.
// Workflow'daki recurringConfig deseninin görev karşılığı.
export interface RecurringTaskSchedule {
  cronExpression: string;            // 5-alanlı cron (ör. '0 9 * * 1-5')
  timezone: string;                  // 'Europe/Istanbul'
  enabled: boolean;                  // bu şablon aktif mi
  nextRunAt?: Timestamp | number;    // sıradaki çalışma (epoch ms / Timestamp)
  lastRunAt?: Timestamp | number;    // son spawn anı
  lastSpawnedTaskId?: string;        // en son üretilen görev id
}

export interface RecurringTaskTemplate {
  id: string;
  tenantId: string;

  // ── Blueprint: bu alanlar spawn edilen Task'a kopyalanır ──
  title: string;
  description?: string;
  category?: TaskCategory;           // brand / admin / personal
  priority: TaskPriority;
  estimatedMinutes?: number;
  tags?: string[];

  // Atama (opsiyonel) — spawn edilen görev bu kişiye düşer
  assigneeId?: string;
  assigneeName?: string;
  assigneeRole?: string;

  // Proje/müşteri bağlamı (opsiyonel)
  projectId?: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;

  // Spawn edilen görevin deadline'ı = spawn anı + bu kadar saat (opsiyonel)
  dueOffsetHours?: number;

  // ── Zamanlama ──
  schedule: RecurringTaskSchedule;

  // ── Defter ──
  spawnCount?: number;               // şimdiye dek kaç görev üretildi
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
