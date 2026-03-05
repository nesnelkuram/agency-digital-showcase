/**
 * Background Agent Service — CRUD + execution management
 *
 * Firestore collections:
 * - background_agents: Agent definitions
 * - background_agent_executions: Execution history (subcollection)
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  BackgroundAgent,
  BackgroundAgentStatus,
  AgentExecution,
} from '../types/backgroundAgent';

const AGENTS_COLLECTION = 'background_agents';
const EXECUTIONS_SUBCOLLECTION = 'executions';

// ============================================
// Agent CRUD
// ============================================

export async function createAgent(
  agent: Omit<BackgroundAgent, 'id' | 'createdAt' | 'updatedAt' | 'consecutiveErrors'>
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(collection(db, AGENTS_COLLECTION), {
    ...agent,
    consecutiveErrors: 0,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function getAgent(agentId: string): Promise<BackgroundAgent | null> {
  const snap = await getDoc(doc(db, AGENTS_COLLECTION, agentId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as BackgroundAgent;
}

export async function updateAgent(
  agentId: string,
  updates: Partial<BackgroundAgent>
): Promise<void> {
  await updateDoc(doc(db, AGENTS_COLLECTION, agentId), {
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function setAgentStatus(
  agentId: string,
  status: BackgroundAgentStatus
): Promise<void> {
  await updateDoc(doc(db, AGENTS_COLLECTION, agentId), {
    status,
    updatedAt: Date.now(),
  });
}

export async function deleteAgent(agentId: string): Promise<void> {
  await deleteDoc(doc(db, AGENTS_COLLECTION, agentId));
}

// ============================================
// Agent Queries
// ============================================

export async function getAgentsByTenant(tenantId: string): Promise<BackgroundAgent[]> {
  const q = query(
    collection(db, AGENTS_COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BackgroundAgent));
}

export async function getActiveAgents(tenantId: string): Promise<BackgroundAgent[]> {
  const q = query(
    collection(db, AGENTS_COLLECTION),
    where('tenantId', '==', tenantId),
    where('status', '==', 'active'),
    orderBy('updatedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BackgroundAgent));
}

export function subscribeToAgents(
  tenantId: string,
  callback: (agents: BackgroundAgent[]) => void
): () => void {
  const q = query(
    collection(db, AGENTS_COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('updatedAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as BackgroundAgent)));
  });
}

// ============================================
// Execution History
// ============================================

export async function logExecution(
  agentId: string,
  execution: Omit<AgentExecution, 'id' | 'agentId'>
): Promise<string> {
  const ref = await addDoc(
    collection(db, AGENTS_COLLECTION, agentId, EXECUTIONS_SUBCOLLECTION),
    { ...execution, agentId }
  );
  return ref.id;
}

export async function getRecentExecutions(
  agentId: string,
  count = 20
): Promise<AgentExecution[]> {
  const q = query(
    collection(db, AGENTS_COLLECTION, agentId, EXECUTIONS_SUBCOLLECTION),
    orderBy('startedAt', 'desc'),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AgentExecution));
}

// ============================================
// Budget Management
// ============================================

export async function checkAndIncrementBudget(agentId: string): Promise<boolean> {
  const agent = await getAgent(agentId);
  if (!agent) return false;

  const today = new Date().toISOString().slice(0, 10);
  const budget = { ...agent.budget };

  // Reset daily counter if new day
  if (budget.lastResetDate !== today) {
    budget.currentDailyRuns = 0;
    budget.lastResetDate = today;
  }

  // Reset monthly counter if new month
  const currentMonth = today.slice(0, 7);
  const lastMonth = budget.lastResetDate?.slice(0, 7);
  if (currentMonth !== lastMonth) {
    budget.currentMonthlyRuns = 0;
  }

  // Check limits
  if (budget.currentDailyRuns >= budget.maxRunsPerDay) return false;
  if (budget.currentMonthlyRuns >= budget.maxRunsPerMonth) return false;

  // Increment
  budget.currentDailyRuns++;
  budget.currentMonthlyRuns++;

  await updateDoc(doc(db, AGENTS_COLLECTION, agentId), {
    budget,
    updatedAt: Date.now(),
  });

  return true;
}

// ============================================
// Auto-pause on consecutive errors
// ============================================

const MAX_CONSECUTIVE_ERRORS = 3;

export async function recordExecutionResult(
  agentId: string,
  success: boolean,
  executionData: Omit<AgentExecution, 'id' | 'agentId'>
): Promise<void> {
  await logExecution(agentId, executionData);

  const agent = await getAgent(agentId);
  if (!agent) return;

  if (success) {
    await updateDoc(doc(db, AGENTS_COLLECTION, agentId), {
      consecutiveErrors: 0,
      lastExecutionId: executionData.status,
      'schedule.lastRunAt': Date.now(),
      updatedAt: Date.now(),
    });
  } else {
    const newCount = agent.consecutiveErrors + 1;
    const updates: Record<string, any> = {
      consecutiveErrors: newCount,
      updatedAt: Date.now(),
    };

    if (newCount >= MAX_CONSECUTIVE_ERRORS) {
      updates.status = 'error';
    }

    await updateDoc(doc(db, AGENTS_COLLECTION, agentId), updates);
  }
}
