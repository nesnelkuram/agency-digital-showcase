import type { VercelResponse } from '@vercel/node';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';

export const config = {
  maxDuration: 120,
};

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// Reverse-map Meta objectives to our internal values
const REVERSE_OBJECTIVE_MAP: Record<string, string> = {
  OUTCOME_AWARENESS: 'awareness',
  OUTCOME_TRAFFIC: 'traffic',
  OUTCOME_ENGAGEMENT: 'engagement',
  OUTCOME_LEADS: 'leads',
  OUTCOME_SALES: 'sales',
  OUTCOME_APP_PROMOTION: 'app_installs',
  REACH: 'awareness',
  BRAND_AWARENESS: 'awareness',
  LINK_CLICKS: 'traffic',
  POST_ENGAGEMENT: 'engagement',
  LEAD_GENERATION: 'leads',
  CONVERSIONS: 'sales',
  VIDEO_VIEWS: 'video_views',
};

// Map Meta campaign status to our internal values
const STATUS_MAP: Record<string, string> = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DELETED: 'completed',
  ARCHIVED: 'completed',
  IN_PROCESS: 'draft',
  WITH_ISSUES: 'issues',
};

// Map Meta effective_status to internal lowercase format
const EFFECTIVE_STATUS_MAP: Record<string, string> = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  IN_PROCESS: 'in_process',
  WITH_ISSUES: 'with_issues',
  CAMPAIGN_PAUSED: 'campaign_paused',
  ADSET_PAUSED: 'adset_paused',
  DISAPPROVED: 'disapproved',
  PENDING_REVIEW: 'pending_review',
  PREAPPROVED: 'preapproved',
  PENDING_BILLING_INFO: 'pending_billing',
  ARCHIVED: 'archived',
  DELETED: 'deleted',
};

