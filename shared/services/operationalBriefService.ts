import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  OperationalBrief,
  OperationalBriefInput,
  computeBriefCompletion,
} from '@/shared/types/operationalBrief';

const COLLECTION_NAME = 'operational_briefs';

/** Recursively strip undefined (Firestore rejects undefined values). */
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Share token — same convention as content plans / brand leads. */
export function generateShareToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

// ── CRUD ────────────────────────────────────────────────────────────────

export async function createOperationalBrief(
  tenantId: string,
  input: OperationalBriefInput
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const ref = doc(collection(db, COLLECTION_NAME));
  const now = Date.now();
  const brief: OperationalBrief = {
    ...input,
    id: ref.id,
    tenantId,
    status: 'draft',
    completionPercent: 0,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, stripUndefined(brief));
  return ref.id;
}

/**
 * Section-aware update. Recomputes completion%, auto-advances status
 * (draft → in_progress on first data, → completed at 100%).
 */
export async function updateOperationalBrief(
  id: string,
  updates: Partial<OperationalBrief>,
  opts?: { filledBy?: 'admin' | 'client' }
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const ref = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(ref);
  const current = snap.exists() ? (snap.data() as OperationalBrief) : null;
  const merged: Partial<OperationalBrief> = { ...(current || {}), ...updates };

  const completionPercent = computeBriefCompletion(merged);
  const now = Date.now();

  let status: OperationalBrief['status'] = merged.status ?? 'draft';
  if (completionPercent >= 100) status = 'completed';
  else if (completionPercent > 0) status = 'in_progress';

  const patch: Partial<OperationalBrief> = {
    ...updates,
    completionPercent,
    status,
    updatedAt: now,
  };
  if (opts?.filledBy) patch.filledBy = opts.filledBy;
  if (status === 'completed' && current?.status !== 'completed') patch.completedAt = now;

  await updateDoc(ref, stripUndefined(patch));
}

export async function getOperationalBrief(id: string): Promise<OperationalBrief | null> {
  if (!db) throw new Error('Firebase not initialized');
  const snap = await getDoc(doc(db, COLLECTION_NAME, id));
  return snap.exists() ? (snap.data() as OperationalBrief) : null;
}

/** Find the brief attached to a given lead (one brief per lead). */
export async function getBriefByLeadId(
  tenantId: string,
  leadId: string
): Promise<OperationalBrief | null> {
  if (!db) throw new Error('Firebase not initialized');
  const q = query(
    collection(db, COLLECTION_NAME),
    where('tenantId', '==', tenantId),
    where('leadId', '==', leadId),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : (snap.docs[0].data() as OperationalBrief);
}

/** Public access by share token (no auth) — for client-filled briefs. */
export async function getBriefByShareToken(token: string): Promise<OperationalBrief | null> {
  if (!db) throw new Error('Firebase not initialized');
  const q = query(collection(db, COLLECTION_NAME), where('shareToken', '==', token), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : (snap.docs[0].data() as OperationalBrief);
}

export async function listOperationalBriefs(tenantId: string): Promise<OperationalBrief[]> {
  if (!db) throw new Error('Firebase not initialized');
  const q = query(
    collection(db, COLLECTION_NAME),
    where('tenantId', '==', tenantId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as OperationalBrief);
}

export function subscribeToOperationalBrief(
  id: string,
  callback: (brief: OperationalBrief | null) => void
): () => void {
  if (!db) throw new Error('Firebase not initialized');
  return onSnapshot(doc(db, COLLECTION_NAME, id), (snap) => {
    callback(snap.exists() ? (snap.data() as OperationalBrief) : null);
  });
}

export async function deleteOperationalBrief(id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

/**
 * Ensure a brief exists for a lead; create one (with share token) if missing.
 * Returns the brief id. Use when admin opens the brief from a 'won' lead.
 */
export async function ensureBriefForLead(
  tenantId: string,
  lead: { id: string; businessName: string; sector: string }
): Promise<string> {
  const existing = await getBriefByLeadId(tenantId, lead.id);
  if (existing) return existing.id;
  return createOperationalBrief(tenantId, {
    leadId: lead.id,
    businessName: lead.businessName,
    sector: lead.sector,
    shareToken: generateShareToken(),
  });
}
