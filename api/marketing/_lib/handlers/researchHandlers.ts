import type { ToolContext } from '../toolHandlers.js';
import { getMetaCredentials, metaGet } from '../metaApi.js';

/**
 * search_interests — search Meta interest targeting options
 */
export async function handleSearchInterests(ctx: ToolContext, args: Record<string, any>) {
  const { query, limit = 25 } = args;
  if (!query) return { error: 'Arama sorgusu (query) gerekli' };

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);
  const json = await metaGet('search', {
    type: 'adinterest',
    q: query,
    limit: String(limit),
    access_token: creds.accessToken,
  });

  const results = (json.data || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    audience_size: item.audience_size || item.audience_size_lower_bound,
    path: item.path ? item.path.join(' > ') : undefined,
    description: item.description,
    topic: item.topic,
  }));

  return { results, searchType: 'interests', query, component: 'TargetingSearchResults' };
}

/**
 * search_behaviors — search Meta behavior targeting categories
 */
export async function handleSearchBehaviors(ctx: ToolContext, args: Record<string, any>) {
  const { limit = 50 } = args;

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);
  const json = await metaGet('search', {
    type: 'adTargetingCategory',
    class: 'behaviors',
    limit: String(limit),
    access_token: creds.accessToken,
  });

  const results = (json.data || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    audience_size: item.audience_size || item.audience_size_lower_bound,
    path: item.path ? item.path.join(' > ') : undefined,
    description: item.description,
  }));

  return { results, searchType: 'behaviors', component: 'TargetingSearchResults' };
}

/**
 * search_demographics — search Meta demographic targeting categories
 */
export async function handleSearchDemographics(ctx: ToolContext, args: Record<string, any>) {
  const { demographicClass, limit = 50 } = args;
  if (!demographicClass) return { error: 'demographicClass parametresi gerekli (demographics, life_events, industries, income, family_statuses, user_device, user_os)' };

  const validClasses = ['demographics', 'life_events', 'industries', 'income', 'family_statuses', 'user_device', 'user_os'];
  if (!validClasses.includes(demographicClass)) {
    return { error: `Gecersiz demographicClass: ${demographicClass}. Gecerli degerler: ${validClasses.join(', ')}` };
  }

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);
  const json = await metaGet('search', {
    type: 'adTargetingCategory',
    class: demographicClass,
    limit: String(limit),
    access_token: creds.accessToken,
  });

  const results = (json.data || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    audience_size: item.audience_size || item.audience_size_lower_bound,
    path: item.path ? item.path.join(' > ') : undefined,
    description: item.description,
  }));

  return { results, searchType: 'demographics', demographicClass, component: 'TargetingSearchResults' };
}

/**
 * search_geo_locations — search Meta geographic locations
 */
export async function handleSearchGeoLocations(ctx: ToolContext, args: Record<string, any>) {
  const { query, locationTypes, limit = 25 } = args;
  if (!query) return { error: 'Arama sorgusu (query) gerekli' };

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);

  const params: Record<string, string> = {
    type: 'adgeolocation',
    q: query,
    limit: String(limit),
    access_token: creds.accessToken,
  };

  if (locationTypes && Array.isArray(locationTypes) && locationTypes.length > 0) {
    params.location_types = JSON.stringify(locationTypes);
  }

  const json = await metaGet('search', params);

  const locations = (json.data || []).map((item: any) => ({
    key: item.key,
    name: item.name,
    type: item.type,
    country_code: item.country_code,
    country_name: item.country_name,
    region: item.region,
    region_id: item.region_id,
    supports_city: item.supports_city,
    supports_region: item.supports_region,
  }));

  return { locations, query, component: 'GeoLocationResults' };
}

/**
 * estimate_audience_size — estimate reach for a targeting spec
 */
export async function handleEstimateAudienceSize(ctx: ToolContext, args: Record<string, any>) {
  const { targeting, optimizationGoal = 'REACH' } = args;
  if (!targeting) return { error: 'targeting parametresi gerekli' };

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);

  const targetingSpec = JSON.stringify(targeting);
  const json = await metaGet(`${creds.adAccountId}/delivery_estimate`, {
    targeting_spec: targetingSpec,
    optimization_goal: optimizationGoal,
    access_token: creds.accessToken,
  });

  const estimate = json.data?.[0];
  if (!estimate) {
    return { error: 'Kitle tahmini alinamadi' };
  }

  const lower = estimate.estimate_mau_lower_bound || estimate.estimate_dau?.[0] || 0;
  const upper = estimate.estimate_mau_upper_bound || estimate.estimate_dau?.[1] || 0;

  // Determine status based on audience size
  let status: 'narrow' | 'optimal' | 'broad' = 'optimal';
  if (upper < 10000) status = 'narrow';
  else if (lower > 50000000) status = 'broad';

  return {
    estimatedSize: { lower, upper },
    dailyOutcomes: estimate.estimate_ready ? {
      reach: estimate.estimate_dau,
      impressions: estimate.daily_outcomes_curve?.[0]?.impressions,
    } : undefined,
    status,
    targeting,
    component: 'AudienceEstimateWidget',
  };
}

/**
 * search_ads_archive — search Meta Ad Library for competitor research
 */
export async function handleSearchAdsArchive(ctx: ToolContext, args: Record<string, any>) {
  const { searchTerms, countries = ['TR'], adType = 'ALL', limit = 25 } = args;
  if (!searchTerms) return { error: 'searchTerms parametresi gerekli' };

  const creds = await getMetaCredentials(ctx.db, ctx.tenantId);

  const fields = 'id,page_name,ad_creative_bodies,ad_creative_link_titles,ad_creative_link_captions,ad_snapshot_url,ad_delivery_start_time,ad_delivery_stop_time,currency_offset,spend,impressions,demographic_distribution,publisher_platforms,bylines';

  const json = await metaGet('ads_archive', {
    search_terms: searchTerms,
    ad_reached_countries: JSON.stringify(countries),
    ad_type: adType,
    fields,
    limit: String(limit),
    access_token: creds.accessToken,
  });

  const ads = (json.data || []).map((item: any) => ({
    id: item.id,
    page_name: item.page_name,
    ad_creative_body: item.ad_creative_bodies?.[0] || '',
    ad_creative_title: item.ad_creative_link_titles?.[0] || '',
    ad_snapshot_url: item.ad_snapshot_url,
    delivery_start: item.ad_delivery_start_time,
    delivery_stop: item.ad_delivery_stop_time,
    spend: item.spend,
    impressions: item.impressions,
    demographic_distribution: item.demographic_distribution,
    publisher_platforms: item.publisher_platforms,
  }));

  return { ads, searchTerms, countries, component: 'CompetitorAdsGrid' };
}
