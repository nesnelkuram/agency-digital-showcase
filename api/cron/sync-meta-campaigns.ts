import '../_lib/env';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 300,
};

const META_API = 'https://graph.facebook.com/v21.0';

const OBJECTIVE_MAP: Record<string, string> = {
  OUTCOME_AWARENESS: 'awareness', OUTCOME_TRAFFIC: 'traffic', OUTCOME_ENGAGEMENT: 'engagement',
  OUTCOME_LEADS: 'leads', OUTCOME_SALES: 'sales', OUTCOME_APP_PROMOTION: 'app_installs',
  REACH: 'awareness', BRAND_AWARENESS: 'awareness', LINK_CLICKS: 'traffic',
  POST_ENGAGEMENT: 'engagement', LEAD_GENERATION: 'leads',
  CONVERSIONS: 'sales', VIDEO_VIEWS: 'video_views',
};

const STATUS_MAP: Record<string, string> = {
  ACTIVE: 'active', PAUSED: 'paused', DELETED: 'completed', ARCHIVED: 'completed',
  IN_PROCESS: 'draft', WITH_ISSUES: 'issues',
};

const EFFECTIVE_STATUS_MAP: Record<string, string> = {
  ACTIVE: 'active', PAUSED: 'paused', IN_PROCESS: 'in_process', WITH_ISSUES: 'with_issues',
  CAMPAIGN_PAUSED: 'campaign_paused', ADSET_PAUSED: 'adset_paused', DISAPPROVED: 'disapproved',
  PENDING_REVIEW: 'pending_review', PREAPPROVED: 'preapproved',
  PENDING_BILLING_INFO: 'pending_billing', ARCHIVED: 'archived', DELETED: 'deleted',
};

