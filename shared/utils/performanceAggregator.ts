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

// ============================================
// PERIOD COMPARISON & EXPORT
// ============================================

export interface PeriodComparison {
  current: AggregatedMetrics;
  previous: AggregatedMetrics;
  changes: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
}

/**
 * Compare current period with previous period.
 * Returns percentage change for each metric.
 */
export function comparePeriods(snapshots: PerformanceSnapshot[], days: number = 7): PeriodComparison {
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevCutoff = new Date(cutoff.getTime() - days * 24 * 60 * 60 * 1000);

  const current = snapshots.filter(s => new Date(s.date) >= cutoff);
  const previous = snapshots.filter(s => {
    const d = new Date(s.date);
    return d >= prevCutoff && d < cutoff;
  });

  const sumMetrics = (arr: PerformanceSnapshot[]) => {
    const imp = arr.reduce((s, a) => s + (a.impressions || 0), 0);
    const clk = arr.reduce((s, a) => s + (a.clicks || 0), 0);
    const spd = arr.reduce((s, a) => s + (a.spend || 0), 0);
    const cnv = arr.reduce((s, a) => s + (a.conversions || 0), 0);
    const rch = arr.reduce((s, a) => s + (a.reach || 0), 0);
    return {
      date: '',
      impressions: imp,
      clicks: clk,
      spend: spd,
      conversions: cnv,
      reach: rch,
      ctr: imp > 0 ? (clk / imp) * 100 : 0,
      cpc: clk > 0 ? spd / clk : 0,
      cpm: imp > 0 ? (spd / imp) * 1000 : 0,
      roas: 0,
    };
  };

  const cur = sumMetrics(current);
  const prev = sumMetrics(previous);

  const pctChange = (c: number, p: number) => p > 0 ? ((c - p) / p) * 100 : c > 0 ? 100 : 0;

  return {
    current: cur,
    previous: prev,
    changes: {
      spend: pctChange(cur.spend, prev.spend),
      impressions: pctChange(cur.impressions, prev.impressions),
      clicks: pctChange(cur.clicks, prev.clicks),
      conversions: pctChange(cur.conversions, prev.conversions),
      ctr: pctChange(cur.ctr, prev.ctr),
      cpc: pctChange(cur.cpc, prev.cpc),
      cpm: pctChange(cur.cpm, prev.cpm),
    },
  };
}

/**
 * Export snapshots as CSV string.
 */
export function exportToCSV(snapshots: PerformanceSnapshot[]): string {
  const headers = ['Tarih', 'Platform', 'Seviye', 'Reklam Seti', 'Reklam', 'Harcama', 'Gosterim', 'Erisim', 'Tiklama', 'CTR', 'Donusum', 'CPA', 'CPC', 'CPM', 'Frekans'];
  const rows = snapshots.map(s => [
    s.date,
    s.platform,
    s.level || 'campaign',
    s.adSetName || s.adSetId || '',
    s.adName || s.adId || '',
    s.spend.toFixed(2),
    s.impressions,
    s.reach,
    s.clicks,
    s.ctr.toFixed(2),
    s.conversions,
    s.cpa.toFixed(2),
    s.cpc.toFixed(2),
    s.cpm.toFixed(2),
    s.frequency?.toFixed(2) || '',
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}
