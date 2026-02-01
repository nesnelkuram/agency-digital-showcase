import { Timestamp } from 'firebase/firestore';

// ============================================
// PLATFORM TIPLERi
// ============================================

export type AdPlatform = 'meta' | 'google' | 'tiktok' | 'linkedin' | 'email';

export const PLATFORM_LABELS: Record<AdPlatform, string> = {
  meta: 'Meta (Facebook & Instagram)',
  google: 'Google Ads',
  tiktok: 'TikTok Ads',
  linkedin: 'LinkedIn Ads',
  email: 'Email Marketing',
};

export const PLATFORM_COLORS: Record<AdPlatform, string> = {
  meta: 'bg-blue-100 text-blue-700',
  google: 'bg-red-100 text-red-700',
  tiktok: 'bg-pink-100 text-pink-700',
  linkedin: 'bg-sky-100 text-sky-700',
  email: 'bg-emerald-100 text-emerald-700',
};

// ============================================
// KAMPANYA HEDEFLERI
// ============================================

export type CampaignObjective =
  | 'awareness'    // Marka bilinirlik
  | 'traffic'      // Web sitesi trafik
  | 'engagement'   // Etkilesim
  | 'leads'        // Potansiyel musteri
  | 'sales'        // Satis / donusum
  | 'app_installs' // Uygulama yukleme
  | 'video_views'; // Video goruntuleme

export const OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  awareness: 'Marka Bilinirlik',
  traffic: 'Web Trafigi',
  engagement: 'Etkilesim',
  leads: 'Potansiyel Musteri',
  sales: 'Satis & Donusum',
  app_installs: 'Uygulama Yukleme',
  video_views: 'Video Goruntuleme',
};

// ============================================
// KAMPANYA DURUMLARI
// ============================================

export type CampaignStatus =
  | 'draft'        // Ajan tarafindan olusturuldu
  | 'proposed'     // Onay bekliyor
  | 'approved'     // Onaylandi, yayina hazir
  | 'rejected'     // Reddedildi
  | 'revision'     // Revizyon istendi
  | 'publishing'   // Platformlara gonderiliyor
  | 'active'       // Yayinda
  | 'paused'       // Duraklatildi
  | 'completed'    // Tamamlandi
  | 'failed';      // Hata

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Taslak',
  proposed: 'Onay Bekliyor',
  approved: 'Onaylandi',
  rejected: 'Reddedildi',
  revision: 'Revizyon',
  publishing: 'Yayinlaniyor',
  active: 'Yayinda',
  paused: 'Duraklatildi',
  completed: 'Tamamlandi',
  failed: 'Basarisiz',
};

export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: 'bg-neutral-100 text-neutral-700',
  proposed: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  revision: 'bg-orange-100 text-orange-700',
  publishing: 'bg-purple-100 text-purple-700',
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
};

// ============================================
// BUTCE YONETIMI
// ============================================

export interface BudgetAllocation {
  totalBudget: number;             // Toplam butce (TRY)
  currency: 'TRY' | 'USD' | 'EUR';
  platformBreakdown: Array<{
    platform: AdPlatform;
    amount: number;
    percentage: number;
  }>;
  dailyLimit?: number;
  testBudgetPercentage: number;    // Ilk hafta test butcesi %
}

export interface BudgetPlan {
  totalMonthly: number;
  currency: 'TRY' | 'USD' | 'EUR';
  platforms: Array<{
    platform: AdPlatform;
    monthlyBudget: number;
    dailyBudget: number;
    estimatedCPC: number;
    estimatedCPM: number;
    estimatedReach: number;
    estimatedClicks: number;
    expectedROAS: number;
  }>;
  testPhaseBudget: number;
  testPhaseDuration: number;       // gun
  rationale: string;
}

// ============================================
// HEDEFLEME
// ============================================

export interface AudienceTargeting {
  // Ortak hedefleme
  ageRange: { min: number; max: number };
  genders: ('male' | 'female' | 'all')[];
  locations: Array<{
    type: 'country' | 'city' | 'region';
    name: string;
    radius?: number;               // km
  }>;
  languages: string[];

  // Platform-spesifik hedefleme
  meta?: {
    interests: string[];
    behaviors: string[];
    customAudiences: string[];
    lookalikeSource?: string;
    lookalikePercentage?: number;
    excludedAudiences?: string[];
    placements: string[];           // feed, stories, reels, etc.
  };

  google?: {
    keywords: Array<{
      text: string;
      matchType: 'broad' | 'phrase' | 'exact';
      maxCPC?: number;
    }>;
    negativeKeywords: string[];
    audiences: string[];            // in-market, affinity
    topics: string[];
    placements?: string[];
  };

  tiktok?: {
    interests: string[];
    behaviors: string[];
    creatorCategories: string[];
    hashtags: string[];
  };

  linkedin?: {
    companies: { sizes: string[]; industries: string[] };
    jobTitles: string[];
    jobFunctions: string[];
    seniority: string[];
    skills: string[];
  };

  email?: {
    segments: string[];
    tags: string[];
    excludeTags?: string[];
  };
}

// ============================================
// REKLAM SETLERI VE KREATIFLERI
// ============================================

