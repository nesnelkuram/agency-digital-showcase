import type { PerformanceSnapshot } from '@/shared/types/marketing';

export interface AggregatedMetrics {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  reach: number;
}

/**
 * Aggregate daily snapshots into a flat metrics array for charts.
 * Groups by date across all platforms.
 */
export function aggregateByDate(snapshots: PerformanceSnapshot[]): AggregatedMetrics[] {
  const byDate: Record<string, AggregatedMetrics> = {};

  for (const s of snapshots) {
    if (!byDate[s.date]) {
      byDate[s.date] = {
        date: s.date,
        impressions: 0,
        clicks: 0,
        spend: 0,
        conversions: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        roas: 0,
        reach: 0,
      };
    }
    const agg = byDate[s.date];
    agg.impressions += s.impressions || 0;
    agg.clicks += s.clicks || 0;
    agg.spend += s.spend || 0;
    agg.conversions += s.conversions || 0;
    agg.reach += s.reach || 0;
  }

  // Calculate derived metrics
  for (const agg of Object.values(byDate)) {
    agg.ctr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0;
    agg.cpc = agg.clicks > 0 ? agg.spend / agg.clicks : 0;
    agg.cpm = agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0;
  }

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Aggregate snapshots by platform for comparison charts.
 */
export function aggregateByPlatform(snapshots: PerformanceSnapshot[]): Array<{
  platform: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
}> {
  const byPlatform: Record<string, { impressions: number; clicks: number; spend: number; conversions: number }> = {};

  for (const s of snapshots) {
    const p = s.platform || 'other';
    if (!byPlatform[p]) {
      byPlatform[p] = { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
    }
    byPlatform[p].impressions += s.impressions || 0;
    byPlatform[p].clicks += s.clicks || 0;
    byPlatform[p].spend += s.spend || 0;
    byPlatform[p].conversions += s.conversions || 0;
  }

  return Object.entries(byPlatform).map(([platform, data]) => ({
    platform,
    ...data,
    ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
  }));
}

/**
 * Format date string for chart axis labels.
 */
export function formatChartDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

/**
 * Format number for chart labels (1000 → 1K, 1000000 → 1M).
 */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

// ============================================
// ENTITY-LEVEL AGGREGATION (Ad Set / Ad)
// ============================================

export interface EntityAggregatedMetrics {
  entityId: string;
  entityName?: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: number;
}

/**
 * Aggregate snapshots at the ad-set level.
 * Filters to level === 'adset', groups by adSetId, and computes totals + derived metrics.
 */
export function aggregateByAdSet(snapshots: PerformanceSnapshot[]): EntityAggregatedMetrics[] {
  const adSetSnapshots = snapshots.filter((s) => s.level === 'adset' && s.adSetId);

  const byAdSet: Record<string, { impressions: number; clicks: number; spend: number; conversions: number; reach: number; name?: string }> = {};

  for (const s of adSetSnapshots) {
    const key = s.adSetId!;
    if (!byAdSet[key]) {
      byAdSet[key] = { impressions: 0, clicks: 0, spend: 0, conversions: 0, reach: 0 };
    }
    byAdSet[key].impressions += s.impressions || 0;
    byAdSet[key].clicks += s.clicks || 0;
    byAdSet[key].spend += s.spend || 0;
    byAdSet[key].conversions += s.conversions || 0;
    byAdSet[key].reach += s.reach || 0;
  }

  return Object.entries(byAdSet).map(([adSetId, data]) => ({
    entityId: adSetId,
    entityName: data.name,
    impressions: data.impressions,
    clicks: data.clicks,
    spend: data.spend,
    conversions: data.conversions,
    reach: data.reach,
    ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
    cpc: data.clicks > 0 ? data.spend / data.clicks : 0,
    cpm: data.impressions > 0 ? (data.spend / data.impressions) * 1000 : 0,
  }));
}

/**
 * Aggregate snapshots at the ad level.
 * Filters to level === 'ad', groups by adId, and computes totals + derived metrics.
 */
export function aggregateByAd(snapshots: PerformanceSnapshot[]): EntityAggregatedMetrics[] {
  const adSnapshots = snapshots.filter((s) => s.level === 'ad' && s.adId);

  const byAd: Record<string, { impressions: number; clicks: number; spend: number; conversions: number; reach: number; name?: string }> = {};

  for (const s of adSnapshots) {
    const key = s.adId!;
    if (!byAd[key]) {
      byAd[key] = { impressions: 0, clicks: 0, spend: 0, conversions: 0, reach: 0 };
    }
    byAd[key].impressions += s.impressions || 0;
    byAd[key].clicks += s.clicks || 0;
    byAd[key].spend += s.spend || 0;
    byAd[key].conversions += s.conversions || 0;
    byAd[key].reach += s.reach || 0;
  }

  return Object.entries(byAd).map(([adId, data]) => ({
    entityId: adId,
    entityName: data.name,
    impressions: data.impressions,
    clicks: data.clicks,
    spend: data.spend,
    conversions: data.conversions,
    reach: data.reach,
    ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
    cpc: data.clicks > 0 ? data.spend / data.clicks : 0,
    cpm: data.impressions > 0 ? (data.spend / data.impressions) * 1000 : 0,
  }));
}
