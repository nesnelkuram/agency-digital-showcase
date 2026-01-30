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
  | 'other';       // Diğer

export const SECTOR_LABELS: Record<Sector, string> = {
  gastronomi: 'Gastronomi',
  retail: 'Perakende',
  corporate: 'Kurumsal',
  tech: 'Teknoloji',
  health: 'Sağlık & Wellness',
  education: 'Eğitim',
  fmcg: 'Gıda & FMCG',
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

  // 90 günlük eylem planı (multi-agent v2)
  actionPlan?: {
    immediate: Array<{ action: string; owner: string; metric: string; estimatedImpact: string }>;
    shortTerm: Array<{ action: string; owner: string; metric: string; estimatedImpact: string }>;
    mediumTerm: Array<{ action: string; owner: string; metric: string; estimatedImpact: string }>;
  };

  // Kanıt özeti (multi-agent v2)
  evidenceSummary?: {
    sourcesConsulted: number;
    keySourceUrls: Array<{ title: string; url: string }>;
    dataFreshness: string;
    confidenceLevel: string;
  };

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
    fallbackUsed: boolean;
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
