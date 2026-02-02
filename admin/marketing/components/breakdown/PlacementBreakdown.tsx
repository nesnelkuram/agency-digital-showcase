import React, { useState, useEffect, useMemo } from 'react';
import { Download, RefreshCw, AlertCircle, ArrowUpDown } from 'lucide-react';
import type { CampaignBreakdown, BreakdownRow } from '@/shared/types/breakdown';
import { getBreakdownData, syncBreakdown } from '@/shared/services/marketingService';

interface Props {
  campaignId: string;
  metaCampaignId?: string;
  projectId?: string;
}

const PLATFORM_DISPLAY: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  audience_network: 'Audience Network',
  messenger: 'Messenger',
};

const POSITION_DISPLAY: Record<string, string> = {
  feed: 'Feed',
  stories: 'Stories',
  reels: 'Reels',
  right_column: 'Right Column',
  search: 'Search',
  marketplace: 'Marketplace',
  video_feeds: 'Video Feeds',
  explore: 'Explore',
  instream_video: 'In-Stream Video',
  instant_article: 'Instant Article',
};

type SortField = 'publisherPlatform' | 'platformPosition' | 'impressions' | 'clicks' | 'spend' | 'ctr' | 'cpc' | 'conversions';
type SortDir = 'asc' | 'desc';

