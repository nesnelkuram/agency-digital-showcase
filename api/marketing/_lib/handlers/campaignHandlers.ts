import type { ToolContext } from '../toolHandlers.js';
import { getMetaCredentials, META_API_BASE } from '../metaApi.js';

// --- Sync helper functions (used only by sync_campaigns) ---

function extractConversionsFromActions(actions: any[] | undefined): number {
  if (!actions) return 0;
  const conversion = actions.find((a: any) =>
    a.action_type === 'offsite_conversion' || a.action_type === 'lead' || a.action_type === 'purchase'
  );
  return conversion ? parseInt(conversion.value || '0') : 0;
}

function extractCPAFromActions(costPerAction: any[] | undefined): number {
  if (!costPerAction) return 0;
  const cpa = costPerAction.find((a: any) =>
    a.action_type === 'offsite_conversion' || a.action_type === 'lead' || a.action_type === 'purchase'
  );
  return cpa ? parseFloat(cpa.value || '0') : 0;
}

function extractRoasValue(purchaseRoas: any[] | undefined): number {
  if (!purchaseRoas || purchaseRoas.length === 0) return 0;
  const entry = purchaseRoas.find((r: any) => r.action_type === 'omni_purchase' || r.action_type === 'purchase');
  return entry ? parseFloat(entry.value || '0') : 0;
}

function mapMetaStatus(metaStatus: string | undefined): string {
  if (!metaStatus) return 'paused';
  const map: Record<string, string> = {
    ACTIVE: 'active', PAUSED: 'paused', DELETED: 'deleted', ARCHIVED: 'deleted',
    IN_PROCESS: 'paused', WITH_ISSUES: 'active',
  };
  return map[metaStatus] || 'paused';
}

/** Deep-strip undefined values so Firestore doesn't choke */
function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object' && obj.constructor === Object) {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) clean[k] = stripUndefined(v);
    }
    return clean;
  }
  return obj;
}

// --- Handlers ---

export async function handleGetAccountCampaigns(ctx: ToolContext, args: Record<string, any>) {
  const platformAccountId = args.platformAccountId;
  const statusFilter = args.statusFilter && args.statusFilter !== '' ? args.statusFilter : 'active';

  const snap = await ctx.db.collection('marketing_campaigns')
    .where('tenantId', '==', ctx.tenantId)
    .where('platformAccountId', '==', platformAccountId)
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();

  const now = Date.now();

  const EFFECTIVE_TO_DISPLAY: Record<string, string> = {
    'active': 'active', 'paused': 'paused', 'campaign_paused': 'paused',
    'adset_paused': 'paused', 'in_process': 'draft', 'with_issues': 'issues',
    'disapproved': 'disapproved', 'pending_review': 'pending_review',
    'preapproved': 'draft', 'pending_billing': 'paused', 'archived': 'archived',
    'deleted': 'deleted', 'completed': 'completed', 'draft': 'draft',
    'failed': 'failed', 'issues': 'issues',
  };

  const ACTIVE_STATUSES = new Set(['active']);
  const PAUSED_STATUSES = new Set(['paused']);
  const HIDDEN_ALWAYS = new Set(['deleted', 'archived']);

  function resolveDisplayStatus(data: Record<string, any>): string {
    const endDate = data.schedule?.endDate || data.schedule?.stopTime;
    if (endDate) {
      try {
        const endMs = typeof endDate === 'string' ? new Date(endDate).getTime()
          : endDate?.toMillis ? endDate.toMillis()
          : endDate?.seconds ? endDate.seconds * 1000
          : 0;
        if (endMs > 0 && endMs < now) return 'completed';
      } catch { /* ignore */ }
    }
    if (data.effectiveStatus) {
      const eff = data.effectiveStatus.toString().toLowerCase();
      return EFFECTIVE_TO_DISPLAY[eff] || eff;
    }
    const status = (data.status || 'unknown').toString().toLowerCase();
    return EFFECTIVE_TO_DISPLAY[status] || status;
  }

  const campaigns = snap.docs
    .map(d => {
      const data = d.data();
      const displayStatus = resolveDisplayStatus(data);
      const obj: Record<string, any> = {
        id: d.id,
        name: data.name || 'Isimsiz',
        status: displayStatus,
      };
      if (data.effectiveStatus) obj.effectiveStatus = data.effectiveStatus;
      if (data.configuredStatus) obj.configuredStatus = data.configuredStatus;
      if (data.objective) obj.objective = data.objective;
      if (data.platforms) obj.platforms = data.platforms;
      if (data.budget) obj.budget = data.budget;
      if (data.dailyBudget != null) obj.dailyBudget = data.dailyBudget;
      if (data.lifetimeBudget != null) obj.lifetimeBudget = data.lifetimeBudget;
      if (data.budgetRemaining != null) obj.budgetRemaining = data.budgetRemaining;
      if (data.buyingType) obj.buyingType = data.buyingType;
      if (data.issuesInfo) obj.issuesInfo = data.issuesInfo;
      if (data.metaCreatedTime) obj.metaCreatedTime = data.metaCreatedTime;
      if (data.platformCampaignIds) obj.platformCampaignIds = data.platformCampaignIds;
      if (data.schedule?.startDate) obj.startDate = data.schedule.startDate;
      if (data.schedule?.endDate) obj.endDate = data.schedule.endDate;
      return obj;
    })
    .filter(c => {
      if (HIDDEN_ALWAYS.has(c.status)) return false;
      switch (statusFilter) {
        case 'active': return ACTIVE_STATUSES.has(c.status);
        case 'paused': return PAUSED_STATUSES.has(c.status);
        case 'inactive': return !ACTIVE_STATUSES.has(c.status);
        case 'all': return true;
        default: return ACTIVE_STATUSES.has(c.status);
      }
    });

  const statusBreakdown: Record<string, number> = {};
  snap.docs.forEach(d => {
    const ds = resolveDisplayStatus(d.data());
    statusBreakdown[ds] = (statusBreakdown[ds] || 0) + 1;
  });

  return { campaigns, totalInAccount: snap.docs.length, statusBreakdown, statusFilter, component: 'CampaignGrid' };
}

