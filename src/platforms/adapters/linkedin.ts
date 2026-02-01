import { Timestamp } from 'firebase/firestore';
import { BasePlatformAdapter } from '../types';
import type { PlatformCampaignResult, DateRange, ValidationResult } from '../types';
import type {
  AdPlatform,
  MarketingCampaign,
  AdSet,
  AdCreative,
  PerformanceSnapshot,
  PlatformAccount,
} from '@/shared/types/marketing';

/**
 * LinkedIn Marketing API Adapter
 *
 * Handles LinkedIn Sponsored Content, Message Ads, and Text Ads
 * via LinkedIn Marketing Developer Platform.
 *
 * Setup requirements:
 * 1. Create LinkedIn App at linkedin.com/developers
 * 2. Add "Marketing Developer Platform" product
 * 3. Get approval (requires LinkedIn company page)
 * 4. Add redirect URI
 *
 * Environment variables:
 * - LINKEDIN_CLIENT_ID: OAuth Client ID
 * - LINKEDIN_CLIENT_SECRET: OAuth Client Secret
 * - LINKEDIN_AD_ACCOUNT_ID: Sponsored Account ID
 */

const LINKEDIN_AUTH_BASE = 'https://www.linkedin.com/oauth/v2';
const LINKEDIN_API_BASE = 'https://api.linkedin.com/rest';

// LinkedIn campaign objective mapping
const OBJECTIVE_MAP: Record<string, string> = {
  awareness: 'BRAND_AWARENESS',
  traffic: 'WEBSITE_VISITS',
  engagement: 'ENGAGEMENT',
  leads: 'LEAD_GENERATION',
  sales: 'WEBSITE_CONVERSIONS',
  video_views: 'VIDEO_VIEWS',
};

// LinkedIn campaign type mapping
const CAMPAIGN_TYPE_MAP: Record<string, string> = {
  awareness: 'SPONSORED_UPDATES',
  traffic: 'SPONSORED_UPDATES',
  engagement: 'SPONSORED_UPDATES',
  leads: 'SPONSORED_UPDATES',
  sales: 'SPONSORED_UPDATES',
  video_views: 'SPONSORED_UPDATES',
};

export class LinkedInAdapter extends BasePlatformAdapter {
  readonly platform: AdPlatform = 'linkedin';

  getAuthUrl(redirectUri: string): string {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) throw new Error('LINKEDIN_CLIENT_ID not configured');

    const scopes = 'r_ads,rw_ads,r_ads_reporting';
    const state = JSON.stringify({ platform: 'linkedin' });

    return `${LINKEDIN_AUTH_BASE}/authorization?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${encodeURIComponent(state)}`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<PlatformAccount> {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('LinkedIn OAuth credentials not configured');

    const tokenRes = await fetch(`${LINKEDIN_AUTH_BASE}/accessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new Error(`LinkedIn OAuth error: ${tokenData.error_description || tokenData.error}`);
    }

    const adAccountId = process.env.LINKEDIN_AD_ACCOUNT_ID || '';

    return {
      id: '',
      platform: 'linkedin',
      accountId: adAccountId,
      accountName: 'LinkedIn Ads Account',
      status: 'connected',
      permissions: ['r_ads', 'rw_ads', 'r_ads_reporting'],
      tokenExpiresAt: Timestamp.fromMillis(Date.now() + (tokenData.expires_in || 31536000) * 1000), // ~365 days
      metadata: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        adAccountId,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  }

  async refreshToken(account: PlatformAccount): Promise<PlatformAccount> {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const refreshToken = account.metadata?.refreshToken;

    if (!clientId || !clientSecret || !refreshToken) {
      return { ...account, status: 'expired', updatedAt: Timestamp.now() };
    }

    const tokenRes = await fetch(`${LINKEDIN_AUTH_BASE}/accessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return { ...account, status: 'expired', updatedAt: Timestamp.now() };
    }

    return {
      ...account,
      status: 'connected',
      tokenExpiresAt: Timestamp.fromMillis(Date.now() + (tokenData.expires_in || 31536000) * 1000),
      metadata: {
        ...account.metadata,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken,
      },
      updatedAt: Timestamp.now(),
    };
  }

