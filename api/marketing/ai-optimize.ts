import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';

export const config = {
  maxDuration: 300,
};

/**
 * POST /api/marketing/ai-optimize
 *
 * Meta kampanya optimizasyon onerileri uretir. Kampanya performans
 * verilerini ve breakdown kirilimlarini analiz ederek, somut
 * iyilestirme aksiyonlari olusturur.
 *
 * Body:
 *  - campaignId: string (zorunlu)
 *  - campaignData: { campaignName, objective, budget, adSets[] } (zorunlu)
 *  - breakdowns: { ageGender?, device?, placement?, region? } (opsiyonel)
 *  - dailyTrend: Array<{ date, spend, impressions, clicks, conversions, ctr }> (opsiyonel)
 *
 * Akis:
 *  1. Girdi dogrulamasi
 *  2. optimizationRecommender ajanini calistir
 *  3. Optimizasyon onerilerini dondur
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  try {
    const { campaignId, campaignData, breakdowns, dailyTrend } = req.body;

    // 1. Girdi dogrulamasi
    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: 'Zorunlu alan eksik: campaignId',
      });
    }

    if (!campaignData) {
      return res.status(400).json({
        success: false,
        error: 'Zorunlu alan eksik: campaignData',
      });
    }

    if (!campaignData.campaignName || !campaignData.objective) {
      return res.status(400).json({
        success: false,
        error: 'campaignData icinde campaignName ve objective zorunludur',
      });
    }

    if (!campaignData.adSets || !Array.isArray(campaignData.adSets) || campaignData.adSets.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'campaignData.adSets bos olamaz (en az 1 ad set gerekli)',
      });
    }

    const adSetCount = campaignData.adSets.length;
    const adCount = campaignData.adSets.reduce(
      (sum: number, as: any) => sum + (as.ads?.length || 0),
      0
    );

    console.log(
      `[ai-optimize] Optimizasyon analizi baslatiliyor: campaign="${campaignData.campaignName}", ` +
        `objective=${campaignData.objective}, adSets=${adSetCount}, ads=${adCount}, ` +
        `breakdowns=${breakdowns ? Object.keys(breakdowns).join(',') : 'yok'}, ` +
        `trendDays=${dailyTrend?.length || 0}`
    );
    const startTime = Date.now();

    // 2. AI ajanini calistir
    const { runOptimizationRecommender } = await import(
      '../../src/pipeline/marketing/agents/optimizationRecommender'
    );

    const result = await runOptimizationRecommender({
      campaignName: campaignData.campaignName,
      objective: campaignData.objective,
      budget: campaignData.budget || { totalBudget: 0, currency: 'TRY' },
      adSets: campaignData.adSets.map((as: any) => ({
        name: as.name || 'Isimsiz Ad Set',
        metaAdSetId: as.metaAdSetId || '',
        budget: as.budget || { daily: 0 },
        bidStrategy: as.bidStrategy || 'LOWEST_COST_WITHOUT_CAP',
        optimizationGoal: as.optimizationGoal,
        performanceSummary: as.performanceSummary || undefined,
        ads: (as.ads || []).map((ad: any) => ({
          name: ad.name || 'Isimsiz Reklam',
          metaAdId: ad.metaAdId || '',
          status: ad.status || 'ACTIVE',
          performanceSummary: ad.performanceSummary || undefined,
        })),
      })),
      breakdowns: breakdowns || undefined,
      dailyTrend: dailyTrend || undefined,
    });

    const totalDuration = Date.now() - startTime;

    console.log(
      `[ai-optimize] Optimizasyon tamamlandi: ${totalDuration}ms, ` +
        `recommendations=${result.recommendations.length}`
    );

    // 3. Sonucu dondur
    return res.status(200).json({
      success: true,
      analysis: {
        type: 'optimization_recommendations',
        campaignId,
        recommendations: result.recommendations,
        optimizationSummary: result.summary,
        generatedAt: new Date().toISOString(),
      },
      metadata: {
        agentsRun: ['optimizationRecommender'],
        totalDuration,
        adSetsAnalyzed: adSetCount,
        adsAnalyzed: adCount,
        breakdownsProvided: breakdowns ? Object.keys(breakdowns) : [],
        trendDays: dailyTrend?.length || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[ai-optimize] Hata:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Optimizasyon analizi basarisiz',
      details: error.stack?.split('\n').slice(0, 3),
    });
  }
});
