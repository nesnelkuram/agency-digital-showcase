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
 * Meta Marketing API Adapter
 *
 * Handles Facebook + Instagram ad campaigns via Meta Marketing API v21.0
 *
 * Setup requirements:
 * 1. Create a Facebook App (type: Business) at developers.facebook.com
 * 2. Add "Marketing API" product
 * 3. Complete App Review for: ads_management, ads_read, business_management
 * 4. Get Business Manager ID and Ad Account ID
 *
 * Environment variables needed:
 * - META_APP_ID: Facebook App ID
 * - META_APP_SECRET: Facebook App Secret
 * - META_AD_ACCOUNT_ID: Ad Account ID (act_XXXXXXXXX)
 */

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// Meta campaign objective mapping
const OBJECTIVE_MAP: Record<string, string> = {
  awareness: 'OUTCOME_AWARENESS',
  traffic: 'OUTCOME_TRAFFIC',
  engagement: 'OUTCOME_ENGAGEMENT',
  leads: 'OUTCOME_LEADS',
  sales: 'OUTCOME_SALES',
  app_installs: 'OUTCOME_APP_PROMOTION',
  video_views: 'OUTCOME_AWARENESS',
};

export class MetaAdapter extends BasePlatformAdapter {
  readonly platform: AdPlatform = 'meta';

  getAuthUrl(redirectUri: string): string {
    const appId = process.env.META_APP_ID;
    if (!appId) throw new Error('META_APP_ID not configured');

    const scopes = [
      'ads_management',
      'ads_read',
      'business_management',
      'pages_read_engagement',
    ].join(',');

    return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`;
  }

  async handleCallback(code: string, redirectUri: string): Promise<PlatformAccount> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) throw new Error('META_APP_ID or META_APP_SECRET not configured');

    // Exchange code for short-lived token
    const tokenUrl = `${META_API_BASE}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;

    const tokenRes = await fetch(tokenUrl);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      throw new Error(`Meta OAuth error: ${tokenData.error.message}`);
    }

    // Exchange for long-lived token (60 days)
    const longLivedUrl = `${META_API_BASE}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`;

    const llRes = await fetch(longLivedUrl);
    const llData = await llRes.json();

    if (llData.error) {
      throw new Error(`Meta long-lived token error: ${llData.error.message}`);
    }

    // Get user info for account name
    const meRes = await fetch(`${META_API_BASE}/me?access_token=${llData.access_token}&fields=name,id`);
    const meData = await meRes.json();

    const expiresInMs = (llData.expires_in || 5184000) * 1000; // default 60 days

