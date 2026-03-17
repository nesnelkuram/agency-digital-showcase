// Multi-Agent Brand Analysis Pipeline Types
import type { EvidenceChain, FrameworkScore, SectionEvidence, EvidenceSummaryV2 } from './evidence';

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
  // Faz 2 — Stratejik derinlik soruları (Golden Circle, Keller, Aaker, Kapferer)
  brandWhy?: string;              // "Neden bu işi yapıyorsunuz?" — Golden Circle WHY
  customerPerception?: string;    // "Müşterileriniz sizi nasıl tanımlıyor?" — Keller Salience + Kapferer Reflection
  existingBrandAssets?: string;   // "Mevcut marka kimliğiniz var mı?" — Aaker Symbol + Sharp Distinctive Assets
  futureVision?: string;          // "3 yıl sonra nerede olmak istiyorsunuz?" — Stratejik vizyon
  // Faz 3 — JTBD + StoryBrand + Cultural Branding
  customerJob?: string;           // "Müşteriniz sizi kiralıyor — hangi iş için?" — JTBD
  customerStruggle?: string;      // "Müşteriniz size gelmeden önce ne ile mücadele ediyor?" — StoryBrand
  brandEnemy?: string;            // "Sektörünüzde en çok neye karşısınız?" — Cultural Branding
  alternativeToUs?: string;       // "Siz olmasaydınız müşteriniz ne yapardı?" — JTBD gerçek rakip
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

// Brand Maturity Level — determines report depth and tone
export type BrandMaturityLevel = 'pre_brand' | 'emerging' | 'developing' | 'mature';

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
  // Faz 2 — Brand maturity assessment
  brandMaturity?: {
    level: BrandMaturityLevel;
    score: number;           // 0-12 puan
    factors: {
      businessAge: number;   // 0-3
      brandAssets: number;    // 0-3
      digitalPresence: number;// 0-3
      audienceSize: number;   // 0-3
    };
    reportFocus: string;     // "kimlik" | "strateji" | "buyume"
  };
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
  // Sector-specific data fields (populated by sector enrichment modules)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [sectorDataKey: `${string}Data`]: any;
  // Hospitality-specific fields (populated when sector === 'hospitality')
  hospitalityData?: {
    reviewScores?: {
      booking?: { score: string; reviewCount: string };
      google?: { score: string; reviewCount: string };
      tripAdvisor?: { score: string; reviewCount: string };
    };
    pricingData?: {
      averageDailyRate?: string;
      seasonalRange?: { low: string; high: string };
      competitorPriceRange?: string;
    };
    channelMix?: {
      otaDependency: string; // yuksek/orta/dusuk
      directBookingCapability: string;
      bookingEngineType?: string;
    };
    seasonality?: {
      highSeason: string[];
      lowSeason: string[];
      specialEvents: string[];
    };
    guestProfile?: {
      domesticVsInternational: string;
      businessVsLeisure: string;
      averageStayDuration: string;
      topSegments: string[];
    };
    roomTypes?: Array<{ type: string; priceRange?: string }>;
    hotelKPIs?: {
      revPAR?: string;
      adr?: string;
      occupancyRate?: string;
      directBookingRatio?: string;
    };
    googleBusinessProfile?: {
      rating?: string;
      reviewCount?: string;
      photoCount?: string;
      responseRate?: string;
      topCategories?: string[];
    };
    reviewSentiment?: {
      positiveThemes: string[];
      negativeThemes: string[];
      overallSentiment: string;
    };
  };
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
  archetype: string;               // Dahili referans — raporda gösterilmez
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
  // Faz 3 — Stratejik derinlik
  personalitySliders?: {
    friendAuthority: number;       // 0=Arkadaş, 100=Otorite
    youngMature: number;           // 0=Genç, 100=Olgun
    playfulSerious: number;        // 0=Eğlenceli, 100=Ciddi
    massElite: number;             // 0=Kitle, 100=Elit
  };
  brandEnemy?: string;             // Markanın karşı durduğu güç/statüko
  believeReject?: {
    believe: string[];             // "İnanıyoruz ki..."
    reject: string[];              // "Reddediyoruz ki..."
  };
  customerProblem?: {
    external: string;              // Yüzeydeki somut sorun
    internal: string;              // Bu sorunun yarattığı duygu
    philosophical: string;         // "Bu böyle olmamalı" ahlaki boyut
  };
  transformationStatement?: string; // "X'dan Y'a" — 12 kelime max
  valueLevel?: 'commodity' | 'product' | 'service' | 'experience' | 'transformation';
  // Framework scoring (Aaker Brand Personality 5 dimensions)
  aakerPersonality?: {
    sincerity: number;      // 0-20
    excitement: number;     // 0-20
    competence: number;     // 0-20
    sophistication: number; // 0-20
    ruggedness: number;     // 0-20
  };
  // Segment selection rationale (mandatory)
  segmentSelectionRationale?: string;
  // Evidence chains for strategist output
  _evidence?: EvidenceChain[];
  _frameworkScores?: FrameworkScore[];
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
  // Faz 3 — Onlyness testi + kalite doğrulama
  onlynessTest?: {
    statement: string;             // "[Marka] [kategoride] [fark] sunan TEK markadır"
    competitorSwaps: Array<{
      competitor: string;
      stillValid: boolean;         // Rakip adıyla da geçerli mi?
      reason: string;
    }>;
    verdict: 'strong' | 'weak' | 'generic';
  };
  distinctivenessScore?: number;   // 0-100 — ne kadar benzersiz?
  // Faz 2 — Risk Azaltma Planları (enhanced with quantitative scoring)
  riskMitigationPlans?: Array<{
    risk: string;
    likelihood: 'yuksek' | 'orta' | 'dusuk';
    likelihoodScore?: number;    // 0-1 quantitative
    impact: 'yuksek' | 'orta' | 'dusuk';
    impactScore?: number;        // 1-10 quantitative
    expectedValue?: number;      // likelihood × impact
    mitigation: string;
    earlyWarning: string;
  }>;
  // Evidence chains for challenger analysis
  _evidence?: EvidenceChain[];
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

