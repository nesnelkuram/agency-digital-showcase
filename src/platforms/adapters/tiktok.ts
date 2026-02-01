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
 * TikTok Marketing API Adapter
 *
 * Handles TikTok ad campaigns via TikTok Marketing API v1.3.
 * No official Node SDK exists — uses REST API directly.
 *
 * Setup requirements:
 * 1. Create TikTok for Business account at ads.tiktok.com
 * 2. Apply for Marketing API access at business-api.tiktok.com
 * 3. Create an App and get App ID + Secret
 * 4. Link TikTok Ad Account
 *
 * Environment variables:
 * - TIKTOK_APP_ID: TikTok Marketing App ID
 * - TIKTOK_APP_SECRET: App Secret
 * - TIKTOK_ADVERTISER_ID: Advertiser (Ad Account) ID
 */

const TIKTOK_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';
const TIKTOK_AUTH_BASE = 'https://business-api.tiktok.com/portal/auth';

// TikTok campaign objective mapping
const OBJECTIVE_MAP: Record<string, string> = {
  awareness: 'REACH',
  traffic: 'TRAFFIC',
  engagement: 'VIDEO_VIEWS',
  leads: 'LEAD_GENERATION',
  sales: 'CONVERSIONS',
  app_installs: 'APP_INSTALL',
  video_views: 'VIDEO_VIEWS',
};

export class TikTokAdapter extends BasePlatformAdapter {
  readonly platform: AdPlatform = 'tiktok';

  getAuthUrl(redirectUri: string): string {
    const appId = process.env.TIKTOK_APP_ID;
    if (!appId) throw new Error('TIKTOK_APP_ID not configured');

    const state = JSON.stringify({ platform: 'tiktok' });

    return `${TIKTOK_AUTH_BASE}?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<PlatformAccount> {
    const appId = process.env.TIKTOK_APP_ID;
    const appSecret = process.env.TIKTOK_APP_SECRET;
    if (!appId || !appSecret) throw new Error('TikTok credentials not configured');

    const tokenRes = await fetch(`${TIKTOK_API_BASE}/oauth2/access_token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        secret: appSecret,
        auth_code: code,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.code !== 0) {
      throw new Error(`TikTok OAuth error: ${tokenData.message}`);
    }

    const data = tokenData.data;
    const advertiserId = process.env.TIKTOK_ADVERTISER_ID || data.advertiser_ids?.[0] || '';

    return {
      id: '',
      platform: 'tiktok',
      accountId: advertiserId,
      accountName: 'TikTok Ads Account',
      status: 'connected',
      permissions: ['ad_management'],
      tokenExpiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000), // 24h
      metadata: {
        accessToken: data.access_token,
        advertiserId,
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  }

  async refreshToken(account: PlatformAccount): Promise<PlatformAccount> {
    // TikTok tokens are long-lived; re-auth required when expired
    if (this.isTokenValid(account)) return account;
    return { ...account, status: 'expired', updatedAt: Timestamp.now() };
  }

  private getHeaders(account: PlatformAccount): Record<string, string> {
    return {
      'Access-Token': account.metadata?.accessToken || '',
      'Content-Type': 'application/json',
    };
  }