  private getHeaders(account: PlatformAccount): Record<string, string> {
    return {
      'Authorization': `Bearer ${account.metadata?.accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': '202401',
      'X-Restli-Protocol-Version': '2.0.0',
    };
  }

  async createCampaign(
    campaign: MarketingCampaign,
    account: PlatformAccount
  ): Promise<PlatformCampaignResult> {
    const adAccountId = account.metadata?.adAccountId;
    if (!adAccountId) return { success: false, error: 'Missing ad account ID' };

    try {
      const dailyBudget = campaign.budget.dailyLimit || campaign.budget.totalBudget / 30;

      // 1. Create campaign group
      const groupRes = await fetch(`${LINKEDIN_API_BASE}/adCampaignGroups`, {
        method: 'POST',
        headers: this.getHeaders(account),
        body: JSON.stringify({
          account: `urn:li:sponsoredAccount:${adAccountId}`,
          name: campaign.name,
          status: 'DRAFT',
          runSchedule: {
            start: new Date(campaign.schedule.startDate).getTime(),
            end: campaign.schedule.endDate ? new Date(campaign.schedule.endDate).getTime() : undefined,
          },
          totalBudget: {
            amount: (campaign.budget.totalBudget * 100).toString(),
            currencyCode: campaign.budget.currency || 'TRY',
          },
        }),
      });

      const groupData = await groupRes.json();
      if (groupData.status && groupData.status >= 400) {
        return { success: false, error: `Campaign group error: ${groupData.message}` };
      }

      const campaignGroupId = groupRes.headers.get('x-restli-id') || '';

      // 2. Create campaign (under campaign group)
      const campRes = await fetch(`${LINKEDIN_API_BASE}/adCampaigns`, {
        method: 'POST',
        headers: this.getHeaders(account),
        body: JSON.stringify({
          account: `urn:li:sponsoredAccount:${adAccountId}`,
          campaignGroup: `urn:li:sponsoredCampaignGroup:${campaignGroupId}`,
          name: campaign.name,
          type: CAMPAIGN_TYPE_MAP[campaign.objective] || 'SPONSORED_UPDATES',
          objectiveType: OBJECTIVE_MAP[campaign.objective] || 'WEBSITE_VISITS',
          status: 'DRAFT',
          costType: 'CPC',
          dailyBudget: {
            amount: (dailyBudget * 100).toString(),
            currencyCode: campaign.budget.currency || 'TRY',
          },
          unitCost: campaign.adSets[0]?.bidAmount ? {
            amount: (campaign.adSets[0].bidAmount * 100).toString(),
            currencyCode: campaign.budget.currency || 'TRY',
          } : undefined,
          locale: { country: 'TR', language: 'tr' },
          runSchedule: {
            start: new Date(campaign.schedule.startDate).getTime(),
            end: campaign.schedule.endDate ? new Date(campaign.schedule.endDate).getTime() : undefined,
          },
        }),
      });

      const campData = await campRes.json();
      if (campData.status && campData.status >= 400) {
        return { success: false, error: `Campaign creation error: ${campData.message}` };
      }

      const platformCampaignId = campRes.headers.get('x-restli-id') || '';

      return {
        success: true,
        platformCampaignId,
        platformAdSetIds: [],
        platformAdIds: [],
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async updateCampaign(
    platformCampaignId: string,
    updates: Partial<MarketingCampaign>,
    account: PlatformAccount
  ): Promise<void> {
    const payload: any = {};
    if (updates.name) payload.name = updates.name;
    if (updates.status === 'active') payload.status = 'ACTIVE';
    if (updates.status === 'paused') payload.status = 'PAUSED';

    await fetch(`${LINKEDIN_API_BASE}/adCampaigns/${platformCampaignId}`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(account),
        'X-Restli-Method': 'PARTIAL_UPDATE',
      },
      body: JSON.stringify({ patch: { $set: payload } }),
    });
  }

  async pauseCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void> {
    await this.updateCampaign(platformCampaignId, { status: 'paused' } as any, account);
  }

  async resumeCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void> {
    await this.updateCampaign(platformCampaignId, { status: 'active' } as any, account);
  }

  async deleteCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void> {
    await fetch(`${LINKEDIN_API_BASE}/adCampaigns/${platformCampaignId}`, {
      method: 'POST',
      headers: {
        ...this.getHeaders(account),
        'X-Restli-Method': 'PARTIAL_UPDATE',
      },
      body: JSON.stringify({ patch: { $set: { status: 'ARCHIVED' } } }),
    });
  }

  async createAdSet(
    platformCampaignId: string,
    adSet: AdSet,
    account: PlatformAccount
  ): Promise<string> {
    // LinkedIn doesn't have a separate ad set concept — targeting is at campaign level.
    // Return the campaign ID as the "ad set" for compatibility.
    console.log(`[LinkedInAdapter] LinkedIn uses campaign-level targeting, no separate ad set for ${adSet.name}`);
    return platformCampaignId;
  }

  async updateAdSet(
    platformAdSetId: string,
    updates: Partial<AdSet>,
    account: PlatformAccount
  ): Promise<void> {
    // Targeting updates go to the campaign level
    console.log(`[LinkedInAdapter] Ad set updates map to campaign updates for ${platformAdSetId}`);
  }

  async createAd(
    platformAdSetId: string,
    creative: AdCreative,
    account: PlatformAccount
  ): Promise<string> {
    const adAccountId = account.metadata?.adAccountId;
    if (!adAccountId) throw new Error('Missing ad account ID');

    // Create sponsored content creative
    const creativeRes = await fetch(`${LINKEDIN_API_BASE}/adCreatives`, {
      method: 'POST',
      headers: this.getHeaders(account),
      body: JSON.stringify({
        campaign: `urn:li:sponsoredCampaign:${platformAdSetId}`,
        reference: creative.destinationUrl,
        intendedStatus: 'DRAFT',
      }),
    });

    const creativeData = await creativeRes.json();
    if (creativeData.status && creativeData.status >= 400) {
      throw new Error(`LinkedIn creative error: ${creativeData.message}`);
    }

    return creativeRes.headers.get('x-restli-id') || '';
  }

  async updateAd(
    platformAdId: string,
    updates: Partial<AdCreative>,
    account: PlatformAccount
  ): Promise<void> {
    console.log(`[LinkedInAdapter] Ad update for ${platformAdId}`);
  }

  async getPerformance(
    platformCampaignId: string,
    dateRange: DateRange,
    account: PlatformAccount
  ): Promise<PerformanceSnapshot[]> {
    const adAccountId = account.metadata?.adAccountId;
    if (!adAccountId) throw new Error('Missing ad account ID');

    const startDate = dateRange.start.replace(/-/g, '');
    const endDate = dateRange.end.replace(/-/g, '');

    const params = new URLSearchParams({
      q: 'analytics',
      pivot: 'CAMPAIGN',
      dateRange: `(start:(year:${startDate.slice(0,4)},month:${parseInt(startDate.slice(4,6))},day:${parseInt(startDate.slice(6,8))}),end:(year:${endDate.slice(0,4)},month:${parseInt(endDate.slice(4,6))},day:${parseInt(endDate.slice(6,8))}))`,
      timeGranularity: 'DAILY',
      campaigns: `List(urn:li:sponsoredCampaign:${platformCampaignId})`,
      fields: 'impressions,clicks,costInLocalCurrency,dateRange,pivotValue',
    });

    const res = await fetch(`${LINKEDIN_API_BASE}/adAnalytics?${params.toString()}`, {
      headers: this.getHeaders(account),
    });

    const data = await res.json();
    if (data.status && data.status >= 400) {
      throw new Error(`LinkedIn analytics error: ${data.message}`);
    }

    return (data.elements || []).map((row: any) => {
      const impressions = parseInt(row.impressions || '0');
      const clicks = parseInt(row.clicks || '0');
      const spend = parseFloat(row.costInLocalCurrency || '0') / 100;
      const dr = row.dateRange?.start;
      const date = dr ? `${dr.year}-${String(dr.month).padStart(2, '0')}-${String(dr.day).padStart(2, '0')}` : '';

      return {
        id: '',
        campaignId: '',
        platform: 'linkedin' as AdPlatform,
        date,
        impressions,
        reach: 0,
        clicks,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        spend,
        conversions: 0,
        cpa: 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        roas: 0,
        engagement: clicks,
      };
    });
  }

  override validateCampaign(campaign: MarketingCampaign): ValidationResult {
    const base = super.validateCampaign(campaign);
    const errors = [...base.errors];
    const warnings = [...base.warnings];

    if (campaign.budget.totalBudget < 300) {
      errors.push('LinkedIn minimum gunluk butce 300 TL');
    }

    const hasLinkedInTargeting = campaign.adSets.some(
      as => as.platform === 'linkedin' && (
        as.targeting?.linkedin?.jobTitles?.length ||
        as.targeting?.linkedin?.companies?.industries?.length
      )
    );

    if (!hasLinkedInTargeting) {
      warnings.push('LinkedIn kampanyalari icin pozisyon veya sektor hedeflemesi onerilir');
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