export interface AdSet {
  id: string;
  name: string;
  platform: AdPlatform;
  targeting: Partial<AudienceTargeting>;
  budget: { daily: number; lifetime?: number };
  schedule: { startDate: string; endDate?: string };
  bidStrategy: 'lowest_cost' | 'cost_cap' | 'bid_cap' | 'target_cost';
  bidAmount?: number;
  platformAdSetId?: string;        // Platform tarafindaki ID
  status: 'active' | 'paused' | 'deleted';
  ads: Ad[];
}

export interface Ad {
  id: string;
  name: string;
  type: 'image' | 'video' | 'carousel' | 'text' | 'story' | 'email_template';
  creative: AdCreative;
  platformAdId?: string;           // Platform tarafindaki ID
  status: 'active' | 'paused' | 'deleted';
  variant?: string;                // A/B test varyanti (A, B, C)
}

export interface AdCreative {
  // Metin icerikleri
  headline: string;
  primaryText: string;
  description?: string;
  callToAction: string;
  displayUrl?: string;
  destinationUrl: string;

  // Gorsel
  imageUrl?: string;
  imageGuidelines?: string;        // AI tarafindan uretilen gorsel yonerge
  videoUrl?: string;
  videoScript?: string;
  thumbnailUrl?: string;

  // Platform-spesifik
  carouselCards?: Array<{
    headline: string;
    description: string;
    imageUrl?: string;
    destinationUrl: string;
  }>;

  // Email-spesifik
  emailSubject?: string;
  emailPreviewText?: string;
  emailBody?: string;
  emailTemplateId?: string;

  // A/B varyantlari
  variants?: Array<{
    id: string;
    label: string;                 // "Varyant A", "Varyant B"
    headline: string;
    primaryText: string;
    description?: string;
  }>;
}

// ============================================
// KAMPANYA ZAMANLAMA
// ============================================

export interface CampaignSchedule {
  startDate: string;               // YYYY-MM-DD
  endDate?: string;                // YYYY-MM-DD (opsiyonel, surekli kampanya)
  timezone: string;                // Europe/Istanbul
  dayparting?: Array<{
    day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
    hours: number[];               // 0-23
  }>;
}

// ============================================
// AI KAMPANYA ONERISI
// ============================================

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'revision';

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  pending: 'Inceleme Bekliyor',
  approved: 'Onaylandi',
  rejected: 'Reddedildi',
  revision: 'Revizyon Istendi',
};

export const PROPOSAL_STATUS_COLORS: Record<ProposalStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  revision: 'bg-orange-100 text-orange-700',
};

export interface ProposedStrategy {
  objective: CampaignObjective;
  platforms: AdPlatform[];
  approach: string;                // Strateji ozeti
  targetAudienceSummary: string;
  keyMessages: string[];
  competitiveAngle: string;
  expectedTimeline: string;
  platformRationale: Record<AdPlatform, string>; // Neden bu platform?
}

export interface ProposedCampaign {
  platform: AdPlatform;
  campaignName: string;
  campaignType: string;            // Platform-spesifik kampanya tipi
  objective: CampaignObjective;
  targeting: Partial<AudienceTargeting>;
  creatives: AdCreative[];
  estimatedBudget: number;
  estimatedResults: {
    impressions: string;
    clicks: string;
    conversions: string;
    cpa: string;
    roas: string;
  };
}

