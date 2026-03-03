import type { ToolContext } from '../toolHandlers.js';
import { getMetaCredentials, metaGet } from '../metaApi.js';

/**
 * get_ads — list ads for an adset or campaign
 */
export async function handleGetAds(ctx: ToolContext, args: Record<string, any>) {
  const { adsetId, campaignId, statusFilter, limit = 50 } = args;

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);

  const fields = 'id,name,status,effective_status,creative{id,name,thumbnail_url,body,title,link_url,call_to_action_type},adset_id';

  // Determine the path: adset ads, campaign ads, or all account ads
  let path: string;
  if (adsetId) {
    path = `${adsetId}/ads`;
  } else if (campaignId) {
    path = `${campaignId}/ads`;
  } else {
    path = `${creds.adAccountId}/ads`;
  }

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

  const ads = (json.data || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    status: item.effective_status?.toLowerCase() || item.status?.toLowerCase() || 'unknown',
    creative_thumbnail: item.creative?.thumbnail_url || null,
    creative_title: item.creative?.title || '',
    creative_body: item.creative?.body || '',
    adset_id: item.adset_id,
  }));

  return { ads, adsetId: adsetId || null, campaignId: campaignId || null, component: 'AdGrid' };
}

/**
 * get_ad_details — get full details of a specific ad
 */
export async function handleGetAdDetails(ctx: ToolContext, args: Record<string, any>) {
  const { adId } = args;
  if (!adId) return { error: 'adId parametresi gerekli' };

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);

  const fields = 'id,name,status,effective_status,creative{id,name,thumbnail_url,body,title,description,link_url,call_to_action_type,image_url,object_story_spec},adset_id,campaign_id,recommendations,ad_review_feedback,issues_info,preview_shareable_link';

  const json = await metaGet(adId, {
    fields,
    access_token: creds.accessToken,
  });

  const creative = json.creative ? {
    id: json.creative.id,
    name: json.creative.name,
    title: json.creative.title || '',
    body: json.creative.body || '',
    description: json.creative.description || '',
    link_url: json.creative.link_url || '',
    call_to_action_type: json.creative.call_to_action_type || '',
    image_url: json.creative.image_url || '',
    thumbnail_url: json.creative.thumbnail_url || '',
  } : null;

  const recommendations = json.recommendations?.data?.map((r: any) => ({
    title: r.title || '',
    message: r.message || '',
    code: r.code || '',
    importance: r.importance || '',
  })) || [];

  return {
    id: json.id,
    name: json.name,
    status: json.effective_status?.toLowerCase() || json.status?.toLowerCase(),
    creative,
    adset_id: json.adset_id,
    campaign_id: json.campaign_id,
    recommendations,
    review_feedback: json.ad_review_feedback || null,
    issues_info: json.issues_info || null,
    preview_url: json.preview_shareable_link || null,
    component: 'AdDetailCard',
  };
}
