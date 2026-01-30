// Multi-Agent Brand Analysis Pipeline Types

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

// Agent 4 Output
export interface ChallengerOutput {
  counterPosition: string;
  alternativeArchetype: string;
  alternativeArchetypeRationale: string;
  challengePoints: string[];
  alternativePositionings: string[];
  riskAssessment: string;
  blindSpots: string[];
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
  synthesisRationale: string;
}

// Pipeline state passed through agents
export interface PipelineState {
  input: PipelineInput;
  normalizedData?: NormalizedData;
  researchFindings?: ResearchFindings;
  strategistOutput?: StrategistOutput;
  challengerOutput?: ChallengerOutput;
  synthesizedAnalysis?: SynthesizedAnalysis;
  errors: Array<{ agent: string; error: string; timestamp: number }>;
  timings: Record<string, number>;
}

