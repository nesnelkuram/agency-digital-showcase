import { getAdminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { PipelineRunDoc, AgentName, AgentProgress, PIPELINE_AGENTS } from '../../shared/types/pipelineRun';

const LOCK_DURATION_MS = 360_000; // 6 min — beyond Vercel 300s limit

function generateRunId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `run-${Date.now()}-${rand}`;
}

function generateLockId(): string {
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildInitialAgents(mode: 'full' | 'lite'): Record<AgentName, AgentProgress> {
  const pending: AgentProgress = { status: 'pending' };
  const skipped: AgentProgress = { status: 'skipped' };

  return {
    dataNormalizer: { ...pending },
    sectorResearch: mode === 'lite' ? { ...skipped } : { ...pending },
    brandStrategist: { ...pending },
    digitalPresenceAnalyzer: { ...pending },
    competitorDiscovery: { ...pending },
    brandChallenger: mode === 'lite' ? { ...skipped } : { ...pending },
    blogStrategyAdvisor: mode === 'lite' ? { ...skipped } : { ...pending },
    strategistRevision: mode === 'lite' ? { ...skipped } : { ...pending },
    strategySynthesizer: mode === 'lite' ? { ...skipped } : { ...pending },
    consultantIntroWriter: { ...pending },
    consumerTest: mode === 'lite' ? { ...skipped } : { ...pending },
  };
}

/**
 * Initialize a pipeline run. Handles concurrency:
 * - If a run is active (locked), returns existing runId
 * - If a stale run exists (lock expired), preserves checkpoint and starts new lock
 * - Otherwise creates a fresh run
 */
export async function initRun(
  leadId: string,
  input: PipelineRunDoc['input'],
  drInteractionId?: string,
): Promise<{ runId: string; resumed: boolean; checkpoint: PipelineRunDoc['checkpoint'] }> {
  const db = getAdminDb();
  const docRef = db.collection('brand_leads').doc(leadId);
  const now = Date.now();

  try {
    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      const data = doc.data();
      const existing = data?.pipelineRun as PipelineRunDoc | undefined;

      // Case 1: Active run with valid lock — return existing runId (idempotent)
      if (existing && existing.status === 'running' && existing.lockExpiresAt > now) {
        return { runId: existing.runId, resumed: false, checkpoint: existing.checkpoint };
      }

      // Case 2: Stale run (lock expired) — preserve checkpoint, new lock
      if (existing && existing.status === 'running' && existing.lockExpiresAt <= now) {
        const runId = generateRunId();
        const lockId = generateLockId();
        const updatedRun: PipelineRunDoc = {
          ...existing,
          runId,
          status: 'running',
          updatedAt: now,
          lockedBy: lockId,
          lockExpiresAt: now + LOCK_DURATION_MS,
          drInteractionId: drInteractionId || existing.drInteractionId,
          input,
        };
        // Reset non-completed agents to pending
        for (const [name, progress] of Object.entries(updatedRun.agents)) {
          if (progress.status === 'running') {
            updatedRun.agents[name as AgentName] = { status: 'pending' };
          }
        }
        tx.update(docRef, { pipelineRun: updatedRun });
        return { runId, resumed: true, checkpoint: existing.checkpoint };
      }

      // Case 3: No run or completed/failed — fresh run
      const runId = generateRunId();
      const lockId = generateLockId();
      const newRun: PipelineRunDoc = {
        runId,
        status: 'running',
        startedAt: now,
        updatedAt: now,
        lockedBy: lockId,
        lockExpiresAt: now + LOCK_DURATION_MS,
        agents: buildInitialAgents(input.mode),
        checkpoint: {},
        input,
        drInteractionId,
        errors: [],
        timings: {},
      };
      tx.update(docRef, { pipelineRun: newRun });
      return { runId, resumed: false, checkpoint: null };
    });

    return result;
  } catch (error) {
    console.error('[checkpoint] initRun failed:', error);
    // Return a runId anyway so the pipeline can proceed without checkpointing
    return { runId: generateRunId(), resumed: false, checkpoint: null };
  }
}

/**
 * Mark an agent as running (for UI progress)
 */
export async function markAgentRunning(leadId: string, runId: string, agentName: AgentName): Promise<void> {
  const db = getAdminDb();
  const now = Date.now();

  try {
    await db.collection('brand_leads').doc(leadId).update({
      [`pipelineRun.agents.${agentName}`]: { status: 'running', startedAt: now },
      'pipelineRun.updatedAt': now,
    });
  } catch (error) {
    console.error(`[checkpoint] markAgentRunning(${agentName}) failed:`, error);
  }
}