export async function handleGetCampaignDetails(ctx: ToolContext, args: Record<string, any>) {
  const { campaignId } = args;
  const docSnap = await ctx.db.collection('marketing_campaigns').doc(campaignId).get();
  if (!docSnap.exists) return { error: 'Kampanya bulunamadi' };

  const data = docSnap.data()!;
  if (data.tenantId !== ctx.tenantId) return { error: 'Erisim engellendi' };

  const nowMs = Date.now();
  let displayStatus = data.status;
  const endDate = data.schedule?.endDate || data.schedule?.stopTime;
  if (endDate) {
    try {
      const endMs = typeof endDate === 'string' ? new Date(endDate).getTime()
        : endDate?.toMillis ? endDate.toMillis()
        : endDate?.seconds ? endDate.seconds * 1000 : 0;
      if (endMs > 0 && endMs < nowMs) displayStatus = 'completed';
    } catch { /* ignore */ }
  }
  if (data.effectiveStatus && displayStatus !== 'completed') {
    const effMap: Record<string, string> = {
      active: 'active', paused: 'paused', campaign_paused: 'paused', adset_paused: 'paused',
      in_process: 'draft', with_issues: 'issues', disapproved: 'disapproved',
      pending_review: 'pending_review', archived: 'archived', deleted: 'deleted',
    };
    displayStatus = effMap[data.effectiveStatus] || data.effectiveStatus;
  }

  return {
    id: docSnap.id, name: data.name, status: displayStatus,
    effectiveStatus: data.effectiveStatus, configuredStatus: data.configuredStatus,
    objective: data.objective, buyingType: data.buyingType,
    budget: data.budget, dailyBudget: data.dailyBudget, lifetimeBudget: data.lifetimeBudget,
    budgetRemaining: data.budgetRemaining, spendCap: data.spendCap,
    schedule: data.schedule, performance: data.performance || null,
    adSets: (data.adSets || []).map((as: any) => ({ ...as, ads: as.ads || [] })),
    issuesInfo: data.issuesInfo, recommendations: data.recommendations,
    platformCampaignIds: data.platformCampaignIds, metaCreatedTime: data.metaCreatedTime,
    lastSyncAt: data.lastSyncAt, component: 'CampaignDetail',
  };
}

