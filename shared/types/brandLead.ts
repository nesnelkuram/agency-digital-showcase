import { Timestamp } from 'firebase/firestore';

// ============================================
// SEKTÖR TİPLERİ
// ============================================

export type Sector =
  | 'gastronomi'   // Restoran, kafe, otel, food & beverage
  | 'retail'       // Mağaza, butik, e-ticaret
  | 'corporate'    // B2B, kurumsal, holding
  | 'tech'         // Teknoloji, startup
  | 'health'       // Sağlık, wellness
  | 'education'    // Eğitim, kurslar
  | 'fmcg'         // Gıda, FMCG, ürün markaları
  | 'showroom'     // Yapı malzemeleri, mobilya, dekorasyon, aydınlatma (B2B2C showroom)
  | 'hospitality'  // Otel, tatil köyü, pansiyon, turizm
  | 'other';       // Diğer

export const SECTOR_LABELS: Record<Sector, string> = {
  gastronomi: 'Gastronomi',
  retail: 'Perakende',
  corporate: 'Kurumsal',
  tech: 'Teknoloji',
  health: 'Sağlık & Wellness',
  education: 'Eğitim',
  fmcg: 'Gıda & FMCG',
  showroom: 'Yapı & Dekorasyon',
  hospitality: 'Otelcilik & Turizm',
  other: 'Diğer',
};

// ============================================
// LEAD DURUMLARI
// ============================================

export type LeadStatus =
  | 'new'           // Yeni lead, henüz incelenmedi
  | 'contacted'     // İletişime geçildi
  | 'qualified'     // Nitelikli lead, potansiyel müşteri
  | 'proposal'      // Teklif gönderildi
  | 'negotiation'   // Pazarlık aşamasında
  | 'won'           // Müşteri oldu
  | 'lost';         // Kaybedildi

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Yeni',
  contacted: 'İletişime Geçildi',
  qualified: 'Nitelikli',
  proposal: 'Teklif Gönderildi',
  negotiation: 'Pazarlık',
  won: 'Kazanıldı',
  lost: 'Kaybedildi',
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-purple-100 text-purple-700',
  qualified: 'bg-cyan-100 text-cyan-700',
  proposal: 'bg-amber-100 text-amber-700',
  negotiation: 'bg-orange-100 text-orange-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

export type LeadPriority = 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITY_LABELS: Record<LeadPriority, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  urgent: 'Acil',
};

// ============================================
// WIZARD VERİLERİ
// ============================================

export interface StageResult {
  stage: number;
  title: string;
  description?: string;
  score: number;
}

export interface RequestedService {
  id: string;
  title: string;
  description?: string;
}

export interface BusinessContext {
  businessDescription?: string;   // İşletmenin sunduğu ürün/hizmet (zorunlu)
  competitors?: string;           // Bilinen rakipler
  geoScope?: string;              // Coğrafi kapsam
  digitalPresence?: string[];     // Aktif dijital platformlar
  instagramFollowers?: string;    // Instagram takipçi aralığı
  monthlyBudget?: string;         // Aylık bütçe aralığı
  businessStage?: string;         // İşletme aşaması
  triggerReason?: string;         // Başvuru tetikleyicisi
}

export interface WizardData {
  // Tüm cevaplar (soru ID → cevap)
  answers: Record<number, string | string[]>;
  // Puanlar (soru ID → puan)
  scores: Record<number, number>;
  // Stage sonuçları
  stageResults: StageResult[];
  // Wizard versiyonu (gelecekte sorular değişirse)
  wizardVersion: string;
  // Tamamlanma süresi (ms)
  completionTime?: number;
  // İşletme bağlam bilgileri (v2.0+)
  businessContext?: BusinessContext;
}

// ============================================
// İLETİŞİM BİLGİLERİ
// ============================================

export interface ContactInfo {
  name: string;
  email: string;
  phone?: string;
  businessName: string;
  // Opsiyonel ek bilgiler
  website?: string;
  instagram?: string;
  location?: string;
}

// ============================================
// TIMELINE & AKTİVİTE
// ============================================