// Action plan item for 90-day roadmap (enhanced with Fogg B=MAP)
export interface ActionItem {
  action: string;
  owner: string;
  metric: string;
  estimatedImpact: string;
  // Fogg B=MAP enhancement
  motivationScore?: number;    // 0-10
  abilityScore?: number;       // 0-10
  bottleneck?: 'motivation' | 'ability' | 'prompt' | 'none';
  requiredResources?: string;
  prerequisite?: string;
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
  // Enhanced evidence summary (V2)
  evidenceSummaryV2?: EvidenceSummaryV2;
  // Framework scores used in analysis
  frameworkScores?: FrameworkScore[];
  // Multi-model consensus results
  consensusResults?: Array<{
    question: string;
    consensusReached: boolean;
    consensusScore: number;
    disagreements: string[];
  }>;
  consultantIntro: string;
  synthesisRationale: string;
  blogAdvisorInsights?: {
    philosophicalAlignmentScore: number;
    keyRecommendations: string[];
    contentPillars: string[];
    unconventionalInsights: string[];
    authorPerspective: string;
  };
  // Faz 2 — Stratejik derinlik çıktıları
  brandNarrative?: {
    elevatorPitch: string;         // 30 saniyelik tanıtım
    socialMediaBio: string;        // Instagram/LinkedIn bio metni
    brandStory: string;            // Marka hikayesi özeti (about us)
    brandManifesto?: string;       // Marka manifestosu (mature brands için)
  };
  intibaEngagement?: {
    recommendedServices: Array<{
      service: string;             // Hizmet adı
      description: string;         // Neden bu hizmet
      priority: 'kritik' | 'onemli' | 'opsiyonel';
      estimatedInvestment: string; // Tahmini yatırım aralığı
    }>;
    threeMonthRoadmap: string;     // 3 aylık yol haritasında İntiba'nın rolü
    expectedOutcomes: string[];    // Beklenen sonuçlar
    clientReadinessNotes: string;  // Müşterinin hazırlık durumu notları
  };
  perceptualMap?: {
    xAxis: { label: string; lowEnd: string; highEnd: string };
    yAxis: { label: string; lowEnd: string; highEnd: string };
    brandPosition: { x: number; y: number };  // -5 to +5
    competitorPositions: Array<{ name: string; x: number; y: number }>;
  };
  // Faz 3 — Yapaylıktan uzaklaşma çıktıları
  strategicDepth?: {
    customerProblem: { external: string; internal: string; philosophical: string };
    transformationStatement: string;        // "X'dan Y'a" — 12 kelime max
    brandEnemy: string;
    weStandFor: string[];
    weStandAgainst: string[];
    valueLevel: 'commodity' | 'product' | 'service' | 'experience' | 'transformation';
    valueLevelUpgrade: string;              // Bir üst basamağa çıkma önerisi
    culturalTension?: { expectation: string; reality: string; opportunity: string };
  };
  brandCharacter?: {
    sliders: { friendAuthority: number; youngMature: number; playfulSerious: number; massElite: number };
    behaviors: Array<{ value: string; do: string; dont: string; example: string }>;
    weAreThis: string[];
    weAreNotThis: string[];
    dinnerPartyDescription: string;         // "Akşam yemeğinde nasıl konuşur?"
  };
  qualityMetrics?: {
    distinctivenessScore: number;           // 0-100
    onlynessTest: { statement: string; competitorSwaps: Array<{ name: string; stillValid: boolean }> };
    genericPhraseCount: number;             // 0 = mükemmel
  };

