import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth';

export const config = {
  maxDuration: 120,
};

/**
 * POST /api/marketing/execute-campaign
 *
 * Publishes an approved campaign to the selected platforms.
 * Each platform is published in parallel; partial failures are reported.
 *
 * Body:
 *  - campaignId: string
 *  - platforms: AdPlatform[] (optional — defaults to campaign.platforms)
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { campaignId, platforms } = req.body;

    if (!campaignId) {
      return res.status(400).json({ error: 'Missing required field: campaignId' });
    }

    console.log(`[execute-campaign] Starting execution for campaign=${campaignId}`);

    // Dynamic import platform registry
    const { getAdapter, isAdapterAvailable } = await import('../../src/platforms/registry');

    // We don't have direct Firestore access in edge, so the client
    // sends campaign data in the body, or we respond with instructions.
    // In practice the client side handles Firestore reads, then calls this endpoint
    // with the campaign data to execute.
    const {
      campaignData,
    } = req.body;

    if (!campaignData) {
      return res.status(400).json({
        error: 'Campaign data must be provided in request body',
      });
    }

    const targetPlatforms = platforms || campaignData.platforms || [];
    const results: Record<string, { success: boolean; platformCampaignId?: string; error?: string }> = {};

    // Execute per platform in parallel
    const execPromises = targetPlatforms.map(async (platform: string) => {
      if (!isAdapterAvailable(platform as any)) {
        results[platform] = {
          success: false,
          error: `Platform adapter not available: ${platform}`,
        };
        return;
      }

      const adapter = getAdapter(platform as any);
      if (!adapter) {
        results[platform] = { success: false, error: `Adapter not found: ${platform}` };
        return;
      }

      try {
        // In a real scenario, we'd fetch the platform account from Firestore.
        // The client should provide account credentials or we fetch from env.
        const accountData = req.body.platformAccounts?.[platform];
        if (!accountData) {
          results[platform] = {
            success: false,
            error: `No platform account provided for ${platform}`,
          };
          return;
        }

        const result = await adapter.createCampaign(campaignData, accountData);
        results[platform] = {
          success: result.success,
          platformCampaignId: result.platformCampaignId,
          error: result.error,
        };
      } catch (err: any) {
        results[platform] = { success: false, error: err.message };
      }
    });

    await Promise.all(execPromises);

    const allSuccess = Object.values(results).every(r => r.success);
    const someSuccess = Object.values(results).some(r => r.success);

    console.log(`[execute-campaign] Results: ${JSON.stringify(results)}`);

    return res.status(200).json({
      success: someSuccess,
      allSuccess,
      campaignId,
      platformResults: results,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[execute-campaign] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Campaign execution failed',
    });
  }
});
