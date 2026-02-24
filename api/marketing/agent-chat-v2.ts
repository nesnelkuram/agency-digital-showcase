import type { VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import { getAdminDb, getFieldValue } from '../_lib/firebaseAdmin.js';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';

export const config = {
  maxDuration: 120,
};

// ============================================
// SSE Helpers
// ============================================

function sseWrite(res: VercelResponse, event: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
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

function sseError(res: VercelResponse, message: string) {
  sseWrite(res, { type: 'error', message });
  res.end();
}

// ============================================
// Tool Definitions
// ============================================

const APPROVAL_REQUIRED_TOOLS = new Set([
  'pause_campaign',
  'resume_campaign',
  'update_budget',
  'publish_plan',
  'create_meta_ad',
  'delete_campaign',
]);

const toolDeclarations = [
  {
    name: 'list_connected_accounts',
    description: 'Bagli platform hesaplarini listeler (Meta, Google, TikTok vb.). Konusma basinda mutlaka cagir.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_account_campaigns',
    description: 'Belirtilen hesaba ait kampanyalari getirir. Varsayilan olarak sadece aktif kampanyalari dondurur. Tum kampanyalar icin statusFilter=all kullan.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        platformAccountId: { type: Type.STRING, description: 'Platform hesap ID (Firestore doc ID)' },
        statusFilter: { type: Type.STRING, description: 'Filtre: "active" (varsayilan, sadece aktif), "paused" (duraklatilmis), "all" (tumu), "inactive" (aktif olmayan)' },
      },
      required: ['platformAccountId'],
    },
  },
  {
    name: 'get_campaign_details',
    description: 'Kampanya detayini getirir (reklam setleri, reklamlar dahil).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        campaignId: { type: Type.STRING, description: 'Firestore kampanya doc ID' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'get_campaign_performance',
    description: 'Meta API uzerinden kampanya performans metriklerini getirir.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        campaignId: { type: Type.STRING, description: 'Meta campaign ID' },
        datePreset: { type: Type.STRING, description: 'Tarih araligi: last_7d, last_30d, last_90d' },
        level: { type: Type.STRING, description: 'Detay seviyesi: campaign, adset, ad' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'sync_campaigns',
    description: 'Meta API\'den kampanyalari cekerek Firestore\'a kaydeder.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        platformAccountId: { type: Type.STRING, description: 'Hangi hesap icin sync yapilacak' },
      },
    },
  },
  {
    name: 'create_marketing_plan',
    description: 'Tum bilgiler toplandiktan sonra pazarlama plani olusturur.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        planData: {
          type: Type.OBJECT,
          description: 'Tam pazarlama plan verisi (name, brand, objectives, audience, budget, platforms, timeline, campaigns, kpis)',
          properties: {
            name: { type: Type.STRING },
            brand: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                industry: { type: Type.STRING },
              },
            },
            objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
            audience: {
              type: Type.OBJECT,
              properties: {
                ageMin: { type: Type.NUMBER },
                ageMax: { type: Type.NUMBER },
                genders: { type: Type.ARRAY, items: { type: Type.STRING } },
                interests: { type: Type.ARRAY, items: { type: Type.STRING } },
                locations: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            budget: {
              type: Type.OBJECT,
              properties: {
                total: { type: Type.NUMBER },
                currency: { type: Type.STRING },
                dailyBudget: { type: Type.NUMBER },
              },
            },
            platforms: { type: Type.ARRAY, items: { type: Type.STRING } },
            timeline: {
              type: Type.OBJECT,
              properties: {
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
              },
            },
            campaigns: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {} } },
            kpis: {
              type: Type.OBJECT,
              properties: {
                impressions: { type: Type.NUMBER },
                clicks: { type: Type.NUMBER },
                conversions: { type: Type.NUMBER },
              },
            },
          },
          required: ['name'],
        },
      },
      required: ['planData'],
    },
  },
  {
    name: 'get_marketing_stats',
    description: 'Dashboard istatistiklerini getirir (toplam kampanya, harcama vb.).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        projectId: { type: Type.STRING, description: 'Opsiyonel proje ID filtresi' },
      },
    },
  },
  // --- Approval required tools ---
  {
    name: 'pause_campaign',
    description: 'Kampanyayi duraklatir (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        campaignId: { type: Type.STRING, description: 'Meta campaign ID' },
        reason: { type: Type.STRING, description: 'Duraklatma nedeni' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'resume_campaign',
    description: 'Duraklatiilmis kampanyayi devam ettirir (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        campaignId: { type: Type.STRING, description: 'Meta campaign ID' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'update_budget',
    description: 'Kampanya veya reklam seti butcesini gunceller (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetId: { type: Type.STRING, description: 'Campaign veya AdSet ID' },
        targetType: { type: Type.STRING, description: 'campaign veya adset' },
        newBudget: { type: Type.NUMBER, description: 'Yeni butce (TL)' },
      },
      required: ['targetId', 'newBudget'],
    },
  },
  {
    name: 'publish_plan',
    description: 'Pazarlama planini Meta\'da yayinlar (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        planId: { type: Type.STRING, description: 'Marketing plan Firestore ID' },
      },
      required: ['planId'],
    },
  },
  {
    name: 'create_meta_ad',
    description: 'Meta\'da yeni reklam olusturur (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        adSetId: { type: Type.STRING, description: 'Hedef reklam seti ID' },
        adName: { type: Type.STRING, description: 'Reklam adi' },
        creative: {
          type: Type.OBJECT,
          description: 'Kreatif bilgileri',
          properties: {
            title: { type: Type.STRING },
            body: { type: Type.STRING },
            linkUrl: { type: Type.STRING },
            imageHash: { type: Type.STRING },
          },
        },
      },
      required: ['adSetId', 'adName'],
    },
  },
  {
    name: 'delete_campaign',
    description: 'Kampanyayi arsivler/siler (ONAY GEREKTIRIR).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        campaignId: { type: Type.STRING, description: 'Meta campaign ID' },
        reason: { type: Type.STRING, description: 'Silme nedeni' },
      },
      required: ['campaignId'],
    },
  },
];