export async function handleSyncCampaigns(ctx: ToolContext, args: Record<string, any>) {
  const { platformAccountId } = args;

  const allPlatforms = await ctx.db.collection('platform_accounts')
    .where('tenantId', '==', ctx.tenantId)
    .get();

  const metaDocs = platformAccountId
    ? allPlatforms.docs.filter(d => d.id === platformAccountId && d.data().status === 'connected')
    : allPlatforms.docs.filter(d => d.data().platform === 'meta' && d.data().status === 'connected');

  if (metaDocs.length === 0) return { error: 'Bagli Meta hesabi bulunamadi' };

  let totalSynced = 0;
  const syncedCampaigns: Array<{ name: string; status: string; effectiveStatus: string; metaId: string }> = [];

  const objectiveMap: Record<string, string> = {
    OUTCOME_AWARENESS: 'awareness', OUTCOME_TRAFFIC: 'traffic', OUTCOME_ENGAGEMENT: 'engagement',
    OUTCOME_LEADS: 'leads', OUTCOME_SALES: 'sales', OUTCOME_APP_PROMOTION: 'app_installs',
    REACH: 'awareness', BRAND_AWARENESS: 'awareness', LINK_CLICKS: 'traffic',
    POST_ENGAGEMENT: 'engagement', LEAD_GENERATION: 'leads',
    CONVERSIONS: 'sales', VIDEO_VIEWS: 'video_views',
  };
  const statusMap: Record<string, string> = {
    ACTIVE: 'active', PAUSED: 'paused', DELETED: 'completed', ARCHIVED: 'completed',
    IN_PROCESS: 'draft', WITH_ISSUES: 'issues',
  };
  const effectiveStatusMap: Record<string, string> = {
    ACTIVE: 'active', PAUSED: 'paused', IN_PROCESS: 'in_process', WITH_ISSUES: 'with_issues',
    CAMPAIGN_PAUSED: 'campaign_paused', ADSET_PAUSED: 'adset_paused', DISAPPROVED: 'disapproved',
    PENDING_REVIEW: 'pending_review', PREAPPROVED: 'preapproved',
    PENDING_BILLING_INFO: 'pending_billing', ARCHIVED: 'archived', DELETED: 'deleted',
  };

  for (const metaDoc of metaDocs) {
    const metaData = metaDoc.data();
    const accessToken = metaData.accessToken || metaData.metadata?.accessToken;
    const adAccountId = metaData.accountId || metaData.metadata?.adAccountId;
    if (!accessToken || !adAccountId) continue;

    const accountIdStr = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

    const campaignFields = 'id,name,objective,status,effective_status,configured_status,buying_type,spend_cap,bid_strategy,special_ad_categories,budget_remaining,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time,issues_info,recommendations,pacing_type,promoted_object';
    let nextUrl: string | null = `${META_API_BASE}/${accountIdStr}/campaigns?access_token=${accessToken}&fields=${campaignFields}&limit=100`;
    const allMetaCampaigns: any[] = [];

    while (nextUrl) {
      const resp = await fetch(nextUrl);
      const data = await resp.json() as any;
      if (data.error) break;
      allMetaCampaigns.push(...(data.data || []));
      nextUrl = data.paging?.next || null;
    }

    if (allMetaCampaigns.length === 0) continue;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const timeRange = JSON.stringify({
      since: thirtyDaysAgo.toISOString().split('T')[0],
      until: now.toISOString().split('T')[0],
    });

    for (const mc of allMetaCampaigns) {
      const objective = objectiveMap[mc.objective] || 'awareness';
      const status = statusMap[mc.status] || 'draft';
      const dailyBudget = mc.daily_budget ? parseInt(mc.daily_budget) / 100 : 0;
      const lifetimeBudget = mc.lifetime_budget ? parseInt(mc.lifetime_budget) / 100 : 0;
      const totalBudget = lifetimeBudget || dailyBudget * 30;

      let performance: Record<string, any> | null = null;
      try {
        const insightsUrl = `${META_API_BASE}/${mc.id}/insights?access_token=${accessToken}&fields=impressions,reach,clicks,ctr,spend,actions,cost_per_action_type,cpc,cpm,frequency,unique_clicks,unique_ctr,cost_per_unique_click,inline_link_clicks,purchase_roas,video_thruplay_watched_actions&time_range=${encodeURIComponent(timeRange)}`;
        const insResp = await fetch(insightsUrl);
        const insData = await insResp.json() as any;
        const ins = insData.data?.[0];
        if (ins) {
          const conversions = extractConversionsFromActions(ins.actions);
          const cpa = extractCPAFromActions(ins.cost_per_action_type);
          performance = {
            totalSpend: parseFloat(ins.spend || '0'),
            totalImpressions: parseInt(ins.impressions || '0'),
            totalClicks: parseInt(ins.clicks || '0'),
            totalConversions: conversions,
            averageCTR: parseFloat(ins.ctr || '0'),
            averageCPA: cpa,
            overallROAS: extractRoasValue(ins.purchase_roas),
            inlineLinkClicks: parseInt(ins.inline_link_clicks || '0'),
            platformBreakdown: {
              meta: {
                spend: parseFloat(ins.spend || '0'),
                impressions: parseInt(ins.impressions || '0'),
                clicks: parseInt(ins.clicks || '0'),
                conversions,
                ctr: parseFloat(ins.ctr || '0'),
                cpc: parseFloat(ins.cpc || '0'),
                cpm: parseFloat(ins.cpm || '0'),
                reach: parseInt(ins.reach || '0'),
                frequency: parseFloat(ins.frequency || '0'),
              },
            },
            lastUpdated: Date.now(),
          };
        }
      } catch { /* skip insights on error */ }

      let adSets: any[] = [];
      try {
        const adSetFields = 'id,name,status,effective_status,daily_budget,lifetime_budget,bid_strategy,targeting,start_time,end_time,optimization_goal,billing_event,pacing_type,daily_min_spend_target,daily_spend_cap,learning_stage_info,destination_type,is_dynamic_creative';
        let adSetsNextUrl: string | null = `${META_API_BASE}/${mc.id}/adsets?access_token=${accessToken}&fields=${adSetFields}&limit=100`;
        const rawAdSets: any[] = [];

        while (adSetsNextUrl) {
          const asResp = await fetch(adSetsNextUrl);
          const asData = await asResp.json() as any;
          if (asData.error) break;
          rawAdSets.push(...(asData.data || []));
          adSetsNextUrl = asData.paging?.next || null;
        }

        adSets = await Promise.all(
          rawAdSets.map(async (as: any) => {
            let ads: any[] = [];
            try {
              const adFields = 'id,name,status,effective_status,preview_shareable_link,recommendations,creative{id,name,title,body,image_url,image_hash,video_id,thumbnail_url,object_story_spec},ad_review_feedback,issues_info';
              let adsNextUrl: string | null = `${META_API_BASE}/${as.id}/ads?access_token=${accessToken}&fields=${adFields}&limit=100`;

              while (adsNextUrl) {
                const adResp = await fetch(adsNextUrl);
                const adData = await adResp.json() as any;
                if (adData.error) break;
                ads.push(...(adData.data || []));
                adsNextUrl = adData.paging?.next || null;
              }
            } catch { /* skip ads on error */ }

            return {
              metaAdSetId: as.id,
              name: as.name,
              status: mapMetaStatus(as.status),
              effectiveStatus: effectiveStatusMap[as.effective_status] || as.effective_status?.toLowerCase(),
              budget: {
                daily: as.daily_budget ? parseInt(as.daily_budget) / 100 : 0,
                lifetime: as.lifetime_budget ? parseInt(as.lifetime_budget) / 100 : undefined,
              },
              bidStrategy: as.bid_strategy?.toLowerCase() || 'lowest_cost',
              optimizationGoal: as.optimization_goal,
              billingEvent: as.billing_event,
              schedule: {
                startDate: as.start_time || '',
                endDate: as.end_time || undefined,
              },
              learningStageInfo: as.learning_stage_info,
              destinationType: as.destination_type,
              isDynamicCreative: as.is_dynamic_creative,
              ads: ads.map((ad: any) => ({
                metaAdId: ad.id,
                name: ad.name,
                status: mapMetaStatus(ad.status),
                effectiveStatus: effectiveStatusMap[ad.effective_status] || ad.effective_status?.toLowerCase(),
                previewShareableLink: ad.preview_shareable_link,
                recommendations: ad.recommendations?.data?.map((r: any) => ({
                  title: r.title || '',
                  message: r.message || '',
                  code: r.code || '',
                })),
                creative: ad.creative ? {
                  headline: ad.creative.title || '',
                  primaryText: ad.creative.body || '',
                  imageUrl: ad.creative.image_url,
                  thumbnailUrl: ad.creative.thumbnail_url,
                } : undefined,
                adReviewFeedback: ad.ad_review_feedback,
                issuesInfo: ad.issues_info,
              })),
            };
          })
        );
      } catch { /* skip adSets on error */ }

      const existing = await ctx.db.collection('marketing_campaigns')
        .where('tenantId', '==', ctx.tenantId)
        .where('platformCampaignIds.meta', '==', mc.id)
        .limit(1).get();

      const campaignDoc: Record<string, any> = stripUndefined({
        platformAccountId: metaDoc.id,
        name: mc.name, objective, platforms: ['meta'], status,
        effectiveStatus: effectiveStatusMap[mc.effective_status] || mc.effective_status?.toLowerCase(),
        configuredStatus: mc.configured_status?.toLowerCase(),
        buyingType: mc.buying_type,
        spendCap: mc.spend_cap ? parseInt(mc.spend_cap) / 100 : undefined,
        dailyBudget, lifetimeBudget,
        budgetRemaining: mc.budget_remaining ? parseInt(mc.budget_remaining) / 100 : undefined,
        specialAdCategories: mc.special_ad_categories,
        pacingType: mc.pacing_type, promotedObject: mc.promoted_object,
        metaCreatedTime: mc.created_time, metaUpdatedTime: mc.updated_time,
        budget: { totalBudget, dailyLimit: dailyBudget, currency: 'TRY', platformSplit: { meta: 100 } },
        schedule: { startDate: mc.start_time || new Date().toISOString(), endDate: mc.stop_time || null },
        platformCampaignIds: { meta: mc.id },
        adSets,
        ...(performance ? { performance } : {}),
        ...(mc.issues_info ? { issuesInfo: mc.issues_info } : {}),
        ...(mc.recommendations?.data ? { recommendations: mc.recommendations.data } : {}),
        lastSyncAt: Date.now(), syncStatus: 'success', updatedAt: Date.now(),
      });

      if (!existing.empty) {
        await existing.docs[0].ref.update(campaignDoc);
      } else {
        await ctx.db.collection('marketing_campaigns').doc().set({
          ...campaignDoc,
          tenantId: ctx.tenantId, description: '', targeting: {}, approvalHistory: [],
          timeline: [{
            id: `evt-${Date.now()}`, type: 'created',
            title: 'Meta\'dan senkronize edildi',
            description: 'Kampanya Meta Ads hesabindan otomatik olarak iceri aktarildi',
            createdAt: Date.now(), createdBy: 'system', createdByName: 'Meta Sync',
          }],
          tags: ['meta-sync'], createdAt: Date.now(),
        });
      }

      totalSynced++;
      syncedCampaigns.push({
        name: mc.name, status,
        effectiveStatus: (effectiveStatusMap[mc.effective_status] || mc.effective_status?.toLowerCase()) || status,
        metaId: mc.id,
      });
    }
  }

  const breakdown: Record<string, number> = {};
  for (const c of syncedCampaigns) {
    const eff = c.effectiveStatus || c.status;
    breakdown[eff] = (breakdown[eff] || 0) + 1;
  }

  return {
    synced: totalSynced, campaigns: syncedCampaigns, statusBreakdown: breakdown,
    message: totalSynced > 0
      ? `${totalSynced} kampanya senkronize edildi (${Object.entries(breakdown).map(([k, v]) => `${v} ${k}`).join(', ')})`
      : 'Kampanya bulunamadi',
  };
}

export async function handleCreateMarketingPlan(ctx: ToolContext, args: Record<string, any>) {
  const { planData } = args;
  const planRef = ctx.db.collection('marketing_plans').doc();
  const doc = {
    id: planRef.id, tenantId: ctx.tenantId, sessionId: ctx.sessionId,
    status: 'draft', planData, createdAt: Date.now(), updatedAt: Date.now(),
  };
  await planRef.set(doc);
  return { planId: planRef.id, planData, component: 'MarketingPlanCard' };
}

export async function handleGetMarketingStats(ctx: ToolContext, args: Record<string, any>) {
  const { projectId } = args;
  let query = ctx.db.collection('marketing_campaigns')
    .where('tenantId', '==', ctx.tenantId) as FirebaseFirestore.Query;
  if (projectId) query = query.where('projectId', '==', projectId);

  const snap = await query.get();
  const campaigns = snap.docs.map(d => d.data());
  const active = campaigns.filter(c => c.status === 'active').length;
  const paused = campaigns.filter(c => c.status === 'paused').length;
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.performance?.totalSpend || 0), 0);

  return { totalCampaigns: campaigns.length, activeCampaigns: active, pausedCampaigns: paused, totalSpend };
}