export type TimelineEventType =
  | 'created'
  | 'status_change'
  | 'priority_change'
  | 'assigned'
  | 'note'
  | 'email_sent'
  | 'email_received'
  | 'call'
  | 'meeting'
  | 'ai_analysis'
  | 'converted';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  createdAt: Timestamp;
  createdBy: string; // user uid
  createdByName?: string;
  metadata?: Record<string, any>;
}

// ============================================
// AI ANALİZ
// ============================================

export interface AIAnalysis {
  // Marka kişiliği analizi
  brandPersonality?: {
    archetype: string; // Jung arketip
    traits: string[];
    tone: string;
    voice: string;
  };

  // Görsel dünya önerileri
  visualWorld?: {
    moodKeywords: string[];
    colorPalette: Array<{
      hex: string;
      name: string;
      usage: string; // "primary", "secondary", "accent"
    }>;
    typographyStyle: string;
    imageryStyle: string;
  };

  // İçerik stratejisi
  contentStrategy?: {
    pillars: string[]; // İçerik sütunları
    toneGuidelines: string[];
    keyMessages: string[];
    hashtags?: string[];
  };

  // SWOT benzeri analiz
  analysis?: {
    strengths: string[];
    opportunities: string[];
    challenges: string[];
    recommendations: string[];
  };

  // Marka konumlandırma (multi-agent)
  positioning?: {
    statement: string;
    targetAudience: string;
    valuePropositionReasoning?: {
      whatBusinessProduces: string;
      coreBenefit: string;
      whoBenefits: string;
      pricePositioning: string;
      willingToPayProfile: string;
    };
    targetSegments?: Array<{
      segmentLabel: string;
      demographics: string;
      behavioralProfile: string;
      coreNeed: string;
      mediaHabits: string;
      purchaseTriggers: string[];
      estimatedSegmentSize: string;
    }>;
    targetPersonas?: Array<{ name: string; profile: string; keyNeed: string }>; // backward compat
    differentiator: string;
    competitiveAdvantage: string;
    competitiveLandscape?: string;
    alternativePositions?: string[];
  };

  // Sektör araştırma verileri (multi-agent)
  sectorResearch?: {
    competitors: Array<{
      name: string;
      website?: string;
      positioning: string;
      strengths: string[];
      weaknesses: string[];
      estimatedScale?: string;
      socialPresence?: string;
      sourceSnippet?: string;
    }>;
    marketData?: {
      marketSize: string;
      growthRate: string;
      keyPlayers: string[];
      consumerTrends: string[];
      regulatoryFactors: string[];
    };
    targetAudienceInsights?: {
      demographics: string;
      psychographics: string;
      painPoints: string[];
      purchaseBehavior: string;
    };
    marketTrends: string[];
    sectorBenchmarks: string[];
    searchQueries: string[];
    sourcesUsed: number;
    sourceUrls?: Array<{ title: string; url: string }>;
  };

  // 90 günlük eylem planı (multi-agent v2 + Fogg B=MAP)
  actionPlan?: {
    immediate: Array<{ action: string; owner: string; metric: string; estimatedImpact: string; motivationScore?: number; abilityScore?: number; bottleneck?: string; requiredResources?: string; prerequisite?: string }>;
    shortTerm: Array<{ action: string; owner: string; metric: string; estimatedImpact: string; motivationScore?: number; abilityScore?: number; bottleneck?: string; requiredResources?: string; prerequisite?: string }>;
    mediumTerm: Array<{ action: string; owner: string; metric: string; estimatedImpact: string; motivationScore?: number; abilityScore?: number; bottleneck?: string; requiredResources?: string; prerequisite?: string }>;
  };