// ============================================
// System Prompt
// ============================================

const SYSTEM_PROMPT = `Sen deneyimli bir Dijital Pazarlama Uzmanisin. Meta Ads kampanya yonetimi, strateji ve analiz konusunda yardim ediyorsun.

## Kurallar
- Turkce konus, samimi ve profesyonel ol
- Konusma basladiginda MUTLAKA list_connected_accounts aracini cagir
- Kullanici hesap sectikten sonra get_account_campaigns ile kampanyalari goster
- Kampanyalari gosterirken VARSAYILAN olarak sadece aktif kampanyalari getir (statusFilter kullanma veya "active" kullan)
- Kullanici "tum kampanyalar", "duraklatilmis kampanyalar" vb. isterse ilgili statusFilter kullan
- Plan icin tum bilgiler (marka, kitle, hedef, butce, platform, sure) toplandiktan sonra create_marketing_plan cagir
- Yikici aksiyonlarda (duraklatma, silme, butce degisikligi) aciklama ve etki bilgisi ver
- Performans sorulursa get_campaign_performance kullan
- Guncelleme istenirse sync_campaigns cagir
- Kisa ve oz cevaplar ver, gereksiz uzatma

## Meta Objective Mapping
- awareness -> OUTCOME_AWARENESS
- traffic -> OUTCOME_TRAFFIC
- engagement -> OUTCOME_ENGAGEMENT
- leads -> OUTCOME_LEADS
- sales -> OUTCOME_SALES
- app_installs -> OUTCOME_APP_PROMOTION
- video_views -> OUTCOME_VIDEO_VIEWS`;

// ============================================
// Tool Execution Handlers
// ============================================

type ToolContext = {
  db: FirebaseFirestore.Firestore;
  tenantId: string;
  sessionId: string;
  userId: string;
};

async function executeListConnectedAccounts(ctx: ToolContext) {
  const snap = await ctx.db.collection('platform_accounts')
    .where('tenantId', '==', ctx.tenantId)
    .get();

  const accounts = snap.docs
    .filter(d => d.data().status === 'connected')
    .map(d => {
      const data = d.data();
      return {
        id: d.id,
        platform: data.platform,
        accountName: data.accountName,
        accountId: data.accountId,
        adAccountId: data.metadata?.adAccountId || null,
        pageId: data.metadata?.pageId || null,
        status: data.status,
      };
    });

  return { accounts, component: 'AccountSelector' };
}

