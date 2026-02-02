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
