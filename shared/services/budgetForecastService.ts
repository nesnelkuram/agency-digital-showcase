import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
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
  BudgetForecast,
  BudgetForecastSummary,
  ForecastStatus,
} from '@/shared/types/budgetForecast';

// ============================================
// KOLEKSIYON SABITLERI
// ============================================

const FORECASTS_COLLECTION = 'budget_forecasts';

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
// TAHMIN KAYDETME (UPSERT by campaignId)
// ============================================

/**
 * Butce tahminini kaydeder veya gunceller.
 * campaignId bazinda upsert yapar (setDoc merge).
 */
export async function saveForecast(
  data: Omit<BudgetForecast, 'id' | 'createdAt'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const docId = `forecast_${data.campaignId}`;
  const docRef = doc(db, FORECASTS_COLLECTION, docId);

  await setDoc(
    docRef,
    {
      ...stripUndefined(data),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return docId;
}

// ============================================
// TEKIL TAHMIN GETIR
// ============================================

/**
 * Bir kampanyanin en guncel butce tahminini getirir.
 */
export async function getForecast(
  campaignId: string
): Promise<BudgetForecast | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docId = `forecast_${campaignId}`;
  const docRef = doc(db, FORECASTS_COLLECTION, docId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as BudgetForecast;
}

// ============================================
// TUM TAHMINLER
// ============================================

/**
 * Tum butce tahminlerini getirir, opsiyonel olarak projectId'ye gore filtreler.
 */
export async function getForecasts(
  projectId?: string
): Promise<BudgetForecast[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [];

  if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, FORECASTS_COLLECTION), ...constraints);

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as BudgetForecast[];
  } catch (err: any) {
    // Composite index eksik olabilir — fallback
    if (projectId && err?.code === 'failed-precondition') {
      console.warn('[getForecasts] Index eksik, siralanmamis sorguya donuluyor');
      const fallbackQ = query(
        collection(db, FORECASTS_COLLECTION),
        where('projectId', '==', projectId)
      );
      const snapshot = await getDocs(fallbackQ);
      return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as BudgetForecast[];
    }
    throw err;
  }
}

// ============================================
// OZET ISTATISTIKLER
// ============================================

/**
 * Butce tahmin ozet istatistiklerini hesaplar.
 */
export async function getForecastSummary(
  projectId?: string
): Promise<BudgetForecastSummary> {
  if (!db) throw new Error('Firebase not initialized');

  const forecasts = await getForecasts(projectId);

  let totalBudgetAllCampaigns = 0;
  let totalSpentAllCampaigns = 0;
  let campaignsAtRisk = 0;
  let campaignsDepleted = 0;
  let totalDailySpendRate = 0;
  let activeForecastCount = 0;

  for (const f of forecasts) {
    totalBudgetAllCampaigns += f.totalBudget || 0;
    totalSpentAllCampaigns += f.spentToDate || 0;

    if (f.status === 'warning' || f.status === 'critical') {
      campaignsAtRisk++;
    }

    if (f.status === 'depleted') {
      campaignsDepleted++;
    }

    if (f.dailySpendRate > 0 && f.totalBudget > 0) {
      totalDailySpendRate += f.dailySpendRate;
      activeForecastCount++;
    }
  }

  // Ortalama gunluk burn rate (yuzde olarak)
  const averageBurnRate =
    activeForecastCount > 0 && totalBudgetAllCampaigns > 0
      ? ((totalDailySpendRate / activeForecastCount) / (totalBudgetAllCampaigns / activeForecastCount)) * 100
      : 0;

  return {
    totalBudgetAllCampaigns,
    totalSpentAllCampaigns,
    campaignsAtRisk,
    campaignsDepleted,
    averageBurnRate,
  };
}

// ============================================
// TAHMIN SILME
// ============================================

/**
 * Bir kampanyanin butce tahminini siler.
 */
export async function deleteForecast(campaignId: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docId = `forecast_${campaignId}`;
  await deleteDoc(doc(db, FORECASTS_COLLECTION, docId));
}