/**
 * Save agent output to checkpoint and mark as completed
 */
export async function checkpointAgent(
  leadId: string,
  runId: string,
  agentName: AgentName,
  checkpointKey: string,
  output: any,
  durationMs: number,
): Promise<void> {
  const db = getAdminDb();
  const now = Date.now();

  try {
    await db.collection('brand_leads').doc(leadId).update({
      [`pipelineRun.agents.${agentName}`]: {
        status: 'completed',
        completedAt: now,
        durationMs,
      },
      [`pipelineRun.checkpoint.${checkpointKey}`]: output,
      [`pipelineRun.timings.${agentName}`]: durationMs,
      'pipelineRun.updatedAt': now,
    });
  } catch (error) {
    console.error(`[checkpoint] checkpointAgent(${agentName}) failed:`, error);
  }
}

/**
 * Mark an agent as failed
 */
export async function markAgentFailed(
  leadId: string,
  runId: string,
  agentName: AgentName,
  errorMessage: string,
  durationMs: number,
): Promise<void> {
  const db = getAdminDb();
  const now = Date.now();

  try {
    await db.collection('brand_leads').doc(leadId).update({
      [`pipelineRun.agents.${agentName}`]: {
        status: 'failed',
        completedAt: now,
        durationMs,
        error: errorMessage,
      },
      [`pipelineRun.errors`]: FieldValue.arrayUnion({ agent: agentName, error: errorMessage, timestamp: now }),
      'pipelineRun.updatedAt': now,
    });
  } catch (error) {
    console.error(`[checkpoint] markAgentFailed(${agentName}) failed:`, error);
  }
}

/**
 * Mark an agent as skipped
 */
export async function markAgentSkipped(leadId: string, runId: string, agentName: AgentName): Promise<void> {
  const db = getAdminDb();
  const now = Date.now();

  try {
    await db.collection('brand_leads').doc(leadId).update({
      [`pipelineRun.agents.${agentName}`]: { status: 'skipped' },
      'pipelineRun.updatedAt': now,
    });
  } catch (error) {
    console.error(`[checkpoint] markAgentSkipped(${agentName}) failed:`, error);
  }
}

/**
 * Load existing checkpoint for resume
 */
export async function loadCheckpoint(leadId: string): Promise<PipelineRunDoc | null> {
  const db = getAdminDb();

  try {
    const doc = await db.collection('brand_leads').doc(leadId).get();
    const data = doc.data();
    return (data?.pipelineRun as PipelineRunDoc) || null;
  } catch (error) {
    console.error('[checkpoint] loadCheckpoint failed:', error);
    return null;
  }
}

/**
 * Mark pipeline run as completed. Nulls checkpoint data, keeps agents metadata.
 */
export async function completeRun(leadId: string, runId: string): Promise<void> {
  const db = getAdminDb();
  const now = Date.now();

  try {
    await db.collection('brand_leads').doc(leadId).update({
      'pipelineRun.status': 'completed',
      'pipelineRun.completedAt': now,
      'pipelineRun.updatedAt': now,
      'pipelineRun.checkpoint': null, // Clean up large data immediately
    });
  } catch (error) {
    console.error('[checkpoint] completeRun failed:', error);
  }
}

/**
 * Mark pipeline run as failed
 */
export async function failRun(leadId: string, runId: string, errorMessage: string): Promise<void> {
  const db = getAdminDb();
  const now = Date.now();

  try {
    await db.collection('brand_leads').doc(leadId).update({
      'pipelineRun.status': 'failed',
      'pipelineRun.updatedAt': now,
      [`pipelineRun.errors`]: FieldValue.arrayUnion({ agent: 'pipeline', error: errorMessage, timestamp: now }),
    });
  } catch (error) {
    console.error('[checkpoint] failRun failed:', error);
  }
}

/**
 * Store drInteractionId in checkpoint
 */
export async function checkpointDrInteractionId(leadId: string, runId: string, drInteractionId: string): Promise<void> {
  const db = getAdminDb();

  try {
    await db.collection('brand_leads').doc(leadId).update({
      'pipelineRun.drInteractionId': drInteractionId,
      'pipelineRun.updatedAt': Date.now(),
    });
  } catch (error) {
    console.error('[checkpoint] checkpointDrInteractionId failed:', error);
  }
}
