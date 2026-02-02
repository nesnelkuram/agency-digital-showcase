/**
 * Pipeline Checkpointing & Real-time Progress Types
 *
 * Shared between backend (firebase-admin) and frontend (firebase/firestore).
 * Stored as `pipelineRun` field on brand_leads/{leadId} document.
 */

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type PipelineRunStatus = 'running' | 'completed' | 'failed';

export const PIPELINE_AGENTS = [
  'dataNormalizer',
  'sectorResearch',
  'brandStrategist',
  'digitalPresenceAnalyzer',
  'competitorDiscovery',
  'brandChallenger',
  'blogStrategyAdvisor',
  'strategistRevision',
  'strategySynthesizer',
  'consultantIntroWriter',
  'consumerTest',
] as const;

export type AgentName = (typeof PIPELINE_AGENTS)[number];

export interface AgentProgress {
  status: AgentStatus;
  startedAt?: number;    // Date.now() timestamp
  completedAt?: number;
  durationMs?: number;
  error?: string;
}

export interface PipelineRunDoc {
  // Run identification
  runId: string;
  status: PipelineRunStatus;
  startedAt: number;     // Date.now() timestamp
  updatedAt: number;
  completedAt?: number;

  // Concurrency lock
  lockedBy: string;      // Serverless invocation ID
  lockExpiresAt: number; // startedAt + 360_000 (6 min, beyond 300s Vercel limit)

  // Agent-level progress (for UI streaming)
  agents: Record<AgentName, AgentProgress>;

  // Checkpoint data (for resume) — nulled on completion
  checkpoint: {
    normalizedData?: any;
    websiteData?: any;
    researchFindings?: any;
    strategistOutput?: any;
    challengerOutput?: any;
    blogAdvisorOutput?: any;
    revisedStrategistOutput?: any;
    digitalPresence?: any;
    competitorDiscovery?: any;
    synthesizedAnalysis?: any;
    consultantIntro?: string;
    consumerTest?: any;
  } | null;

  // Input snapshot (for resume without client re-sending)
  input: {
    contact: { name: string; businessName: string; email: string };
    sector: string;
    wizard: any;
    requestedServices: any[];
    leadId: string;
    mode: 'full' | 'lite';
    adminNotes?: string;
    businessContext?: any;
  };

  // Deep Research tracking
  drInteractionId?: string;

  // Error/timing metadata
  errors: Array<{ agent: string; error: string; timestamp: number }>;
  timings: Record<string, number>;
}
