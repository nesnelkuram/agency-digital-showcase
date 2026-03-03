/**
 * Approval-required tools and execution logic for Marketing AI Agent
 */

import { metaPost, metaGet, getMetaCredentials, resolveMetaCampaignId, resolveMetaAdSetId, META_API_BASE } from './metaApi.js';
import type { ToolContext } from './toolHandlers.js';
import { handleGenerateReport } from './handlers/analyticsHandlers.js';
import { handleCreateAutomationRule, handleUpdateAutomationRule, handleDeleteAutomationRule } from './handlers/automationHandlers.js';
import { handleAddCompetitor, handleAnalyzeCompetitor } from './handlers/competitorHandlers.js';

export const APPROVAL_REQUIRED_TOOLS = new Set([
  // Mevcut
  'pause_campaign',
  'resume_campaign',
  'update_budget',
  'publish_plan',
  'create_meta_ad',
  'delete_campaign',
  // Faz 2B — Write tools
  'create_campaign_v2',
  'create_adset_v2',
  'create_ad_v2',
  'update_campaign_v2',
  'update_adset_v2',
  'update_ad_v2',
  'create_budget_schedule',
  // Faz 3 — A/B Testing
  'create_ab_test',
  'duplicate_adset',
  // Faz 4 — Reporting
  'generate_report',
  // Faz 5 — Automation Rules
  'create_automation_rule',
  'update_automation_rule',
  'delete_automation_rule',
  // Faz 6 — Competitor Intelligence
  'add_competitor',
  'analyze_competitor',
]);