async function executeGetAccountCampaigns(ctx: ToolContext, args: Record<string, any>) {
  const platformAccountId = args.platformAccountId;
  // Robust default: Gemini might pass null, undefined, or empty string
  const statusFilter = args.statusFilter && args.statusFilter !== '' ? args.statusFilter : 'active';

  const snap = await ctx.db.collection('marketing_campaigns')
    .where('tenantId', '==', ctx.tenantId)
    .where('platformAccountId', '==', platformAccountId)
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();

  const now = Date.now();

  // Comprehensive effectiveStatus → display status mapping
  const EFFECTIVE_TO_DISPLAY: Record<string, string> = {
    'active': 'active',
    'paused': 'paused',
    'campaign_paused': 'paused',
    'adset_paused': 'paused',
    'in_process': 'draft',
    'with_issues': 'issues',
    'disapproved': 'disapproved',
    'pending_review': 'pending_review',
    'preapproved': 'draft',
    'pending_billing': 'paused',
    'archived': 'archived',
    'deleted': 'deleted',
    'completed': 'completed',
    'draft': 'draft',
    'failed': 'failed',
    'issues': 'issues',
  };

  // Which display statuses are considered "active" for filtering
  const ACTIVE_STATUSES = new Set(['active']);
  const PAUSED_STATUSES = new Set(['paused']);
  const HIDDEN_ALWAYS = new Set(['deleted', 'archived']);

  /**
   * Determine the real display status for a campaign.
   * Priority:
   *  1. If schedule.endDate is in the past → 'completed' (expired)
   *  2. If effectiveStatus exists → use EFFECTIVE_TO_DISPLAY mapping
   *  3. Fallback to status field (administrative status)
   */
  function resolveDisplayStatus(data: Record<string, any>): string {
    // Check if campaign has expired by schedule
    const endDate = data.schedule?.endDate || data.schedule?.stopTime;
    if (endDate) {
      try {
        const endMs = typeof endDate === 'string' ? new Date(endDate).getTime()
          : endDate?.toMillis ? endDate.toMillis()
          : endDate?.seconds ? endDate.seconds * 1000
          : 0;
        if (endMs > 0 && endMs < now) {
          return 'completed';
        }
      } catch { /* ignore parse errors */ }
    }

    // Use effectiveStatus if available (most accurate)
    if (data.effectiveStatus) {
      const eff = data.effectiveStatus.toString().toLowerCase();
      return EFFECTIVE_TO_DISPLAY[eff] || eff;
    }

    // Fallback to status field — but DON'T trust 'active' without effectiveStatus
    // If status is 'active' but we have no effectiveStatus, it's unreliable
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
      // Always hide deleted/archived
      if (HIDDEN_ALWAYS.has(c.status)) return false;

      switch (statusFilter) {
        case 'active':
          return ACTIVE_STATUSES.has(c.status);
        case 'paused':
          return PAUSED_STATUSES.has(c.status);
        case 'inactive':
          return !ACTIVE_STATUSES.has(c.status);
        case 'all':
          return true;
        default:
          return ACTIVE_STATUSES.has(c.status);
      }
    });

  // Status breakdown for AI context
  const statusBreakdown: Record<string, number> = {};
  snap.docs.forEach(d => {
    const ds = resolveDisplayStatus(d.data());
    statusBreakdown[ds] = (statusBreakdown[ds] || 0) + 1;
  });

  return {
    campaigns,
    totalInAccount: snap.docs.length,
    statusBreakdown,
    statusFilter,
    component: 'CampaignGrid',
  };
}

async function executeGetCampaignDetails(ctx: ToolContext, args: Record<string, any>) {
  const { campaignId } = args;
  const docSnap = await ctx.db.collection('marketing_campaigns').doc(campaignId).get();
  if (!docSnap.exists) return { error: 'Kampanya bulunamadi' };

  const data = docSnap.data()!;
  if (data.tenantId !== ctx.tenantId) return { error: 'Erisim engellendi' };

  // Resolve display status with schedule awareness
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
    id: docSnap.id,
    name: data.name,
    status: displayStatus,
    effectiveStatus: data.effectiveStatus,
    configuredStatus: data.configuredStatus,
    objective: data.objective,
    buyingType: data.buyingType,

    // Budget
    budget: data.budget,
    dailyBudget: data.dailyBudget,
    lifetimeBudget: data.lifetimeBudget,
    budgetRemaining: data.budgetRemaining,
    spendCap: data.spendCap,

    // Schedule
    schedule: data.schedule,

    // Performance
    performance: data.performance || null,

    // Ad Sets + Ads (full hierarchy)
    adSets: (data.adSets || []).map((as: any) => ({
      ...as,
      ads: as.ads || [],
    })),

    // Issues & Recommendations
    issuesInfo: data.issuesInfo,
    recommendations: data.recommendations,

    // Meta IDs
    platformCampaignIds: data.platformCampaignIds,
    metaCreatedTime: data.metaCreatedTime,

    lastSyncAt: data.lastSyncAt,
    component: 'CampaignDetail',
  };
}

