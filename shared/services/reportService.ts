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
  Timestamp,
  QueryConstraint,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  MarketingReport,
  ReportStatus,
  CreateReportData,
  ReportSummary,
  ReportKPI,
  ReportCampaignResult,
  ReportPlatformBreakdown,
} from '@/shared/types/report';

// ============================================
// KOLEKSIYON SABITLERI
// ============================================

const REPORTS_COLLECTION = 'marketing_reports';

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
// RAPOR CRUD
// ============================================

/**
 * Yeni rapor olusturur (status: 'generating').
 */
export async function createReport(
  tenantId: string,
  data: CreateReportData,
  userId: string,
  userName: string
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const reportData: Omit<MarketingReport, 'id'> = {
    projectId: data.projectId,
    title: data.title,
    type: data.type,
    status: 'generating',
    format: data.format,
    dateRange: data.dateRange,
    sections: data.sections,
    generatedBy: userId,
    generatedByName: userName,
    createdAt: Timestamp.now(),
  };

  const docRef = await addDoc(
    collection(db, REPORTS_COLLECTION),
    stripUndefined({ ...reportData, tenantId })
  );
  return docRef.id;
}

/**
 * Tum raporlari listeler (createdAt desc).
 */
export async function getReports(
  tenantId: string,
  projectId?: string
): Promise<MarketingReport[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('tenantId', '==', tenantId),
  ];

  if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, REPORTS_COLLECTION), ...constraints);

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as MarketingReport[];
  } catch (err: any) {
    // Composite index may not exist yet - fallback to unordered query
    if (projectId && err?.code === 'failed-precondition') {
      console.warn('[getReports] Index missing, falling back to unordered query');
      const fallbackQ = query(
        collection(db, REPORTS_COLLECTION),
        where('tenantId', '==', tenantId),
        where('projectId', '==', projectId)
      );
      const snapshot = await getDocs(fallbackQ);
      const reports = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as MarketingReport[];
      // Sort client-side
      return reports.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    }
    throw err;
  }
}

/**
 * Tek rapor getirir.
 */
export async function getReport(tenantId: string, id: string): Promise<MarketingReport | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, REPORTS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as MarketingReport;
}

/**
 * Raporu kismi gunceller.
 */
export async function updateReport(
  tenantId: string,
  id: string,
  data: Partial<MarketingReport>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, REPORTS_COLLECTION, id);
  await updateDoc(docRef, stripUndefined(data));
}

/**
 * Raporu siler.
 */
export async function deleteReport(tenantId: string, id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await deleteDoc(doc(db, REPORTS_COLLECTION, id));
}

/**
 * Duruma gore raporlari filtreler.
 */
export async function getReportsByStatus(
  tenantId: string,
  status: ReportStatus,
  projectId?: string
): Promise<MarketingReport[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('tenantId', '==', tenantId),
    where('status', '==', status),
  ];

  if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, REPORTS_COLLECTION), ...constraints);

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as MarketingReport[];
  } catch (err: any) {
    if (err?.code === 'failed-precondition') {
      console.warn('[getReportsByStatus] Index missing, falling back');
      const fallbackConstraints: QueryConstraint[] = [
        where('tenantId', '==', tenantId),
        where('status', '==', status),
      ];
      if (projectId) {
        fallbackConstraints.push(where('projectId', '==', projectId));
      }
      const fallbackQ = query(
        collection(db, REPORTS_COLLECTION),
        ...fallbackConstraints
      );
      const snapshot = await getDocs(fallbackQ);
      const reports = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as MarketingReport[];
      return reports.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    }
    throw err;
  }
}

/**
 * Raporu tamamlanmis olarak isaretler ve olusan icerikleri kaydeder.
 */
export async function completeReport(
  tenantId: string,
  id: string,
  results: {
    summary?: string;
    highlights?: string[];
    kpis?: ReportKPI[];
    campaignResults?: ReportCampaignResult[];
    platformBreakdown?: ReportPlatformBreakdown[];
    recommendations?: string[];
    fileUrl?: string;
    fileSize?: number;
  }
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, REPORTS_COLLECTION, id);
  await updateDoc(docRef, stripUndefined({
    status: 'ready' as ReportStatus,
    summary: results.summary,
    highlights: results.highlights,
    kpis: results.kpis,
    campaignResults: results.campaignResults,
    platformBreakdown: results.platformBreakdown,
    recommendations: results.recommendations,
    fileUrl: results.fileUrl,
    fileSize: results.fileSize,
    completedAt: Timestamp.now(),
  }));
}
