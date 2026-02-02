import React, { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Download, RefreshCw, AlertCircle } from 'lucide-react';
import type { CampaignBreakdown, BreakdownRow } from '@/shared/types/breakdown';
import { getBreakdownData, syncBreakdown } from '@/shared/services/marketingService';

interface Props {
  campaignId: string;
  metaCampaignId?: string;
  projectId?: string;
}

const DEVICE_COLORS: Record<string, string> = {
  mobile: '#6366f1',
  desktop: '#06b6d4',
  tablet: '#f59e0b',
};

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Mobil',
  desktop: 'Masaustu',
  tablet: 'Tablet',
};

interface DonutDataPoint {
  name: string;
  value: number;
  color: string;
  key: string;
}

function transformForDonut(rows: BreakdownRow[]): DonutDataPoint[] {
  const grouped: Record<string, number> = {};

  for (const row of rows) {
    const device = row.devicePlatform || 'unknown';
    grouped[device] = (grouped[device] || 0) + row.spend;
  }

  return Object.entries(grouped)
    .filter(([, spend]) => spend > 0)
    .map(([device, spend]) => ({
      name: DEVICE_LABELS[device] || device,
      value: parseFloat(spend.toFixed(2)),
      color: DEVICE_COLORS[device] || '#a3a3a3',
      key: device,
    }))
    .sort((a, b) => b.value - a.value);
}

function formatFetchTime(data: CampaignBreakdown): string {
  if (!data.fetchedAt) return '';
  return data.fetchedAt.toDate().toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const DeviceBreakdown: React.FC<Props> = ({ campaignId, metaCampaignId, projectId }) => {
  const [data, setData] = useState<CampaignBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    getBreakdownData(campaignId, 'device')
      .then(setData)
      .catch(console.error)
      .finally(() => setInitialLoading(false));
  }, [campaignId]);

  const handleFetch = async () => {
    if (!metaCampaignId || !projectId) return;
    setLoading(true);
    try {
      await syncBreakdown(projectId, campaignId, metaCampaignId, 'device');
      const fresh = await getBreakdownData(campaignId, 'device');
      setData(fresh);
    } catch (err) {
      console.error('Device breakdown sync failed:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const donutData = transformForDonut(data.data);
  const totalSpend = donutData.reduce((sum, d) => sum + d.value, 0);

  // Aggregate rows by device for the table
  const deviceAggregates: Record<string, BreakdownRow> = {};
  for (const row of data.data) {
    const device = row.devicePlatform || 'unknown';
    if (!deviceAggregates[device]) {
      deviceAggregates[device] = {
        devicePlatform: device,
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
    const agg = deviceAggregates[device];
    agg.impressions += row.impressions;
    agg.clicks += row.clicks;
    agg.spend += row.spend;
    agg.conversions += row.conversions;
    agg.reach += row.reach;
  }

  // Recalculate derived metrics
  const tableRows = Object.values(deviceAggregates)
    .map((row) => ({
      ...row,
      ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
      cpc: row.clicks > 0 ? row.spend / row.clicks : 0,
    }))
    .sort((a, b) => b.spend - a.spend);

  return (
    <div className="space-y-4">
      {/* Chart card */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-base font-commons font-semibold text-[#171717]">
              Cihaz Kirilimi
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

        <div className="flex items-center gap-6">
          {/* Donut chart */}
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {donutData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    fontFamily: 'TT Commons, sans-serif',
                    fontSize: 13,
                    borderRadius: 8,
                    border: '1px solid #e5e5e5',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  formatter={(value: number) => [`${value.toLocaleString()} TL`, 'Harcama']}
                />
                <Legend
                  wrapperStyle={{ fontFamily: 'TT Commons, sans-serif', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend sidebar */}
          <div className="space-y-3 min-w-[160px]">
            {donutData.map((entry) => (
              <div key={entry.key} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <div>
                  <p className="text-sm font-commons font-medium text-[#171717]">
                    {entry.name}
                  </p>
                  <p className="text-xs font-commons text-neutral-500">
                    {entry.value.toLocaleString()} TL ({totalSpend > 0 ? ((entry.value / totalSpend) * 100).toFixed(1) : 0}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-white rounded-xl border border-neutral-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                {['Cihaz', 'Gosterim', 'Tiklama', 'Harcama', 'CTR', 'CPC', 'Erisim'].map(
                  (header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left text-xs font-commons font-semibold text-neutral-500 uppercase"
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {tableRows.map((row, i) => (
                <tr key={i} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm font-commons font-medium text-[#171717]">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            DEVICE_COLORS[row.devicePlatform || ''] || '#a3a3a3',
                        }}
                      />
                      {DEVICE_LABELS[row.devicePlatform || ''] || row.devicePlatform}
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

export default DeviceBreakdown;
