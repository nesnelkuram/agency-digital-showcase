import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';

export const config = {
  maxDuration: 300,
};

/**
 * POST /api/marketing/optimize
 *
 * Runs the AI optimization pipeline (Performance Analyst + Platform Optimizer)
 * for a specific campaign or all active campaigns.
 *
 * Body:
 *  - campaignId: string (optional — specific campaign)
 *  - performanceData: PerformanceSnapshot[] (required)
 *  - campaignInfo: { name, objective, platforms, currentBudget, currentBidStrategy, currentTargeting }
 *  - targetMetrics: { targetCPA?, targetROAS?, targetReach? } (optional)
 *  - trigger: 'manual' | 'scheduled' (optional)
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
    const {
      campaignId,
      performanceData,
      campaignInfo,
      targetMetrics,
      trigger,
    } = req.body;

    if (!performanceData || !Array.isArray(performanceData) || performanceData.length === 0) {
      return res.status(400).json({
        error: 'Missing required field: performanceData (non-empty array of PerformanceSnapshot)',
      });
    }

    if (!campaignInfo) {
      return res.status(400).json({
        error: 'Missing required field: campaignInfo',
      });
    }

    console.log(`[optimize] Starting optimization for campaign=${campaignId || 'all'}, trigger=${trigger || 'manual'}, snapshots=${performanceData.length}`);

    // Dynamic imports for pipeline agents
    const { runPerformanceAnalyst } = await import('../../src/pipeline/marketing/agents/performanceAnalyst');
    const { runPlatformOptimizer } = await import('../../src/pipeline/marketing/agents/platformOptimizer');

    // Step 1: Run Performance Analyst
    console.log('[optimize] Step 1: Running Performance Analyst...');
    const startAnalysis = Date.now();

    const analysisOutput = await runPerformanceAnalyst({
      campaignName: campaignInfo.name || 'Unnamed',
      objective: campaignInfo.objective || 'awareness',
      targetMetrics: targetMetrics || {},
      snapshots: performanceData,
      totalBudget: campaignInfo.totalBudget || 0,
      currency: campaignInfo.currency || 'TRY',
      daysRunning: campaignInfo.daysRunning || performanceData.length,
    });

    const analysisDuration = Date.now() - startAnalysis;
    console.log(`[optimize] Performance Analyst done in ${analysisDuration}ms, score: ${analysisOutput.overallScore}`);

    // Step 2: Run Platform Optimizer (feeds from analyst)
    console.log('[optimize] Step 2: Running Platform Optimizer...');
    const startOptimize = Date.now();

    const optimizerOutput = await runPlatformOptimizer({
      campaign: {
        name: campaignInfo.name || 'Unnamed',
        objective: campaignInfo.objective || 'awareness',
        platforms: campaignInfo.platforms || [],
        currentBudget: campaignInfo.currentBudget || {},
        currentBidStrategy: campaignInfo.currentBidStrategy || {},
        currentTargeting: campaignInfo.currentTargeting || {},
      },
      analysisOutput,
    });

    const optimizeDuration = Date.now() - startOptimize;
    console.log(`[optimize] Platform Optimizer done in ${optimizeDuration}ms, changes: ${optimizerOutput.changes.length}`);

    return res.status(200).json({
      success: true,
      campaignId,
      analysis: analysisOutput,
      optimization: optimizerOutput,
      metadata: {
        trigger: trigger || 'manual',
        analysisDuration,
        optimizeDuration,
        totalDuration: analysisDuration + optimizeDuration,
        snapshotsAnalyzed: performanceData.length,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[optimize] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Optimization pipeline failed',
      details: error.stack?.split('\n').slice(0, 3),
    });
  }
});
