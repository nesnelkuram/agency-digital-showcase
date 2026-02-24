import '../_lib/env';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 300,
};

/**
 * GET /api/cron/marketing-optimize
 *
 * Vercel Cron endpoint — runs daily AI optimization for all active campaigns.
 * 1. Reads active campaigns from Firestore
 * 2. For each campaign with performance data, runs Performance Analyst + Platform Optimizer
 * 3. Saves optimization suggestions back to Firestore
 * 4. Checks budget thresholds and creates alerts
 *
 * Cron schedule: daily at 06:00 UTC (09:00 Istanbul)
 * Authorization: CRON_SECRET header
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  // Only allow GET (Vercel Cron uses GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const startTime = Date.now();
  const results: Array<{
    campaignId: string;
    campaignName: string;
    status: 'optimized' | 'skipped' | 'error';
    suggestionsCount?: number;
    alertsCreated?: number;
    error?: string;
  }> = [];

  try {
    // Initialize Firebase Admin
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (getApps().length === 0) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : undefined;

      initializeApp(
        serviceAccount
          ? { credential: cert(serviceAccount) }
          : { projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID }
      );
    }

    const db = getFirestore();

    // Dynamic imports for pipeline agents
    const { runPerformanceAnalyst } = await import('../../src/pipeline/marketing/agents/performanceAnalyst');
    const { runPlatformOptimizer } = await import('../../src/pipeline/marketing/agents/platformOptimizer');

    console.log('[cron-optimize] Starting daily optimization run...');

    // Step 1: Get all active campaigns
    const campaignsSnapshot = await db
      .collection('marketing_campaigns')
      .where('status', '==', 'active')
      .get();

    const campaigns = campaignsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`[cron-optimize] Found ${campaigns.length} active campaigns`);

    if (campaigns.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active campaigns to optimize',
        results: [],
        duration: Date.now() - startTime,
      });
    }

    // Step 2: Process each campaign
    for (const campaign of campaigns) {
      const campaignId = campaign.id;
      const campaignName = (campaign as any).name || 'Unnamed';

      try {
        // Get performance snapshots for the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sinceDate = sevenDaysAgo.toISOString().split('T')[0];

        const snapshotsQuery = await db
          .collection('performance_snapshots')
          .where('campaignId', '==', campaignId)
          .where('date', '>=', sinceDate)
          .orderBy('date', 'desc')
          .limit(30)
          .get();

        const snapshots = snapshotsQuery.docs.map((doc) => doc.data());

        // Skip if insufficient data
        if (snapshots.length < 2) {
          results.push({
            campaignId,
            campaignName,
            status: 'skipped',
          });
          console.log(`[cron-optimize] Skipping ${campaignName}: insufficient data (${snapshots.length} snapshots)`);
          continue;
        }

        // Run Performance Analyst
        const campaignData = campaign as any;
        const analysisOutput = await runPerformanceAnalyst({
          campaignName,
          objective: campaignData.objective || 'awareness',
          targetMetrics: {},
          snapshots: snapshots as any[],
          totalBudget: campaignData.budget?.totalBudget || 0,
          currency: campaignData.budget?.currency || 'TRY',
          daysRunning: snapshots.length,
        });

        // Run Platform Optimizer
        const optimizerOutput = await runPlatformOptimizer({
          campaign: {
            name: campaignName,
            objective: campaignData.objective || 'awareness',
            platforms: campaignData.platforms || [],
            currentBudget: campaignData.budget || {},
            currentBidStrategy: {},
            currentTargeting: campaignData.targeting || {},
          },
          analysisOutput,
        });

        // Step 3: Save optimization suggestions to Firestore
        let suggestionsCount = 0;
        const batch = db.batch();

        for (const change of optimizerOutput.changes) {
          const suggestionRef = db.collection('optimization_suggestions').doc();
          batch.set(suggestionRef, {
            campaignId,
            type: mapChangeTypeToOptimizationType(change.changeType),
            platform: change.platform,
            title: change.reason,
            description: `${change.currentSetting} → ${change.proposedSetting}`,
            impact: change.confidence === 'high' ? 'high' : change.confidence === 'medium' ? 'medium' : 'low',
            confidence: change.confidence === 'high' ? 0.9 : change.confidence === 'medium' ? 0.7 : 0.5,
            currentValue: change.currentSetting,
            suggestedValue: change.proposedSetting,
            expectedImprovement: change.expectedImpact,
            status: 'pending',
            createdAt: new Date(),
          });
          suggestionsCount++;
        }

        // Step 4: Check budget thresholds and create alerts
        let alertsCreated = 0;
        const budget = campaignData.budget;
        const performance = campaignData.performance;

        if (budget && performance) {
          const spentPercentage = (performance.totalSpend / budget.totalBudget) * 100;

          if (spentPercentage >= 90) {
            const alertRef = db.collection('marketing_alerts').doc();
            batch.set(alertRef, {
              projectId: campaignData.projectId || null,
              campaignId,
              campaignName,
              category: 'budget',
              severity: 'critical',
              title: `Butce %${Math.round(spentPercentage)} kullanildi`,
              message: `${campaignName} kampanyasinin butcesinin %${Math.round(spentPercentage)}'i harcandi. Toplam: ${budget.totalBudget} TL, Harcanan: ${Math.round(performance.totalSpend)} TL`,
              metric: 'budget_utilization',
              currentValue: spentPercentage,
              thresholdValue: 90,
              status: 'unread',
              createdAt: new Date(),
            });
            alertsCreated++;
          } else if (spentPercentage >= 80) {
            const alertRef = db.collection('marketing_alerts').doc();
            batch.set(alertRef, {
              projectId: campaignData.projectId || null,
              campaignId,
              campaignName,
              category: 'budget',
              severity: 'warning',
              title: `Butce %${Math.round(spentPercentage)} kullanildi`,
              message: `${campaignName} kampanyasinin butcesinin %${Math.round(spentPercentage)}'i harcandi.`,
              metric: 'budget_utilization',
              currentValue: spentPercentage,
              thresholdValue: 80,
              status: 'unread',
              createdAt: new Date(),
            });
            alertsCreated++;
          }

          // Check for low CTR
          if (performance.averageCTR < 1) {
            const alertRef = db.collection('marketing_alerts').doc();
            batch.set(alertRef, {
              projectId: campaignData.projectId || null,
              campaignId,
              campaignName,
              category: 'performance',
              severity: 'warning',
              title: `Dusuk CTR: %${performance.averageCTR.toFixed(2)}`,
              message: `${campaignName} kampanyasinin tiklanma orani %1'in altinda. Reklam metinleri veya hedefleme guncellenebilir.`,
              metric: 'ctr',
              currentValue: performance.averageCTR,
              thresholdValue: 1,
              status: 'unread',
              createdAt: new Date(),
            });
            alertsCreated++;
          }

          // Check for high CPA
          if (performance.averageCPA > 0 && performance.averageCPA > budget.totalBudget * 0.1) {
            const alertRef = db.collection('marketing_alerts').doc();
            batch.set(alertRef, {
              projectId: campaignData.projectId || null,
              campaignId,
              campaignName,
              category: 'performance',
              severity: 'warning',
              title: `Yuksek CPA: ${Math.round(performance.averageCPA)} TL`,
              message: `${campaignName} kampanyasinin edinim basina maliyeti yuksek. Hedefleme daraltilabilir.`,
              metric: 'cpa',
              currentValue: performance.averageCPA,
              thresholdValue: budget.totalBudget * 0.1,
              status: 'unread',
              createdAt: new Date(),
            });
            alertsCreated++;
          }
        }

        await batch.commit();

        results.push({
          campaignId,
          campaignName,
          status: 'optimized',
          suggestionsCount,
          alertsCreated,
        });

        console.log(`[cron-optimize] ${campaignName}: ${suggestionsCount} suggestions, ${alertsCreated} alerts`);

      } catch (err: any) {
        results.push({
          campaignId,
          campaignName,
          status: 'error',
          error: err.message,
        });
        console.error(`[cron-optimize] Error for ${campaignName}:`, err.message);
      }
    }

    const duration = Date.now() - startTime;
    const optimized = results.filter((r) => r.status === 'optimized').length;
    const totalSuggestions = results.reduce((sum, r) => sum + (r.suggestionsCount || 0), 0);
    const totalAlerts = results.reduce((sum, r) => sum + (r.alertsCreated || 0), 0);

    console.log(`[cron-optimize] Done in ${duration}ms: ${optimized}/${campaigns.length} optimized, ${totalSuggestions} suggestions, ${totalAlerts} alerts`);

    return res.status(200).json({
      success: true,
      summary: {
        totalCampaigns: campaigns.length,
        optimized,
        skipped: results.filter((r) => r.status === 'skipped').length,
        errors: results.filter((r) => r.status === 'error').length,
        totalSuggestions,
        totalAlerts,
      },
      results,
      duration,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[cron-optimize] Fatal error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Cron optimization failed',
      duration: Date.now() - startTime,
    });
  }
}

function mapChangeTypeToOptimizationType(changeType: string): string {
  const mapping: Record<string, string> = {
    budget: 'budget_shift',
    bid: 'bid_adjustment',
    targeting: 'targeting_narrow',
    creative: 'creative_change',
    placement: 'targeting_expand',
    schedule: 'schedule_change',
  };
  return mapping[changeType] || 'budget_shift';
}
