import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Download, RefreshCw, AlertCircle } from 'lucide-react';
import type { CampaignBreakdown, BreakdownRow } from '@/shared/types/breakdown';
import { getBreakdownData, syncBreakdown } from '@/shared/services/marketingService';

interface Props {
  campaignId: string;
  metaCampaignId?: string;
  projectId?: string;
}

const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

interface ChartDataPoint {
  age: string;
  male: number;
  female: number;
}

function transformForChart(rows: BreakdownRow[]): ChartDataPoint[] {
  const grouped: Record<string, { male: number; female: number }> = {};

  for (const age of AGE_RANGES) {
    grouped[age] = { male: 0, female: 0 };
  }

  for (const row of rows) {
    const age = row.age || '';
    const gender = row.gender || 'unknown';
    if (!grouped[age]) continue;

    if (gender === 'male') {
      grouped[age].male += row.spend;
    } else if (gender === 'female') {
      grouped[age].female += row.spend;
    }
  }

  return AGE_RANGES.map((age) => ({
    age,
    male: parseFloat(grouped[age].male.toFixed(2)),
    female: parseFloat(grouped[age].female.toFixed(2)),
  }));
}

function isCacheValid(data: CampaignBreakdown): boolean {
  if (!data.fetchedAt) return false;
  const fetchedMs = data.fetchedAt.toDate().getTime();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return Date.now() - fetchedMs < twentyFourHours;
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

const AgeGenderBreakdown: React.FC<Props> = ({ campaignId, metaCampaignId, projectId }) => {
  const [data, setData] = useState<CampaignBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    getBreakdownData(campaignId, 'age_gender')
      .then(setData)
      .catch(console.error)
      .finally(() => setInitialLoading(false));
  }, [campaignId]);

  const handleFetch = async () => {
    if (!metaCampaignId || !projectId) return;
    setLoading(true);
    try {
      await syncBreakdown(projectId, campaignId, metaCampaignId, 'age_gender');
      const fresh = await getBreakdownData(campaignId, 'age_gender');
      setData(fresh);
    } catch (err) {
      console.error('Age/Gender breakdown sync failed:', err);
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

  const chartData = transformForChart(data.data);
  const sortedRows = [...data.data].sort((a, b) => b.spend - a.spend);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-neutral-200/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-base font-commons font-semibold text-[#171717]">
              Yas & Cinsiyet Kirilimi
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

        {/* Chart */}
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis
              type="number"
              tick={{ fontFamily: 'TT Commons, sans-serif', fontSize: 12, fill: '#737373' }}
              tickFormatter={(v: number) => `${v.toLocaleString()} TL`}
            />
            <YAxis
              type="category"
              dataKey="age"
              tick={{ fontFamily: 'TT Commons, sans-serif', fontSize: 12, fill: '#737373' }}
              width={50}
            />
            <Tooltip
              contentStyle={{
                fontFamily: 'TT Commons, sans-serif',
                fontSize: 13,
                borderRadius: 8,
                border: '1px solid #e5e5e5',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
              formatter={(value: number) => [`${value.toLocaleString()} TL`, '']}
            />
            <Legend
              wrapperStyle={{ fontFamily: 'TT Commons, sans-serif', fontSize: 12 }}
            />
            <Bar dataKey="male" name="Erkek" fill="#6366f1" radius={[0, 4, 4, 0]} />
            <Bar dataKey="female" name="Kadin" fill="#ec4899" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Data table */}
      <div className="bg-white rounded-xl border border-neutral-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                {['Yas', 'Cinsiyet', 'Gosterim', 'Tiklama', 'Harcama', 'CTR', 'CPC', 'Donusum'].map(
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
              {sortedRows.map((row, i) => (
                <tr key={i} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-sm font-commons text-[#171717]">
                    {row.age || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-commons text-[#171717]">
                    {row.gender === 'male' ? 'Erkek' : row.gender === 'female' ? 'Kadin' : 'Bilinmiyor'}
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

export default AgeGenderBreakdown;