/**
 * POST /api/marketing/sync-campaigns
 *
 * Fetches campaigns and their performance data from Meta Marketing API.
 * Returns mapped campaign data for the frontend to save to Firestore.
 *
 * Body:
 *  - accessToken: string (Meta access token)
 *  - adAccountId: string (Meta ad account ID)
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { accessToken, adAccountId, deepSync = true } = req.body;

    if (!accessToken || !adAccountId) {
      return res.status(400).json({
        error: 'Missing required fields: accessToken, adAccountId',
      });
    }

    // Ensure adAccountId has act_ prefix
    const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

    console.log(`[sync-campaigns] Fetching campaigns for ${accountId}`);

    // 1. Fetch campaigns from Meta (with pagination)
    const campaignFields = 'id,name,objective,status,effective_status,configured_status,buying_type,spend_cap,bid_strategy,special_ad_categories,budget_remaining,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time,issues_info,recommendations,pacing_type,promoted_object';
    let campaignsNextUrl: string | null = `${META_API_BASE}/${accountId}/campaigns?access_token=${accessToken}&fields=${campaignFields}&limit=100`;
    const metaCampaigns: any[] = [];

    while (campaignsNextUrl) {
      const campaignsRes = await fetch(campaignsNextUrl);
      const campaignsData = await campaignsRes.json();

      if (campaignsData.error) {
        throw new Error(`Meta API error: ${campaignsData.error.message}`);
      }

      metaCampaigns.push(...(campaignsData.data || []));
      campaignsNextUrl = campaignsData.paging?.next || null;
    }

    console.log(`[sync-campaigns] Found ${metaCampaigns.length} campaigns`);

    // 2. For each campaign, fetch lifetime insights
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const timeRange = JSON.stringify({
      since: thirtyDaysAgo.toISOString().split('T')[0],
      until: now.toISOString().split('T')[0],
    });

    const campaigns = await Promise.all(
      metaCampaigns.map(async (mc: any) => {
        // Fetch insights for this campaign
        let insights = null;
        try {
          const insightsUrl = `${META_API_BASE}/${mc.id}/insights?access_token=${accessToken}&fields=impressions,reach,clicks,ctr,spend,actions,cost_per_action_type,cpc,cpm,frequency,unique_clicks,unique_ctr,cost_per_unique_click,quality_ranking,engagement_rate_ranking,conversion_rate_ranking,inline_link_clicks,outbound_clicks,purchase_roas,video_thruplay_watched_actions&time_range=${encodeURIComponent(timeRange)}`;
          const insightsRes = await fetch(insightsUrl);
          const insightsData = await insightsRes.json();
          insights = insightsData.data?.[0] || null;
        } catch (err: any) {
          console.warn(`[sync-campaigns] Failed to fetch insights for campaign ${mc.id}:`, err.message);
        }

        // Extract conversions from actions
        const conversions = extractConversions(insights?.actions);
        const cpa = extractCPA(insights?.cost_per_action_type);

        // Map to our campaign format
        const objective = REVERSE_OBJECTIVE_MAP[mc.objective] || 'awareness';
        const status = STATUS_MAP[mc.status] || 'draft';
        const dailyBudget = mc.daily_budget ? parseInt(mc.daily_budget) / 100 : 0;
        const lifetimeBudget = mc.lifetime_budget ? parseInt(mc.lifetime_budget) / 100 : 0;
        const totalBudget = lifetimeBudget || dailyBudget * 30;

        // --- Deep sync: fetch ad sets and ads for this campaign ---
        let adSets: any[] = [];
        if (deepSync) {
          try {
            console.log(`[sync-campaigns] Fetching ad sets for campaign ${mc.id}`);
            const adSetFields = 'id,name,status,effective_status,daily_budget,lifetime_budget,bid_strategy,targeting,start_time,end_time,optimization_goal,billing_event,pacing_type,attribution_spec,promoted_object,frequency_control_specs,daily_min_spend_target,daily_spend_cap,learning_stage_info,destination_type,is_dynamic_creative';
            let adSetsNextUrl: string | null = `${META_API_BASE}/${mc.id}/adsets?access_token=${accessToken}&fields=${adSetFields}&limit=100`;
            const rawAdSets: any[] = [];
            let adSetsError = false;

            while (adSetsNextUrl) {
              const adSetsRes = await fetch(adSetsNextUrl);
              const adSetsData = await adSetsRes.json();

              if (adSetsData.error) {
                console.warn(`[sync-campaigns] Meta API error fetching ad sets for campaign ${mc.id}: ${adSetsData.error.message}`);
                adSetsError = true;
                break;
              }

              rawAdSets.push(...(adSetsData.data || []));
              adSetsNextUrl = adSetsData.paging?.next || null;
            }

            if (!adSetsError) {

              // For each ad set, fetch its ads (in parallel)
              adSets = await Promise.all(
                rawAdSets.map(async (as: any) => {
                  let ads: any[] = [];
                  try {
                    console.log(`[sync-campaigns] Fetching ads for ad set ${as.id}`);
                    const adFields = 'id,name,status,effective_status,preview_shareable_link,recommendations,creative{id,name,title,body,image_url,image_hash,video_id,thumbnail_url,object_story_spec},ad_review_feedback,issues_info';
                    let adsNextUrl: string | null = `${META_API_BASE}/${as.id}/ads?access_token=${accessToken}&fields=${adFields}&limit=100`;

                    while (adsNextUrl) {
                      const adsRes = await fetch(adsNextUrl);
                      const adsData = await adsRes.json();

                      if (adsData.error) {
                        console.warn(`[sync-campaigns] Meta API error fetching ads for ad set ${as.id}: ${adsData.error.message}`);
                        break;
                      }

                      ads.push(...(adsData.data || []));
                      adsNextUrl = adsData.paging?.next || null;
                    }
                  } catch (adErr: any) {
                    console.warn(`[sync-campaigns] Failed to fetch ads for ad set ${as.id}:`, adErr.message);
                  }

                  return {
                    metaAdSetId: as.id,
                    name: as.name,
                    status: mapAdSetStatus(as.status),
                    effectiveStatus: EFFECTIVE_STATUS_MAP[as.effective_status] || as.effective_status?.toLowerCase(),
                    budget: {
                      daily: as.daily_budget ? parseInt(as.daily_budget) / 100 : 0,
                      lifetime: as.lifetime_budget ? parseInt(as.lifetime_budget) / 100 : undefined,
                    },
                    bidStrategy: mapBidStrategy(as.bid_strategy),
                    optimizationGoal: as.optimization_goal,
                    billingEvent: as.billing_event,
                    pacingType: as.pacing_type,
                    attributionSpec: as.attribution_spec,
                    promotedObject: as.promoted_object,
                    frequencyControlSpecs: as.frequency_control_specs,
                    dailyMinSpendTarget: as.daily_min_spend_target ? parseInt(as.daily_min_spend_target) / 100 : undefined,
                    dailySpendCap: as.daily_spend_cap ? parseInt(as.daily_spend_cap) / 100 : undefined,
                    targetingJson: as.targeting || {},
                    schedule: {
                      startDate: as.start_time || '',
                      endDate: as.end_time || undefined,
                    },
                    // New Meta fields
                    learningStageInfo: as.learning_stage_info,
                    destinationType: as.destination_type,
                    isDynamicCreative: as.is_dynamic_creative,
                    ads: ads.map((ad: any) => ({
                      metaAdId: ad.id,
                      name: ad.name,
                      status: mapAdSetStatus(ad.status),
                      effectiveStatus: EFFECTIVE_STATUS_MAP[ad.effective_status] || ad.effective_status?.toLowerCase(),
                      previewShareableLink: ad.preview_shareable_link,
                      recommendations: ad.recommendations?.data?.map((r: any) => ({
                        title: r.title || '',
                        message: r.message || '',
                        code: r.code || '',
                      })),
                      metaCreativeId: ad.creative?.id,
                      creative: {
                        headline: ad.creative?.title || '',
                        primaryText: ad.creative?.body || '',
                        callToAction: '',
                        destinationUrl: '',
                        imageUrl: ad.creative?.image_url,
                        thumbnailUrl: ad.creative?.thumbnail_url,
                        metaImageHash: ad.creative?.image_hash,
                        metaPreviewUrl: undefined,
                      },
                      // New Meta fields
                      adReviewFeedback: ad.ad_review_feedback,
                      issuesInfo: ad.issues_info,
                    })),
                  };
                })
              );
            }
          } catch (adSetErr: any) {
            console.warn(`[sync-campaigns] Failed to fetch ad sets for campaign ${mc.id}:`, adSetErr.message);
          }
        }

        return {
          metaCampaignId: mc.id,
          name: mc.name,
          objective,
          status,
          effectiveStatus: EFFECTIVE_STATUS_MAP[mc.effective_status] || mc.effective_status?.toLowerCase(),
          configuredStatus: mc.configured_status?.toLowerCase(),
          buyingType: mc.buying_type,
          spendCap: mc.spend_cap ? parseInt(mc.spend_cap) / 100 : undefined,
          budgetRemaining: mc.budget_remaining ? parseInt(mc.budget_remaining) / 100 : undefined,
          specialAdCategories: mc.special_ad_categories,
          dailyBudget,
          lifetimeBudget,
          issuesInfo: mc.issues_info,
          recommendations: mc.recommendations?.data,
          pacingType: mc.pacing_type,
          promotedObject: mc.promoted_object,
          metaCreatedTime: mc.created_time,
          metaUpdatedTime: mc.updated_time,
          platforms: ['meta'],
          budget: {
            totalBudget,
            dailyLimit: dailyBudget,
            currency: 'TRY',
            platformSplit: { meta: 100 },
          },
          schedule: {
            startDate: mc.start_time || new Date().toISOString(),
            endDate: mc.stop_time || null,
          },
          performance: insights ? {
            totalSpend: parseFloat(insights.spend || '0'),
            totalImpressions: parseInt(insights.impressions || '0'),
            totalClicks: parseInt(insights.clicks || '0'),
            totalConversions: conversions,
            averageCTR: parseFloat(insights.ctr || '0'),
            averageCPA: cpa,
            overallROAS: extractRoas(insights.purchase_roas),
            inlineLinkClicks: parseInt(insights.inline_link_clicks || '0'),
            videoThruplay: extractVideoThruplay(insights.video_thruplay_watched_actions),
            actionBreakdown: parseActionBreakdown(insights.actions),
            platformBreakdown: {
              meta: {
                spend: parseFloat(insights.spend || '0'),
                impressions: parseInt(insights.impressions || '0'),
                clicks: parseInt(insights.clicks || '0'),
                conversions,
                ctr: parseFloat(insights.ctr || '0'),
                cpc: parseFloat(insights.cpc || '0'),
                cpm: parseFloat(insights.cpm || '0'),
                reach: parseInt(insights.reach || '0'),
                frequency: parseFloat(insights.frequency || '0'),
              },
            },
          } : null,
          createdTime: mc.created_time,
          updatedTime: mc.updated_time,
          ...(deepSync ? { adSets } : {}),
        };
      })
    );

    console.log(`[sync-campaigns] Successfully synced ${campaigns.length} campaigns with insights`);

    return res.status(200).json({
      success: true,
      synced: campaigns.length,
      campaigns,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[sync-campaigns] Error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Campaign sync failed',
    });
  }
});

function extractRoas(purchaseRoas: any[] | undefined): number {
  if (!purchaseRoas || purchaseRoas.length === 0) return 0;
  const entry = purchaseRoas.find((r: any) => r.action_type === 'omni_purchase' || r.action_type === 'purchase');
  return entry ? parseFloat(entry.value || '0') : 0;
}

function extractVideoThruplay(videoActions: any[] | undefined): number {
  if (!videoActions || videoActions.length === 0) return 0;
  const entry = videoActions.find((a: any) => a.action_type === 'video_view');
  return entry ? parseInt(entry.value || '0') : 0;
}

function parseActionBreakdown(actions: any[] | undefined): Record<string, number> | undefined {
  if (!actions || actions.length === 0) return undefined;
  const breakdown: Record<string, number> = {};
  for (const action of actions) {
    if (action.action_type && action.value) {
      breakdown[action.action_type] = parseInt(action.value || '0');
    }
  }
  return Object.keys(breakdown).length > 0 ? breakdown : undefined;
}

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

// Map Meta ad set / ad status to internal values
function mapAdSetStatus(metaStatus: string | undefined): string {
  if (!metaStatus) return 'paused';
  const map: Record<string, string> = {
    ACTIVE: 'active',
    PAUSED: 'paused',
    DELETED: 'deleted',
    ARCHIVED: 'deleted',
    IN_PROCESS: 'paused',
    WITH_ISSUES: 'active',
  };
  return map[metaStatus] || 'paused';
}

// Map Meta bid strategy to internal values
function mapBidStrategy(metaBidStrategy: string | undefined): string {
  if (!metaBidStrategy) return 'lowest_cost';
  const map: Record<string, string> = {
    LOWEST_COST_WITHOUT_CAP: 'lowest_cost',
    LOWEST_COST_WITH_BID_CAP: 'bid_cap',
    COST_CAP: 'cost_cap',
  };
  return map[metaBidStrategy] || 'lowest_cost';
}
