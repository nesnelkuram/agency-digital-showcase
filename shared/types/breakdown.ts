import { Timestamp } from 'firebase/firestore';

// ============================================
// KIRILIM TIPLERI (Meta Ads Breakdown)
// ============================================

export type BreakdownType = 'age_gender' | 'device' | 'placement' | 'region';

export const BREAKDOWN_LABELS: Record<BreakdownType, string> = {
  age_gender: 'Yas & Cinsiyet',
  device: 'Cihaz',
  placement: 'Yerlesim',
  region: 'Bolge',
};

export interface BreakdownRow {
  // Dimension fields (vary by breakdown type)
  age?: string;                    // e.g. "18-24", "25-34"
  gender?: string;                 // "male", "female", "unknown"
  devicePlatform?: string;         // "mobile", "desktop", "tablet"
  publisherPlatform?: string;      // "facebook", "instagram", "audience_network"
  platformPosition?: string;       // "feed", "stories", "reels", "right_column"
  region?: string;                 // e.g. "Istanbul", "Ankara"

  // Metric fields
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  reach: number;
}

export interface CampaignBreakdown {
  id: string;
  campaignId: string;
  metaCampaignId: string;
  breakdownType: BreakdownType;
  dateRange: { start: string; end: string };
  data: BreakdownRow[];
  fetchedAt: Timestamp;
}

// ============================================
// AI KAMPANYA ANALIZ TIPLERI
// ============================================

export type AIAnalysisType = 'setup_analysis' | 'optimization_recommendations';

export interface SetupCategory {
  category: string;                // e.g. "targeting", "budget", "creatives"
  score: number;                   // 0-100
  status: 'good' | 'warning' | 'critical';
  findings: string[];
  recommendations: string[];
}

export interface OptimizationRecommendation {
  type: string;                    // e.g. "budget_realloc", "targeting_refine"
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  currentValue: string;
  suggestedValue: string;
  expectedImprovement: string;
  confidence: number;              // 0-1
}

export interface CampaignAIAnalysis {
  id: string;
  campaignId: string;
  type: AIAnalysisType;

  // Setup analysis fields
  setupScore?: number;             // 0-100 overall score
  setupSummary?: string;
  categories?: SetupCategory[];

  // Optimization fields
  recommendations?: OptimizationRecommendation[];
  optimizationSummary?: string;

  generatedAt: Timestamp;
}