export interface ExpectedOutcome {
  metric: string;
  target: string;
  timeline: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface CampaignProposal {
  id: string;
  leadId: string;
  clientId?: string;
  projectId?: string;
  brandAnalysisId?: string;

  status: ProposalStatus;
  strategy: ProposedStrategy;
  campaigns: ProposedCampaign[];
  budgetPlan: BudgetPlan;
  rationale: string;
  expectedOutcomes: ExpectedOutcome[];

  // Onay bilgileri
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: Timestamp;
  reviewNotes?: string;
  revisionOf?: string;             // Onceki proposal ID (revizyon ise)

  // Pipeline metadata
  pipelineMetadata?: {
    version: string;
    agentsRun: string[];
    totalDuration: number;
    agentDurations: Record<string, number>;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// PLATFORM HESAP BAGLANTISI
// ============================================

export type PlatformAccountStatus = 'connected' | 'disconnected' | 'expired' | 'pending';

export interface PlatformAccount {
  id: string;
  projectId?: string;              // Proje-scoped baglanti
  platform: AdPlatform;
  accountId: string;               // Platform tarafindaki hesap ID
  accountName: string;
  status: PlatformAccountStatus;
  permissions: string[];
  lastSyncAt?: Timestamp;
  tokenExpiresAt?: Timestamp;
  metadata: Record<string, any>;   // Platform-spesifik metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// PERFORMANS METRIKLERI
// ============================================

export interface PerformanceSnapshot {
  id: string;
  campaignId: string;
  platform: AdPlatform;
  date: string;                    // YYYY-MM-DD
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;                     // Click-through rate
  spend: number;
  conversions: number;
  cpa: number;                     // Cost per acquisition
  cpc: number;                     // Cost per click
  cpm: number;                     // Cost per mille
  roas: number;                    // Return on ad spend
  engagement: number;
  videoViews?: number;
  leads?: number;
  frequency?: number;
  qualityScore?: number;
}

export interface CampaignPerformance {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageCTR: number;
  averageCPA: number;
  overallROAS: number;
  platformBreakdown: Record<AdPlatform, Partial<PerformanceSnapshot>>;
  lastUpdated: Timestamp;
}

// ============================================
// OPTIMIZASYON ONERILERI
// ============================================

export type OptimizationType =
  | 'budget_shift'      // Butce kaydirma
  | 'targeting_narrow'  // Hedefleme daraltma
  | 'targeting_expand'  // Hedefleme genisletme
  | 'creative_change'   // Yaratici degisikligi
  | 'bid_adjustment'    // Teklif ayarlama
  | 'schedule_change'   // Zamanlama degisikligi
  | 'pause_underperform' // Dusuk performansi durdur
  | 'scale_outperform'; // Yuksek performansi olcekle

export interface OptimizationSuggestion {
  id: string;
  campaignId: string;
  type: OptimizationType;
  platform: AdPlatform;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  confidence: number;              // 0-1
  currentValue: string;
  suggestedValue: string;
  expectedImprovement: string;
  status: 'pending' | 'approved' | 'rejected' | 'applied';
  appliedAt?: Timestamp;
  createdAt: Timestamp;
}

// ============================================
// ANA KAMPANYA ENTITY
// ============================================

export interface MarketingTimelineEvent {
  id: string;
  type: 'created' | 'status_change' | 'proposal_generated' | 'approved'
    | 'rejected' | 'revision_requested' | 'published' | 'paused'
    | 'resumed' | 'optimized' | 'completed' | 'note' | 'performance_alert';
  title: string;
  description?: string;
  createdAt: Timestamp;
  createdBy: string;
  createdByName?: string;
  metadata?: Record<string, any>;
}

export interface MarketingCampaign {
  id: string;
  leadId?: string;
  clientId?: string;
  projectId?: string;
  proposalId?: string;

  name: string;
  description?: string;
  objective: CampaignObjective;
  platforms: AdPlatform[];
  status: CampaignStatus;

  budget: BudgetAllocation;
  schedule: CampaignSchedule;
  targeting: AudienceTargeting;
  adSets: AdSet[];

  // Onay gecmisi
  approvalHistory: Array<{
    action: 'approved' | 'rejected' | 'revision';
    by: string;
    byName: string;
    at: Timestamp;
    notes?: string;
  }>;

  // Performans
  performance?: CampaignPerformance;

  // Platform kampanya ID'leri
  platformCampaignIds: Partial<Record<AdPlatform, string>>;

  // Timeline
  timeline: MarketingTimelineEvent[];

  // Etiketler
  tags: string[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// CRUD TIPLERI
// ============================================

export interface CreateCampaignData {
  leadId?: string;
  clientId?: string;
  projectId?: string;
  proposalId?: string;
  name: string;
  description?: string;
  objective: CampaignObjective;
  platforms: AdPlatform[];
  budget: BudgetAllocation;
  schedule: CampaignSchedule;
  targeting: AudienceTargeting;
  adSets: AdSet[];
}

export interface UpdateCampaignData {
  name?: string;
  description?: string;
  status?: CampaignStatus;
  budget?: Partial<BudgetAllocation>;
  schedule?: Partial<CampaignSchedule>;
  targeting?: Partial<AudienceTargeting>;
  tags?: string[];
}

// ============================================
// LISTE / OZET TIPLERI
// ============================================

export interface CampaignSummary {
  id: string;
  name: string;
  objective: CampaignObjective;
  platforms: AdPlatform[];
  status: CampaignStatus;
  totalBudget: number;
  totalSpend: number;
  leadName?: string;
  clientName?: string;
  projectId?: string;
  performance?: {
    impressions: number;
    clicks: number;
    conversions: number;
    roas: number;
  };
  createdAt: Timestamp;
}

export interface ProposalSummary {
  id: string;
  leadId: string;
  leadName: string;
  businessName: string;
  status: ProposalStatus;
  platforms: AdPlatform[];
  totalBudget: number;
  expectedOutcomeCount: number;
  createdAt: Timestamp;
}

// ============================================
// FILTRE TIPLERI
// ============================================

export interface CampaignFilters {
  status?: CampaignStatus[];
  platforms?: AdPlatform[];
  objective?: CampaignObjective[];
  dateRange?: { start: Date; end: Date };
  search?: string;
  leadId?: string;
  clientId?: string;
  projectId?: string;
}

export interface ProposalFilters {
  status?: ProposalStatus[];
  platforms?: AdPlatform[];
  leadId?: string;
  projectId?: string;
  dateRange?: { start: Date; end: Date };
}

// ============================================
// MARKETING DASHBOARD STATS
// ============================================

export interface MarketingDashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  pendingProposals: number;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageROAS: number;
  platformBreakdown: Array<{
    platform: AdPlatform;
    campaigns: number;
    spend: number;
    conversions: number;
  }>;
  connectedPlatforms: AdPlatform[];
}
