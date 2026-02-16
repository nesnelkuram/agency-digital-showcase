import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth';

export const config = {
  maxDuration: 120,
};

/**
 * POST /api/marketing/analyze-campaign
 *
 * Meta kampanya kurulum analizi yapar. Kampanya yapisini, hedefleme,
 * butce, kreatifler, ad set yapisi ve zamanlamayi degerlendirir.
 *
 * Body:
 *  - campaignId: string (zorunlu)
 *  - campaignData: SetupAnalysisInput (zorunlu — kampanya yapisi)
 *
 * Akis:
 *  1. Girdi dogrulamasi
 *  2. campaignSetupAnalyzer ajanini calistir
 *  3. Analiz sonucunu CampaignAIAnalysis formatinda dondur
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
    const { campaignId, campaignData } = req.body;

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
        error: 'Zorunlu alan eksik: campaignData (kampanya yapisi)',
      });
    }

    if (!campaignData.campaignName || !campaignData.objective) {
      return res.status(400).json({
        success: false,
        error: 'campaignData icinde campaignName ve objective zorunludur',
      });
    }

    console.log(
      `[analyze-campaign] Kurulum analizi baslatiliyor: campaign="${campaignData.campaignName}", ` +
        `objective=${campaignData.objective}, adSets=${campaignData.adSetCount || 0}`
    );
    const startTime = Date.now();

    // 2. AI ajanini calistir
    const { runCampaignSetupAnalyzer } = await import(
      '../../src/pipeline/marketing/agents/campaignSetupAnalyzer'
    );

    const result = await runCampaignSetupAnalyzer({
      campaignName: campaignData.campaignName,
      objective: campaignData.objective,
      status: campaignData.status || 'ACTIVE',
      platforms: campaignData.platforms || ['facebook', 'instagram'],
      budget: campaignData.budget || { totalBudget: 0, currency: 'TRY' },
      schedule: campaignData.schedule || { startDate: new Date().toISOString().split('T')[0] },
      adSetCount: campaignData.adSetCount || (campaignData.adSets?.length ?? 0),
      adSets: campaignData.adSets || [],
      performance: campaignData.performance || undefined,
    });

    const totalDuration = Date.now() - startTime;

    console.log(
      `[analyze-campaign] Analiz tamamlandi: ${totalDuration}ms, ` +
        `score=${result.overallScore}, categories=${result.categories.length}, quickWins=${result.quickWins.length}`
    );

    // 3. Sonucu CampaignAIAnalysis formatinda dondur
    return res.status(200).json({
      success: true,
      analysis: {
        type: 'setup_analysis',
        campaignId,
        setupScore: result.overallScore,
        setupSummary: result.summary,
        categories: result.categories,
        quickWins: result.quickWins,
        generatedAt: new Date().toISOString(),
      },
      metadata: {
        agentsRun: ['campaignSetupAnalyzer'],
        totalDuration,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[analyze-campaign] Hata:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Kampanya kurulum analizi basarisiz',
      details: error.stack?.split('\n').slice(0, 3),
    });
  }
});
