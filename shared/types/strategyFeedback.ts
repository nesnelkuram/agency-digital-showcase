/**
 * Strategy Feedback Loop — Periodic re-evaluation of brand strategy health.
 * Firestore collection: strategy_feedback_loops/{leadId}
 */

export interface StrategyBaseline {
  positioningStatement: string;
  archetype: string;
  differentiator: string;
  competitiveAdvantage: string;
  competitors: string[];
  marketSize: string;
  consumerTrends: string[];
  overallConfidence: number;
  analyzedAt: number;
}

export interface HealthComponentScores {
  competitorStability: number;   // 0-100
  marketAlignment: number;       // 0-100
  positioningRelevance: number;  // 0-100
  trendAlignment: number;        // 0-100
}

export interface StrategyHealth {
  score: number;                 // 0-100 composite
  trend: 'improving' | 'stable' | 'declining';
  lastCalculatedAt: number;
  componentScores: HealthComponentScores;
}

export interface FeedbackSchedule {
  intervalDays: number;          // default 14
  nextRunAt: number;
  lastRunAt: number | null;
  maxRuns: number;               // default 12
  runsCompleted: number;
}

export interface FeedbackLoopConfig {
  agentsToRerun: string[];       // default: ['sectorResearch', 'competitorDiscovery', 'brandChallenger']
  alertThreshold: number;        // default 60
  criticalThreshold: number;     // default 40
}

export interface StrategyFeedbackLoop {
  leadId: string;
  tenantId: string;
  businessName: string;
  sector: string;
  status: 'active' | 'paused' | 'expired';
  createdAt: number;
  updatedAt: number;
  schedule: FeedbackSchedule;
  baseline: StrategyBaseline;
  currentHealth: StrategyHealth;
  config: FeedbackLoopConfig;
}

// Subcollection: strategy_feedback_loops/{leadId}/checkups/{checkupId}

export interface TrendShift {
  trend: string;
  direction: 'new' | 'growing' | 'fading';
  relevance: string;
}

export interface PositioningDrift {
  stillValid: boolean;
  driftScore: number;            // 0-100 (0 = no drift, 100 = completely invalid)
  reasons: string[];
}

export interface CheckupFindings {
  newCompetitors: string[];
  lostCompetitors: string[];
  trendShifts: TrendShift[];
  positioningDrift: PositioningDrift;
  challengerAlerts: string[];
}

export interface FeedbackCheckup {
  id: string;
  runNumber: number;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt: number | null;
  durationMs: number | null;
  agentsRun: string[];
  findings: CheckupFindings;
  healthScore: {
    score: number;
    componentScores: HealthComponentScores;
    delta: number;               // change from previous checkup
  };
  summary: string;               // AI-generated 3-5 sentence executive summary
}

// Health score weights
export const HEALTH_WEIGHTS = {
  competitorStability: 0.25,
  marketAlignment: 0.25,
  positioningRelevance: 0.30,
  trendAlignment: 0.20,
} as const;

export const DEFAULT_FEEDBACK_CONFIG: FeedbackLoopConfig = {
  agentsToRerun: ['sectorResearch', 'competitorDiscovery', 'brandChallenger'],
  alertThreshold: 60,
  criticalThreshold: 40,
};
