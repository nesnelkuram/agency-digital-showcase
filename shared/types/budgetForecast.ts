import { Timestamp } from 'firebase/firestore';

// ============================================
// BUTCE TAHMIN DURUMLARI
// ============================================

export type ForecastStatus = 'current' | 'warning' | 'critical' | 'depleted';

export const FORECAST_STATUS_LABELS: Record<ForecastStatus, string> = {
  current: 'Normal',
  warning: 'Uyari',
  critical: 'Kritik',
  depleted: 'Tukenmis',
};

export const FORECAST_STATUS_COLORS: Record<ForecastStatus, string> = {
  current: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
  depleted: 'bg-neutral-100 text-neutral-500',
};

// ============================================
// BUTCE TAHMINI
// ============================================

export interface BudgetForecast {
  id: string;
  campaignId: string;
  campaignName: string;
  projectId?: string;
  totalBudget: number;
  spentToDate: number;
  remainingBudget: number;
  dailySpendRate: number;            // Ortalama gunluk harcama
  projectedDepletionDate: string;    // ISO tarih
  daysRemaining: number;
  scheduledEndDate?: string;
  status: ForecastStatus;            // current = normal, warning = <7 gun, critical = <3 gun, depleted = 0
  burndownData: Array<{
    date: string;
    projected: number;
    actual?: number;
  }>;
  recommendations: string[];
  confidence: number;                // 0-1
  createdAt: Timestamp;
}

// ============================================
// BUTCE TAHMIN OZETI
// ============================================

export interface BudgetForecastSummary {
  totalBudgetAllCampaigns: number;
  totalSpentAllCampaigns: number;
  campaignsAtRisk: number;           // warning + critical
  campaignsDepleted: number;
  averageBurnRate: number;           // Gunluk yuzde olarak
}
