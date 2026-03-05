/**
 * Audit Trail Service — Tamper-evident hash chain logging
 *
 * Each audit entry includes a SHA-256 hash of the previous entry,
 * forming an append-only chain. Any modification breaks the chain.
 */

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

// ============================================
// Types
// ============================================

export type AuditAction =
  // Marketing agent
  | 'agent.tool_executed'
  | 'agent.approval_requested'
  | 'agent.approval_granted'
  | 'agent.approval_rejected'
  | 'agent.campaign_created'
  | 'agent.campaign_updated'
  | 'agent.ad_created'
  | 'agent.budget_changed'
  // Workflow
  | 'workflow.instance_created'
  | 'workflow.step_completed'
  | 'workflow.step_reassigned'
  // Content
  | 'content.plan_submitted'
  | 'content.plan_approved'
  | 'content.plan_rejected'
  // User
  | 'user.invited'
  | 'user.role_changed'
  | 'user.suspended'
  // System
  | 'system.config_changed';

export interface AuditEntry {
  id?: string;
  tenantId: string;
  action: AuditAction;
  actorId: string;
  actorName?: string;
  targetType: string;        // e.g. 'campaign', 'adset', 'workflow', 'user'
  targetId: string;
  description: string;
  metadata?: Record<string, unknown>;
  previousHash: string;      // SHA-256 of previous entry (or 'GENESIS' for first)
  hash: string;              // SHA-256 of this entry
  timestamp: any;            // Firestore serverTimestamp
  createdAt: number;         // Client timestamp (ms) for ordering
}

const COLLECTION = 'audit_trail';

// ============================================
// Hash Functions
// ============================================

/**
 * Compute SHA-256 hash of audit entry content.
 * Uses Web Crypto API (available in browsers + Node 18+).
 */
async function computeHash(data: {
  tenantId: string;
  action: string;
  actorId: string;
  targetType: string;
  targetId: string;
  description: string;
  metadata?: Record<string, unknown>;
  previousHash: string;
  createdAt: number;
}): Promise<string> {
  const payload = JSON.stringify(data);

  // Browser environment
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Node.js fallback
  const { createHash } = await import('crypto');
  return createHash('sha256').update(payload).digest('hex');
}

// ============================================
// Service
// ============================================

/**
 * Get the hash of the most recent audit entry for a tenant.
 * Returns 'GENESIS' if no entries exist.
 */
async function getLastHash(tenantId: string): Promise<string> {
  const q = query(
    collection(db, COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return 'GENESIS';
  return snap.docs[0].data().hash || 'GENESIS';
}

/**
 * Log an audit entry with hash chain integrity.
 */
export async function logAudit(params: {
  tenantId: string;
  action: AuditAction;
  actorId: string;
  actorName?: string;
  targetType: string;
  targetId: string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const now = Date.now();
  const previousHash = await getLastHash(params.tenantId);

  const hashInput = {
    tenantId: params.tenantId,
    action: params.action,
    actorId: params.actorId,
    targetType: params.targetType,
    targetId: params.targetId,
    description: params.description,
    metadata: params.metadata,
    previousHash,
    createdAt: now,
  };

  const hash = await computeHash(hashInput);

  const entry: Omit<AuditEntry, 'id'> = {
    tenantId: params.tenantId,
    action: params.action,
    actorId: params.actorId,
    actorName: params.actorName,
    targetType: params.targetType,
    targetId: params.targetId,
    description: params.description,
    metadata: params.metadata,
    previousHash,
    hash,
    timestamp: serverTimestamp(),
    createdAt: now,
  };

  const ref = await addDoc(collection(db, COLLECTION), entry);
  return ref.id;
}

/**
 * Verify the integrity of the audit chain for a tenant.
 * Returns { valid, brokenAt } — brokenAt is the index where chain breaks.
 */
export async function verifyChain(
  tenantId: string,
  maxEntries = 1000
): Promise<{ valid: boolean; checked: number; brokenAt?: number }> {
  const q = query(
    collection(db, COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'asc'),
    limit(maxEntries)
  );

  const snap = await getDocs(q);
  const entries = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AuditEntry[];

  if (entries.length === 0) return { valid: true, checked: 0 };

  let expectedPrevHash = 'GENESIS';

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Check previous hash link
    if (entry.previousHash !== expectedPrevHash) {
      return { valid: false, checked: i + 1, brokenAt: i };
    }

    // Recompute hash and compare
    const recomputed = await computeHash({
      tenantId: entry.tenantId,
      action: entry.action,
      actorId: entry.actorId,
      targetType: entry.targetType,
      targetId: entry.targetId,
      description: entry.description,
      metadata: entry.metadata,
      previousHash: entry.previousHash,
      createdAt: entry.createdAt,
    });

    if (recomputed !== entry.hash) {
      return { valid: false, checked: i + 1, brokenAt: i };
    }

    expectedPrevHash = entry.hash;
  }

  return { valid: true, checked: entries.length };
}

/**
 * Get recent audit entries for a tenant (for display).
 */
export async function getRecentAudits(
  tenantId: string,
  count = 50
): Promise<AuditEntry[]> {
  const q = query(
    collection(db, COLLECTION),
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc'),
    limit(count)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditEntry));
}

// ============================================
// Server-side variant (for API routes using Admin SDK)
// ============================================

export async function logAuditServer(
  adminDb: any,
  getFieldValueFn: () => any,
  params: {
    tenantId: string;
    action: AuditAction;
    actorId: string;
    actorName?: string;
    targetType: string;
    targetId: string;
    description: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string> {
  const now = Date.now();

  // Get last hash from server
  const lastSnap = await adminDb
    .collection(COLLECTION)
    .where('tenantId', '==', params.tenantId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  const previousHash = lastSnap.empty ? 'GENESIS' : (lastSnap.docs[0].data().hash || 'GENESIS');

  const hashInput = {
    tenantId: params.tenantId,
    action: params.action,
    actorId: params.actorId,
    targetType: params.targetType,
    targetId: params.targetId,
    description: params.description,
    metadata: params.metadata,
    previousHash,
    createdAt: now,
  };

  const hash = await computeHash(hashInput);

  const FieldValue = getFieldValueFn();
  const entry = {
    tenantId: params.tenantId,
    action: params.action,
    actorId: params.actorId,
    actorName: params.actorName || null,
    targetType: params.targetType,
    targetId: params.targetId,
    description: params.description,
    metadata: params.metadata || null,
    previousHash,
    hash,
    timestamp: FieldValue.serverTimestamp(),
    createdAt: now,
  };

  const ref = await adminDb.collection(COLLECTION).add(entry);
  return ref.id;
}
