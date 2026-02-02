// Multi-Agent Brand Analysis Pipeline Types

export interface BusinessContextInput {
  businessDescription?: string;
  competitors?: string;
  geoScope?: string;
  digitalPresence?: string[];
  instagramFollowers?: string;
  monthlyBudget?: string;
  businessStage?: string;
  triggerReason?: string;
  websiteUrl?: string;
  instagramHandle?: string;
}

export interface PipelineInput {
  contact: { name: string; businessName: string; email: string };
  sector: string;
  wizard: {
    answers: Record<string, string>;
    scores: Record<string, number>;
    stageResults: any[];
  };
  requestedServices: { id: string; title: string }[];
  leadId: string;
  mode?: 'full' | 'lite';
  adminNotes?: string;
  businessContext?: BusinessContextInput;
}

// Agent 1 Output
export interface NormalizedData {
  sector: string;
  businessName: string;
  structuredAnswers: Array<{
    stage: number;
    stageName: string;
    questions: Array<{
      id: string;
      question: string;
      answer: string;
      answerLabel: string;
      score?: number;
    }>;
  }>;
  detectedPatterns: string[];
  contradictions: string[];
  dataQualityScore: number;
  missingAreas: string[];
  overallProfile: string;
}

// Agent 2 Output
export interface ResearchFindings {
  competitors: Array<{
    name: string;
    website: string;
    positioning: string;
    strengths: string[];
    weaknesses: string[];
    estimatedScale: string;
    socialPresence: string;
    sourceSnippet: string;
  }>;
  marketData: {
    marketSize: string;
    growthRate: string;
    keyPlayers: string[];
    consumerTrends: string[];
    regulatoryFactors: string[];
  };
  targetAudienceInsights: {
    demographics: string;
    psychographics: string;
    painPoints: string[];
    purchaseBehavior: string;
  };
  opportunities: string[];
  threats: string[];
  sectorBenchmarks: string[];
  searchQueries: string[];
  sourcesUsed: number;
  sourceUrls: Array<{ title: string; url: string }>;
  rawSnippets: string[];
}

// Value Proposition Reasoning — agent must answer these BEFORE defining audience
export interface ValuePropositionReasoning {
  whatBusinessProduces: string;
  coreBenefit: string;
  whoBenefits: string;
  pricePositioning: string;
  willingToPayProfile: string;
}

// Behavioral audience segment (replaces fictional TargetPersona)
export interface AudienceSegment {
  segmentLabel: string;
  demographics: string;
  behavioralProfile: string;
  coreNeed: string;
  mediaHabits: string;
  purchaseTriggers: string[];
  estimatedSegmentSize: string;
}

// Agent 3 Output
export interface StrategistOutput {
  archetype: string;
  archetypeRationale: string;
  traits: string[];
  tone: string;
  voice: string;
  positioningStatement: string;
  valuePropositionReasoning: ValuePropositionReasoning;
  targetAudience: {
    primarySegment: AudienceSegment;
    secondarySegment: AudienceSegment;
    marketSizeEstimate: string;
  };
  differentiator: string;
  competitiveAdvantage: string;
  competitiveMap: Array<{
    competitorName: string;
    theirPosition: string;
    ourAdvantage: string;
    ourWeakness: string;
  }>;
}

// Agent 4a Output
export interface ChallengerOutput {
  counterPosition: string;
  alternativeArchetype: string;
  alternativeArchetypeRationale: string;
  challengePoints: string[];
  alternativePositionings: string[];
  riskAssessment: string;
  blindSpots: string[];
}

// Agent 4b Output (Blog Strategy Advisor)
export interface BlogAdvisorOutput {
  philosophicalAlignment: {
    score: number;
    rationale: string;
    alignedPrinciples: string[];
    conflictingPrinciples: string[];
  };
  strategicRecommendations: Array<{
    area: string;
    recommendation: string;
    sourceInsight: string;
  }>;
  contentStrategyInsights: {
    toneAlignment: string;
    contentPillars: string[];
    narrativeApproach: string;
    topicSuggestions: string[];
  };
  authorPerspective: string;
  unconventionalInsights: string[];
}

// Action plan item for 90-day roadmap
export interface ActionItem {
  action: string;
  owner: string;
  metric: string;
  estimatedImpact: string;
}

