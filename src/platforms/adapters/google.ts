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
 * Google Ads API Adapter
 *
 * Handles Search, Display, Video, and Performance Max campaigns
 * via Google Ads API v17.
 *
 * Setup requirements:
 * 1. Create a Google Cloud project at console.cloud.google.com
 * 2. Enable Google Ads API
 * 3. Create OAuth 2.0 credentials (Web Application type)
 * 4. Apply for Google Ads Developer Token (Basic access)
 * 5. Link to a Google Ads MCC (Manager) account
 *
 * Environment variables:
 * - GOOGLE_ADS_CLIENT_ID: OAuth Client ID
 * - GOOGLE_ADS_CLIENT_SECRET: OAuth Client Secret
 * - GOOGLE_ADS_DEVELOPER_TOKEN: Developer Token
 * - GOOGLE_ADS_CUSTOMER_ID: MCC or direct customer ID (no dashes)
 */

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2';
const GOOGLE_ADS_API_BASE = 'https://googleads.googleapis.com/v17';

// Google Ads campaign type mapping
const CAMPAIGN_TYPE_MAP: Record<string, string> = {
  awareness: 'DISPLAY',
  traffic: 'SEARCH',
  engagement: 'DISPLAY',
  leads: 'SEARCH',
  sales: 'PERFORMANCE_MAX',
  app_installs: 'APP',
  video_views: 'VIDEO',
};

// Bidding strategy mapping
const BID_STRATEGY_MAP: Record<string, string> = {
  lowest_cost: 'MAXIMIZE_CONVERSIONS',
  cost_cap: 'TARGET_CPA',
  bid_cap: 'MANUAL_CPC',
  target_cost: 'TARGET_CPA',
};

export class GoogleAdsAdapter extends BasePlatformAdapter {
  readonly platform: AdPlatform = 'google';

