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
  Timestamp,
  QueryConstraint,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  AutomationRule,
  CreateAutomationRuleData,
  UpdateAutomationRuleData,
  RuleStatus,
  RuleExecutionLog,
} from '@/shared/types/automationRule';

// ============================================
// KOLEKSIYON SABITLERI
// ============================================

const RULES_COLLECTION = 'automation_rules';
const EXECUTION_LOGS_COLLECTION = 'rule_execution_logs';

// ============================================
// YARDIMCI FONKSIYONLAR
// ============================================

function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Timestamp) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        result[key] = stripUndefined(val);
      }
    }
    return result;
  }
  return obj;
}

// ============================================
// OTOMASYON KURALI CRUD
// ============================================

export async function createRule(
  tenantId: string,
  data: CreateAutomationRuleData,
  userId: string,
  userName: string
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const ruleData = {
    ...stripUndefined(data),
    tenantId,
    status: 'active' as RuleStatus,
    totalExecutions: 0,
    totalTriggered: 0,
    createdBy: userId,
    createdByName: userName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(
    collection(db, RULES_COLLECTION),
    ruleData
  );
  return docRef.id;
}

export async function getRules(tenantId: string, projectId?: string): Promise<AutomationRule[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('tenantId', '==', tenantId),
  ];

  if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, RULES_COLLECTION), ...constraints);

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AutomationRule[];
  } catch (err: any) {
    // Composite index eksik olabilir — sirasiz sorguya geri don
    if (projectId && err?.code === 'failed-precondition') {
      console.warn('[getRules] Index missing, falling back to unordered query');
      const fallbackQ = query(
        collection(db, RULES_COLLECTION),
        where('tenantId', '==', tenantId),
        where('projectId', '==', projectId)
      );
      const snapshot = await getDocs(fallbackQ);
      const rules = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AutomationRule[];
      // istemci tarafinda siralama
      return rules.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    }
    throw err;
  }
}

export async function getRule(tenantId: string, id: string): Promise<AutomationRule | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, RULES_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as AutomationRule;
}

export async function updateRule(
  tenantId: string,
  id: string,
  data: UpdateAutomationRuleData
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, RULES_COLLECTION, id);
  await updateDoc(docRef, {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRule(tenantId: string, id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await deleteDoc(doc(db, RULES_COLLECTION, id));
}

// ============================================
// KURAL DURUM YONETIMI
// ============================================

export async function toggleRuleStatus(
  tenantId: string,
  id: string,
  status: RuleStatus
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, RULES_COLLECTION, id);
  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// CALISTIRMA LOGU ISLEMLERI
// ============================================

export async function logRuleExecution(
  tenantId: string,
  log: Omit<RuleExecutionLog, 'id'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const logData = {
    ...stripUndefined(log),
    tenantId,
    executedAt: serverTimestamp(),
  };

  const docRef = await addDoc(
    collection(db, EXECUTION_LOGS_COLLECTION),
    logData
  );
  return docRef.id;
}

export async function getRuleExecutionLogs(
  tenantId: string,
  ruleId: string,
  pageSize: number = 50
): Promise<RuleExecutionLog[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('tenantId', '==', tenantId),
    where('ruleId', '==', ruleId),
    orderBy('executedAt', 'desc'),
    limit(pageSize),
  ];

  const q = query(collection(db, EXECUTION_LOGS_COLLECTION), ...constraints);

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as RuleExecutionLog[];
  } catch (err: any) {
    // Composite index eksik olabilir
    if (err?.code === 'failed-precondition') {
      console.warn('[getRuleExecutionLogs] Index missing, falling back to unordered query');
      const fallbackQ = query(
        collection(db, EXECUTION_LOGS_COLLECTION),
        where('tenantId', '==', tenantId),
        where('ruleId', '==', ruleId),
        limit(pageSize)
      );
      const snapshot = await getDocs(fallbackQ);
      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as RuleExecutionLog[];
      return logs.sort((a, b) => {
        const aTime = a.executedAt?.toMillis?.() || 0;
        const bTime = b.executedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    }
    throw err;
  }
}

export async function getRecentExecutionLogs(
  tenantId: string,
  projectId?: string,
  pageSize: number = 50
): Promise<RuleExecutionLog[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('tenantId', '==', tenantId),
  ];

  if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  }

  constraints.push(orderBy('executedAt', 'desc'));
  constraints.push(limit(pageSize));

  const q = query(collection(db, EXECUTION_LOGS_COLLECTION), ...constraints);

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as RuleExecutionLog[];
  } catch (err: any) {
    // Composite index eksik olabilir
    if (projectId && err?.code === 'failed-precondition') {
      console.warn('[getRecentExecutionLogs] Index missing, falling back to unordered query');
      const fallbackQ = query(
        collection(db, EXECUTION_LOGS_COLLECTION),
        where('tenantId', '==', tenantId),
        where('projectId', '==', projectId),
        limit(pageSize)
      );
      const snapshot = await getDocs(fallbackQ);
      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as RuleExecutionLog[];
      return logs.sort((a, b) => {
        const aTime = a.executedAt?.toMillis?.() || 0;
        const bTime = b.executedAt?.toMillis?.() || 0;
        return bTime - aTime;
      });
    }
    throw err;
  }
}
