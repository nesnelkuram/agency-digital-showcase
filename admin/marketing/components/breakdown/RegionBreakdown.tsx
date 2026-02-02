import React, { useState, useEffect, useMemo } from 'react';
import { Download, RefreshCw, AlertCircle, ArrowUpDown } from 'lucide-react';
import type { CampaignBreakdown, BreakdownRow } from '@/shared/types/breakdown';
import { getBreakdownData, syncBreakdown } from '@/shared/services/marketingService';

interface Props {
  campaignId: string;
  metaCampaignId?: string;
  projectId?: string;
}

type SortField = 'region' | 'impressions' | 'clicks' | 'spend' | 'ctr' | 'cpc' | 'conversions' | 'reach';
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

const RegionBreakdown: React.FC<Props> = ({ campaignId, metaCampaignId, projectId }) => {
  const [data, setData] = useState<CampaignBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    getBreakdownData(campaignId, 'region')
      .then(setData)
      .catch(console.error)
      .finally(() => setInitialLoading(false));
  }, [campaignId]);

  const handleFetch = async () => {
    if (!metaCampaignId || !projectId) return;
    setLoading(true);
    try {
      await syncBreakdown(projectId, campaignId, metaCampaignId, 'region');
      const fresh = await getBreakdownData(campaignId, 'region');
      setData(fresh);
    } catch (err) {
      console.error('Region breakdown sync failed:', err);
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

  // Aggregate rows by region and sort
  const sortedRows = useMemo(() => {
    if (!data?.data) return [];

    // Aggregate by region
    const regionMap: Record<string, BreakdownRow> = {};
    for (const row of data.data) {
      const region = row.region || 'Bilinmiyor';
      if (!regionMap[region]) {
        regionMap[region] = {
          region,
          impressions: 0,
          clicks: 0,
          spend: 0,
          ctr: 0,
          cpc: 0,
          cpm: 0,
          conversions: 0,
          reach: 0,
        };
      }
      const agg = regionMap[region];
      agg.impressions += row.impressions;
      agg.clicks += row.clicks;
      agg.spend += row.spend;
      agg.conversions += row.conversions;
      agg.reach += row.reach;
    }

    // Recalculate derived metrics
    const rows = Object.values(regionMap).map((row) => ({
      ...row,
      ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
      cpc: row.clicks > 0 ? row.spend / row.clicks : 0,
    }));

    // Sort
    return rows.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sortField === 'region') {
        aVal = a.region || '';
        bVal = b.region || '';
      } else {
        aVal = (a as any)[sortField] ?? 0;
        bVal = (b as any)[sortField] ?? 0;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal, 'tr') : bVal.localeCompare(aVal, 'tr');
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

  const columns: { key: SortField; label: string }[] = [
    { key: 'region', label: 'Bolge' },
    { key: 'impressions', label: 'Gosterim' },
    { key: 'clicks', label: 'Tiklama' },
    { key: 'spend', label: 'Harcama' },
    { key: 'ctr', label: 'CTR' },
    { key: 'cpc', label: 'CPC' },
    { key: 'conversions', label: 'Donusum' },
    { key: 'reach', label: 'Erisim' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-commons font-semibold text-[#171717]">
              Bolge Kirilimi
            </h4>
            {data.fetchedAt && (
              <p className="text-xs font-commons text-neutral-400 mt-0.5">
                Son guncelleme: {formatFetchTime(data)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-commons text-neutral-400">
              {sortedRows.length} bolge
            </span>
            <button
              onClick={handleFetch}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-commons text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Veri Cek
            </button>
          </div>
        </div>
      </div>

      {/* Sortable table */}
      <div className="bg-white rounded-xl border border-neutral-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                {columns.map(({ key, label }) => (
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
                <tr
                  key={row.region || i}
                  className={`hover:bg-neutral-50 ${i < 10 ? 'bg-indigo-50/40' : ''}`}
                >
                  <td className="px-4 py-3 text-sm font-commons font-medium text-[#171717]">
                    <div className="flex items-center gap-2">
                      {i < 10 && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-commons font-bold flex items-center justify-center">
                          {i + 1}
                        </span>
                      )}
                      {row.region || 'Bilinmiyor'}
                    </div>
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
                  <td className="px-4 py-3 text-sm font-commons text-neutral-600">
                    {row.reach.toLocaleString()}
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

export default RegionBreakdown;