/**
 * GET /api/cron/sync-meta-campaigns
 *
 * Vercel Cron — runs every 6 hours.
 * Deep-syncs campaigns, ad sets, ads, and insights for all connected Meta accounts.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const results: Array<{
    tenantId: string;
    accountName: string;
    status: 'synced' | 'error';
    campaignsSynced?: number;
    error?: string;
  }> = [];

  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (getApps().length === 0) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : undefined;

      initializeApp(
        serviceAccount
          ? { credential: cert(serviceAccount) }
          : { projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID }
      );
    }

    const db = getFirestore();

    console.log('[cron-sync-meta] Starting periodic Meta campaign sync...');

    // Find all connected Meta platform accounts across all tenants
    const accountsSnap = await db.collection('platform_accounts')
      .where('platform', '==', 'meta')
      .where('status', '==', 'connected')
      .get();

    if (accountsSnap.empty) {
      return res.status(200).json({
        success: true,
        message: 'No connected Meta accounts found',
        results: [],
        duration: Date.now() - startTime,
      });
    }

    console.log(`[cron-sync-meta] Found ${accountsSnap.size} connected Meta account(s)`);

    for (const accountDoc of accountsSnap.docs) {
      const accountData = accountDoc.data();
      const tenantId = accountData.tenantId;
      const accessToken = accountData.accessToken || accountData.metadata?.accessToken;
      const adAccountId = accountData.accountId || accountData.metadata?.adAccountId;
      const accountName = accountData.accountName || adAccountId || accountDoc.id;

      if (!accessToken || !adAccountId || !tenantId) {
        results.push({ tenantId: tenantId || 'unknown', accountName, status: 'error', error: 'Token/ID/tenant eksik' });
        continue;
      }

      try {
        const accountIdStr = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

        // 1. Fetch campaigns
        const campaignFields = 'id,name,objective,status,effective_status,configured_status,buying_type,spend_cap,budget_remaining,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time,issues_info,recommendations,pacing_type,promoted_object';
        let nextUrl: string | null = `${META_API}/${accountIdStr}/campaigns?access_token=${accessToken}&fields=${campaignFields}&limit=100`;
        const campaigns: any[] = [];

        while (nextUrl) {
          const resp = await fetch(nextUrl);
          const data = await resp.json() as any;
          if (data.error) {
            throw new Error(`Meta API: ${data.error.message}`);
          }
          campaigns.push(...(data.data || []));
          nextUrl = data.paging?.next || null;
        }

        // 2. 30-day time range for insights
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const timeRange = JSON.stringify({
          since: thirtyDaysAgo.toISOString().split('T')[0],
          until: now.toISOString().split('T')[0],
        });

        let synced = 0;

        for (const mc of campaigns) {
          const objective = OBJECTIVE_MAP[mc.objective] || 'awareness';
          const status = STATUS_MAP[mc.status] || 'draft';
          const dailyBudget = mc.daily_budget ? parseInt(mc.daily_budget) / 100 : 0;
          const lifetimeBudget = mc.lifetime_budget ? parseInt(mc.lifetime_budget) / 100 : 0;

          // Fetch insights
          let performance: Record<string, any> | null = null;
          try {
            const insUrl = `${META_API}/${mc.id}/insights?access_token=${accessToken}&fields=impressions,reach,clicks,ctr,spend,actions,cost_per_action_type,cpc,cpm,frequency,unique_clicks,inline_link_clicks,purchase_roas&time_range=${encodeURIComponent(timeRange)}`;
            const insResp = await fetch(insUrl);
            const insData = await insResp.json() as any;
            const ins = insData.data?.[0];
            if (ins) {
              performance = {
                totalSpend: parseFloat(ins.spend || '0'),
                totalImpressions: parseInt(ins.impressions || '0'),
                totalClicks: parseInt(ins.clicks || '0'),
                averageCTR: parseFloat(ins.ctr || '0'),
                platformBreakdown: {
                  meta: {
                    spend: parseFloat(ins.spend || '0'),
                    impressions: parseInt(ins.impressions || '0'),
                    clicks: parseInt(ins.clicks || '0'),
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
          } catch { /* skip insights */ }

          // Fetch ad sets + ads
          let adSets: any[] = [];
          try {
            const asFields = 'id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,learning_stage_info,destination_type';
            let asNextUrl: string | null = `${META_API}/${mc.id}/adsets?access_token=${accessToken}&fields=${asFields}&limit=100`;
            const rawAdSets: any[] = [];

            while (asNextUrl) {
              const asResp = await fetch(asNextUrl);
              const asData = await asResp.json() as any;
              if (asData.error) break;
              rawAdSets.push(...(asData.data || []));
              asNextUrl = asData.paging?.next || null;
            }

            adSets = await Promise.all(
              rawAdSets.map(async (as: any) => {
                let ads: any[] = [];
                try {
                  const adFields = 'id,name,status,effective_status,preview_shareable_link,creative{id,title,body,image_url,thumbnail_url},issues_info';
                  const adResp = await fetch(`${META_API}/${as.id}/ads?access_token=${accessToken}&fields=${adFields}&limit=100`);
                  const adData = await adResp.json() as any;
                  if (!adData.error) {
                    ads = (adData.data || []).map((ad: any) => ({
                      metaAdId: ad.id,
                      name: ad.name,
                      status: mapStatus(ad.status),
                      effectiveStatus: EFFECTIVE_STATUS_MAP[ad.effective_status] || ad.effective_status?.toLowerCase(),
                      previewShareableLink: ad.preview_shareable_link,
                      creative: ad.creative ? {
                        headline: ad.creative.title || '',
                        primaryText: ad.creative.body || '',
                        imageUrl: ad.creative.image_url,
                        thumbnailUrl: ad.creative.thumbnail_url,
                      } : undefined,
                      issuesInfo: ad.issues_info,
                    }));
                  }
                } catch { /* skip */ }

                return {
                  metaAdSetId: as.id,
                  name: as.name,
                  status: mapStatus(as.status),
                  effectiveStatus: EFFECTIVE_STATUS_MAP[as.effective_status] || as.effective_status?.toLowerCase(),
                  budget: {
                    daily: as.daily_budget ? parseInt(as.daily_budget) / 100 : 0,
                    lifetime: as.lifetime_budget ? parseInt(as.lifetime_budget) / 100 : undefined,
                  },
                  optimizationGoal: as.optimization_goal,
                  billingEvent: as.billing_event,
                  learningStageInfo: as.learning_stage_info,
                  destinationType: as.destination_type,
                  ads,
                };
              })
            );
          } catch { /* skip adSets */ }

          // Upsert to Firestore
          const existing = await db.collection('marketing_campaigns')
            .where('tenantId', '==', tenantId)
            .where('platformCampaignIds.meta', '==', mc.id)
            .limit(1).get();

          const campaignDoc = stripUndefined({
            platformAccountId: accountDoc.id,
            name: mc.name,
            objective,
            platforms: ['meta'],
            status,
            effectiveStatus: EFFECTIVE_STATUS_MAP[mc.effective_status] || mc.effective_status?.toLowerCase(),
            configuredStatus: mc.configured_status?.toLowerCase(),
            buyingType: mc.buying_type,
            spendCap: mc.spend_cap ? parseInt(mc.spend_cap) / 100 : undefined,
            dailyBudget,
            lifetimeBudget,
            budgetRemaining: mc.budget_remaining ? parseInt(mc.budget_remaining) / 100 : undefined,
            metaCreatedTime: mc.created_time,
            metaUpdatedTime: mc.updated_time,
            budget: { totalBudget: lifetimeBudget || dailyBudget * 30, dailyLimit: dailyBudget, currency: 'TRY', platformSplit: { meta: 100 } },
            schedule: { startDate: mc.start_time || new Date().toISOString(), endDate: mc.stop_time || null },
            platformCampaignIds: { meta: mc.id },
            adSets,
            ...(performance ? { performance } : {}),
            ...(mc.issues_info ? { issuesInfo: mc.issues_info } : {}),
            ...(mc.recommendations?.data ? { recommendations: mc.recommendations.data } : {}),
            lastSyncAt: Date.now(),
            syncStatus: 'success',
            updatedAt: Date.now(),
          });

          if (!existing.empty) {
            await existing.docs[0].ref.update(campaignDoc);
          } else {
            await db.collection('marketing_campaigns').doc().set({
              ...campaignDoc,
              tenantId,
              description: '',
              targeting: {},
              approvalHistory: [],
              timeline: [{
                id: `evt-${Date.now()}`,
                type: 'created',
                title: 'Meta\'dan senkronize edildi',
                description: 'Cron ile otomatik senkronizasyon',
                createdAt: Date.now(),
                createdBy: 'system',
                createdByName: 'Cron Sync',
              }],
              tags: ['meta-sync'],
              createdAt: Date.now(),
            });
          }

          synced++;
        }

        // Update account lastSyncAt
        await accountDoc.ref.update({ lastSyncAt: new Date(), updatedAt: new Date() });

        results.push({ tenantId, accountName, status: 'synced', campaignsSynced: synced });
        console.log(`[cron-sync-meta] ${accountName}: ${synced} campaigns synced`);

      } catch (err: any) {
        results.push({ tenantId, accountName, status: 'error', error: err.message });
        console.error(`[cron-sync-meta] Error for ${accountName}:`, err.message);
      }
    }

    const duration = Date.now() - startTime;
    const totalSynced = results.reduce((sum, r) => sum + (r.campaignsSynced || 0), 0);
    console.log(`[cron-sync-meta] Done in ${duration}ms: ${totalSynced} campaigns across ${results.filter(r => r.status === 'synced').length} accounts`);

    return res.status(200).json({
      success: true,
      summary: {
        totalAccounts: accountsSnap.size,
        successfulAccounts: results.filter(r => r.status === 'synced').length,
        failedAccounts: results.filter(r => r.status === 'error').length,
        totalCampaignsSynced: totalSynced,
      },
      results,
      duration,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('[cron-sync-meta] Fatal error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Cron sync failed',
      duration: Date.now() - startTime,
    });
  }
}

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

function mapStatus(metaStatus: string | undefined): string {
  if (!metaStatus) return 'paused';
  const map: Record<string, string> = {
    ACTIVE: 'active', PAUSED: 'paused', DELETED: 'deleted', ARCHIVED: 'deleted',
    IN_PROCESS: 'paused', WITH_ISSUES: 'active',
  };
  return map[metaStatus] || 'paused';
}