  // Kanıt özeti (multi-agent v2)
  evidenceSummary?: {
    sourcesConsulted: number;
    keySourceUrls: Array<{ title: string; url: string }>;
    dataFreshness: string;
    confidenceLevel: string;
  };
  // Enhanced evidence summary (V2 — with confidence scoring and section breakdown)
  evidenceSummaryV2?: {
    overallConfidence: number;
    sectionBreakdown: Array<{
      sectionName: string;
      confidenceLevel: 'verified' | 'grounded' | 'inferred' | 'speculative';
      overallConfidence: number;
    }>;
    totalClaims: number;
    verifiedClaims: number;
    groundedClaims: number;
    inferredClaims: number;
    speculativeClaims: number;
    strongestSection: string;
    weakestSection: string;
    keyAssumptions: string[];
  };
  // Framework scores used in analysis
  frameworkScores?: Array<{
    framework: string;
    score: number;
    maxScore: number;
    rationale: string;
  }>;

  // Strateji tartışma kaydı (multi-agent)
  debate?: {
    strategistPosition: string;
    challengerPosition: string;
    challengerAlternatives: string[];
    synthesisRationale: string;
    debateCompleted: boolean;
  };

  // Veri kalitesi değerlendirmesi (multi-agent)
  dataQuality?: {
    completeness: number; // 0-1
    contradictions: string[];
    patterns: string[];
    missingAreas: string[];
  };

  // Pipeline metadata (multi-agent)
  pipelineMetadata?: {
    version: string;
    agentsRun: string[];
    totalDuration: number; // ms
    agentDurations: Record<string, number>;
    researchAvailable: boolean;
    researchMethod?: 'deep-research' | 'grounding' | 'none';
    fallbackUsed: boolean;
  };

  // Danışman giriş yorumu (rapor başı)
  consultantIntro?: string;

  // Faz 2 — Stratejik derinlik çıktıları
  brandNarrative?: {
    elevatorPitch: string;
    socialMediaBio: string;
    brandStory: string;
    brandManifesto?: string;
  };
  intibaEngagement?: {
    recommendedServices: Array<{
      service: string;
      description: string;
      priority: 'kritik' | 'onemli' | 'opsiyonel';
      estimatedInvestment: string;
    }>;
    threeMonthRoadmap: string;
    expectedOutcomes: string[];
    clientReadinessNotes: string;
  };
  perceptualMap?: {
    xAxis: { label: string; lowEnd: string; highEnd: string };
    yAxis: { label: string; lowEnd: string; highEnd: string };
    brandPosition: { x: number; y: number };
    competitorPositions: Array<{ name: string; x: number; y: number }>;
  };
  brandMaturity?: {
    level: 'pre_brand' | 'emerging' | 'developing' | 'mature';
    score: number;
    factors: { businessAge: number; brandAssets: number; digitalPresence: number; audienceSize: number };
    reportFocus: string;
  };

  // Faz 3 — Yapaylıktan uzaklaşma çıktıları
  strategicDepth?: {
    customerProblem: { external: string; internal: string; philosophical: string };
    transformationStatement: string;
    brandEnemy: string;
    weStandFor: string[];
    weStandAgainst: string[];
    valueLevel: 'commodity' | 'product' | 'service' | 'experience' | 'transformation';
    valueLevelUpgrade: string;
    culturalTension?: { expectation: string; reality: string; opportunity: string };
  };
  brandCharacter?: {
    sliders: { friendAuthority: number; youngMature: number; playfulSerious: number; massElite: number };
    behaviors: Array<{ value: string; do: string; dont: string; example: string }>;
    weAreThis: string[];
    weAreNotThis: string[];
    dinnerPartyDescription: string;
  };
  qualityMetrics?: {
    distinctivenessScore: number;
    onlynessTest: { statement: string; competitorSwaps: Array<{ name: string; stillValid: boolean }> };
    genericPhraseCount: number;
  };