    return {
      id: '',
      platform: 'meta',
      accountId: meData.id || '',
      accountName: meData.name || 'Meta Business Account',
      status: 'connected',
      permissions: ['ads_management', 'ads_read', 'business_management'],
      tokenExpiresAt: Timestamp.fromMillis(Date.now() + expiresInMs),
      metadata: {
        accessToken: llData.access_token,
        adAccountId: '', // Filled by callback after account picker selection
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  }

  async refreshToken(account: PlatformAccount): Promise<PlatformAccount> {
    // Meta long-lived tokens can't be refreshed directly.
    // User needs to re-authenticate when token expires.
    // For now, just check if token is still valid.
    if (this.isTokenValid(account)) {
      return account;
    }
    return {
      ...account,
      status: 'expired',
      updatedAt: Timestamp.now(),
    };
  }

  async createCampaign(
    campaign: MarketingCampaign,
    account: PlatformAccount
  ): Promise<PlatformCampaignResult> {
    const accessToken = account.metadata?.accessToken;
    const adAccountId = account.metadata?.adAccountId;

    if (!accessToken || !adAccountId) {
      return { success: false, error: 'Missing access token or ad account ID' };
    }

    try {
      // 1. Create campaign
      const campaignRes = await fetch(`${META_API_BASE}/${adAccountId}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          name: campaign.name,
          objective: OBJECTIVE_MAP[campaign.objective] || 'OUTCOME_AWARENESS',
          status: 'PAUSED', // Always start paused for safety
          special_ad_categories: [],
          daily_budget: Math.round((campaign.budget.dailyLimit || campaign.budget.totalBudget / 30) * 100), // Cents
        }),
      });

      const campaignData = await campaignRes.json();

      if (campaignData.error) {
        return { success: false, error: campaignData.error.message };
      }

      const platformCampaignId = campaignData.id;
      const platformAdSetIds: string[] = [];
      const platformAdIds: string[] = [];

      // 2. Create ad sets
      for (const adSet of campaign.adSets.filter(as => as.platform === 'meta')) {
        const adSetId = await this.createAdSet(platformCampaignId, adSet, account);
        platformAdSetIds.push(adSetId);

        // 3. Create ads for each ad set
        for (const ad of adSet.ads) {
          const adId = await this.createAd(adSetId, ad.creative, account);
          platformAdIds.push(adId);
        }
      }

      return {
        success: true,
        platformCampaignId,
        platformAdSetIds,
        platformAdIds,
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
    const accessToken = account.metadata?.accessToken;
    if (!accessToken) throw new Error('Missing access token');

    const updatePayload: any = { access_token: accessToken };

    if (updates.name) updatePayload.name = updates.name;
    if (updates.status === 'active') updatePayload.status = 'ACTIVE';
    if (updates.status === 'paused') updatePayload.status = 'PAUSED';

    await fetch(`${META_API_BASE}/${platformCampaignId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });
  }

  async pauseCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void> {
    await this.updateCampaign(platformCampaignId, { status: 'paused' } as any, account);
  }

  async resumeCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void> {
    await this.updateCampaign(platformCampaignId, { status: 'active' } as any, account);
  }

  async deleteCampaign(platformCampaignId: string, account: PlatformAccount): Promise<void> {
    const accessToken = account.metadata?.accessToken;
    if (!accessToken) throw new Error('Missing access token');

    await fetch(`${META_API_BASE}/${platformCampaignId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    });
  }

  async createAdSet(
    platformCampaignId: string,
    adSet: AdSet,
    account: PlatformAccount
  ): Promise<string> {
    const accessToken = account.metadata?.accessToken;
    const adAccountId = account.metadata?.adAccountId;
    if (!accessToken || !adAccountId) throw new Error('Missing credentials');

    const targeting = this.buildMetaTargeting(adSet);

    const res = await fetch(`${META_API_BASE}/${adAccountId}/adsets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        campaign_id: platformCampaignId,
        name: adSet.name,
        daily_budget: Math.round(adSet.budget.daily * 100),
        bid_strategy: this.mapBidStrategy(adSet.bidStrategy),
        billing_event: 'IMPRESSIONS',
        targeting,
        start_time: adSet.schedule.startDate,
        end_time: adSet.schedule.endDate || undefined,
        status: 'PAUSED',
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error(`Meta ad set creation failed: ${data.error.message}`);
    return data.id;
  }

  async updateAdSet(
    platformAdSetId: string,
    updates: Partial<AdSet>,
    account: PlatformAccount
  ): Promise<void> {
    const accessToken = account.metadata?.accessToken;
    if (!accessToken) throw new Error('Missing access token');

    const updatePayload: any = { access_token: accessToken };
    if (updates.name) updatePayload.name = updates.name;
    if (updates.budget?.daily) updatePayload.daily_budget = Math.round(updates.budget.daily * 100);

    await fetch(`${META_API_BASE}/${platformAdSetId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });
  }

  async createAd(
    platformAdSetId: string,
    creative: AdCreative,
    account: PlatformAccount
  ): Promise<string> {
    const accessToken = account.metadata?.accessToken;
    const adAccountId = account.metadata?.adAccountId;
    if (!accessToken || !adAccountId) throw new Error('Missing credentials');

    // First create ad creative
    const creativeRes = await fetch(`${META_API_BASE}/${adAccountId}/adcreatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        name: creative.headline,
        object_story_spec: {
          link_data: {
            link: creative.destinationUrl,
            message: creative.primaryText,
            name: creative.headline,
            description: creative.description || '',
            call_to_action: {
              type: this.mapCTA(creative.callToAction),
              value: { link: creative.destinationUrl },
            },
          },
        },
      }),
    });

    const creativeData = await creativeRes.json();
    if (creativeData.error) throw new Error(`Meta creative creation failed: ${creativeData.error.message}`);

    // Then create ad
    const adRes = await fetch(`${META_API_BASE}/${adAccountId}/ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: accessToken,
        adset_id: platformAdSetId,
        name: creative.headline,
        creative: { creative_id: creativeData.id },
        status: 'PAUSED',
      }),
    });

    const adData = await adRes.json();
    if (adData.error) throw new Error(`Meta ad creation failed: ${adData.error.message}`);
    return adData.id;
  }

  async updateAd(
    platformAdId: string,
    updates: Partial<AdCreative>,
    account: PlatformAccount
  ): Promise<void> {
    const accessToken = account.metadata?.accessToken;
    if (!accessToken) throw new Error('Missing access token');

    // Meta requires creating a new creative for ad updates
    console.log(`[MetaAdapter] Ad update requires new creative for ad ${platformAdId}`);
  }

  async getPerformance(
    platformCampaignId: string,
    dateRange: DateRange,
    account: PlatformAccount
  ): Promise<PerformanceSnapshot[]> {
    const accessToken = account.metadata?.accessToken;
    if (!accessToken) throw new Error('Missing access token');

    const fields = [
      'date_start', 'date_stop',
      'impressions', 'reach', 'clicks',
      'ctr', 'spend', 'actions',
      'cost_per_action_type', 'cpc', 'cpm',
      'frequency',
    ].join(',');

    const res = await fetch(
      `${META_API_BASE}/${platformCampaignId}/insights?access_token=${accessToken}&fields=${fields}&time_range={"since":"${dateRange.start}","until":"${dateRange.end}"}&time_increment=1`
    );

    const data = await res.json();
    if (data.error) throw new Error(`Meta insights error: ${data.error.message}`);

    return (data.data || []).map((row: any) => ({
      id: '',
      campaignId: '',
      platform: 'meta' as AdPlatform,
      date: row.date_start,
      impressions: parseInt(row.impressions || '0'),
      reach: parseInt(row.reach || '0'),
      clicks: parseInt(row.clicks || '0'),
      ctr: parseFloat(row.ctr || '0'),
      spend: parseFloat(row.spend || '0'),
      conversions: this.extractConversions(row.actions),
      cpa: this.extractCPA(row.cost_per_action_type),
      cpc: parseFloat(row.cpc || '0'),
      cpm: parseFloat(row.cpm || '0'),
      roas: 0, // Requires revenue data
      engagement: parseInt(row.clicks || '0'),
      frequency: parseFloat(row.frequency || '0'),
    }));
  }

  override validateCampaign(campaign: MarketingCampaign): ValidationResult {
    const base = super.validateCampaign(campaign);
    const errors = [...base.errors];
    const warnings = [...base.warnings];

    // Meta-specific validations
    if (campaign.budget.totalBudget < 100) {
      errors.push('Meta minimum gunluk butce 100 TL');
    }

    const metaAdSets = campaign.adSets.filter(as => as.platform === 'meta');
    if (metaAdSets.length === 0) {
      errors.push('En az bir Meta reklam seti gerekli');
    }

    metaAdSets.forEach((adSet, i) => {
      if (!adSet.targeting?.meta?.interests?.length && !adSet.targeting?.meta?.customAudiences?.length) {
        warnings.push(`Reklam Seti ${i + 1}: Interest veya custom audience hedefleme onerilir`);
      }
    });

    return { valid: errors.length === 0, errors, warnings };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private buildMetaTargeting(adSet: AdSet): any {
    const t = adSet.targeting;
    const targeting: any = {};

    if (t?.ageRange) {
      targeting.age_min = t.ageRange.min;
      targeting.age_max = t.ageRange.max;
    }

    if (t?.genders?.length && !t.genders.includes('all')) {
      targeting.genders = t.genders.map(g => g === 'male' ? 1 : 2);
    }

    if (t?.locations?.length) {
      targeting.geo_locations = {
        countries: t.locations.filter(l => l.type === 'country').map(l => l.name),
        cities: t.locations.filter(l => l.type === 'city').map(l => ({ key: l.name })),
      };
    }

    if (t?.meta?.interests?.length) {
      targeting.interests = t.meta.interests.map(i => ({ name: i }));
    }

    if (t?.meta?.behaviors?.length) {
      targeting.behaviors = t.meta.behaviors.map(b => ({ name: b }));
    }

    if (t?.meta?.placements?.length) {
      targeting.publisher_platforms = ['facebook', 'instagram'];
      targeting.facebook_positions = t.meta.placements.filter(p =>
        ['feed', 'stories', 'reels', 'right_hand_column'].includes(p)
      );
      targeting.instagram_positions = t.meta.placements.filter(p =>
        ['stream', 'story', 'reels', 'explore'].includes(p)
      );
    }

    return targeting;
  }

  private mapBidStrategy(strategy: string): string {
    const map: Record<string, string> = {
      lowest_cost: 'LOWEST_COST_WITHOUT_CAP',
      cost_cap: 'COST_CAP',
      bid_cap: 'LOWEST_COST_WITH_BID_CAP',
      target_cost: 'COST_CAP',
    };
    return map[strategy] || 'LOWEST_COST_WITHOUT_CAP';
  }

  private mapCTA(cta: string): string {
    const ctaMap: Record<string, string> = {
      'Simdi Al': 'SHOP_NOW',
      'Daha Fazla Bilgi': 'LEARN_MORE',
      'Kayit Ol': 'SIGN_UP',
      'Iletisime Gec': 'CONTACT_US',
      'Teklif Al': 'GET_QUOTE',
    };
    return ctaMap[cta] || 'LEARN_MORE';
  }

  private extractConversions(actions: any[]): number {
    if (!actions) return 0;
    const conversion = actions.find((a: any) =>
      a.action_type === 'offsite_conversion' ||
      a.action_type === 'lead' ||
      a.action_type === 'purchase'
    );
    return conversion ? parseInt(conversion.value || '0') : 0;
  }

  private extractCPA(costPerAction: any[]): number {
    if (!costPerAction) return 0;
    const cpa = costPerAction.find((a: any) =>
      a.action_type === 'offsite_conversion' ||
      a.action_type === 'lead' ||
      a.action_type === 'purchase'
    );
    return cpa ? parseFloat(cpa.value || '0') : 0;
  }
}
