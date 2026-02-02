import type { Timestamp } from 'firebase/firestore';

export type ABTestStatus = 'draft' | 'running' | 'completed' | 'stopped';
export type ABTestType = 'creative' | 'audience' | 'placement' | 'bidding';
export type ABTestMetric = 'ctr' | 'cpc' | 'cpa' | 'roas' | 'conversions';

export interface ABTest {
  id: string;
  projectId?: string;
  campaignId: string;
  campaignName?: string;
  name: string;
  description?: string;
  status: ABTestStatus;
  testType: ABTestType;
  variants: ABTestVariant[];
  winnerId?: string;
  winnerMetric: ABTestMetric;
  confidenceLevel: number; // 0-100
  sampleSize?: number;
  startDate: string;
  endDate?: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  trafficSplit: number; // percentage 0-100
  adIds: string[];
  metrics: ABTestMetrics;
}

export interface ABTestMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export const AB_TEST_STATUS_LABELS: Record<ABTestStatus, string> = {
  draft: 'Taslak',
  running: 'Devam Ediyor',
  completed: 'Tamamlandi',
  stopped: 'Durduruldu',
};

export const AB_TEST_STATUS_COLORS: Record<ABTestStatus, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  stopped: 'bg-neutral-100 text-neutral-500',
};

export const AB_TEST_TYPE_LABELS: Record<ABTestType, string> = {
  creative: 'Kreatif Testi',
  audience: 'Hedef Kitle Testi',
  placement: 'Yerlestirme Testi',
  bidding: 'Teklif Stratejisi Testi',
};

export const AB_TEST_TYPE_COLORS: Record<ABTestType, string> = {
  creative: 'bg-purple-100 text-purple-700',
  audience: 'bg-indigo-100 text-indigo-700',
  placement: 'bg-orange-100 text-orange-700',
  bidding: 'bg-emerald-100 text-emerald-700',
};

export const AB_TEST_METRIC_LABELS: Record<ABTestMetric, string> = {
  ctr: 'CTR',
  cpc: 'CPC',
  cpa: 'CPA',
  roas: 'ROAS',
  conversions: 'Donusum',
};