async function executeGetCampaignPerformance(ctx: ToolContext, args: Record<string, any>) {
  const { campaignId, datePreset = 'last_7d', level = 'campaign' } = args;

  // Find platform account with access token
  const allPlatforms = await ctx.db.collection('platform_accounts')
    .where('tenantId', '==', ctx.tenantId)
    .get();

  const metaDoc = allPlatforms.docs.find(d => {
    const data = d.data();
    return data.platform === 'meta' && data.status === 'connected';
  });

  if (!metaDoc) return { error: 'Bagli Meta hesabi bulunamadi' };

  const accessToken = metaDoc.data().accessToken || metaDoc.data().metadata?.accessToken;
  if (!accessToken) return { error: 'Access token bulunamadi' };

  const fields = 'impressions,reach,clicks,ctr,spend,conversions,cpc,cpm,frequency,unique_clicks,unique_ctr';
  const params: Record<string, string> = {
    fields,
    date_preset: datePreset,
    access_token: accessToken,
  };
  if (level === 'adset' || level === 'ad') params.level = level;

  const url = new URL(`https://graph.facebook.com/v21.0/${campaignId}/insights`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resp = await fetch(url.toString());
  const json = await resp.json() as any;

  if (json.error) return { error: json.error.message };

  const rows = json.data || [];
  if (rows.length === 0) {
    return { campaignId, datePreset, level, insights: null, message: 'Bu donem icin veri bulunamadi' };
  }

  return {
    campaignId,
    datePreset,
    level,
    insights: level === 'campaign' ? rows[0] : rows,
    component: 'PerformanceWidget',
  };
}

async function executeSyncCampaigns(ctx: ToolContext, args: Record<string, any>) {
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

  const META_API = 'https://graph.facebook.com/v21.0';

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

    // 1. Fetch campaigns with full fields
    const campaignFields = 'id,name,objective,status,effective_status,configured_status,buying_type,spend_cap,bid_strategy,special_ad_categories,budget_remaining,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time,issues_info,recommendations,pacing_type,promoted_object';
    let nextUrl: string | null = `${META_API}/${accountIdStr}/campaigns?access_token=${accessToken}&fields=${campaignFields}&limit=100`;
    const allMetaCampaigns: any[] = [];

    while (nextUrl) {
      const resp = await fetch(nextUrl);
      const data = await resp.json() as any;
      if (data.error) break;
      allMetaCampaigns.push(...(data.data || []));
      nextUrl = data.paging?.next || null;
    }

    if (allMetaCampaigns.length === 0) continue;

    // 2. Prepare 30-day time range for insights
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

      // 3. Fetch 30-day insights for this campaign
      let performance: Record<string, any> | null = null;
      try {
        const insightsUrl = `${META_API}/${mc.id}/insights?access_token=${accessToken}&fields=impressions,reach,clicks,ctr,spend,actions,cost_per_action_type,cpc,cpm,frequency,unique_clicks,unique_ctr,cost_per_unique_click,inline_link_clicks,purchase_roas,video_thruplay_watched_actions&time_range=${encodeURIComponent(timeRange)}`;
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

      // 4. Fetch ad sets for this campaign
      let adSets: any[] = [];
      try {
        const adSetFields = 'id,name,status,effective_status,daily_budget,lifetime_budget,bid_strategy,targeting,start_time,end_time,optimization_goal,billing_event,pacing_type,daily_min_spend_target,daily_spend_cap,learning_stage_info,destination_type,is_dynamic_creative';
        let adSetsNextUrl: string | null = `${META_API}/${mc.id}/adsets?access_token=${accessToken}&fields=${adSetFields}&limit=100`;
        const rawAdSets: any[] = [];

        while (adSetsNextUrl) {
          const asResp = await fetch(adSetsNextUrl);
          const asData = await asResp.json() as any;
          if (asData.error) break;
          rawAdSets.push(...(asData.data || []));
          adSetsNextUrl = asData.paging?.next || null;
        }

        // 5. For each ad set, fetch its ads
        adSets = await Promise.all(
          rawAdSets.map(async (as: any) => {
            let ads: any[] = [];
            try {
              const adFields = 'id,name,status,effective_status,preview_shareable_link,recommendations,creative{id,name,title,body,image_url,image_hash,video_id,thumbnail_url,object_story_spec},ad_review_feedback,issues_info';
              let adsNextUrl: string | null = `${META_API}/${as.id}/ads?access_token=${accessToken}&fields=${adFields}&limit=100`;

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

      // 6. Upsert to Firestore
      const existing = await ctx.db.collection('marketing_campaigns')
        .where('tenantId', '==', ctx.tenantId)
        .where('platformCampaignIds.meta', '==', mc.id)
        .limit(1).get();

      const campaignDoc: Record<string, any> = stripUndefined({
        platformAccountId: metaDoc.id,
        name: mc.name,
        objective,
        platforms: ['meta'],
        status,
        effectiveStatus: effectiveStatusMap[mc.effective_status] || mc.effective_status?.toLowerCase(),
        configuredStatus: mc.configured_status?.toLowerCase(),
        buyingType: mc.buying_type,
        spendCap: mc.spend_cap ? parseInt(mc.spend_cap) / 100 : undefined,
        dailyBudget,
        lifetimeBudget,
        budgetRemaining: mc.budget_remaining ? parseInt(mc.budget_remaining) / 100 : undefined,
        specialAdCategories: mc.special_ad_categories,
        pacingType: mc.pacing_type,
        promotedObject: mc.promoted_object,
        metaCreatedTime: mc.created_time,
        metaUpdatedTime: mc.updated_time,
        budget: { totalBudget: totalBudget, dailyLimit: dailyBudget, currency: 'TRY', platformSplit: { meta: 100 } },
        schedule: {
          startDate: mc.start_time || new Date().toISOString(),
          endDate: mc.stop_time || null,
        },
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
        await ctx.db.collection('marketing_campaigns').doc().set({
          ...campaignDoc,
          tenantId: ctx.tenantId,
          description: '',
          targeting: {},
          approvalHistory: [],
          timeline: [{
            id: `evt-${Date.now()}`,
            type: 'created',
            title: 'Meta\'dan senkronize edildi',
            description: 'Kampanya Meta Ads hesabindan otomatik olarak iceri aktarildi',
            createdAt: Date.now(),
            createdBy: 'system',
            createdByName: 'Meta Sync',
          }],
          tags: ['meta-sync'],
          createdAt: Date.now(),
        });
      }

      totalSynced++;
      syncedCampaigns.push({
        name: mc.name,
        status,
        effectiveStatus: (effectiveStatusMap[mc.effective_status] || mc.effective_status?.toLowerCase()) || status,
        metaId: mc.id,
      });
    }
  }

  // Build status breakdown for AI context
  const breakdown: Record<string, number> = {};
  for (const c of syncedCampaigns) {
    const eff = c.effectiveStatus || c.status;
    breakdown[eff] = (breakdown[eff] || 0) + 1;
  }

  return {
    synced: totalSynced,
    campaigns: syncedCampaigns,
    statusBreakdown: breakdown,
    message: totalSynced > 0
      ? `${totalSynced} kampanya senkronize edildi (${Object.entries(breakdown).map(([k, v]) => `${v} ${k}`).join(', ')})`
      : 'Kampanya bulunamadi',
  };
}

// --- Sync helper functions ---

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

async function executeCreateMarketingPlan(ctx: ToolContext, args: Record<string, any>) {
  const { planData } = args;

  const planRef = ctx.db.collection('marketing_plans').doc();
  const doc = {
    id: planRef.id,
    tenantId: ctx.tenantId,
    sessionId: ctx.sessionId,
    status: 'draft',
    planData,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await planRef.set(doc);

  return {
    planId: planRef.id,
    planData,
    component: 'MarketingPlanCard',
  };
}

async function executeGetMarketingStats(ctx: ToolContext, args: Record<string, any>) {
  const { projectId } = args;

  let query = ctx.db.collection('marketing_campaigns')
    .where('tenantId', '==', ctx.tenantId) as FirebaseFirestore.Query;

  if (projectId) {
    query = query.where('projectId', '==', projectId);
  }

  const snap = await query.get();
  const campaigns = snap.docs.map(d => d.data());

  const active = campaigns.filter(c => c.status === 'active').length;
  const paused = campaigns.filter(c => c.status === 'paused').length;
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.performance?.totalSpend || 0), 0);

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: active,
    pausedCampaigns: paused,
    totalSpend,
  };
}

// Tool handler map
const toolHandlers: Record<string, (ctx: ToolContext, args: Record<string, any>) => Promise<any>> = {
  list_connected_accounts: (ctx) => executeListConnectedAccounts(ctx),
  get_account_campaigns: executeGetAccountCampaigns,
  get_campaign_details: executeGetCampaignDetails,
  get_campaign_performance: executeGetCampaignPerformance,
  sync_campaigns: executeSyncCampaigns,
  create_marketing_plan: executeCreateMarketingPlan,
  get_marketing_stats: executeGetMarketingStats,
};

// ============================================
// Approval execution (reuses agent-execute-action logic)
// ============================================

const META_API_BASE = 'https://graph.facebook.com/v21.0';

async function metaPost(path: string, params: Record<string, string>): Promise<any> {
  const resp = await fetch(`${META_API_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const json = await resp.json();
  if ((json as any).error) throw new Error((json as any).error.message || JSON.stringify((json as any).error));
  return json;
}

async function executeApprovedAction(
  ctx: ToolContext,
  actionType: string,
  payload: Record<string, any>
): Promise<{ result: Record<string, any>; message: string }> {
  // Get platform account for Meta API access
  const allPlatforms = await ctx.db.collection('platform_accounts')
    .where('tenantId', '==', ctx.tenantId)
    .get();

  const metaDoc = allPlatforms.docs.find(d => {
    const data = d.data();
    return data.platform === 'meta' && data.status === 'connected';
  });

  if (!metaDoc) throw new Error('Bagli Meta hesabi bulunamadi');

  const platformData = metaDoc.data();
  const accessToken = platformData.accessToken || platformData.metadata?.accessToken;
  if (!accessToken) throw new Error('Access token bulunamadi');

  const adAccountId = platformData.accountId || platformData.metadata?.adAccountId;
  const accountId = adAccountId?.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

  // Helper: resolve a Firestore campaign doc ID to its Meta campaign ID
  async function resolveMetaCampaignId(idOrFirestoreId: string): Promise<string> {
    // If it looks like a numeric Meta ID, use directly
    if (/^\d+$/.test(idOrFirestoreId)) return idOrFirestoreId;
    // Otherwise, look up the Firestore doc
    const docSnap = await ctx.db.collection('marketing_campaigns').doc(idOrFirestoreId).get();
    if (!docSnap.exists) throw new Error(`Kampanya bulunamadi: ${idOrFirestoreId}`);
    const data = docSnap.data()!;
    const metaId = data.platformCampaignIds?.meta;
    if (!metaId) throw new Error(`Bu kampanyanin Meta ID'si bulunamadi`);
    return metaId;
  }

  // Helper: resolve a Firestore campaign doc ID + adset index to Meta adset ID
  async function resolveMetaAdSetId(idOrFirestoreId: string): Promise<string> {
    if (/^\d+$/.test(idOrFirestoreId)) return idOrFirestoreId;
    // Could be a campaign doc ID — look for the first adset's metaAdSetId
    const docSnap = await ctx.db.collection('marketing_campaigns').doc(idOrFirestoreId).get();
    if (docSnap.exists) {
      const adSets = docSnap.data()?.adSets || [];
      if (adSets.length > 0 && adSets[0].metaAdSetId) return adSets[0].metaAdSetId;
    }
    throw new Error(`AdSet Meta ID bulunamadi: ${idOrFirestoreId}`);
  }

  switch (actionType) {
    case 'pause_campaign': {
      const metaCampaignId = await resolveMetaCampaignId(payload.campaignId);
      await metaPost(metaCampaignId, { status: 'PAUSED', access_token: accessToken });
      return { result: { success: true }, message: `Kampanya duraklatildi.` };
    }
    case 'resume_campaign': {
      const metaCampaignId = await resolveMetaCampaignId(payload.campaignId);
      await metaPost(metaCampaignId, { status: 'ACTIVE', access_token: accessToken });
      return { result: { success: true }, message: `Kampanya yeniden aktif edildi.` };
    }
    case 'delete_campaign': {
      const metaCampaignId = await resolveMetaCampaignId(payload.campaignId);
      await metaPost(metaCampaignId, { status: 'DELETED', access_token: accessToken });
      return { result: { success: true }, message: `Kampanya arsivlendi.` };
    }
    case 'update_budget': {
      const budgetCents = Math.round((payload.newBudget || 0) * 100);
      if (payload.targetType === 'adset') {
        const metaAdSetId = await resolveMetaAdSetId(payload.targetId);
        await metaPost(metaAdSetId, { daily_budget: String(budgetCents), access_token: accessToken });
        return { result: { success: true }, message: `Reklam seti butcesi ${payload.newBudget} TL olarak guncellendi.` };
      } else {
        // Meta doesn't support setting daily_budget on campaigns directly.
        // Instead, update all ad sets under this campaign.
        const targetId = payload.targetId;
        const isNumeric = /^\d+$/.test(targetId);
        let adSetMetaIds: string[] = [];

        if (isNumeric) {
          // Numeric Meta campaign ID — fetch ad sets from Meta API
          const resp = await fetch(`${META_API_BASE}/${targetId}/adsets?access_token=${accessToken}&fields=id&limit=100`);
          const data = await resp.json() as any;
          adSetMetaIds = (data.data || []).map((as: any) => as.id);
        } else {
          // Firestore doc ID — get ad sets from stored data
          const docSnap = await ctx.db.collection('marketing_campaigns').doc(targetId).get();
          if (!docSnap.exists) throw new Error(`Kampanya bulunamadi: ${targetId}`);
          const adSets = docSnap.data()?.adSets || [];
          adSetMetaIds = adSets.map((as: any) => as.metaAdSetId).filter(Boolean);
        }

        if (adSetMetaIds.length === 0) {
          throw new Error('Bu kampanyada guncellenecek reklam seti bulunamadi');
        }

        // Update each ad set's daily budget
        for (const asId of adSetMetaIds) {
          await metaPost(asId, { daily_budget: String(budgetCents), access_token: accessToken });
        }
        return {
          result: { success: true, updatedAdSets: adSetMetaIds.length },
          message: `Kampanyadaki ${adSetMetaIds.length} reklam setinin butcesi ${payload.newBudget} TL olarak guncellendi.`,
        };
      }
    }
    case 'publish_plan': {
      const planSnap = await ctx.db.collection('marketing_plans').doc(payload.planId).get();
      if (!planSnap.exists) throw new Error('Plan bulunamadi');
      const planData = planSnap.data()!.planData;
      let created = 0;

      for (const campaign of (planData.campaigns || []) as any[]) {
        if (campaign.platform !== 'meta') continue;
        const campaignJson = await metaPost(`${accountId}/campaigns`, {
          name: campaign.name,
          objective: campaign.metaObjective || 'OUTCOME_AWARENESS',
          status: 'PAUSED',
          special_ad_categories: '[]',
          access_token: accessToken,
        });
        created++;

        for (const adSet of (campaign.adSets || []) as any[]) {
          const dailyBudgetCents = Math.round((adSet.dailyBudget || 500) * 100);
          await metaPost(`${accountId}/adsets`, {
            name: adSet.name,
            campaign_id: campaignJson.id,
            daily_budget: String(dailyBudgetCents),
            billing_event: 'IMPRESSIONS',
            optimization_goal: 'REACH',
            status: 'PAUSED',
            targeting: JSON.stringify({ age_min: 18, age_max: 65, geo_locations: { countries: ['TR'] } }),
            access_token: accessToken,
          });
        }
      }

      await ctx.db.collection('marketing_plans').doc(payload.planId).update({ status: 'published', updatedAt: Date.now() });
      return { result: { success: true, created }, message: `${created} kampanya Meta'da olusturuldu (PAUSED).` };
    }
    case 'create_meta_ad': {
      const pageId = platformData.metadata?.pageId;
      if (!pageId) throw new Error('Facebook Sayfa ID bulunamadi');

      const objectStorySpec: Record<string, any> = { page_id: pageId };
      if (payload.creative?.linkUrl) {
        objectStorySpec.link_data = {
          message: payload.creative.body || '',
          link: payload.creative.linkUrl,
          name: payload.creative.title || payload.adName,
          call_to_action: { type: 'LEARN_MORE', value: { link: payload.creative.linkUrl } },
        };
        if (payload.creative.imageHash) objectStorySpec.link_data.image_hash = payload.creative.imageHash;
      } else {
        objectStorySpec.link_data = { message: payload.creative?.body || payload.adName || '' };
      }

      const creativeJson = await metaPost(`${accountId}/adcreatives`, {
        name: `Creative - ${payload.adName}`,
        object_story_spec: JSON.stringify(objectStorySpec),
        access_token: accessToken,
      });

      const adJson = await metaPost(`${accountId}/ads`, {
        name: payload.adName,
        adset_id: payload.adSetId,
        creative: JSON.stringify({ creative_id: creativeJson.id }),
        status: 'PAUSED',
        access_token: accessToken,
      });

      return { result: { success: true, adId: adJson.id }, message: `Reklam "${payload.adName}" olusturuldu (PAUSED).` };
    }
    default:
      throw new Error(`Bilinmeyen aksiyon: ${actionType}`);
  }
}

// ============================================
// Main Handler
// ============================================

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(res, req.userUid, LIMITS.MARKETING_AGENT)) return;

  const { sessionId, message, approval, skipTitle } = req.body || {};

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const db = getAdminDb();

  // Load session
  const sessionDoc = await db.collection('marketing_agent_sessions').doc(sessionId).get();
  if (!sessionDoc.exists) {
    return sseError(res, 'Session not found');
  }

  const sessionData = sessionDoc.data()!;
  if (sessionData.tenantId !== req.tenantId) {
    return sseError(res, 'Access denied');
  }

  const ctx: ToolContext = {
    db,
    tenantId: req.tenantId,
    sessionId,
    userId: req.userUid,
  };

  // ========================================
  // Approval flow
  // ========================================
  if (approval) {
    const { actionId, decision } = approval;
    const pendingActions: any[] = sessionData.pendingActions || [];
    const actionIndex = pendingActions.findIndex((a: any) => a.id === actionId);

    if (actionIndex === -1) {
      return sseError(res, 'Action not found');
    }

    const action = pendingActions[actionIndex];

    if (decision === 'reject') {
      pendingActions[actionIndex] = { ...action, status: 'rejected', resolvedAt: Date.now() };
      await db.collection('marketing_agent_sessions').doc(sessionId).update({
        pendingActions,
        updatedAt: Date.now(),
      });
      sseWrite(res, { type: 'tool_result', id: actionId, name: action.toolName, data: { rejected: true } });
      sseWrite(res, { type: 'text_delta', content: 'Islem reddedildi.' });
      sseWrite(res, { type: 'done', messageId: `msg_${Date.now()}` });
      return res.end();
    }

    // Approve — execute
    pendingActions[actionIndex] = { ...action, status: 'executing' };
    await db.collection('marketing_agent_sessions').doc(sessionId).update({ pendingActions, updatedAt: Date.now() });

    try {
      const { result, message: resultMsg } = await executeApprovedAction(ctx, action.type, action.payload);
      pendingActions[actionIndex] = { ...action, status: 'completed', result, resolvedAt: Date.now() };

      await db.collection('marketing_agent_sessions').doc(sessionId).update({
        pendingActions,
        updatedAt: Date.now(),
      });

      sseWrite(res, { type: 'tool_result', id: actionId, name: action.toolName, data: result });
      sseWrite(res, { type: 'text_delta', content: resultMsg });
      sseWrite(res, { type: 'done', messageId: `msg_${Date.now()}` });
    } catch (err: any) {
      pendingActions[actionIndex] = { ...action, status: 'failed', result: { error: err.message }, resolvedAt: Date.now() };
      await db.collection('marketing_agent_sessions').doc(sessionId).update({ pendingActions, updatedAt: Date.now() });
      sseWrite(res, { type: 'error', message: err.message });
    }

    return res.end();
  }

  // ========================================
  // Normal message flow
  // ========================================
  if (!message) {
    return sseError(res, 'Missing message');
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return sseError(res, 'GEMINI_API_KEY not configured');
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build content history from session
    const contentHistory: any[] = sessionData.contentHistory || [];

    // Build system instruction with strategy context
    let systemInstruction = SYSTEM_PROMPT;
    if (sessionData.strategyContext) {
      systemInstruction += `\n\n## Strateji Baglami\n${sessionData.strategyContext}`;
    }

    // Add user message to history
    contentHistory.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // UI messages for Firestore
    const uiMessages: any[] = sessionData.messages || [];
    uiMessages.push({
      id: `msg_${Date.now()}_user`,
      role: 'user',
      parts: [{ type: 'text', content: message }],
      timestamp: Date.now(),
    });

    const assistantParts: any[] = [];
    const assistantMsgId = `msg_${Date.now()}_assistant`;
    const newPendingActions: any[] = [];

    // Tool execution loop
    let loopCount = 0;
    const MAX_LOOPS = 5;
    let currentHistory = [...contentHistory];

    while (loopCount < MAX_LOOPS) {
      loopCount++;

      const response = await ai.models.generateContentStream({
        model: 'gemini-2.0-flash',
        contents: currentHistory,
        config: {
          systemInstruction,
          temperature: 0.7,
          maxOutputTokens: 4096,
          tools: [{ functionDeclarations: toolDeclarations }],
        },
      });

      let textAccum = '';
      const functionCalls: Array<{ name: string; args: Record<string, any>; id: string }> = [];

      for await (const chunk of response) {
        if (!chunk.candidates?.[0]?.content?.parts) continue;

        for (const part of chunk.candidates[0].content.parts) {
          if (part.text) {
            sseWrite(res, { type: 'text_delta', content: part.text });
            textAccum += part.text;
          }
          if (part.functionCall) {
            const callId = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            functionCalls.push({
              name: part.functionCall.name!,
              args: (part.functionCall.args || {}) as Record<string, any>,
              id: callId,
            });
            sseWrite(res, {
              type: 'tool_call',
              id: callId,
              name: part.functionCall.name,
              args: part.functionCall.args,
            });
          }
        }
      }

      // Save text to UI parts
      if (textAccum) {
        assistantParts.push({ type: 'text', content: textAccum });
      }

      // Add model response to history
      const modelParts: any[] = [];
      if (textAccum) modelParts.push({ text: textAccum });
      for (const fc of functionCalls) {
        modelParts.push({ functionCall: { name: fc.name, args: fc.args } });
      }
      if (modelParts.length > 0) {
        currentHistory.push({ role: 'model', parts: modelParts });
      }

      // No function calls — we're done
      if (functionCalls.length === 0) break;

      // Process function calls
      const functionResponseParts: any[] = [];

      for (const fc of functionCalls) {
        // Check if approval required
        if (APPROVAL_REQUIRED_TOOLS.has(fc.name)) {
          const pendingAction = {
            id: `pa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: fc.name,
            toolName: fc.name,
            status: 'pending_approval',
            platform: 'meta',
            payload: fc.args,
            description: fc.args.reason || `${fc.name} islemi`,
            impact: `${fc.name} islemi gerceklestirilecek`,
            createdAt: Date.now(),
          };

          newPendingActions.push(pendingAction);

          sseWrite(res, {
            type: 'approval_required',
            actionId: pendingAction.id,
            action: pendingAction,
          });

          assistantParts.push({
            type: 'approval_required',
            actionId: pendingAction.id,
            action: pendingAction,
          });

          functionResponseParts.push({
            functionResponse: {
              name: fc.name,
              response: { status: 'pending_approval', message: 'Kullanici onay bekleniyor. Kullaniciya onay bekledigini bildir.' },
            },
          });
        } else {
          // Auto-execute
          const handler = toolHandlers[fc.name];
          if (!handler) {
            functionResponseParts.push({
              functionResponse: {
                name: fc.name,
                response: { error: `Unknown tool: ${fc.name}` },
              },
            });
            continue;
          }

          try {
            const toolResult = await handler(ctx, fc.args);

            sseWrite(res, {
              type: 'tool_result',
              id: fc.id,
              name: fc.name,
              data: toolResult,
              component: toolResult.component,
            });

            assistantParts.push({
              type: 'tool_result',
              id: fc.id,
              name: fc.name,
              data: toolResult,
              component: toolResult.component,
            });

            functionResponseParts.push({
              functionResponse: {
                name: fc.name,
                response: toolResult,
              },
            });
          } catch (err: any) {
            const errorResult = { error: err.message };
            functionResponseParts.push({
              functionResponse: {
                name: fc.name,
                response: errorResult,
              },
            });
          }
        }
      }

      // Add tool responses to history
      if (functionResponseParts.length > 0) {
        currentHistory.push({ role: 'user', parts: functionResponseParts });
      }
    }

    // Save to Firestore
    uiMessages.push({
      id: assistantMsgId,
      role: 'assistant',
      parts: assistantParts,
      timestamp: Date.now(),
    });

    const FieldValue = getFieldValue();
    const updateData: Record<string, any> = {
      contentHistory: stripUndefined(currentHistory),
      messages: stripUndefined(uiMessages),
      version: 'v2',
      updatedAt: Date.now(),
    };

    // Auto-set title from first user message (skip auto-greeting)
    if (!skipTitle && message && !sessionData.title) {
      updateData.title = String(message).slice(0, 60);
    }

    if (newPendingActions.length > 0) {
      updateData.pendingActions = FieldValue.arrayUnion(...newPendingActions);
    }

    await db.collection('marketing_agent_sessions').doc(sessionId).update(updateData);

    sseWrite(res, { type: 'done', messageId: assistantMsgId });
    res.end();
  } catch (error: any) {
    console.error('agent-chat-v2 error:', error);
    sseError(res, error.message || 'Agent chat failed');
  }
});
