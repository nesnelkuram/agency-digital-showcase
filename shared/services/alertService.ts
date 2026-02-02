import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  MarketingAlert,
  CreateAlertData,
  AlertFilters,
  AlertStatus,
} from '@/shared/types/marketingAlert';

// ============================================
// KOLEKSIYON SABITI
// ============================================

const ALERTS_COLLECTION = 'marketing_alerts';

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
// UYARI OLUSTURMA
// ============================================

export async function createAlert(data: CreateAlertData): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const alertData: Omit<MarketingAlert, 'id'> = {
    ...stripUndefined(data),
    status: 'unread' as AlertStatus,
    createdAt: Timestamp.now(),
  };

  const docRef = await addDoc(
    collection(db, ALERTS_COLLECTION),
    alertData
  );
  return docRef.id;
}

// ============================================
// UYARI LISTELEME VE FILTRELEME
// ============================================

export async function getAlerts(
  projectId?: string,
  filters?: AlertFilters,
  maxAlerts: number = 50
): Promise<MarketingAlert[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [];

  if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  }

  if (filters?.status?.length) {
    constraints.push(where('status', 'in', filters.status));
  }

  if (filters?.severity?.length) {
    constraints.push(where('severity', 'in', filters.severity));
  }

  if (filters?.category?.length) {
    constraints.push(where('category', 'in', filters.category));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(maxAlerts));

  const q = query(collection(db, ALERTS_COLLECTION), ...constraints);

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MarketingAlert[];
  } catch (err: any) {
    // Composite index may not exist yet - fallback
    if (err?.code === 'failed-precondition') {
      console.warn('[getAlerts] Index missing, falling back to basic query');
      const fallbackQ = projectId
        ? query(
            collection(db, ALERTS_COLLECTION),
            where('projectId', '==', projectId),
            orderBy('createdAt', 'desc'),
            limit(maxAlerts)
          )
        : query(
            collection(db, ALERTS_COLLECTION),
            orderBy('createdAt', 'desc'),
            limit(maxAlerts)
          );
      const snapshot = await getDocs(fallbackQ);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MarketingAlert[];
    }
    throw err;
  }
}

// ============================================
// OKUNMAMIS UYARI SAYISI
// ============================================

export async function getUnreadAlertCount(projectId?: string): Promise<number> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('status', '==', 'unread'),
  ];

  if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  }

  const q = query(collection(db, ALERTS_COLLECTION), ...constraints);

  try {
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch {
    // Fallback: use getDocs if getCountFromServer is not available
    const docsSnap = await getDocs(q);
    return docsSnap.size;
  }
}

// ============================================
// DURUM GUNCELLEME
// ============================================

export async function markAsRead(alertId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, ALERTS_COLLECTION, alertId);
  await updateDoc(docRef, {
    status: 'read',
  });
}

export async function markAllAsRead(projectId?: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('status', '==', 'unread'),
  ];

  if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  }

  const q = query(collection(db, ALERTS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => {
    batch.update(doc(db!, ALERTS_COLLECTION, docSnap.id), {
      status: 'read',
    });
  });

  await batch.commit();
}

export async function dismissAlert(alertId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, ALERTS_COLLECTION, alertId);
  await updateDoc(docRef, {
    status: 'dismissed',
  });
}

export async function resolveAlert(alertId: string, userId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, ALERTS_COLLECTION, alertId);
  await updateDoc(docRef, {
    status: 'resolved',
    resolvedAt: serverTimestamp(),
    resolvedBy: userId,
  });
}

// ============================================
// ESKI UYARILARI TEMIZLEME
// ============================================

export async function deleteOldAlerts(daysOld: number): Promise<number> {
  if (!db) throw new Error('Firebase not initialized');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

  const q = query(
    collection(db, ALERTS_COLLECTION),
    where('createdAt', '<', cutoffTimestamp),
    limit(500) // Batch limit
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return 0;

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => {
    batch.delete(doc(db!, ALERTS_COLLECTION, docSnap.id));
  });

  await batch.commit();
  return snapshot.size;
}

// ============================================
// YARDIMCI UYARI OLUSTURUCULAR
// ============================================

export async function createBudgetAlert(
  campaignId: string,
  campaignName: string,
  spentPercentage: number,
  projectId?: string
): Promise<string> {
  const severity = spentPercentage >= 95
    ? 'critical'
    : spentPercentage >= 80
      ? 'warning'
      : 'info';

  const title = spentPercentage >= 95
    ? `Butce neredeyse tukendi: ${campaignName}`
    : spentPercentage >= 80
      ? `Butce uyarisi: ${campaignName}`
      : `Butce bilgisi: ${campaignName}`;

  const message = `${campaignName} kampanyasinin butcesinin %${spentPercentage.toFixed(0)}'i harcandi.${
    spentPercentage >= 95
      ? ' Kampanya yakin zamanda duracak.'
      : spentPercentage >= 80
        ? ' Butce artirimi degerlendirilmeli.'
        : ''
  }`;

  return createAlert({
    projectId,
    campaignId,
    campaignName,
    category: 'budget',
    severity,
    title,
    message,
    metric: 'Butce Kullanimi',
    currentValue: spentPercentage,
    thresholdValue: severity === 'critical' ? 95 : severity === 'warning' ? 80 : 50,
    actionUrl: `/admin/marketing/campaigns/${campaignId}`,
  });
}

export async function createPerformanceAlert(
  campaignId: string,
  campaignName: string,
  metric: string,
  currentValue: number,
  threshold: number,
  projectId?: string
): Promise<string> {
  const isBelow = currentValue < threshold;
  const severity = isBelow ? 'warning' : 'info';

  const title = isBelow
    ? `Dusuk ${metric}: ${campaignName}`
    : `${metric} hedefi asildi: ${campaignName}`;

  const message = isBelow
    ? `${campaignName} kampanyasinin ${metric} metrigi ${currentValue.toFixed(2)} ile esik deger ${threshold.toFixed(2)}'in altinda.`
    : `${campaignName} kampanyasinin ${metric} metrigi ${currentValue.toFixed(2)} ile esik deger ${threshold.toFixed(2)}'i asti.`;

  return createAlert({
    projectId,
    campaignId,
    campaignName,
    category: 'performance',
    severity,
    title,
    message,
    metric,
    currentValue,
    thresholdValue: threshold,
    actionUrl: `/admin/marketing/campaigns/${campaignId}`,
  });
}