  // Dijital varlık analizi
  digitalPresence?: {
    website: {
      url: string;
      status: 'analyzed' | 'fetch_failed' | 'not_provided';
      overallImpression: string;
      designQuality: number;
      mobileOptimized: boolean;
      loadPerformance: string;
      products: Array<{ name: string; price?: string; category?: string }>;
      pricingStrategy: string;
      contentQuality: string;
      callToActions: string[];
      trustSignals: string[];
      seoBasics: { hasTitle: boolean; hasDescription: boolean; hasOGTags: boolean; title?: string; description?: string };
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
    } | null;
    instagram: {
      handle: string;
      status: 'analyzed' | 'limited_data' | 'not_provided';
      followerRange?: string;
      estimatedPostCount?: string;
      postingFrequency?: string;
      contentThemes: string[];
      visualStyle: string;
      captionStyle: string;
      hashtagUsage: string;
      engagementLevel: string;
      contentMix: { photoPercent?: number; videoPercent?: number; reelPercent?: number; carouselPercent?: number };
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
    } | null;
    otherPlatforms: Array<{ platform: string; status: string; notes: string }>;
    overallDigitalScore: number;
    digitalMaturityLevel: string;
    criticalGaps: string[];
    quickWins: string[];
  };
  // Rakip keşif analizi
  competitorDiscovery?: {
    knownCompetitors: Array<{
      name: string; website?: string; instagramHandle?: string; positioning: string;
      priceSegment: string; strengths: string[]; weaknesses: string[];
      estimatedScale: string; digitalPresenceScore: number; socialMediaSummary: string;
      differentiators: string[]; source: 'declared' | 'research' | 'discovered';
    }>;
    discoveredCompetitors: Array<{
      name: string; website?: string; instagramHandle?: string; positioning: string;
      priceSegment: string; strengths: string[]; weaknesses: string[];
      estimatedScale: string; digitalPresenceScore: number; socialMediaSummary: string;
      differentiators: string[]; source: 'declared' | 'research' | 'discovered';
    }>;
    competitiveLandscapeSummary: string;
    marketConcentration: string;
    entryBarriers: string[];
    competitiveThreats: string[];
    competitiveOpportunities: string[];
    digitalBenchmark: {
      avgWebsiteQuality: number; avgSocialFollowing: string;
      avgPostingFrequency: string; bestPracticeExamples: string[];
    };
  };
  // Tüketici testi (enhanced with JTBD scenarios)
  consumerTest?: {
    overallViabilityScore: number;
    personas: Array<{
      personaLabel: string; demographics: string; psychographics: string;
      painPoints: string[]; alignmentScore: number; resonancePoints: string[];
      concerns: string[]; purchaseLikelihood: 'yuksek' | 'orta' | 'dusuk' | 'cok_dusuk';
      recommendedMessageAngle: string;
    }>;
    jtbdScenarios?: Array<{
      situationLabel: string;
      jobToBeDone: string;
      desiredOutcome: string;
      pushForces: string[];
      pullForces: string[];
      anxieties: string[];
      habits: string[];
      strategyJobFitScore: number;
      fitRationale: string;
    }>;
    strongestFit: string;
    weakestFit: string;
    crossPersonaConcerns: string[];
    strategyRefinements: string[];
    marketReadiness: 'hazir' | 'iyilestirme_gerekli' | 'yeniden_dusunulmeli';
  };

  // Faz 2 — KPI Framework & Senaryolar (strategySynthesizer)
  kpiFramework?: {
    northStar: { metric: string; currentEstimate: string; target90Day: string };
    leading: Array<{ metric: string; target: string; measurementMethod: string }>;
    lagging: Array<{ metric: string; target: string; measurementMethod: string }>;
    reviewCadence: string;
  };
  strategyScenarios?: {
    conservative: { description: string; investmentLevel: string; expectedOutcome: string; timeframe: string; risk: string };
    recommended: { description: string; investmentLevel: string; expectedOutcome: string; timeframe: string; risk: string };
    aggressive: { description: string; investmentLevel: string; expectedOutcome: string; timeframe: string; risk: string };
  };

  // Faz B — Mesajlaşma Mimarisi
  messagingArchitecture?: {
    coreMessage: string;
    taglineCandidates: string[];
    elevatorPitches: {
      thirtySecond: string;
      twoMinute: string;
      investor: string;
    };
    audienceMessages: Array<{
      segment: string;
      headline: string;
      subheadline: string;
      proof: string;
    }>;
  };

  // Faz C — Müşteri Yolculuğu
  customerJourney?: Array<{
    stage: 'farkindalik' | 'ilgi' | 'degerlendirme' | 'satin_alma' | 'sadakat';
    stageLabel: string;
    customerAction: string;
    touchpoints: string[];
    emotion: string;
    brandOpportunity: string;
    contentType: string;
  }>;

