import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth';

export const config = {
  maxDuration: 120,
};

const GOOGLE_ADS_API = 'https://googleads.googleapis.com/v17';

/**
 * POST /api/marketing/sync-google
 *
 * Fetches campaigns from Google Ads API.
 * Body: { accessToken, customerId, developerToken, dateRange? }
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accessToken, customerId, developerToken, dateRange } = req.body;

    if (!accessToken || !customerId || !developerToken) {
      return res.status(400).json({ error: 'Missing: accessToken, customerId, developerToken' });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const range = dateRange || {
      start: thirtyDaysAgo.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };

    console.log(`[sync-google] Fetching campaigns for customer ${customerId}`);

    // Use Google Ads Query Language (GAQL) to fetch campaigns with metrics
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.start_date,
        campaign.end_date,
        campaign_budget.amount_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc,
        metrics.average_cpm,
        metrics.cost_per_conversion
      FROM campaign
      WHERE segments.date BETWEEN '${range.start}' AND '${range.end}'
        AND campaign.status != 'REMOVED'
    `;

    const searchRes = await fetch(
      `${GOOGLE_ADS_API}/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );

    const searchData = await searchRes.json();

    if (searchData.error) {
      throw new Error(`Google Ads API error: ${searchData.error.message}`);
    }

    // Parse results (searchStream returns array of batches)
    const rows = searchData.flatMap?.((batch: any) => batch.results || []) || searchData[0]?.results || [];

    const campaignMap = new Map<string, any>();

    for (const row of rows) {
      const c = row.campaign;
      const m = row.metrics;
      const b = row.campaignBudget;
      const id = c.id;

      if (!campaignMap.has(id)) {
        campaignMap.set(id, {
          googleCampaignId: id,
          name: c.name,
          objective: mapGoogleChannelType(c.advertisingChannelType),
          status: mapGoogleStatus(c.status),
          platforms: ['google'],
          budget: {
            totalBudget: b?.amountMicros ? parseInt(b.amountMicros) / 1_000_000 * 30 : 0,
            dailyLimit: b?.amountMicros ? parseInt(b.amountMicros) / 1_000_000 : 0,
            currency: 'TRY',
            platformSplit: { google: 100 },
          },
          schedule: {
            startDate: c.startDate || new Date().toISOString(),
            endDate: c.endDate || null,
          },
          performance: {
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            averageCTR: 0,
            averageCPA: 0,
            overallROAS: 0,
            platformBreakdown: { google: { spend: 0, impressions: 0, clicks: 0, conversions: 0 } },
          },
        });
      }

      // Accumulate metrics
      const existing = campaignMap.get(id);
      const spend = m.costMicros ? parseInt(m.costMicros) / 1_000_000 : 0;
      const impressions = parseInt(m.impressions || '0');
      const clicks = parseInt(m.clicks || '0');
      const conversions = parseFloat(m.conversions || '0');

      existing.performance.totalSpend += spend;
      existing.performance.totalImpressions += impressions;
      existing.performance.totalClicks += clicks;
      existing.performance.totalConversions += conversions;
      existing.performance.platformBreakdown.google.spend += spend;
      existing.performance.platformBreakdown.google.impressions += impressions;
      existing.performance.platformBreakdown.google.clicks += clicks;
      existing.performance.platformBreakdown.google.conversions += conversions;
    }

    // Calculate averages
    const campaigns = Array.from(campaignMap.values()).map(c => {
      const p = c.performance;
      p.averageCTR = p.totalImpressions > 0 ? (p.totalClicks / p.totalImpressions) * 100 : 0;
      p.averageCPA = p.totalConversions > 0 ? p.totalSpend / p.totalConversions : 0;
      return c;
    });

    console.log(`[sync-google] Synced ${campaigns.length} campaigns`);

    return res.status(200).json({
      success: true,
      synced: campaigns.length,
      campaigns,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[sync-google] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

function mapGoogleChannelType(type: string): string {
  const map: Record<string, string> = {
    SEARCH: 'traffic',
    DISPLAY: 'awareness',
    VIDEO: 'video_views',
    SHOPPING: 'sales',
    PERFORMANCE_MAX: 'sales',
    SMART: 'leads',
    DISCOVERY: 'engagement',
    LOCAL: 'traffic',
  };
  return map[type] || 'awareness';
}

function mapGoogleStatus(status: string): string {
  const map: Record<string, string> = {
    ENABLED: 'active',
    PAUSED: 'paused',
    REMOVED: 'completed',
  };
  return map[status] || 'draft';
}