// Agent 5 Output
export interface SynthesizedAnalysis {
  brandPersonality: {
    archetype: string;
    traits: string[];
    tone: string;
    voice: string;
  };
  positioning: {
    statement: string;
    targetAudience: string;
    targetSegments: AudienceSegment[];
    valuePropositionReasoning: ValuePropositionReasoning;
    differentiator: string;
    competitiveAdvantage: string;
    competitiveLandscape: string;
    alternativePositions: string[];
  };
  visualWorld: {
    moodKeywords: string[];
    colorPalette: Array<{ hex: string; name: string; usage: string }>;
    typographyStyle: string;
    imageryStyle: string;
  };
  contentStrategy: {
    pillars: string[];
    toneGuidelines: string[];
    keyMessages: string[];
    hashtags: string[];
  };
  analysis: {
    strengths: string[];
    opportunities: string[];
    challenges: string[];
    recommendations: string[];
  };
  actionPlan: {
    immediate: ActionItem[];
    shortTerm: ActionItem[];
    mediumTerm: ActionItem[];
  };
  evidenceSummary: {
    sourcesConsulted: number;
    keySourceUrls: Array<{ title: string; url: string }>;
    dataFreshness: string;
    confidenceLevel: string;
  };
  consultantIntro: string;
  synthesisRationale: string;
  blogAdvisorInsights?: {
    philosophicalAlignmentScore: number;
    keyRecommendations: string[];
    contentPillars: string[];
    unconventionalInsights: string[];
    authorPerspective: string;
  };
}

// Agent 7 Output — Digital Presence Analysis
export interface WebsiteAnalysis {
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
  seoBasics: {
    hasTitle: boolean;
    hasDescription: boolean;
    hasOGTags: boolean;
    title?: string;
    description?: string;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface InstagramAnalysis {
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
  contentMix: {
    photoPercent?: number;
    videoPercent?: number;
    reelPercent?: number;
    carouselPercent?: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface PlatformPresence {
  platform: string;
  status: string;
  notes: string;
}

export interface DigitalPresenceAnalysis {
  website: WebsiteAnalysis | null;
  instagram: InstagramAnalysis | null;
  otherPlatforms: PlatformPresence[];
  overallDigitalScore: number;
  digitalMaturityLevel: string;
  criticalGaps: string[];
  quickWins: string[];
}

// Agent 8 Output — Competitor Discovery
export interface EnrichedCompetitor {
  name: string;
  website?: string;
  instagramHandle?: string;
  positioning: string;
  priceSegment: string;
  strengths: string[];
  weaknesses: string[];
  estimatedScale: string;
  digitalPresenceScore: number;
  socialMediaSummary: string;
  differentiators: string[];
  source: 'declared' | 'research' | 'discovered';
}

export interface CompetitorDiscoveryOutput {
  knownCompetitors: EnrichedCompetitor[];
  discoveredCompetitors: EnrichedCompetitor[];
  competitiveLandscapeSummary: string;
  marketConcentration: string;
  entryBarriers: string[];
  competitiveThreats: string[];
  competitiveOpportunities: string[];
  digitalBenchmark: {
    avgWebsiteQuality: number;
    avgSocialFollowing: string;
    avgPostingFrequency: string;
    bestPracticeExamples: string[];
  };
}

// Agent 9 Output — Synthetic Consumer Test
export interface ConsumerTestResult {
  personaLabel: string;
  demographics: string;
  psychographics: string;
  painPoints: string[];
  alignmentScore: number;
  resonancePoints: string[];
  concerns: string[];
  purchaseLikelihood: 'yuksek' | 'orta' | 'dusuk' | 'cok_dusuk';
  recommendedMessageAngle: string;
}

export interface ConsumerTestOutput {
  overallViabilityScore: number;
  personas: ConsumerTestResult[];
  strongestFit: string;
  weakestFit: string;
  crossPersonaConcerns: string[];
  strategyRefinements: string[];
  marketReadiness: 'hazir' | 'iyilestirme_gerekli' | 'yeniden_dusunulmeli';
}

// Pipeline state passed through agents
export interface PipelineState {
  input: PipelineInput;
  normalizedData?: NormalizedData;
  researchFindings?: ResearchFindings;
  strategistOutput?: StrategistOutput;
  challengerOutput?: ChallengerOutput;
  blogAdvisorOutput?: BlogAdvisorOutput;
  synthesizedAnalysis?: SynthesizedAnalysis;
  digitalPresenceAnalysis?: DigitalPresenceAnalysis;
  competitorDiscovery?: CompetitorDiscoveryOutput;
  consumerTest?: ConsumerTestOutput;
  errors: Array<{ agent: string; error: string; timestamp: number }>;
  timings: Record<string, number>;
}

