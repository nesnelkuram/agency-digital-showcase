// Marketing Multi-Agent Pipeline Types
// Follows the same pattern as src/pipeline/types.ts

import type { SynthesizedAnalysis, BusinessContextInput } from '../types';
import type {
  AdPlatform,
  CampaignObjective,
  AudienceTargeting,
  AdCreative,
  BudgetPlan,
  ExpectedOutcome,
} from '@/shared/types/marketing';

// ============================================
// PIPELINE INPUT
// ============================================

export interface MarketingPipelineInput {
  leadId: string;
  clientId?: string;
  brandAnalysis: SynthesizedAnalysis;
  businessContext?: BusinessContextInput;
  businessName: string;
  sector: string;

  // Marketing-specific input
  goals: MarketingGoals;
  availablePlatforms: AdPlatform[];
  totalBudget: number;
  currency: 'TRY' | 'USD' | 'EUR';
  campaignDuration: number;        // gun
  existingAssets?: string[];       // Mevcut gorsel/video URL'leri
  adminNotes?: string;             // Admin ek notlari
  revisionNotes?: string;          // Revizyon istegi notlari (opsiyonel)
  previousProposalId?: string;     // Revizyon durumunda onceki oneri ID
}

export interface MarketingGoals {
  primaryObjective: CampaignObjective;
  secondaryObjectives?: CampaignObjective[];
  targetMetrics?: {
    monthlyLeads?: number;
    monthlyConversions?: number;
    targetCPA?: number;
    targetROAS?: number;
    targetReach?: number;
  };
  specificRequirements?: string;   // Ozel istekler
}

// ============================================
// AGENT 1 OUTPUT: Campaign Strategist
// ============================================

export interface CampaignStrategyOutput {
  overallApproach: string;         // Genel strateji ozeti
  campaignName: string;            // Onerilen kampanya adi

  platformStrategies: Array<{
    platform: AdPlatform;
    campaignType: string;          // Platform-spesifik kampanya tipi
    objective: CampaignObjective;
    rationale: string;             // Neden bu platform/tip?
    priority: 'primary' | 'secondary' | 'supplementary';
    estimatedImpact: string;
  }>;

  messagingFramework: {
    coreMessage: string;           // Ana mesaj
    supportMessages: string[];     // Destekleyici mesajlar
    toneAdaptation: string;        // Marka tonunun reklam diline cevrimi
    keyDifferentiators: string[];  // Reklamda one cikarilacak farkliliklar
    avoidMessages: string[];       // Kacinilacak mesajlar
  };

  funnelStrategy: {
    topOfFunnel: { platforms: AdPlatform[]; approach: string };
    middleOfFunnel: { platforms: AdPlatform[]; approach: string };
    bottomOfFunnel: { platforms: AdPlatform[]; approach: string };
  };

  timeline: {
    phase1: { name: string; duration: string; focus: string };
    phase2: { name: string; duration: string; focus: string };
    phase3: { name: string; duration: string; focus: string };
  };

  competitivePositioning: string;  // Rakiplere karsi konumlanma
  riskAssessment: string[];        // Potansiyel riskler
}

// ============================================
// AGENT 2 OUTPUT: Audience Architect
// ============================================

export interface AudienceArchitectOutput {
  primaryAudience: {
    description: string;
    estimatedSize: string;
    platforms: AdPlatform[];
  };
  secondaryAudience: {
    description: string;
    estimatedSize: string;
    platforms: AdPlatform[];
  };

  platformTargeting: Record<AdPlatform, PlatformTargetingSpec>;

  retargetingStrategy: {
    websiteVisitors: string;
    engagers: string;
    lookalikeStrategy: string;
  };

  exclusionRecommendations: string[];
  audienceTestingPlan: string;
}

export interface PlatformTargetingSpec {
  targeting: Partial<AudienceTargeting>;
  estimatedReach: string;
  estimatedCPM: string;
  recommendations: string[];
}

// ============================================
// AGENT 3 OUTPUT: Creative Director
// ============================================

export interface CreativeDirectorOutput {
  creativeStrategy: string;        // Genel yaratici strateji

  platformCreatives: Record<AdPlatform, PlatformCreativeSet>;

  visualGuidelines: {
    colorUsage: string;            // Marka renklerinin reklam icinde kullanimi
    imageryStyle: string;          // Gorsel stili
    typographyNotes: string;       // Yazi tipi notlari
    brandConsistencyNotes: string; // Marka tutarliligi
  };

  abTestPlan: Array<{
    testName: string;
    hypothesis: string;
    variants: string[];
    metric: string;
    duration: string;
  }>;
}

export interface PlatformCreativeSet {
  creatives: AdCreative[];
  formatNotes: string;             // Platform format gereksinimleri
  bestPractices: string[];         // Platform-spesifik en iyi uygulamalar
}

// ============================================
// AGENT 4 OUTPUT: Budget Allocator
// ============================================

export interface BudgetAllocatorOutput {
  budgetPlan: BudgetPlan;

  allocationRationale: string;     // Neden bu dagilim?

  scenarioAnalysis: {
    conservative: { totalBudget: number; expectedResults: string };
    moderate: { totalBudget: number; expectedResults: string };
    aggressive: { totalBudget: number; expectedResults: string };
  };

  warnings: string[];              // Butce uyarilari
  optimizationTriggers: Array<{
    condition: string;             // "CPA > X TL"
    action: string;                // "Meta butcesini %20 dusur"
  }>;
}

// ============================================
// ASSEMBLED PROPOSAL
// ============================================

export interface AssembledProposal {
  strategy: CampaignStrategyOutput;
  audienceTargeting: AudienceArchitectOutput;
  creatives: CreativeDirectorOutput;
  budgetPlan: BudgetAllocatorOutput;
  expectedOutcomes: ExpectedOutcome[];
  rationale: string;
}

// ============================================
// PIPELINE STATE
// ============================================

export interface MarketingPipelineState {
  input: MarketingPipelineInput;
  strategyOutput?: CampaignStrategyOutput;
  audienceOutput?: AudienceArchitectOutput;
  creativeOutput?: CreativeDirectorOutput;
  budgetOutput?: BudgetAllocatorOutput;
  assembledProposal?: AssembledProposal;
  errors: Array<{ agent: string; error: string; timestamp: number }>;
  timings: Record<string, number>;
}
