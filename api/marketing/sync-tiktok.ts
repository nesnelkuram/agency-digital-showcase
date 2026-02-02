import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 120,
};

const TIKTOK_API = 'https://business-api.tiktok.com/open_api/v1.3';

/**
 * POST /api/marketing/sync-tiktok
 *
 * Fetches campaigns from TikTok Marketing API.
 * Body: { accessToken, advertiserId, dateRange? }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accessToken, advertiserId, dateRange } = req.body;

    if (!accessToken || !advertiserId) {
      return res.status(400).json({ error: 'Missing: accessToken, advertiserId' });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const range = dateRange || {
      start: thirtyDaysAgo.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };

    console.log(`[sync-tiktok] Fetching campaigns for advertiser ${advertiserId}`);

    // 1. Fetch campaigns
    const campaignsRes = await fetch(
      `${TIKTOK_API}/campaign/get/?advertiser_id=${advertiserId}&page_size=50`,
      { headers: { 'Access-Token': accessToken } }
    );
    const campaignsData = await campaignsRes.json();

    if (campaignsData.code !== 0) {
      throw new Error(`TikTok API error: ${campaignsData.message}`);
    }

    const tiktokCampaigns = campaignsData.data?.list || [];
    console.log(`[sync-tiktok] Found ${tiktokCampaigns.length} campaigns`);

    // 2. Fetch integrated report for metrics
    let metricsMap = new Map<string, any>();
    try {
      const reportRes = await fetch(`${TIKTOK_API}/report/integrated/get/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Token': accessToken,
        },
        body: JSON.stringify({
          advertiser_id: advertiserId,
          report_type: 'BASIC',
          dimensions: ['campaign_id'],
          data_level: 'AUCTION_CAMPAIGN',
          metrics: ['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm', 'conversion', 'cost_per_conversion'],
          start_date: range.start,
          end_date: range.end,
          page_size: 100,
        }),
      });
      const reportData = await reportRes.json();
      if (reportData.code === 0 && reportData.data?.list) {
        for (const row of reportData.data.list) {
          metricsMap.set(String(row.dimensions.campaign_id), row.metrics);
        }
      }
    } catch (err: any) {
      console.warn('[sync-tiktok] Failed to fetch report:', err.message);
    }

    // 3. Map campaigns
    const campaigns = tiktokCampaigns.map((tc: any) => {
      const metrics = metricsMap.get(String(tc.campaign_id));
      const spend = parseFloat(metrics?.spend || '0');
      const impressions = parseInt(metrics?.impressions || '0');
      const clicks = parseInt(metrics?.clicks || '0');
      const conversions = parseInt(metrics?.conversion || '0');

      return {
        tiktokCampaignId: String(tc.campaign_id),
        name: tc.campaign_name,
        objective: mapTikTokObjective(tc.objective_type),
        status: mapTikTokStatus(tc.operation_status),
        platforms: ['tiktok'],
        budget: {
          totalBudget: parseFloat(tc.budget || '0'),
          dailyLimit: parseFloat(tc.daily_budget || '0'),
          currency: 'TRY',
          platformSplit: { tiktok: 100 },
        },
        schedule: {
          startDate: tc.create_time || new Date().toISOString(),
          endDate: null,
        },
        performance: metrics ? {
          totalSpend: spend,
          totalImpressions: impressions,
          totalClicks: clicks,
          totalConversions: conversions,
          averageCTR: parseFloat(metrics.ctr || '0'),
          averageCPA: parseFloat(metrics.cost_per_conversion || '0'),
          overallROAS: 0,
          platformBreakdown: {
            tiktok: { spend, impressions, clicks, conversions },
          },
        } : null,
      };
    });

    console.log(`[sync-tiktok] Synced ${campaigns.length} campaigns`);

    return res.status(200).json({
      success: true,
      synced: campaigns.length,
      campaigns,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[sync-tiktok] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

function mapTikTokObjective(obj: string): string {
  const map: Record<string, string> = {
    TRAFFIC: 'traffic',
    CONVERSIONS: 'sales',
    APP_INSTALL: 'app_installs',
    REACH: 'awareness',
    VIDEO_VIEWS: 'video_views',
    LEAD_GENERATION: 'leads',
    ENGAGEMENT: 'engagement',
    CATALOG_SALES: 'sales',
  };
  return map[obj] || 'awareness';
}

function mapTikTokStatus(status: string): string {
  const map: Record<string, string> = {
    ENABLE: 'active',
    DISABLE: 'paused',
    DELETE: 'completed',
  };
  return map[status] || 'draft';
}