  getAuthUrl(redirectUri: string): string {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    if (!clientId) throw new Error('GOOGLE_ADS_CLIENT_ID not configured');

    const scopes = 'https://www.googleapis.com/auth/adwords';
    const state = JSON.stringify({ platform: 'google' });

    return `${GOOGLE_AUTH_BASE}/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<PlatformAccount> {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('Google OAuth credentials not configured');

    // Exchange code for tokens
    const tokenRes = await fetch(`${GOOGLE_AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new Error(`Google OAuth error: ${tokenData.error_description || tokenData.error}`);
    }

    // Get customer info
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID || '';

    return {
      id: '',
      platform: 'google',
      accountId: customerId,
      accountName: 'Google Ads Account',
      status: 'connected',
      permissions: ['adwords'],
      tokenExpiresAt: Timestamp.fromMillis(Date.now() + (tokenData.expires_in || 3600) * 1000),
      metadata: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        customerId,
        developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  }

  async refreshToken(account: PlatformAccount): Promise<PlatformAccount> {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = account.metadata?.refreshToken;

    if (!clientId || !clientSecret || !refreshToken) {
      return { ...account, status: 'expired', updatedAt: Timestamp.now() };
    }

    const tokenRes = await fetch(`${GOOGLE_AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return { ...account, status: 'expired', updatedAt: Timestamp.now() };
    }

    return {
      ...account,
      status: 'connected',
      tokenExpiresAt: Timestamp.fromMillis(Date.now() + (tokenData.expires_in || 3600) * 1000),
      metadata: {
        ...account.metadata,
        accessToken: tokenData.access_token,
      },
      updatedAt: Timestamp.now(),
    };
  }

  private getHeaders(account: PlatformAccount): Record<string, string> {
    return {
      'Authorization': `Bearer ${account.metadata?.accessToken}`,
      'developer-token': account.metadata?.developerToken || '',
      'login-customer-id': account.metadata?.customerId || '',
      'Content-Type': 'application/json',
    };
  }

  async createCampaign(
    campaign: MarketingCampaign,
    account: PlatformAccount
  ): Promise<PlatformCampaignResult> {
    const customerId = account.metadata?.customerId;
    if (!customerId) return { success: false, error: 'Missing customer ID' };

    try {
      const campaignType = CAMPAIGN_TYPE_MAP[campaign.objective] || 'SEARCH';
      const dailyBudgetMicros = Math.round((campaign.budget.dailyLimit || campaign.budget.totalBudget / 30) * 1_000_000);

      // 1. Create campaign budget
      const budgetRes = await fetch(
        `${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaignBudgets:mutate`,
        {
          method: 'POST',
          headers: this.getHeaders(account),
          body: JSON.stringify({
            operations: [{
              create: {
                name: `${campaign.name} Budget`,
                amountMicros: dailyBudgetMicros.toString(),
                deliveryMethod: 'STANDARD',
              },
            }],
          }),
        }
      );

      const budgetData = await budgetRes.json();
      if (budgetData.error) {
        return { success: false, error: `Budget creation failed: ${budgetData.error.message}` };
      }

      const budgetResourceName = budgetData.results?.[0]?.resourceName || '';

      // 2. Create campaign
      const campaignRes = await fetch(
        `${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaigns:mutate`,
        {
          method: 'POST',
          headers: this.getHeaders(account),
          body: JSON.stringify({
            operations: [{
              create: {
                name: campaign.name,
                advertisingChannelType: campaignType,
                status: 'PAUSED',
                campaignBudget: budgetResourceName,
                biddingStrategyType: BID_STRATEGY_MAP[campaign.adSets[0]?.bidStrategy || 'lowest_cost'] || 'MAXIMIZE_CONVERSIONS',
                startDate: campaign.schedule.startDate?.replace(/-/g, ''),
                endDate: campaign.schedule.endDate?.replace(/-/g, '') || undefined,
              },
            }],
          }),
        }
      );

      const campaignData = await campaignRes.json();
      if (campaignData.error) {
        return { success: false, error: `Campaign creation failed: ${campaignData.error.message}` };
      }

      const campaignResourceName = campaignData.results?.[0]?.resourceName || '';
      // Extract numeric ID from resource name
      const platformCampaignId = campaignResourceName.split('/').pop() || campaignResourceName;

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
    const customerId = account.metadata?.customerId;
    if (!customerId) throw new Error('Missing customer ID');

    const updateMask: string[] = [];
    const updatePayload: any = {
      resourceName: `customers/${customerId}/campaigns/${platformCampaignId}`,
    };

    if (updates.name) {
      updatePayload.name = updates.name;
      updateMask.push('name');
    }
    if (updates.status === 'active') {
      updatePayload.status = 'ENABLED';
      updateMask.push('status');
    }
    if (updates.status === 'paused') {
      updatePayload.status = 'PAUSED';
      updateMask.push('status');
    }

    if (updateMask.length === 0) return;

    await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaigns:mutate`,
      {
        method: 'POST',
        headers: this.getHeaders(account),
        body: JSON.stringify({
          operations: [{
            update: updatePayload,
            updateMask: updateMask.join(','),
          }],
        }),
      }
    );
  }

  async pauseCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void> {
    await this.updateCampaign(platformCampaignId, { status: 'paused' } as any, account);
  }

  async resumeCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void> {
    await this.updateCampaign(platformCampaignId, { status: 'active' } as any, account);
  }

  async deleteCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void> {
    const customerId = account.metadata?.customerId;
    if (!customerId) throw new Error('Missing customer ID');

    await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaigns:mutate`,
      {
        method: 'POST',
        headers: this.getHeaders(account),
        body: JSON.stringify({
          operations: [{
            remove: `customers/${customerId}/campaigns/${platformCampaignId}`,
          }],
        }),
      }
    );
  }

  async createAdSet(
    platformCampaignId: string,
    adSet: AdSet,
    account: PlatformAccount
  ): Promise<string> {
    const customerId = account.metadata?.customerId;
    if (!customerId) throw new Error('Missing customer ID');

    const res = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/adGroups:mutate`,
      {
        method: 'POST',
        headers: this.getHeaders(account),
        body: JSON.stringify({
          operations: [{
            create: {
              name: adSet.name,
              campaign: `customers/${customerId}/campaigns/${platformCampaignId}`,
              status: 'PAUSED',
              type: 'SEARCH_STANDARD',
              cpcBidMicros: adSet.bidAmount ? (adSet.bidAmount * 1_000_000).toString() : undefined,
            },
          }],
        }),
      }
    );

    const data = await res.json();
    if (data.error) throw new Error(`Ad group creation failed: ${data.error.message}`);
    const resourceName = data.results?.[0]?.resourceName || '';
    return resourceName.split('/').pop() || resourceName;
  }

  async updateAdSet(
    platformAdSetId: string,
    updates: Partial<AdSet>,
    account: PlatformAccount
  ): Promise<void> {
    const customerId = account.metadata?.customerId;
    if (!customerId) throw new Error('Missing customer ID');

    const updatePayload: any = {
      resourceName: `customers/${customerId}/adGroups/${platformAdSetId}`,
    };
    const updateMask: string[] = [];

    if (updates.name) { updatePayload.name = updates.name; updateMask.push('name'); }
    if (updateMask.length === 0) return;

    await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/adGroups:mutate`,
      {
        method: 'POST',
        headers: this.getHeaders(account),
        body: JSON.stringify({
          operations: [{
            update: updatePayload,
            updateMask: updateMask.join(','),
          }],
        }),
      }
    );
  }

  async createAd(
    platformAdSetId: string,
    creative: AdCreative,
    account: PlatformAccount
  ): Promise<string> {
    const customerId = account.metadata?.customerId;
    if (!customerId) throw new Error('Missing customer ID');

    // Create responsive search ad
    const res = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/adGroupAds:mutate`,
      {
        method: 'POST',
        headers: this.getHeaders(account),
        body: JSON.stringify({
          operations: [{
            create: {
              adGroup: `customers/${customerId}/adGroups/${platformAdSetId}`,
              status: 'PAUSED',
              ad: {
                responsiveSearchAd: {
                  headlines: [
                    { text: creative.headline },
                    ...(creative.variants || []).map(v => ({ text: v.headline })),
                  ].slice(0, 15),
                  descriptions: [
                    { text: creative.primaryText.slice(0, 90) },
                    ...(creative.description ? [{ text: creative.description.slice(0, 90) }] : []),
                    ...(creative.variants || []).map(v => ({ text: (v.primaryText || '').slice(0, 90) })),
                  ].slice(0, 4),
                  path1: creative.displayUrl?.split('/')[0]?.slice(0, 15) || '',
                },
                finalUrls: [creative.destinationUrl],
              },
            },
          }],
        }),
      }
    );

    const data = await res.json();
    if (data.error) throw new Error(`Ad creation failed: ${data.error.message}`);
    const resourceName = data.results?.[0]?.resourceName || '';
    return resourceName.split('/').pop() || resourceName;
  }

  async updateAd(
    platformAdId: string,
    updates: Partial<AdCreative>,
    account: PlatformAccount
  ): Promise<void> {
    // Google Ads requires removing and recreating ads for most updates
    console.log(`[GoogleAdsAdapter] Ad updates require remove+create for ad ${platformAdId}`);
  }

  async getPerformance(
    platformCampaignId: string,
    dateRange: DateRange,
    account: PlatformAccount
  ): Promise<PerformanceSnapshot[]> {
    const customerId = account.metadata?.customerId;
    if (!customerId) throw new Error('Missing customer ID');

    const query = `
      SELECT
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.cost_micros,
        metrics.conversions,
        metrics.cost_per_conversion,
        metrics.average_cpc,
        metrics.average_cpm
      FROM campaign
      WHERE campaign.id = ${platformCampaignId}
        AND segments.date BETWEEN '${dateRange.start.replace(/-/g, '')}' AND '${dateRange.end.replace(/-/g, '')}'
      ORDER BY segments.date DESC
    `.trim();

    const res = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: this.getHeaders(account),
        body: JSON.stringify({ query }),
      }
    );

