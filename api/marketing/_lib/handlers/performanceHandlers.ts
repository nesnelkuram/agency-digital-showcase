import type { ToolContext } from '../toolHandlers.js';

export async function handleGetCampaignPerformance(ctx: ToolContext, args: Record<string, any>) {
  const { campaignId, datePreset = 'last_7d', level = 'campaign' } = args;

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
    campaignId, datePreset, level,
    insights: level === 'campaign' ? rows[0] : rows,
    component: 'PerformanceWidget',
  };
}