  // Faz C — Sosyal Medya İçerik Şablonları
  socialMediaTemplates?: Array<{
    pillar: string;
    platform: string;
    format: string;
    hookLine: string;
    bodyTemplate: string;
    callToAction: string;
    exampleCaption: string;
  }>;

  // Faz 2 — Risk Azaltma Planları (brandChallenger, enhanced with quantitative scoring)
  riskMitigationPlans?: Array<{
    risk: string;
    likelihood: 'yuksek' | 'orta' | 'dusuk';
    likelihoodScore?: number;
    impact: 'yuksek' | 'orta' | 'dusuk';
    impactScore?: number;
    expectedValue?: number;
    mitigation: string;
    earlyWarning: string;
  }>;

  // Faz 3 — Brand Value Maximizer çıktıları
  diagnosisSummary?: {
    perceptionVsReality: Array<{
      perception: string;
      reality: string;
      gap: string;
      recommendation: string;
    }>;
    blindSpots: string[];
    criticalMisalignment: string;
  };
  emotionalNarrative?: {
    manifesto: string;
    transformationStory: string;
    oneLinePromise: string;
  };
  revenueImpact?: {
    currentState: string;
    growthDrivers: Array<{
      driver: string;
      estimatedImpact: string;
      timeframe: string;
    }>;
    investmentToGrowthRatio: string;
  };

  // Meta
  analyzedAt: Timestamp;
  analyzedBy: 'gemini' | 'gemini-2.0-flash' | 'gemini-multi-agent' | 'manual';
  modelVersion?: string;
  confidence?: number; // 0-1
}

// ============================================
// ANA BRAND LEAD TİPİ
// ============================================

export interface BrandLead {
  id: string;

  // Sektör bilgisi
  sector: Sector;

  // İletişim
  contact: ContactInfo;

  // Durum yönetimi
  status: LeadStatus;
  priority: LeadPriority;

  // Wizard verileri
  wizard: WizardData;
  requestedServices: RequestedService[];

  // AI analiz (opsiyonel)
  aiAnalysis?: AIAnalysis;

  // Atama
  assignedTo?: string;
  assignedToName?: string;
  assignedAt?: Timestamp;

  // Timeline
  timeline: TimelineEvent[];

  // Notlar & etiketler
  internalNotes?: string;
  tags: string[];

  // Kaynak
  source: 'website_wizard' | 'manual' | 'referral' | 'import' | 'other';
  sourceDetail?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;

  // Tanımlayıcılar
  submissionId: string; // BS-{timestamp}

  // Rapor paylaşımı
  shareToken?: string;
  reportSharedAt?: Timestamp;

  // Zaman damgaları
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Dönüşüm
  convertedToClientAt?: Timestamp;
  clientId?: string;
  projectId?: string;
}

// ============================================
// CRUD TİPLERİ
// ============================================

export interface CreateBrandLeadData {
  sector: Sector;
  contact: ContactInfo;
  wizard: WizardData;
  requestedServices: RequestedService[];
  source?: BrandLead['source'];
  sourceDetail?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface UpdateBrandLeadData {
  status?: LeadStatus;
  priority?: LeadPriority;
  assignedTo?: string;
  assignedToName?: string;
  internalNotes?: string;
  tags?: string[];
  aiAnalysis?: AIAnalysis;
}

// ============================================
// LİSTE/ÖZET TİPİ
// ============================================

export interface BrandLeadSummary {
  id: string;
  sector: Sector;
  contact: {
    name: string;
    businessName: string;
    email: string;
  };
  status: LeadStatus;
  priority: LeadPriority;
  requestedServicesCount: number;
  assignedToName?: string;
  hasAIAnalysis: boolean;
  createdAt: Timestamp;
}

// ============================================
// FİLTRE TİPİ
// ============================================

export interface BrandLeadFilters {
  sector?: Sector[];
  status?: LeadStatus[];
  priority?: LeadPriority[];
  assignedTo?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
  hasAIAnalysis?: boolean;
}