    const data = await res.json();
    if (data.error) throw new Error(`Google Ads reporting error: ${data.error.message}`);

    const results = data[0]?.results || [];

    return results.map((row: any) => ({
      id: '',
      campaignId: '',
      platform: 'google' as AdPlatform,
      date: this.formatDate(row.segments?.date || ''),
      impressions: parseInt(row.metrics?.impressions || '0'),
      reach: 0,
      clicks: parseInt(row.metrics?.clicks || '0'),
      ctr: parseFloat(row.metrics?.ctr || '0') * 100,
      spend: parseInt(row.metrics?.costMicros || '0') / 1_000_000,
      conversions: parseFloat(row.metrics?.conversions || '0'),
      cpa: parseInt(row.metrics?.costPerConversion || '0') / 1_000_000,
      cpc: parseInt(row.metrics?.averageCpc || '0') / 1_000_000,
      cpm: parseInt(row.metrics?.averageCpm || '0') / 1_000_000,
      roas: 0,
      engagement: parseInt(row.metrics?.clicks || '0'),
    }));
  }

  override validateCampaign(campaign: MarketingCampaign): ValidationResult {
    const base = super.validateCampaign(campaign);
    const errors = [...base.errors];
    const warnings = [...base.warnings];

    if (campaign.budget.totalBudget < 50) {
      errors.push('Google Ads minimum gunluk butce 50 TL');
    }

    const googleAdSets = campaign.adSets.filter(as => as.platform === 'google');
    googleAdSets.forEach((adSet, i) => {
      if (!adSet.targeting?.google?.keywords?.length) {
        warnings.push(`Reklam Seti ${i + 1}: Arama kampanyasi icin anahtar kelime gerekli`);
      }
    });

    return { valid: errors.length === 0, errors, warnings };
  }

  private formatDate(yyyymmdd: string): string {
    if (yyyymmdd.length !== 8) return yyyymmdd;
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  }
}