export async function executeApprovedAction(
  ctx: ToolContext,
  actionType: string,
  payload: Record<string, any>
): Promise<{ result: Record<string, any>; message: string }> {
  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);
  const { accessToken, adAccountId: accountId, pageId } = creds;

  switch (actionType) {
    case 'pause_campaign': {
      const metaCampaignId = await resolveMetaCampaignId(ctx.db, payload.campaignId);
      await metaPost(metaCampaignId, { status: 'PAUSED', access_token: accessToken });
      return { result: { success: true }, message: `Kampanya duraklatildi.` };
    }
    case 'resume_campaign': {
      const metaCampaignId = await resolveMetaCampaignId(ctx.db, payload.campaignId);
      await metaPost(metaCampaignId, { status: 'ACTIVE', access_token: accessToken });
      return { result: { success: true }, message: `Kampanya yeniden aktif edildi.` };
    }
    case 'delete_campaign': {
      const metaCampaignId = await resolveMetaCampaignId(ctx.db, payload.campaignId);
      await metaPost(metaCampaignId, { status: 'DELETED', access_token: accessToken });
      return { result: { success: true }, message: `Kampanya arsivlendi.` };
    }
    case 'update_budget': {
      const budgetCents = Math.round((payload.newBudget || 0) * 100);
      if (payload.targetType === 'adset') {
        const metaAdSetId = await resolveMetaAdSetId(ctx.db, payload.targetId);
        await metaPost(metaAdSetId, { daily_budget: String(budgetCents), access_token: accessToken });
        return { result: { success: true }, message: `Reklam seti butcesi ${payload.newBudget} TL olarak guncellendi.` };
      } else {
        const targetId = payload.targetId;
        const isNumeric = /^\d+$/.test(targetId);
        let adSetMetaIds: string[] = [];

        if (isNumeric) {
          const resp = await fetch(`${META_API_BASE}/${targetId}/adsets?access_token=${accessToken}&fields=id&limit=100`);
          const data = await resp.json() as any;
          adSetMetaIds = (data.data || []).map((as: any) => as.id);
        } else {
          const docSnap = await ctx.db.collection('marketing_campaigns').doc(targetId).get();
          if (!docSnap.exists) throw new Error(`Kampanya bulunamadi: ${targetId}`);
          const adSets = docSnap.data()?.adSets || [];
          adSetMetaIds = adSets.map((as: any) => as.metaAdSetId).filter(Boolean);
        }

        if (adSetMetaIds.length === 0) {
          throw new Error('Bu kampanyada guncellenecek reklam seti bulunamadi');
        }

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
        const plat = (campaign.platform || '').toLowerCase();
        if (plat !== 'meta' && plat !== 'facebook' && plat !== 'instagram') continue;
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

    // ===== Faz 2B — Write Tools =====

    case 'create_campaign_v2': {
      const params: Record<string, string> = {
        name: payload.name,
        objective: payload.objective || 'OUTCOME_AWARENESS',
        status: 'PAUSED',
        special_ad_categories: payload.specialAdCategories || '[]',
        access_token: accessToken,
      };
      if (payload.buyingType) params.buying_type = payload.buyingType;
      if (payload.dailyBudget) params.daily_budget = String(Math.round(payload.dailyBudget * 100));
      if (payload.bidStrategy) params.bid_strategy = payload.bidStrategy;

      const json = await metaPost(`${accountId}/campaigns`, params);
      return { result: { success: true, campaignId: json.id }, message: `Kampanya "${payload.name}" olusturuldu (PAUSED).` };
    }

    case 'create_adset_v2': {
      const params: Record<string, string> = {
        name: payload.name,
        campaign_id: payload.campaignId,
        daily_budget: String(Math.round((payload.dailyBudget || 0) * 100)),
        billing_event: payload.billingEvent || 'IMPRESSIONS',
        optimization_goal: payload.optimizationGoal || 'REACH',
        status: 'PAUSED',
        targeting: typeof payload.targeting === 'string' ? payload.targeting : JSON.stringify(payload.targeting || { age_min: 18, age_max: 65, geo_locations: { countries: ['TR'] } }),
        access_token: accessToken,
      };
      if (payload.bidStrategy) params.bid_strategy = payload.bidStrategy;
      if (payload.bidAmount) params.bid_amount = String(Math.round(payload.bidAmount * 100));
      if (payload.startTime) params.start_time = payload.startTime;
      if (payload.endTime) params.end_time = payload.endTime;

      const json = await metaPost(`${accountId}/adsets`, params);
      return { result: { success: true, adsetId: json.id }, message: `Reklam seti "${payload.name}" olusturuldu (PAUSED).` };
    }

    case 'create_ad_v2': {
      const params: Record<string, string> = {
        name: payload.name,
        adset_id: payload.adsetId,
        creative: JSON.stringify({ creative_id: payload.creativeId }),
        status: 'PAUSED',
        access_token: accessToken,
      };

      const json = await metaPost(`${accountId}/ads`, params);
      return { result: { success: true, adId: json.id }, message: `Reklam "${payload.name}" olusturuldu (PAUSED).` };
    }

    case 'update_campaign_v2': {
      const metaCampaignId = await resolveMetaCampaignId(ctx.db, payload.campaignId);
      const params: Record<string, string> = { access_token: accessToken };
      if (payload.name) params.name = payload.name;
      if (payload.status) params.status = payload.status;
      if (payload.dailyBudget) params.daily_budget = String(Math.round(payload.dailyBudget * 100));
      if (payload.bidStrategy) params.bid_strategy = payload.bidStrategy;

      await metaPost(metaCampaignId, params);
      return { result: { success: true }, message: `Kampanya guncellendi.` };
    }

    case 'update_adset_v2': {
      const metaAdSetId = await resolveMetaAdSetId(ctx.db, payload.adsetId);
      const params: Record<string, string> = { access_token: accessToken };
      if (payload.name) params.name = payload.name;
      if (payload.status) params.status = payload.status;
      if (payload.dailyBudget) params.daily_budget = String(Math.round(payload.dailyBudget * 100));
      if (payload.targeting) params.targeting = typeof payload.targeting === 'string' ? payload.targeting : JSON.stringify(payload.targeting);
      if (payload.optimizationGoal) params.optimization_goal = payload.optimizationGoal;
      if (payload.bidStrategy) params.bid_strategy = payload.bidStrategy;
      if (payload.bidAmount) params.bid_amount = String(Math.round(payload.bidAmount * 100));
      if (payload.startTime) params.start_time = payload.startTime;
      if (payload.endTime) params.end_time = payload.endTime;

      await metaPost(metaAdSetId, params);
      return { result: { success: true }, message: `Reklam seti guncellendi.` };
    }

    case 'update_ad_v2': {
      const params: Record<string, string> = { access_token: accessToken };
      if (payload.name) params.name = payload.name;
      if (payload.status) params.status = payload.status;
      if (payload.creativeId) params.creative = JSON.stringify({ creative_id: payload.creativeId });

      await metaPost(payload.adId, params);
      return { result: { success: true }, message: `Reklam guncellendi.` };
    }

    case 'create_budget_schedule': {
      const targetId = payload.targetId;
      const params: Record<string, string> = {
        budget_value: String(Math.round((payload.budgetValue || 0) * 100)),
        budget_value_type: 'ABSOLUTE',
        time_start: payload.timeStart,
        time_end: payload.timeEnd,
        access_token: accessToken,
      };

      await metaPost(`${targetId}/budget_schedules`, params);
      return { result: { success: true }, message: `Butce plani olusturuldu (${payload.timeStart} — ${payload.timeEnd}).` };
    }

    // ===== Faz 3 — A/B Testing =====

    case 'create_ab_test': {
      const testType = payload.testType || 'dynamic_creative';

      if (testType === 'dynamic_creative') {
        // Enable dynamic creative on the adset
        const adsetId = payload.adsetId;
        if (!adsetId) throw new Error('Dynamic creative test icin adsetId gerekli');

        await metaPost(adsetId, { is_dynamic_creative: 'true', access_token: accessToken });

        // If variants provided with asset_feed_spec, create creative
        if (payload.variants) {
          await metaPost(`${accountId}/adcreatives`, {
            name: `DC Test - ${payload.testName}`,
            asset_feed_spec: typeof payload.variants === 'string' ? payload.variants : JSON.stringify(payload.variants),
            object_story_spec: JSON.stringify({ page_id: pageId }),
            access_token: accessToken,
          });
        }

        return { result: { success: true, testType: 'dynamic_creative', adsetId }, message: `Dynamic creative testi "${payload.testName}" baslatildi.` };
      }

      if (testType === 'ad_study') {
        // Create Meta native A/B study
        const params: Record<string, string> = {
          name: payload.testName,
          description: payload.description || `A/B Test - ${payload.testName}`,
          type: 'SPLIT_TEST',
          access_token: accessToken,
        };
        if (payload.startTime) params.start_time = payload.startTime;
        if (payload.endTime) params.end_time = payload.endTime;
        if (payload.cells) params.cells = typeof payload.cells === 'string' ? payload.cells : JSON.stringify(payload.cells);

        const json = await metaPost(`${accountId}/ad_studies`, params);
        return { result: { success: true, studyId: json.id, testType: 'ad_study' }, message: `A/B Study "${payload.testName}" olusturuldu.` };
      }

      // Manual split — just informational, user will use duplicate_adset
      return { result: { success: true, testType: 'manual_split' }, message: `Manuel split test plani olusturuldu. duplicate_adset ile reklam setlerini kopyalayin.` };
    }

    case 'duplicate_adset': {
      const sourceAdsetId = payload.sourceAdsetId;
      if (!sourceAdsetId) throw new Error('sourceAdsetId gerekli');

      // Read source adset details
      const sourceFields = 'id,name,campaign_id,daily_budget,billing_event,optimization_goal,targeting,status,bid_strategy,bid_amount,start_time,end_time';
      const source = await metaGet(sourceAdsetId, { fields: sourceFields, access_token: accessToken });

      // Create new adset with same settings
      const newParams: Record<string, string> = {
        name: payload.newName || `${source.name} (Kopya)`,
        campaign_id: source.campaign_id,
        daily_budget: source.daily_budget ? String(source.daily_budget) : '0',
        billing_event: source.billing_event || 'IMPRESSIONS',
        optimization_goal: source.optimization_goal || 'REACH',
        targeting: JSON.stringify(source.targeting || {}),
        status: 'PAUSED',
        access_token: accessToken,
      };
      if (source.bid_strategy) newParams.bid_strategy = source.bid_strategy;
      if (source.bid_amount) newParams.bid_amount = String(source.bid_amount);
      if (source.start_time) newParams.start_time = source.start_time;
      if (source.end_time) newParams.end_time = source.end_time;

      const newAdset = await metaPost(`${accountId}/adsets`, newParams);

      // Optionally copy ads
      let copiedAds = 0;
      if (payload.copyAds !== false) {
        const adsResp = await metaGet(`${sourceAdsetId}/ads`, {
          fields: 'id,name,creative{id},status',
          limit: '100',
          access_token: accessToken,
        });

        for (const ad of (adsResp.data || [])) {
          if (ad.creative?.id) {
            await metaPost(`${accountId}/ads`, {
              name: `${ad.name} (Kopya)`,
              adset_id: newAdset.id,
              creative: JSON.stringify({ creative_id: ad.creative.id }),
              status: 'PAUSED',
              access_token: accessToken,
            });
            copiedAds++;
          }
        }
      }

      return {
        result: { success: true, newAdsetId: newAdset.id, copiedAds },
        message: `Reklam seti kopyalandi (yeni ID: ${newAdset.id}). ${copiedAds > 0 ? `${copiedAds} reklam da kopyalandi.` : ''}`,
      };
    }

    // ===== Faz 4 — Reporting =====

    case 'generate_report': {
      const handlerResult = await handleGenerateReport(ctx, payload);
      if (handlerResult.error) throw new Error(handlerResult.error);
      return { result: handlerResult, message: handlerResult.message || 'Rapor olusturuldu.' };
    }

    // ===== Faz 5 — Automation Rules =====

    case 'create_automation_rule': {
      const handlerResult = await handleCreateAutomationRule(ctx, payload);
      if (handlerResult.error) throw new Error(handlerResult.error);
      return { result: handlerResult, message: handlerResult.message || 'Otomasyon kurali olusturuldu.' };
    }

    case 'update_automation_rule': {
      const handlerResult = await handleUpdateAutomationRule(ctx, payload);
      if (handlerResult.error) throw new Error(handlerResult.error);
      return { result: handlerResult, message: handlerResult.message || 'Otomasyon kurali guncellendi.' };
    }

    case 'delete_automation_rule': {
      const handlerResult = await handleDeleteAutomationRule(ctx, payload);
      if (handlerResult.error) throw new Error(handlerResult.error);
      return { result: handlerResult, message: handlerResult.message || 'Otomasyon kurali silindi.' };
    }

    // ===== Faz 6 — Competitor Intelligence =====

    case 'add_competitor': {
      const handlerResult = await handleAddCompetitor(ctx, payload);
      if (handlerResult.error) throw new Error(handlerResult.error);
      return { result: handlerResult, message: handlerResult.message || 'Rakip eklendi.' };
    }

    case 'analyze_competitor': {
      const handlerResult = await handleAnalyzeCompetitor(ctx, payload);
      if (handlerResult.error) throw new Error(handlerResult.error);
      return { result: handlerResult, message: handlerResult.message || 'Rakip analizi tamamlandi.' };
    }

    default:
      throw new Error(`Bilinmeyen aksiyon: ${actionType}`);
  }
}
