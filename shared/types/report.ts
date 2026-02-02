import { Timestamp } from 'firebase/firestore';

// ============================================
// RAPOR TIPLERi
// ============================================

export type ReportType = 'weekly' | 'monthly' | 'quarterly' | 'custom';
export type ReportStatus = 'generating' | 'ready' | 'failed' | 'expired';
export type ReportFormat = 'pdf' | 'csv' | 'json';

export interface ReportDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface ReportSection {
  id: string;
  title: string;
  included: boolean;
}

export const DEFAULT_REPORT_SECTIONS: ReportSection[] = [
  { id: 'executive_summary', title: 'Yonetici Ozeti', included: true },
  { id: 'campaign_performance', title: 'Kampanya Performansi', included: true },
  { id: 'platform_breakdown', title: 'Platform Bazli Analiz', included: true },
  { id: 'budget_analysis', title: 'Butce Analizi', included: true },
  { id: 'audience_insights', title: 'Hedef Kitle Analizleri', included: true },
  { id: 'recommendations', title: 'AI Onerileri', included: true },
  { id: 'competitor_overview', title: 'Rakip Ozeti', included: false },
];

export interface MarketingReport {
  id: string;
  projectId?: string;
  title: string;
  type: ReportType;
  status: ReportStatus;
  format: ReportFormat;
  dateRange: ReportDateRange;
  sections: ReportSection[];
  // Generated content
  summary?: string;
  highlights?: string[];
  kpis?: ReportKPI[];
  campaignResults?: ReportCampaignResult[];
  platformBreakdown?: ReportPlatformBreakdown[];
  recommendations?: string[];
  // Metadata
  generatedBy: string;
  generatedByName: string;
  fileUrl?: string; // URL to generated PDF/CSV
  fileSize?: number;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  expiresAt?: Timestamp;
}

export interface ReportKPI {
  label: string;
  value: number;
  previousValue?: number;
  change?: number; // percentage
  unit: string; // 'TL', '%', '', 'x'
}

export interface ReportCampaignResult {
  campaignId: string;
  campaignName: string;
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpa: number;
  roas: number;
}

export interface ReportPlatformBreakdown {
  platform: string;
  spend: number;
  spendPercentage: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpa: number;
}

export interface CreateReportData {
  projectId?: string;
  title: string;
  type: ReportType;
  format: ReportFormat;
  dateRange: ReportDateRange;
  sections: ReportSection[];
  campaignIds?: string[]; // specific campaigns, or all if empty
}

export interface ReportSummary {
  id: string;
  title: string;
  type: ReportType;
  status: ReportStatus;
  format: ReportFormat;
  dateRange: ReportDateRange;
  createdAt: Timestamp;
}

// Turkish labels
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  weekly: 'Haftalik',
  monthly: 'Aylik',
  quarterly: 'Ceyreklik',
  custom: 'Ozel Tarih',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  generating: 'Hazirlaniyor',
  ready: 'Hazir',
  failed: 'Basarisiz',
  expired: 'Suresi Dolmus',
};

export const REPORT_STATUS_COLORS: Record<ReportStatus, string> = {
  generating: 'bg-amber-100 text-amber-700',
  ready: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  expired: 'bg-neutral-100 text-neutral-500',
};

export const REPORT_FORMAT_LABELS: Record<ReportFormat, string> = {
  pdf: 'PDF',
  csv: 'CSV',
  json: 'JSON',
};
