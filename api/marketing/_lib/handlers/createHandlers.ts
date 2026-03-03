import type { ToolContext } from '../toolHandlers.js';
import { getMetaCredentials, metaGet, metaPost } from '../metaApi.js';

/**
 * upload_ad_image — upload an image to Meta ad account via URL
 */
export async function handleUploadAdImage(ctx: ToolContext, args: Record<string, any>) {
  const { imageUrl } = args;
  if (!imageUrl) return { error: 'imageUrl parametresi gerekli' };

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);

  const json = await metaPost(`${creds.adAccountId}/adimages`, {
    image_url: imageUrl,
    access_token: creds.accessToken,
  });

  // Meta returns { images: { <hash>: { hash, url, ... } } }
  const images = json.images || {};
  const firstKey = Object.keys(images)[0];
  const imageData = firstKey ? images[firstKey] : null;

  if (!imageData) {
    return { error: 'Gorsel yuklenemedi — Meta gecerli bir sonuc dondurmedi' };
  }

  return {
    hash: imageData.hash,
    url: imageData.url || imageData.url_128 || null,
    width: imageData.width || null,
    height: imageData.height || null,
    component: 'ImageUploadResult',
  };
}

/**
 * create_ad_creative — create a creative template with image + text + CTA
 */
export async function handleCreateAdCreative(ctx: ToolContext, args: Record<string, any>) {
  const { title, body, pageId: argPageId, linkUrl, imageHash, callToAction, description } = args;
  if (!title || !body) return { error: 'title ve body parametreleri gerekli' };

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);
  const resolvedPageId = argPageId || creds.pageId;
  if (!resolvedPageId) return { error: 'Facebook Sayfa ID bulunamadi — pageId belirtin veya hesap ayarlarindan ekleyin' };

  const objectStorySpec: Record<string, any> = { page_id: resolvedPageId };

  if (linkUrl) {
    objectStorySpec.link_data = {
      message: body,
      link: linkUrl,
      name: title,
      description: description || '',
      call_to_action: { type: callToAction || 'LEARN_MORE', value: { link: linkUrl } },
    };
    if (imageHash) objectStorySpec.link_data.image_hash = imageHash;
  } else {
    objectStorySpec.link_data = {
      message: body,
      name: title,
    };
    if (imageHash) objectStorySpec.link_data.image_hash = imageHash;
  }

  const json = await metaPost(`${creds.adAccountId}/adcreatives`, {
    name: `Creative - ${title}`,
    object_story_spec: JSON.stringify(objectStorySpec),
    access_token: creds.accessToken,
  });

  return {
    id: json.id,
    name: `Creative - ${title}`,
    title,
    body,
    linkUrl: linkUrl || null,
    callToAction: callToAction || 'LEARN_MORE',
    component: 'CreativePreviewCard',
  };
}

/**
 * get_ad_creatives — list creatives in the ad account
 */
export async function handleGetAdCreatives(ctx: ToolContext, args: Record<string, any>) {
  const { limit = 25 } = args;

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);

  const json = await metaGet(`${creds.adAccountId}/adcreatives`, {
    fields: 'id,name,thumbnail_url,body,title,status,object_story_spec',
    limit: String(limit),
    access_token: creds.accessToken,
  });

  const creatives = (json.data || []).map((item: any) => ({
    id: item.id,
    name: item.name || '',
    title: item.title || item.object_story_spec?.link_data?.name || '',
    body: item.body || item.object_story_spec?.link_data?.message || '',
    thumbnail_url: item.thumbnail_url || null,
    status: item.status?.toLowerCase() || 'unknown',
  }));

  return { creatives, component: 'CreativeGrid' };
}

/**
 * get_creative_details — get full details of a specific creative
 */
export async function handleGetCreativeDetails(ctx: ToolContext, args: Record<string, any>) {
  const { creativeId } = args;
  if (!creativeId) return { error: 'creativeId parametresi gerekli' };

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);

  const json = await metaGet(creativeId, {
    fields: 'id,name,body,title,link_url,call_to_action_type,image_url,thumbnail_url,object_story_spec,status',
    access_token: creds.accessToken,
  });

  return {
    id: json.id,
    name: json.name || '',
    title: json.title || json.object_story_spec?.link_data?.name || '',
    body: json.body || json.object_story_spec?.link_data?.message || '',
    description: json.object_story_spec?.link_data?.description || '',
    linkUrl: json.link_url || json.object_story_spec?.link_data?.link || '',
    callToAction: json.call_to_action_type || json.object_story_spec?.link_data?.call_to_action?.type || '',
    imageUrl: json.image_url || '',
    thumbnailUrl: json.thumbnail_url || '',
    status: json.status?.toLowerCase() || 'unknown',
    component: 'CreativePreviewCard',
  };
}

/**
 * get_ab_test_results — get A/B test or dynamic creative results
 */
export async function handleGetAbTestResults(ctx: ToolContext, args: Record<string, any>) {
  const { testId, testType } = args;
  if (!testId) return { error: 'testId parametresi gerekli' };

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);

  if (testType === 'dynamic_creative') {
    // Get dynamic creative breakdown insights
    const json = await metaGet(`${testId}/insights`, {
      fields: 'impressions,clicks,ctr,cpc,spend,conversions,cost_per_action_type',
      breakdowns: 'dynamic_ad_asset',
      access_token: creds.accessToken,
    });

    const variants = (json.data || []).map((item: any) => ({
      asset: item.dynamic_ad_asset || 'Bilinmiyor',
      impressions: parseInt(item.impressions || '0'),
      clicks: parseInt(item.clicks || '0'),
      ctr: parseFloat(item.ctr || '0'),
      cpc: parseFloat(item.cpc || '0'),
      spend: parseFloat(item.spend || '0'),
    }));

    // Determine winner by CTR
    const winner = variants.length > 0
      ? variants.reduce((best: any, v: any) => v.ctr > best.ctr ? v : best, variants[0])
      : null;

    return { testType: 'dynamic_creative', testId, variants, winner, component: 'ABTestResultsCard' };
  }

  // Ad Study results
  const json = await metaGet(testId, {
    fields: 'id,name,description,start_time,end_time,results,cells{name,treatment_percentage,adsets{name,id,insights{impressions,clicks,ctr,cpc,spend,conversions}}}',
    access_token: creds.accessToken,
  });

  const cells = (json.cells?.data || []).map((cell: any) => {
    const adsetInsights = cell.adsets?.data?.[0]?.insights?.data?.[0] || {};
    return {
      name: cell.name,
      treatmentPercentage: cell.treatment_percentage,
      impressions: parseInt(adsetInsights.impressions || '0'),
      clicks: parseInt(adsetInsights.clicks || '0'),
      ctr: parseFloat(adsetInsights.ctr || '0'),
      cpc: parseFloat(adsetInsights.cpc || '0'),
      spend: parseFloat(adsetInsights.spend || '0'),
    };
  });

  const winner = cells.length > 0
    ? cells.reduce((best: any, c: any) => c.ctr > best.ctr ? c : best, cells[0])
    : null;

  return {
    testType: 'ad_study',
    testId: json.id,
    name: json.name,
    startTime: json.start_time,
    endTime: json.end_time,
    cells,
    winner,
    results: json.results || null,
    component: 'ABTestResultsCard',
  };
}