function formatFetchTime(data: CampaignBreakdown): string {
  if (!data.fetchedAt) return '';
  return data.fetchedAt.toDate().toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getIntensityClass(spend: number, maxSpend: number): string {
  if (maxSpend === 0) return 'bg-white';
  const ratio = spend / maxSpend;
  if (ratio > 0.75) return 'bg-indigo-200 text-indigo-900';
  if (ratio > 0.5) return 'bg-indigo-100 text-indigo-800';
  if (ratio > 0.25) return 'bg-indigo-50 text-indigo-700';
  if (spend > 0) return 'bg-neutral-50 text-neutral-700';
  return 'bg-white text-neutral-300';
}

const PlacementBreakdown: React.FC<Props> = ({ campaignId, metaCampaignId, projectId }) => {
  const [data, setData] = useState<CampaignBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    getBreakdownData(campaignId, 'placement')
      .then(setData)
      .catch(console.error)
      .finally(() => setInitialLoading(false));
  }, [campaignId]);

  const handleFetch = async () => {
    if (!metaCampaignId || !projectId) return;
    setLoading(true);
    try {
      await syncBreakdown(projectId, campaignId, metaCampaignId, 'placement');
      const fresh = await getBreakdownData(campaignId, 'placement');
      setData(fresh);
    } catch (err) {
      console.error('Placement breakdown sync failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Build matrix data
  const matrixData = useMemo(() => {
    if (!data?.data) return { platforms: [], positions: [], matrix: {}, maxSpend: 0 };

    const platforms = new Set<string>();
    const positions = new Set<string>();
    const matrix: Record<string, Record<string, number>> = {};
    let maxSpend = 0;

    for (const row of data.data) {
      const pub = row.publisherPlatform || 'unknown';
      const pos = row.platformPosition || 'unknown';
      platforms.add(pub);
      positions.add(pos);

      if (!matrix[pub]) matrix[pub] = {};
      matrix[pub][pos] = (matrix[pub][pos] || 0) + row.spend;

      if (matrix[pub][pos] > maxSpend) {
        maxSpend = matrix[pub][pos];
      }
    }

    return {
      platforms: Array.from(platforms).sort(),
      positions: Array.from(positions).sort(),
      matrix,
      maxSpend,
    };
  }, [data]);

  // Sort detail rows
  const sortedRows = useMemo(() => {
    if (!data?.data) return [];
    return [...data.data].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case 'publisherPlatform':
          aVal = a.publisherPlatform || '';
          bVal = b.publisherPlatform || '';
          break;
        case 'platformPosition':
          aVal = a.platformPosition || '';
          bVal = b.platformPosition || '';
          break;
        default:
          aVal = (a as any)[sortField] ?? 0;
          bVal = (b as any)[sortField] ?? 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [data, sortField, sortDir]);

  // Loading state
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // No metaCampaignId
  if (!metaCampaignId) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200/50 p-8 text-center">
        <AlertCircle className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
        <p className="text-sm font-commons text-neutral-500">
          Meta kampanya ID'si bulunamadi
        </p>
      </div>
    );
  }

  // Empty state
  if (!data || !data.data || data.data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200/50 p-8 text-center">
        <p className="text-sm font-commons text-neutral-500 mb-3">Henuz veri yok</p>
        <button
          onClick={handleFetch}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-commons text-sm disabled:opacity-50"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Veri Cek
        </button>
      </div>
    );
  }

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : '';

  return (
    <div className="space-y-4">
      {/* Header + Matrix */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-base font-commons font-semibold text-[#171717]">
              Yerlesim Kirilimi
            </h4>
            {data.fetchedAt && (
              <p className="text-xs font-commons text-neutral-400 mt-0.5">
                Son guncelleme: {formatFetchTime(data)}
              </p>
            )}
          </div>
          <button
            onClick={handleFetch}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-commons text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Veri Cek
          </button>
        </div>

        {/* Placement matrix */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-commons font-semibold text-neutral-500 uppercase">
                  Platform / Pozisyon
                </th>
                {matrixData.positions.map((pos) => (
                  <th
                    key={pos}
                    className="px-3 py-2 text-center text-xs font-commons font-semibold text-neutral-500 uppercase"
                  >
                    {POSITION_DISPLAY[pos] || pos}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {matrixData.platforms.map((pub) => (
                <tr key={pub}>
                  <td className="px-3 py-2 text-sm font-commons font-medium text-[#171717]">
                    {PLATFORM_DISPLAY[pub] || pub}
                  </td>
                  {matrixData.positions.map((pos) => {
                    const spend = matrixData.matrix[pub]?.[pos] || 0;
                    return (
                      <td
                        key={pos}
                        className={`px-3 py-2 text-center text-xs font-commons font-medium rounded ${getIntensityClass(spend, matrixData.maxSpend)}`}
                      >
                        {spend > 0 ? `${spend.toFixed(0)} TL` : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail table */}
      <div className="bg-white rounded-xl border border-neutral-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                {([
                  { key: 'publisherPlatform' as SortField, label: 'Platform' },
                  { key: 'platformPosition' as SortField, label: 'Pozisyon' },
                  { key: 'impressions' as SortField, label: 'Gosterim' },
                  { key: 'clicks' as SortField, label: 'Tiklama' },
                  { key: 'spend' as SortField, label: 'Harcama' },
                  { key: 'ctr' as SortField, label: 'CTR' },
                  { key: 'cpc' as SortField, label: 'CPC' },
                  { key: 'conversions' as SortField, label: 'Donusum' },
                ]).map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="px-4 py-3 text-left text-xs font-commons font-semibold text-neutral-500 uppercase cursor-pointer hover:text-neutral-700 select-none"
                  >
                    <span className="flex items-center gap-1">
                      {label}{sortIndicator(key)}
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sortedRows.map((row, i) => (
                <tr key={i} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm font-commons text-[#171717]">
                    {PLATFORM_DISPLAY[row.publisherPlatform || ''] || row.publisherPlatform || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-commons text-[#171717]">
                    {POSITION_DISPLAY[row.platformPosition || ''] || row.platformPosition || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-commons text-neutral-600">
                    {row.impressions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-commons text-neutral-600">
                    {row.clicks.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-commons font-medium text-[#171717]">
                    {row.spend.toFixed(2)} TL
                  </td>
                  <td className="px-4 py-3 text-sm font-commons text-neutral-600">
                    {row.ctr.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-sm font-commons text-neutral-600">
                    {row.cpc.toFixed(2)} TL
                  </td>
                  <td className="px-4 py-3 text-sm font-commons text-neutral-600">
                    {row.conversions.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PlacementBreakdown;
