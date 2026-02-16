import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth';

export const config = {
  maxDuration: 300,
};

/**
 * POST /api/marketing/generate-campaign
 *
 * Standalone AI campaign builder. Generates a complete campaign
 * from a brief text + parameters using the campaignArchitect agent.
 *
 * Body:
 *  - brief: string (free text describing campaign goal)
 *  - objective: string (awareness, traffic, engagement, leads, sales, etc.)
 *  - platforms: string[] (meta, google, tiktok, linkedin)
 *  - totalBudget: number
 *  - currency: 'TRY' | 'USD' | 'EUR' (default: TRY)
 *  - duration: number (days, default: 30)
 *  - businessName?: string
 *  - sector?: string
 *  - brandContext?: string
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      brief,
      objective,
      platforms,
      totalBudget,
      currency = 'TRY',
      duration = 30,
      businessName,
      sector,
      brandContext,
    } = req.body;

    if (!brief || !objective || !platforms?.length || !totalBudget) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: brief, objective, platforms, totalBudget',
      });
    }

    console.log(`[generate-campaign] Starting AI campaign generation: objective=${objective}, platforms=${platforms.join(',')}, budget=${totalBudget} ${currency}`);

    const startTime = Date.now();

    // Dynamic import to avoid @/ alias issues on Vercel
    const { runCampaignArchitect } = await import('../../src/pipeline/marketing/agents/campaignArchitect');

    const campaign = await runCampaignArchitect({
      brief,
      objective,
      platforms,
      totalBudget,
      currency,
      duration,
      businessName,
      sector,
      brandContext,
    });

    const totalDuration = Date.now() - startTime;

    console.log(`[generate-campaign] Campaign generated in ${totalDuration}ms: ${campaign.name}`);

    return res.status(200).json({
      success: true,
      campaign,
      rationale: campaign.rationale,
      confidence: campaign.confidence,
      metadata: {
        agentsRun: ['campaignArchitect'],
        totalDuration,
      },
    });

  } catch (error: any) {
    console.error('[generate-campaign] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Campaign generation failed',
    });
  }
});
