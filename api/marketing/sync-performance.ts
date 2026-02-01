import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 120,
};

/**
 * POST /api/marketing/sync-performance
 *
 * Fetches latest performance data from connected ad platforms
 * for active campaigns and returns the snapshot data.
 *
 * Body:
 *  - campaignId: string (optional — sync specific campaign)
 *  - platform: AdPlatform (optional — sync specific platform)
 *  - dateRange: { start: string; end: string } (optional)
 *  - platformAccount: object (account credentials)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      campaignId,
      platform,
      dateRange,
      platformAccount,
      platformCampaignId,
    } = req.body;

    if (!platformCampaignId || !platform || !platformAccount) {
      return res.status(400).json({
        error: 'Missing required fields: platformCampaignId, platform, platformAccount',
      });
    }

    // Default to last 7 days
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const range = dateRange || {
      start: weekAgo.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };

    console.log(`[sync-performance] Syncing ${platform} campaign=${platformCampaignId} range=${range.start}—${range.end}`);

    const { getAdapter } = await import('../../src/platforms/registry');

    const adapter = getAdapter(platform);
    if (!adapter) {
      return res.status(400).json({
        error: `Platform adapter not available: ${platform}`,
      });
    }

    const snapshots = await adapter.getPerformance(
      platformCampaignId,
      range,
      platformAccount
    );

    // Tag with campaign ID
    const taggedSnapshots = snapshots.map(s => ({
      ...s,
      campaignId: campaignId || '',
      platform,
    }));

    console.log(`[sync-performance] Got ${taggedSnapshots.length} snapshots`);

    return res.status(200).json({
      success: true,
      platform,
      campaignId,
      dateRange: range,
      snapshotsCount: taggedSnapshots.length,
      snapshots: taggedSnapshots,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[sync-performance] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Performance sync failed',
    });
  }
}
