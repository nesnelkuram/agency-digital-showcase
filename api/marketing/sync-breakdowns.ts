import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';

export const config = {
  maxDuration: 120,
};

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// Map breakdown types to Meta API breakdown parameters
const BREAKDOWN_PARAMS: Record<string, string> = {
  age_gender: 'age,gender',
  device: 'device_platform',
  placement: 'publisher_platform,platform_position',
  region: 'region',
};

const VALID_BREAKDOWN_TYPES = Object.keys(BREAKDOWN_PARAMS);

/**
 * POST /api/marketing/sync-breakdowns
 *
 * Fetches breakdown data from Meta Marketing API for a single campaign.
 *
 * Body:
 *  - accessToken: string
 *  - metaCampaignId: string
 *  - breakdownType: 'age_gender' | 'device' | 'placement' | 'region'
 *  - dateRange?: { start: string; end: string } (defaults to last 30 days)
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accessToken, metaCampaignId, breakdownType, dateRange } = req.body;

    if (!accessToken || !metaCampaignId || !breakdownType) {
      return res.status(400).json({
        error: 'Missing required fields: accessToken, metaCampaignId, breakdownType',
      });
    }

    const breakdownParam = BREAKDOWN_PARAMS[breakdownType];
    if (!breakdownParam) {
      return res.status(400).json({
        error: `Invalid breakdownType: "${breakdownType}". Must be one of: ${VALID_BREAKDOWN_TYPES.join(', ')}`,
      });
    }

    // Default to last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const range = dateRange || {
      start: thirtyDaysAgo.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };

    const timeRange = JSON.stringify({ since: range.start, until: range.end });

    console.log(`[sync-breakdowns] Fetching ${breakdownType} breakdown for campaign ${metaCampaignId}, range=${range.start}—${range.end}`);

    // Fetch from Meta API
    const fields = 'impressions,reach,clicks,ctr,spend,actions,cost_per_action_type,cpc,cpm';
    const url = `${META_API_BASE}/${metaCampaignId}/insights?access_token=${accessToken}&fields=${fields}&breakdowns=${breakdownParam}&time_range=${encodeURIComponent(timeRange)}`;

    const apiRes = await fetch(url);
    const apiData = await apiRes.json();

    if (apiData.error) {
      throw new Error(`Meta API error: ${apiData.error.message}`);
    }

    // Handle pagination - Meta may return paginated breakdown results
    let allRows = apiData.data || [];
    let nextPage = apiData.paging?.next;
    while (nextPage) {
      const pageRes = await fetch(nextPage);
      const pageData = await pageRes.json();
      allRows = [...allRows, ...(pageData.data || [])];
      nextPage = pageData.paging?.next;
    }

    console.log(`[sync-breakdowns] Received ${allRows.length} breakdown rows for ${breakdownType}`);

    // Map rows to our BreakdownRow format
    const data = allRows.map((row: any) => {
      const conversions = extractConversions(row.actions);
      const cpa = extractCPA(row.cost_per_action_type);

      return {
        // Dimension fields depend on breakdownType
        age: row.age || undefined,
        gender: row.gender || undefined,
        devicePlatform: row.device_platform || undefined,
        publisherPlatform: row.publisher_platform || undefined,
        platformPosition: row.platform_position || undefined,
        region: row.region || undefined,
        // Metrics
        impressions: parseInt(row.impressions || '0'),
        clicks: parseInt(row.clicks || '0'),
        spend: parseFloat(row.spend || '0'),
        ctr: parseFloat(row.ctr || '0'),
        cpc: parseFloat(row.cpc || '0'),
        cpm: parseFloat(row.cpm || '0'),
        conversions,
        cpa,
        reach: parseInt(row.reach || '0'),
      };
    });

    console.log(`[sync-breakdowns] Successfully mapped ${data.length} rows for ${breakdownType}`);

    return res.status(200).json({
      success: true,
      breakdownType,
      metaCampaignId,
      dateRange: range,
      rowCount: data.length,
      data,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[sync-breakdowns] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Breakdown sync failed',
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
