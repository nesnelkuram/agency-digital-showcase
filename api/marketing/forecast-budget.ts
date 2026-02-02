import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const config = {
  maxDuration: 120,
};

// ============================================
// Firebase Admin baslat
// ============================================

function getAdminDb() {
  if (getApps().length === 0) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(serviceAccount) });
    } else if (projectId) {
      initializeApp({ projectId });
    } else {
      throw new Error('FIREBASE_SERVICE_ACCOUNT veya FIREBASE_PROJECT_ID ortam degiskeni gerekli');
    }
  }

  return getFirestore();
}

// ============================================
// POST /api/marketing/forecast-budget
// ============================================

/**
 * POST /api/marketing/forecast-budget
 *
 * Bir kampanyanin butce tahminini AI ile olusturur.
 *
 * Body:
 *  - campaignId: string
 *
 * Akis:
 *  1. Kampanya verisini Firestore'dan cek
 *  2. Performans snapshot'larini getir (gunluk harcama verisi)
 *  3. budgetForecaster ajanini calistir
 *  4. Sonucu budget_forecasts koleksiyonuna kaydet
 *  5. Forecast verisini dondur
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { campaignId } = req.body;

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Zorunlu alan eksik: campaignId',
      });
    }

    console.log(`[forecast-budget] Butce tahmini baslatiliyor: campaign=${campaignId}`);
    const startTime = Date.now();

    // 1. Firebase Admin ile Firestore'a ulas
    const adminDb = getAdminDb();

    // 2. Kampanya verisini cek
    const campaignDoc = await adminDb
      .collection('marketing_campaigns')
      .doc(campaignId)
      .get();

    if (!campaignDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Kampanya bulunamadi',
      });
    }

    const campaignData = campaignDoc.data()!;

    // 3. Performans snapshot'larini getir (gunluk harcama verisi)
    const snapshotsQuery = await adminDb
      .collection('performance_snapshots')
      .where('campaignId', '==', campaignId)
      .orderBy('date', 'desc')
      .limit(90)
      .get();

    const dailySpendHistory = snapshotsQuery.docs.map((d) => {
      const data = d.data();
      return {
        date: data.date as string,
        spend: (data.spend as number) || 0,
      };
    });

    // Toplam harcama hesapla
    const spentToDate = dailySpendHistory.reduce((sum, d) => sum + d.spend, 0);
    const totalBudget = campaignData.budget?.totalBudget || 0;
    const currency = campaignData.budget?.currency || 'TRY';

    // Platformlari belirle
    const platforms = (campaignData.platforms || []) as string[];
    const objective = (campaignData.objective || 'awareness') as string;
    const campaignName = (campaignData.name || 'Isimsiz Kampanya') as string;

    // Zamanlama bilgisi
    const scheduledEndDate = campaignData.schedule?.endDate || undefined;

    console.log(
      `[forecast-budget] Kampanya: ${campaignName}, Butce: ${totalBudget} ${currency}, ` +
      `Harcanan: ${spentToDate.toFixed(2)} ${currency}, Veri gunleri: ${dailySpendHistory.length}`
    );

    // 4. AI ajanini calistir
    const { runBudgetForecaster } = await import(
      '../../src/pipeline/marketing/agents/budgetForecaster'
    );

    const aiResult = await runBudgetForecaster({
      campaignName,
      totalBudget,
      currency,
      spentToDate,
      dailySpendHistory,
      scheduledEndDate,
      objective,
      platforms,
    });

    // 5. Durum belirle
    const daysRemaining = aiResult.daysRemaining;
    let status: 'current' | 'warning' | 'critical' | 'depleted';
    if (daysRemaining <= 0) {
      status = 'depleted';
    } else if (daysRemaining <= 3) {
      status = 'critical';
    } else if (daysRemaining <= 7) {
      status = 'warning';
    } else {
      status = 'current';
    }

    // Burndown verisini olustur (AI projeksiyonu + gercek veri)
    const burndownData = aiResult.burndownProjection.map((bp) => {
      const actualDay = dailySpendHistory.find((d) => d.date === bp.date);
      return {
        date: bp.date,
        projected: bp.projectedRemaining,
        actual: actualDay ? totalBudget - spentToDate + actualDay.spend : undefined,
      };
    });

    // 6. Forecast verisini Firestore'a kaydet
    const forecastDocId = `forecast_${campaignId}`;
    const forecastData = {
      campaignId,
      campaignName,
      projectId: campaignData.projectId || null,
      totalBudget,
      spentToDate,
      remainingBudget: totalBudget - spentToDate,
      dailySpendRate: aiResult.dailySpendRate,
      projectedDepletionDate: aiResult.projectedDepletionDate,
      daysRemaining: aiResult.daysRemaining,
      scheduledEndDate: scheduledEndDate || null,
      status,
      burndownData,
      recommendations: aiResult.recommendations,
      confidence: aiResult.confidence,
      createdAt: new Date(),
    };

    await adminDb
      .collection('budget_forecasts')
      .doc(forecastDocId)
      .set(forecastData, { merge: true });

    const totalDuration = Date.now() - startTime;

    console.log(
      `[forecast-budget] Tahmin tamamlandi: ${totalDuration}ms, ` +
      `durum=${status}, kalan=${daysRemaining} gun, guven=${aiResult.confidence}`
    );

    return res.status(200).json({
      success: true,
      forecast: {
        id: forecastDocId,
        ...forecastData,
      },
      aiAnalysis: {
        weeklyTrend: aiResult.weeklyTrend,
        riskLevel: aiResult.riskLevel,
        confidence: aiResult.confidence,
      },
      metadata: {
        agentsRun: ['budgetForecaster'],
        totalDuration,
        snapshotDays: dailySpendHistory.length,
      },
    });
  } catch (error: any) {
    console.error('[forecast-budget] Hata:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Butce tahmini basarisiz',
    });
  }
}
