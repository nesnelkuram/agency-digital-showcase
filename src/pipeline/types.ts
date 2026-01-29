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
    positioning: string;
    strengths: string[];
    weaknesses: string[];
  }>;
  marketTrends: string[];
  sectorBenchmarks: string[];
  opportunities: string[];
  threats: string[];
  searchQueries: string[];
  sourcesUsed: number;
  rawSnippets: string[];
}

// Agent 3 Output
export interface StrategistOutput {
  archetype: string;
  archetypeRationale: string;
  traits: string[];
  tone: string;
  voice: string;
  positioningStatement: string;
  targetAudience: string;
  differentiator: string;
  competitiveAdvantage: string;
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
    differentiator: string;
    competitiveAdvantage: string;
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

// Search result from Google Custom Search
export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}