  // Faz 2 — KPI Framework
  kpiFramework?: {
    northStar: { metric: string; currentEstimate: string; target90Day: string };
    leading: Array<{ metric: string; target: string; measurementMethod: string }>;
    lagging: Array<{ metric: string; target: string; measurementMethod: string }>;
    reviewCadence: string;
  };

  // Faz 2 — Senaryo Bazlı Strateji
  strategyScenarios?: {
    conservative: { description: string; investmentLevel: string; expectedOutcome: string; timeframe: string; risk: string; probabilityWeight?: number; decisionCriteria?: string };
    recommended: { description: string; investmentLevel: string; expectedOutcome: string; timeframe: string; risk: string; probabilityWeight?: number; decisionCriteria?: string };
    aggressive: { description: string; investmentLevel: string; expectedOutcome: string; timeframe: string; risk: string; probabilityWeight?: number; decisionCriteria?: string };
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

// Agent 9 Output — Consumer Test (JTBD + Persona hybrid)
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

// JTBD Switch Interview scenario
export interface JTBDScenario {
  situationLabel: string;           // "When [situation]..."
  jobToBeDone: string;              // "I want to [job]..."
  desiredOutcome: string;           // "So I can [outcome]..."
  pushForces: string[];             // Push away from current solution
  pullForces: string[];             // Pull toward new solution
  anxieties: string[];              // Fear of change
  habits: string[];                 // Inertia / current habits
  strategyJobFitScore: number;      // 0-100: How well does the positioning solve this job?
  fitRationale: string;
}

export interface ConsumerTestOutput {
  overallViabilityScore: number;
  personas: ConsumerTestResult[];
  // JTBD scenarios (new — complements personas)
  jtbdScenarios?: JTBDScenario[];
  strongestFit: string;
  weakestFit: string;
  crossPersonaConcerns: string[];
  strategyRefinements: string[];
  marketReadiness: 'hazir' | 'iyilestirme_gerekli' | 'yeniden_dusunulmeli';
  // Evidence
  _evidence?: EvidenceChain[];
}

// Agent 10 Output — Brand Value Maximizer (replaces consultantIntroWriter)
export interface ValueMaximizerOutput {
  consultantIntro: string;
  diagnosisSummary: {
    perceptionVsReality: Array<{
      perception: string;
      reality: string;
      gap: string;
      recommendation: string;
    }>;
    blindSpots: string[];
    criticalMisalignment: string;
  };
  emotionalNarrative: {
    manifesto: string;
    transformationStory: string;
    oneLinePromise: string;
  };
  revenueImpact: {
    currentState: string;
    growthDrivers: Array<{
      driver: string;
      estimatedImpact: string;
      timeframe: string;
      // Evidence-based enhancement
      impactHypothesis?: string;
      assumptions?: string[];
      confidenceLevel?: 'verified' | 'grounded' | 'inferred' | 'speculative';
    }>;
    investmentToGrowthRatio: string;
  };
  // Evidence chains
  _evidence?: EvidenceChain[];
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
  valueMaximizerOutput?: ValueMaximizerOutput;
  // Evidence & calibration
  evidenceSummary?: EvidenceSummaryV2;
  frameworkScores?: FrameworkScore[];
  consensusResults?: Array<{
    question: string;
    consensusReached: boolean;
    consensusScore: number;
  }>;
  errors: Array<{ agent: string; error: string; timestamp: number }>;
  timings: Record<string, number>;
}