  async createCampaign(
    campaign: MarketingCampaign,
    account: PlatformAccount
  ): Promise<PlatformCampaignResult> {
    const advertiserId = account.metadata?.advertiserId;
    if (!advertiserId) return { success: false, error: 'Missing advertiser ID' };

    try {
      const dailyBudget = campaign.budget.dailyLimit || campaign.budget.totalBudget / 30;

      const res = await fetch(`${TIKTOK_API_BASE}/campaign/create/`, {
        method: 'POST',
        headers: this.getHeaders(account),
        body: JSON.stringify({
          advertiser_id: advertiserId,
          campaign_name: campaign.name,
          objective_type: OBJECTIVE_MAP[campaign.objective] || 'TRAFFIC',
          budget_mode: 'BUDGET_MODE_DAY',
          budget: dailyBudget,
          operation_status: 'DISABLE', // Start paused
        }),
      });

      const data = await res.json();
      if (data.code !== 0) {
        return { success: false, error: `TikTok campaign error: ${data.message}` };
      }

      const platformCampaignId = data.data?.campaign_id || '';

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
    const advertiserId = account.metadata?.advertiserId;
    if (!advertiserId) throw new Error('Missing advertiser ID');

    const payload: any = {
      advertiser_id: advertiserId,
      campaign_id: platformCampaignId,
    };

    if (updates.name) payload.campaign_name = updates.name;
    if (updates.status === 'active') payload.operation_status = 'ENABLE';
    if (updates.status === 'paused') payload.operation_status = 'DISABLE';

    await fetch(`${TIKTOK_API_BASE}/campaign/update/`, {
      method: 'POST',
      headers: this.getHeaders(account),
      body: JSON.stringify(payload),
    });
  }

  async pauseCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void> {
    await this.updateCampaign(platformCampaignId, { status: 'paused' } as any, account);
  }

  async resumeCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void> {
    await this.updateCampaign(platformCampaignId, { status: 'active' } as any, account);
  }

  async deleteCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void> {
    const advertiserId = account.metadata?.advertiserId;
    if (!advertiserId) throw new Error('Missing advertiser ID');

    await fetch(`${TIKTOK_API_BASE}/campaign/update/status/`, {
      method: 'POST',
      headers: this.getHeaders(account),
      body: JSON.stringify({
        advertiser_id: advertiserId,
        campaign_ids: [platformCampaignId],
        operation_status: 'DELETE',
      }),
    });
  }

  async createAdSet(
    platformCampaignId: string,
    adSet: AdSet,
    account: PlatformAccount
  ): Promise<string> {
    const advertiserId = account.metadata?.advertiserId;
    if (!advertiserId) throw new Error('Missing advertiser ID');

    const targeting = adSet.targeting;
    const tiktokTargeting: any = {};

    if (targeting?.ageRange) {
      tiktokTargeting.age_groups = this.mapAgeGroups(targeting.ageRange.min, targeting.ageRange.max);
    }
    if (targeting?.genders?.length && !targeting.genders.includes('all')) {
      tiktokTargeting.gender = targeting.genders[0] === 'male' ? 'GENDER_MALE' : 'GENDER_FEMALE';
    }
    if (targeting?.locations?.length) {
      tiktokTargeting.location_ids = targeting.locations.map(l => l.name);
    }
    if (targeting?.tiktok?.interests?.length) {
      tiktokTargeting.interest_category_ids = targeting.tiktok.interests;
    }

    const res = await fetch(`${TIKTOK_API_BASE}/adgroup/create/`, {
      method: 'POST',
      headers: this.getHeaders(account),
      body: JSON.stringify({
        advertiser_id: advertiserId,
        campaign_id: platformCampaignId,
        adgroup_name: adSet.name,
        placement_type: 'PLACEMENT_TYPE_AUTOMATIC',
        budget_mode: 'BUDGET_MODE_DAY',
        budget: adSet.budget.daily,
        schedule_type: 'SCHEDULE_START_END',
        schedule_start_time: adSet.schedule.startDate,
        schedule_end_time: adSet.schedule.endDate || undefined,
        billing_event: 'CPC',
        bid_type: 'BID_TYPE_NO_BID',
        targeting: tiktokTargeting,
        operation_status: 'DISABLE',
      }),
    });

    const data = await res.json();
    if (data.code !== 0) throw new Error(`TikTok ad group error: ${data.message}`);
    return data.data?.adgroup_id || '';
  }

  async updateAdSet(
    platformAdSetId: string,
    updates: Partial<AdSet>,
    account: PlatformAccount
  ): Promise<void> {
    const advertiserId = account.metadata?.advertiserId;
    if (!advertiserId) throw new Error('Missing advertiser ID');

    const payload: any = {
      advertiser_id: advertiserId,
      adgroup_id: platformAdSetId,
    };

    if (updates.name) payload.adgroup_name = updates.name;
    if (updates.budget?.daily) payload.budget = updates.budget.daily;

    await fetch(`${TIKTOK_API_BASE}/adgroup/update/`, {
      method: 'POST',
      headers: this.getHeaders(account),
      body: JSON.stringify(payload),
    });
  }

  async createAd(
    platformAdSetId: string,
    creative: AdCreative,
    account: PlatformAccount
  ): Promise<string> {
    const advertiserId = account.metadata?.advertiserId;
    if (!advertiserId) throw new Error('Missing advertiser ID');

    const res = await fetch(`${TIKTOK_API_BASE}/ad/create/`, {
      method: 'POST',
      headers: this.getHeaders(account),
      body: JSON.stringify({
        advertiser_id: advertiserId,
        adgroup_id: platformAdSetId,
        ad_name: creative.headline,
        ad_text: creative.primaryText,
        call_to_action: creative.callToAction || 'LEARN_MORE',
        landing_page_url: creative.destinationUrl,
        display_name: creative.displayUrl || '',
        operation_status: 'DISABLE',
      }),
    });

    const data = await res.json();
    if (data.code !== 0) throw new Error(`TikTok ad creation error: ${data.message}`);
    return data.data?.ad_id || '';
  }

  async updateAd(
    platformAdId: string,
    updates: Partial<AdCreative>,
    account: PlatformAccount
  ): Promise<void> {
    console.log(`[TikTokAdapter] Ad update for ${platformAdId}`);
  }

  async getPerformance(
    platformCampaignId: string,
    dateRange: DateRange,
    account: PlatformAccount
  ): Promise<PerformanceSnapshot[]> {
    const advertiserId = account.metadata?.advertiserId;
    if (!advertiserId) throw new Error('Missing advertiser ID');

    const res = await fetch(`${TIKTOK_API_BASE}/report/integrated/get/`, {
      method: 'POST',
      headers: this.getHeaders(account),
      body: JSON.stringify({
        advertiser_id: advertiserId,
        report_type: 'BASIC',
        dimensions: ['stat_time_day', 'campaign_id'],
        metrics: ['spend', 'impressions', 'reach', 'clicks', 'ctr', 'conversion', 'cost_per_conversion', 'cpc', 'cpm'],
        data_level: 'AUCTION_CAMPAIGN',
        start_date: dateRange.start,
        end_date: dateRange.end,
        filtering: [{
          field_name: 'campaign_ids',
          filter_type: 'IN',
          filter_value: JSON.stringify([platformCampaignId]),
        }],
      }),
    });

    const data = await res.json();
    if (data.code !== 0) throw new Error(`TikTok reporting error: ${data.message}`);

    return (data.data?.list || []).map((row: any) => ({
      id: '',
      campaignId: '',
      platform: 'tiktok' as AdPlatform,
      date: row.dimensions?.stat_time_day || '',
      impressions: parseInt(row.metrics?.impressions || '0'),
      reach: parseInt(row.metrics?.reach || '0'),
      clicks: parseInt(row.metrics?.clicks || '0'),
      ctr: parseFloat(row.metrics?.ctr || '0') * 100,
      spend: parseFloat(row.metrics?.spend || '0'),
      conversions: parseInt(row.metrics?.conversion || '0'),
      cpa: parseFloat(row.metrics?.cost_per_conversion || '0'),
      cpc: parseFloat(row.metrics?.cpc || '0'),
      cpm: parseFloat(row.metrics?.cpm || '0'),
      roas: 0,
      engagement: parseInt(row.metrics?.clicks || '0'),
      videoViews: parseInt(row.metrics?.video_play_actions || '0'),
    }));
  }

  override validateCampaign(campaign: MarketingCampaign): ValidationResult {
    const base = super.validateCampaign(campaign);
    const errors = [...base.errors];
    const warnings = [...base.warnings];

    if (campaign.budget.totalBudget < 200) {
      errors.push('TikTok minimum gunluk butce 200 TL');
    }

    warnings.push('TikTok kampanyalari icin video icerik onerilir');

    return { valid: errors.length === 0, errors, warnings };
  }

  private mapAgeGroups(min: number, max: number): string[] {
    const groups: string[] = [];
    const ranges = [
      { key: 'AGE_13_17', min: 13, max: 17 },
      { key: 'AGE_18_24', min: 18, max: 24 },
      { key: 'AGE_25_34', min: 25, max: 34 },
      { key: 'AGE_35_44', min: 35, max: 44 },
      { key: 'AGE_45_54', min: 45, max: 54 },
      { key: 'AGE_55_100', min: 55, max: 100 },
    ];
    for (const r of ranges) {
      if (r.max >= min && r.min <= max) groups.push(r.key);
    }
    return groups;
  }
}
