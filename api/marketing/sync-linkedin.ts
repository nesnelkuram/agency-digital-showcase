import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth';

export const config = {
  maxDuration: 120,
};

const LINKEDIN_API = 'https://api.linkedin.com/v2';

/**
 * POST /api/marketing/sync-linkedin
 *
 * Fetches campaigns from LinkedIn Marketing API.
 * Body: { accessToken, accountId, dateRange? }
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accessToken, accountId, dateRange } = req.body;

    if (!accessToken || !accountId) {
      return res.status(400).json({ error: 'Missing: accessToken, accountId' });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const range = dateRange || {
      start: thirtyDaysAgo.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    };

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': '202401',
    };

    console.log(`[sync-linkedin] Fetching campaigns for account ${accountId}`);

    // 1. Fetch campaigns (campaign groups in LinkedIn = campaigns for us)
    const campaignsRes = await fetch(
      `${LINKEDIN_API}/adCampaignsV2?q=search&search.account.values[0]=urn:li:sponsoredAccount:${accountId}&count=50`,
      { headers }
    );
    const campaignsData = await campaignsRes.json();
    const linkedinCampaigns = campaignsData.elements || [];

    console.log(`[sync-linkedin] Found ${linkedinCampaigns.length} campaigns`);

    // 2. Fetch analytics for all campaigns
    const campaignUrns = linkedinCampaigns.map((c: any) => `urn:li:sponsoredCampaign:${c.id}`);
    let analyticsMap = new Map<string, any>();

    if (campaignUrns.length > 0) {
      try {
        const startDate = range.start.split('-');
        const endDate = range.end.split('-');
        const analyticsUrl = `${LINKEDIN_API}/adAnalyticsV2?q=analytics&dateRange.start.year=${startDate[0]}&dateRange.start.month=${parseInt(startDate[1])}&dateRange.start.day=${parseInt(startDate[2])}&dateRange.end.year=${endDate[0]}&dateRange.end.month=${parseInt(endDate[1])}&dateRange.end.day=${parseInt(endDate[2])}&timeGranularity=ALL&campaigns=${campaignUrns.join(',')}&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,oneClickLeads`;

        const analyticsRes = await fetch(analyticsUrl, { headers });
        const analyticsData = await analyticsRes.json();

        for (const el of analyticsData.elements || []) {
          const campaignUrn = el.pivotValues?.[0] || '';
          const id = campaignUrn.replace('urn:li:sponsoredCampaign:', '');
          analyticsMap.set(id, el);
        }
      } catch (err: any) {
        console.warn('[sync-linkedin] Failed to fetch analytics:', err.message);
      }
    }

    // 3. Map campaigns
    const campaigns = linkedinCampaigns.map((lc: any) => {
      const analytics = analyticsMap.get(String(lc.id));
      const spend = parseFloat(analytics?.costInLocalCurrency || '0');
      const impressions = parseInt(analytics?.impressions || '0');
      const clicks = parseInt(analytics?.clicks || '0');
      const conversions = parseInt(analytics?.externalWebsiteConversions || '0') + parseInt(analytics?.oneClickLeads || '0');

      return {
        linkedinCampaignId: String(lc.id),
        name: lc.name,
        objective: mapLinkedInObjective(lc.objectiveType),
        status: mapLinkedInStatus(lc.status),
        platforms: ['linkedin'],
        budget: {
          totalBudget: parseFloat(lc.totalBudget?.amount || '0') / 100,
          dailyLimit: parseFloat(lc.dailyBudget?.amount || '0') / 100,
          currency: 'TRY',
          platformSplit: { linkedin: 100 },
        },
        schedule: {
          startDate: lc.runSchedule?.start ? new Date(lc.runSchedule.start).toISOString() : new Date().toISOString(),
          endDate: lc.runSchedule?.end ? new Date(lc.runSchedule.end).toISOString() : null,
        },
        performance: analytics ? {
          totalSpend: spend,
          totalImpressions: impressions,
          totalClicks: clicks,
          totalConversions: conversions,
          averageCTR: impressions > 0 ? (clicks / impressions) * 100 : 0,
          averageCPA: conversions > 0 ? spend / conversions : 0,
          overallROAS: 0,
          platformBreakdown: {
            linkedin: { spend, impressions, clicks, conversions },
          },
        } : null,
      };
    });

    console.log(`[sync-linkedin] Synced ${campaigns.length} campaigns`);

    return res.status(200).json({
      success: true,
      synced: campaigns.length,
      campaigns,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[sync-linkedin] Error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

function mapLinkedInObjective(obj: string): string {
  const map: Record<string, string> = {
    BRAND_AWARENESS: 'awareness',
    WEBSITE_VISITS: 'traffic',
    ENGAGEMENT: 'engagement',
    VIDEO_VIEWS: 'video_views',
    LEAD_GENERATION: 'leads',
    WEBSITE_CONVERSIONS: 'sales',
    JOB_APPLICANTS: 'leads',
  };
  return map[obj] || 'awareness';
}

function mapLinkedInStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'active',
    PAUSED: 'paused',
    ARCHIVED: 'completed',
    COMPLETED: 'completed',
    CANCELED: 'completed',
    DRAFT: 'draft',
    PENDING_DELETION: 'completed',
  };
  return map[status] || 'draft';
}
