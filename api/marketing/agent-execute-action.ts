import type { VercelResponse } from '@vercel/node';
import { getAdminDb, getFieldValue } from '../_lib/firebaseAdmin.js';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';

export const config = {
  maxDuration: 120,
};

const META_API_VERSION = 'v21.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// ============================================
// Helper: call Meta Graph API
// ============================================

async function metaPost(path: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${META_API_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json;
}

async function metaGet(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${META_API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json;
}

// ============================================
// Helper: sync campaign status change back to Firestore
// ============================================

async function syncCampaignToFirestore(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  metaCampaignId: string,
  updates: Record<string, any>
) {
  const snap = await db.collection('marketing_campaigns')
    .where('tenantId', '==', tenantId)
    .where('platformCampaignIds.meta', '==', metaCampaignId)
    .limit(1)
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.update({ ...updates, updatedAt: Date.now() });
  }
}

// ============================================
// Helper: get page_id from platform account
// ============================================

function getPageId(platformAccount: Record<string, any>): string | null {
  return platformAccount.metadata?.pageId
    || platformAccount.pageId
    || null;
}

/**
 * POST /api/marketing/agent-execute-action
 *
 * Approves or rejects a pending platform action from the marketing agent.
 * On approve: executes the Meta API call, writes result back to session.
 *
 * Body: { sessionId: string, actionId: string, decision: 'approve' | 'reject' }
 */
export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(res, req.userUid, LIMITS.MARKETING_AGENT)) return;

  try {
    const { sessionId, actionId, decision } = req.body || {};

    if (!sessionId || !actionId || !decision) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, actionId, decision' });
    }
    if (decision !== 'approve' && decision !== 'reject') {
      return res.status(400).json({ error: 'decision must be "approve" or "reject"' });
    }

    const db = getAdminDb();

    // Load session
    const sessionDoc = await db.collection('marketing_agent_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionData = sessionDoc.data()!;
    if (sessionData.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Find the pending action
    const pendingActions: any[] = sessionData.pendingActions || [];
    const actionIndex = pendingActions.findIndex((a: any) => a.id === actionId);
    if (actionIndex === -1) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const action = pendingActions[actionIndex];
    if (action.status !== 'pending_approval') {
      return res.status(400).json({ error: `Action already ${action.status}` });
    }

    // === REJECT ===
    if (decision === 'reject') {
      pendingActions[actionIndex] = { ...action, status: 'rejected', resolvedAt: Date.now() };

      const FieldValue = getFieldValue();
      await db.collection('marketing_agent_sessions').doc(sessionId).update({
        pendingActions,
        messages: FieldValue.arrayUnion({
          role: 'assistant',
          content: `Aksiyon reddedildi: ${action.description || action.type}`,
          timestamp: Date.now(),
        }),
        updatedAt: Date.now(),
      });

      return res.status(200).json({ success: true, status: 'rejected' });
    }

    // === APPROVE ===
    // Mark as executing
    pendingActions[actionIndex] = { ...action, status: 'executing' };
    await db.collection('marketing_agent_sessions').doc(sessionId).update({
      pendingActions,
      updatedAt: Date.now(),
    });

    // Load platform accounts — single-field query to avoid composite index dependency
    const targetPlatform = action.platform || action.payload?.platform || 'meta';

    const allPlatformsSnap = await db.collection('platform_accounts')
      .where('tenantId', '==', req.tenantId)
      .get();

    const matchingDocs = allPlatformsSnap.docs.filter((d) => {
      const data = d.data();
      return data.platform === targetPlatform && data.status === 'connected';
    });

    // Multi-account support: prefer specific account if requested
    const targetAccountId = action.payload?.platformAccountId;
    let platformDoc = targetAccountId
      ? matchingDocs.find((d) => d.id === targetAccountId || d.data().accountId === targetAccountId)
      : undefined;
    if (!platformDoc && matchingDocs.length > 0) platformDoc = matchingDocs[0];

    if (!platformDoc) {
      pendingActions[actionIndex] = { ...action, status: 'failed', result: { error: `${targetPlatform} hesabi bagli degil` }, resolvedAt: Date.now() };
      await db.collection('marketing_agent_sessions').doc(sessionId).update({ pendingActions, updatedAt: Date.now() });
      return res.status(400).json({ success: false, error: `${targetPlatform} hesabi bagli degil` });
    }

    const platformAccount = platformDoc.data();
    const accessToken: string = platformAccount.accessToken || platformAccount.metadata?.accessToken;
    const adAccountId: string = platformAccount.accountId || platformAccount.metadata?.adAccountId;
    const pageId = getPageId(platformAccount);

    if (!accessToken) {
      pendingActions[actionIndex] = { ...action, status: 'failed', result: { error: 'Access token bulunamadi' }, resolvedAt: Date.now() };
      await db.collection('marketing_agent_sessions').doc(sessionId).update({ pendingActions, updatedAt: Date.now() });
      return res.status(400).json({ success: false, error: 'Access token bulunamadi' });
    }

    const accountId = adAccountId?.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

    let result: Record<string, any> = {};
    let resultMessage = '';

    try {
      switch (action.type) {
        // ======================================
        // PUBLISH PLAN
        // ======================================
        case 'publish_plan': {
          const planId = action.payload?.planId;
          if (!planId) throw new Error('planId eksik');

          const planSnap = await db.collection('marketing_plans').doc(planId).get();
          if (!planSnap.exists) throw new Error('Plan bulunamadi');

          const planData = planSnap.data()!.planData;
          const metaResults: Record<string, { campaignId: string; adSetIds: string[] }> = {};
          const errors: Array<{ campaign: string; error: string }> = [];

          for (const campaign of (planData.campaigns || []) as any[]) {
            if (campaign.platform !== 'meta') continue;

            try {
              const campaignJson = await metaPost(`${accountId}/campaigns`, {
                name: campaign.name,
                objective: campaign.metaObjective || 'OUTCOME_AWARENESS',
                status: 'PAUSED',
                special_ad_categories: '[]',
                access_token: accessToken,
              });

              const metaCampaignId: string = campaignJson.id;
              const adSetIds: string[] = [];
              const optimizationGoal = getOptimizationGoal(campaign.metaObjective);

              for (const adSet of (campaign.adSets || []) as any[]) {
                try {
                  const dailyBudgetCents = Math.round((adSet.dailyBudget || planData.budget?.dailyBudget || 500) * 100);

                  const targeting: Record<string, any> = {
                    age_min: planData.audience?.ageMin || 18,
                    age_max: planData.audience?.ageMax || 65,
                    geo_locations: { countries: ['TR'] },
                  };
                  const genders = planData.audience?.genders || ['all'];
                  if (!genders.includes('all')) {
                    const genderMap: Record<string, number> = { male: 1, female: 2 };
                    targeting.genders = genders.map((g: string) => genderMap[g]).filter(Boolean);
                  }

                  const adSetJson = await metaPost(`${accountId}/adsets`, {
                    name: adSet.name,
                    campaign_id: metaCampaignId,
                    daily_budget: String(dailyBudgetCents),
                    billing_event: 'IMPRESSIONS',
                    optimization_goal: optimizationGoal,
                    status: 'PAUSED',
                    targeting: JSON.stringify(targeting),
                    access_token: accessToken,
                  });
                  adSetIds.push(adSetJson.id);
                } catch (adSetErr: any) {
                  console.warn(`[publish-plan] Ad set "${adSet.name}" failed: ${adSetErr?.message}`);
                }
              }

              metaResults[campaign.name] = { campaignId: metaCampaignId, adSetIds };
            } catch (campaignErr: any) {
              errors.push({ campaign: campaign.name, error: campaignErr?.message });
            }
          }

          await db.collection('marketing_plans').doc(planId).update({
            status: Object.keys(metaResults).length > 0 ? 'published' : 'draft',
            metaResults,
            publishErrors: errors.length > 0 ? errors : null,
            updatedAt: Date.now(),
          });

          result = { metaResults, errors };
          resultMessage = errors.length > 0
            ? `Plan yayinlandi ancak ${errors.length} hata olustu: ${errors.map(e => e.error).join(', ')}`
            : `${Object.keys(metaResults).length} kampanya Meta'da olusturuldu (PAUSED).`;
          break;
        }

        // ======================================
        // PAUSE CAMPAIGN + Firestore sync
        // ======================================
        case 'pause_campaign': {
          const campaignId = action.payload?.campaignId;
          if (!campaignId) throw new Error('campaignId eksik');

          await metaPost(campaignId, { status: 'PAUSED', access_token: accessToken });
          await syncCampaignToFirestore(db, req.tenantId, campaignId, { status: 'paused', effectiveStatus: 'PAUSED' });

          result = { success: true, campaignId };
          resultMessage = `Kampanya ${campaignId} duraklatildi.`;
          break;
        }

        // ======================================
        // RESUME CAMPAIGN + Firestore sync
        // ======================================
        case 'resume_campaign': {
          const campaignId = action.payload?.campaignId;
          if (!campaignId) throw new Error('campaignId eksik');

          await metaPost(campaignId, { status: 'ACTIVE', access_token: accessToken });
          await syncCampaignToFirestore(db, req.tenantId, campaignId, { status: 'active', effectiveStatus: 'ACTIVE' });

          result = { success: true, campaignId };
          resultMessage = `Kampanya ${campaignId} yeniden aktif edildi.`;
          break;
        }

        // ======================================
        // DELETE (ARCHIVE) CAMPAIGN + Firestore sync
        // ======================================
        case 'delete_campaign': {
          const campaignId = action.payload?.campaignId;
          if (!campaignId) throw new Error('campaignId eksik');

          // Meta does not truly delete — sets to DELETED (archived)
          await metaPost(campaignId, { status: 'DELETED', access_token: accessToken });
          await syncCampaignToFirestore(db, req.tenantId, campaignId, { status: 'completed', effectiveStatus: 'DELETED' });

          result = { success: true, campaignId };
          resultMessage = `Kampanya ${campaignId} arsivlendi (Meta'da DELETED).`;
          break;
        }

        // ======================================
        // UPDATE AD SET DAILY BUDGET
        // ======================================
        case 'update_meta_budget': {
          const adSetId = action.payload?.adSetId;
          const dailyBudget = action.payload?.dailyBudget;
          if (!adSetId) throw new Error('adSetId eksik');
          if (dailyBudget == null) throw new Error('dailyBudget eksik');

          const budgetCents = Math.round(dailyBudget * 100);
          await metaPost(adSetId, { daily_budget: String(budgetCents), access_token: accessToken });

          result = { success: true, adSetId, newDailyBudget: dailyBudget };
          resultMessage = `Reklam seti ${adSetId} butcesi ${dailyBudget} TL/gun olarak guncellendi.`;
          break;
        }

        // ======================================
        // UPDATE CAMPAIGN SPEND CAP
        // ======================================
        case 'update_campaign_budget': {
          const campaignId = action.payload?.campaignId;
          const spendCap = action.payload?.spendCap;
          if (!campaignId) throw new Error('campaignId eksik');
          if (spendCap == null) throw new Error('spendCap eksik');

          const spendCapCents = Math.round(spendCap * 100);
          await metaPost(campaignId, { spend_cap: String(spendCapCents), access_token: accessToken });
          await syncCampaignToFirestore(db, req.tenantId, campaignId, { spendCap });

          result = { success: true, campaignId, newSpendCap: spendCap };
          resultMessage = `Kampanya ${campaignId} harcama limiti ${spendCap} TL olarak guncellendi.`;
          break;
        }

        // ======================================
        // PAUSE AD SET
        // ======================================
        case 'pause_adset': {
          const adSetId = action.payload?.adSetId;
          if (!adSetId) throw new Error('adSetId eksik');

          await metaPost(adSetId, { status: 'PAUSED', access_token: accessToken });

          result = { success: true, adSetId };
          resultMessage = `Reklam seti ${adSetId} duraklatildi.`;
          break;
        }

        // ======================================
        // RESUME AD SET
        // ======================================
        case 'resume_adset': {
          const adSetId = action.payload?.adSetId;
          if (!adSetId) throw new Error('adSetId eksik');

          await metaPost(adSetId, { status: 'ACTIVE', access_token: accessToken });

          result = { success: true, adSetId };
          resultMessage = `Reklam seti ${adSetId} yeniden aktif edildi.`;
          break;
        }

        // ======================================
        // UPDATE AD SET TARGETING
        // ======================================
        case 'update_adset_targeting': {
          const adSetId = action.payload?.adSetId;
          const targeting = action.payload?.targeting;
          if (!adSetId) throw new Error('adSetId eksik');
          if (!targeting) throw new Error('targeting objesi eksik');

          // Build Meta targeting object
          const metaTargeting: Record<string, any> = {};
          if (targeting.age_min) metaTargeting.age_min = targeting.age_min;
          if (targeting.age_max) metaTargeting.age_max = targeting.age_max;
          if (targeting.geo_locations) metaTargeting.geo_locations = targeting.geo_locations;
          if (targeting.genders) metaTargeting.genders = targeting.genders;
          if (targeting.interests && Array.isArray(targeting.interests)) {
            metaTargeting.flexible_spec = [{ interests: targeting.interests.map((i: any) =>
              typeof i === 'string' ? { name: i } : i
            )}];
          }

          await metaPost(adSetId, {
            targeting: JSON.stringify(metaTargeting),
            access_token: accessToken,
          });

          result = { success: true, adSetId, targeting: metaTargeting };
          resultMessage = `Reklam seti ${adSetId} hedeflemesi guncellendi.`;
          break;
        }

        // ======================================
        // UPLOAD IMAGE → get image_hash
        // ======================================
        case 'upload_image': {
          const imageUrl = action.payload?.imageUrl;
          if (!imageUrl) throw new Error('imageUrl eksik');

          // Download the image
          const imgRes = await fetch(imageUrl);
          if (!imgRes.ok) throw new Error(`Gorsel indirilemedi: ${imgRes.status}`);
          const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
          const base64Image = imgBuffer.toString('base64');

          // Upload to Meta via bytes (base64)
          const uploadJson = await metaPost(`${accountId}/adimages`, {
            bytes: base64Image,
            access_token: accessToken,
          });

          // Meta returns { images: { bytes: { hash: "...", url: "..." } } }
          const imageData = uploadJson.images?.bytes || {};
          const imageHash = imageData.hash;
          if (!imageHash) throw new Error('Meta image hash alinamadi');

          result = { success: true, imageHash, imageUrl: imageData.url };
          resultMessage = `Gorsel yuklendi. Image hash: ${imageHash}. Bu hash'i create_meta_ad aksiyonunda kullanabilirsiniz.`;
          break;
        }

        // ======================================
        // CREATE META AD (with page_id fix)
        // ======================================
        case 'create_meta_ad': {
          const adSetId = action.payload?.adSetId;
          const adName = action.payload?.adName || 'AI-Generated Ad';
          const creative = action.payload?.creative;
          if (!adSetId) throw new Error('adSetId eksik');

          // page_id is required for object_story_spec
          const effectivePageId = creative?.pageId || action.payload?.pageId || pageId;
          if (!effectivePageId) {
            throw new Error('Facebook Sayfa ID (page_id) bulunamadi. Platform hesabinda pageId ayarlanmali veya payload icinde belirtilmeli.');
          }

          // Build object_story_spec
          const objectStorySpec: Record<string, any> = {
            page_id: effectivePageId,
          };

          if (creative?.linkUrl) {
            // Link ad
            objectStorySpec.link_data = {
              message: creative.body || '',
              link: creative.linkUrl,
              name: creative.title || adName,
              call_to_action: { type: creative.ctaType || 'LEARN_MORE', value: { link: creative.linkUrl } },
            };
            if (creative.imageHash) {
              objectStorySpec.link_data.image_hash = creative.imageHash;
            }
            if (creative.description) {
              objectStorySpec.link_data.description = creative.description;
            }
          } else {
            // Photo/text post ad
            objectStorySpec.link_data = {
              message: creative.body || creative.title || '',
            };
            if (creative?.imageHash) {
              objectStorySpec.link_data.image_hash = creative.imageHash;
              objectStorySpec.link_data.link = `https://www.facebook.com/${effectivePageId}`;
            }
          }

          // Create ad creative
          const creativeJson = await metaPost(`${accountId}/adcreatives`, {
            name: `Creative - ${adName}`,
            object_story_spec: JSON.stringify(objectStorySpec),
            access_token: accessToken,
          });

          // Create ad
          const adJson = await metaPost(`${accountId}/ads`, {
            name: adName,
            adset_id: adSetId,
            creative: JSON.stringify({ creative_id: creativeJson.id }),
            status: 'PAUSED',
            access_token: accessToken,
          });

          result = { success: true, adId: adJson.id, creativeId: creativeJson.id };
          resultMessage = `Reklam "${adName}" olusturuldu (PAUSED). Ad ID: ${adJson.id}`;
          break;
        }

        // ======================================
        // FETCH PERFORMANCE (campaign / adset / ad level)
        // ======================================
        case 'fetch_performance': {
          const campaignId = action.payload?.campaignId;
          if (!campaignId) throw new Error('campaignId eksik');

          const datePreset = action.payload?.datePreset || 'last_7d';
          const level = action.payload?.level || 'campaign'; // campaign, adset, ad
          const fields = 'impressions,reach,clicks,ctr,spend,conversions,cost_per_result,cpc,cpm,actions,unique_clicks,unique_ctr,cost_per_unique_click,frequency';

          const params: Record<string, string> = {
            fields,
            date_preset: datePreset,
            access_token: accessToken,
          };

          // For breakdowns: adset or ad level under campaign
          if (level === 'adset' || level === 'ad') {
            params.level = level;
          }

          const insightsJson = await metaGet(`${campaignId}/insights`, params);

          const rows = insightsJson.data || [];
          if (rows.length === 0) {
            result = { success: true, campaignId, datePreset, level, insights: null };
            resultMessage = `Bu donem (${datePreset}) icin performans verisi bulunamadi.`;
          } else if (level === 'campaign') {
            const d = rows[0];
            // Parse action conversions
            const conversions = (d.actions || []).find((a: any) => a.action_type === 'offsite_conversion')?.value || d.conversions || '0';
            result = { success: true, campaignId, datePreset, level, insights: d };
            resultMessage = `Kampanya performansi (${datePreset}): ${d.impressions || 0} gosterim, ${d.reach || 0} erisim, ${d.clicks || 0} tiklama, CTR: ${d.ctr || '0'}%, Harcama: ${d.spend || 0} TL, CPC: ${d.cpc || '0'} TL, Frekans: ${d.frequency || '0'}, Donusum: ${conversions}`;
          } else {
            // Multi-row (adset or ad level)
            const summary = rows.map((d: any) => `- ${d.adset_name || d.ad_name || d.adset_id || d.ad_id}: ${d.impressions || 0} gosterim, ${d.clicks || 0} tik, ${d.spend || 0} TL`).join('\n');
            result = { success: true, campaignId, datePreset, level, insights: rows };
            resultMessage = `${level === 'adset' ? 'Reklam seti' : 'Reklam'} bazinda performans (${datePreset}):\n${summary}`;
          }
          break;
        }

        default:
          throw new Error(`Bilinmeyen aksiyon tipi: ${action.type}`);
      }

      // Mark completed
      pendingActions[actionIndex] = {
        ...action,
        status: 'completed',
        result,
        resolvedAt: Date.now(),
      };
    } catch (execErr: any) {
      console.error(`[agent-execute-action] ${action.type} failed:`, execErr?.message);
      result = { error: execErr?.message };
      resultMessage = `Hata: ${execErr?.message}`;

      pendingActions[actionIndex] = {
        ...action,
        status: 'failed',
        result,
        resolvedAt: Date.now(),
      };
    }

    // Save updated pendingActions + result message
    const FieldValue = getFieldValue();
    await db.collection('marketing_agent_sessions').doc(sessionId).update({
      pendingActions,
      messages: FieldValue.arrayUnion({
        role: 'assistant',
        content: resultMessage,
        timestamp: Date.now(),
      }),
      updatedAt: Date.now(),
    });

    return res.status(200).json({
      success: pendingActions[actionIndex].status === 'completed',
      status: pendingActions[actionIndex].status,
      result,
      message: resultMessage,
    });
  } catch (error: any) {
    console.error('marketing/agent-execute-action error:', error);
    return res.status(500).json({
      error: String(error?.message || 'Action execution failed'),
    });
  }
});

function getOptimizationGoal(metaObjective: string): string {
  const map: Record<string, string> = {
    OUTCOME_AWARENESS: 'REACH',
    OUTCOME_TRAFFIC: 'LINK_CLICKS',
    OUTCOME_ENGAGEMENT: 'POST_ENGAGEMENT',
    OUTCOME_LEADS: 'LEAD_GENERATION',
    OUTCOME_SALES: 'OFFSITE_CONVERSIONS',
    OUTCOME_APP_PROMOTION: 'APP_INSTALLS',
    OUTCOME_VIDEO_VIEWS: 'VIDEO_VIEWS',
  };
  return map[metaObjective] || 'REACH';
}
