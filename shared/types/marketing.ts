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
// META EFFECTIVE STATUS
// ============================================

export const EFFECTIVE_STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  in_process: 'Isleniyor',
  with_issues: 'Sorunlu',
  campaign_paused: 'Kampanya Duraklatildi',
  adset_paused: 'Reklam Seti Duraklatildi',
  disapproved: 'Reddedildi',
  pending_review: 'Onay Bekliyor',
  preapproved: 'On Onayli',
  pending_billing: 'Fatura Bekliyor',
  archived: 'Arsivlendi',
  deleted: 'Silindi',
  paused: 'Duraklatildi',
  learning: 'Ogrenme Asamasinda',
};

export const EFFECTIVE_STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  in_process: 'bg-blue-100 text-blue-700',
  with_issues: 'bg-red-100 text-red-700',
  campaign_paused: 'bg-yellow-100 text-yellow-700',
  adset_paused: 'bg-yellow-100 text-yellow-700',
  disapproved: 'bg-red-100 text-red-700',
  pending_review: 'bg-orange-100 text-orange-700',
  preapproved: 'bg-green-100 text-green-700',
  pending_billing: 'bg-orange-100 text-orange-700',
  archived: 'bg-neutral-100 text-neutral-600',
  deleted: 'bg-neutral-100 text-neutral-500',
  paused: 'bg-yellow-100 text-yellow-700',
  learning: 'bg-purple-100 text-purple-700',
};

export const QUALITY_RANKING_LABELS: Record<string, string> = {
  BELOW_AVERAGE_10: 'Ortalama Alti (Alt %10)',
  BELOW_AVERAGE_20: 'Ortalama Alti (Alt %20)',
  BELOW_AVERAGE_35: 'Ortalama Alti (Alt %35)',
  AVERAGE: 'Ortalama',
  ABOVE_AVERAGE: 'Ortalamanin Ustu',
};

export const QUALITY_RANKING_COLORS: Record<string, string> = {
  BELOW_AVERAGE_10: 'text-red-600',
  BELOW_AVERAGE_20: 'text-red-500',
  BELOW_AVERAGE_35: 'text-orange-500',
  AVERAGE: 'text-yellow-600',
  ABOVE_AVERAGE: 'text-green-600',
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
  metaAdSetId?: string;            // Meta Graph API ad set ID
  optimizationGoal?: string;       // LINK_CLICKS, IMPRESSIONS, etc.
  targetingJson?: Record<string, any>; // Raw Meta targeting object
  status: 'active' | 'paused' | 'deleted';
  ads: Ad[];
  performanceSummary?: {
    impressions: number;
    clicks: number;
    spend: number;
    ctr: number;
    cpa: number;
    conversions: number;
    reach?: number;
    frequency?: number;
    qualityRanking?: string;
    engagementRateRanking?: string;
    conversionRateRanking?: string;
  };
  // Extended Meta fields
  effectiveStatus?: string;        // ACTIVE, LEARNING, WITH_ISSUES, etc.
  billingEvent?: string;           // IMPRESSIONS, LINK_CLICKS, etc.
  pacingType?: string[];           // standard, no_pacing
  attributionSpec?: Record<string, any>;
  promotedObject?: Record<string, any>; // pixel_id, page_id, etc.
  frequencyControlSpecs?: any[];
  dailyMinSpendTarget?: number;
  dailySpendCap?: number;
  learningStageInfo?: { status: string; time_from_last_significant_edit?: string };
  destinationType?: string;        // WEBSITE, APP, MESSENGER
  isDynamicCreative?: boolean;
}

export interface Ad {
  id: string;
  name: string;
  type: 'image' | 'video' | 'carousel' | 'text' | 'story' | 'email_template';
  creative: AdCreative;
  platformAdId?: string;           // Platform tarafindaki ID
  metaAdId?: string;               // Meta Graph API ad ID
  metaCreativeId?: string;         // Meta creative ID
  status: 'active' | 'paused' | 'deleted';
  variant?: string;                // A/B test varyanti (A, B, C)
  performanceSummary?: {
    impressions: number;
    clicks: number;
    spend: number;
    ctr: number;
    conversions: number;
  };
  // Extended Meta fields
  effectiveStatus?: string;        // ACTIVE, DISAPPROVED, PENDING_REVIEW, etc.
  previewShareableLink?: string;   // Meta ad preview URL
  recommendations?: Array<{
    title: string;
    message: string;
    code: string;
  }>;
  adReviewFeedback?: Record<string, any>;  // Red nedenleri
  issuesInfo?: Array<{ level: string; error_summary: string }>;
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

  // Meta Creative fields
  metaPreviewUrl?: string;         // Meta ad preview URL
  metaImageHash?: string;          // Meta image hash for creative
  assetFeedSpec?: Record<string, any>; // Meta asset feed spec (dynamic creative)

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
  level?: 'campaign' | 'adset' | 'ad'; // Metric seviyesi
  adSetId?: string;                // Ad set seviye ise
  adSetName?: string;
  adId?: string;                   // Ad seviye ise
  adName?: string;
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
  // Extended Meta fields
  uniqueClicks?: number;
  uniqueCtr?: number;
  costPerUniqueClick?: number;
  qualityRanking?: string;         // BELOW_AVERAGE_10, AVERAGE, ABOVE_AVERAGE
  engagementRateRanking?: string;
  conversionRateRanking?: string;
  videoMetrics?: {
    avgWatchTime?: number;
    p25?: number;
    p50?: number;
    p75?: number;
    p100?: number;
  };
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

