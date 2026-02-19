import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';

export const config = {
  maxDuration: 120,
};

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * POST /api/marketing/sync-performance
 *
 * Fetches daily performance snapshots from Meta Marketing API
 * for one or more campaigns. Returns data for frontend to save.
 *
 * Body:
 *  - accessToken: string
 *  - campaigns: Array<{ id: string; metaCampaignId: string }>
 *  - dateRange?: { start: string; end: string } (defaults to last 7 days)
 *  - level?: 'campaign' | 'adset' | 'ad' (defaults to 'campaign')
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accessToken, campaigns, dateRange, level } = req.body as {
      accessToken: string;
      campaigns: Array<{ id: string; metaCampaignId: string }>;
      dateRange?: { start: string; end: string };
      level?: 'campaign' | 'adset' | 'ad';
    };

    if (!accessToken || !campaigns?.length) {
      return res.status(400).json({
        error: 'Missing required fields: accessToken, campaigns',
      });
    }

    // Default to last 7 days
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const range = dateRange || {
      start: weekAgo.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };

    const timeRange = JSON.stringify({ since: range.start, until: range.end });

    const effectiveLevel = level || 'campaign';

    console.log(`[sync-performance] Syncing ${campaigns.length} campaigns at ${effectiveLevel} level, range=${range.start}—${range.end}`);

    const allSnapshots: any[] = [];
    const campaignPerformance: Record<string, any> = {};

    // Fetch insights for each campaign
    for (const camp of campaigns) {
      try {
        // Build fields list based on level
        let fields = 'date_start,date_stop,impressions,reach,clicks,ctr,spend,actions,cost_per_action_type,cpc,cpm,frequency,unique_clicks,unique_ctr,cost_per_unique_click,quality_ranking,engagement_rate_ranking,conversion_rate_ranking,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions';
        if (effectiveLevel === 'adset') {
          fields = 'adset_id,adset_name,' + fields;
        } else if (effectiveLevel === 'ad') {
          fields = 'ad_id,ad_name,' + fields;
        }

        let insightsUrl = `${META_API_BASE}/${camp.metaCampaignId}/insights?access_token=${accessToken}&fields=${fields}&time_range=${encodeURIComponent(timeRange)}&time_increment=1`;
        if (effectiveLevel !== 'campaign') {
          insightsUrl += `&level=${effectiveLevel}`;
        }

        const insightsRes = await fetch(insightsUrl);
        const insightsData = await insightsRes.json();

        if (insightsData.error) {
          console.warn(`[sync-performance] Error for campaign ${camp.metaCampaignId}:`, insightsData.error.message);
          continue;
        }

        const rows = insightsData.data || [];

        // Aggregate totals for this campaign
        let totalSpend = 0;
        let totalImpressions = 0;
        let totalClicks = 0;
        let totalConversions = 0;
        let totalReach = 0;

        rows.forEach((row: any) => {
          const conversions = extractConversions(row.actions);
          const cpa = extractCPA(row.cost_per_action_type);
          const spend = parseFloat(row.spend || '0');
          const impressions = parseInt(row.impressions || '0');
          const clicks = parseInt(row.clicks || '0');
          const reach = parseInt(row.reach || '0');

          totalSpend += spend;
          totalImpressions += impressions;
          totalClicks += clicks;
          totalConversions += conversions;
          totalReach += reach;

          allSnapshots.push({
            campaignId: camp.id,
            platform: 'meta',
            date: row.date_start,
            level: effectiveLevel,
            ...(effectiveLevel === 'adset' && {
              adSetId: row.adset_id || undefined,
              adSetName: row.adset_name || undefined,
            }),
            ...(effectiveLevel === 'ad' && {
              adId: row.ad_id || undefined,
              adName: row.ad_name || undefined,
            }),
            impressions,
            reach,
            clicks,
            ctr: parseFloat(row.ctr || '0'),
            spend,
            conversions,
            cpa,
            cpc: parseFloat(row.cpc || '0'),
            cpm: parseFloat(row.cpm || '0'),
            roas: 0,
            engagement: clicks,
            frequency: parseFloat(row.frequency || '0'),
            // Extended fields
            uniqueClicks: row.unique_clicks ? parseInt(row.unique_clicks) : undefined,
            uniqueCtr: row.unique_ctr ? parseFloat(row.unique_ctr) : undefined,
            costPerUniqueClick: row.cost_per_unique_click ? parseFloat(row.cost_per_unique_click) : undefined,
            qualityRanking: row.quality_ranking || undefined,
            engagementRateRanking: row.engagement_rate_ranking || undefined,
            conversionRateRanking: row.conversion_rate_ranking || undefined,
            videoMetrics: extractVideoMetrics(row),
          });
        });

        // Store aggregated performance for this campaign
        campaignPerformance[camp.id] = {
          totalSpend,
          totalImpressions,
          totalClicks,
          totalConversions,
          averageCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          averageCPA: totalConversions > 0 ? totalSpend / totalConversions : 0,
          overallROAS: 0,
          platformBreakdown: {
            meta: {
              spend: totalSpend,
              impressions: totalImpressions,
              clicks: totalClicks,
              conversions: totalConversions,
              reach: totalReach,
            },
          },
        };

      } catch (err: any) {
        console.warn(`[sync-performance] Failed for campaign ${camp.metaCampaignId}:`, err.message);
      }
    }

    console.log(`[sync-performance] Got ${allSnapshots.length} snapshots for ${Object.keys(campaignPerformance).length} campaigns`);

    return res.status(200).json({
      success: true,
      snapshotsCount: allSnapshots.length,
      snapshots: allSnapshots,
      campaignPerformance,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[sync-performance] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Performance sync failed',
    });
  }
});

function extractConversions(actions: any[]): number {
  if (!actions) return 0;
  const conversion = actions.find((a: any) =>
    a.action_type === 'offsite_conversion' ||
    a.action_type === 'lead' ||
    a.action_type === 'purchase'
  );
  return conversion ? parseInt(conversion.value || '0') : 0;
}

function extractCPA(costPerAction: any[]): number {
  if (!costPerAction) return 0;
  const cpa = costPerAction.find((a: any) =>
    a.action_type === 'offsite_conversion' ||
    a.action_type === 'lead' ||
    a.action_type === 'purchase'
  );
  return cpa ? parseFloat(cpa.value || '0') : 0;
}

function extractVideoMetrics(row: any): { avgWatchTime?: number; p25?: number; p50?: number; p75?: number; p100?: number } | undefined {
  const avgWatch = row.video_avg_time_watched_actions?.[0]?.value;
  const p25 = row.video_p25_watched_actions?.[0]?.value;
  const p50 = row.video_p50_watched_actions?.[0]?.value;
  const p75 = row.video_p75_watched_actions?.[0]?.value;
  const p100 = row.video_p100_watched_actions?.[0]?.value;
  if (!avgWatch && !p25 && !p50 && !p75 && !p100) return undefined;
  return {
    avgWatchTime: avgWatch ? parseFloat(avgWatch) : undefined,
    p25: p25 ? parseInt(p25) : undefined,
    p50: p50 ? parseInt(p50) : undefined,
    p75: p75 ? parseInt(p75) : undefined,
    p100: p100 ? parseInt(p100) : undefined,
  };
}
