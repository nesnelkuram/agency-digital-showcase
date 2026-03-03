import type { ToolContext } from '../toolHandlers.js';
import { getMetaCredentials, metaGet } from '../metaApi.js';

/**
 * get_adsets — list ad sets for account or specific campaign
 */
export async function handleGetAdsets(ctx: ToolContext, args: Record<string, any>) {
  const { campaignId, statusFilter, limit = 50 } = args;

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);

  const fields = 'id,name,status,effective_status,daily_budget,lifetime_budget,bid_strategy,targeting,optimization_goal,billing_event,start_time,end_time';

  // If campaignId is provided, list adsets under that campaign; otherwise list all from account
  const path = campaignId ? `${campaignId}/adsets` : `${creds.adAccountId}/adsets`;

  const params: Record<string, string> = {
    fields,
    limit: String(limit),
    access_token: creds.accessToken,
  };

  if (statusFilter && statusFilter !== 'all') {
    const statusMap: Record<string, string> = {
      active: 'ACTIVE',
      paused: 'PAUSED',
    };
    if (statusMap[statusFilter]) {
      params['filtering'] = JSON.stringify([{
        field: 'effective_status',
        operator: 'IN',
        value: [statusMap[statusFilter]],
      }]);
    }
  }

  const json = await metaGet(path, params);

  const adsets = (json.data || []).map((item: any) => {
    // Build targeting summary
    const t = item.targeting || {};
    const summaryParts: string[] = [];
    if (t.age_min || t.age_max) summaryParts.push(`${t.age_min || 18}-${t.age_max || 65} yas`);
    if (t.geo_locations?.countries?.length) summaryParts.push(t.geo_locations.countries.join(', '));
    if (t.flexible_spec?.[0]?.interests?.length) {
      summaryParts.push(`${t.flexible_spec[0].interests.length} ilgi alani`);
    }

    return {
      id: item.id,
      name: item.name,
      status: item.effective_status?.toLowerCase() || item.status?.toLowerCase() || 'unknown',
      daily_budget: item.daily_budget ? parseInt(item.daily_budget) / 100 : 0,
      lifetime_budget: item.lifetime_budget ? parseInt(item.lifetime_budget) / 100 : undefined,
      bid_strategy: item.bid_strategy?.toLowerCase() || 'lowest_cost',
      optimization_goal: item.optimization_goal,
      billing_event: item.billing_event,
      targeting_summary: summaryParts.join(' | ') || 'Hedefleme bilgisi yok',
      start_time: item.start_time,
      end_time: item.end_time,
    };
  });

  return { adsets, campaignId: campaignId || null, component: 'AdSetGrid' };
}

/**
 * get_adset_details — get full details of a specific ad set
 */
export async function handleGetAdsetDetails(ctx: ToolContext, args: Record<string, any>) {
  const { adsetId } = args;
  if (!adsetId) return { error: 'adsetId parametresi gerekli' };

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);

  const fields = 'id,name,status,effective_status,daily_budget,lifetime_budget,bid_strategy,bid_amount,targeting,optimization_goal,billing_event,start_time,end_time,frequency_control_specs,destination_type,is_dynamic_creative,campaign_id,learning_stage_info,daily_min_spend_target,daily_spend_cap,pacing_type';

  const json = await metaGet(adsetId, {
    fields,
    access_token: creds.accessToken,
  });

  // Parse targeting into readable structure
  const t = json.targeting || {};
  const targeting = {
    age_min: t.age_min,
    age_max: t.age_max,
    genders: t.genders,
    geo_locations: t.geo_locations,
    flexible_spec: t.flexible_spec,
    exclusions: t.exclusions,
    custom_audiences: t.custom_audiences,
    publisher_platforms: t.publisher_platforms,
    device_platforms: t.device_platforms,
    facebook_positions: t.facebook_positions,
    instagram_positions: t.instagram_positions,
  };

  return {
    id: json.id,
    name: json.name,
    status: json.effective_status?.toLowerCase() || json.status?.toLowerCase(),
    daily_budget: json.daily_budget ? parseInt(json.daily_budget) / 100 : 0,
    lifetime_budget: json.lifetime_budget ? parseInt(json.lifetime_budget) / 100 : undefined,
    bid_strategy: json.bid_strategy?.toLowerCase() || 'lowest_cost',
    bid_amount: json.bid_amount ? parseInt(json.bid_amount) / 100 : undefined,
    optimization_goal: json.optimization_goal,
    billing_event: json.billing_event,
    targeting,
    start_time: json.start_time,
    end_time: json.end_time,
    campaign_id: json.campaign_id,
    frequency_control_specs: json.frequency_control_specs,
    destination_type: json.destination_type,
    is_dynamic_creative: json.is_dynamic_creative,
    learning_stage_info: json.learning_stage_info,
    component: 'AdSetDetailCard',
  };
}
