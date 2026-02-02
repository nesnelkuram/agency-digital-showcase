import type { Timestamp } from 'firebase/firestore';

// ============================================
// KURAL METRIK TIPLERI
// ============================================

export type RuleMetric =
  | 'ctr'
  | 'cpc'
  | 'cpa'
  | 'roas'
  | 'spend'
  | 'impressions'
  | 'conversions'
  | 'frequency'
  | 'quality_score';

export type RuleOperator = 'greater_than' | 'less_than' | 'equals' | 'between';

export type RuleActionType =
  | 'pause_adset'
  | 'increase_budget'
  | 'decrease_budget'
  | 'send_alert'
  | 'change_bid'
  | 'pause_campaign';

export type RuleStatus = 'active' | 'paused' | 'archived';

export type RuleFrequency = 'hourly' | 'every_6h' | 'daily' | 'weekly';

// ============================================
// KURAL KOSUL VE AKSIYON
// ============================================

export interface RuleCondition {
  metric: RuleMetric;
  operator: RuleOperator;
  value: number;
  value2?: number; // 'between' operatoru icin
  timeWindow: 'last_24h' | 'last_3d' | 'last_7d' | 'last_30d';
}

export interface RuleAction {
  type: RuleActionType;
  value?: number; // butce/teklif degisikligi yuzde olarak
  notifyEmail?: string;
}

// ============================================
// OTOMASYON KURALI
// ============================================

export interface AutomationRule {
  id: string;
  projectId?: string;
  name: string;
  description?: string;
  campaignIds: string[]; // hangi kampanyalar icin gecerli, bos = tumune uygula
  conditions: RuleCondition[];
  conditionLogic: 'and' | 'or';
  action: RuleAction;
  frequency: RuleFrequency;
  status: RuleStatus;
  lastRunAt?: Timestamp;
  totalExecutions: number;
  totalTriggered: number;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// KURAL CALISTIRMA LOGU
// ============================================

export interface RuleExecutionLog {
  id: string;
  ruleId: string;
  ruleName: string;
  projectId?: string;
  campaignId: string;
  campaignName: string;
  triggered: boolean;
  conditionResults: Array<{
    metric: string;
    actual: number;
    threshold: number;
    passed: boolean;
  }>;
  actionTaken?: string;
  error?: string;
  executedAt: Timestamp;
}

// ============================================
// CRUD TIPLERI
// ============================================

export interface CreateAutomationRuleData {
  projectId?: string;
  name: string;
  description?: string;
  campaignIds: string[];
  conditions: RuleCondition[];
  conditionLogic: 'and' | 'or';
  action: RuleAction;
  frequency: RuleFrequency;
}

export interface UpdateAutomationRuleData {
  name?: string;
  description?: string;
  campaignIds?: string[];
  conditions?: RuleCondition[];
  conditionLogic?: 'and' | 'or';
  action?: RuleAction;
  frequency?: RuleFrequency;
  status?: RuleStatus;
}

// ============================================
// TURKCE ETIKETLER
// ============================================

export const RULE_METRIC_LABELS: Record<RuleMetric, string> = {
  ctr: 'Tiklanma Orani (CTR)',
  cpc: 'Tiklama Basina Maliyet (CPC)',
  cpa: 'Edinim Basina Maliyet (CPA)',
  roas: 'Reklam Harcama Getirisi (ROAS)',
  spend: 'Toplam Harcama',
  impressions: 'Gosterim Sayisi',
  conversions: 'Donusum Sayisi',
  frequency: 'Frekans',
  quality_score: 'Kalite Puani',
};

export const RULE_OPERATOR_LABELS: Record<RuleOperator, string> = {
  greater_than: 'Buyuktur',
  less_than: 'Kucuktur',
  equals: 'Esittir',
  between: 'Arasinda',
};

export const RULE_ACTION_LABELS: Record<RuleActionType, string> = {
  pause_adset: 'Reklam Setini Durdur',
  increase_budget: 'Butceyi Artir',
  decrease_budget: 'Butceyi Azalt',
  send_alert: 'Bildirim Gonder',
  change_bid: 'Teklifi Degistir',
  pause_campaign: 'Kampanyayi Durdur',
};

export const RULE_STATUS_LABELS: Record<RuleStatus, string> = {
  active: 'Aktif',
  paused: 'Duraklatildi',
  archived: 'Arsivlendi',
};

export const RULE_STATUS_COLORS: Record<RuleStatus, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-neutral-100 text-neutral-500',
};

export const RULE_FREQUENCY_LABELS: Record<RuleFrequency, string> = {
  hourly: 'Saatlik',
  every_6h: '6 Saatte Bir',
  daily: 'Gunluk',
  weekly: 'Haftalik',
};

export const RULE_TIME_WINDOW_LABELS: Record<RuleCondition['timeWindow'], string> = {
  last_24h: 'Son 24 Saat',
  last_3d: 'Son 3 Gun',
  last_7d: 'Son 7 Gun',
  last_30d: 'Son 30 Gun',
};

export const CONDITION_LOGIC_LABELS: Record<'and' | 'or', string> = {
  and: 'VE (Tum kosullar saglanmali)',
  or: 'VEYA (En az bir kosul saglanmali)',
};
