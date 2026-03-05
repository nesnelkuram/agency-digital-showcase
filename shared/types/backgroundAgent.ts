/**
 * Background Agent — Persistent autonomous agents that run on schedule
 *
 * Extends automation rules concept into full agent lifecycle management.
 */

export type BackgroundAgentStatus = 'active' | 'paused' | 'error' | 'completed';

export type AgentScheduleType = 'cron' | 'interval' | 'event_triggered';

export interface AgentSchedule {
  type: AgentScheduleType;
  cronExpression?: string;      // e.g. '0 9 * * 1' (Mon 9am)
  intervalMinutes?: number;     // e.g. 60 = every hour
  triggerEvent?: string;        // EventBus event name
  timezone?: string;            // e.g. 'Europe/Istanbul'
  nextRunAt?: number;           // Computed next execution time
  lastRunAt?: number;
}

export interface AgentBudget {
  maxRunsPerDay: number;
  maxRunsPerMonth: number;
  maxCostPerRun?: number;       // In platform currency (e.g. TL cents)
  currentDailyRuns: number;
  currentMonthlyRuns: number;
  lastResetDate: string;        // YYYY-MM-DD
}

export interface AgentExecution {
  id?: string;
  agentId: string;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  result?: Record<string, unknown>;
  error?: string;
  toolsUsed: string[];
  tokenCount?: number;
}

export interface BackgroundAgent {
  id?: string;
  tenantId: string;
  name: string;
  description: string;
  agentType: 'monitor' | 'optimizer' | 'reporter' | 'custom';
  status: BackgroundAgentStatus;

  // What the agent does
  systemPrompt: string;
  tools: string[];              // Allowed tool names from toolHandlers
  maxToolCalls: number;         // Max tools per execution (safety limit)

  // When it runs
  schedule: AgentSchedule;

  // Guardrails
  budget: AgentBudget;
  requiresApproval: boolean;    // If true, actions go to approval queue
  notifyOnComplete: boolean;
  notifyOnError: boolean;

  // State
  lastExecutionId?: string;
  consecutiveErrors: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================
// UI Labels
// ============================================

export const AGENT_TYPE_LABELS: Record<BackgroundAgent['agentType'], string> = {
  monitor: 'İzleyici',
  optimizer: 'Optimizasyon',
  reporter: 'Raporlama',
  custom: 'Özel',
};

export const AGENT_STATUS_LABELS: Record<BackgroundAgentStatus, string> = {
  active: 'Aktif',
  paused: 'Duraklatıldı',
  error: 'Hata',
  completed: 'Tamamlandı',
};

export const AGENT_STATUS_COLORS: Record<BackgroundAgentStatus, string> = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-800',
};

export const SCHEDULE_TYPE_LABELS: Record<AgentScheduleType, string> = {
  cron: 'Cron İfadesi',
  interval: 'Periyodik',
  event_triggered: 'Olay Tetikli',
};