  // Hangi platform hesabına ait (Firestore platform_accounts doc ID)
  platformAccountId?: string;

  // Meta sync durum bilgileri
  lastSyncAt?: Timestamp;
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error';
  syncError?: string;

  // Extended Meta campaign fields
  effectiveStatus?: string;        // ACTIVE, IN_PROCESS, WITH_ISSUES, etc.
  configuredStatus?: string;       // Kullanıcının set ettiği durum (active/paused/archived)
  buyingType?: string;             // AUCTION, RESERVED
  spendCap?: number;
  budgetRemaining?: number;
  specialAdCategories?: string[];
  dailyBudget?: number;            // Günlük bütçe (TL, Meta cents'den dönüştürülmüş)
  lifetimeBudget?: number;         // Toplam bütçe (TL)
  issuesInfo?: Array<{ level: string; error_summary: string }>;
  recommendations?: Array<{ title: string; message: string; code: string }>;
  pacingType?: string[];
  promotedObject?: Record<string, any>;
  metaCreatedTime?: string;        // Meta'daki oluşturma tarihi (ISO 8601)
  metaUpdatedTime?: string;        // Meta'daki güncelleme tarihi

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

// ============================================
// PLATFORM AKSIYONLARI (Agent Onay Akışı)
// ============================================

export type PlatformActionType =
  | 'publish_plan'
  | 'pause_campaign'
  | 'resume_campaign'
  | 'delete_campaign'
  | 'update_meta_budget'
  | 'update_campaign_budget'
  | 'create_meta_ad'
  | 'upload_image'
  | 'pause_adset'
  | 'resume_adset'
  | 'update_adset_targeting'
  | 'fetch_performance';

export type PendingActionStatus =
  | 'pending_approval'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rejected';

export interface PendingPlatformAction {
  id: string;
  type: PlatformActionType;
  status: PendingActionStatus;
  platform: AdPlatform;
  payload: Record<string, any>;
  description: string;
  impact: string;
  result?: Record<string, any>;
  createdAt: number;
  resolvedAt?: number;
}

export const PLATFORM_ACTION_LABELS: Record<PlatformActionType, string> = {
  publish_plan: 'Planı Yayınla',
  pause_campaign: 'Kampanyayı Duraklat',
  resume_campaign: 'Kampanyayı Devam Ettir',
  delete_campaign: 'Kampanyayı Sil/Arşivle',
  update_meta_budget: 'Reklam Seti Bütçe Güncelle',
  update_campaign_budget: 'Kampanya Bütçe Güncelle',
  create_meta_ad: 'Reklam Oluştur',
  upload_image: 'Görsel Yükle',
  pause_adset: 'Reklam Setini Duraklat',
  resume_adset: 'Reklam Setini Devam Ettir',
  update_adset_targeting: 'Hedefleme Güncelle',
  fetch_performance: 'Performans Getir',
};

export const PENDING_ACTION_STATUS_LABELS: Record<PendingActionStatus, string> = {
  pending_approval: 'Onay Bekliyor',
  executing: 'Yürütülüyor',
  completed: 'Tamamlandı',
  failed: 'Başarısız',
  rejected: 'Reddedildi',
};

// ============================================
// PAZARLAMA PLANI (AI Agent tarafindan uretilen)
// ============================================

export interface MarketingPlanAdSet {
  name: string;
  targeting: string;
  dailyBudget: number;
  adFormat: string;
  creativeNotes: string;
}

export interface MarketingPlanCampaign {
  name: string;
  objective: string;
  platform: AdPlatform;
  metaObjective: string;
  budget: number;
  adSets: MarketingPlanAdSet[];
}

export interface MarketingPlanData {
  name: string;
  brand: {
    name: string;
    description: string;
    industry: string;
  };
  objectives: string[];
  audience: {
    ageMin: number;
    ageMax: number;
    genders: string[];
    interests: string[];
    locations: string[];
  };
  budget: {
    total: number;
    currency: string;
    dailyBudget: number;
  };
  platforms: AdPlatform[];
  timeline: {
    startDate: string;
    endDate: string;
  };
  campaigns: MarketingPlanCampaign[];
  kpis: {
    impressions: number;
    clicks: number;
    conversions: number;
  };
}

export interface MarketingPlan {
  id: string;
  tenantId: string;
  sessionId: string;
  status: 'draft' | 'published';
  planData: MarketingPlanData;
  metaResults?: Record<string, { campaignId: string; adSetIds: string[] }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// MARKETING AGENT V2 TYPES (SSE Streaming)
// ============================================

export interface MarketingAgentSession {
  id: string;
  tenantId: string;
  userId: string;
  projectId: string | null;
  strategyContext: string | null;
  title?: string | null;
  messages: AgentV2Message[];
  contentHistory?: unknown;
  pendingActions?: unknown;
  version?: string;
  createdAt: number;
  updatedAt: number;
}

export type AgentV2SSEEventType =
  | 'text_delta'
  | 'tool_call'
  | 'tool_result'
  | 'approval_required'
  | 'done'
  | 'error';

export interface AgentV2SSEEvent {
  type: AgentV2SSEEventType;
  content?: string;
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
  data?: unknown;
  component?: string;
  actionId?: string;
  action?: PendingPlatformAction;
  messageId?: string;
  message?: string;
}

export interface AgentV2Message {
  id: string;
  role: 'user' | 'assistant';
  parts: AgentV2MessagePart[];
  timestamp: number;
}

export type AgentV2MessagePart =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; data: unknown; component?: string }
  | { type: 'approval_required'; actionId: string; action: PendingPlatformAction };
