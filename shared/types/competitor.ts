import { Timestamp } from 'firebase/firestore';

// ============================================
// RAKIP IZLEME TIPLERi
// ============================================

export type CompetitorStatus = 'active' | 'paused' | 'archived';
export type MonitorFrequency = 'daily' | 'weekly' | 'monthly';

export interface Competitor {
  id: string;
  projectId?: string;
  name: string;
  website?: string;
  sector?: string;
  platforms: string[]; // which platforms to monitor
  status: CompetitorStatus;
  frequency: MonitorFrequency;
  lastAnalyzedAt?: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
}

export interface CompetitorAnalysis {
  id: string;
  competitorId: string;
  competitorName: string;
  projectId?: string;
  analyzedAt: Timestamp;
  // AI analysis results
  adStrategySummary: string;
  estimatedMonthlySpend?: string;
  primaryPlatforms: string[];
  targetAudience: string;
  messagingThemes: string[];
  creativeApproach: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[]; // for our client
  threats: string[]; // from this competitor
  adExamples: CompetitorAdExample[];
  recommendations: string[];
  overallThreatLevel: 'low' | 'medium' | 'high';
  confidence: number; // 0-1
}

export interface CompetitorAdExample {
  platform: string;
  type: 'image' | 'video' | 'carousel' | 'text';
  headline?: string;
  description?: string;
  cta?: string;
  estimatedEngagement: 'low' | 'medium' | 'high';
  notes: string;
}

export interface CreateCompetitorData {
  projectId?: string;
  name: string;
  website?: string;
  sector?: string;
  platforms: string[];
  frequency: MonitorFrequency;
}

// Turkish labels
export const COMPETITOR_STATUS_LABELS: Record<CompetitorStatus, string> = {
  active: 'Aktif',
  paused: 'Duraklatildi',
  archived: 'Arsivlendi',
};

export const COMPETITOR_STATUS_COLORS: Record<CompetitorStatus, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-amber-100 text-amber-700',
  archived: 'bg-neutral-100 text-neutral-500',
};

export const MONITOR_FREQUENCY_LABELS: Record<MonitorFrequency, string> = {
  daily: 'Gunluk',
  weekly: 'Haftalik',
  monthly: 'Aylik',
};

export const THREAT_LEVEL_LABELS: Record<string, string> = {
  low: 'Dusuk',
  medium: 'Orta',
  high: 'Yuksek',
};

export const THREAT_LEVEL_COLORS: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};
